import { Router, Response } from 'express';
import { User } from '../models/User';
import { AuthRequest, Role, UserStatus } from '../types';
import { requireAdmin, requireRoles } from '../middleware/auth';
import { AuthUtils } from '../utils/auth';

const router = Router();

// @route   GET /api/users
// @desc    Get all users (admin only)
// @access  Private/Admin
router.get('/', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const users = await User.find({})
      .select('-passwordHash')
      .sort({ createdAt: -1 });

    // Transform to frontend expected format
    const transformedUsers = users.map(user => ({
      id: user.id,
      email: user.email,
      full_name: user.fullName,
      roles: user.roles,
      groups: user.groups,
      status: user.status,
      created_at: user.createdAt,
      updated_at: user.updatedAt,
      last_login: user.lastLogin
    }));

    res.json(transformedUsers);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// @route   GET /api/users/:id
// @desc    Get user by ID
// @access  Private (self or admin)
router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const currentUser = req.user!;

    // Check if user is accessing their own profile or is admin
    if (currentUser.id !== id && !currentUser.roles.includes(Role.ADMIN)) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const user = await User.findOne({ id }).select('-passwordHash');
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Transform to frontend expected format
    const transformedUser = {
      id: user.id,
      email: user.email,
      full_name: user.fullName,
      roles: user.roles,
      groups: user.groups,
      status: user.status,
      created_at: user.createdAt,
      updated_at: user.updatedAt,
      last_login: user.lastLogin
    };

    res.json(transformedUser);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// @route   POST /api/users
// @desc    Create new user (admin only)
// @access  Private/Admin
router.post('/', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { email, fullName, roles, sendInvitation, password } = req.body;

    // Validation
    if (!email || !fullName || !roles || !Array.isArray(roles)) {
      res.status(400).json({ error: 'Email, fullName, and roles are required' });
      return;
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      res.status(400).json({ error: 'User with this email already exists' });
      return;
    }

    // Create user data
    const userData: any = {
      email: email.toLowerCase(),
      fullName,
      roles,
      status: sendInvitation ? UserStatus.PENDING : UserStatus.ACTIVE
    };

    // Handle password - either hash provided password or prepare for invitation
    if (password && !sendInvitation) {
      // Direct password creation (admin setting password)
      userData.passwordHash = await AuthUtils.hashPassword(password);
    } else if (sendInvitation) {
      // If sending invitation, generate invitation token
      userData.invitationToken = AuthUtils.generateInvitationToken();
      userData.invitationExpires = AuthUtils.generateInvitationExpiry();
    }

    const user = new User(userData);
    await user.save();

    // TODO: Send email invitation if sendInvitation is true
    // For now, we'll just return the invitation URL in response
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
        status: user.status,
        created_at: user.createdAt,
        updated_at: user.updatedAt
      },
      invitationUrl,
      message: sendInvitation ? 'User created and invitation sent' : 'User created successfully'
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// @route   PUT /api/users/:id
// @desc    Update user (admin only)
// @access  Private/Admin
router.put('/:id', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { fullName, roles, status, email, password } = req.body;

    const user = await User.findOne({ id });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Update fields if provided
    if (fullName !== undefined) user.fullName = fullName;
    if (roles !== undefined) user.roles = roles;
    if (status !== undefined) user.status = status;
    if (email !== undefined) user.email = email.toLowerCase();
    
    // Update password if provided
    if (password !== undefined && password !== '') {
      user.passwordHash = await AuthUtils.hashPassword(password);
      console.log(`Password updated for user ${user.email}`);
    }

    await user.save();

    res.json({
      id: user.id,
      email: user.email,
      full_name: user.fullName,
      roles: user.roles,
      status: user.status,
      created_at: user.createdAt,
      updated_at: user.updatedAt
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// @route   DELETE /api/users/:id
// @desc    Delete user (admin only)
// @access  Private/Admin
router.delete('/:id', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const currentUser = req.user!;

    // Prevent admin from deleting themselves
    if (currentUser.id === id) {
      res.status(400).json({ error: 'Cannot delete your own account' });
      return;
    }

    const user = await User.findOne({ id });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    await User.deleteOne({ id });

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// @route   POST /api/users/:id/resend-invitation
// @desc    Resend invitation to user (admin only)
// @access  Private/Admin
router.post('/:id/resend-invitation', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const user = await User.findOne({ id });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (user.status === UserStatus.ACTIVE) {
      res.status(400).json({ error: 'User is already active' });
      return;
    }

    // Generate new invitation token
    user.invitationToken = AuthUtils.generateInvitationToken();
    user.invitationExpires = AuthUtils.generateInvitationExpiry();
    user.status = UserStatus.PENDING;
    await user.save();

    // TODO: Send email invitation
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const invitationUrl = `${frontendUrl}/invitation/${user.invitationToken}`;

    res.json({
      message: 'Invitation resent successfully',
      invitationUrl
    });
  } catch (error) {
    console.error('Resend invitation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;