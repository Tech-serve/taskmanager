import { Router, Response } from 'express';
import { Task } from '../models/Task';
import { Board } from '../models/Board';
import { Column } from '../models/Column';
import { AuthRequest, Role } from '../types';
import { validate, createTaskSchema, updateTaskSchema } from '../middleware/validation';

const router = Router();

// Helper function to check board access (same as in boards.ts)
const checkBoardAccess = async (user: any, boardKey: string) => {
  const board = await Board.findOne({ key: boardKey });
  if (!board) {
    return null;
  }

  // Admin can access all boards
  if (user.roles.includes(Role.ADMIN)) {
    return board;
  }

  // Buyers can access BUY, TECH, DES boards
  if (user.roles.includes(Role.BUYER) && ['BUY', 'TECH', 'DES'].includes(boardKey)) {
    return board;
  }

  // Check role-based access
  if (board.allowedRoles && board.allowedRoles.some((role: Role) => user.roles.includes(role))) {
    return board;
  }

  // Check membership
  if (board.members && board.members.includes(user.id)) {
    return board;
  }

  if (board.owners && board.owners.includes(user.id)) {
    return board;
  }

  return null;
};

// Moved to boards.ts as /:boardKey/tasks

// @route   POST /api/tasks
// @desc    Create new task
// @access  Private
router.post('/', validate(createTaskSchema), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const taskData = req.body;
    const user = req.user!;

    // Check board access
    const board = await checkBoardAccess(user, taskData.boardKey);
    if (!board) {
      res.status(404).json({ error: 'Board not found or access denied' });
      return;
    }

    // Verify column exists
    const column = await Column.findOne({ id: taskData.columnId });
    if (!column) {
      res.status(404).json({ error: 'Column not found' });
      return;
    }

    // Create task
    const task = new Task({
      ...taskData,
      creatorId: user.id
    });

    await task.save();
    res.status(201).json(task);
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// @route   PATCH /api/tasks/:id
// @desc    Update task with cross-team routing
// @access  Private
router.patch('/:id', validate(updateTaskSchema), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const user = req.user!;

    // Find existing task
    const task = await Task.findOne({ id });
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    // Check board access
    const board = await checkBoardAccess(user, task.boardKey);
    if (!board) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Handle cross-team routing when moving to specific columns
    if (updateData.columnId) {
      const newColumn = await Column.findOne({ id: updateData.columnId });
      if (newColumn) {
        const columnKey = newColumn.key;
        const currentBoardKey = task.boardKey;
        
        let newBoardKey: string | null = null;
        let targetColumnKey: string | null = null;

        // Cross-team routing logic
        if (columnKey === 'TO_TECH' && currentBoardKey !== 'TECH') {
          newBoardKey = 'TECH';
          targetColumnKey = 'TODO';
        } else if (columnKey === 'TO_DESIGNERS' && currentBoardKey !== 'DES') {
          newBoardKey = 'DES';
          targetColumnKey = 'QUEUE';
        }

        // If cross-team routing is needed
        if (newBoardKey && targetColumnKey) {
          const targetBoard = await Board.findOne({ key: newBoardKey });
          const targetColumn = await Column.findOne({
            boardId: targetBoard?.id,
            key: targetColumnKey
          });

          if (targetBoard && targetColumn) {
            // Update task to move to target board and column
            task.boardKey = newBoardKey;
            task.columnId = targetColumn.id;
            task.routedFrom = {
              boardKey: currentBoardKey,
              userId: user.id,
              userName: user.fullName,
              routedAt: new Date()
            };
            task.updatedAt = new Date();

            // Apply other updates if provided
            Object.assign(task, { ...updateData, columnId: targetColumn.id, boardKey: newBoardKey });
            await task.save();

            res.json(task);
            return;
          }
        }
      }
    }

    // Normal task update (no cross-team routing)
    Object.assign(task, updateData);
    task.updatedAt = new Date();
    await task.save();

    res.json(task);
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// @route   DELETE /api/tasks/:id
// @desc    Delete task
// @access  Private
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = req.user!;

    const task = await Task.findOne({ id });
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    // Check permissions: admin, task creator, or board owner
    const board = await Board.findOne({ key: task.boardKey });
    if (!user.roles.includes(Role.ADMIN) &&
        task.creatorId !== user.id &&
        !board?.owners?.includes(user.id)) {
      res.status(403).json({ error: 'Permission denied' });
      return;
    }

    await Task.deleteOne({ id });
    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// @route   GET /api/me/tasks
// @desc    Get current user's assigned tasks
// @access  Private
router.get('/me/tasks', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;

    // Get accessible boards
    let boardQuery = {};
    if (!user.roles.includes(Role.ADMIN)) {
      if (user.roles.includes(Role.BUYER)) {
        boardQuery = { key: { $in: ['BUY', 'TECH', 'DES'] } };
      } else {
        boardQuery = {
          $or: [
            { allowedRoles: { $in: user.roles } },
            { members: user.id },
            { owners: user.id }
          ]
        };
      }
    }

    const accessibleBoards = await Board.find(boardQuery).select('key');
    const accessibleBoardKeys = accessibleBoards.map(board => board.key);

    // Get tasks assigned to user from accessible boards
    const tasks = await Task.find({
      assigneeId: user.id,
      boardKey: { $in: accessibleBoardKeys }
    }).sort({ createdAt: -1 });

    res.json(tasks);
  } catch (error) {
    console.error('Get my tasks error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;