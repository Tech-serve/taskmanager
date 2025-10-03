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

/**
 * ОЖИДАЕМЫЕ ПРОПСЫ:
 * - task: объект задачи в snake_case (или пустой объект для создания)
 * - isOpen: boolean
 * - onClose: () => void
 * - users: массив пользователей {id, full_name, ...}
 * - onTaskUpdate: () => void  // родитель перезагрузит задачу/доску
 * - boardType: 'tasks' | 'expenses'
 * - defaultBoardKey?: string  // если создаём — сюда положить ключ доски
 * - defaultColumnId?: string  // если создаём — сюда положить ID колонки
 */
const TaskModal = ({
  task,
  isOpen,
  onClose,
  users = [],
  onTaskUpdate,
  boardType = 'tasks',
  defaultBoardKey,
  defaultColumnId
}) => {
  // ---- ФЛАГИ/ПЕРЕМЕННЫЕ (без ранних return) --------------------------------
  const safeTask = task || {};
  const isEdit = Boolean(safeTask.id); // есть id — редактируем; нет — создаём

  // ---- ХУКИ ВСЕГДА ВЫЗЫВАЕМ В ОДНОМ ПОРЯДКЕ --------------------------------
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [saving, setSaving] = useState(false);

  const emptyForm = useMemo(
    () => ({
      // базовые
      title: '',
      description: '',
      priority: 'medium',
      assignee_id: '',
      due_date: '', // YYYY-MM-DD
      tags: [],
      // расходы
      amount: undefined,
      category: '',
      // системные
      board_key: defaultBoardKey || '',
      column_id: defaultColumnId || '',
    }),
    [defaultBoardKey, defaultColumnId]
  );

  const [form, setForm] = useState(emptyForm);

  // синк формы с приходящим task / открытием модалки
  useEffect(() => {
    if (isEdit) {
      setForm({
        title: safeTask.title || '',
        description: safeTask.description || '',
        priority: safeTask.priority || 'medium',
        assignee_id: safeTask.assignee_id || '',
        due_date: safeTask.due_date
          ? new Date(safeTask.due_date).toISOString().slice(0, 10)
          : '',
        tags: Array.isArray(safeTask.tags) ? safeTask.tags : [],
        amount:
          typeof safeTask.amount === 'number'
            ? safeTask.amount
            : undefined,
        category: safeTask.category || '',
        board_key: safeTask.board_key || '',
        column_id: safeTask.column_id || '',
      });
    } else {
      // создание
      setForm(emptyForm);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isEdit, safeTask, emptyForm]);

  const assignedUser = useMemo(() => {
    return users.find((u) => u.id === (form.assignee_id || safeTask.assignee_id));
  }, [users, form.assignee_id, safeTask.assignee_id]);

  const creatorUser = useMemo(() => {
    const cid = safeTask.creator_id;
    return cid ? users.find((u) => u.id === cid) : undefined;
  }, [users, safeTask.creator_id]);

  const comments = useMemo(() => {
    const arr = Array.isArray(safeTask.comments) ? safeTask.comments : [];
    // поддерживаем и camel, и snake
    return arr.map((c) => ({
      id: c.id,
      authorName: c.author_name || c.authorName || 'User',
      createdAt: c.created_at || c.createdAt,
      text: c.text || '',
    }));
  }, [safeTask.comments]);

  // ---- HELPERS ---------------------------------------------------------------
  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const getPriorityColor = (priority) => {
    const colors = {
      low: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
      high: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    };
    return colors[priority] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  };

  // ---- SAVE/UPDATE -----------------------------------------------------------
  const handleSave = async () => {
    // простая валидация
    if (!form.title.trim()) {
      toast.error('Title is required');
      return;
    }
    // при создании — нужны board_key и column_id
    if (!isEdit) {
      if (!form.board_key) {
        toast.error('board_key is required for creating a task');
        return;
      }
      if (!form.column_id) {
        toast.error('column_id is required for creating a task');
        return;
      }
    }

    setSaving(true);
    try {
      if (isEdit) {
        // UPDATE — шлём только изменяемые поля
        const payload = {
          title: form.title,
          description: form.description,
          priority: form.priority,
          assignee_id: form.assignee_id || undefined,
          due_date: form.due_date || undefined,
          tags: form.tags,
        };
        if (boardType === 'expenses') {
          payload.amount =
            form.amount === undefined || form.amount === null || form.amount === ''
              ? undefined
              : Number(form.amount);
          payload.category = form.category || undefined;
        }
        await tasksAPI.update(safeTask.id, payload);
        toast.success('Task updated');
      } else {
        // CREATE — минимум title/board_key/column_id
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
          payload.amount =
            form.amount === undefined || form.amount === null || form.amount === ''
              ? undefined
              : Number(form.amount);
          payload.category = form.category || undefined;
        }
        await tasksAPI.create(payload);
        toast.success('Task created');
      }

      onTaskUpdate && onTaskUpdate();
      onClose && onClose();
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || 'Failed to save task';
      toast.error(msg);
      // eslint-disable-next-line no-console
      console.error('Task save error:', e);
    } finally {
      setSaving(false);
    }
  };

  // ---- COMMENTS --------------------------------------------------------------
  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    if (!isEdit) {
      toast.error('You can add comments after the task is created');
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
      // eslint-disable-next-line no-console
      console.error('Add comment error:', error);
    } finally {
      setSubmittingComment(false);
    }
  };

  // ---- UI --------------------------------------------------------------------
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto bg-white dark:bg-gray-600 border dark:border-gray-400">
        <DialogHeader>
          <DialogTitle className="text-gray-900 dark:text-white flex items-center justify-between">
            <span>{isEdit ? 'Edit Task' : 'Create Task'}</span>
            <div className="flex items-center space-x-2">
              {form.priority && (
                <Badge className={getPriorityColor(form.priority)}>{form.priority}</Badge>
              )}
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
                value={form.description}
                onChange={(e) => setField('description', e.target.value)}
                rows={4}
                placeholder="Details..."
                className="mt-1 dark:bg-gray-400 dark:border-gray-300 dark:text-white dark:placeholder-gray-200"
              />
            </div>

            {/* Только при создании показываем выбор board/column, если не заданы снаружи */}
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

            {/* Приоритет */}
            <div>
              <Label className="text-gray-700 dark:text-white font-medium">Priority</Label>
              <Select
                value={form.priority}
                onValueChange={(v) => setField('priority', v)}
              >
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

            {/* Исполнитель */}
            <div>
              <Label className="text-gray-700 dark:text-white font-medium">Assignee</Label>
              <Select
                value={form.assignee_id || ''}
                onValueChange={(v) => setField('assignee_id', v)}
              >
                <SelectTrigger className="mt-1 dark:bg-gray-400 dark:border-gray-300 dark:text-white">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent className="dark:bg-gray-700 dark:border-gray-600">
                  <SelectItem value="">Unassigned</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.full_name || u.fullName || u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Дедлайн */}
            <div>
              <Label className="text-gray-700 dark:text-white font-medium">Due date</Label>
              <Input
                type="date"
                value={form.due_date}
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
                    value={form.category || ''}
                    onValueChange={(v) => setField('category', v)}
                  >
                    <SelectTrigger className="mt-1 dark:bg-gray-400 dark:border-gray-300 dark:text-white">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent className="dark:bg-gray-700 dark:border-gray-600">
                      {/* MAIN.category.subcategory структура */}
                      {Object.entries(EXPENSE_CATEGORIES).map(([mainKey, main]) => (
                        <React.Fragment key={mainKey}>
                          {/* основной уровень, без сабов */}
                          {(!main.subcategories || !Object.keys(main.subcategories).length) && (
                            <SelectItem value={mainKey}>{main.name}</SelectItem>
                          )}
                          {/* c сабкатегориями */}
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

          {/* Метаданные (read-only) */}
          {isEdit && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-700 dark:text-white font-medium flex items-center">
                  <User className="w-4 h-4 mr-1" />
                  Creator
                </Label>
                <p className="text-gray-900 dark:text-gray-200 mt-1">
                  {creatorUser?.full_name || creatorUser?.fullName || 'Unknown'}
                </p>
              </div>

              {assignedUser && (
                <div>
                  <Label className="text-gray-700 dark:text-white font-medium flex items-center">
                    <User className="w-4 h-4 mr-1" />
                    Assignee
                  </Label>
                  <p className="text-gray-900 dark:text-gray-200 mt-1">
                    {assignedUser.full_name || assignedUser.fullName}
                  </p>
                </div>
              )}

              {(safeTask.due_date || safeTask.dueDate) && (
                <div>
                  <Label className="text-gray-700 dark:text-white font-medium flex items-center">
                    <Calendar className="w-4 h-4 mr-1" />
                    Due Date
                  </Label>
                  <p className="text-gray-900 dark:text-gray-200 mt-1">
                    {new Date(safeTask.due_date || safeTask.dueDate).toLocaleDateString()}
                  </p>
                </div>
              )}

              <div>
                <Label className="text-gray-700 dark:text-white font-medium flex items-center">
                  <Clock className="w-4 h-4 mr-1" />
                  Created
                </Label>
                <p className="text-gray-900 dark:text-gray-200 mt-1">
                  {safeTask.created_at || safeTask.createdAt
                    ? new Date(safeTask.created_at || safeTask.createdAt).toLocaleDateString()
                    : '-'}
                </p>
              </div>
            </div>
          )}

          {/* Комментарии */}
          <div>
            <Label className="text-gray-700 dark:text-white font-medium flex items-center mb-3">
              <MessageSquare className="w-4 h-4 mr-1" />
              Comments ({comments.length})
            </Label>

            {/* Existing Comments */}
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
                          {comment.createdAt
                            ? new Date(comment.createdAt).toLocaleString()
                            : ''}
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

            {/* Add Comment */}
            <div className="flex space-x-2">
              <Textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder={
                  isEdit ? 'Add a comment…' : 'Create the task to be able to comment'
                }
                rows={2}
                disabled={!isEdit}
                className="flex-1 dark:bg-gray-400 dark:border-gray-300 dark:text-white dark:placeholder-gray-200"
              />
              <Button
                onClick={handleAddComment}
                disabled={!isEdit || !newComment.trim() || submittingComment}
                className="bg-blue-600 hover:bg-blue-700 text-white self-end"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="flex justify-between pt-4 border-t dark:border-gray-400">
          {/* Левый блок — техническая инфа */}
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
            <Button variant="outline"
              onClick={onClose}
              className="dark:bg-gray-500 dark:border-gray-400 dark:text-white dark:hover:bg-gray-400">
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