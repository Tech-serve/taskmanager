// backend/src/routes/boards.ts
import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Board } from '../models/Board';
import { Column } from '../models/Column';
import { Task } from '../models/Task';
import { User } from '../models/User';
import { AuthRequest, Role } from '../types';
import { requireAdmin } from '../middleware/auth';
import {
  validate,
  createBoardSchema,
  updateBoardSchema,
  createColumnSchema,
} from '../middleware/validation';

const router = Router();

// Допустимые шаблоны в БД (enum)
const ALLOWED_TEMPLATES = new Set(['kanban-basic', 'kanban-tj-tech', 'empty']);

/** ==================== НОРМАЛИЗАЦИЯ ==================== */
const canon = (s: unknown) =>
  String(s ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');

const canonList = (arr: unknown): string[] =>
  Array.from(
    new Set((Array.isArray(arr) ? arr : []).map(canon).filter(Boolean))
  );

const upperList = (arr: unknown): string[] =>
  Array.from(
    new Set(
      (Array.isArray(arr) ? arr : [])
        .map((v) => String(v ?? '').trim().toUpperCase())
        .filter(Boolean)
    )
  );
/** ====================================================== */

/** Проверка пересечения департаментов пользователя и борда */
function hasDepartmentAccess(
  userDepartments: string[] | undefined,
  boardVisibleDepartments: string[] | undefined
) {
  const u = new Set((userDepartments || []).map((d) => String(d).toUpperCase()));
  const b = Array.from(
    new Set((boardVisibleDepartments || []).map((d) => String(d).toUpperCase()))
  );
  // пустой список на борде = доступ всем
  if (!b.length) return true;
  return b.some((k) => u.has(k));
}

/** Общая проверка доступа к конкретной доске */
const checkBoardAccess = async (user: any, boardKey: string) => {
  const key = String(boardKey || '').toUpperCase();
  const board = await Board.findOne({ key });
  if (!board) return null;

  const rawRoles = (user as any).effectiveRoles ?? user.roles ?? [];
  const userRoles = canonList(rawRoles);           // ['admin','tech',...]
  const userRoleSet = new Set(userRoles);

  // ✅ Админ видит всё, без учёта департаментов/ролей/членства
  if (userRoleSet.has(Role.ADMIN)) return board;

  // ⬇️ Остальные проверки — только для не-админа

  // 1) Видимость по департаментам (пустой список у борда = видно всем)
  if (!hasDepartmentAccess((user as any).departments, (board as any).visibleDepartments)) {
    return null;
  }

  // 2) Исторический доступ buyer к базовым бордам
  if (userRoleSet.has(Role.BUYER) && ['BUY', 'TECH', 'DES'].includes(key)) {
    return board;
  }

  // 3) Доступ по ролям борда (учитываем legacy allowed_roles)
  const boardRoles = canonList(
    (board as any).allowedRoles || (board as any).allowed_roles || []
  );
  for (const r of boardRoles) {
    if (userRoleSet.has(r)) return board;
  }

  // 4) Член/владелец борда
  if (
    (Array.isArray((board as any).members) && (board as any).members.includes(user.id)) ||
    (Array.isArray((board as any).owners) && (board as any).owners.includes(user.id))
  ) {
    return board;
  }

  // 5) Ничего не подошло — нет доступа
  return null;
};

/** GET /api/boards — список доступных досок */
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const rawRoles = (user as any).effectiveRoles ?? user.roles ?? [];
    const userRoles = canonList(rawRoles);
    const userDeps = (user as any).departments || [];

    // ✅ Админ видит все борды, без деп-фильтра
    if (userRoles.includes(Role.ADMIN)) {
      const boards = await Board.find({}).sort({ createdAt: -1 });
      res.json(boards);
      return;
    }

    // Для не-админа — как было: пересечение департаментов И доступ по ролям/членству
    const depOr = [
      { $or: [{ visibleDepartments: { $exists: false } }, { visibleDepartments: { $size: 0 } }] },
      { visibleDepartments: { $in: upperList(userDeps) } },
    ];

    const or: any[] = [
      { allowedRoles: { $in: userRoles } },
      { allowed_roles: { $in: userRoles } }, // legacy
      { members: user.id },
      { owners: user.id },
    ];

    if (userRoles.includes(Role.BUYER)) {
      or.push({ key: { $in: ['BUY', 'TECH', 'DES'] } });
    }

    const query = { $and: [{ $or: or }, { $or: depOr }] };
    const boards = await Board.find(query).sort({ createdAt: -1 });
    res.json(boards);
  } catch (e) {
    console.error('Get boards error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** GET /api/boards/by-key/:key */
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

/** POST /api/boards — создать доску (идемпотентно) */
router.post(
  '/',
  requireAdmin,
  validate(createBoardSchema),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const body = { ...(req.body || {}) };

      // Ключ → UPPERCASE
      body.key = String(body.key || '').trim().toUpperCase();

      // Нормализация allowedRoles
      body.allowedRoles =
        body.allowedRoles !== undefined ? canonList(body.allowedRoles) : [];

      // Нормализация видимости по департаментам
      body.visibleDepartments =
        body.visibleDepartments !== undefined
          ? upperList(body.visibleDepartments)
          : [];

      // Чистим составные поля
      if (!Array.isArray(body.members)) body.members = [];
      if (!Array.isArray(body.owners)) body.owners = [];
      if (!Array.isArray(body.allowedGroupIds)) body.allowedGroupIds = [];

      // Шаблон
      const incomingTemplate = String(body.template || '').trim();
      if (String(body.type || '') === 'expenses') {
        body.template = 'kanban-basic';
      } else {
        body.template = ALLOWED_TEMPLATES.has(incomingTemplate)
          ? incomingTemplate
          : 'kanban-basic';
      }

      // Идемпотентный upsert: НЕ трогаем createdAt/updatedAt — Mongoose сам поставит
      const upRes = await Board.updateOne(
        { key: body.key },
        {
          $setOnInsert: {
            id: uuidv4(),
            ...body,
          },
        },
        { upsert: true, setDefaultsOnInsert: true }
      );

      const created = Boolean(
        (upRes as any).upsertedId || (upRes as any).upsertedCount
      );

      const doc = await Board.findOne({ key: body.key });
      if (!doc) {
        return void res.status(500).json({ error: 'Failed to create or read board' });
      }

      res.status(created ? 201 : 200).json(doc);
    } catch (e: any) {
      // На случай дубликата индекса — отдаём существующую
      if (e?.code === 11000 && e?.keyPattern?.key) {
        try {
          const k = String(req.body?.key || '').trim().toUpperCase();
          const existing = await Board.findOne({ key: k });
          if (existing) return void res.status(200).json(existing);
        } catch {}
      }
      console.error('Create board error:', e);
      res.status(400).json({ error: e?.message || 'Bad Request' });
    }
  }
);

