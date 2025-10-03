import { Router, Response } from 'express';
import { Task } from '../models/Task';
import { Board } from '../models/Board';
import { Column } from '../models/Column';
import { AuthRequest, Role } from '../types';
import { validate, createTaskSchema, updateTaskSchema } from '../middleware/validation';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Helper function to check board access (same as in boards.ts)
const checkBoardAccess = async (user: any, boardKey: string) => {
  const key = String(boardKey || '').toUpperCase();
  const board = await Board.findOne({ key });
  if (!board) {
    return null;
  }

  // Admin can access all boards
  if (user.roles.includes(Role.ADMIN)) {
    return board;
  }

  // Buyers can access BUY, TECH, DES boards
  if (user.roles.includes(Role.BUYER) && ['BUY', 'TECH', 'DES'].includes(key)) {
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

// @route   POST /api/tasks
// @desc    Create new task
// @access  Private
router.post('/', validate(createTaskSchema), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const taskData = { ...(req.body || {}) };

    // normalize input
    taskData.boardKey = String(taskData.boardKey || '').toUpperCase();

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

    // Soft normalize for expenses: amount/category
    if (taskData.amount !== undefined) {
      const n = Number(taskData.amount);
      taskData.amount = Number.isFinite(n) ? n : 0;
    }
    if (taskData.category !== undefined && taskData.category !== null) {
      taskData.category = String(taskData.category);
    }

    // Create task
    const task = new Task({
      ...taskData,
      creatorId: user.id
    });

    await task.save();
    res.status(201).json(task.toJSON());
  } catch (error: any) {
    console.error('Create task error:', error);
    // Mongoose validation error → 400
    if (error?.name === 'ValidationError') {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// @route   PATCH /api/tasks/:id
// @desc    Update task with cross-team routing
// @access  Private
router.patch('/:id', validate(updateTaskSchema), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updateData = { ...(req.body || {}) };
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

    const isAdmin = user.roles.includes(Role.ADMIN);

    // Cross-team routing when moving to specific columns
    if (updateData.columnId) {
      const newColumn = await Column.findOne({ id: updateData.columnId });
      if (newColumn) {
        const columnKey = newColumn.key;
        const currentBoardKey = task.boardKey;

        let newBoardKey: string | null = null;
        let targetColumnKey: string | null = null;

        if (columnKey === 'TO_TECH' && currentBoardKey !== 'TECH') {
          newBoardKey = 'TECH';
          targetColumnKey = 'TODO';
        } else if (columnKey === 'TO_DESIGNERS' && currentBoardKey !== 'DES') {
          newBoardKey = 'DES';
          targetColumnKey = 'QUEUE';
        }

        if (newBoardKey && targetColumnKey) {
          const targetBoard = await Board.findOne({ key: newBoardKey });
          const targetColumn = await Column.findOne({
            boardId: targetBoard?.id,
            key: targetColumnKey
          });

          if (targetBoard && targetColumn) {
            task.boardKey = newBoardKey;
            task.columnId = targetColumn.id;
            task.routedFrom = {
              boardKey: currentBoardKey,
              userId: user.id,
              userName: user.fullName,
              routedAt: new Date()
            };
            // merge other updates (but keep column/board from routing)
            Object.assign(task, { ...updateData, columnId: targetColumn.id, boardKey: newBoardKey });
            task.updatedAt = new Date();
            await task.save();
            res.json(task.toJSON());
            return;
          }
        }
      }
    }

    // Soft normalization for expenses fields
    if (updateData.amount !== undefined) {
      const n = Number(updateData.amount);
      updateData.amount = Number.isFinite(n) ? n : 0;
    }
    if (updateData.category !== undefined && updateData.category !== null) {
      updateData.category = String(updateData.category);
    }

    // Permissions:
    // admin — всё; иначе автор/ассайни
    if (!isAdmin) {
      const isCreatorOrAssignee = [task.creatorId, task.assigneeId].includes(user.id);
      if (!isCreatorOrAssignee) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }
    }

    Object.assign(task, updateData);
    task.updatedAt = new Date();
    await task.save();

    res.json(task.toJSON());
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// @route   POST /api/tasks/:id/comments
// @desc    Add comment to a task
// @access  Private
router.post('/:id/comments', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const { text } = req.body || {};

    if (!text || typeof text !== 'string' || !text.trim()) {
      res.status(400).json({ error: 'Text is required' });
      return;
    }

    const task = await Task.findOne({ id });
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    // Access check to the task's board
    const board = await checkBoardAccess(user, task.boardKey);
    if (!board) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const comment = {
      id: uuidv4(),
      authorId: user.id,
      authorName: user.fullName,
      text: text.trim(),
      createdAt: new Date(),
    };

    task.comments = task.comments || [];
    task.comments.push(comment as any);
    task.updatedAt = new Date();
    await task.save();

    res.status(201).json(comment);
  } catch (error) {
    console.error('Add comment error:', error);
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
    let boardQuery: any = {};
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
    const accessibleBoardKeys = accessibleBoards.map(b => b.key);

    // Get tasks assigned to user from accessible boards
    const tasks = await Task.find({
      assigneeId: user.id,
      boardKey: { $in: accessibleBoardKeys }
    }).sort({ createdAt: -1 });

    res.json(tasks.map(t => t.toJSON()));
  } catch (error) {
    console.error('Get my tasks error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;