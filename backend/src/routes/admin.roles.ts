import { Router, Response } from 'express';
import { AuthRequest } from '../types';
import { requireAdmin } from '../middleware/auth';
import { validate, createRoleSchema, updateRoleSchema } from '../middleware/validation';
import Role from '../models/Role';

const router = Router();

// GET /api/admin/roles
router.get('/', requireAdmin, async (_req: AuthRequest, res: Response): Promise<void> => {
  const roles = await Role.find({}).sort({ key: 1 }).lean();
  res.json(roles);
});

// POST /api/admin/roles
router.post('/', requireAdmin, validate(createRoleSchema), async (req: AuthRequest, res: Response): Promise<void> => {
  const { key, name, description, isActive } = req.body;
  const exists = await Role.findOne({ key }).lean();
  if (exists) {
    res.status(400).json({ error: 'Role key already exists' });
    return;
  }
  const role = await Role.create({ key, name, description, isActive });
  res.status(201).json(role.toJSON());
});

// PUT /api/admin/roles/:id
router.put('/:id', requireAdmin, validate(updateRoleSchema), async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const role = await Role.findOne({ id });
  if (!role) {
    res.status(404).json({ error: 'Role not found' });
    return;
  }
  Object.assign(role, req.body);
  await role.save();
  res.json(role.toJSON());
});

// DELETE /api/admin/roles/:id
router.delete('/:id', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const role = await Role.findOne({ id });
  if (!role) {
    res.status(404).json({ error: 'Role not found' });
    return;
  }
  await Role.deleteOne({ id });
  res.json({ ok: true });
});

export default router;