/** PATCH /api/boards/:id — обновить доску (админ) */
router.patch(
  '/:id',
  requireAdmin,
  validate(updateBoardSchema),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const update = { ...(req.body || {}) };

      const board = await Board.findOne({ id });
      if (!board) {
        res.status(404).json({ error: 'Board not found' });
        return;
      }

      // Шаблон
      if (typeof update.template === 'string') {
        const incomingTemplate = String(update.template).trim();
        const effectiveType =
          typeof update.type === 'string' ? update.type : board.type;
        update.template =
          String(effectiveType) === 'expenses'
            ? 'kanban-basic'
            : ALLOWED_TEMPLATES.has(incomingTemplate)
            ? incomingTemplate
            : 'kanban-basic';
      }

      // Нормализация allowedRoles
      if (update.allowedRoles !== undefined) {
        update.allowedRoles = canonList(update.allowedRoles);
      }

      // Нормализация видимости по департаментам
      if (update.visibleDepartments !== undefined) {
        update.visibleDepartments = upperList(update.visibleDepartments);
      }

      // НИКАКИХ ручных updatedAt — timestamps сам обновит при save()
      Object.assign(board, update);
      await board.save();

      res.json(board);
    } catch (e) {
      console.error('Update board error:', e);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/** DELETE /api/boards/:id */
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

/** GET /api/boards/:boardId/columns */
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
router.post(
  '/:boardId/columns',
  requireAdmin,
  validate(createColumnSchema),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { boardId } = req.params;
      const { key, name, order } = req.body || {};

      // 1) есть ли борда?
      const board = await Board.findOne({ id: boardId });
      if (!board) {
        res.status(404).json({ error: 'Board not found' });
        return;
      }

      // 2) нормализация входа
      const colKey = String(key || '').trim().toUpperCase();
      const colName = String(name || '').trim();
      if (!colKey || !colName) {
        res.status(400).json({ error: 'key and name are required' });
        return;
      }

      // 3) идемпотентность: если колонка с таким key уже есть на борде — вернуть её
      const existing = await Column.findOne({ boardId, key: colKey });
      if (existing) {
        res.status(200).json(existing.toJSON());
        return;
      }

      // 4) рассчитать order, если не пришёл
      let finalOrder: number;
      if (typeof order === 'number' && Number.isFinite(order)) {
        finalOrder = order;
      } else {
        const last = await Column.find({ boardId })
          .sort({ order: -1 })
          .limit(1)
          .lean();
        finalOrder = last.length ? (Number(last[0].order) || 0) + 1 : 1;
      }

      // 5) создать колонку
      const column = new Column({
        id: uuidv4(),
        boardId,
        key: colKey,
        name: colName,
        order: finalOrder,
      });

      await column.save();
      res.status(201).json(column.toJSON());
    } catch (e) {
      console.error('Create column error:', e);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/** GET /api/boards/:boardKey/column-stats */
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

/** GET /api/boards/:boardKey/tasks — задачи борда */
router.get('/:boardKey/tasks', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const rawRoles = (user as any).effectiveRoles ?? user.roles ?? [];
    const userRoles = canonList(rawRoles); // ['admin', 'team_lead', ...]
    const userRoleSet = new Set(userRoles);
    const key = String(req.params.boardKey || '').toUpperCase();
    const { columns, assignees, q } = req.query;

    // доступ к борде (учитывает департаменты)
    const board = await checkBoardAccess(user, key);
    if (!board) {
      res.status(404).json({ error: 'Board not found or access denied' });
      return;
    }

    // === ⬇️ ВСТАВКА, О КОТОРОЙ ТЫ СПРАШИВАЛ ⬇️
    const boardRoles = canonList(
      (board as any).allowedRoles || (board as any).allowed_roles || []
    );
    let roleAllowedOnBoard = boardRoles.some(r => userRoleSet.has(r));

    // Хардкод-допуск: на BUY/DES/TECH техи видят всё, даже если не включены в allowedRoles
    if (!roleAllowedOnBoard && ['BUY', 'DES', 'TECH'].includes(key) && userRoleSet.has('tech')) {
      roleAllowedOnBoard = true;
    }
    // можно аналогично расширить для дизайнеров на DES и т.п., если понадобится
    // === ⬆️ КОНЕЦ ВСТАВКИ ⬆️

    // накапливаем условия через $and
    const and: any[] = [{ boardKey: key }];

    const isAdmin = userRoleSet.has('admin');
    const isTeamLead = userRoleSet.has('team_lead');
    const isBuyer = userRoleSet.has('buyer');
    const isTech = userRoleSet.has('tech');
    const isDesigner = userRoleSet.has('designer');

    if (!isAdmin) {
      if (key === 'EXP') {
        // Expenses: только свои задачи
        and.push({ $or: [{ creatorId: user.id }, { assigneeId: user.id }] });
      } else if (isTeamLead) {
        // тимлид видит всё (кроме EXP — см. выше)
      } else if (roleAllowedOnBoard) {
        // роль разрешена на борде — видит всё
      } else if (isBuyer) {
        and.push({ creatorId: user.id });
      } else if (isTech && key === 'TECH') {
        // видит всё на TECH (дублируется ролью, но оставим для обратной совместимости)
      } else if (isDesigner && key === 'DES') {
        // видит всё на DES
      } else {
        // по умолчанию — только свои
        and.push({ creatorId: user.id });
      }
    }

    if (columns) {
      and.push({ columnId: { $in: String(columns).split(',') } });
    }
    if (assignees) {
      and.push({ assigneeId: { $in: String(assignees).split(',') } });
    }
    if (q) {
      and.push({
        $or: [
          { title: { $regex: String(q), $options: 'i' } },
          { description: { $regex: String(q), $options: 'i' } },
        ],
      });
    }

    const query = and.length > 1 ? { $and: and } : and[0];
    const tasks = await Task.find(query).sort({ createdAt: -1 });
    res.json(tasks);
  } catch (e) {
    console.error('Get tasks error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** ВАЖНО: спец-маршрут до catch-all */
router.get('/:boardKey/assignable-users', async (req: AuthRequest, res: Response) => {
  try {
    const key = String(req.params.boardKey || '').toUpperCase();
    const board = await Board.findOne({ key }).lean();
    if (!board) return res.status(404).json({ error: 'Board not found' });

    const roleAliases = canonList(
      (board as any).allowedRoles || (board as any).allowed_roles || []
    );
    const or: any[] = [];
    if (roleAliases.length) or.push({ roles: { $in: roleAliases } });
    if (
      Array.isArray((board as any).allowedGroupIds) &&
      (board as any).allowedGroupIds.length
    ) {
      or.push({ groups: { $in: (board as any).allowedGroupIds } });
    }
    if (Array.isArray(board.members) && board.members.length)
      or.push({ id: { $in: board.members } });
    if (Array.isArray(board.owners) && board.owners.length)
      or.push({ id: { $in: board.owners } });

    const query: any = { status: 'active' };
    if (or.length) query.$or = or;

    const users = await User.find(query)
      .select('id email fullName roles groups status')
      .sort({ fullName: 1 })
      .lean();

    res.json(users.map((u) => ({ ...u, full_name: u.fullName })));
  } catch (e) {
    console.error('Assignable users error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** GET /api/boards/:boardKey — catch-all */
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