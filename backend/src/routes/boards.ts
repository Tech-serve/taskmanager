// src/routes/boards.ts
import { Router, Response } from 'express';
import { Board } from '../models/Board';
import { Column } from '../models/Column';
import { Task } from '../models/Task';
import { User } from '../models/User';
import { AuthRequest, Role } from '../types';
import { requireAdmin } from '../middleware/auth';
import { validate, createBoardSchema, updateBoardSchema, createColumnSchema } from '../middleware/validation';

const router = Router();

// Допустимые шаблоны в БД (enum)
const ALLOWED_TEMPLATES = new Set(['kanban-basic', 'kanban-tj-tech', 'empty']);

/** Общая проверка доступа к конкретной доске */
const checkBoardAccess = async (user: any, boardKey: string) => {
  const key = String(boardKey || '').toUpperCase();
  const board = await Board.findOne({ key });
  if (!board) return null;

  // Админ видит всё
  if (user.roles.includes(Role.ADMIN)) return board;

  // Buyer — исторически имеет доступ к базовым
  if (user.roles.includes(Role.BUYER) && ['BUY', 'TECH', 'DES'].includes(key)) {
    return board;
  }

  // Доступ по ролям доски
  if (Array.isArray(board.allowedRoles) && board.allowedRoles.some((r: string) => user.roles.includes(r))) {
    return board;
  }

  // Члены или владельцы
  if (
    (Array.isArray(board.members) && board.members.includes(user.id)) ||
    (Array.isArray(board.owners) && board.owners.includes(user.id))
  ) {
    return board;
  }

  return null;
};

