// src/components/TaskModal.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Label } from './ui/label';
import { Card, CardContent } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { EXPENSE_CATEGORIES, getCategoryDisplayName } from './CategorySelector';
import { Calendar, User, Clock, MessageSquare, Send } from 'lucide-react';
import { tasksAPI } from '../lib/api';
import { toast } from 'sonner';

// служебные значения (Select не любит пустые строки)
const UNASSIGNED = 'unassigned';
const UNCATEGORIZED = 'uncategorized';

/**
 * Пропсы:
 * - task: объект в snake_case (если есть id — режим редактирования, иначе создание)
 * - isOpen, onClose
 * - users: [{id, full_name,...}]
 * - onTaskUpdate: () => void  // перезагрузка данных снаружи
 * - boardType: 'tasks' | 'expenses'
 * - defaultBoardKey?: string   // для создания
 * - defaultColumnId?: string   // для создания
 */
const TaskModal = ({
  task,
  isOpen,
  onClose,
  users = [],
  onTaskUpdate,
  boardType = 'tasks',
  defaultBoardKey,
  defaultColumnId,
}) => {
  const safeTask = task || {};
  const isEdit = Boolean(safeTask.id);

  const [saving, setSaving] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [newComment, setNewComment] = useState(''); // и при создании можно сразу написать

  // дефолтная форма
  const emptyForm = useMemo(
    () => ({
      title: '',
      description: '',
      priority: 'medium',
      assignee_id: null,          // null => UNASSIGNED в UI
      due_date: '',               // YYYY-MM-DD
      tags: [],
      amount: undefined,          // только для expenses
      category: undefined,        // только для expenses
      board_key: defaultBoardKey || '',
      column_id: defaultColumnId || '',
    }),
    [defaultBoardKey, defaultColumnId]
  );

  const [form, setForm] = useState(emptyForm);

  // синхронизация формы при открытии/смене задачи
  useEffect(() => {
    if (isEdit) {
      setForm({
        title: safeTask.title || '',
        description: safeTask.description || '',
        priority: safeTask.priority || 'medium',
        assignee_id: safeTask.assignee_id ?? null,
        due_date: safeTask.due_date ? new Date(safeTask.due_date).toISOString().slice(0, 10) : '',
        tags: Array.isArray(safeTask.tags) ? safeTask.tags : [],
        amount: typeof safeTask.amount === 'number' ? safeTask.amount : undefined,
        category: safeTask.category ?? undefined,
        board_key: safeTask.board_key || '',
        column_id: safeTask.column_id || '',
      });
      setNewComment(''); // новое открытие — пустим поле комментария
    } else {
      setForm(emptyForm);
      setNewComment(''); // при создании тоже можно сразу написать
    }
  }, [isOpen, isEdit, safeTask, emptyForm]);

  const setField = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const assignedUser = useMemo(() => {
    const id = form.assignee_id ?? safeTask.assignee_id;
    return users.find(u => u.id === id);
  }, [users, form.assignee_id, safeTask.assignee_id]);

  const creatorUser = useMemo(() => {
    const cid = safeTask.creator_id;
    return cid ? users.find(u => u.id === cid) : undefined;
  }, [users, safeTask.creator_id]);

  const comments = useMemo(() => {
    const arr = Array.isArray(safeTask.comments) ? safeTask.comments : [];
    return arr.map(c => ({
      id: c.id,
      authorName: c.author_name || c.authorName || 'User',
      createdAt: c.created_at || c.createdAt,
      text: c.text || '',
    }));
  }, [safeTask.comments]);

  const getPriorityColor = (priority) => {
    const colors = {
      low: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
      high: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    };
    return colors[priority] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  };

  // создание/сохранение
  const handleSave = async () => {
    if (!form.title.trim()) {
      toast.error('Title is required');
      return;
    }
    if (!isEdit) {
      if (!form.board_key) return toast.error('board_key is required for creating a task');
      if (!form.column_id) return toast.error('column_id is required for creating a task');
    }

    setSaving(true);
    try {
      if (isEdit) {
        // PATCH
        const payload = {
          title: form.title,
          description: form.description || undefined,
          priority: form.priority || 'medium',
          assignee_id: form.assignee_id || undefined,
          due_date: form.due_date || undefined,
          tags: form.tags || [],
        };
        if (boardType === 'expenses') {
          payload.amount = form.amount === '' ? undefined : Number(form.amount ?? 0);
          payload.category = form.category || undefined;
        }
        await tasksAPI.update(safeTask.id, payload);

        // при редактировании, если введён новый комментарий — отправим
        if (newComment.trim()) {
          await tasksAPI.addComment(safeTask.id, { text: newComment.trim() });
          setNewComment('');
        }

        toast.success('Task updated');
      } else {
        // POST
        const payload = {
          board_key: String(form.board_key).toUpperCase(),
          column_id: form.column_id,
          title: form.title,
          description: form.description || undefined,
          priority: form.priority || 'medium',
          assignee_id: form.assignee_id || undefined,
          due_date: form.due_date || undefined,
          tags: form.tags || [],
        };
        if (boardType === 'expenses') {
          payload.amount = form.amount === '' ? undefined : Number(form.amount ?? 0);
          payload.category = form.category || undefined;
        }

        const res = await tasksAPI.create(payload); // { data: createdTask (snake_case) }
        const created = res?.data;
        // если при создании написали комментарий — сразу добросим
        if (created?.id && newComment.trim()) {
          await tasksAPI.addComment(created.id, { text: newComment.trim() });
          setNewComment('');
        }
        toast.success('Task created');
      }

      onTaskUpdate && onTaskUpdate();
      onClose && onClose();
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || 'Failed to save task';
      toast.error(msg);
      console.error('Task save error:', e);
    } finally {
      setSaving(false);
    }
  };

  // добавить комментарий в режиме редактирования (кнопка-«самолётик»)
  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    if (!isEdit) {
      // в создании комментарий отправится в handleSave
      toast.error('Comment will be added after you create the task');
      return;
    }
    try {
      setSubmittingComment(true);
      await tasksAPI.addComment(safeTask.id, { text: newComment.trim() });
      setNewComment('');
      toast.success('Comment added');
      onTaskUpdate && onTaskUpdate();
    } catch (error) {
      toast.error('Failed to add comment');
      console.error('Add comment error:', error);
    } finally {
      setSubmittingComment(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto bg-white dark:bg-gray-600 border dark:border-gray-400">
        <DialogHeader>
          <DialogTitle className="text-gray-900 dark:text-white flex items-center justify-between">
            <span>{isEdit ? 'Edit Task' : 'Create Task'}</span>
            <div className="flex items-center space-x-2">
              {form.priority && <Badge className={getPriorityColor(form.priority)}>{form.priority}</Badge>}
              {(safeTask.board_key || form.board_key) && (
                <Badge variant="outline" className="dark:border-gray-400 dark:text-white">
                  {safeTask.board_key || form.board_key}
                </Badge>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Основные поля */}
          <div className="space-y-4">
            <div>
              <Label className="text-gray-700 dark:text-white font-medium">Title *</Label>
              <Input
                value={form.title}
                onChange={(e) => setField('title', e.target.value)}
                placeholder="Short task summary"
                className="mt-1 dark:bg-gray-400 dark:border-gray-300 dark:text-white dark:placeholder-gray-200"
              />
            </div>

            <div>
              <Label className="text-gray-700 dark:text-white font-medium">Description</Label>
              <Textarea
                value={form.description ?? ''}
                onChange={(e) => setField('description', e.target.value)}
                rows={4}
                placeholder="Details..."
                className="mt-1 dark:bg-gray-400 dark:border-gray-300 dark:text-white dark:placeholder-gray-200"
              />
            </div>

            {/* только при создании (если не пришли параметры извне) */}
            {!isEdit && !defaultBoardKey && (
              <div>
                <Label className="text-gray-700 dark:text-white font-medium">Board key</Label>
                <Input
                  value={form.board_key}
                  onChange={(e) => setField('board_key', e.target.value.toUpperCase())}
                  placeholder="EXP / BUY / TECH / DES"
                  className="mt-1 dark:bg-gray-400 dark:border-gray-300 dark:text-white dark:placeholder-gray-200"
                />
              </div>
            )}

            {!isEdit && !defaultColumnId && (
              <div>
                <Label className="text-gray-700 dark:text-white font-medium">Column ID</Label>
                <Input
                  value={form.column_id}
                  onChange={(e) => setField('column_id', e.target.value)}
                  placeholder="Target column ID"
                  className="mt-1 dark:bg-gray-400 dark:border-gray-300 dark:text-white dark:placeholder-gray-200"
                />
              </div>
            )}

            {/* Priority */}
            <div>
              <Label className="text-gray-700 dark:text-white font-medium">Priority</Label>
              <Select value={form.priority} onValueChange={(v) => setField('priority', v)}>
                <SelectTrigger className="mt-1 dark:bg-gray-400 dark:border-gray-300 dark:text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="dark:bg-gray-700 dark:border-gray-600">
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Assignee */}
            <div>
              <Label className="text-gray-700 dark:text-white font-medium">Assignee</Label>
              <Select
                value={form.assignee_id ?? UNASSIGNED}
                onValueChange={(v) => setField('assignee_id', v === UNASSIGNED ? null : v)}
              >
                <SelectTrigger className="mt-1 dark:bg-gray-400 dark:border-gray-300 dark:text-white">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent className="dark:bg-gray-700 dark:border-gray-600">
                  <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                  {users
                    .filter(u => u && u.id)
                    .map(u => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.full_name || u.fullName || u.email}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Due date */}
            <div>
              <Label className="text-gray-700 dark:text-white font-medium">Due date</Label>
              <Input
                type="date"
                value={form.due_date || ''}
                onChange={(e) => setField('due_date', e.target.value)}
                className="mt-1 dark:bg-gray-400 dark:border-gray-300 dark:text-white"
              />
            </div>

            {/* Блок расходов */}
            {boardType === 'expenses' && (
              <>
                <div>
                  <Label className="text-gray-700 dark:text-white font-medium">Amount</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={form.amount ?? ''}
                    onChange={(e) => setField('amount', e.target.value)}
                    placeholder="0"
                    className="mt-1 dark:bg-gray-400 dark:border-gray-300 dark:text-white"
                  />
                </div>

                <div>
                  <Label className="text-gray-700 dark:text-white font-medium">Category</Label>
                  <Select
                    value={form.category ?? UNCATEGORIZED}
                    onValueChange={(v) => setField('category', v === UNCATEGORIZED ? undefined : v)}
                  >
                    <SelectTrigger className="mt-1 dark:bg-gray-400 dark:border-gray-300 dark:text-white">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent className="dark:bg-gray-700 dark:border-gray-600">
                      <SelectItem value={UNCATEGORIZED}>No category</SelectItem>
                      {Object.entries(EXPENSE_CATEGORIES).map(([mainKey, main]) => (
                        <React.Fragment key={mainKey}>
                          {(!main.subcategories || !Object.keys(main.subcategories).length) && (
                            <SelectItem value={mainKey}>{main.name}</SelectItem>
                          )}
                          {main.subcategories &&
                            Object.entries(main.subcategories).map(([subKey, subName]) => {
                              const val = `${mainKey}.${subKey}`;
                              return (
                                <SelectItem key={val} value={val}>
                                  {main.name} / {subName}
                                </SelectItem>
                              );
                            })}
                        </React.Fragment>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.category && (
                    <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                      {getCategoryDisplayName(form.category)}
                    </p>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Метаданные */}
          {isEdit && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-700 dark:text-white font-medium flex items-center">
                  <User className="w-4 h-4 mr-1" /> Creator
                </Label>
                <p className="text-gray-900 dark:text-gray-200 mt-1">
                  {creatorUser?.full_name || creatorUser?.fullName || 'Unknown'}
                </p>
              </div>

              {assignedUser && (
                <div>
                  <Label className="text-gray-700 dark:text-white font-medium flex items-center">
                    <User className="w-4 h-4 mr-1" /> Assignee
                  </Label>
                  <p className="text-gray-900 dark:text-gray-200 mt-1">
                    {assignedUser.full_name || assignedUser.fullName}
                  </p>
                </div>
              )}

              {(safeTask.due_date || safeTask.dueDate) && (
                <div>
                  <Label className="text-gray-700 dark:text-white font-medium flex items-center">
                    <Calendar className="w-4 h-4 mr-1" /> Due Date
                  </Label>
                  <p className="text-gray-900 dark:text-gray-200 mt-1">
                    {new Date(safeTask.due_date || safeTask.dueDate).toLocaleDateString()}
                  </p>
                </div>
              )}

              <div>
                <Label className="text-gray-700 dark:text-white font-medium flex items-center">
                  <Clock className="w-4 h-4 mr-1" /> Created
                </Label>
                <p className="text-gray-900 dark:text-gray-200 mt-1">
                  {safeTask.created_at || safeTask.createdAt
                    ? new Date(safeTask.created_at || safeTask.createdAt).toLocaleDateString()
                    : '-'}
                </p>
              </div>
            </div>
          )}

          {/* Комментарии (одно поле — работает и в создании, и в редактировании) */}
          <div>
            <Label className="text-gray-700 dark:text-white font-medium flex items-center mb-3">
              <MessageSquare className="w-4 h-4 mr-1" />
              Comments ({comments.length})
            </Label>

            {/* Список текущих комментариев (только в режиме редактирования) */}
            {isEdit && (
              <div className="space-y-3 mb-4 max-h-60 overflow-y-auto">
                {comments.length > 0 ? (
                  comments.map((comment) => (
                    <Card key={comment.id} className="dark:bg-gray-500 dark:border-gray-400">
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between mb-2">
                          <span className="font-medium text-gray-900 dark:text-white text-sm">
                            {comment.authorName}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-300">
                            {comment.createdAt ? new Date(comment.createdAt).toLocaleString() : ''}
                          </span>
                        </div>
                        <p className="text-gray-900 dark:text-gray-200 text-sm">{comment.text}</p>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-sm italic">No comments yet.</p>
                )}
              </div>
            )}

            {/* Поле добавления — активное всегда (в создании уйдёт вместе с сохранением) */}
            <div className="flex space-x-2">
              <Textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder={isEdit ? 'Add a comment…' : 'This comment will be posted after creation'}
                rows={2}
                className="flex-1 dark:bg-gray-400 dark:border-gray-300 dark:text-white dark:placeholder-gray-200"
              />
              <Button
                onClick={isEdit ? handleAddComment : handleSave}
                disabled={isEdit ? (!newComment.trim() || submittingComment) : saving}
                className="bg-blue-600 hover:bg-blue-700 text-white self-end"
                title={isEdit ? 'Add comment' : 'Create task with comment'}
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="flex justify-between pt-4 border-t dark:border-gray-400">
          {/* Техинфо */}
          <div className="text-xs text-gray-600 dark:text-gray-300">
            {isEdit ? (
              <>
                <span className="mr-3">ID: {safeTask.id}</span>
                <span className="mr-3">Board: {safeTask.board_key}</span>
                <span>Column: {safeTask.column_id}</span>
              </>
            ) : (
              <>
                <span className="mr-3">Board: {form.board_key || defaultBoardKey || '-'}</span>
                <span>Column: {form.column_id || defaultColumnId || '-'}</span>
              </>
            )}
          </div>

          <div className="space-x-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="dark:bg-gray-500 dark:border-gray-400 dark:text-white dark:hover:bg-gray-400"
            >
              Close
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {saving ? 'Saving…' : isEdit ? 'Save' : 'Create'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TaskModal;