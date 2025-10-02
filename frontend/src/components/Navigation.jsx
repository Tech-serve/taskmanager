import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from './ui/button';
import { useTheme } from '../contexts/ThemeContext';
import { 
  LayoutDashboard, 
  User, 
  LogOut, 
  Kanban,
  Users,
  Settings,
  Moon,
  Sun,
  BarChart3
} from 'lucide-react';
import AdminSettings from './AdminSettings';

const Navigation = ({ user, onLogout }) => {
  const location = useLocation();
  const [showAdminSettings, setShowAdminSettings] = useState(false);
  const { theme, toggleTheme } = useTheme();

  const isActive = (path) => location.pathname === path;

  const getRoleColor = (roles) => {
    if (roles.includes('admin')) return 'from-violet-600 to-purple-600';
    if (roles.includes('main_admin')) return 'from-amber-600 to-orange-600';
    if (roles.includes('lead')) return 'from-cyan-600 to-teal-600';
    if (roles.includes('buyer')) return 'from-emerald-600 to-green-600';
    if (roles.includes('designer')) return 'from-rose-600 to-pink-600';
    if (roles.includes('tech')) return 'from-blue-600 to-indigo-600';
    return 'from-gray-600 to-slate-600';
  };

  const getRoleBadgeColor = (role) => {
    const colors = {
      admin: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200',
      main_admin: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
      lead: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-200',
      buyer: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
      designer: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200',
      tech: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200'
    };
    return colors[role] || 'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-200';
  };

  const navigationItems = [
    { 
      path: '/boards', 
      label: 'Boards', 
      icon: LayoutDashboard, 
      testId: 'nav-boards' 
    },
    { 
      path: '/me', 
      label: 'Personal Cabinet', 
      icon: User, 
      testId: 'nav-me' 
    }
  ];

  // Add expenses dashboard for main_admin and admin users
  if (user.roles.includes('main_admin') || user.roles.includes('admin')) {
    navigationItems.push({
      path: '/dashboard/expenses',
      label: 'Expenses Dashboard',
      icon: BarChart3,
      testId: 'nav-expenses-dashboard'
    });
  }

  return (
    <div className="w-52 bg-white/90 dark:bg-gray-700/95 backdrop-blur-md border-r border-gray-200 dark:border-gray-600 flex flex-col shadow-lg transition-colors duration-300">
      {/* Logo and Brand */}
      <div className="p-4 border-b border-gray-100 dark:border-gray-600">
        <div className="flex items-center space-x-2">
          <div className={`w-8 h-8 bg-gradient-to-br ${getRoleColor(user.roles)} rounded-lg flex items-center justify-center shadow-lg`}>
            <Kanban className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Jira Board</h1>
            <p className="text-xs text-gray-500 dark:text-gray-300">Project Management</p>
          </div>
        </div>
      </div>

      {/* User Profile */}
      <div className="p-3 border-b border-gray-100 dark:border-gray-600">
        <div className="flex items-center space-x-2 mb-2">
          <div className={`w-9 h-9 bg-gradient-to-br ${getRoleColor(user.roles)} rounded-full flex items-center justify-center text-white font-bold shadow-lg text-sm`}>
            {user.full_name.split(' ').map(n => n[0]).join('').toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900 dark:text-gray-100 truncate text-sm" data-testid="user-full-name">
              {user.full_name}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-300 truncate" data-testid="user-email">
              {user.email}
            </p>
          </div>
        </div>
        
        {/* Role Badges */}
        <div className="flex flex-wrap gap-1">
          {user.roles.map((role) => (
            <span
              key={role}
              className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${getRoleBadgeColor(role)}`}
              data-testid={`user-role-${role}`}
            >
              {role}
            </span>
          ))}
        </div>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 px-2 py-3 space-y-1">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center space-x-2 px-2 py-2 rounded-lg transition-all duration-200 text-sm ${
                isActive(item.path)
                  ? 'bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 text-blue-700 dark:text-blue-300 shadow-sm'
                  : 'text-gray-600 dark:text-gray-200 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-600/50'
              }`}
              data-testid={item.testId}
            >
              <Icon className={`w-4 h-4 ${isActive(item.path) ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-400'}`} />
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Settings and Logout */}
      <div className="border-t border-gray-100 dark:border-gray-600 p-3 space-y-1">
        {/* Only show Settings for admin users */}
        {user.roles.includes('admin') && (
          <Button
            variant="ghost"
            onClick={() => setShowAdminSettings(true)}
            className="w-full justify-start text-gray-600 dark:text-gray-200 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-600/50 text-sm"
            data-testid="nav-settings-button"
          >
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>
        )}
        
        <Button
          variant="ghost"
          onClick={onLogout}
          className="w-full justify-start text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 text-sm"
          data-testid="nav-logout-button"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Logout
        </Button>
      </div>

      {/* Admin Settings Dialog */}
      <AdminSettings 
        open={showAdminSettings} 
        onClose={() => setShowAdminSettings(false)}
        user={user}
      />
    </div>
  );
};

export default Navigation;