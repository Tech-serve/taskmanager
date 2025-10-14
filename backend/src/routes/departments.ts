// backend/src/routes/departments.ts
import { Router } from 'express';
import Joi from 'joi';
import { requireAdmin, requireAdminOrLead } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { Department as DepartmentModel } from '../models/Department';

const router = Router();

/** ===== Schemas (узкие — на уровне роутов) ===== */
const createSchema = Joi.object({
  key: Joi.string().min(2).max(20).uppercase().required(),
  name: Joi.string().min(2).max(100).required(),
  description: Joi.string().max(500).allow('', null).optional(),
  isActive: Joi.boolean().optional(),
});

const updateSchema = Joi.object({
  key: Joi.string().min(2).max(20).uppercase().optional(),
  name: Joi.string().min(2).max(100).optional(),
  description: Joi.string().max(500).allow('', null).optional(),
  isActive: Joi.boolean().optional(),
});

/**
 * GET /api/admin/departments
 * Просмотр справочника: админ ИЛИ тимлид
 */
router.get('/', requireAdminOrLead, async (_req, res) => {
  try {
    const items = await DepartmentModel.find({}).sort({ key: 1 }).lean();
    res.json(items.map(({ _id, __v, ...rest }) => rest));
  } catch (e) {
    console.error('GET /api/admin/departments error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/admin/departments
 * Создать департамент — только админ
 */
router.post('/', requireAdmin, validate(createSchema), async (req, res) => {
  try {
    const { key, name, description, isActive } = req.body;

    const normKey = String(key).trim().toUpperCase();
    const exists = await DepartmentModel.findOne({ key: normKey });
    if (exists) {
      return void res.status(400).json({ error: 'Department key already exists' });
    }

    const dep = await DepartmentModel.create({
      key: normKey,
      name: String(name).trim(),
      description: description ?? '',
      isActive: typeof isActive === 'boolean' ? isActive : true,
    });

    const out = dep.toObject();
    delete (out as any)._id;
    delete (out as any).__v;

    res.status(201).json(out);
  } catch (e: any) {
    if (e?.code === 11000 && e?.keyPattern?.key) {
      return void res.status(400).json({ error: 'Department key already exists' });
    }
    console.error('POST /api/admin/departments error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /api/admin/departments/:id
 * Редактировать департамент — только админ
 */
router.patch('/:id', requireAdmin, validate(updateSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const dep = await DepartmentModel.findOne({ id });
    if (!dep) return void res.status(404).json({ error: 'Department not found' });

    const payload: any = { ...req.body };
    if (payload.key) payload.key = String(payload.key).trim().toUpperCase();
    if (payload.name) payload.name = String(payload.name).trim();

    if (payload.key && payload.key !== dep.key) {
      const dup = await DepartmentModel.findOne({ key: payload.key });
      if (dup) return void res.status(400).json({ error: 'Department key already exists' });
    }

    Object.assign(dep, payload);
    await dep.save();

    const out = dep.toObject();
    delete (out as any)._id;
    delete (out as any).__v;

    res.json(out);
  } catch (e) {
    console.error('PATCH /api/admin/departments/:id error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/admin/departments/:id
 * Удалить департамент — только админ
 * (Если хочешь: здесь можно добавить проверку на использование департамента в пользователях/бордах)
 */
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const dep = await DepartmentModel.findOne({ id });
    if (!dep) return void res.status(404).json({ error: 'Department not found' });

    await DepartmentModel.deleteOne({ id });
    res.json({ message: 'Department deleted' });
  } catch (e) {
    console.error('DELETE /api/admin/departments/:id error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;