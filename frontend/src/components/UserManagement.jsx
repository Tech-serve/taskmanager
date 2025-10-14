// frontend/src/components/UserManagement.jsx
import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Shield, 
  User as UserIcon, 
  Eye, 
  EyeOff,
  AlertTriangle,
  Copy,
  Check
} from 'lucide-react';
import { api } from '../lib/api';
import { toast } from '../hooks/use-toast';

// селекторы
import RoleSelect from './RoleSelect';
import DepartmentSelect from './DepartmentSelect';

// helpers для ролей
const normRole = (v) => String(v ?? '').trim().toUpperCase();
const pickPrimary = (arr) => {
  const prio = ['ADMIN','TEAM_LEAD','TECH','DESIGNER','BUYER','OFFICE'];
  return arr.find(r => prio.includes(r)) || arr[0] || '';
};

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    roles: [],          // массив UPPERCASE ключей ролей
    primaryRole: '',    // UPPERCASE ключ основной роли (для селекта)
    departments: []     // массив UPPERCASE ключей департаментов
  });

  const [generatedPassword, setGeneratedPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordCopied, setPasswordCopied] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [resetPasswordMode, setResetPasswordMode] = useState(false);

  // цвета бейджей ролей (визуал)
  const roleOptions = [
    { value: 'admin',    label: 'Admin',    color: 'bg-violet-100 text-violet-800' },
    { value: 'buyer',    label: 'Buyer',    color: 'bg-emerald-100 text-emerald-800' },
    { value: 'designer', label: 'Designer', color: 'bg-rose-100 text-rose-800' },
    { value: 'tech',     label: 'Tech',     color: 'bg-blue-100 text-blue-800' },
    { value: 'team_lead',label: 'Team Lead',color: 'bg-amber-100 text-amber-800' },
    { value: 'office',   label: 'Office',   color: 'bg-slate-100 text-slate-800' },
  ];

  const statusOptions = [
    { value: 'active',   label: 'Active',   color: 'bg-green-100 text-green-800' },
    { value: 'inactive', label: 'Inactive', color: 'bg-gray-100 text-gray-800' },
    { value: 'pending',  label: 'Pending',  color: 'bg-yellow-100 text-yellow-800' }
  ];

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await api.get('/users');
      setUsers(response.data || []);
    } catch (error) {
      console.error('Failed to fetch users:', error);
      toast({
        title: "Error",
        description: "Failed to fetch users. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const generatePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    const length = 12;
    let password = '';
    for (let i = 0; i < length; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  const handleAddUser = () => {
    const password = generatePassword();
    setGeneratedPassword(password);
    setFormData({
      fullName: '',
      email: '',
      roles: [],
      primaryRole: '',
      departments: [] // требуем выбрать в форме
    });
    setShowPassword(false);
    setPasswordCopied(false);
    setShowAddDialog(true);
  };

  const handleEditUser = (user) => {
    const rolesUp = Array.from(new Set((user.roles || []).map(normRole)));
    setSelectedUser(user);
    setFormData({
      fullName: user.full_name,
      email: user.email,
      roles: rolesUp,
      primaryRole: pickPrimary(rolesUp),
      status: user.status,
      // бэк может отдавать как строки, так и объекты {key,name}
      departments: Array.isArray(user.departments)
        ? user.departments.map(d => typeof d === 'string' ? d : (d?.key || d?.name || '')).filter(Boolean).map(s => String(s).toUpperCase())
        : []
    });
    setNewPassword('');
    setResetPasswordMode(false);
    setShowNewPassword(false);
    setShowEditDialog(true);
  };

  const handleDeleteUser = (user) => {
    setSelectedUser(user);
    setShowDeleteDialog(true);
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setPasswordCopied(true);
      setTimeout(() => setPasswordCopied(false), 2000);
      toast({ title: "Copied!", description: "Password copied to clipboard." });
    } catch {
      toast({ title: "Error", description: "Failed to copy password.", variant: "destructive" });
    }
  };

  const generateNewPassword = () => {
    const password = generatePassword();
    setNewPassword(password);
    setResetPasswordMode(true);
    setShowNewPassword(true);
  };

  const submitAddUser = async () => {
    try {
      if (!formData.fullName || !formData.email || formData.roles.length === 0) {
        toast({ title: "Error", description: "Please fill in all required fields.", variant: "destructive" });
        return;
      }
      if (!Array.isArray(formData.departments) || formData.departments.length === 0) {
        toast({ title: "Error", description: "Choose at least one department.", variant: "destructive" });
        return;
      }

      await api.post('/users', {
        fullName: formData.fullName,
        email: formData.email,
        roles: formData.roles.map(normRole),
        primaryRole: normRole(formData.primaryRole || pickPrimary(formData.roles)),
        departments: formData.departments.map(d => String(d).toUpperCase()),
        password: generatedPassword,
        sendInvitation: false
      });

      toast({ title: "Success", description: "User created successfully!" });
      setShowAddDialog(false);
      fetchUsers();
    } catch (error) {
      console.error('Failed to create user:', error);
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to create user. Please try again.",
        variant: "destructive",
      });
    }
  };

  const submitEditUser = async () => {
    try {
      if (!selectedUser) return;
      const updateData = {
        fullName: formData.fullName,
        email: formData.email,
        roles: formData.roles.map(normRole),
        primaryRole: normRole(formData.primaryRole || pickPrimary(formData.roles)),
        status: formData.status,
        departments: (formData.departments || []).map(d => String(d).toUpperCase()),
      };

      if (resetPasswordMode && newPassword) {
        updateData.password = newPassword;
      }

      await api.put(`/users/${selectedUser.id}`, updateData);

      toast({ title: "Success", description: "User updated successfully!" });
      setShowEditDialog(false);
      fetchUsers();
    } catch (error) {
      console.error('Failed to update user:', error);
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to update user. Please try again.",
        variant: "destructive",
      });
    }
  };

  const confirmDeleteUser = async () => {
    try {
      if (!selectedUser) return;
      await api.delete(`/users/${selectedUser.id}`);
      toast({ title: "Success", description: "User deleted successfully!" });
      setShowDeleteDialog(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (error) {
      console.error('Failed to delete user:', error);
      toast({
        title: "Error",
        description: error?.response?.data?.error || "Failed to delete user. Please try again.",
        variant: "destructive",
      });
    }
  };

  const filteredUsers = users.filter(user => {
    const dept = Array.isArray(user.departments)
      ? user.departments.map(d => (typeof d === 'string' ? d : (d?.name || d?.key || ''))).join(' ').toLowerCase()
      : '';
    return (
      (user.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.roles || []).some(role => (String(role || '')).toLowerCase().includes(searchTerm.toLowerCase())) ||
      dept.includes(searchTerm.toLowerCase())
    );
  });

  const getRoleBadgeColor = (role) => {
    // поддержка UPPERCASE/Lowercase
    const r = (role || '').toString().toLowerCase();
    const roleOption = roleOptions.find(opt => opt.value === r);
    return roleOption?.color || 'bg-gray-100 text-gray-800';
  };

  const getStatusBadgeColor = (status) => {
    const statusOption = statusOptions.find(s => s.value === status);
    return statusOption?.color || 'bg-gray-100 text-gray-800';
  };

  const renderDeptBadges = (departments) => {
    if (!Array.isArray(departments) || departments.length === 0) {
      return <span className="text-xs text-gray-400">—</span>;
    }
    return (
      <div className="flex flex-wrap gap-1">
        {departments.map((d, idx) => {
          const key = typeof d === 'string' ? d : (d?.key || d?.name || `D${idx}`);
          const label = typeof d === 'string' ? d : (d?.name || d?.key || key);
          return (
            <Badge key={`${key}-${idx}`} className="bg-gray-100 text-gray-800">
              {label}
            </Badge>
          );
        })}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="h-full min-h-0 p-6">
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 flex flex-col p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 shrink-0">
        <Button 
          onClick={handleAddUser}
          className="bg-indigo-600 hover:bg-indigo-700"
          data-testid="add-user-button"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add User
        </Button>
      </div>

      {/* Search */}
      <div className="mb-6 shrink-0">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          <Input
            placeholder="Search users by name, email, role or department..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="user-search-input"
          />
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {/* Users List - Jira Style Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left p-4 font-semibold text-gray-900">User</th>
                    <th className="text-left p-4 font-semibold text-gray-900">Email</th>
                    <th className="text-left p-4 font-semibold text-gray-900">Roles</th>
                    <th className="text-left p-4 font-semibold text-gray-900">Departments</th>
                    <th className="text-left p-4 font-semibold text-gray-900">Status</th>
                    <th className="text-left p-4 font-semibold text-gray-900">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="border-b hover:bg-gray-50 transition-colors">
                      {/* User Column */}
                      <td className="p-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                            {(user.full_name || 'Unknown').split(' ').map(n => n[0]).join('').toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900" data-testid={`user-name-${user.id}`}>
                              {user.full_name || 'Unknown User'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Email Column */}
                      <td className="p-4">
                        <div className="text-sm text-gray-600" data-testid={`user-email-${user.id}`}>
                          {user.email}
                        </div>
                      </td>

                      {/* Roles Column */}
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1">
                          {(user.roles || []).map((role) => (
                            <Badge 
                              key={role} 
                              className={getRoleBadgeColor(role)}
                              data-testid={`user-role-${user.id}-${role}`}
                            >
                              {role}
                            </Badge>
                          ))}
                        </div>
                      </td>

                      {/* Departments Column */}
                      <td className="p-4">{renderDeptBadges(user.departments)}</td>

                      {/* Status Column */}
                      <td className="p-4">
                        <Badge 
                          className={getStatusBadgeColor(user.status)}
                          data-testid={`user-status-${user.id}`}
                        >
                          {user.status}
                        </Badge>
                      </td>

                      {/* Actions Column */}
                      <td className="p-4">
                        <div className="flex space-x-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleEditUser(user)}
                            data-testid={`edit-user-${user.id}`}
                          >
                            <Edit className="w-3 h-3 mr-1" />
                            Edit
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleDeleteUser(user)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            data-testid={`delete-user-${user.id}`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {filteredUsers.length === 0 && (
          <Card className="mt-6">
            <CardContent className="p-8 text-center">
              <UserIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No users found</h3>
              <p className="text-gray-500">
                {searchTerm ? 'Try adjusting your search criteria' : 'Get started by adding your first user'}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Add User Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="fullName">Full Name *</Label>
              <Input
                id="fullName"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                placeholder="Enter full name"
                data-testid="add-user-fullname"
              />
            </div>
            <div>
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="Enter email address"
                data-testid="add-user-email"
              />
            </div>

            <RoleSelect
              label="Roles *"
              value={formData.roles}
              primary={formData.primaryRole}
              onChange={(next) => {
                // поддерживаем и старый формат onChange(array), и новый {roles, primary}
                if (Array.isArray(next)) {
                  const roles = next.map(normRole);
                  setFormData(fd => ({ ...fd, roles, primaryRole: pickPrimary(roles) }));
                } else {
                  const roles = (next.roles || []).map(normRole);
                  const primaryRole = normRole(next.primary || pickPrimary(roles));
                  setFormData(fd => ({ ...fd, roles, primaryRole }));
                }
              }}
              required
              placeholder="Select roles…"
            />

            <DepartmentSelect
              label="Departments *"
              value={formData.departments}
              onChange={(departments) => setFormData({ ...formData, departments })}
              placeholder="Select departments…"
              multiple
            />

            <div>
              <Label>Generated Password</Label>
              <div className="flex space-x-2 mt-2">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={generatedPassword}
                  readOnly
                  className="flex-1"
                  data-testid="generated-password"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPassword(!showPassword)}
                  data-testid="toggle-password-visibility"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(generatedPassword)}
                  data-testid="copy-password"
                >
                  {passwordCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                This password will be provided to the user for their initial login
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={submitAddUser} data-testid="submit-add-user">
              Create User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="editFullName">Full Name</Label>
              <Input
                id="editFullName"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                data-testid="edit-user-fullname"
              />
            </div>
            <div>
              <Label htmlFor="editEmail">Email</Label>
              <Input
                id="editEmail"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                data-testid="edit-user-email"
              />
            </div>

            <RoleSelect
              label="Roles"
              value={formData.roles}
              primary={formData.primaryRole}
              onChange={(next) => {
                if (Array.isArray(next)) {
                  const roles = next.map(normRole);
                  setFormData(fd => ({ ...fd, roles, primaryRole: pickPrimary(roles) }));
                } else {
                  const roles = (next.roles || []).map(normRole);
                  const primaryRole = normRole(next.primary || pickPrimary(roles));
                  setFormData(fd => ({ ...fd, roles, primaryRole }));
                }
              }}
              placeholder="Select roles…"
            />

            <DepartmentSelect
              label="Departments *"
              value={formData.departments}
              onChange={(departments) => setFormData({ ...formData, departments })}
              placeholder="Select departments…"
              multiple
            />

            <div>
              <Label>Status</Label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {statusOptions.map((status) => (
                  <Button
                    key={status.value}
                    type="button"
                    variant={formData.status === status.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFormData({ ...formData, status: status.value })}
                    className="justify-start"
                    data-testid={`edit-user-status-${status.value}`}
                  >
                    {status.label}
                  </Button>
                ))}
              </div>
            </div>
            
            {/* Password Management */}
            <div className="border-t pt-4 mt-4">
              <div className="flex items-center justify-between mb-3">
                <Label className="text-sm font-semibold">Password Management</Label>
                {!resetPasswordMode && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={generateNewPassword}
                    data-testid="reset-password-button"
                  >
                    <Shield className="w-3 h-3 mr-2" />
                    Reset Password
                  </Button>
                )}
              </div>
              
              {resetPasswordMode && (
                <div className="space-y-3">
                  <div>
                    <Label className="text-sm text-orange-600">New Password Generated</Label>
                    <div className="flex space-x-2 mt-2">
                      <Input
                        type={showNewPassword ? "text" : "password"}
                        value={newPassword}
                        readOnly
                        className="flex-1"
                        data-testid="new-password-field"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        data-testid="toggle-new-password-visibility"
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(newPassword)}
                        data-testid="copy-new-password"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-orange-600 mt-1">
                      This new password will be set when you save changes
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setResetPasswordMode(false);
                      setNewPassword('');
                      setShowNewPassword(false);
                    }}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    Cancel Password Reset
                  </Button>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={submitEditUser} data-testid="submit-edit-user">
              Update User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <span>Delete User</span>
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-gray-700">
              Are you sure you want to delete <strong>{selectedUser?.full_name}</strong>? 
              This action cannot be undone and will permanently remove the user and all associated data.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={confirmDeleteUser}
              data-testid="confirm-delete-user"
            >
              Delete User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserManagement;