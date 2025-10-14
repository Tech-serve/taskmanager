import { Router } from 'express';
import Joi from 'joi';
import { requireAdmin, requireAdminOrLead } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { RoleModel } from '../models/Role';

const router = Router();

/** ===== Schemas ===== */
const createRoleSchema = Joi.object({
  key: Joi.string().min(2).max(32).uppercase().required(),
  name: Joi.string().min(2).max(100).required(),
  description: Joi.string().max(500).allow('', null).optional(),
  isActive: Joi.boolean().optional(),
  // builtIn намеренно НЕ даём на вход — базовые через API не создаются
});

const updateRoleSchema = Joi.object({
  key: Joi.string().min(2).max(32).uppercase().optional(),
  name: Joi.string().min(2).max(100).optional(),
  description: Joi.string().max(500).allow('', null).optional(),
  isActive: Joi.boolean().optional(),
  // builtIn редактировать нельзя — игнорируем
});

/**
 * GET /api/admin/roles
 * Доступ: админ ИЛИ тимлид (для просмотра справочника ролей).
 */
router.get('/', requireAdminOrLead, async (_req, res) => {
  try {
    const roles = await RoleModel.find().sort({ key: 1 }).lean();
    res.json(roles);
  } catch (e) {
    console.error('GET /api/admin/roles error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/admin/roles
 * Создать ДОПОЛНИТЕЛЬНУЮ роль — только админ. builtIn всегда false.
 */
router.post('/', requireAdmin, validate(createRoleSchema), async (req, res) => {
  try {
    const { key, name, description, isActive } = req.body;

    const normKey = String(key).trim().toUpperCase();
    const exists = await RoleModel.findOne({ key: normKey });
    if (exists) {
      res.status(400).json({ error: 'Role key already exists' });
      return;
    }

    const role = await RoleModel.create({
      key: normKey,
      name: String(name).trim(),
      description: description ?? null,
      isActive: typeof isActive === 'boolean' ? isActive : true,
      builtIn: false, // базовые через API не делаем
    });

    res.status(201).json(role.toJSON());
  } catch (e) {
    console.error('POST /api/admin/roles error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /api/admin/roles/:id
 * Редактировать можно ТОЛЬКО не-builtIn роли.
 */
router.patch('/:id', requireAdmin, validate(updateRoleSchema), async (req, res) => {
  try {
    const { id } = req.params;

    const role = await RoleModel.findOne({ id });
    if (!role) {
      res.status(404).json({ error: 'Role not found' });
      return;
    }

    if (role.builtIn) {
      res.status(400).json({ error: 'Built-in roles cannot be edited' });
      return;
    }

    const payload: any = { ...req.body };
    if (payload.key) payload.key = String(payload.key).trim().toUpperCase();
    if (payload.name) payload.name = String(payload.name).trim();
    if (payload.description === '') payload.description = null;

    if (payload.key && payload.key !== role.key) {
      const dup = await RoleModel.findOne({ key: payload.key });
      if (dup) {
        res.status(400).json({ error: 'Role key already exists' });
        return;
      }
    }

    // builtIn менять нельзя, даже если пришло
    delete payload.builtIn;

    Object.assign(role, payload);
    await role.save();

    res.json(role.toJSON());
  } catch (e) {
    console.error('PATCH /api/admin/roles/:id error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/admin/roles/:id
 * Удалять можно ТОЛЬКО не-builtIn роли.
 */
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const role = await RoleModel.findOne({ id });
    if (!role) {
      res.status(404).json({ error: 'Role not found' });
      return;
    }
    if (role.builtIn) {
      res.status(400).json({ error: 'Built-in roles cannot be deleted' });
      return;
    }

    await RoleModel.deleteOne({ id });
    res.json({ message: 'Role deleted' });
  } catch (e) {
    console.error('DELETE /api/admin/roles/:id error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;