/** GET /api/boards — список доступных досок */
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    let query: any = {};

    if (!user.roles.includes(Role.ADMIN)) {
      const or: any[] = [
        { allowedRoles: { $in: user.roles } },
        { members: user.id },
        { owners: user.id },
      ];

      // Сохраняем твой «whitelist» для покупателей
      if (user.roles.includes(Role.BUYER)) {
        or.push({ key: { $in: ['BUY', 'TECH', 'DES'] } });
      }

      query = { $or: or };
    }

    const boards = await Board.find(query).sort({ createdAt: -1 });
    res.json(boards);
  } catch (e) {
    console.error('Get boards error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** GET /api/boards/by-key/:key — получить доску по ключу (строгий доступ) */
router.get('/by-key/:key', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const key = String(req.params.key || '').toUpperCase();

    const board = await checkBoardAccess(user, key);
    if (!board) {
      res.status(404).json({ error: 'Board not found or access denied' });
      return;
    }
    res.json(board);
  } catch (e) {
    console.error('Get board error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** POST /api/boards — создать доску (только админ) */
router.post('/', requireAdmin, validate(createBoardSchema), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const body = req.body || {};

    // ключ доски всегда UPPERCASE
    body.key = String(body.key || '').toUpperCase();

    // ⚠️ Нормализуем allowedRoles к lowercase (enum Role у тебя в нижнем регистре)
    if (Array.isArray(body.allowedRoles)) {
      body.allowedRoles = body.allowedRoles
        .filter((r: unknown) => typeof r === 'string')
        .map((r: string) => r.trim().toLowerCase());
    }

    // Чистим составные поля (если фронт шлёт null/undefined)
    if (!Array.isArray(body.members)) body.members = [];
    if (!Array.isArray(body.owners)) body.owners = [];
    if (!Array.isArray(body.allowedGroupIds)) body.allowedGroupIds = [];

    // ✅ НОРМАЛИЗАЦИЯ TEMPLATE (UI → enum БД)
    // Если прилетело 'expenses-default' или любое невалидное — ставим 'kanban-basic'
    const incomingTemplate = String(body.template || '').trim();
    if (String(body.type || '') === 'expenses') {
      body.template = 'kanban-basic';
    } else {
      body.template = ALLOWED_TEMPLATES.has(incomingTemplate) ? incomingTemplate : 'kanban-basic';
    }

    // Проверка уникальности ключа
    const existing = await Board.findOne({ key: body.key });
    if (existing) {
      res.status(400).json({ error: 'Board key already exists' });
      return;
    }

    const board = new Board(body);
    await board.save();

    res.status(201).json(board);
  } catch (e: any) {
    console.error('Create board error:', e);
    res.status(400).json({ error: e?.message || 'Bad Request' });
  }
});

/** PATCH /api/boards/:id — обновить доску (только админ) */
router.patch('/:id', requireAdmin, validate(updateBoardSchema), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const update = req.body || {};

    const board = await Board.findOne({ id });
    if (!board) {
      res.status(404).json({ error: 'Board not found' });
      return;
    }

    // ✅ НОРМАЛИЗАЦИЯ TEMPLATE при апдейте
    if (typeof update.template === 'string') {
      const incomingTemplate = String(update.template).trim();

      const effectiveType = typeof update.type === 'string' ? update.type : board.type;
      if (String(effectiveType) === 'expenses') {
        update.template = 'kanban-basic';
      } else {
        update.template = ALLOWED_TEMPLATES.has(incomingTemplate) ? incomingTemplate : 'kanban-basic';
      }
    }

    // ⚠️ Нормализуем allowedRoles к lowercase
    if (Array.isArray(update.allowedRoles)) {
      update.allowedRoles = update.allowedRoles
        .filter((r: unknown) => typeof r === 'string')
        .map((r: string) => r.trim().toLowerCase());
    }

    Object.assign(board, update);
    board.updatedAt = new Date();
    await board.save();

    res.json(board);
  } catch (e) {
    console.error('Update board error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** DELETE /api/boards/:id — удалить доску (только админ) */
router.delete('/:id', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const board = await Board.findOne({ id });
    if (!board) {
      res.status(404).json({ error: 'Board not found' });
      return;
    }

    await Column.deleteMany({ boardId: id });
    await Task.deleteMany({ boardKey: board.key });
    await Board.deleteOne({ id });

    res.json({ message: 'Board deleted successfully' });
  } catch (e) {
    console.error('Delete board error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** GET /api/boards/:boardId/columns — колонки доски */
router.get('/:boardId/columns', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { boardId } = req.params;
    const user = req.user!;
    const board = await Board.findOne({ id: boardId });
    if (!board) {
      res.status(404).json({ error: 'Board not found' });
      return;
    }
    const access = await checkBoardAccess(user, board.key);
    if (!access) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }
    const columns = await Column.find({ boardId }).sort({ order: 1 });
    res.json(columns);
  } catch (e) {
    console.error('Get columns error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** POST /api/boards/:boardId/columns — создать колонку (админ) */
router.post('/:boardId/columns', requireAdmin, validate(createColumnSchema), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { boardId } = req.params;
    const board = await Board.findOne({ id: boardId });
    if (!board) {
      res.status(404).json({ error: 'Board not found' });
      return;
    }

    const column = new Column({ ...req.body, boardId });
    await column.save();
    res.status(201).json(column);
  } catch (e) {
    console.error('Create column error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** GET /api/boards/:boardKey/column-stats — агрегация по колонкам */
router.get('/:boardKey/column-stats', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const key = String(req.params.boardKey || '').toUpperCase();

    const board = await Board.findOne({ key });
    if (!board) {
      res.status(404).json({ error: 'Board not found' });
      return;
    }
    const access = await checkBoardAccess(user, key);
    if (!access) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const columns = await Column.find({ boardId: board.id }).sort({ order: 1 });
    const out: any[] = [];
    for (const col of columns) {
      const tasks = await Task.find({ boardKey: key, columnId: col.id });
      const totalAmount = tasks.reduce((s, t) => s + (t.amount || 0), 0);
      out.push({
        columnId: col.id,
        columnKey: col.key,
        columnName: col.name,
        taskCount: tasks.length,
        totalAmount,
      });
    }
    res.json(out);
  } catch (e) {
    console.error('Get column stats error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** GET /api/boards/:boardKey/tasks — задачи доски с ролевой фильтрацией */
router.get('/:boardKey/tasks', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const key = String(req.params.boardKey || '').toUpperCase();
    const { columns, assignees, q } = req.query;

    const board = await checkBoardAccess(user, key);
    if (!board) {
      res.status(404).json({ error: 'Board not found or access denied' });
      return;
    }

    const query: any = { boardKey: key };

    // Ролевая фильтрация задач
    if (!user.roles.includes(Role.ADMIN)) {
      if (user.roles.includes(Role.BUYER)) {
        query.creatorId = user.id;
      } else if (user.roles.includes(Role.TECH) && key === 'TECH') {
        // видит всё на TECH
      } else if (user.roles.includes(Role.DESIGNER) && key === 'DES') {
        // видит всё на DES
      } else if (user.roles.includes(Role.TECH) || user.roles.includes(Role.DESIGNER)) {
        query.creatorId = user.id;
      } else {
        query.creatorId = user.id;
      }
    }

    if (columns) {
      query.columnId = { $in: String(columns).split(',') };
    }
    if (assignees) {
      query.assigneeId = { $in: String(assignees).split(',') };
    }
    if (q) {
      query.$or = [
        { title: { $regex: String(q), $options: 'i' } },
        { description: { $regex: String(q), $options: 'i' } },
      ];
    }

    const tasks = await Task.find(query).sort({ createdAt: -1 });
    res.json(tasks);
  } catch (e) {
    console.error('Get tasks error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** ВАЖНО: спец-маршрут ДОЛЖЕН идти до catch-all */
router.get('/:boardKey/assignable-users', async (req: AuthRequest, res: Response) => {
  try {
    const key = String(req.params.boardKey || '').toUpperCase();
    const board = await Board.findOne({ key }).lean();
    if (!board) return res.status(404).json({ error: 'Board not found' });

    const or: any[] = [];
    if (Array.isArray(board.allowedRoles) && board.allowedRoles.length) {
      or.push({ roles: { $in: board.allowedRoles } });
    }
    if (Array.isArray(board.allowedGroupIds) && board.allowedGroupIds.length) {
      or.push({ groups: { $in: board.allowedGroupIds } });
    }
    if (Array.isArray(board.members) && board.members.length) {
      or.push({ id: { $in: board.members } });
    }
    if (Array.isArray(board.owners) && board.owners.length) {
      or.push({ id: { $in: board.owners } });
    }

    const query: any = { status: 'active' };
    if (or.length) query.$or = or;

    const users = await User.find(query)
      .select('id email fullName roles groups status')
      .sort({ fullName: 1 })
      .lean();

    res.json(users.map(u => ({ ...u, full_name: u.fullName })));
  } catch (e) {
    console.error('Assignable users error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** GET /api/boards/:boardKey — получить доску по ключу (catch-all, ДЕРЖИ В КОНЦЕ) */
router.get('/:boardKey', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const key = String(req.params.boardKey || '').toUpperCase();

    const board = await checkBoardAccess(user, key);
    if (!board) {
      res.status(404).json({ error: 'Board not found or access denied' });
      return;
    }
    res.json(board);
  } catch (e) {
    console.error('Get board error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;