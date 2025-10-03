import { Router, Response } from 'express';
import { Task } from '../models/Task';
import { Board } from '../models/Board';
import { Column } from '../models/Column';
import { AuthRequest, Role } from '../types';
import { validate, createTaskSchema, updateTaskSchema } from '../middleware/validation';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

/** Проверка доступа к борду */
const checkBoardAccess = async (user: any, boardKey: string) => {
  const key = String(boardKey || '').toUpperCase();
  const board = await Board.findOne({ key });
  if (!board) return null;

  // Админ — везде
  if (user.roles?.includes(Role.ADMIN)) return board;

  // Покупателю открываем BUY/TECH/DES (как было)
  if (user.roles?.includes(Role.BUYER) && ['BUY', 'TECH', 'DES'].includes(key)) {
    return board;
  }

  // Роли на борде
  if (board.allowedRoles && board.allowedRoles.some((r: Role) => user.roles?.includes(r))) {
    return board;
  }

  // Участник или владелец
  if ((board.members || []).includes(user.id)) return board;
  if ((board.owners || []).includes(user.id)) return board;

  return null;
};

/**
 * POST /api/tasks
 * Создать задачу
 */
router.post('/', validate(createTaskSchema), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const taskData = { ...(req.body || {}) };

    // нормализация
    taskData.boardKey = String(taskData.boardKey || '').toUpperCase();

    // доступ к борду
    const board = await checkBoardAccess(user, taskData.boardKey);
    if (!board) {
      res.status(404).json({ error: 'Board not found or access denied' });
      return;
    }

    // колонка существует?
    const column = await Column.findOne({ id: taskData.columnId });
    if (!column) {
      res.status(404).json({ error: 'Column not found' });
      return;
    }

    // мягкая нормализация расходов
    if (taskData.amount !== undefined) {
      const n = Number(taskData.amount);
      taskData.amount = Number.isFinite(n) ? n : 0;
    }
    if (taskData.category !== undefined && taskData.category !== null) {
      taskData.category = String(taskData.category);
    }

    // создаём
    const task = new Task({
      ...taskData,
      creatorId: user.id,
    });

    await task.save();
    res.status(201).json(task.toJSON());
  } catch (error: any) {
    console.error('Create task error:', error);
    if (error?.name === 'ValidationError') {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /api/tasks/:id
 * Обновить задачу (с кросс-командным роутингом)
 */
router.patch('/:id', validate(updateTaskSchema), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updateData = { ...(req.body || {}) };
    const user = req.user!;

    const task = await Task.findOne({ id });
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    // доступ по текущему борду задачи
    const board = await checkBoardAccess(user, task.boardKey);
    if (!board) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const isAdmin = user.roles?.includes(Role.ADMIN);

    // перемещение между бордами по спец-колонкам
    if (updateData.columnId) {
      const newColumn = await Column.findOne({ id: updateData.columnId });
      if (newColumn) {
        const columnKey = newColumn.key;
        const currentBoardKey = task.boardKey;

        let newBoardKey: string | null = null;
        let targetColumnKey: string | null = null;

        if (columnKey === 'TO_TECH' && currentBoardKey !== 'TECH') {
          newBoardKey = 'TECH';
          targetColumnKey = 'TODO';
        } else if (columnKey === 'TO_DESIGNERS' && currentBoardKey !== 'DES') {
          newBoardKey = 'DES';
          targetColumnKey = 'QUEUE';
        }

        if (newBoardKey && targetColumnKey) {
          const targetBoard = await Board.findOne({ key: newBoardKey });
          const targetColumn = await Column.findOne({
            boardId: targetBoard?.id,
            key: targetColumnKey,
          });

          if (targetBoard && targetColumn) {
            task.boardKey = newBoardKey;
            task.columnId = targetColumn.id;
            task.routedFrom = {
              boardKey: currentBoardKey,
              userId: user.id,
              userName: user.fullName,
              routedAt: new Date(),
            };
            // сливаем остальные апдейты, но фиксируем columnId/boardKey
            Object.assign(task, { ...updateData, columnId: targetColumn.id, boardKey: newBoardKey });
            task.updatedAt = new Date();
            await task.save();
            res.json(task.toJSON());
            return;
          }
        }
      }
    }

    // мягкая нормализация расходов
    if (updateData.amount !== undefined) {
      const n = Number(updateData.amount);
      updateData.amount = Number.isFinite(n) ? n : 0;
    }
    if (updateData.category !== undefined && updateData.category !== null) {
      updateData.category = String(updateData.category);
    }

    // права: админ — всё; иначе только автор или текущий ассайни
    if (!isAdmin) {
      const isCreatorOrAssignee = [task.creatorId, task.assigneeId].includes(user.id);
      if (!isCreatorOrAssignee) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }
    }

    Object.assign(task, updateData);
    task.updatedAt = new Date();
    await task.save();

    res.json(task.toJSON());
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/tasks/:id/comments
 * Добавить комментарий к задаче
 */
router.post('/:id/comments', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const { text } = req.body || {};

    if (!text || typeof text !== 'string' || !text.trim()) {
      res.status(400).json({ error: 'Text is required' });
      return;
    }

    const task = await Task.findOne({ id });
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    // доступ к борду задачи
    const board = await checkBoardAccess(user, task.boardKey);
    if (!board) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const comment = {
      id: uuidv4(),
      authorId: user.id,
      authorName: user.fullName || user.email,
      text: text.trim(),
      createdAt: new Date(),
    };

    task.comments = task.comments || [];
    task.comments.push(comment as any);
    task.updatedAt = new Date();
    await task.save();

    // фронт у тебя перезагружает задачу сам, достаточно вернуть комментарий
    res.status(201).json(comment);
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/tasks/:id
 * Удалить задачу
 */
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = req.user!;

    const task = await Task.findOne({ id });
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    const board = await Board.findOne({ key: task.boardKey });
    const isOwner = (board?.owners || []).includes(user.id);

    if (!user.roles?.includes(Role.ADMIN) && task.creatorId !== user.id && !isOwner) {
      res.status(403).json({ error: 'Permission denied' });
      return;
    }

    await Task.deleteOne({ id });
    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/me/tasks
 * Задачи, назначенные текущему пользователю, в доступных ему бордах
 */
router.get('/me/tasks', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;

    // доступные борды
    let boardQuery: any = {};
    if (!user.roles?.includes(Role.ADMIN)) {
      if (user.roles?.includes(Role.BUYER)) {
        boardQuery = { key: { $in: ['BUY', 'TECH', 'DES'] } };
      } else {
        boardQuery = {
          $or: [
            { allowedRoles: { $in: user.roles || [] } },
            { members: user.id },
            { owners: user.id },
          ],
        };
      }
    }

    const accessibleBoards = await Board.find(boardQuery).select('key');
    const accessibleBoardKeys = accessibleBoards.map((b) => b.key);

    // задачи
    const tasks = await Task.find({
      assigneeId: user.id,
      boardKey: { $in: accessibleBoardKeys },
    }).sort({ createdAt: -1 });

    res.json(tasks.map((t) => t.toJSON()));
  } catch (error) {
    console.error('Get my tasks error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;