import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Mail, 
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
    roles: []
  });
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordCopied, setPasswordCopied] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [resetPasswordMode, setResetPasswordMode] = useState(false);

  // оставляю твои цвета бейджей как есть
  const roleOptions = [
    { value: 'admin', label: 'Admin', color: 'bg-violet-100 text-violet-800' },
    { value: 'buyer', label: 'Buyer', color: 'bg-emerald-100 text-emerald-800' },
    { value: 'designer', label: 'Designer', color: 'bg-rose-100 text-rose-800' },
    { value: 'tech', label: 'Tech', color: 'bg-blue-100 text-blue-800' }
  ];

  const statusOptions = [
    { value: 'active', label: 'Active', color: 'bg-green-100 text-green-800' },
    { value: 'inactive', label: 'Inactive', color: 'bg-gray-100 text-gray-800' },
    { value: 'pending', label: 'Pending', color: 'bg-yellow-100 text-yellow-800' }
  ];

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await api.get('/users');
      setUsers(response.data);
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
      roles: []
    });
    setShowPassword(false);
    setPasswordCopied(false);
    setShowAddDialog(true);
  };

  const handleEditUser = (user) => {
    setSelectedUser(user);
    setFormData({
      fullName: user.full_name,
      email: user.email,
      roles: user.roles,
      status: user.status
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
      toast({
        title: "Copied!",
        description: "Password copied to clipboard.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy password.",
        variant: "destructive",
      });
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
        toast({
          title: "Error",
          description: "Please fill in all required fields.",
          variant: "destructive",
        });
        return;
      }

      await api.post('/users', {
        fullName: formData.fullName,
        email: formData.email,
        roles: formData.roles,
        password: generatedPassword,
        sendInvitation: false
      });

      toast({
        title: "Success",
        description: "User created successfully!",
      });

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
      const updateData = {
        fullName: formData.fullName,
        email: formData.email,
        roles: formData.roles,
        status: formData.status
      };

      // Add password if resetting
      if (resetPasswordMode && newPassword) {
        updateData.password = newPassword;
      }

      await api.put(`/users/${selectedUser.id}`, updateData);

      toast({
        title: "Success",
        description: "User updated successfully!",
      });

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
      await api.delete(`/users/${selectedUser.id}`);

      toast({
        title: "Success",
        description: "User deleted successfully!",
      });

      setShowDeleteDialog(false);
      fetchUsers();
    } catch (error) {
      console.error('Failed to delete user:', error);
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to delete user. Please try again.",
        variant: "destructive",
      });
    }
  };

  const toggleRole = (role) => {
    setFormData(prev => ({
      ...prev,
      roles: prev.roles.includes(role)
        ? prev.roles.filter(r => r !== role)
        : [...prev.roles, role]
    }));
  };

  const filteredUsers = users.filter(user => 
    (user.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.roles || []).some(role => (role || '').toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getRoleBadgeColor = (role) => {
    const roleOption = roleOptions.find(r => r.value === role);
    return roleOption?.color || 'bg-gray-100 text-gray-800';
  };

  const getStatusBadgeColor = (status) => {
    const statusOption = statusOptions.find(s => s.value === status);
    return statusOption?.color || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="p-6 bg-neutral-950 text-neutral-100 rounded-lg">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-neutral-950 text-neutral-100 rounded-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-neutral-100">User Management</h2>
          <p className="text-neutral-400">Manage users, roles, and permissions</p>
        </div>
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
      <div className="mb-6">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-neutral-500" />
          <Input
            placeholder="Search users by name, email, or role..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-neutral-900 border-neutral-800 text-neutral-100 placeholder-neutral-500"
            data-testid="user-search-input"
          />
        </div>
      </div>

      {/* Users List - Jira Style Table */}
      <Card className="bg-neutral-900 border border-neutral-800">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-900 border-b border-neutral-800">
                <tr>
                  <th className="text-left p-4 font-semibold text-neutral-300">User</th>
                  <th className="text-left p-4 font-semibold text-neutral-300">Email</th>
                  <th className="text-left p-4 font-semibold text-neutral-300">Roles</th>
                  <th className="text-left p-4 font-semibold text-neutral-300">Status</th>
                  <th className="text-left p-4 font-semibold text-neutral-300">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="border-b border-neutral-800 hover:bg-neutral-800 transition-colors">
                    {/* User Column */}
                    <td className="p-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                          {(user.full_name || 'Unknown').split(' ').map(n => n[0]).join('').toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-neutral-100" data-testid={`user-name-${user.id}`}>
                            {user.full_name || 'Unknown User'}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Email Column */}
                    <td className="p-4">
                      <div className="text-sm text-neutral-400" data-testid={`user-email-${user.id}`}>
                        {user.email}
                      </div>
                    </td>

                    {/* Roles Column */}
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1">
                        {user.roles.map((role) => (
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
                          className="border-neutral-700 text-neutral-200 hover:bg-neutral-800"
                          data-testid={`edit-user-${user.id}`}
                        >
                          <Edit className="w-3 h-3 mr-1" />
                          Edit
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleDeleteUser(user)}
                          className="border-neutral-700 text-red-400 hover:bg-neutral-800 hover:text-red-300"
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
        <Card className="bg-neutral-900 border border-neutral-800 mt-6">
          <CardContent className="p-8 text-center">
            <UserIcon className="w-12 h-12 text-neutral-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-neutral-100 mb-2">No users found</h3>
            <p className="text-neutral-400">
              {searchTerm ? 'Try adjusting your search criteria' : 'Get started by adding your first user'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Add User Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md bg-neutral-900 text-neutral-100 border border-neutral-800">
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
                className="bg-neutral-800 border-neutral-700 text-neutral-100 placeholder-neutral-500"
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
                className="bg-neutral-800 border-neutral-700 text-neutral-100 placeholder-neutral-500"
                data-testid="add-user-email"
              />
            </div>
            <div>
              <Label>Roles *</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {roleOptions.map((role) => (
                  <Button
                    key={role.value}
                    type="button"
                    variant={formData.roles.includes(role.value) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleRole(role.value)}
                    className={formData.roles.includes(role.value) ? "" : "border-neutral-700 text-neutral-200 hover:bg-neutral-800"}
                    data-testid={`add-user-role-${role.value}`}
                  >
                    {role.label}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <Label>Generated Password</Label>
              <div className="flex space-x-2 mt-2">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={generatedPassword}
                  readOnly
                  className="flex-1 bg-neutral-800 border-neutral-700 text-neutral-100"
                  data-testid="generated-password"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPassword(!showPassword)}
                  className="border-neutral-700 text-neutral-200 hover:bg-neutral-800"
                  data-testid="toggle-password-visibility"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(generatedPassword)}
                  className="border-neutral-700 text-neutral-200 hover:bg-neutral-800"
                  data-testid="copy-password"
                >
                  {passwordCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-xs text-neutral-500 mt-1">
                This password will be provided to the user for their initial login
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-neutral-700 text-neutral-200 hover:bg-neutral-800" onClick={() => setShowAddDialog(false)}>
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
        <DialogContent className="max-w-md bg-neutral-900 text-neutral-100 border border-neutral-800">
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
                className="bg-neutral-800 border-neutral-700 text-neutral-100"
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
                className="bg-neutral-800 border-neutral-700 text-neutral-100"
                data-testid="edit-user-email"
              />
            </div>
            <div>
              <Label>Roles</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {roleOptions.map((role) => (
                  <Button
                    key={role.value}
                    type="button"
                    variant={formData.roles.includes(role.value) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleRole(role.value)}
                    className={formData.roles.includes(role.value) ? "" : "border-neutral-700 text-neutral-200 hover:bg-neutral-800"}
                    data-testid={`edit-user-role-${role.value}`}
                  >
                    {role.label}
                  </Button>
                ))}
              </div>
            </div>
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
                    className={formData.status === status.value ? "" : "border-neutral-700 text-neutral-200 hover:bg-neutral-800"}
                    data-testid={`edit-user-status-${status.value}`}
                  >
                    {status.label}
                  </Button>
                ))}
              </div>
            </div>
            
            {/* Password Management */}
            <div className="border-t border-neutral-800 pt-4 mt-4">
              <div className="flex items-center justify-between mb-3">
                <Label className="text-sm font-semibold">Password Management</Label>
                {!resetPasswordMode && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={generateNewPassword}
                    className="border-neutral-700 text-neutral-200 hover:bg-neutral-800"
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
                    <Label className="text-sm text-amber-400">New Password Generated</Label>
                    <div className="flex space-x-2 mt-2">
                      <Input
                        type={showNewPassword ? "text" : "password"}
                        value={newPassword}
                        readOnly
                        className="flex-1 bg-neutral-800 border-neutral-700 text-neutral-100"
                        data-testid="new-password-field"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="border-neutral-700 text-neutral-200 hover:bg-neutral-800"
                        data-testid="toggle-new-password-visibility"
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(newPassword)}
                        className="border-neutral-700 text-neutral-200 hover:bg-neutral-800"
                        data-testid="copy-new-password"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-neutral-400 mt-1">
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
                    className="text-neutral-400 hover:text-neutral-200"
                  >
                    Cancel Password Reset
                  </Button>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-neutral-700 text-neutral-200 hover:bg-neutral-800" onClick={() => setShowEditDialog(false)}>
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
        <DialogContent className="max-w-md bg-neutral-900 text-neutral-100 border border-neutral-800">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <span>Delete User</span>
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-neutral-300">
              Are you sure you want to delete <strong>{selectedUser?.full_name}</strong>? 
              This action cannot be undone and will permanently remove the user and all associated data.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-neutral-700 text-neutral-200 hover:bg-neutral-800" onClick={() => setShowDeleteDialog(false)}>
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