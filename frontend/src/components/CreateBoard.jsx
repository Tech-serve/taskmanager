import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';
import { boardsAPI, columnsAPI, rolesAPI } from '../lib/api';
import { toast } from 'sonner';
import { Plus, Kanban, CheckCircle, ArrowRight } from 'lucide-react';

const CreateBoard = ({ open, onOpenChange, onBoardCreated }) => {
  const [step, setStep] = useState(1);
  const [boardData, setBoardData] = useState({
    name: '',
    key: '',
    type: 'tasks',            // "tasks" | "expenses"
    template: 'kanban-basic', // UI значение; "cross-team" мапим на backend-safe
    allowed_roles: ['admin'], // UI-стейт (snake) -> на бэк пойдёт allowedRoles (camel)
    description: '',
    settings: {
      assignee_enabled: true,
      due_dates_enabled: true,
      priority_enabled: true,
      tags_enabled: true,
    },
  });

  const [columns, setColumns] = useState([
    { key: 'BACKLOG', name: 'Backlog', order: 1 },
    { key: 'IN_PROGRESS', name: 'In Progress', order: 2 },
    { key: 'REVIEW', name: 'Review', order: 3 },
    { key: 'DONE', name: 'Done', order: 4 },
  ]);

  const [loading, setLoading] = useState(false);
  const [availableRoles, setAvailableRoles] = useState(['admin', 'buyer', 'designer', 'tech']);

  useEffect(() => {
    (async () => {
      try {
        const r = await rolesAPI.list(); // GET /api/admin/roles
        const arr = (r?.data || [])
          .filter(x => x.isActive !== false)
          .map(x => String(x.key || '').toLowerCase())
          .filter(Boolean);
        if (arr.length) setAvailableRoles(arr);
      } catch {
        // оставляем дефолтные
      }
    })();
  }, []);

  const boardTypes = [
    { value: 'tasks', label: 'Task Board', description: 'Manage tasks and workflows', icon: '📋' },
    { value: 'expenses', label: 'Expense Board', description: 'Track expenses and approvals', icon: '💰' },
  ];

  const templates = [
    {
      value: 'kanban-basic',
      label: 'Basic Kanban',
      description: 'Simple workflow for general tasks',
      columns: [
        { key: 'BACKLOG', name: 'Backlog', order: 1 },
        { key: 'IN_PROGRESS', name: 'In Progress', order: 2 },
        { key: 'REVIEW', name: 'Review', order: 3 },
        { key: 'DONE', name: 'Done', order: 4 },
      ],
    },
    {
      value: 'kanban-tj-tech',
      label: 'Tech Workflow',
      description: 'Development workflow with code review',
      columns: [
        { key: 'TODO', name: 'Todo', order: 1 },
        { key: 'IN_DEV', name: 'In Development', order: 2 },
        { key: 'CODE_REVIEW', name: 'Code Review', order: 3 },
        { key: 'TESTING', name: 'Testing', order: 4 },
        { key: 'DONE', name: 'Done', order: 5 },
      ],
    },
    {
      value: 'cross-team',
      label: 'Cross-Team Board',
      description: 'For teams that route work to other departments',
      columns: [
        { key: 'BACKLOG', name: 'Backlog', order: 1 },
        { key: 'IN_PROGRESS', name: 'In Progress', order: 2 },
        { key: 'TO_TECH', name: 'To Tech', order: 3 },
        { key: 'TO_DESIGNERS', name: 'To Designers', order: 4 },
        { key: 'DONE', name: 'Done', order: 5 },
      ],
    },
    { value: 'empty', label: 'Empty Board', description: 'Start with no columns', columns: [] },
  ];

  // UI -> backend mapping for template
  const mapTemplateForBackend = (value) => {
    if (value === 'cross-team') return 'kanban-basic'; // на бэке такого enum нет
    return value; // 'kanban-basic' | 'kanban-tj-tech' | 'empty'
  };

  const handleTemplateSelect = (templateValue) => {
    const template = templates.find(t => t.value === templateValue);
    setBoardData(prev => ({ ...prev, template: templateValue }));
    setColumns(template?.columns || []);
  };

  const toggleRole = (role) => {
    setBoardData(prev => {
      const has = prev.allowed_roles.includes(role);
      return {
        ...prev,
        allowed_roles: has
          ? prev.allowed_roles.filter(r => r !== role)
          : [...prev.allowed_roles, role],
      };
    });
  };

  const addColumn = () => {
    const next = columns.length + 1;
    setColumns(prev => [
      ...prev,
      { key: `COL_${next}`, name: `Column ${next}`, order: next },
    ]);
  };

  const updateColumn = (index, field, value) => {
    setColumns(prev => {
      const updated = [...prev];
      updated[index][field] = value;
      if (field === 'name' && !updated[index].key.startsWith('COL_')) {
        updated[index].key = String(value).toUpperCase().replace(/\s+/g, '_');
      }
      return updated;
    });
  };

  const removeColumn = (index) => {
    setColumns(prev =>
      prev.filter((_, i) => i !== index).map((col, i) => ({ ...col, order: i + 1 }))
    );
  };

  const handleCreateBoard = async () => {
    if (!boardData.name || !boardData.key) {
      toast.error('Board name and key are required');
      return;
    }
    if (boardData.allowed_roles.length === 0) {
      toast.error('At least one role must be selected');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: boardData.name,
        key: String(boardData.key).toUpperCase(),
        type: boardData.type, // "tasks" | "expenses"
        template: mapTemplateForBackend(boardData.template),
        // на бэк camelCase + lower-case
        allowedRoles: boardData.allowed_roles.map(r => String(r).toLowerCase()),
        description: boardData.description,
        // если у тебя Joi ожидает settings — отправляем camelCase с дефолтами
        settings: {
          assigneeEnabled: !!boardData.settings.assignee_enabled,
          dueDatesEnabled: !!boardData.settings.due_dates_enabled,
          priorityEnabled: !!boardData.settings.priority_enabled,
          tagsEnabled: !!boardData.settings.tags_enabled,
          commentsEnabled: false,
          timeTrackingEnabled: false,
        },
        // members/owners/allowedGroupIds можно не присылать — но на всякий:
        members: [],
        owners: [],
        allowedGroupIds: [],
      };

      const response = await boardsAPI.create(payload); // POST /api/boards
      const createdBoard = response.data;

      // создать колонки (если есть)
      if (columns.length > 0) {
        for (const column of columns) {
          await columnsAPI.create(createdBoard.id, {
            key: String(column.key || '').toUpperCase(),
            name: column.name,
            order: column.order,
          });
        }
      }

      toast.success('Board created successfully');
      onBoardCreated?.(createdBoard);
      onOpenChange?.(false);

      // reset
      setStep(1);
      setBoardData({
        name: '',
        key: '',
        type: 'tasks',
        template: 'kanban-basic',
        allowed_roles: ['admin'],
        description: '',
        settings: {
          assignee_enabled: true,
          due_dates_enabled: true,
          priority_enabled: true,
          tags_enabled: true,
        },
      });
      setColumns([]);
    } catch (error) {
      const resp = error?.response;
      const msg = resp?.data?.error || resp?.data?.message || error?.message || 'Failed to create board';
      toast.error(msg);
      // подробно логируем для дебага
      console.error('Board creation error:', {
        status: resp?.status,
        statusText: resp?.statusText,
        data: resp?.data,
        payloadTried: {
          ...{
            name: boardData.name,
            key: String(boardData.key).toUpperCase(),
            type: boardData.type,
            template: mapTemplateForBackend(boardData.template),
            allowedRoles: boardData.allowed_roles.map(r => String(r).toLowerCase()),
          },
        },
      });
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Basic Information</h3>
        <div className="space-y-4">
          <div>
            <Label htmlFor="board-name" className="text-gray-700 dark:text-white">Board Name *</Label>
            <Input
              id="board-name"
              value={boardData.name}
              onChange={(e) => {
                const name = e.target.value;
                setBoardData(prev => ({
                  ...prev,
                  name,
                  key: prev.key || name.toUpperCase().replace(/\s+/g, '').slice(0, 10),
                }));
              }}
              placeholder="e.g., Marketing Tasks"
              className="mt-1 dark:bg-gray-400 dark:border-gray-300 dark:text-white dark:placeholder-gray-200"
            />
          </div>

          <div>
            <Label htmlFor="board-key" className="text-gray-700 dark:text-white">Board Key *</Label>
            <Input
              id="board-key"
              value={boardData.key}
              onChange={(e) => setBoardData(prev => ({ ...prev, key: e.target.value.toUpperCase() }))}
              placeholder="e.g., MARK"
              maxLength={10}
              className="mt-1 dark:bg-gray-400 dark:border-gray-300 dark:text-white dark:placeholder-gray-200"
            />
            <p className="text-xs text-gray-500 dark:text-gray-200 mt-1">
              Unique identifier for this board (max 10 characters)
            </p>
          </div>

          <div>
            <Label htmlFor="board-description" className="text-gray-700 dark:text-white">Description</Label>
            <Textarea
              id="board-description"
              value={boardData.description}
              onChange={(e) => setBoardData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe what this board is for..."
              rows={3}
              className="mt-1 dark:bg-gray-400 dark:border-gray-300 dark:text-white dark:placeholder-gray-200"
            />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Board Type</h3>
        <div className="grid grid-cols-1 gap-3">
          {boardTypes.map(type => (
            <Card
              key={type.value}
              className={`cursor-pointer transition-all dark:bg-gray-500 dark:border-gray-400 ${
                boardData.type === type.value
                  ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-800/30'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-400'
              }`}
              onClick={() => setBoardData(prev => ({ ...prev, type: type.value }))}
            >
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">{type.icon}</span>
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">{type.label}</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-200">{type.description}</p>
                  </div>
                  {boardData.type === type.value && <CheckCircle className="w-5 h-5 text-blue-600 ml-auto" />}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Choose Template</h3>
        <div className="grid grid-cols-1 gap-3">
          {templates.map(template => (
            <Card
              key={template.value}
              className={`cursor-pointer transition-all dark:bg-gray-500 dark:border-gray-400 ${
                boardData.template === template.value
                  ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-800/30'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-400'
              }`}
              onClick={() => handleTemplateSelect(template.value)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">{template.label}</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-200 mb-2">{template.description}</p>
                    <div className="flex flex-wrap gap-1">
                      {template.columns?.length ? (
                        template.columns.map((col, i) => (
                          <Badge key={i} variant="outline" className="text-xs dark:border-gray-300 dark:text-white">
                            {col.name}
                          </Badge>
                        ))
                      ) : (
                        <Badge variant="outline" className="text-xs dark:border-gray-300 dark:text-white">
                          No columns
                        </Badge>
                      )}
                    </div>
                  </div>
                  {boardData.template === template.value && <CheckCircle className="w-5 h-5 text-blue-600" />}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Access Control</h3>
        <div>
          <Label className="text-sm font-medium text-gray-700 dark:text-white">Allowed Roles *</Label>
          <div className="flex flex-wrap gap-2 mt-2">
            {availableRoles.map(role => (
              <Badge
                key={role}
                variant={boardData.allowed_roles.includes(role) ? 'default' : 'outline'}
                className={`cursor-pointer ${
                  boardData.allowed_roles.includes(role)
                    ? 'bg-blue-600 text-white'
                    : 'border-gray-300 dark:border-gray-300 dark:text-white dark:hover:bg-gray-400'
                }`}
                onClick={() => toggleRole(role)}
              >
                {role}
              </Badge>
            ))}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-200 mt-1">Select which roles can access this board</p>
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Customize Columns</h3>
        <div className="space-y-3">
          {columns.map((column, index) => (
            <div key={index} className="flex items-center space-x-2 p-3 border rounded dark:border-gray-400 bg-gray-50 dark:bg-gray-500">
              <span className="text-sm font-medium w-8 text-gray-900 dark:text-white">{index + 1}.</span>
              <Input
                value={column.name}
                onChange={(e) => updateColumn(index, 'name', e.target.value)}
                placeholder="Column name"
                className="flex-1 dark:bg-gray-400 dark:border-gray-300 dark:text-white dark:placeholder-gray-200"
              />
              <Input
                value={column.key}
                onChange={(e) => updateColumn(index, 'key', e.target.value.toUpperCase())}
                placeholder="KEY"
                className="w-24 dark:bg-gray-400 dark:border-gray-300 dark:text-white dark:placeholder-gray-200"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeColumn(index)}
                className="text-red-600 dark:text-red-300 hover:text-red-700 dark:hover:text-red-200"
              >
                ✕
              </Button>
            </div>
          ))}

          <Button
            onClick={addColumn}
            variant="outline"
            className="w-full dark:bg-gray-500 dark:border-gray-400 dark:text-white dark:hover:bg-gray-400"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Column
          </Button>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Review</h3>
        <div className="bg-gray-50 dark:bg-gray-500 p-4 rounded-lg space-y-2 text-sm">
          <div className="text-gray-900 dark:text-white"><strong>Name:</strong> {boardData.name}</div>
          <div className="text-gray-900 dark:text-white"><strong>Key:</strong> {boardData.key}</div>
          <div className="text-gray-900 dark:text-white"><strong>Type:</strong> {boardTypes.find(t => t.value === boardData.type)?.label}</div>
          <div className="text-gray-900 dark:text-white"><strong>Template:</strong> {templates.find(t => t.value === boardData.template)?.label}</div>
          <div className="text-gray-900 dark:text-white"><strong>Roles:</strong> {boardData.allowed_roles.join(', ')}</div>
          <div className="text-gray-900 dark:text-white"><strong>Columns:</strong> {columns.length} columns</div>
        </div>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-white dark:bg-gray-600 border dark:border-gray-400">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2 text-gray-900 dark:text-white">
            <Kanban className="w-6 h-6" />
            <span>Create New Board</span>
          </DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center space-x-4 mb-6">
          {[1, 2, 3].map(stepNumber => (
            <div key={stepNumber} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step >= stepNumber ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-400 text-gray-600 dark:text-white'
              }`}>
                {stepNumber}
              </div>
              {stepNumber < 3 && (
                <div className={`w-12 h-0.5 mx-2 ${step > stepNumber ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-400'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}

        {/* Navigation */}
        <div className="flex justify-between pt-6 border-t dark:border-gray-400">
          <Button
            variant="outline"
            onClick={() => setStep(prev => Math.max(1, prev - 1))}
            disabled={step === 1}
            className="dark:bg-gray-500 dark:border-gray-400 dark:text-white dark:hover:bg-gray-400"
          >
            Previous
          </Button>

          {step < 3 ? (
            <Button
              onClick={() => setStep(prev => prev + 1)}
              disabled={(step === 1 && (!boardData.name || !boardData.key)) || (step === 2 && boardData.allowed_roles.length === 0)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Next
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={handleCreateBoard} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white">
              {loading ? 'Creating...' : 'Create Board'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateBoard;