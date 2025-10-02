import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { Role, Priority, BoardType, Template, UserStatus } from '../types';

/* ========= helpers for coercion ========= */
const idFrom = (v: any): string | undefined => {
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object') {
    return (
      v.id ??
      v._id ??
      v.userId ??
      v.value ??
      v.key ??
      v.uuid ??
      v.identifier ??
      undefined
    );
  }
  return undefined;
};

const asIdArray = (arr: any[]): string[] =>
  (Array.isArray(arr) ? arr : [])
    .map(idFrom)
    .filter(Boolean)
    .map(String);

/**
 * validate(schema)
 * — единая фабрика валидации, которая не только проверяет,
 *   но и возвращает в req.body НОРМАЛИЗОВАННЫЕ значения (trim/lowercase/rename).
 */
export const validate = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { value, error } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });

    if (error) {
      res.status(400).json({
        error: 'Validation error',
        details: error.details.map(d => d.message),
      });
      return;
    }

    req.body = value; // кладём нормализованное тело обратно
    next();
  };
};

/* ======================
 *  AUTH
 * ====================== */

export const loginSchema = Joi.object({
  email: Joi.string().email({ tlds: { allow: false } }).trim().lowercase().required(),
  password: Joi.string().min(6).required(),
});

export const registerSchema = Joi.object({
  email: Joi.string().email({ tlds: { allow: false } }).trim().lowercase().required(),
  password: Joi.string().min(6),
  fullName: Joi.string().min(2).max(100).required(),
  roles: Joi.array().items(Joi.string().min(2).max(32)).min(1).required(),
  status: Joi.string().valid(...Object.values(UserStatus)).optional(),
});

/* ======================
 *  BOARDS
 * ====================== */

const membersLike = Joi.array()
  .items(Joi.alternatives().try(Joi.string(), Joi.object().unknown(true)))
  .custom((arr) => asIdArray(arr), 'coerce array of ids');

const rolesLike = Joi.array()
  .items(Joi.alternatives().try(Joi.string(), Joi.object().unknown(true)))
  .custom((arr) => (arr as any[]).map(v => (typeof v === 'string' ? v : String(idFrom(v) ?? ''))).filter(Boolean), 'coerce roles[]');

export const createBoardSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  key: Joi.string().min(2).max(10).uppercase().required(),

  // Чтоб не ловить 400 из-за несовпадения словарей — делаем optional string.
  // (Если хочешь строгий список — вернём .valid(...) позже, когда UI стабилизируем)
  type: Joi.string().optional(),
  template: Joi.string().optional(),

  allowedRoles: rolesLike.optional(),
  allowedGroupIds: membersLike.optional(),
  members: membersLike.optional(),
  owners: membersLike.optional(),

  // UI иногда присылает — допускаем; лишнее всё равно срежется stripUnknown
  description: Joi.string().allow('').optional(),
  settings: Joi.object().unknown(true).optional(),
})
// мост совместимости со snake_case
.rename('allowed_roles', 'allowedRoles', { ignoreUndefined: true, override: true })
.rename('allowed_group_ids', 'allowedGroupIds', { ignoreUndefined: true, override: true })
.rename('members_ids', 'members', { ignoreUndefined: true, override: true })
.rename('owners_ids', 'owners', { ignoreUndefined: true, override: true });

export const updateBoardSchema = Joi.object({
  name: Joi.string().min(2).max(100).optional(),
  type: Joi.string().optional(),
  template: Joi.string().optional(),
  isArchived: Joi.boolean().optional(),
  settings: Joi.object({
    assigneeEnabled: Joi.boolean().optional(),
    dueDatesEnabled: Joi.boolean().optional(),
    priorityEnabled: Joi.boolean().optional(),
    tagsEnabled: Joi.boolean().optional(),
    commentsEnabled: Joi.boolean().optional(),
    timeTrackingEnabled: Joi.boolean().optional(),
  }).optional(),
  allowedRoles: rolesLike.optional(),
  allowedGroupIds: membersLike.optional(),
  members: membersLike.optional(),
  owners: membersLike.optional(),
  description: Joi.string().allow('').optional(),
})
.rename('allowed_roles', 'allowedRoles', { ignoreUndefined: true, override: true })
.rename('allowed_group_ids', 'allowedGroupIds', { ignoreUndefined: true, override: true })
.rename('members_ids', 'members', { ignoreUndefined: true, override: true })
.rename('owners_ids', 'owners', { ignoreUndefined: true, override: true });

/* ======================
 *  COLUMNS
 * ====================== */

export const createColumnSchema = Joi.object({
  key: Joi.string().min(2).max(50).uppercase().required(),
  name: Joi.string().min(2).max(100).required(),
  order: Joi.number().integer().min(1).required(),
});

/* ======================
 *  TASKS
 * ====================== */

