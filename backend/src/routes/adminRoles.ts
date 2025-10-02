import { Router } from 'express';
import { Role } from '../models/Role';
import { requireAdmin } from '../middleware/auth';
import { validate } from '../middleware/validation';
import Joi from 'joi';

const router = Router();

const createRoleSchema = Joi.object({
  key: Joi.string().min(2).max(32).uppercase().required(),
  name: Joi.string().min(2).max(100).required(),
  description: Joi.string().max(500).allow('', null).optional(),
  isActive: Joi.boolean().optional(),
});

const updateRoleSchema = Joi.object({
  key: Joi.string().min(2).max(32).uppercase().optional(),
  name: Joi.string().min(2).max(100).optional(),
  description: Joi.string().max(500).allow('', null).optional(),
  isActive: Joi.boolean().optional(),
});

router.get('/', requireAdmin, async (_req, res) => {
  const roles = await Role.find().sort({ key: 1 }).lean();
  res.json(roles);
});

router.post('/', requireAdmin, validate(createRoleSchema), async (req, res) => {
  const { key, name, description, isActive } = req.body;

  const exists = await Role.findOne({ key });
  if (exists) {
    return void res.status(400).json({ error: 'Role key already exists' });
  }

  const role = await Role.create({ key, name, description, isActive });
  res.status(201).json(role.toJSON());
});

router.patch('/:id', requireAdmin, validate(updateRoleSchema), async (req, res) => {
  const { id } = req.params;

  const role = await Role.findOne({ id });
  if (!role) {
    return void res.status(404).json({ error: 'Role not found' });
  }

  Object.assign(role, req.body);
  await role.save();
  res.json(role.toJSON());
});

router.delete('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;

  const role = await Role.findOne({ id });
  if (!role) {
    return void res.status(404).json({ error: 'Role not found' });
  }

  await Role.deleteOne({ id });
  res.json({ message: 'Role deleted' });
});

export default router;