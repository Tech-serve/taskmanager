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
  const [showList, setShowList] = useState(false);

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
      onLogin(access_token, user);
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

  // ===== DEMO ACCOUNTS (из вашей таблицы) =====
  const demoAccounts = [
    { email: 'admin@company.com', password: 'admin123', role: 'admin', departments: ['SWIP', 'GABLING'] },
    { email: 'tech1@gambling.local', password: 'f@DOr&hVMLfk', role: 'tech', departments: ['GAMBLING'] },
    { email: 'tech2@gambling.local', password: 'tW&hdG4g$yDy', role: 'tech', departments: ['GAMBLING'] },
    { email: 'buyertech1@gambling.local', password: 'NkHSF&sdwPKq', role: 'buyer, tech', departments: ['GAMBLING'] },
    { email: 'buyertech2@gambling.local', password: 'lHq52bN&QHV5', role: 'buyer, tech', departments: ['GAMBLING'] },
    { email: 'buyer1@swip.local', password: 'N8of*c1fVtXJ', role: 'buyer', departments: ['SWIP'] },
    { email: 'buyer2@swip.local', password: 'a4ytL%20SSHe', role: 'buyer', departments: ['SWIP'] },
    { email: 'tech1@swip.local', password: 'tech1@swip.local', role: 'tech', departments: ['SWIP'] },
    { email: 'tech2@swip.local', password: '$h%VNGYbo2sF', role: 'tech', departments: ['SWIP'] },
    { email: 'designer1@swip.local', password: '$X!vu6B4PrLb', role: 'designer', departments: ['SWIP'] },
    { email: 'designer2@swip.local', password: '0AuKjlC0f7a6', role: 'designer', departments: ['SWIP'] },
    { email: 'designer1@gambling.local', password: 'sC#0ss0WYccc', role: 'designer', departments: ['GAMBLING'] },
    { email: 'designer2@gambling.local', password: 'RbxTdBZeqwAB', role: 'designer', departments: ['GAMBLING'] },
    { email: 'tl1@gambling.local', password: '@gNB#X4wYJ8#', role: 'team_lead', departments: ['GAMBLING'] },
    { email: 'tl2@gambling.local', password: 'LE3qVN1aFkL2', role: 'team_lead', departments: ['GAMBLING'] },
    { email: 'tl1@swip.local', password: 'l8Tm9eQRfp$b', role: 'team_lead', departments: ['SWIP'] },
    { email: 'tl2@swip.local', password: '6gStI9Oj#RqO', role: 'team_lead', departments: ['SWIP'] },
     { email: 'affiliate@company.com', password: 'P3w4mjPcPJ6h', role: 'AFFILIATE', departments: ['GAMBLING'] },
  ];

  const deptColor = (departments = []) => {
    const d = (departments[0] || '').toUpperCase();
    if (d === 'GAMBLING') return 'bg-purple-600';
    if (d === 'SWIP') return 'bg-cyan-600';
    return 'bg-slate-600';
  };

  const roleInitials = (role) => {
    if (!role) return 'U';
    // e.g. "buyer, tech" -> BT, "team_lead" -> TL
    const norm = String(role).replace(/[_-]+/g, ' ').split(',').map(s => s.trim());
    const parts = norm.flatMap(x => x.split(/\s+/));
    const letters = parts.filter(Boolean).map(w => w[0]?.toUpperCase());
    return (letters.join('').slice(0, 2) || 'U');
  };

  const fillDemo = (email, password) => {
    setFormData({ email, password });
  };

  const grouped = demoAccounts.reduce((acc, a) => {
    const d = (a.departments?.[0] || 'OTHER').toUpperCase();
    (acc[d] ||= []).push(a);
    return acc;
  }, {});

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
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Quick fill accounts</h3>
            <Button size="sm" variant="outline" onClick={() => setShowList(v => !v)} className="h-7 px-2">
              {showList ? 'Hide list' : 'Show list'}
            </Button>
          </div>

          {/* Buttons by department */}
          {Object.entries(grouped).map(([dept, items]) => (
            <div key={dept} className="mb-3">
              <div className="text-[11px] uppercase tracking-wider text-gray-500 mb-2">{dept}</div>
              <div className="grid grid-cols-2 gap-2">
                {items.map((account, index) => (
                  <Button
                    key={`${dept}-${index}`}
                    variant="outline"
                    onClick={() => fillDemo(account.email, account.password)}
                    className="p-2 h-auto bg-white/70 dark:bg-gray-700/70 border-gray-200 dark:border-gray-600 hover:bg-white dark:hover:bg-gray-700 hover:border-gray-300 text-xs"
                    data-testid={`demo-${account.email.replace(/[^a-z0-9]/gi, '-')}-button`}
                    title={`${account.email} — ${account.role}`}
                  >
                    <div className="flex items-center space-x-2">
                      <div className={`w-6 h-6 ${deptColor(account.departments)} rounded-full flex items-center justify-center text-white text-[10px] font-bold`}>
                        {roleInitials(account.role)}
                      </div>
                      <div className="text-left truncate">
                        <div className="font-medium text-gray-900 dark:text-gray-200 text-xs truncate">{account.email}</div>
                        <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate">{account.role}</div>
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
            </div>
          ))}

          {/* Full list with passwords (по просьбе: вывести список ниже кнопок) */}
          {showList && (
            <div className="mt-3 border-t border-gray-200 dark:border-gray-700 pt-3 max-h-56 overflow-auto text-xs">
              <table className="w-full">
                <thead className="text-[10px] text-gray-500">
                  <tr>
                    <th className="text-left font-medium pb-1">Email</th>
                    <th className="text-left font-medium pb-1">Password</th>
                    <th className="text-left font-medium pb-1">Role</th>
                    <th className="text-left font-medium pb-1">Dept</th>
                  </tr>
                </thead>
                <tbody>
                  {demoAccounts.map((a, i) => (
                    <tr key={i} className="align-top">
                      <td className="py-1 pr-2 font-mono text-[11px] break-all">{a.email}</td>
                      <td className="py-1 pr-2 font-mono text-[11px] break-all">{a.password}</td>
                      <td className="py-1 pr-2">{a.role}</td>
                      <td className="py-1 pr-2">{a.departments?.[0]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default Login;
