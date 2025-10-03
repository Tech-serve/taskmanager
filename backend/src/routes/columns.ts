// src/routes/columns.ts
import { Router, Response } from 'express';
import { AuthRequest } from '../types';
import { requireAdmin } from '../middleware/auth';
import { validate, updateColumnSchema } from '../middleware/validation';
import { Column } from '../models/Column';
import { Task } from '../models/Task';

const router = Router();

/**
 * helper: переупорядочить колонки внутри boardId по массиву id (1-based order)
 */
async function reorderColumns(boardId: string, orderedIds: string[]) {
  if (!Array.isArray(orderedIds) || !orderedIds.length) return;
  const ops = orderedIds.map((id, idx) => ({
    updateOne: { filter: { id, boardId }, update: { $set: { order: idx + 1 } } },
  }));
  await Column.bulkWrite(ops);
}

/**
 * PATCH /api/columns/:id — изменить колонку (name/key/order)
 */
router.patch('/:id', requireAdmin, validate(updateColumnSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, key, order } = req.body ?? {};

    const col = await Column.findOne({ id });
    if (!col) {
      return void res.status(404).json({ error: 'Column not found' });
    }

    // Обновляем простые поля
    if (typeof name === 'string') col.name = name;
    if (typeof key === 'string') col.key = key.toUpperCase();

    // Если меняется порядок — переупорядочим аккуратно
    if (typeof order === 'number' && Number.isFinite(order) && order >= 1) {
      const siblings = await Column.find({ boardId: col.boardId }).sort({ order: 1 }).lean();
      const ids = siblings.map(s => s.id).filter(x => x !== col.id);

      // Вставим текущую колонку на нужную позицию (clamp)
      const targetIdx = Math.min(Math.max(order - 1, 0), ids.length);
      ids.splice(targetIdx, 0, col.id);

      await reorderColumns(col.boardId, ids);
      col.order = targetIdx + 1; // локально тоже выставим
    }

    col.updatedAt = new Date();
    await col.save();
    res.json(col);
  } catch (e) {
    console.error('Update column error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/columns/:id?moveTo=<targetColumnId>
 * Удалить колонку. Если есть задачи:
 *  - без moveTo → 409 с подсказкой
 *  - с moveTo  → перенесём задачи, затем удалим колонку
 */
router.delete('/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const moveTo = String(req.query.moveTo || '').trim() || null;

    const col = await Column.findOne({ id });
    if (!col) {
      return void res.status(404).json({ error: 'Column not found' });
    }

    const tasksCount = await Task.countDocuments({ columnId: col.id });

    if (tasksCount > 0 && !moveTo) {
      // просим UI выбрать целевую колонку
      return void res.status(409).json({
        error: 'Column has tasks',
        details: [{ message: 'Column contains tasks. Provide ?moveTo=<columnId> to move them before deleting.' }],
        tasksCount,
      });
    }

    if (moveTo) {
      if (moveTo === col.id) {
        return void res.status(400).json({ error: 'moveTo must be a different column id' });
      }
      const target = await Column.findOne({ id: moveTo });
      if (!target) {
        return void res.status(404).json({ error: 'Target column not found' });
      }
      if (target.boardId !== col.boardId) {
        return void res.status(400).json({ error: 'Target column must belong to the same board' });
      }

      // переносим задачи
      await Task.updateMany({ columnId: col.id }, { $set: { columnId: target.id } });
    }

    // удаляем колонку
    await Column.deleteOne({ id: col.id });

    // пересчитываем order остальных колонок
    const rest = await Column.find({ boardId: col.boardId }).sort({ order: 1 }).lean();
    await reorderColumns(col.boardId, rest.map(r => r.id));

    res.json({
      message: 'Column deleted successfully',
      movedTasks: moveTo ? tasksCount : 0,
      deletedTasks: 0,
    });
  } catch (e) {
    console.error('Delete column error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;