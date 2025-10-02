import { Router } from 'express';
import Joi from 'joi';
import { requireAdmin } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { RoleModel } from '../models/Role';

const router = Router();

// Схемы валидации (оставил твои правила)
const createRoleSchema = Joi.object({
  key: Joi.string().min(2).max(32).uppercase().required(),
  name: Joi.string().min(2).max(100).required(),
  description: Joi.string().max(500).allow('', null).optional(),
  isActive: Joi.boolean().optional(),
  // builtIn не даём из UI, но если придёт — игнор/или можно разрешить:
  builtIn: Joi.boolean().optional(),
});

const updateRoleSchema = Joi.object({
  key: Joi.string().min(2).max(32).uppercase().optional(),
  name: Joi.string().min(2).max(100).optional(),
  description: Joi.string().max(500).allow('', null).optional(),
  isActive: Joi.boolean().optional(),
  builtIn: Joi.boolean().optional(),
});

/**
 * GET /api/admin/roles
 * Возвращает список ролей для селектов
 */
router.get('/', requireAdmin, async (_req, res) => {
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
 * Создать роль
 */
router.post('/', requireAdmin, validate(createRoleSchema), async (req, res) => {
  try {
    const { key, name, description, isActive, builtIn } = req.body;

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
      builtIn: !!builtIn, // по умолчанию false; системные можно загрузить сидом
    });

    res.status(201).json(role.toJSON());
  } catch (e) {
    console.error('POST /api/admin/roles error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /api/admin/roles/:id
 * Обновить роль по id
 */
router.patch('/:id', requireAdmin, validate(updateRoleSchema), async (req, res) => {
  try {
    const { id } = req.params;

    const role = await RoleModel.findOne({ id });
    if (!role) {
      return void res.status(404).json({ error: 'Role not found' });
    }

    const payload: any = { ...req.body };
    if (payload.key) payload.key = String(payload.key).trim().toUpperCase();
    if (payload.name) payload.name = String(payload.name).trim();
    if (payload.description === '') payload.description = null;

    // защита от коллизии по key при изменении
    if (payload.key && payload.key !== role.key) {
      const dup = await RoleModel.findOne({ key: payload.key });
      if (dup) {
        return void res.status(400).json({ error: 'Role key already exists' });
      }
    }

    // Если роль системная — запретим менять builtIn (не обязательно, но безопаснее)
    if (role.builtIn && typeof payload.builtIn === 'boolean' && payload.builtIn === false) {
      // разрешим менять на false? лучше не трогать. Уберём из payload
      delete payload.builtIn;
    }

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
 * Удалить роль по id
 */
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
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
  } catch (e) {
    console.error('DELETE /api/admin/roles/:id error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;