'use client';
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Card, CardContent } from './ui/card';

import UserManagement from './UserManagement';
import RolesAdmin from './RolesAdmin';
import DepartmentsAdmin from './DepartmentsAdmin'; // ← NEW

import {
  Settings,
  Users,
  Shield,
  Database,
} from 'lucide-react';

const AdminSettings = ({ open, onClose, user }) => {
  const [activeTab, setActiveTab] = useState('users'); // 'users' | 'roles' | 'departments' ...

  const settingsItems = [
    {
      id: 'users',
      label: 'User Management',
      icon: Users,
      description: 'Manage users, roles, and permissions',
      component: UserManagement,
    },
    {
      id: 'roles',
      label: 'Roles',
      icon: Shield,
      description: 'Create roles and control board visibility by roles',
      component: RolesAdmin,
    },
    {
      id: 'departments',                          // ← NEW TAB
      label: 'Departments',
      icon: Database,
      description: 'Create and manage departments; assign users to departments',
      component: DepartmentsAdmin,
    }
  ];

  const activeItem = settingsItems.find(item => item.id === activeTab);
  const ActiveComponent = activeItem?.component;

  const initials =
    (user?.full_name || user?.fullName || user?.email || 'U')
      .split(' ')
      .map(n => n?.[0])
      .filter(Boolean)
      .join('')
      .toUpperCase()
      .slice(0, 2);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      {/* 70% высоты экрана + ничего лишнего */}
      <DialogContent className="max-w-7xl h-[70vh] overflow-hidden p-0">
        {/* важно дать min-h-0, чтобы дочерний скролл работал */}
        <div className="flex h-full min-h-0">
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
                const isActive = activeTab === item.id;
                const isDisabled = !!item.disabled;

                return (
                  <button
                    key={item.id}
                    onClick={() => !isDisabled && setActiveTab(item.id)}
                    disabled={isDisabled}
                    className={`w-full text-left p-4 rounded-lg transition-all duration-200 ${
                      isActive
                        ? 'bg-white shadow-sm ring-2 ring-indigo-500 ring-opacity-20'
                        : isDisabled
                        ? 'text-gray-400 cursor-not-allowed'
                        : 'hover:bg-white hover:shadow-sm'
                    }`}
                    data-testid={`admin-settings-${item.id}`}
                  >
                    <div className="flex items-start space-x-3">
                      <Icon
                        className={`w-5 h-5 mt-0.5 ${
                          isActive
                            ? 'text-indigo-600'
                            : isDisabled
                            ? 'text-gray-400'
                            : 'text-gray-500'
                        }`}
                      />
                      <div className="flex-1">
                        <div
                          className={`font-medium ${
                            isActive
                              ? 'text-indigo-900'
                              : isDisabled
                              ? 'text-gray-400'
                              : 'text-gray-900'
                          }`}
                        >
                          {item.label}
                        </div>
                        <div
                          className={`text-sm mt-1 ${
                            isDisabled ? 'text-gray-300' : 'text-gray-500'
                          }`}
                        >
                          {item.description}
                        </div>
                        {isDisabled && (
                          <div className="text-xs text-gray-400 mt-1">Coming Soon</div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Main Content */}
          {/* добавил min-h-0 на колонку и overflow на контент */}
          <div className="flex-1 min-h-0 flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-gray-200 bg-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{activeItem?.label}</h2>
                  <p className="text-gray-600 mt-1">{activeItem?.description}</p>
                </div>
              </div>
            </div>

            {/* Content Area (скролл) */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              {ActiveComponent ? (
                <ActiveComponent />
              ) : (
                <div className="p-6">
                  <Card>
                    <CardContent className="p-8 text-center">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        {activeItem?.icon && <activeItem.icon className="w-8 h-8 text-gray-400" />}
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        {activeItem?.label}
                      </h3>
                      <p className="text-gray-500 mb-4">
                        This feature is coming soon. We're working hard to bring you advanced{' '}
                        {activeItem?.label?.toLowerCase()} capabilities.
                      </p>
                      <div className="text-sm text-gray-400">Stay tuned for updates!</div>
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