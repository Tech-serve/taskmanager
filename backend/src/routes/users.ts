import { Router, Response } from 'express';
import { User } from '../models/User';
import { AuthRequest, UserStatus } from '../types';
import { requireAdmin } from '../middleware/auth';
import { AuthUtils } from '../utils/auth';
import { RoleBinding } from '../models/RoleBinding';
import { Department as DepartmentModel } from '../models/Department';

const router = Router();

/** ===== Helpers: нормализация ролей/департаментов, union и биндинги ===== */
const norm = (s: unknown) => String(s ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
const toUpper = (s: unknown) => String(s ?? '').trim().toUpperCase();

const ROLE_ALIASES: Record<string, string> = {
  admin: 'admin',
  buyer: 'buyer',
  designer: 'designer',
  tech: 'tech',
  team_lead: 'team_lead',
  'team-lead': 'team_lead',
  teamlead: 'team_lead',
  head: 'team_lead',
  head_lead: 'team_lead',
  headelite: 'team_lead',
  'head-elite': 'team_lead',
  tl: 'team_lead',
};

const canonizeRoles = (arr: unknown[]) =>
  Array.from(new Set((Array.isArray(arr) ? arr : [])
    .map(x => ROLE_ALIASES[norm(x)] ?? norm(x))
    .filter(Boolean)));

const canonizeDepartments = (arr: unknown[]) =>
  Array.from(new Set((Array.isArray(arr) ? arr : [])
    .map(x => toUpper(x))
    .filter(Boolean)));

function unionRoles(real: string[] | undefined, added: string[] | undefined) {
  return Array.from(new Set([...(canonizeRoles(real || [])), ...(canonizeRoles(added || []))]));
}

async function getBindingsMap(userIds: string[]) {
  const rows = await RoleBinding.find({ userId: { $in: userIds }, isActive: true })
    .select({ userId: 1, role: 1 }).lean();
  const map = new Map<string, string[]>();
  for (const r of rows) {
    const uid = (r as any).userId as string;
    const role = (r as any).role as string;
    const arr = map.get(uid) || [];
    arr.push(role);
    map.set(uid, arr);
  }
  return map;
}

async function getEffective(userId: string, real: string[] | undefined) {
  const rows = await RoleBinding.find({ userId, isActive: true }).select({ role: 1 }).lean();
  const added = rows.map(r => (r as any).role);
  return unionRoles(real, added);
}

/** Проверяем, что все департаменты существуют и активны */
async function ensureDepartmentsExist(keys: string[]): Promise<void> {
  if (!keys.length) throw new Error('At least one department is required');
  const uniq = Array.from(new Set(keys.map(toUpper)));
  const found = await DepartmentModel.find({ key: { $in: uniq }, isActive: true })
    .select({ key: 1 }).lean();
  const foundSet = new Set(found.map(d => (d as any).key));
  const missing = uniq.filter(k => !foundSet.has(k));
  if (missing.length) {
    throw new Error(`Unknown departments: ${missing.join(', ')}`);
  }
}

/** ===================================================================== */

// GET /api/users
router.get('/', requireAdmin, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const users = await User.find({})
      .select('-passwordHash')
      .sort({ createdAt: -1 })
      .lean();

    const ids = users.map(u => u.id);
    const bmap = await getBindingsMap(ids);

    const transformed = users.map(u => {
      const effective = unionRoles(u.roles as any, bmap.get(u.id));
      return {
        id: u.id,
        email: u.email,
        full_name: u.fullName,
        roles: u.roles,
        effective_roles: effective,
        /** отдаём массив департаментов */
        departments: (u as any).departments || [],
        groups: u.groups,
        status: u.status,
        created_at: u.createdAt,
        updated_at: u.updatedAt,
        last_login: u.lastLogin
      };
    });

    res.json(transformed);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/users/:id
router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const currentUser = req.user!;
    const currentEffective = await getEffective(currentUser.id, currentUser.roles as any);

    const isAdmin = currentEffective.includes('admin');
    if (currentUser.id !== id && !isAdmin) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const user = await User.findOne({ id }).select('-passwordHash').lean();
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    const effective = await getEffective(user.id, user.roles as any);

    res.json({
      id: user.id,
      email: user.email,
      full_name: user.fullName,
      roles: user.roles,
      effective_roles: effective,
      departments: (user as any).departments || [],
      groups: user.groups,
      status: user.status,
      created_at: user.createdAt,
      updated_at: user.updatedAt,
      last_login: user.lastLogin
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/users
router.post('/', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { email, fullName, roles, sendInvitation, password, departments } = req.body;

    if (!email || !fullName || !roles || !Array.isArray(roles)) {
      res.status(400).json({ error: 'Email, fullName, and roles are required' });
      return;
    }

    const depKeys = canonizeDepartments(departments || []);
    if (!depKeys.length) {
      res.status(400).json({ error: 'At least one department is required' });
      return;
    }
    await ensureDepartmentsExist(depKeys);

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) { res.status(400).json({ error: 'User with this email already exists' }); return; }

    const userData: any = {
      email: email.toLowerCase(),
      fullName,
      roles: canonizeRoles(roles),
      departments: depKeys,
      status: sendInvitation ? UserStatus.PENDING : UserStatus.ACTIVE
    };

    if (password && !sendInvitation) {
      userData.passwordHash = await AuthUtils.hashPassword(password);
    } else if (sendInvitation) {
      userData.invitationToken = AuthUtils.generateInvitationToken();
      userData.invitationExpires = AuthUtils.generateInvitationExpiry();
    }

    const user = new User(userData);
    await user.save();

    const effective = await getEffective(user.id, user.roles as any);

    let invitationUrl = null;
    if (sendInvitation && user.invitationToken) {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      invitationUrl = `${frontendUrl}/invitation/${user.invitationToken}`;
    }

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        full_name: user.fullName,
        roles: user.roles,
        effective_roles: effective,
        departments: user.departments,
        status: user.status,
        created_at: user.createdAt,
        updated_at: user.updatedAt
      },
      invitationUrl,
      message: sendInvitation ? 'User created and invitation sent' : 'User created successfully'
    });
  } catch (error: any) {
    console.error('Create user error:', error);
    res.status(500).json({ error: error?.message || 'Internal server error' });
  }
});

