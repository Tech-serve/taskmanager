import { Router, Request, Response } from 'express';
import { User } from '../models/User';
import { AuthUtils } from '../utils/auth';
import { validate, loginSchema, registerSchema } from '../middleware/validation';
import { authMiddleware } from '../middleware/auth';
import { AuthRequest, UserStatus } from '../types';

const router = Router();

// @route   POST /api/auth/login
// @desc    Authenticate user
// @access  Public
router.post('/login', validate(loginSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Check if user has set password
    if (!user.passwordHash) {
      res.status(401).json({ error: 'Account not activated. Please complete registration via invitation link.' });
      return;
    }

    // Check password
    const isValidPassword = await AuthUtils.comparePassword(password, user.passwordHash);
    if (!isValidPassword) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Check if user is active
    if (user.status !== UserStatus.ACTIVE) {
      res.status(401).json({ error: 'Account is not active' });
      return;
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate token
    const token = AuthUtils.generateToken(user.id);

    // Return user data and token
    res.json({
      access_token: token,
      token_type: 'bearer',
      user: {
        id: user.id,
        email: user.email,
        full_name: user.fullName,
        roles: user.roles,
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

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      res.status(400).json({ error: 'User already exists' });
      return;
    }

    // Create user
    const userData: any = {
      email: email.toLowerCase(),
      fullName,
      roles,
      status: status || UserStatus.ACTIVE
    };

    // Hash password if provided
    if (password) {
      userData.passwordHash = await AuthUtils.hashPassword(password);
    }

    const user = new User(userData);
    await user.save();

    res.status(201).json({
      id: user.id,
      email: user.email,
      full_name: user.fullName,
      roles: user.roles,
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
    res.json({
      id: user.id,
      email: user.email,
      full_name: user.fullName,
      roles: user.roles,
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

    if (!token || !password) {
      res.status(400).json({ error: 'Token and password are required' });
      return;
    }

    // Find user by invitation token
    const user = await User.findOne({
      invitationToken: token,
      invitationExpires: { $gt: new Date() }
    });

    if (!user) {
      res.status(400).json({ error: 'Invalid or expired invitation token' });
      return;
    }

    // Set password and activate user
    user.passwordHash = await AuthUtils.hashPassword(password);
    user.status = UserStatus.ACTIVE;
    user.invitationToken = undefined;
    user.invitationExpires = undefined;
    await user.save();

    // Generate access token
    const accessToken = AuthUtils.generateToken(user.id);

    res.json({
      message: 'Account activated successfully',
      access_token: accessToken,
      token_type: 'bearer',
      user: {
        id: user.id,
        email: user.email,
        full_name: user.fullName,
        roles: user.roles,
        status: user.status
      }
    });
  } catch (error) {
    console.error('Complete invitation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;