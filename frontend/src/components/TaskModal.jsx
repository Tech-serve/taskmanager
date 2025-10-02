import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Label } from './ui/label';
import { Card, CardContent } from './ui/card';
import { EXPENSE_CATEGORIES, getCategoryDisplayName } from './CategorySelector';
import { Calendar, User, Clock, MessageSquare, Send } from 'lucide-react';
import { tasksAPI } from '../lib/api';
import { toast } from 'sonner';

const TaskModal = ({ task, isOpen, onClose, users, onTaskUpdate, boardType = 'tasks' }) => {
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  if (!task) return null;

  const assignedUser = users.find(u => u.id === task.assignee_id);
  const creatorUser = users.find(u => u.id === task.creator_id);

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    try {
      setSubmittingComment(true);
      await tasksAPI.addComment(task.id, { text: newComment.trim() });
      setNewComment('');
      toast.success('Comment added successfully');
      // Refresh task data
      if (onTaskUpdate) {
        onTaskUpdate();
      }
    } catch (error) {
      toast.error('Failed to add comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  const getPriorityColor = (priority) => {
    const colors = {
      low: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
      high: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
    };
    return colors[priority] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-white dark:bg-gray-600 border dark:border-gray-400">
        <DialogHeader>
          <DialogTitle className="text-gray-900 dark:text-white flex items-center justify-between">
            <span>{task.title}</span>
            <div className="flex items-center space-x-2">
              {task.priority && (
                <Badge className={getPriorityColor(task.priority)}>
                  {task.priority}
                </Badge>
              )}
              <Badge variant="outline" className="dark:border-gray-400 dark:text-white">
                {task.board_key}
              </Badge>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Task Details */}
          <div className="space-y-4">
            {/* Description */}
            {task.description && (
              <div>
                <Label className="text-gray-700 dark:text-white font-medium">Description</Label>
                <p className="text-gray-900 dark:text-gray-200 bg-gray-50 dark:bg-gray-500 p-3 rounded-lg mt-1">
                  {task.description}
                </p>
              </div>
            )}

            {/* Amount for expenses */}
            {boardType === 'expenses' && task.amount !== undefined && (
              <div>
                <Label className="text-gray-700 dark:text-white font-medium">Amount</Label>
                <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg p-3 mt-1">
                  <span className="text-2xl font-bold text-green-800 dark:text-green-200">
                    ₽{task.amount?.toLocaleString()}
                  </span>
                </div>
              </div>
            )}

            {/* Category for expenses */}
            {boardType === 'expenses' && task.category && (
              <div>
                <Label className="text-gray-700 dark:text-white font-medium">Category</Label>
                <p className="text-gray-900 dark:text-gray-200 bg-gray-50 dark:bg-gray-500 p-3 rounded-lg mt-1">
                  {getCategoryDisplayName(task.category)}
                </p>
              </div>
            )}

            {/* Meta Information */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-700 dark:text-white font-medium flex items-center">
                  <User className="w-4 h-4 mr-1" />
                  Creator
                </Label>
                <p className="text-gray-900 dark:text-gray-200 mt-1">
                  {creatorUser?.full_name || 'Unknown'}
                </p>
              </div>

              {assignedUser && (
                <div>
                  <Label className="text-gray-700 dark:text-white font-medium flex items-center">
                    <User className="w-4 h-4 mr-1" />
                    Assignee
                  </Label>
                  <p className="text-gray-900 dark:text-gray-200 mt-1">
                    {assignedUser.full_name}
                  </p>
                </div>
              )}

              {task.due_date && (
                <div>
                  <Label className="text-gray-700 dark:text-white font-medium flex items-center">
                    <Calendar className="w-4 h-4 mr-1" />
                    Due Date
                  </Label>
                  <p className="text-gray-900 dark:text-gray-200 mt-1">
                    {new Date(task.due_date).toLocaleDateString()}
                  </p>
                </div>
              )}

              <div>
                <Label className="text-gray-700 dark:text-white font-medium flex items-center">
                  <Clock className="w-4 h-4 mr-1" />
                  Created
                </Label>
                <p className="text-gray-900 dark:text-gray-200 mt-1">
                  {new Date(task.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>

            {/* Tags */}
            {task.tags && task.tags.length > 0 && (
              <div>
                <Label className="text-gray-700 dark:text-white font-medium">Tags</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {task.tags.map((tag, index) => (
                    <Badge key={index} variant="outline" className="dark:border-gray-400 dark:text-white">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Comments Section */}
          <div>
            <Label className="text-gray-700 dark:text-white font-medium flex items-center mb-3">
              <MessageSquare className="w-4 h-4 mr-1" />
              Comments ({task.comments?.length || 0})
            </Label>

            {/* Existing Comments */}
            <div className="space-y-3 mb-4 max-h-60 overflow-y-auto">
              {task.comments && task.comments.length > 0 ? (
                task.comments.map((comment) => (
                  <Card key={comment.id} className="dark:bg-gray-500 dark:border-gray-400">
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between mb-2">
                        <span className="font-medium text-gray-900 dark:text-white text-sm">
                          {comment.author_name}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-300">
                          {new Date(comment.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-gray-900 dark:text-gray-200 text-sm">
                        {comment.text}
                      </p>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-sm italic">
                  No comments yet. Be the first to comment!
                </p>
              )}
            </div>

            {/* Add Comment */}
            <div className="flex space-x-2">
              <Textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                rows={2}
                className="flex-1 dark:bg-gray-400 dark:border-gray-300 dark:text-white dark:placeholder-gray-200"
              />
              <Button
                onClick={handleAddComment}
                disabled={!newComment.trim() || submittingComment}
                className="bg-blue-600 hover:bg-blue-700 text-white self-end"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t dark:border-gray-400">
          <Button variant="outline" onClick={onClose} className="dark:bg-gray-500 dark:border-gray-400 dark:text-white dark:hover:bg-gray-400">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TaskModal;