import React, { useState } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { authAPI } from '../lib/api';
import { toast } from 'sonner';
import Register from './Register';

const Login = ({ onLogin }) => {
  const [showRegister, setShowRegister] = useState(false);
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);

  if (showRegister) {
    return (
      <Register
        onRegister={onLogin}
        onBackToLogin={() => setShowRegister(false)}
      />
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await authAPI.login(formData.email, formData.password);
      const { access_token, user } = response.data;
      onLogin(access_token, user); // App сохранит токен и приведёт роли к канону
      toast.success('Welcome back!');
    } catch (error) {
      toast.error('Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const demoAccounts = [
    { email: 'admin@company.com', password: 'admin123', role: 'Admin', color: 'bg-violet-600' },
    { email: 'lead@company.com', password: 'lead123', role: 'Team Lead', color: 'bg-cyan-600' },
    { email: 'buyer@company.com', password: 'buyer123', role: 'Alice (Buyer)', color: 'bg-emerald-600' },
    { email: 'buyer2@company.com', password: 'buyer123', role: 'Bob (Buyer)', color: 'bg-emerald-600' },
    { email: 'olya@company.com', password: 'olya123', role: 'Olya COO', color: 'bg-amber-600' },
    { email: 'vladislav@company.com', password: 'vladislav123', role: 'Vladislav', color: 'bg-amber-600' },
    { email: 'designer@company.com', password: 'designer123', role: 'Designer', color: 'bg-rose-600' },
    { email: 'tech@company.com', password: 'tech123', role: 'Tech', color: 'bg-blue-600' },
  ];

  const fillDemo = (email, password) => {
    setFormData({ email, password });
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors duration-300">
      <div className="w-full max-w-md space-y-6">
        {/* Logo and Header */}
        <div className="text-center">
          <div className="mx-auto w-14 h-14 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center mb-3 shadow-lg">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2h2a2 2 0 002-2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Simplified Jira</h1>
          <p className="text-gray-600 dark:text-gray-400">Sign in to your workspace</p>
        </div>

        {/* Login Form */}
        <Card className="glass p-6 shadow-xl border-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm transition-colors duration-300">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-4">
              <div>
                <Label htmlFor="email" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Email address
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="mt-1 bg-white/70 dark:bg-gray-700/70 border-gray-200 dark:border-gray-600 focus:border-blue-500 focus:ring-blue-500 dark:text-gray-200"
                  placeholder="Enter your email"
                  data-testid="login-email-input"
                />
              </div>
              
              <div>
                <Label htmlFor="password" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Password
                </Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="mt-1 bg-white/70 dark:bg-gray-700/70 border-gray-200 dark:border-gray-600 focus:border-blue-500 focus:ring-blue-500 dark:text-gray-200"
                  placeholder="Enter your password"
                  data-testid="login-password-input"
                />
              </div>
            </div>

            <Button 
              type="submit" 
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white py-2.5 rounded-lg font-medium shadow-lg"
              data-testid="login-submit-button"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Signing in...
                </div>
              ) : (
                'Sign in'
              )}
            </Button>
          </form>
        </Card>

        {/* Demo Accounts */}
        <Card className="glass p-4 shadow-xl border-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm transition-colors duration-300">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 text-center">Demo Accounts</h3>
          <div className="grid grid-cols-2 gap-2">
            {demoAccounts.map((account, index) => (
              <Button
                key={index}
                variant="outline"
                onClick={() => fillDemo(account.email, account.password)}
                className="p-2 h-auto bg-white/70 dark:bg-gray-700/70 border-gray-200 dark:border-gray-600 hover:bg-white dark:hover:bg-gray-700 hover:border-gray-300 text-xs"
                data-testid={`demo-${account.role.toLowerCase().replace(/\s+/g, '-')}-button`}
              >
                <div className="flex items-center space-x-2">
                  <div className={`w-6 h-6 ${account.color} rounded-full flex items-center justify-center text-white text-xs font-bold`}>
                    {account.role[0]}
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-gray-900 dark:text-gray-200 text-xs">{account.role}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Click to fill</div>
                  </div>
                </div>
              </Button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Login;