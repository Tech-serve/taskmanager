import { Router, Response } from 'express';
import { Column } from '../models/Column';
import { Board } from '../models/Board';
import { Task } from '../models/Task';
import { AuthRequest } from '../types';
import { requireAdmin } from '../middleware/auth';

const router = Router();

// @route   PATCH /api/columns/:id
// @desc    Update column (admin only)
// @access  Private/Admin
router.patch('/:id', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const column = await Column.findOne({ id });
    if (!column) {
      res.status(404).json({ error: 'Column not found' });
      return;
    }

    // Update fields
    Object.assign(column, updateData);
    column.updatedAt = new Date();
    await column.save();

    res.json(column);
  } catch (error) {
    console.error('Update column error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// @route   DELETE /api/columns/:id
// @desc    Delete column (admin only)
// @access  Private/Admin
router.delete('/:id', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const column = await Column.findOne({ id });
    if (!column) {
      res.status(404).json({ error: 'Column not found' });
      return;
    }

    // Check if column has tasks
    const taskCount = await Task.countDocuments({ columnId: id });
    if (taskCount > 0) {
      res.status(400).json({ error: 'Cannot delete column with tasks. Please move or delete tasks first.' });
      return;
    }

    await Column.deleteOne({ id });
    res.json({ message: 'Column deleted successfully' });
  } catch (error) {
    console.error('Delete column error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;