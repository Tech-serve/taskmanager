import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import UserManagement from './UserManagement';
import { 
  Settings, 
  Users, 
  Shield, 
  Database,
  Bell,
  Palette,
  X
} from 'lucide-react';

const AdminSettings = ({ open, onClose, user }) => {
  const [activeTab, setActiveTab] = useState('users');

  const settingsItems = [
    {
      id: 'users',
      label: 'User Management',
      icon: Users,
      description: 'Manage users, roles, and permissions',
      component: UserManagement
    },
    {
      id: 'security',
      label: 'Security & Access',
      icon: Shield,
      description: 'Security settings and access controls',
      disabled: true
    },
    {
      id: 'system',
      label: 'System Settings',
      icon: Database,
      description: 'Database and system configuration',
      disabled: true
    },
    {
      id: 'notifications',
      label: 'Notifications',
      icon: Bell,
      description: 'Email and notification settings',
      disabled: true
    },
    {
      id: 'appearance',
      label: 'Appearance',
      icon: Palette,
      description: 'Theme and UI customization',
      disabled: true
    }
  ];

  const activeItem = settingsItems.find(item => item.id === activeTab);
  const ActiveComponent = activeItem?.component;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-hidden p-0">
        <div className="flex h-full">
          {/* Sidebar */}
          <div className="w-80 bg-gray-50 border-r border-gray-200 p-6">
            <DialogHeader className="mb-6">
              <DialogTitle className="flex items-center space-x-3 text-xl">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center">
                  <Settings className="w-5 h-5 text-white" />
                </div>
                <span>Admin Settings</span>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-2">
              {settingsItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => !item.disabled && setActiveTab(item.id)}
                    disabled={item.disabled}
                    className={`w-full text-left p-4 rounded-lg transition-all duration-200 ${
                      activeTab === item.id
                        ? 'bg-white shadow-sm ring-2 ring-indigo-500 ring-opacity-20'
                        : item.disabled
                        ? 'text-gray-400 cursor-not-allowed'
                        : 'hover:bg-white hover:shadow-sm'
                    }`}
                    data-testid={`admin-settings-${item.id}`}
                  >
                    <div className="flex items-start space-x-3">
                      <Icon className={`w-5 h-5 mt-0.5 ${
                        activeTab === item.id 
                          ? 'text-indigo-600' 
                          : item.disabled 
                          ? 'text-gray-400' 
                          : 'text-gray-500'
                      }`} />
                      <div className="flex-1">
                        <div className={`font-medium ${
                          activeTab === item.id 
                            ? 'text-indigo-900' 
                            : item.disabled 
                            ? 'text-gray-400' 
                            : 'text-gray-900'
                        }`}>
                          {item.label}
                        </div>
                        <div className={`text-sm mt-1 ${
                          item.disabled ? 'text-gray-300' : 'text-gray-500'
                        }`}>
                          {item.description}
                        </div>
                        {item.disabled && (
                          <div className="text-xs text-gray-400 mt-1">
                            Coming Soon
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* User Info */}
            <div className="mt-8 p-4 bg-white rounded-lg shadow-sm">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-violet-600 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                  {user.full_name?.split(' ').map(n => n[0]).join('').toUpperCase()}
                </div>
                <div>
                  <div className="font-medium text-gray-900">{user.full_name}</div>
                  <div className="text-sm text-gray-500">Administrator</div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-gray-200 bg-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {activeItem?.label}
                  </h2>
                  <p className="text-gray-600 mt-1">
                    {activeItem?.description}
                  </p>
                </div>
                {/* DialogContent automatically provides close button */}
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-auto">
              {ActiveComponent ? (
                <ActiveComponent />
              ) : (
                <div className="p-6">
                  <Card>
                    <CardContent className="p-8 text-center">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        {activeItem?.icon && (
                          <activeItem.icon className="w-8 h-8 text-gray-400" />
                        )}
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        {activeItem?.label}
                      </h3>
                      <p className="text-gray-500 mb-4">
                        This feature is coming soon. We're working hard to bring you advanced {activeItem?.label.toLowerCase()} capabilities.
                      </p>
                      <div className="text-sm text-gray-400">
                        Stay tuned for updates!
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AdminSettings;