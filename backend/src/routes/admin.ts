import { Router, Request, Response } from 'express';
import { Department } from '../models/Department';
import { Group } from '../models/Group';
import { validate, createDepartmentSchema, updateDepartmentSchema, createGroupSchema, updateGroupSchema } from '../middleware/validation';

const router = Router();

function requireAdmin(req: any, res: Response, next: Function) {
  const roles: string[] = req.user?.roles || [];
  if (!roles.includes('admin')) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

/** -------- Departments -------- */
router.get('/departments', requireAdmin, async (_req: Request, res: Response) => {
  const items = await Department.find().sort({ name: 1 }).lean();
  res.json(items);
});

router.post('/departments', requireAdmin, validate(createDepartmentSchema), async (req: Request, res: Response) => {
  const dept = await Department.create(req.body);
  res.status(201).json(dept.toJSON());
});

router.patch('/departments/:id', requireAdmin, validate(updateDepartmentSchema), async (req: Request, res: Response) => {
  const updated = await Department.findOneAndUpdate({ id: req.params.id }, { $set: req.body }, { new: true });
  if (!updated) return res.status(404).json({ error: 'Department not found' });
  res.json(updated.toJSON());
});

router.delete('/departments/:id', requireAdmin, async (req: Request, res: Response) => {
  const deleted = await Department.findOneAndDelete({ id: req.params.id });
  if (!deleted) return res.status(404).json({ error: 'Department not found' });
  res.json({ ok: true });
});

/** -------- Groups -------- */
router.get('/groups', requireAdmin, async (_req: Request, res: Response) => {
  const items = await Group.find().sort({ name: 1 }).lean();
  res.json(items);
});

router.post('/groups', requireAdmin, validate(createGroupSchema), async (req: Request, res: Response) => {
  const grp = await Group.create(req.body);
  res.status(201).json(grp.toJSON());
});

router.patch('/groups/:id', requireAdmin, validate(updateGroupSchema), async (req: Request, res: Response) => {
  const updated = await Group.findOneAndUpdate({ id: req.params.id }, { $set: req.body }, { new: true });
  if (!updated) return res.status(404).json({ error: 'Group not found' });
  res.json(updated.toJSON());
});

router.delete('/groups/:id', requireAdmin, async (req: Request, res: Response) => {
  const deleted = await Group.findOneAndDelete({ id: req.params.id });
  if (!deleted) return res.status(404).json({ error: 'Group not found' });
  res.json({ ok: true });
});

export default router;