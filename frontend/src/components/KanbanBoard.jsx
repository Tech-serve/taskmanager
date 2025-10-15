import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
// 🔧 добавил expensesAPI
import { boardsAPI, columnsAPI, tasksAPI, usersAPI, expensesAPI } from '../lib/api';
import { toast } from 'sonner';
import { 
  Plus, 
  Filter, 
  Search,
  Calendar,
  User,
  AlertCircle,
  Clock,
  MoreVertical,
  Settings,
  Edit
} from 'lucide-react';
import BoardSettings from './BoardSettings';
import { getCategoryDisplayName , CategorySelector } from './CategorySelector';
import { EXPENSE_CATEGORIES } from './CategorySelector';
import TaskModal from './TaskModal';

const KanbanBoard = ({ user }) => {
  const { boardKey } = useParams();
  const [board, setBoard] = useState(null);
  const [columns, setColumns] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [editTaskOpen, setEditTaskOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedTaskForView, setSelectedTaskForView] = useState(null);
  const [activeTask, setActiveTask] = useState(null);
  const [showBoardSettings, setShowBoardSettings] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    assignees: [],
    columns: [],
    priority: ''
  });

  // Filter tasks based on current filters
  const filterTasks = (tasks) => {
    return tasks.filter(task => {
      // Search filter - check title and description
      if (filters.search && filters.search.trim() !== '') {
        const searchTerm = filters.search.toLowerCase();
        const titleMatch = task.title.toLowerCase().includes(searchTerm);
        const descriptionMatch = task.description?.toLowerCase().includes(searchTerm);
        if (!titleMatch && !descriptionMatch) return false;
      }

      // Assignee filter
      if (filters.assignees.length > 0) {
        // Include unassigned tasks if "unassigned" is selected
        if (filters.assignees.includes('unassigned')) {
          if (!task.assignee_id && !filters.assignees.some(id => id !== 'unassigned')) {
            return true; // Only unassigned selected and task is unassigned
          } else if (task.assignee_id && !filters.assignees.includes(task.assignee_id)) {
            return false;
          }
        } else if (!task.assignee_id || !filters.assignees.includes(task.assignee_id)) {
          return false;
        }
      }

      // Priority filter
      if (filters.priority && task.priority !== filters.priority) {
        return false;
      }

      return true;
    });
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    if (boardKey) {
      fetchBoardData();
    }
  }, [boardKey]);

  const fetchBoardData = async () => {
    try {
      setLoading(true);
      
      // Fetch board info
      const boardResponse = await boardsAPI.getByKey(boardKey);
      setBoard(boardResponse.data);
      
      // Fetch columns
      const columnsResponse = await columnsAPI.getByBoardId(boardResponse.data.id);
      setColumns(columnsResponse.data);
      
      // 🔧 Fetch tasks с учётом типа доски
      await fetchTasks(boardResponse.data.type);
      
      // Fetch assignable users for this board
      try {
        const usersResponse = await usersAPI.getAssignableUsers(boardKey);
        setUsers(usersResponse.data);
      } catch (error) {
        // Fallback to all users if assignable users API fails
        try {
          const allUsersResponse = await usersAPI.getAll();
          setUsers(allUsersResponse.data);
        } catch (fallbackError) {
          console.log('Could not fetch users for assignee selection');
        }
      }
      
    } catch (error) {
      toast.error('Failed to load board data');
    } finally {
      setLoading(false);
    }
  };

  // 🔧 теперь принимает forceType и выбирает API по типу
  const fetchTasks = async (forceType) => {
    try {
      const params = {};
      
      // Only add filters if they have values
      if (filters.search && filters.search.trim()) {
        params.q = filters.search;
      }
      if (filters.columns && filters.columns.length > 0) {
        params.columns = filters.columns.join(',');
      }
      if (filters.assignees && filters.assignees.length > 0) {
        params.assignees = filters.assignees.join(',');
      }

      const boardType = (forceType || board?.type || 'tasks').toLowerCase();
      const apiForBoard = boardType === 'expenses' ? expensesAPI : tasksAPI;
      
      const response = await apiForBoard.getByBoard(boardKey, params);
      console.log('Fetched tasks:', response.data);
      setTasks(response.data);
    } catch (error) {
      console.error('Failed to load tasks:', error);
      toast.error('Failed to load tasks');
    }
  };

  const handleDragStart = (event) => {
    const { active } = event;
    const task = tasks.find(t => t.id === active.id);
    setActiveTask(task);
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    
    setActiveTask(null);
    
    if (!over) return;

    const taskId = active.id;
    const newColumnId = over.id;
    
    // Find the task and check if it's moving to a different column
    const task = tasks.find(t => t.id === taskId);
    if (!task || task.column_id === newColumnId) return;

    // Find the target column to check for cross-team routing
    const targetColumn = columns.find(c => c.id === newColumnId);
    const isToTech = targetColumn?.key === 'TO_TECH';
    const isToDesigners = targetColumn?.key === 'TO_DESIGNERS';

    // Optimistically update UI first
    setTasks(tasks.map(t => 
      t.id === taskId 
        ? { ...t, column_id: newColumnId }
        : t
    ));

    try {
      // 🔧 учитываем тип доски
      const apiForBoard = (board?.type === 'expenses') ? expensesAPI : tasksAPI;
      await apiForBoard.update(task.id, { column_id: newColumnId });
      
      // If it's cross-team routing, show special message and refresh after delay
      if (isToTech) {
        toast.success('Task routed to Tech team! It will appear on their board.');
        setTimeout(() => {
          setTasks(prevTasks => prevTasks.filter(t => t.id !== taskId));
        }, 2000);
      } else if (isToDesigners) {
        toast.success('Task routed to Design team! It will appear on their board.');
        setTimeout(() => {
          setTasks(prevTasks => prevTasks.filter(t => t.id !== taskId));
        }, 2000);
      } else {
        toast.success('Task moved successfully');
      }
      
      // Refresh tasks to get updated data
      setTimeout(() => {
        fetchTasks();
      }, 1000);
      
    } catch (error) {
      // Revert on error
      setTasks(tasks.map(t => 
        t.id === taskId 
          ? { ...t, column_id: task.column_id }
          : t
      ));
      toast.error('Failed to move task');
    }
  };

  const createTask = async (taskData) => {
    try {
      const newTask = await tasksAPI.create({
        ...taskData,
        board_key: boardKey
      });
      
      console.log('Task created:', newTask.data);
      
      // Add the new task to the current tasks list immediately
      setTasks(prevTasks => [...prevTasks, newTask.data]);
      
      // Also refresh from server to be sure
      await fetchTasks();
      setCreateTaskOpen(false);
      toast.success('Task created successfully');
    } catch (error) {
      console.error('Task creation error:', error);
      toast.error('Failed to create task: ' + (error.response?.data?.detail || 'Unknown error'));
    }
  };

  const editTask = async (taskData) => {
    try {
      await tasksAPI.update(selectedTask.id, taskData);
      
      await fetchTasks();
      setEditTaskOpen(false);
      setSelectedTask(null);
      toast.success('Task updated successfully');
    } catch (error) {
      toast.error('Failed to update task');
    }
  };

  const handleTaskClick = (task) => {
    setSelectedTaskForView(task);
  };

  const updateTaskAssignee = async (taskId, assigneeId) => {
    try {
      // 🔧 учитываем тип доски
      const apiForBoard = (board?.type === 'expenses') ? expensesAPI : tasksAPI;
      await apiForBoard.update(taskId, { assignee_id: assigneeId });
      setTasks(tasks.map(t => 
        t.id === taskId 
          ? { ...t, assignee_id: assigneeId }
          : t
      ));
      toast.success('Assignee updated');
    } catch (error) {
      toast.error('Failed to update assignee');
    }
  };

  const getPriorityColor = (priority) => {
    const colors = {
      high: 'bg-red-100 text-red-800 border-red-200',
      medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      low: 'bg-green-100 text-green-800 border-green-200'
    };
    return colors[priority] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getUserInitials = (user) => {
    if (!user || !user.full_name || typeof user.full_name !== 'string') {
      return '?';
    }
    return user.full_name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const getAssignedUser = (assigneeId) => {
    return users.find(u => u.id === assigneeId);
  };

  const getCreatorUser = (creatorId) => {
    return users.find(u => u.id === creatorId);
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded w-64"></div>
            <div className="flex space-x-4 overflow-x-auto">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex-shrink-0 w-80">
                  <div className="h-6 bg-gray-200 rounded mb-4"></div>
                  <div className="space-y-3">
                    {[1, 2].map((j) => (
                      <div key={j} className="h-24 bg-gray-200 rounded"></div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!board) {
    return (
      <div className="p-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Board not found</h2>
          <p className="text-gray-600">The requested board could not be found or you don't have access to it.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-600 bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm transition-colors duration-300">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100" data-testid="board-title">
              {board.name}
            </h1>
            <p className="text-gray-600 dark:text-gray-300 text-sm">Key: {board.key}</p>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="outline" 
              className="border-gray-300 dark:border-gray-500 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 text-sm"
              onClick={() => setShowFilters(!showFilters)}
              data-testid="board-filter-button"
            >
              <Filter className="w-3 h-3 mr-1" />
              Filter
            </Button>

            {/* Only show Settings for admin users */}
            {user && user.roles && user.roles.includes('admin') && (
              <Button
                variant="outline" 
                className="border-gray-300 dark:border-gray-500 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 text-sm"
                onClick={() => setShowBoardSettings(true)}
                data-testid="board-settings-button"
              >
                <Settings className="w-3 h-3 mr-1" />
                Settings
              </Button>
            )}
            
           {/* Create Task — используем ровно тот же TaskModal */}
<Button
  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white text-sm"
  onClick={() => setCreateTaskOpen(true)}
  data-testid="create-task-button"
>
  <Plus className="w-3 h-3 mr-1" />
  Create Task
</Button>

<TaskModal
  task={null}                          // режим создания
  isOpen={createTaskOpen}
  onClose={() => setCreateTaskOpen(false)}
  users={users}
  onTaskUpdate={async () => {          // после создания обновляем доску и закрываем
    await fetchTasks();
    setCreateTaskOpen(false);
  }}
  boardType={board?.type || 'tasks'}
  defaultBoardKey={board.key}          // чтобы в форме не спрашивать ключ
  defaultColumnId={columns?.[0]?.id || ''} // по умолчанию первая колонка
/>

            {/* View Task Modal */}
            <TaskModal
              task={selectedTaskForView}
              isOpen={!!selectedTaskForView}
              onClose={() => setSelectedTaskForView(null)}
              users={users}
              onTaskUpdate={fetchTasks}
              boardType={board?.type || 'tasks'}
            />

            {/* Edit Task Dialog */}
            <Dialog open={editTaskOpen} onOpenChange={setEditTaskOpen}>
              <DialogContent className="max-w-md bg-white dark:bg-gray-600 border dark:border-gray-400">
                <DialogHeader>
                  <DialogTitle className="text-gray-900 dark:text-white">Edit Task</DialogTitle>
                </DialogHeader>
                <TaskForm 
                  columns={columns} 
                  users={users}
                  onSubmit={editTask}
                  boardSettings={board.settings}
                  initialData={selectedTask}
                  isEditing={true}
                  boardType={board?.type || 'tasks'}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>
        
        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="w-3 h-3 absolute left-2 top-2.5 text-gray-400" />
          <Input
            placeholder="Search tasks..."
            value={filters.search}
            onChange={(e) => setFilters({...filters, search: e.target.value})}
            className="pl-8 bg-white/70 dark:bg-gray-800/70 dark:text-gray-200 text-sm h-8"
            data-testid="task-search-input"
          />
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-4 py-3 transition-colors duration-300">
          <div className="flex flex-wrap gap-3 items-center">
            {/* Search */}
            <div className="flex items-center space-x-2 min-w-0 flex-1 max-w-md">
              <Search className="w-3 h-3 text-gray-400" />
              <Input
                placeholder="Search tasks..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-200 text-sm h-8"
                data-testid="task-search-input"
              />
            </div>

            {/* Assignee Filter */}
            <div className="flex items-center space-x-2">
              <User className="w-4 h-4 text-gray-400" />
              <div className="relative">
                <Button
                  variant="outline"
                  className="min-w-40 justify-start text-left"
                  onClick={() => {
                    const dropdown = document.getElementById('assignee-dropdown');
                    dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
                  }}
                >
                  {filters.assignees.length === 0 
                    ? 'All Assignees' 
                    : `${filters.assignees.length} selected`}
                </Button>
                <div 
                  id="assignee-dropdown" 
                  className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg z-10 min-w-48"
                  style={{ display: 'none' }}
                >
                  <div className="p-2 max-h-48 overflow-y-auto">
                    <label className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filters.assignees.includes('unassigned')}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFilters({ ...filters, assignees: [...filters.assignees, 'unassigned'] });
                          } else {
                            setFilters({ ...filters, assignees: filters.assignees.filter(id => id !== 'unassigned') });
                          }
                        }}
                        className="rounded"
                      />
                      <span className="flex items-center space-x-2">
                        <div className="w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center text-xs text-white">
                          ?
                        </div>
                        <span>Unassigned</span>
                      </span>
                    </label>
                    {users.map(user => (
                      <label key={user.id} className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={filters.assignees.includes(user.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFilters({ ...filters, assignees: [...filters.assignees, user.id] });
                            } else {
                              setFilters({ ...filters, assignees: filters.assignees.filter(id => id !== user.id) });
                            }
                          }}
                          className="rounded"
                        />
                        <span className="flex items-center space-x-2">
                          <div className="w-6 h-6 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-xs text-white font-bold">
                            {getUserInitials(user)}
                          </div>
                          <span>{user.full_name}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Priority Filter */}
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-gray-400" />
              <select 
                value={filters.priority}
                onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
                className="border border-gray-300 rounded-md px-3 py-1 bg-white"
                data-testid="priority-filter"
              >
                <option value="">All Priorities</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            {/* Clear Filters */}
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setFilters({ search: '', assignees: [], columns: [], priority: '' })}
              className="text-gray-600 hover:text-gray-800"
              data-testid="clear-filters"
            >
              Clear All
            </Button>

            {/* Active Filter Count */}
            {(filters.search || filters.assignees.length > 0 || filters.priority) && (
              <span className="text-sm text-blue-600 font-medium">
                {[
                  filters.search && 'search',
                  filters.assignees.length > 0 && `${filters.assignees.length} assignee(s)`,
                  filters.priority && 'priority'
                ].filter(Boolean).join(', ')} active
              </span>
            )}
          </div>
        </div>
      )}

      {/* Kanban Board */}
      <div className="flex-1 overflow-auto p-4">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex space-x-4 min-w-max">
            {columns.map((column) => (
              <DroppableColumn 
                key={column.id} 
                column={column} 
                tasks={filterTasks(tasks)}
                users={users}
                onUpdateAssignee={updateTaskAssignee}
                onTaskClick={handleTaskClick}
                getPriorityColor={getPriorityColor}
                getUserInitials={getUserInitials}
                getAssignedUser={getAssignedUser}
                boardSettings={board.settings}
                boardType={board?.type || 'tasks'}
                setSelectedTask={setSelectedTask}
                setEditTaskOpen={setEditTaskOpen}
              />
            ))}
          </div>
          
          <DragOverlay>
            {activeTask ? (
              <div className="task-card rounded-lg p-3 bg-white dark:bg-gray-800 shadow-2xl">
                <TaskCard 
                  task={activeTask} 
                  assignedUser={getAssignedUser(activeTask.assignee_id)}
                  users={users}
                  onUpdateAssignee={updateTaskAssignee}
                  getPriorityColor={getPriorityColor}
                  getUserInitials={getUserInitials}
                  boardSettings={board.settings}
                  setSelectedTask={setSelectedTask}
                  setEditTaskOpen={setEditTaskOpen}
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Board Settings Modal */}
      {showBoardSettings && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <BoardSettings 
              board={board} 
              onUpdate={(updatedBoard) => {
                setBoard(updatedBoard);
                setShowBoardSettings(false);
              }}
              onClose={() => setShowBoardSettings(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

// Droppable Column Component
const DroppableColumn = ({ column, tasks, users, onUpdateAssignee, onTaskClick, getPriorityColor, getUserInitials, getAssignedUser, boardSettings, boardType = 'tasks', setSelectedTask, setEditTaskOpen }) => {
  const columnTasks = tasks.filter(task => task.column_id === column.id);
  
  // Calculate total amount for expense boards
  const totalAmount = boardType === 'expenses' 
    ? columnTasks.reduce((sum, task) => sum + (task.amount || 0), 0)
    : 0;
  
  console.log(`Column ${column.name} has ${columnTasks.length} tasks:`, columnTasks);
  
  return (
    <div className="flex-shrink-0 w-64">
      <div className="board-column rounded-lg p-3 h-full bg-white/50 dark:bg-gray-700/60 backdrop-blur-sm transition-colors duration-300 border dark:border-gray-600">
        <div className="mb-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm" data-testid={`column-title-${column.key.toLowerCase()}`}>
              {column.name}
            </h3>
            <Badge variant="outline" className="text-xs dark:border-gray-500 dark:text-gray-200 bg-gray-50 dark:bg-gray-600/50">
              {columnTasks.length}
            </Badge>
          </div>
          
          {/* Show total amount for expense boards */}
          {boardType === 'expenses' && (
            <div className="bg-green-50 dark:bg-green-800/30 border border-green-200 dark:border-green-600 rounded-md p-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-green-700 dark:text-green-200">Итого:</span>
                <span className="text-sm font-bold text-green-800 dark:text-green-100" data-testid={`column-total-${column.key.toLowerCase()}`}>
                  ${totalAmount.toLocaleString()}
                </span>
              </div>
            </div>
          )}
        </div>
        
        <DroppableArea 
          columnId={column.id} 
          tasks={columnTasks}
          users={users}
          onUpdateAssignee={onUpdateAssignee}
          onTaskClick={onTaskClick}
          getPriorityColor={getPriorityColor}
          getUserInitials={getUserInitials}
          getAssignedUser={getAssignedUser}
          boardSettings={boardSettings}
          setSelectedTask={setSelectedTask}
          setEditTaskOpen={setEditTaskOpen}
        />
      </div>
    </div>
  );
};

// Droppable Area Component
const DroppableArea = ({ columnId, tasks, users, onUpdateAssignee, onTaskClick, getPriorityColor, getUserInitials, getAssignedUser, boardSettings, setSelectedTask, setEditTaskOpen }) => {
  const {
    setNodeRef,
    isOver
  } = useDroppable({
    id: columnId,
  });

  return (
    <div 
      ref={setNodeRef}
      className={`space-y-2 min-h-[150px] p-2 rounded-lg transition-colors ${
        isOver ? 'bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-300 dark:border-blue-600 border-dashed' : ''
      }`}
    >
      {tasks.map((task) => (
        <DraggableTask 
          key={task.id} 
          task={task}
          users={users}
          onUpdateAssignee={onUpdateAssignee}
          onTaskClick={onTaskClick}
          getPriorityColor={getPriorityColor}
          getUserInitials={getUserInitials}
          getAssignedUser={getAssignedUser}
          boardSettings={boardSettings}
          setSelectedTask={setSelectedTask}
          setEditTaskOpen={setEditTaskOpen}
        />
      ))}
    </div>
  );
};

// Draggable Task Component
const DraggableTask = ({ task, users, onUpdateAssignee, onTaskClick, getPriorityColor, getUserInitials, getAssignedUser, boardSettings, setSelectedTask, setEditTaskOpen }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useDraggable({ 
    id: task.id,
    data: {
      type: 'task',
      task
    }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Handle task click separately from drag
  const handleTaskClick = (e) => {
    // Only allow task click if not dragging and click target is the card itself
    if (!isDragging && (e.target.closest('.task-card-content'))) {
      e.stopPropagation();
      onTaskClick(task);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={`group task-card rounded-lg p-3 cursor-grab active:cursor-grabbing bg-white dark:bg-gray-700 border dark:border-gray-600 transition-colors duration-300 ${
        isDragging ? 'opacity-50 shadow-2xl z-50' : 'shadow-sm hover:shadow-md dark:shadow-gray-900/20'
      }`}
      data-testid={`task-card-${task.id}`}
    >
      {/* Drag handle area */}
      <div {...listeners} className="drag-handle w-full">
        <div className="task-card-content" onClick={handleTaskClick}>
          <TaskCard 
            task={task}
            assignedUser={getAssignedUser(task.assignee_id)}
            users={users}
            onUpdateAssignee={onUpdateAssignee}
            onTaskClick={onTaskClick}
            getPriorityColor={getPriorityColor}
            getUserInitials={getUserInitials}
            boardSettings={boardSettings}
            setSelectedTask={setSelectedTask}
            setEditTaskOpen={setEditTaskOpen}
          />
        </div>
      </div>
    </div>
  );
};

// Task Card Component
const TaskCard = ({ task, assignedUser, users, onUpdateAssignee, onTaskClick, getPriorityColor, getUserInitials, boardSettings, setSelectedTask, setEditTaskOpen }) => {
  const [showAssigneeSelect, setShowAssigneeSelect] = useState(false);
  
  // Get creator information
  const creatorUser = users.find(u => u.id === task.creator_id);

  // Handle assignee change
  const handleAssigneeChange = (value) => {
    const assigneeId = value === 'unassigned' ? null : value;
    onUpdateAssignee(task.id, assigneeId);
    setShowAssigneeSelect(false);
  };

  return (
    <div className="space-y-3">
      {/* Priority and Title */}
      <div className="flex items-start justify-between">
        <h4 className="font-medium text-gray-900 dark:text-gray-100 text-sm leading-tight flex-1" data-testid="task-title">
          {task.title}
        </h4>
        <div className="ml-2 flex items-center space-x-1">
          {task.priority && (
            <Badge className={`text-xs ${getPriorityColor(task.priority)}`}>
              {task.priority}
            </Badge>
          )}
        </div>
      </div>

      {/* Amount for expense tasks */}
      {task.amount !== undefined && task.amount !== null && (
        <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-green-700 dark:text-green-200">Amount:</span>
            <span className="text-lg font-bold text-green-800 dark:text-green-100" data-testid="task-amount">
              ${task.amount.toLocaleString()}
            </span>
          </div>
        </div>
      )}

      {/* Category for expense tasks */}
      {task.category && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
          <span className="text-xs font-medium text-blue-700">
            {getCategoryDisplayName(task.category)}
          </span>
        </div>
      )}

      {/* Description */}
      {task.description && (
        <p className="text-sm text-gray-600 line-clamp-2" data-testid="task-description">
          {task.description}
        </p>
      )}

      {/* Creator Information */}
      {creatorUser && (
        <div className="flex items-center space-x-2 text-xs text-gray-500">
          <span className="font-medium">Created by:</span>
          <div className="flex items-center space-x-1">
            <div className="w-4 h-4 bg-gradient-to-br from-gray-400 to-gray-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
              {getUserInitials(creatorUser)}
            </div>
            <span>{creatorUser.full_name}</span>
          </div>
        </div>
      )}

      {/* Tags */}
      {task.tags && task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {task.tags.map((tag, index) => (
            <Badge key={index} variant="outline" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {/* Due Date */}
      {task.dueDate && (
        <div className="flex items-center space-x-1 text-xs text-gray-500">
          <Calendar className="w-3 h-3" />
          <span>{new Date(task.dueDate).toLocaleDateString()}</span>
        </div>
      )}

      {/* Footer with Assignee and Edit button */}
      <div className="flex items-center justify-between pt-2">
        {/* Assignee Section - Available for all users */}
        <div className="flex items-center space-x-2" data-no-drag>
            {showAssigneeSelect ? (
              <Select value={assignedUser?.id || 'unassigned'} onValueChange={(value) => handleAssigneeChange(value)}>
                <SelectTrigger className="w-32 h-6 text-xs dark:bg-gray-500 dark:border-gray-400 dark:text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="dark:bg-gray-600 dark:border-gray-500">
                  <SelectItem value="unassigned" className="dark:text-white dark:hover:bg-gray-500">Unassigned</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id} className="dark:text-white dark:hover:bg-gray-500">
                      {user.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : assignedUser ? (
              <div 
                className="flex items-center space-x-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 p-1 rounded"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAssigneeSelect(true);
                }}
              >
                <div className={`w-6 h-6 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm`}>
                  {getUserInitials(assignedUser)}
                </div>
                <span className="text-xs text-gray-600 dark:text-gray-300">
                  {assignedUser.full_name}
                </span>
              </div>
            ) : (
              <div 
                className="flex items-center space-x-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 p-1 rounded text-xs text-gray-500 dark:text-gray-400"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAssigneeSelect(true);
                }}
              >
                <div className="w-6 h-6 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                  ?
                </div>
                <span>Unassigned</span>
              </div>
            )}
        </div>

        {/* Edit Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onTaskClick(task, e);
          }}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 h-auto text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          data-no-drag
        >
          <Edit className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
};

// Task Form Component (for both create and edit)
const TaskForm = ({ columns, users, onSubmit, boardSettings, initialData = null, isEditing = false, boardType = 'tasks' }) => {
  const [formData, setFormData] = useState({
    title: initialData?.title || '',
    description: initialData?.description || '',
    priority: initialData?.priority || 'medium',
    column_id: initialData?.column_id || columns[0]?.id || '',
    assignee_id: initialData?.assignee_id || 'unassigned',
    dueDate: initialData?.dueDate || '',
    tags: initialData?.tags ? initialData.tags.join(', ') : '',
    amount: initialData?.amount || '',
    category: initialData?.category || '',
    mainCategory: initialData?.category?.split('.')[0] || '',
    subCategory: initialData?.category?.split('.')[1] || '',
    receiptUrl: initialData?.receiptUrl || ''
  });
  const [showCategorySelector, setShowCategorySelector] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const taskData = {
      title: formData.title,
      description: formData.description || '',
      priority: formData.priority || 'medium',
      column_id: formData.column_id,
      tags: formData.tags ? formData.tags.split(',').map(t => t.trim()) : []
    };

    // Only add assignee_id if selected and not 'unassigned'
    if (formData.assignee_id && formData.assignee_id !== 'unassigned') {
      taskData.assignee_id = formData.assignee_id;
    }

    // Only add amount if provided (for expense boards)
    if (formData.amount && formData.amount !== '') {
      taskData.amount = parseFloat(formData.amount);
    }

    // Only add due_date if provided
    if (formData.dueDate && formData.dueDate !== '') {
      taskData.due_date = formData.dueDate;
    }

    // Add category and receipt for expense boards
    if (boardType === 'expenses') {
      if (formData.category) {
        taskData.category = formData.category;
      }
      if (formData.receiptUrl) {
        taskData.receipt_url = formData.receiptUrl;
      }
    }
    
    onSubmit(taskData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="title" className="text-gray-700 dark:text-white">Title *</Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => setFormData({...formData, title: e.target.value})}
          required
          className="dark:bg-gray-400 dark:border-gray-300 dark:text-white dark:placeholder-gray-200"
          data-testid="task-title-input"
        />
      </div>

      <div>
        <Label htmlFor="description" className="text-gray-700 dark:text-white">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({...formData, description: e.target.value})}
          rows={3}
          className="dark:bg-gray-400 dark:border-gray-300 dark:text-white dark:placeholder-gray-200"
          data-testid="task-description-input"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="priority" className="text-gray-700 dark:text-white">Priority</Label>
          <Select value={formData.priority} onValueChange={(value) => setFormData({...formData, priority: value})}>
            <SelectTrigger data-testid="task-priority-select" className="dark:bg-gray-400 dark:border-gray-300 dark:text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="dark:bg-gray-500 dark:border-gray-400">
              <SelectItem value="low" className="dark:text-white dark:hover:bg-gray-400">Low</SelectItem>
              <SelectItem value="medium" className="dark:text-white dark:hover:bg-gray-400">Medium</SelectItem>
              <SelectItem value="high" className="dark:text-white dark:hover:bg-gray-400">High</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="column" className="text-gray-700 dark:text-white">Column</Label>
          <Select value={formData.column_id} onValueChange={(value) => setFormData({...formData, column_id: value})}>
            <SelectTrigger data-testid="task-column-select" className="dark:bg-gray-400 dark:border-gray-300 dark:text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="dark:bg-gray-500 dark:border-gray-400">
              {columns.map((column) => (
                <SelectItem key={column.id} value={column.id} className="dark:text-white dark:hover:bg-gray-400">
                  {column.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="assignee" className="text-gray-700 dark:text-white">Assignee</Label>
          <Select value={formData.assignee_id} onValueChange={(value) => setFormData({...formData, assignee_id: value})}>
            <SelectTrigger data-testid="task-assignee-select" className="dark:bg-gray-400 dark:border-gray-300 dark:text-white">
              <SelectValue placeholder="Select assignee" />
            </SelectTrigger>
            <SelectContent className="dark:bg-gray-500 dark:border-gray-400">
              <SelectItem value="unassigned" className="dark:text-white dark:hover:bg-gray-400">Unassigned</SelectItem>
              {users.map((user) => (
                <SelectItem key={user.id} value={user.id} className="dark:text-white dark:hover:bg-gray-400">
                  {user.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
      </div>

      <div className={`grid gap-4 ${boardType === 'expenses' ? 'grid-cols-3' : 'grid-cols-2'}`}>
        <div>
          <Label htmlFor="dueDate" className="text-gray-700 dark:text-white">Due Date</Label>
          <Input
            id="dueDate"
            type="date"
            value={formData.dueDate}
            onChange={(e) => setFormData({...formData, dueDate: e.target.value})}
            className="dark:bg-gray-400 dark:border-gray-300 dark:text-white"
            data-testid="task-due-date-input"
          />
        </div>

        <div>
          <Label htmlFor="tags" className="text-gray-700 dark:text-white">Tags (comma separated)</Label>
          <Input
            id="tags"
            value={formData.tags}
            onChange={(e) => setFormData({...formData, tags: e.target.value})}
            placeholder="tag1, tag2, tag3"
            className="dark:bg-gray-400 dark:border-gray-300 dark:text-white dark:placeholder-gray-200"
            data-testid="task-tags-input"
          />
        </div>

        {boardType === 'expenses' && (
          <div>
            <Label htmlFor="amount" className="text-gray-700 dark:text-white">Amount ($) *</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              value={formData.amount}
              onChange={(e) => setFormData({...formData, amount: e.target.value})}
              placeholder="0.00"
              className="dark:bg-gray-400 dark:border-gray-300 dark:text-white dark:placeholder-gray-200"
              data-testid="task-amount-input"
              required={boardType === 'expenses'}
            />
          </div>
        )}
      </div>

      {/* Category selectors for Expenses (inline, not modal) */}
      {boardType === 'expenses' && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-gray-700 dark:text-white">Main Category *</Label>
            <Select value={formData.mainCategory} onValueChange={(value) => {
              setFormData({...formData, mainCategory: value, subCategory: ''});
            }}>
              <SelectTrigger className="dark:bg-gray-400 dark:border-gray-300 dark:text-white">
                <SelectValue placeholder="Select main category..." />
              </SelectTrigger>
              <SelectContent className="dark:bg-gray-500 dark:border-gray-400">
                {Object.entries(EXPENSE_CATEGORIES).map(([key, category]) => (
                  <SelectItem key={key} value={key} className="dark:text-white dark:hover:bg-gray-400">
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-gray-700 dark:text-white">Subcategory *</Label>
            <Select 
              value={formData.subCategory} 
              onValueChange={(value) => {
                const categoryId = `${formData.mainCategory}.${value}`;
                setFormData({...formData, subCategory: value, category: categoryId});
              }}
              disabled={!formData.mainCategory}
            >
              <SelectTrigger className="dark:bg-gray-400 dark:border-gray-300 dark:text-white disabled:opacity-50">
                <SelectValue placeholder={formData.mainCategory ? "Select subcategory..." : "First select main category"} />
              </SelectTrigger>
              <SelectContent className="dark:bg-gray-500 dark:border-gray-400">
                {formData.mainCategory && EXPENSE_CATEGORIES[formData.mainCategory] && 
                  Object.entries(EXPENSE_CATEGORIES[formData.mainCategory].subcategories).map(([key, name]) => (
                    <SelectItem key={key} value={key} className="dark:text-white dark:hover:bg-gray-400">
                      {name}
                    </SelectItem>
                  ))
                }
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Receipt URL for expenses */}
      {boardType === 'expenses' && (
        <div>
          <Label htmlFor="receiptUrl" className="text-gray-700 dark:text-white">Receipt URL (optional)</Label>
          <Input
            id="receiptUrl"
            type="url"
            value={formData.receiptUrl}
            onChange={(e) => setFormData({...formData, receiptUrl: e.target.value})}
            placeholder="https://example.com/receipt.jpg"
            className="dark:bg-gray-400 dark:border-gray-300 dark:text-white dark:placeholder-gray-200"
            data-testid="receipt-url-input"
          />
        </div>
      )}

      <div className="flex justify-end space-x-3 pt-4 border-t dark:border-gray-400">
        <Button type="button" variant="outline" className="dark:bg-gray-500 dark:border-gray-400 dark:text-white dark:hover:bg-gray-400">
          Cancel
        </Button>
        <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white" data-testid="task-submit-button">
          {isEditing ? 'Update Task' : 'Create Task'}
        </Button>
      </div>

      {/* Category Selector Modal */}
      <CategorySelector
        open={showCategorySelector}
        onClose={() => setShowCategorySelector(false)}
        onSelect={(categoryId, categoryName) => {
          setFormData({...formData, category: categoryId});
        }}
      />
    </form>
  );
};

export default KanbanBoard;