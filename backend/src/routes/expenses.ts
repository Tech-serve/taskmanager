import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { validate } from '../middleware/validation'
import { createExpenseSchema, updateExpenseSchema } from '../middleware/expenses';
import { Expense } from '../models/Expense';
import { Board } from '../models/Board';
import { Column } from '../models/Column';
import { AuthRequest, Role } from '../types';

const router = Router();

/** Доступ к борду (копия из tasks) */
const checkBoardAccess = async (user: any, boardKey: string) => {
  const key = String(boardKey || '').toUpperCase();
  const board = await Board.findOne({ key });
  if (!board) return null;

  if (user.roles?.includes(Role.ADMIN)) return board;
  if (user.roles?.includes(Role.BUYER) && ['BUY', 'TECH', 'DES', 'EXP'].includes(key)) return board;

  if (board.allowedRoles?.some((r) => user.roles?.includes(String(r)))) return board;
  if ((board.members || []).includes(user.id)) return board;
  if ((board.owners || []).includes(user.id)) return board;

  return null;
};

/** Создать расход */
router.post('/', validate(createExpenseSchema), async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const data = { ...(req.body || {}) };

    data.boardKey = String(data.boardKey || '').toUpperCase();

    const board = await checkBoardAccess(user, data.boardKey);
    if (!board) return void res.status(404).json({ error: 'Board not found or access denied' });

    const column = await Column.findOne({ id: data.columnId });
    if (!column) return void res.status(404).json({ error: 'Column not found' });

    // дефолт валюты
    if (!data.currency) data.currency = 'USD';

    const expense = new Expense({
      ...data,
      creatorId: user.id,
    });

    await expense.save();
    res.status(201).json(expense.toJSON());
  } catch (error: any) {
    console.error('Create expense error:', error);
    if (error?.name === 'ValidationError') {
      return void res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** Обновить расход */
router.patch('/:id', validate(updateExpenseSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const patch = { ...(req.body || {}) };
    const user = req.user!;

    const exp = await Expense.findOne({ id });
    if (!exp) return void res.status(404).json({ error: 'Expense not found' });

    const board = await checkBoardAccess(user, exp.boardKey);
    if (!board) return void res.status(403).json({ error: 'Access denied' });

    const isAdmin = user.roles?.includes(Role.ADMIN);
    if (!isAdmin) {
      const isCreatorOrAssignee = [exp.creatorId, exp.assigneeId].includes(user.id);
      if (!isCreatorOrAssignee) {
        return void res.status(403).json({ error: 'Access denied' });
      }
    }

    // перемещение по колонкам — просто обновим columnId при наличии
    if (patch.columnId) {
      const col = await Column.findOne({ id: patch.columnId });
      if (!col) return void res.status(404).json({ error: 'Column not found' });
    }

    Object.assign(exp, patch, { updatedAt: new Date() });
    await exp.save();
    res.json(exp.toJSON());
  } catch (error) {
    console.error('Update expense error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** Комментарий к расходу */
router.post('/:id/comments', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const { text } = req.body || {};

    if (!text || typeof text !== 'string' || !text.trim()) {
      return void res.status(400).json({ error: 'Text is required' });
    }

    const exp = await Expense.findOne({ id });
    if (!exp) return void res.status(404).json({ error: 'Expense not found' });

    const board = await checkBoardAccess(user, exp.boardKey);
    if (!board) return void res.status(403).json({ error: 'Access denied' });

    const comment = {
      id: uuidv4(),
      authorId: user.id,
      authorName: user.fullName || user.email,
      text: text.trim(),
      createdAt: new Date(),
    };

    exp.comments = exp.comments || [];
    exp.comments.push(comment as any);
    exp.updatedAt = new Date();
    await exp.save();

    res.status(201).json(comment);
  } catch (error) {
    console.error('Add expense comment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** Удаление */
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user!;

    const exp = await Expense.findOne({ id });
    if (!exp) return void res.status(404).json({ error: 'Expense not found' });

    const board = await Board.findOne({ key: exp.boardKey });
    const isOwner = (board?.owners || []).includes(user.id);
    if (!user.roles?.includes(Role.ADMIN) && exp.creatorId !== user.id && !isOwner) {
      return void res.status(403).json({ error: 'Permission denied' });
    }

    await Expense.deleteOne({ id });
    res.json({ message: 'Expense deleted successfully' });
  } catch (error) {
    console.error('Delete expense error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** Листинг для доски */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { boardKey, columnId, limit = '200' } = (req.query || {}) as any;

    const key = String(boardKey || '').toUpperCase();
    if (!key) return void res.status(400).json({ error: 'boardKey is required' });

    const board = await checkBoardAccess(user, key);
    if (!board) return void res.status(403).json({ error: 'Access denied' });

    const q: any = { boardKey: key };
    if (columnId) q.columnId = String(columnId);
    const n = Math.min(Math.max(parseInt(String(limit), 10) || 200, 1), 1000);

    const items = await Expense.find(q).sort({ createdAt: -1 }).limit(n);
    res.json(items.map((i) => i.toJSON()));
  } catch (error) {
    console.error('List expenses error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** Мои расходы (ассайни) */
router.get('/me/expenses', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const items = await Expense.find({ assigneeId: user.id }).sort({ createdAt: -1 });
    res.json(items.map((i) => i.toJSON()));
  } catch (error) {
    console.error('My expenses error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;