import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { RoleBinding } from '../models/RoleBinding';
import { AuthRequest } from '../types';

// ===== Нормализация ролей и объединение =====
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
const canonize = (arr: unknown[]): string[] => {
  const out = new Set<string>();
  for (const r of (Array.isArray(arr) ? arr : [])) {
    const k = norm(r);
    out.add(ROLE_ALIASES[k] ?? k);
  }
  return Array.from(out);
};

async function computeEffectiveRoles(userId: string, baseRoles?: string[]): Promise<string[]> {
  const base = canonize(baseRoles || []);
  const bindings = await RoleBinding.find({ userId, isActive: true }).select({ role: 1 }).lean();
  const extra = canonize(bindings.map(b => (b as any).role));
  return Array.from(new Set([...base, ...extra]));
}

// ===== Основной миддлвар аутентификации =====
export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      res.status(401).json({ error: 'Access denied. No token provided.' });
      return;
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      // Это конфиг-ошибка сервера
      throw new Error('JWT_SECRET is not configured');
    }

    const decoded = jwt.verify(token, jwtSecret) as { userId: string };
    const user = await User.findOne({ id: decoded.userId });

    if (!user) {
      res.status(401).json({ error: 'Invalid token.' });
      return;
    }

    // Подсчёт эффективных ролей и прикрепление к user
    const effective = await computeEffectiveRoles(user.id, (user as any).roles);
    (user as any).effectiveRoles = effective;

    req.user = user;
    next();
  } catch (_err) {
    res.status(401).json({ error: 'Invalid token.' });
  }
};

// ===== Авторизационные гардЫ (читают именно effectiveRoles, fallback на roles) =====
function getRoles(req: AuthRequest): string[] {
  const u: any = req.user;
  return Array.isArray(u?.effectiveRoles) ? u.effectiveRoles : (u?.roles || []);
}

export const requireAdmin = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  const roles = getRoles(req);
  if (!roles.includes('admin')) {
    res.status(403).json({ error: 'Admin access required.' });
    return;
  }
  next();
};

export const requireAdminOrLead = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  const roles = getRoles(req);
  if (!(roles.includes('admin') || roles.includes('team_lead'))) {
    res.status(403).json({ error: 'Admin or Team Lead access required.' });
    return;
  }
  next();
};

// Точный гард по наборам ролей (effective → fallback roles)
export const requireRoles = (needed: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    const roles = getRoles(req);
    if (!needed.some(r => roles.includes(norm(r)))) {
      res.status(403).json({ error: 'Insufficient permissions.' });
      return;
    }
    next();
  };
};