// src/components/ExpensesDashboard.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { EXPENSE_CATEGORIES } from './CategorySelector';
import { boardsAPI, columnsAPI, expensesAPI, usersAPI } from '../lib/api';
import { toast } from 'sonner';
import {
  DollarSign,
  TrendingUp,
  Calendar,
  PieChart as PieIcon,
  BarChart3,
  Filter,
  Download,
  Group as GroupIcon
} from 'lucide-react';

// recharts
import {
  ResponsiveContainer,
  PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line
} from 'recharts';

// ====== КОНСТАНТЫ ======
const DEFAULT_EXPENSES_BOARD_KEY = 'EXPT'; // <-- ключ твоей доски расходов

// ПАЛИТРА для графиков
const COLORS = [
  '#3b82f6', '#22c55e', '#ef4444', '#a855f7', '#eab308',
  '#06b6d4', '#f97316', '#84cc16', '#f43f5e', '#8b5cf6',
  '#14b8a6', '#f59e0b', '#64748b', '#10b981', '#fb7185'
];

// ====== УТИЛИТЫ ======
const titleFromSlug = (s = '') =>
  s.replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const splitCategory = (raw) => {
  const cat = String(raw ?? '').trim();
  if (!cat) return { main: 'uncategorized', sub: null };
  if (cat.includes('.')) {
    const [main, sub] = cat.split('.');
    return { main, sub: sub ?? null };
  }
  if (cat.includes('_')) {
    const [main, ...rest] = cat.split('_');
    return { main, sub: rest.length ? rest.join('_') : null };
  }
  return { main: cat, sub: null };
};

const formatMoney = (n) => `$${(Number(n) || 0).toLocaleString('en-US')}`;

// начало недели (понедельник) от даты
const startOfWeek = (d) => {
  const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = dt.getUTCDay() || 7; // 1..7 (Mon..Sun)
  if (day !== 1) dt.setUTCDate(dt.getUTCDate() - (day - 1));
  return dt;
};
const ymd = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const ym = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

