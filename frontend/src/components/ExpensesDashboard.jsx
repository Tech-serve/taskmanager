// src/components/ExpensesDashboard.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { EXPENSE_CATEGORIES } from './CategorySelector';
import { boardsAPI, columnsAPI, tasksAPI } from '../lib/api';
import { toast } from 'sonner';
import {
  DollarSign,
  TrendingUp,
  Calendar,
  PieChart as PieIcon,
  BarChart3,
  Filter,
  Download,
} from 'lucide-react';

// recharts
import {
  ResponsiveContainer,
  PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line
} from 'recharts';

const BOARD_KEY_EXPENSES = 'EXP';

// ПАЛИТРА для графиков
const COLORS = [
  '#3b82f6', '#22c55e', '#ef4444', '#a855f7', '#eab308',
  '#06b6d4', '#f97316', '#84cc16', '#f43f5e', '#8b5cf6',
  '#14b8a6', '#f59e0b', '#64748b', '#10b981', '#fb7185'
];

// ===== вспомогалки для категорий =====
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

const formatRub = (n) => `₽${(Number(n) || 0).toLocaleString('ru-RU')}`;

// ================= COMPONENT =================
const ExpensesDashboard = ({ user }) => {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState({
    dateRange: 'current-month', // all | current-month | last-month | current-year
    category: 'all',            // 'all' | 'uncategorized' | <MAIN_CATEGORY>
  });

  const [columnsById, setColumnsById] = useState({});
  const [bootstrapDone, setBootstrapDone] = useState(false);

  // --- Access check (оставляю как у тебя) ---
  const noAccess =
    !user ||
    (!Array.isArray(user.roles)) ||
    (!user.roles.includes('admin') && !user.roles.includes('main_admin'));

  // --- Bootstrap: получить id доски и её колонки ---
  const bootstrap = useCallback(async () => {
    try {
      const { data: board } = await boardsAPI.getByKey(BOARD_KEY_EXPENSES);
      const { data: cols } = await columnsAPI.getByBoardId(board.id);

      const map = {};
      (cols || []).forEach((c) => {
        if (c?.id) map[c.id] = c.name || c.key || c.id;
      });
      setColumnsById(map);
      setBootstrapDone(true);
    } catch (e) {
      console.error('ExpensesDashboard bootstrap error:', e);
      toast.error('Failed to bootstrap expenses board');
      setBootstrapDone(true);
    }
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  // --- Загрузка расходов (tasks с amount) ---
  const fetchExpenses = useCallback(async () => {
    try {
      setLoading(true);
      const res = await tasksAPI.getByBoard(BOARD_KEY_EXPENSES);
      const list = Array.isArray(res.data) ? res.data : [];
      // оставляем только те, где есть сумма
      setExpenses(list.filter((t) => t && t.amount != null));
    } catch (error) {
      console.error('Load expenses error:', error);
      toast.error('Failed to load expenses data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Загружаем расходы после bootstrap и при изменении фильтров
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
      // Категория (поддержка пустых и underscore)
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

  // --- Агрегации ---
  const { totalAmount, averageExpense, expenseCount } = useMemo(() => {
    const total = filteredExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const count = filteredExpenses.length;
    return {
      totalAmount: total,
      averageExpense: count > 0 ? total / count : 0,
      expenseCount: count,
    };
  }, [filteredExpenses]);

  // Категории: main/sub дерево
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

  // Данные для ГРАФИКОВ
  const categoryPieData = useMemo(() => {
    const arr = Object.entries(categoriesTree).map(([key, v]) => ({
      key,
      name: v.name,
      value: Math.round(v.total),
    }));
    // сорт по сумме
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

  // Линейный график по времени (автогрануляция: день для коротких периодов, месяц — для длинных)
  const timeSeriesData = useMemo(() => {
    const items = filteredExpenses.map((e) => {
      const d = new Date(
        e.created_at || e.createdAt || e.updated_at || e.updatedAt || Date.now()
      );
      return { date: d, amount: Number(e.amount) || 0 };
    });
    if (items.length === 0) return [];

    // сортировка по дате
    items.sort((a, b) => a.date - b.date);

    const first = items[0].date;
    const last = items[items.length - 1].date;
    const diffDays = Math.max(1, Math.round((last - first) / 86400000));

    const byKey = new Map();
    const fmt = (d) =>
      diffDays > 92
        ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` // YYYY-MM
        : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
            d.getDate()
          ).padStart(2, '0')}`; // YYYY-MM-DD

    for (const it of items) {
      const key = fmt(it.date);
      byKey.set(key, (byKey.get(key) || 0) + it.amount);
    }

    const series = Array.from(byKey.entries()).map(([k, v]) => ({
      label: k,
      value: Math.round(v),
    }));
    // уже отсортировано по возрастанию ключа из Map — но перестрахуемся
    series.sort((a, b) => (a.label > b.label ? 1 : -1));
    return series;
  }, [filteredExpenses]);

  // По статусам/колонкам
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
          Overview of expenses by categories and subcategories
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

            <div className="flex items-end">
              <Button onClick={fetchExpenses} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white">
                <Download className="w-4 h-4 mr-2" />
                Refresh / Export Data
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
            <div className="text-3xl font-bold text-green-600">{formatRub(totalAmount)}</div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {expenseCount} expense{expenseCount !== 1 ? 's' : ''}
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
              {formatRub(Math.round(averageExpense))}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Per expense item</p>
          </CardContent>
        </Card>

        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center space-x-2 text-gray-900 dark:text-gray-100">
              <Calendar className="w-5 h-5 text-purple-600" />
              <span>Period</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold text-purple-600">
              {filters.dateRange === 'all' && 'All Time'}
              {filters.dateRange === 'current-month' && 'Current Month'}
              {filters.dateRange === 'last-month' && 'Last Month'}
              {filters.dateRange === 'current-year' && 'Current Year'}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Selected time range</p>
          </CardContent>
        </Card>
      </div>

      {/* CHARTS */}
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
                  <Tooltip formatter={(v) => formatRub(v)} />
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
                  <Tooltip formatter={(v) => formatRub(v)} />
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
                <Tooltip formatter={(v) => formatRub(v)} />
                <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-sm text-gray-500 dark:text-gray-400">No data</div>
          )}
        </CardContent>
      </Card>

      {/* Категории: список + сабкатегории (как у тебя) */}
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
                    {formatRub(data.total)}
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
                              {formatRub(subData.total)}
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

      {/* Статусы/колонки по суммам */}
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
                  {formatRub(stat.total)} ({stat.count})
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