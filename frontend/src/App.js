// src/App.js
import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from './components/ui/sonner';
import { ThemeProvider } from './contexts/ThemeContext';
import './App.css';

// Components
import Login from './components/Login';
import Navigation from './components/Navigation';
import BoardsList from './components/BoardsList';
import KanbanBoard from './components/KanbanBoard';
import PersonalCabinet from './components/PersonalCabinet';
import ExpensesDashboard from './components/ExpensesDashboard';

// API
import { authAPI } from './lib/api';

// ===== Роли: канонизация и объединение источников =====
const norm = (s) => String(s ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
const ROLE_ALIASES = {
  admin: 'admin',
  buyer: 'buyer',
  designer: 'designer',
  tech: 'tech',
  team_lead: 'team_lead',
  'team-lead': 'team_lead',
  teamlead: 'team_lead',
  head: 'team_lead',
  head_lead: 'team_lead',
  headelite: 'team_lead',
  'head-elite': 'team_lead',
  tl: 'team_lead',
};
const canonRole = (r) => ROLE_ALIASES[norm(r)] ?? norm(r);
const canonRoles = (arr) => Array.from(new Set((Array.isArray(arr) ? arr : []).map(canonRole)));

function unifyUser(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const real = canonRoles(raw.roles || []);
  const extra = canonRoles(raw.effective_roles || []);
  const effective = Array.from(new Set([...real, ...extra]));
  return {
    ...raw,
    roles: real,
    effective_roles: effective,
    is_admin: effective.includes('admin'),
    is_team_lead: effective.includes('team_lead'),
  };
}

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Вынесли в useCallback, чтобы не нужен был eslint-disable
  const checkAuth = useCallback(async () => {
    try {
      const response = await authAPI.me();
      setUser(unifyUser(response.data));
    } catch (error) {
      console.error('Auth check failed:', error);
      try { localStorage.removeItem('token'); } catch {}
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (token) {
      checkAuth();
    } else {
      setLoading(false);
    }
  }, [checkAuth]);

  const login = (token, userData) => {
    try { localStorage.setItem('token', token); } catch {}
    setUser(unifyUser(userData));
  };

  const logout = () => {
    try { localStorage.removeItem('token'); } catch {}
    setUser(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <ThemeProvider>
      <div className="App min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 transition-colors duration-300">
        <BrowserRouter>
          {user ? (
            <div className="flex h-screen overflow-hidden">
              <Navigation user={user} onLogout={logout} />
              <main className="flex-1 overflow-auto">
                <Routes>
                  <Route path="/" element={<Navigate to="/boards" />} />
                  <Route path="/boards" element={<BoardsList user={user} />} />
                  <Route path="/boards/:boardKey" element={<KanbanBoard user={user} />} />
                  <Route path="/me" element={<PersonalCabinet user={user} />} />
                  <Route path="/dashboard/expenses" element={<ExpensesDashboard user={user} />} />
                  <Route path="*" element={<Navigate to="/boards" />} />
                </Routes>
              </main>
            </div>
          ) : (
            <Routes>
              <Route path="/login" element={<Login onLogin={login} />} />
              <Route path="*" element={<Navigate to="/login" />} />
            </Routes>
          )}
        </BrowserRouter>
        <Toaster position="top-right" />
      </div>
    </ThemeProvider>
  );
}

export default App;