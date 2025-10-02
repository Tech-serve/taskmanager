import React, { useState } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { authAPI } from '../lib/api';
import { toast } from 'sonner';
import { ArrowLeft, UserPlus } from 'lucide-react';

const Register = ({ onRegister, onBackToLogin }) => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    full_name: '',
    roles: ['buyer'] // Default to buyer role
  });
  const [loading, setLoading] = useState(false);

  const availableRoles = [
    { value: 'buyer', label: 'Buyer', description: 'Can create and manage purchase requests' },
    { value: 'designer', label: 'Designer', description: 'Handles design and creative tasks' },
    { value: 'tech', label: 'Tech', description: 'Manages technical development tasks' }
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }

    if (!formData.full_name.trim()) {
      toast.error('Full name is required');
      return;
    }

    setLoading(true);

    try {
      const response = await authAPI.register({
        email: formData.email,
        password: formData.password,
        full_name: formData.full_name,
        roles: formData.roles
      });
      
      toast.success('Account created successfully! Please log in.');
      onBackToLogin();
    } catch (error) {
      if (error.response?.status === 400) {
        toast.error('Email already registered');
      } else {
        toast.error('Failed to create account');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
  };

  const toggleRole = (role) => {
    const currentRoles = formData.roles;
    const updatedRoles = currentRoles.includes(role)
      ? currentRoles.filter(r => r !== role)
      : [...currentRoles, role];
    
    setFormData({ ...formData, roles: updatedRoles });
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-green-600 to-emerald-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
            <UserPlus className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Create Account</h1>
          <p className="text-gray-600">Join your team workspace</p>
        </div>

        {/* Registration Form */}
        <Card className="glass p-8 shadow-xl border-0">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              {/* Full Name */}
              <div>
                <Label htmlFor="full_name" className="text-sm font-medium text-gray-700">
                  Full Name
                </Label>
                <Input
                  id="full_name"
                  type="text"
                  required
                  value={formData.full_name}
                  onChange={(e) => handleChange('full_name', e.target.value)}
                  className="mt-1 bg-white/70 border-gray-200 focus:border-green-500 focus:ring-green-500"
                  placeholder="Enter your full name"
                  data-testid="register-fullname-input"
                />
              </div>

              {/* Email */}
              <div>
                <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  className="mt-1 bg-white/70 border-gray-200 focus:border-green-500 focus:ring-green-500"
                  placeholder="Enter your email"
                  data-testid="register-email-input"
                />
              </div>

              {/* Password */}
              <div>
                <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => handleChange('password', e.target.value)}
                  className="mt-1 bg-white/70 border-gray-200 focus:border-green-500 focus:ring-green-500"
                  placeholder="Choose a password"
                  data-testid="register-password-input"
                />
              </div>

              {/* Confirm Password */}
              <div>
                <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700">
                  Confirm Password
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  required
                  value={formData.confirmPassword}
                  onChange={(e) => handleChange('confirmPassword', e.target.value)}
                  className="mt-1 bg-white/70 border-gray-200 focus:border-green-500 focus:ring-green-500"
                  placeholder="Confirm your password"
                  data-testid="register-confirm-password-input"
                />
              </div>

              {/* Role Selection */}
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-3 block">
                  Select Your Role(s)
                </Label>
                <div className="space-y-2">
                  {availableRoles.map(role => (
                    <div
                      key={role.value}
                      className={`p-3 border rounded-lg cursor-pointer transition-all ${
                        formData.roles.includes(role.value)
                          ? 'border-green-500 bg-green-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => toggleRole(role.value)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-gray-900">{role.label}</div>
                          <div className="text-xs text-gray-500">{role.description}</div>
                        </div>
                        {formData.roles.includes(role.value) && (
                          <Badge className="bg-green-600 text-white">Selected</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  You can select multiple roles if applicable
                </p>
              </div>
            </div>

            <Button 
              type="submit" 
              disabled={loading}
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white py-3 rounded-lg font-medium shadow-lg"
              data-testid="register-submit-button"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Creating Account...
                </div>
              ) : (
                'Create Account'
              )}
            </Button>
          </form>
        </Card>

        {/* Back to Login */}
        <div className="text-center">
          <Button
            variant="ghost"
            onClick={onBackToLogin}
            className="text-gray-600 hover:text-gray-900"
            data-testid="back-to-login-button"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Login
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Register;