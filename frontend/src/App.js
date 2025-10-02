import React, { useState, useEffect } from 'react';
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

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const token = localStorage.getItem('token');
    if (token) {
      checkAuth();
    } else {
      setLoading(false);
    }
  }, []);

  const checkAuth = async () => {
    try {
      const response = await authAPI.me();
      setUser(response.data);
    } catch (error) {
      console.error('Auth check failed:', error);
      localStorage.removeItem('token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = (token, userData) => {
    localStorage.setItem('token', token);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('token');
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