export const createTaskSchema = Joi.object({
  boardKey: Joi.string().min(2).max(10).uppercase().required(),
  columnId: Joi.string().required(),
  title: Joi.string().min(2).max(200).required(),
  description: Joi.string().max(2000).optional().allow(''),
  priority: Joi.string().valid(...Object.values(Priority)).optional(),
  tags: Joi.array().items(Joi.string().max(50)).optional(),
  dueDate: Joi.date().optional().allow(''),
  assigneeId: Joi.string().optional().allow('', null),
  amount: Joi.number().min(0).optional(),
  category: Joi.string().valid(
    // Sweep Stakes
    'sweep_accounts','sweep_proxy_domains','sweep_services','sweep_fakes','sweep_other',
    // IGaming
    'igaming_fb_accounts','igaming_uac_accounts','igaming_creatives','igaming_google_play',
    'igaming_services','igaming_proxy_domains','igaming_other',
    // HR Department
    'hr_vacancies','hr_candidates','hr_services','hr_polygraph','hr_books','hr_team_building','hr_other',
    // Office
    'office_household','office_food_water','office_services','office_hookah',
    'office_furniture','office_repair_security','office_charity','office_other'
  ).optional(),
  receiptUrl: Joi.string().uri().optional(),
})
.rename('board_key',   'boardKey',   { ignoreUndefined: true, override: true })
.rename('column_id',   'columnId',   { ignoreUndefined: true, override: true })
.rename('assignee_id', 'assigneeId', { ignoreUndefined: true, override: true })
.rename('due_date',    'dueDate',    { ignoreUndefined: true, override: true })
.rename('receipt_url', 'receiptUrl', { ignoreUndefined: true, override: true });

export const updateTaskSchema = Joi.object({
  columnId: Joi.string().optional(),
  title: Joi.string().min(2).max(200).optional(),
  description: Joi.string().max(2000).optional().allow(''),
  priority: Joi.string().valid(...Object.values(Priority)).optional(),
  tags: Joi.array().items(Joi.string().max(50)).optional(),
  dueDate: Joi.date().optional().allow(''),
  assigneeId: Joi.string().optional().allow('', null),
  amount: Joi.number().min(0).optional(),
  category: Joi.string().valid(
    'sweep_accounts','sweep_proxy_domains','sweep_services','sweep_fakes','sweep_other',
    'igaming_fb_accounts','igaming_uac_accounts','igaming_creatives','igaming_google_play',
    'igaming_services','igaming_proxy_domains','igaming_other',
    'hr_vacancies','hr_candidates','hr_services','hr_polygraph','hr_books','hr_team_building','hr_other',
    'office_household','office_food_water','office_services','office_hookah',
    'office_furniture','office_repair_security','office_charity','office_other'
  ).optional(),
  receiptUrl: Joi.string().uri().optional(),
})
.rename('column_id',   'columnId',   { ignoreUndefined: true, override: true })
.rename('assignee_id', 'assigneeId', { ignoreUndefined: true, override: true })
.rename('due_date',    'dueDate',    { ignoreUndefined: true, override: true })
.rename('receipt_url', 'receiptUrl', { ignoreUndefined: true, override: true });

/* ======================
 *  ADMIN (Departments / Groups)
 * ====================== */

export const createDepartmentSchema = Joi.object({
  key: Joi.string().min(2).max(20).uppercase().required(),
  name: Joi.string().min(2).max(100).required(),
  description: Joi.string().max(500).allow('', null).optional(),
  isActive: Joi.boolean().optional(),
});

export const updateDepartmentSchema = Joi.object({
  key: Joi.string().min(2).max(20).uppercase().optional(),
  name: Joi.string().min(2).max(100).optional(),
  description: Joi.string().max(500).allow('', null).optional(),
  isActive: Joi.boolean().optional(),
});

export const createGroupSchema = Joi.object({
  key: Joi.string().min(2).max(20).uppercase().required(),
  name: Joi.string().min(2).max(100).required(),
  description: Joi.string().max(500).allow('', null).optional(),
  isActive: Joi.boolean().optional(),
  memberUserIds: membersLike.optional(),
});

export const updateGroupSchema = Joi.object({
  key: Joi.string().min(2).max(20).uppercase().optional(),
  name: Joi.string().min(2).max(100).optional(),
  description: Joi.string().max(500).allow('', null).optional(),
  isActive: Joi.boolean().optional(),
  memberUserIds: membersLike.optional(),
});

export const createRoleSchema = Joi.object({
  key: Joi.string().min(2).max(30).uppercase().required(),
  name: Joi.string().min(2).max(100).required(),
  color: Joi.string().pattern(/^#?[0-9a-fA-F]{3,8}$/).optional(),
  isActive: Joi.boolean().optional(),
});

export const updateRoleSchema = Joi.object({
  key: Joi.string().min(2).max(30).uppercase().optional(),
  name: Joi.string().min(2).max(100).optional(),
  color: Joi.string().pattern(/^#?[0-9a-fA-F]{3,8}$/).optional(),
  isActive: Joi.boolean().optional(),
});