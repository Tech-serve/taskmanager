import Joi from 'joi';
import { EXPENSE_CATEGORY_VALUES } from '../constants/expenseCategories';

// MAIN.SUB → snake_case ("sweep.accounts" -> "sweep_accounts"), иначе пропускаем
const toSnakeCategoryOrUndef = (v: unknown): unknown => {
  if (!v || typeof v !== 'string') return v;
  const raw = v.trim();
  if (!raw) return undefined;
  if (!raw.includes('.')) return raw; // может уже быть snake; проверим валидатором ниже
  const [mainRaw, subRaw] = raw.split('.').map(s => s.trim().toLowerCase());
  const main = mainRaw.replace(/\s+|\//g, '_');
  const sub = subRaw.replace(/\s+|\//g, '_');
  return `${main}_${sub}`;
};

export const createExpenseSchema = Joi.object({
  boardKey: Joi.string().min(2).max(10).uppercase().required(),
  columnId: Joi.string().required(),
  title: Joi.string().min(2).max(200).required(),
  description: Joi.string().max(2000).optional().allow(''),
  priority: Joi.string().valid('low','medium','high').optional(),
  tags: Joi.array().items(Joi.string().max(50)).optional(),
  dueDate: Joi.date().optional().allow(''),
  assigneeId: Joi.string().optional().allow('', null),

  amount: Joi.number().precision(2).min(0.01).required(),
  currency: Joi.string().valid('USD').optional(), // по умолчанию проставим на бэке

  category: Joi.string()
    .custom(toSnakeCategoryOrUndef, 'normalize MAIN.SUB → snake')
    .valid(...EXPENSE_CATEGORY_VALUES)
    .optional(),

  walletNumber: Joi.string().max(200).optional().allow('', null),
  txHashUrl: Joi.string().uri().optional().allow('', null),
  receiptUrl: Joi.string().uri().optional().allow(''),
})
.rename('board_key',   'boardKey',   { ignoreUndefined: true, override: true })
.rename('column_id',   'columnId',   { ignoreUndefined: true, override: true })
.rename('assignee_id', 'assigneeId', { ignoreUndefined: true, override: true })
.rename('due_date',    'dueDate',    { ignoreUndefined: true, override: true })
.rename('wallet_number','walletNumber',{ ignoreUndefined: true, override: true })
.rename('tx_hash_url', 'txHashUrl',  { ignoreUndefined: true, override: true })
.rename('receipt_url', 'receiptUrl', { ignoreUndefined: true, override: true });

export const updateExpenseSchema = Joi.object({
  columnId: Joi.string().optional(),
  title: Joi.string().min(2).max(200).optional(),
  description: Joi.string().max(2000).optional().allow(''),
  priority: Joi.string().valid('low','medium','high').optional(),
  tags: Joi.array().items(Joi.string().max(50)).optional(),
  dueDate: Joi.date().optional().allow(''),
  assigneeId: Joi.string().optional().allow('', null),

  amount: Joi.number().precision(2).min(0.01).optional(),
  currency: Joi.string().valid('USD').optional(),

  category: Joi.string()
    .custom(toSnakeCategoryOrUndef, 'normalize MAIN.SUB → snake')
    .valid(...EXPENSE_CATEGORY_VALUES)
    .optional(),

  walletNumber: Joi.string().max(200).optional().allow('', null),
  txHashUrl: Joi.string().uri().optional().allow('', null),
  receiptUrl: Joi.string().uri().optional().allow(''),
})
.rename('column_id',   'columnId',   { ignoreUndefined: true, override: true })
.rename('assignee_id', 'assigneeId', { ignoreUndefined: true, override: true })
.rename('due_date',    'dueDate',    { ignoreUndefined: true, override: true })
.rename('wallet_number','walletNumber',{ ignoreUndefined: true, override: true })
.rename('tx_hash_url', 'txHashUrl',  { ignoreUndefined: true, override: true })
.rename('receipt_url', 'receiptUrl', { ignoreUndefined: true, override: true });