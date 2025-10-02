import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { useTheme } from '../contexts/ThemeContext';
import { tasksAPI } from '../lib/api';
import { toast } from 'sonner';
import { 
  User, 
  Mail, 
  Shield, 
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  Settings,
  Bell,
  Globe,
  Target,
  TrendingUp,
  Moon,
  Sun,
  Image,
  Camera
} from 'lucide-react';

const PersonalCabinet = ({ user }) => {
  const [myTasks, setMyTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAvatar, setSelectedAvatar] = useState('default');
  const [settings, setSettings] = useState({
    timezone: 'UTC',
    emailNotifications: true
  });
  const { theme, toggleTheme } = useTheme();

  // Available avatar options
  const avatarOptions = [
    { id: 'default', emoji: '👤', label: 'Default' },
    { id: 'smiley', emoji: '😀', label: 'Smiley' },
    { id: 'cool', emoji: '😎', label: 'Cool' },
    { id: 'thinking', emoji: '🤔', label: 'Thinking' },
    { id: 'star', emoji: '⭐', label: 'Star' },
    { id: 'rocket', emoji: '🚀', label: 'Rocket' },
    { id: 'fire', emoji: '🔥', label: 'Fire' },
    { id: 'heart', emoji: '❤️', label: 'Heart' },
    { id: 'lightning', emoji: '⚡', label: 'Lightning' },
    { id: 'trophy', emoji: '🏆', label: 'Trophy' },
    { id: 'crown', emoji: '👑', label: 'Crown' },
    { id: 'diamond', emoji: '💎', label: 'Diamond' }
  ];

  useEffect(() => {
    fetchMyTasks();
    // Load saved avatar from localStorage
    const savedAvatar = localStorage.getItem('user-avatar');
    if (savedAvatar) {
      setSelectedAvatar(savedAvatar);
    }
  }, []);

  const getRoleColor = (role) => {
    const colors = {
      admin: 'from-violet-600 to-purple-600',
      buyer: 'from-emerald-600 to-green-600',
      designer: 'from-rose-600 to-pink-600',
      tech: 'from-blue-600 to-indigo-600'
    };
    return colors[role] || 'from-gray-600 to-slate-600';
  };

  const getAvatarDisplay = () => {
    const avatar = avatarOptions.find(a => a.id === selectedAvatar);
    if (avatar && avatar.id !== 'default') {
      return (
        <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-600 dark:to-gray-700 rounded-full flex items-center justify-center text-3xl shadow-lg border-2 border-white dark:border-gray-500">
          {avatar.emoji}
        </div>
      );
    }
    
    // Default avatar with initials
    return (
      <div className={`w-20 h-20 bg-gradient-to-br ${getRoleColor(user.roles[0])} rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg border-2 border-white dark:border-gray-500`}>
        {user.full_name.split(' ').map(n => n[0]).join('').toUpperCase()}
      </div>
    );
  };

  const handleAvatarChange = (avatarId) => {
    setSelectedAvatar(avatarId);
    localStorage.setItem('user-avatar', avatarId);
    toast.success('Avatar updated successfully');
  };

  const fetchMyTasks = async () => {
    try {
      const response = await tasksAPI.getMyTasks();
      setMyTasks(response.data);
    } catch (error) {
      toast.error('Failed to load your tasks');
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadgeColor = (role) => {
    const colors = {
      admin: 'bg-violet-100 text-violet-800',
      buyer: 'bg-emerald-100 text-emerald-800',
      designer: 'bg-rose-100 text-rose-800',
      tech: 'bg-blue-100 text-blue-800'
    };
    return colors[role] || 'bg-gray-100 text-gray-800';
  };

  const getPriorityColor = (priority) => {
    const colors = {
      high: 'bg-red-100 text-red-800 border-red-200',
      medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      low: 'bg-green-100 text-green-800 border-green-200'
    };
    return colors[priority] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getTaskStats = () => {
    const total = myTasks.length;
    const highPriority = myTasks.filter(t => t.priority === 'high').length;
    const overdue = myTasks.filter(t => {
      if (!t.due_date) return false;
      return new Date(t.due_date) < new Date();
    }).length;

    return { total, highPriority, overdue };
  };

  const stats = getTaskStats();

  return (
    <div className="p-8 max-w-7xl mx-auto bg-white dark:bg-gray-900 min-h-screen transition-colors duration-300">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2" data-testid="personal-cabinet-title">
          Personal Cabinet
        </h1>
        <p className="text-gray-600 dark:text-gray-300">Manage your profile, tasks, and settings</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Profile & Settings */}
        <div className="space-y-6">
          {/* Profile Card */}
          <Card className="glass border-0 shadow-lg bg-white dark:bg-gray-800 border dark:border-gray-700">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-gray-900 dark:text-gray-100">
                <User className="w-5 h-5 text-blue-600" />
                <span>Profile</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Avatar and Basic Info */}
              <div className="flex items-center space-x-4">
                {getAvatarDisplay()}
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100" data-testid="profile-full-name">
                    {user.full_name}
                  </h3>
                  <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-300 mt-1">
                    <Mail className="w-4 h-4" />
                    <span className="text-sm" data-testid="profile-email">{user.email}</span>
                  </div>
                </div>
              </div>

              {/* Avatar Selection */}
              <div>
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-200 flex items-center space-x-2 mb-3">
                  <Camera className="w-4 h-4" />
                  <span>Choose Avatar</span>
                </Label>
                <div className="grid grid-cols-6 gap-2">
                  {avatarOptions.map((avatar) => (
                    <button
                      key={avatar.id}
                      onClick={() => handleAvatarChange(avatar.id)}
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-lg border-2 transition-all hover:scale-110 ${
                        selectedAvatar === avatar.id
                          ? 'border-blue-500 ring-2 ring-blue-500/20'
                          : 'border-gray-300 dark:border-gray-600 hover:border-blue-300'
                      } ${
                        avatar.id === 'default'
                          ? `bg-gradient-to-br ${getRoleColor(user.roles[0])} text-white text-xs font-bold`
                          : 'bg-gray-100 dark:bg-gray-700'
                      }`}
                      title={avatar.label}
                      data-testid={`avatar-option-${avatar.id}`}
                    >
                      {avatar.id === 'default' 
                        ? user.full_name.split(' ').map(n => n[0]).join('').toUpperCase()
                        : avatar.emoji
                      }
                    </button>
                  ))}
                </div>
              </div>

              {/* Roles */}
              <div>
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-200 flex items-center space-x-2 mb-3">
                  <Shield className="w-4 h-4" />
                  <span>Roles</span>
                </Label>
                <div className="flex flex-wrap gap-2">
                  {user.roles.map((role) => (
                    <Badge 
                      key={role} 
                      className={`${getRoleBadgeColor(role)} dark:bg-opacity-20 dark:text-gray-200`}
                      data-testid={`profile-role-${role}`}
                    >
                      {role}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Member Since */}
              <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-300">
                <Calendar className="w-4 h-4" />
                <span>Member since {new Date(user.created_at).toLocaleDateString()}</span>
              </div>
            </CardContent>
          </Card>

          {/* Settings Card */}
          <Card className="glass border-0 shadow-lg bg-white dark:bg-gray-800 border dark:border-gray-700">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-gray-900 dark:text-gray-100">
                <Settings className="w-5 h-5 text-blue-600" />
                <span>Settings</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Theme Toggle */}
              <div className="flex items-center justify-between">
                <Label htmlFor="theme-toggle" className="text-sm font-medium text-gray-700 dark:text-gray-200 flex items-center space-x-2">
                  {theme === 'light' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                  <span>Dark Theme</span>
                </Label>
                <Switch
                  id="theme-toggle"
                  checked={theme === 'dark'}
                  onCheckedChange={toggleTheme}
                  data-testid="theme-toggle-switch"
                />
              </div>

              <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white" variant="outline" data-testid="save-settings-button">
                Save Settings
              </Button>
            </CardContent>
          </Card>

          {/* Task Stats */}
          <Card className="glass border-0 shadow-lg bg-white dark:bg-gray-800 border dark:border-gray-700">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-gray-900 dark:text-gray-100">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                <span>Task Statistics</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600" data-testid="stats-total-tasks">
                    {stats.total}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-300">Total Tasks</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600" data-testid="stats-high-priority">
                    {stats.highPriority}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-300">High Priority</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600" data-testid="stats-overdue">
                    {stats.overdue}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-300">Overdue</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - My Tasks */}
        <div className="lg:col-span-2">
          <Card className="glass border-0 shadow-lg h-full bg-white dark:bg-gray-800 border dark:border-gray-700">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-gray-900 dark:text-gray-100">
                <div className="flex items-center space-x-2">
                  <Target className="w-5 h-5 text-blue-600" />
                  <span>My Tasks</span>
                  <Badge variant="outline" className="ml-2 dark:border-gray-500 dark:text-gray-200" data-testid="my-tasks-count">
                    {myTasks.length}
                  </Badge>
                </div>
                <Button variant="outline" size="sm" className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-600" data-testid="refresh-tasks-button">
                  Refresh
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                    </div>
                  ))}
                </div>
              ) : myTasks.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No tasks assigned</h3>
                  <p className="text-gray-500 dark:text-gray-400">You don't have any tasks assigned to you at the moment.</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {myTasks.map((task) => (
                    <div 
                      key={task.id} 
                      className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:shadow-md transition-shadow bg-white/70 dark:bg-gray-700/50"
                      data-testid={`my-task-${task.id}`}
                    >
                      {/* Task Header */}
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-medium text-gray-900 dark:text-gray-100 flex-1" data-testid="my-task-title">
                          {task.title}
                        </h4>
                        <div className="flex items-center space-x-2">
                          {task.priority && (
                            <Badge className={`text-xs ${getPriorityColor(task.priority)}`}>
                              {task.priority}
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Task Description */}
                      {task.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-3 line-clamp-2">
                          {task.description}
                        </p>
                      )}

                      {/* Task Meta Info */}
                      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                        <div className="flex items-center space-x-4">
                          <span className="flex items-center space-x-1">
                            <span className="font-medium">Board:</span>
                            <span className="px-2 py-1 bg-gray-100 dark:bg-gray-600 rounded">{task.board_key}</span>
                          </span>
                          {task.due_date && (
                            <span className="flex items-center space-x-1">
                              <Calendar className="w-3 h-3" />
                              <span className={new Date(task.due_date) < new Date() ? 'text-red-600 dark:text-red-400' : ''}>
                                Due: {new Date(task.due_date).toLocaleDateString()}
                              </span>
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-1">
                          <Clock className="w-3 h-3" />
                          <span>Created: {new Date(task.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>

                      {/* Tags */}
                      {task.tags && task.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {task.tags.map((tag, index) => (
                            <Badge key={index} variant="outline" className="text-xs dark:border-gray-500 dark:text-gray-200">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PersonalCabinet;