// ================= COMPONENT =================
const ExpensesDashboard = ({ user, boardKey = DEFAULT_EXPENSES_BOARD_KEY }) => {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState({
    dateRange: 'current-month', // all | current-month | last-month | current-year
    category: 'all',            // 'all' | 'uncategorized' | <MAIN_CATEGORY>
    granularity: 'auto',        // auto | day | week | month
  });

  const [columnsById, setColumnsById] = useState({});
  const [usersById, setUsersById]   = useState({});
  const [bootstrapDone, setBootstrapDone] = useState(false);

  // --- Access check (как у тебя) ---
  const noAccess =
    !user ||
    (!Array.isArray(user.roles)) ||
    (!user.roles.includes('admin') && !user.roles.includes('main_admin'));

  // --- Bootstrap: попытка взять доску и колонки (если 404 — не критично) + пользователи ---
  const bootstrap = useCallback(async () => {
    try {
      // колонки доски (для красивых названий статусов)
      try {
        const { data: board } = await boardsAPI.getByKey(boardKey);
        const { data: cols } = await columnsAPI.getByBoardId(board.id);
        const map = {};
        (cols || []).forEach((c) => { if (c?.id) map[c.id] = c.name || c.key || c.id; });
        setColumnsById(map);
      } catch (e) {
        // 404 — просто работаем без имён колонок
        console.warn('ExpensesDashboard: board/columns not found, continue without columns', e?.response?.status);
      }

      // пользователи (для департаментов по исполнителю/создателю)
      try {
        const resUsers = await usersAPI.getAll();
        const m = {};
        (resUsers?.data || []).forEach(u => { m[u.id] = u; });
        setUsersById(m);
      } catch (e) {
        console.warn('ExpensesDashboard: users not loaded, departments may be "UNSPECIFIED"');
      }
    } finally {
      setBootstrapDone(true);
    }
  }, [boardKey]);

  useEffect(() => { bootstrap(); }, [bootstrap]);

  // --- Загрузка расходов (ИСКЛЮЧИТЕЛЬНО ЧЕРЕЗ expensesAPI) ---
  const fetchExpenses = useCallback(async () => {
    try {
      setLoading(true);
      const res = await expensesAPI.getByBoard(boardKey);
      const list = Array.isArray(res.data) ? res.data : [];
      setExpenses(list.filter((t) => t && t.amount != null));
    } catch (error) {
      console.error('Load expenses error:', error);
      toast.error('Failed to load expenses data');
    } finally {
      setLoading(false);
    }
  }, [boardKey]);

  useEffect(() => {
    if (bootstrapDone) {
      fetchExpenses();
    }
  }, [bootstrapDone, fetchExpenses, filters.dateRange, filters.category]);

  // --- Фильтрация по текущим фильтрам ---
  const filteredExpenses = useMemo(() => {
    if (!Array.isArray(expenses)) return [];

    const now = new Date();
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    return expenses.filter((expense) => {
      // Категория
      if (filters.category !== 'all') {
        const { main } = splitCategory(expense.category);
        if (filters.category === 'uncategorized') {
          if (main !== 'uncategorized') return false;
        } else if (main !== filters.category) {
          return false;
        }
      }

      // Дата
      const createdAtRaw =
        expense.created_at || expense.createdAt || expense.updated_at || expense.updatedAt;
      const createdAt = createdAtRaw ? new Date(createdAtRaw) : null;
      if (!createdAt) return true;

      switch (filters.dateRange) {
        case 'current-month':
          return (
            createdAt.getMonth() === now.getMonth() &&
            createdAt.getFullYear() === now.getFullYear()
          );
        case 'last-month':
          return (
            createdAt.getMonth() === lastMonthDate.getMonth() &&
            createdAt.getFullYear() === lastMonthDate.getFullYear()
          );
        case 'current-year':
          return createdAt.getFullYear() === now.getFullYear();
        case 'all':
        default:
          return true;
      }
    });
  }, [expenses, filters]);

  // --- Агрегации общие ---
  const { totalAmount, averageExpense, expenseCount, dateSpanDays } = useMemo(() => {
    const total = filteredExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const count = filteredExpenses.length;

    let minD = null, maxD = null;
    filteredExpenses.forEach(e => {
      const d = new Date(e.created_at || e.createdAt || e.updated_at || e.updatedAt || Date.now());
      if (!minD || d < minD) minD = d;
      if (!maxD || d > maxD) maxD = d;
    });
    const span = minD && maxD ? Math.max(1, Math.round((maxD - minD) / 86400000)) : 1;

    return {
      totalAmount: total,
      averageExpense: count > 0 ? total / count : 0,
      expenseCount: count,
      dateSpanDays: span,
    };
  }, [filteredExpenses]);

  // --- Категории: main/sub дерево ---
  const categoriesTree = useMemo(() => {
    const result = {};
    filteredExpenses.forEach((e) => {
      const { main, sub } = splitCategory(e.category);
      if (!result[main]) {
        result[main] = {
          name:
            EXPENSE_CATEGORIES[main]?.name ||
            (main === 'uncategorized' ? 'Uncategorized' : titleFromSlug(main)),
          total: 0,
          count: 0,
          subcategories: {},
        };
      }
      result[main].total += Number(e.amount) || 0;
      result[main].count += 1;

      if (sub) {
        if (!result[main].subcategories[sub]) {
          result[main].subcategories[sub] = {
            name:
              EXPENSE_CATEGORIES[main]?.subcategories?.[sub] || titleFromSlug(sub),
            total: 0,
            count: 0,
          };
        }
        result[main].subcategories[sub].total += Number(e.amount) || 0;
        result[main].subcategories[sub].count += 1;
      }
    });
    return result;
  }, [filteredExpenses]);

  // --- Департаменты ---
  const departmentOfExpense = (e) => {
    // 1) явное поле в расходе
    const direct = e.department || (Array.isArray(e.departments) && e.departments[0]);
    if (direct) return String(direct).toUpperCase();

    // 2) по ассайни
    if (e.assignee_id && usersById[e.assignee_id]?.departments?.length) {
      return String(usersById[e.assignee_id].departments[0]).toUpperCase();
    }

    // 3) по создателю
    if (e.creator_id && usersById[e.creator_id]?.departments?.length) {
      return String(usersById[e.creator_id].departments[0]).toUpperCase();
    }

    return 'UNSPECIFIED';
  };

  const departmentsAgg = useMemo(() => {
    const map = {};
    filteredExpenses.forEach(e => {
      const dep = departmentOfExpense(e);
      if (!map[dep]) map[dep] = { name: dep, total: 0, count: 0 };
      map[dep].total += Number(e.amount) || 0;
      map[dep].count += 1;
    });
    return map;
  }, [filteredExpenses, usersById]);

  // --- Данные для графиков по категориям ---
  const categoryPieData = useMemo(() => {
    const arr = Object.entries(categoriesTree).map(([key, v]) => ({
      key,
      name: v.name,
      value: Math.round(v.total),
    }));
    arr.sort((a, b) => b.value - a.value);
    return arr;
  }, [categoriesTree]);

  const categoryBarData = useMemo(() => {
    const arr = Object.entries(categoriesTree).map(([key, v]) => ({
      key,
      name: v.name,
      amount: Math.round(v.total),
      count: v.count,
    }));
    arr.sort((a, b) => b.amount - a.amount);
    return arr;
  }, [categoriesTree]);

  // --- Данные для графиков по департаментам ---
  const departmentsPieData = useMemo(() => {
    const arr = Object.values(departmentsAgg).map(v => ({
      name: v.name,
      value: Math.round(v.total),
    }));
    arr.sort((a, b) => b.value - a.value);
    return arr;
  }, [departmentsAgg]);

  const departmentsBarData = useMemo(() => {
    const arr = Object.values(departmentsAgg).map(v => ({
      name: v.name,
      amount: Math.round(v.total),
      count: v.count,
    }));
    arr.sort((a, b) => b.amount - a.amount);
    return arr;
  }, [departmentsAgg]);

  // --- Линейный график по времени с регулируемой гранулярностью ---
  const timeSeriesData = useMemo(() => {
    const items = filteredExpenses.map((e) => {
      const d = new Date(
        e.created_at || e.createdAt || e.updated_at || e.updatedAt || Date.now()
      );
      return { date: d, amount: Number(e.amount) || 0 };
    });
    if (items.length === 0) return [];

    items.sort((a, b) => a.date - b.date);

    const chooseGran = () => {
      if (filters.granularity !== 'auto') return filters.granularity;
      if (dateSpanDays > 92) return 'month';
      if (dateSpanDays > 21) return 'week';
      return 'day';
    };
    const gran = chooseGran();

    const byKey = new Map();
    for (const it of items) {
      let key;
      if (gran === 'month') key = ym(it.date);
      else if (gran === 'week') key = ymd(startOfWeek(it.date));
      else key = ymd(it.date); // day
      byKey.set(key, (byKey.get(key) || 0) + it.amount);
    }

    const series = Array.from(byKey.entries()).map(([k, v]) => ({
      label: k,
      value: Math.round(v),
    }));
    series.sort((a, b) => (a.label > b.label ? 1 : -1));
    return series;
  }, [filteredExpenses, filters.granularity, dateSpanDays]);

  // --- Статусы/колонки ---
  const statusData = useMemo(() => {
    const result = {};
    filteredExpenses.forEach((e) => {
      const colId = e.column_id || e.columnId || 'unknown';
      if (!result[colId]) result[colId] = { total: 0, count: 0 };
      result[colId].total += Number(e.amount) || 0;
      result[colId].count += 1;
    });
    return result;
  }, [filteredExpenses]);

  // --- UI ---
  if (noAccess) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">Access Denied</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Only administrators can access the expenses dashboard.
        </p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto bg-white dark:bg-gray-900 min-h-screen transition-colors duration-300">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Expenses Dashboard
        </h1>
        <p className="text-gray-600 dark:text-gray-300">
          Overview of expenses by categories, departments and time
        </p>
      </div>

      {/* Filters */}
      <Card className="mb-8 dark:bg-gray-800 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-gray-900 dark:text-gray-100">
            <Filter className="w-5 h-5" />
            <span>Filters</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Date Range
              </label>
              <Select
                value={filters.dateRange}
                onValueChange={(value) => setFilters((f) => ({ ...f, dateRange: value }))}
              >
                <SelectTrigger className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="dark:bg-gray-700 dark:border-gray-600">
                  <SelectItem value="all" className="dark:text-gray-200">All Time</SelectItem>
                  <SelectItem value="current-month" className="dark:text-gray-200">Current Month</SelectItem>
                  <SelectItem value="last-month" className="dark:text-gray-200">Last Month</SelectItem>
                  <SelectItem value="current-year" className="dark:text-gray-200">Current Year</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Category
              </label>
              <Select
                value={filters.category}
                onValueChange={(value) => setFilters((f) => ({ ...f, category: value }))}
              >
                <SelectTrigger className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="dark:bg-gray-700 dark:border-gray-600">
                  <SelectItem value="all" className="dark:text-gray-200">All Categories</SelectItem>
                  <SelectItem value="uncategorized" className="dark:text-gray-200">Uncategorized</SelectItem>
                  {Object.entries(EXPENSE_CATEGORIES).map(([key, category]) => (
                    <SelectItem key={key} value={key} className="dark:text-gray-200">
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Time Granularity
              </label>
              <Select
                value={filters.granularity}
                onValueChange={(value) => setFilters((f) => ({ ...f, granularity: value }))}
              >
                <SelectTrigger className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="dark:bg-gray-700 dark:border-gray-600">
                  <SelectItem value="auto" className="dark:text-gray-200">Auto</SelectItem>
                  <SelectItem value="day" className="dark:text-gray-200">Day</SelectItem>
                  <SelectItem value="week" className="dark:text-gray-200">Week</SelectItem>
                  <SelectItem value="month" className="dark:text-gray-200">Month</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button onClick={fetchExpenses} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white">
                <Download className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center space-x-2 text-gray-900 dark:text-gray-100">
              <DollarSign className="w-5 h-5 text-green-600" />
              <span>Total Expenses</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{formatMoney(totalAmount)}</div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {expenseCount} item{expenseCount !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center space-x-2 text-gray-900 dark:text-gray-100">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              <span>Average Expense</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">
              {formatMoney(Math.round(averageExpense))}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Per expense item</p>
          </CardContent>
        </Card>

        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center space-x-2 text-gray-900 dark:text-gray-100">
              <Calendar className="w-5 h-5 text-purple-600" />
              <span>Granularity</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold text-purple-600">
              {filters.granularity === 'auto' ? 'Auto' : filters.granularity.toUpperCase()}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{dateSpanDays} day span</p>
          </CardContent>
        </Card>
      </div>

      {/* CHARTS: Категории */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Pie by category */}
        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-gray-900 dark:text-gray-100">
              <PieIcon className="w-5 h-5" />
              <span>Share by Category</span>
            </CardTitle>
          </CardHeader>
          <CardContent style={{ height: 360 }}>
            {categoryPieData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryPieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={120}
                    label={(d) =>
                      `${d.name}: ${((d.value / (totalAmount || 1)) * 100).toFixed(1)}%`
                    }
                  >
                    {categoryPieData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatMoney(v)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-sm text-gray-500 dark:text-gray-400">No data</div>
            )}
          </CardContent>
        </Card>

        {/* Bar by category */}
        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-gray-900 dark:text-gray-100">
              <BarChart3 className="w-5 h-5" />
              <span>Amount by Category</span>
            </CardTitle>
          </CardHeader>
          <CardContent style={{ height: 360 }}>
            {categoryBarData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryBarData} margin={{ top: 10, right: 10, left: 0, bottom: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" interval={0} angle={-20} textAnchor="end" height={60} />
                  <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                  <Tooltip formatter={(v) => formatMoney(v)} />
                  <Bar dataKey="amount">
                    {categoryBarData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-sm text-gray-500 dark:text-gray-400">No data</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Timeseries */}
      <Card className="mb-8 dark:bg-gray-800 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="text-gray-900 dark:text-gray-100">Spending Over Time</CardTitle>
        </CardHeader>
        <CardContent style={{ height: 360 }}>
          {timeSeriesData.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeSeriesData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                <Tooltip formatter={(v) => formatMoney(v)} />
                <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-sm text-gray-500 dark:text-gray-400">No data</div>
          )}
        </CardContent>
      </Card>

      {/* Категории: список + сабкатегории */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Main Categories (progress list) */}
        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-gray-900 dark:text-gray-100">
              <PieIcon className="w-5 h-5" />
              <span>Categories Overview</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(categoriesTree).map(([key, data]) => (
                <div key={key} className="p-4 border rounded-lg dark:border-gray-600">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">{data.name}</h3>
                    <Badge variant="outline" className="dark:border-gray-500 dark:text-gray-200">
                      {data.count} item{data.count !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                  <div className="text-2xl font-bold text-green-600">
                    {formatMoney(data.total)}
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2 mt-2">
                    <div
                      className="bg-green-600 h-2 rounded-full"
                      style={{ width: `${totalAmount ? (data.total / totalAmount) * 100 : 0}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {totalAmount ? ((data.total / totalAmount) * 100).toFixed(1) : '0.0'}% of total
                  </p>
                </div>
              ))}
              {!Object.keys(categoriesTree).length && (
                <div className="text-sm text-gray-500 dark:text-gray-400">No data</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Subcategories Detail */}
        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-gray-900 dark:text-gray-100">
              <BarChart3 className="w-5 h-5" />
              <span>Subcategories Detail</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-96 overflow-y-auto">
            <div className="space-y-6">
              {Object.entries(categoriesTree).map(([mainKey, mainData]) => (
                <div key={mainKey}>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 border-b dark:border-gray-600 pb-2">
                    {mainData.name}
                  </h3>
                  <div className="space-y-2 ml-4">
                    {Object.keys(mainData.subcategories).length ? (
                      Object.entries(mainData.subcategories).map(([subKey, subData]) => (
                        <div
                          key={subKey}
                          className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded"
                        >
                          <span className="text-sm text-gray-700 dark:text-gray-300">{subData.name}</span>
                          <div className="text-right">
                            <div className="font-semibold text-gray-900 dark:text-gray-100">
                              {formatMoney(subData.total)}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {subData.count} item{subData.count !== 1 ? 's' : ''}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-gray-500 dark:text-gray-400 italic">
                        No subcategories
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {!Object.keys(categoriesTree).length && (
                <div className="text-sm text-gray-500 dark:text-gray-400">No data</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ДЕПАРТАМЕНТЫ */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Pie by department */}
        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-gray-900 dark:text-gray-100">
              <GroupIcon className="w-5 h-5" />
              <span>Share by Department</span>
            </CardTitle>
          </CardHeader>
          <CardContent style={{ height: 360 }}>
            {departmentsPieData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={departmentsPieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={120}
                    label={(d) =>
                      `${d.name}: ${((d.value / (totalAmount || 1)) * 100).toFixed(1)}%`
                    }
                  >
                    {departmentsPieData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatMoney(v)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-sm text-gray-500 dark:text-gray-400">No data</div>
            )}
          </CardContent>
        </Card>

        {/* Bar by department */}
        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-gray-900 dark:text-gray-100">
              <BarChart3 className="w-5 h-5" />
              <span>Amount by Department</span>
            </CardTitle>
          </CardHeader>
          <CardContent style={{ height: 360 }}>
            {departmentsBarData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={departmentsBarData} margin={{ top: 10, right: 10, left: 0, bottom: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" interval={0} angle={-10} textAnchor="end" height={40} />
                  <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                  <Tooltip formatter={(v) => formatMoney(v)} />
                  <Bar dataKey="amount">
                    {departmentsBarData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-sm text-gray-500 dark:text-gray-400">No data</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Таблица по статусам/колонкам */}
      <div className="mt-8">
        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-gray-100">Status (by Column)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(statusData).map(([colId, stat]) => (
              <div key={colId} className="flex items-center justify-between p-2 border rounded dark:border-gray-700">
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {columnsById[colId] || colId}
                </span>
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {formatMoney(stat.total)} ({stat.count})
                </span>
              </div>
            ))}
            {!Object.keys(statusData).length && (
              <div className="text-sm text-gray-500 dark:text-gray-400">No data for the selected period.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ExpensesDashboard;