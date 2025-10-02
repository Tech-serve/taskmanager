import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Switch } from './ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { boardsAPI, columnsAPI, rolesAPI } from '../lib/api';
import { toast } from 'sonner';
import {
  Settings,
  Plus,
  Trash2,
  Eye,
  Save,
  X,
} from 'lucide-react';

const BoardSettings = ({ board, onUpdate, onClose }) => {
  const [boardData, setBoardData] = useState({
    name: board?.name || '',
    key: board?.key || '',
    type: board?.type || 'tasks',
    template: board?.template || 'kanban-basic',
    is_archived: board?.is_archived || false,
    settings: {
      assignee_enabled: board?.settings?.assignee_enabled ?? true,
      due_dates_enabled: board?.settings?.due_dates_enabled ?? true,
      priority_enabled: board?.settings?.priority_enabled ?? true,
      tags_enabled: board?.settings?.tags_enabled ?? true,
      comments_enabled: board?.settings?.comments_enabled ?? false,
      time_tracking_enabled: board?.settings?.time_tracking_enabled ?? false,
    },
    // сохраняем snake_case, как у тебя было
    allowed_roles: board?.allowed_roles || board?.allowedRoles || [],
    allowed_group_ids: board?.allowed_group_ids || [],
    members: board?.members || [],
    owners: board?.owners || [],
  });

  const [columns, setColumns] = useState([]);
  const [newColumn, setNewColumn] = useState({ key: '', name: '', order: 0 });
  const [loading, setLoading] = useState(false);

  // << новый единый источник ролей
  const [allRoles, setAllRoles] = useState([]);

  const boardTypes = [
    { value: 'tasks',    label: 'Task Board' },
    { value: 'expenses', label: 'Expense Board' },
  ];

  const templates = [
    { value: 'kanban-basic',  label: 'Basic Kanban' },
    { value: 'kanban-tj-tech', label: 'Tech Workflow' },
    { value: 'empty',          label: 'Empty Board' },
  ];

  useEffect(() => {
    if (board?.id) fetchColumns();
  }, [board?.id]);

  // подхватываем изменения внешнего board, если он обновится извне
  useEffect(() => {
    setBoardData((prev) => ({
      ...prev,
      allowed_roles: board?.allowed_roles || board?.allowedRoles || [],
    }));
  }, [board?.allowed_roles, board?.allowedRoles]);

  // подгружаем роли из /admin/roles
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const r = await rolesAPI.list();
        const items = (r.data || []).filter((x) => x.isActive !== false);
        if (mounted) setAllRoles(items);
      } catch {
        // тихий фолбэк, UI не падает
      }
    })();
    return () => { mounted = false; };
  }, []);

  const fetchColumns = async () => {
    try {
      const response = await columnsAPI.getByBoardId(board.id);
      const sorted = [...(response.data || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      setColumns(sorted);
    } catch (error) {
      console.error('Failed to fetch columns:', error);
    }
  };

  const handleSaveBoard = async () => {
    setLoading(true);
    try {
      // отправляем оба ключа для совместимости camel/snake
      const payload = {
        ...boardData,
        allowedRoles: boardData.allowed_roles,
        allowed_roles: boardData.allowed_roles,
      };

      await boardsAPI.update(board.id, payload);
      onUpdate?.(payload);
      toast.success('Board settings updated successfully');
    } catch (error) {
      toast.error('Failed to update board settings');
    } finally {
      setLoading(false);
    }
  };

  const handleAddColumn = async () => {
    if (!newColumn.name || !newColumn.key) {
      toast.error('Column name and key are required');
      return;
    }
    try {
      const columnData = { ...newColumn, order: (columns?.length || 0) + 1 };
      await columnsAPI.create(board.id, columnData);
      await fetchColumns();
      setNewColumn({ key: '', name: '', order: 0 });
      toast.success('Column added successfully');
    } catch (error) {
      toast.error('Failed to add column');
    }
  };

  const handleDeleteColumn = async (columnId) => {
    try {
      await columnsAPI.delete(columnId);
      await fetchColumns();
      toast.success('Column deleted successfully');
    } catch (error) {
      if (error?.response?.status === 400) {
        toast.error('Cannot delete column with tasks');
      } else {
        toast.error('Failed to delete column');
      }
    }
  };

  const toggleRole = (roleKey) => {
    setBoardData((prev) => {
      const set = new Set(prev.allowed_roles);
      set.has(roleKey) ? set.delete(roleKey) : set.add(roleKey);
      return { ...prev, allowed_roles: Array.from(set) };
    });
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6 bg-white dark:bg-gray-600 min-h-screen transition-colors duration-300">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Settings className="w-6 h-6 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Board Settings</h1>
        </div>
        <div className="flex items-center space-x-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="dark:bg-gray-500 dark:border-gray-400 dark:text-white dark:hover:bg-gray-400"
          >
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button
            onClick={handleSaveBoard}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Save className="w-4 h-4 mr-2" />
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Basic Settings */}
        <Card className="glass border-0 shadow-lg dark:bg-gray-500/50 dark:border-gray-400">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-white">Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="board-name" className="text-gray-700 dark:text-white">Board Name</Label>
              <Input
                id="board-name"
                value={boardData.name}
                onChange={(e) => setBoardData({ ...boardData, name: e.target.value })}
                placeholder="Enter board name"
                className="dark:bg-gray-400 dark:border-gray-300 dark:text-white dark:placeholder-gray-200"
              />
            </div>

            <div>
              <Label htmlFor="board-key" className="text-gray-700 dark:text-white">Board Key</Label>
              <Input
                id="board-key"
                value={boardData.key}
                onChange={(e) => setBoardData({ ...boardData, key: e.target.value.toUpperCase() })}
                placeholder="e.g., PROJ"
                maxLength={10}
                className="dark:bg-gray-400 dark:border-gray-300 dark:text-white dark:placeholder-gray-200"
              />
            </div>

            <div>
              <Label htmlFor="board-type" className="text-gray-700 dark:text-white">Board Type</Label>
              <div className="px-3 py-2 border rounded-md bg-gray-50 dark:bg-gray-400 text-gray-700 dark:text-white border-gray-300 dark:border-gray-300">
                {boardTypes.find(t => t.value === boardData.type)?.label || 'Tasks'}
                <span className="text-xs text-gray-500 dark:text-gray-200 ml-2">(Cannot be changed)</span>
              </div>
            </div>

            <div>
              <Label htmlFor="board-template" className="text-gray-700 dark:text-white">Template</Label>
              <Select
                value={boardData.template}
                onValueChange={(value) => setBoardData({ ...boardData, template: value })}
              >
                <SelectTrigger className="dark:bg-gray-400 dark:border-gray-300 dark:text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="dark:bg-gray-500 dark:border-gray-400">
                  {templates.map((t) => (
                    <SelectItem
                      key={t.value}
                      value={t.value}
                      className="dark:text-white dark:hover:bg-gray-400"
                    >
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="archived"
                checked={boardData.is_archived}
                onCheckedChange={(checked) => setBoardData({ ...boardData, is_archived: checked })}
              />
              <Label htmlFor="archived" className="text-gray-700 dark:text-white">Archive this board</Label>
            </div>
          </CardContent>
        </Card>

        {/* Visibility & Access */}
        <Card className="glass border-0 shadow-lg dark:bg-gray-500/50 dark:border-gray-400">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-gray-900 dark:text-white">
              <Eye className="w-5 h-5" />
              <span>Visibility & Access</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Allowed Roles from Roles collection */}
            <div>
              <Label className="text-sm font-medium text-gray-700 dark:text-white">Allowed Roles</Label>

              {allRoles.length === 0 ? (
                <div className="text-sm text-gray-500 dark:text-gray-200 mt-2">
                  No roles defined yet. Create roles in <b>Admin Settings → Roles</b>.
                </div>
              ) : (
                <div className="flex flex-wrap gap-2 mt-2">
                  {allRoles.map((r) => {
                    const active = boardData.allowed_roles.includes(r.key);
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => toggleRole(r.key)}
                        className={
                          'px-2.5 py-1.5 rounded-md text-sm border transition ' +
                          (active
                            ? 'bg-blue-600 text-white border-blue-600 dark:bg-blue-500'
                            : 'bg-transparent text-gray-800 dark:text-white border-gray-300 dark:border-gray-300 hover:bg-gray-100 dark:hover:bg-gray-400/40')
                        }
                        title={r.description || r.name}
                      >
                        {r.name}
                        <span className="opacity-70 ml-1 text-xs">({r.key})</span>
                      </button>
                    );
                  })}
                </div>
              )}

              <p className="text-xs text-gray-500 dark:text-gray-200 mt-1">
                Click to toggle role access. If empty — the board is visible to everyone.
              </p>
            </div>

            <div>
              <Label className="text-gray-700 dark:text-white">Current Access</Label>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-200">
                  <span>Members: {boardData.members?.length || 0}</span>
                  <span>Owners: {boardData.owners?.length || 0}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Feature Settings */}
        <Card className="glass border-0 shadow-lg dark:bg-gray-500/50 dark:border-gray-400">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-white">Feature Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(boardData.settings).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between">
                <Label htmlFor={key} className="text-sm text-gray-700 dark:text-white">
                  {key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                </Label>
                <Switch
                  id={key}
                  checked={!!value}
                  onCheckedChange={(checked) =>
                    setBoardData((prev) => ({
                      ...prev,
                      settings: { ...prev.settings, [key]: checked },
                    }))
                  }
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Column Management */}
        <Card className="glass border-0 shadow-lg dark:bg-gray-500/50 dark:border-gray-400">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-white">Column Management</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Existing Columns */}
            <div className="space-y-2">
              {columns.map((column, index) => (
                <div
                  key={column.id}
                  className="flex items-center justify-between p-2 border rounded dark:border-gray-400 bg-gray-50 dark:bg-gray-400/50"
                >
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-white">{index + 1}.</span>
                    <span className="text-gray-900 dark:text-white">{column.name}</span>
                    <Badge variant="outline" className="text-xs dark:border-gray-300 dark:text-white">
                      {column.key}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteColumn(column.id)}
                    className="text-red-600 dark:text-red-300 hover:text-red-700 dark:hover:text-red-200 hover:bg-red-50 dark:hover:bg-red-900/30"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Add New Column */}
            <div className="border-t dark:border-gray-400 pt-4">
              <div className="grid grid-cols-2 gap-2 mb-2">
                <Input
                  placeholder="Column name"
                  value={newColumn.name}
                  onChange={(e) => setNewColumn({ ...newColumn, name: e.target.value })}
                  className="dark:bg-gray-400 dark:border-gray-300 dark:text-white dark:placeholder-gray-200"
                />
                <Input
                  placeholder="Key (e.g., TODO)"
                  value={newColumn.key}
                  onChange={(e) => setNewColumn({ ...newColumn, key: e.target.value.toUpperCase() })}
                  className="dark:bg-gray-400 dark:border-gray-300 dark:text-white dark:placeholder-gray-200"
                />
              </div>
              <Button onClick={handleAddColumn} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                <Plus className="w-4 h-4 mr-2" />
                Add Column
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default BoardSettings;