import { Router, Request, Response } from 'express';
import { User } from '../models/User';
import { AuthUtils } from '../utils/auth';
import { validate, loginSchema, registerSchema } from '../middleware/validation';
import { authMiddleware } from '../middleware/auth';
import { AuthRequest, UserStatus } from '../types';
import { RoleBinding } from '../models/RoleBinding';

const router = Router();

/** ===== Helpers: нормализация и union реальных + добавленных ролей ===== */
const norm = (s: unknown) => String(s ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
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
function canonize(arr: unknown[]): string[] {
  const out = new Set<string>();
  for (const r of (Array.isArray(arr) ? arr : [])) {
    const k = norm(r);
    out.add(ROLE_ALIASES[k] ?? k);
  }
  return Array.from(out);
}
async function getEffectiveRoles(user: { id: string; roles?: string[] }) {
  const base = canonize(user.roles || []);
  const bindings = await RoleBinding.find({ userId: user.id, isActive: true })
    .select({ role: 1 }).lean();
  const extra = canonize(bindings.map(b => (b as any).role));
  return Array.from(new Set([...base, ...extra]));
}
/** ===================================================================== */

// @route   POST /api/auth/login
// @desc    Authenticate user
// @access  Public
router.post('/login', validate(loginSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) { res.status(401).json({ error: 'Invalid credentials' }); return; }

    // Require password
    if (!user.passwordHash) {
      res.status(401).json({ error: 'Account not activated. Please complete registration via invitation link.' });
      return;
    }

    // Check password
    const isValidPassword = await AuthUtils.comparePassword(password, user.passwordHash);
    if (!isValidPassword) { res.status(401).json({ error: 'Invalid credentials' }); return; }

    // Active?
    if (user.status !== UserStatus.ACTIVE) {
      res.status(401).json({ error: 'Account is not active' });
      return;
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Token
    const token = AuthUtils.generateToken(user.id);

    // Effective roles (real + added)
    const effectiveRoles = await getEffectiveRoles(user);

    res.json({
      access_token: token,
      token_type: 'bearer',
      user: {
        id: user.id,
        email: user.email,
        full_name: user.fullName,
        roles: user.roles,                 // как было (реальные)
        effective_roles: effectiveRoles,   // НОВОЕ: объединённый источник
        groups: user.groups,
        status: user.status,
        created_at: user.createdAt,
        updated_at: user.updatedAt
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// @route   POST /api/auth/register
// @desc    Register new user (admin only)
// @access  Private/Admin
router.post('/register', validate(registerSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, fullName, roles, status } = req.body;

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) { res.status(400).json({ error: 'User already exists' }); return; }

    const userData: any = {
   email: email.toLowerCase(),
   fullName,
   roles: canonize(roles), 
   status: status || UserStatus.ACTIVE
 };

    if (password) {
      userData.passwordHash = await AuthUtils.hashPassword(password);
    }

    const user = new User(userData);
    await user.save();

    // возвращаем effective_roles для единообразия
    const effectiveRoles = await getEffectiveRoles(user);

    res.status(201).json({
      id: user.id,
      email: user.email,
      full_name: user.fullName,
      roles: user.roles,
      effective_roles: effectiveRoles,
      status: user.status,
      created_at: user.createdAt,
      updated_at: user.updatedAt
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user profile
// @access  Private
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const effectiveRoles = await getEffectiveRoles(user);

    res.json({
      id: user.id,
      email: user.email,
      full_name: user.fullName,
      roles: user.roles,                 // реальные
      effective_roles: effectiveRoles,   // объединённые
      groups: user.groups,
      status: user.status,
      last_login: user.lastLogin,
      created_at: user.createdAt,
      updated_at: user.updatedAt
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// @route   POST /api/auth/complete-invitation
// @desc    Complete user registration via invitation
// @access  Public
router.post('/complete-invitation', async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, password } = req.body;
    if (!token || !password) { res.status(400).json({ error: 'Token and password are required' }); return; }

    const user = await User.findOne({
      invitationToken: token,
      invitationExpires: { $gt: new Date() }
    });
    if (!user) { res.status(400).json({ error: 'Invalid or expired invitation token' }); return; }

    user.passwordHash = await AuthUtils.hashPassword(password);
    user.status = UserStatus.ACTIVE;
    user.invitationToken = undefined;
    user.invitationExpires = undefined;
    await user.save();

    const accessToken = AuthUtils.generateToken(user.id);
    const effectiveRoles = await getEffectiveRoles(user);

    res.json({
      message: 'Account activated successfully',
      access_token: accessToken,
      token_type: 'bearer',
      user: {
        id: user.id,
        email: user.email,
        full_name: user.fullName,
        roles: user.roles,
        effective_roles: effectiveRoles,
        status: user.status
      }
    });
  } catch (error) {
    console.error('Complete invitation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;