import { Router } from 'express';
import Joi from 'joi';
import { requireAdmin } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { RoleModel } from '../models/Role';

const router = Router();

const createRoleSchema = Joi.object({
  key: Joi.string().min(2).max(32).uppercase().required(),
  name: Joi.string().min(2).max(100).required(),
  description: Joi.string().max(500).allow('', null).optional(),
  isActive: Joi.boolean().optional(),
  builtIn: Joi.boolean().optional(), // обычно не даем из UI, но пускай будет
});

const updateRoleSchema = Joi.object({
  key: Joi.string().min(2).max(32).uppercase().optional(),
  name: Joi.string().min(2).max(100).optional(),
  description: Joi.string().max(500).allow('', null).optional(),
  isActive: Joi.boolean().optional(),
  builtIn: Joi.boolean().optional(),
});

// GET /api/roles — список всех ролей (для селектов)
router.get('/', requireAdmin, async (_req, res) => {
  const roles = await RoleModel.find().sort({ key: 1 }).lean();
  res.json(roles);
});

// POST /api/roles — создать новую роль
router.post('/', requireAdmin, validate(createRoleSchema), async (req, res) => {
  const { key, name, description, isActive, builtIn } = req.body;

  // нормализация на всякий
  const normKey = String(key).trim().toUpperCase();
  const exists = await RoleModel.findOne({ key: normKey });
  if (exists) {
    return void res.status(400).json({ error: 'Role key already exists' });
  }

  const role = await RoleModel.create({
    key: normKey,
    name: String(name).trim(),
    description: description ?? null,
    isActive: typeof isActive === 'boolean' ? isActive : true,
    builtIn: !!builtIn,
  });

  res.status(201).json(role.toJSON());
});

// PATCH /api/roles/:id — обновить
router.patch('/:id', requireAdmin, validate(updateRoleSchema), async (req, res) => {
  const { id } = req.params;

  const role = await RoleModel.findOne({ id });
  if (!role) {
    return void res.status(404).json({ error: 'Role not found' });
  }

  // аккуратная нормализация полей
  const payload: any = { ...req.body };
  if (payload.key) payload.key = String(payload.key).trim().toUpperCase();
  if (payload.name) payload.name = String(payload.name).trim();
  if (payload.description === '') payload.description = null;

  // если ключ меняем — проверим уникальность
  if (payload.key && payload.key !== role.key) {
    const dup = await RoleModel.findOne({ key: payload.key });
    if (dup) {
      return void res.status(400).json({ error: 'Role key already exists' });
    }
  }

  Object.assign(role, payload);
  await role.save();
  res.json(role.toJSON());
});

// DELETE /api/roles/:id — удалить
router.delete('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;

  const role = await RoleModel.findOne({ id });
  if (!role) {
    return void res.status(404).json({ error: 'Role not found' });
  }

  if (role.builtIn) {
    return void res.status(400).json({ error: 'Built-in roles cannot be deleted' });
  }

  await RoleModel.deleteOne({ id });
  res.json({ message: 'Role deleted' });
});

export default router;