// PUT /api/users/:id
router.put('/:id', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { fullName, roles, status, email, password, departments } = req.body;

    const user = await User.findOne({ id });
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    if (fullName !== undefined) user.fullName = fullName;
    if (roles !== undefined) user.roles = canonizeRoles(roles);
    if (status !== undefined) user.status = status;
    if (email !== undefined) user.email = email.toLowerCase();

    if (departments !== undefined) {
      const depKeys = canonizeDepartments(departments);
      if (!depKeys.length) {
        res.status(400).json({ error: 'At least one department is required' });
        return;
      }
      await ensureDepartmentsExist(depKeys);
      user.departments = depKeys;
    }

    if (password !== undefined && password !== '') {
      user.passwordHash = await AuthUtils.hashPassword(password);
      console.log(`Password updated for user ${user.email}`);
    }

    await user.save();

    const effective = await getEffective(user.id, user.roles as any);

    res.json({
      id: user.id,
      email: user.email,
      full_name: user.fullName,
      roles: user.roles,
      effective_roles: effective,
      departments: user.departments,
      status: user.status,
      created_at: user.createdAt,
      updated_at: user.updatedAt
    });
  } catch (error: any) {
    console.error('Update user error:', error);
    res.status(500).json({ error: error?.message || 'Internal server error' });
  }
});

// DELETE /api/users/:id
router.delete('/:id', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const currentUser = req.user!;

    if (currentUser.id === id) {
      res.status(400).json({ error: 'Cannot delete your own account' });
      return;
    }

    const user = await User.findOne({ id });
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    await User.deleteOne({ id });

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/users/:id/resend-invitation
router.post('/:id/resend-invitation', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const user = await User.findOne({ id });
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    if (user.status === UserStatus.ACTIVE) {
      res.status(400).json({ error: 'User is already active' });
      return;
    }

    user.invitationToken = AuthUtils.generateInvitationToken();
    user.invitationExpires = AuthUtils.generateInvitationExpiry();
    user.status = UserStatus.PENDING;
    await user.save();

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const invitationUrl = `${frontendUrl}/invitation/${user.invitationToken}`;

    res.json({ message: 'Invitation resent successfully', invitationUrl });
  } catch (error) {
    console.error('Resend invitation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;