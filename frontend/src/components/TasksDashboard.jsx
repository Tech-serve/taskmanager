// src/components/TasksDashboard.jsx
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from './ui/select';
import { boardsAPI, columnsAPI, tasksAPI, usersAPI } from '../lib/api';
import { toast } from 'sonner';
import {
  Filter, Download, Calendar, ListChecks, Users, BarChart3, PieChart as PieIcon, TrendingUp
} from 'lucide-react';

// recharts
import {
  ResponsiveContainer,
  PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line
} from 'recharts';

const COLORS = [
  '#3b82f6', '#22c55e', '#ef4444', '#a855f7', '#eab308',
  '#06b6d4', '#f97316', '#84cc16', '#f43f5e', '#8b5cf6',
  '#14b8a6', '#f59e0b', '#64748b', '#10b981', '#fb7185'
];

const titleCase = (s='') => String(s).replace(/[_-]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
const fmtNum = (n)=> (Number(n)||0).toLocaleString('en-US');

const DONE_KEYS = ['DONE','CLOSED','APPROVED','PAID','RESOLVED','FINISHED']; // эвристика

export default function TasksDashboard({ user }) {
  // доступ (как в ExpensesDashboard)
  const noAccess = !user || !Array.isArray(user.roles);

  const [loading, setLoading] = useState(true);
  const [boards, setBoards]   = useState([]);                 // все доски (кроме expenses)
  const [columnsByBoard, setColumnsByBoard] = useState({});   // boardId -> { list:[], byId:{} }
  const [users, setUsers] = useState([]);
  const [tasks, setTasks] = useState([]); // все задачи со всех досок

  // фильтры
  const [filters, setFilters] = useState({
    dateRange: 'current-month', // all | last-7 | last-30 | current-month | last-month | current-year
    boardKey: 'all',            // all | <BOARD_KEY>
    department: 'all',          // all | <DEPT>
    priority: 'all',            // all | high | medium | low
    assignee: 'all',            // all | unassigned | <userId>
  });

  // --- bootstrap: boards + users + columns + tasks
  const bootstrap = useCallback(async () => {
    try {
      setLoading(true);
      const [boardsRes, usersRes] = await Promise.all([
        boardsAPI.getAll(),
        usersAPI.getAll(),
      ]);

      // отфильтруем доски только с типом задач (исключим 'expenses')
      const allBoards = (boardsRes.data || []).filter(b => (b?.type || 'tasks') !== 'expenses');
      setBoards(allBoards);
      setUsers(usersRes.data || []);

      // подгрузим колонки и сразу задачи по каждой доске
      const columnsMap = {};
      const allTasks = [];

      for (const b of allBoards) {
        // columns
        try {
          const colsRes = await columnsAPI.getByBoardId(b.id);
          const list = colsRes.data || [];
          const byId = {};
          list.forEach(c => { byId[c.id] = c; });
          columnsMap[b.id] = { list, byId };
        } catch {
          columnsMap[b.id] = { list: [], byId: {} };
        }

        // tasks
        try {
          const tRes = await tasksAPI.getByBoard(b.key);
          const arr = Array.isArray(tRes.data) ? tRes.data : [];
          // приклеим board мету
          arr.forEach(t => allTasks.push({ ...t, __board: { id: b.id, key: b.key, name: b.name }}));
        } catch (e) {
          console.warn('Tasks load failed for board', b.key, e?.response?.status);
        }
      }

      setColumnsByBoard(columnsMap);
      setTasks(allTasks);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load tasks dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { bootstrap(); }, [bootstrap]);

  // вспомогалки
  const usersById = useMemo(() => {
    const map = {};
    (users||[]).forEach(u => { map[u.id] = u; });
    return map;
  }, [users]);

  const allDepartments = useMemo(() => {
    const set = new Set();
    (users||[]).forEach(u => (u.departments||[]).forEach(d => set.add(d)));
    return Array.from(set).sort();
  }, [users]);

  const dateFits = (d, range) => {
    if (!d) return true;
    const dt = new Date(d);
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth()-1, 1);
    const lastMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 0); // последний день прошлого месяца

    if (range === 'all') return true;

    if (range === 'last-7') {
      const since = new Date(now.getTime() - 7*86400000);
      return dt >= since && dt <= now;
    }
    if (range === 'last-30') {
      const since = new Date(now.getTime() - 30*86400000);
      return dt >= since && dt <= now;
    }
    if (range === 'current-month') {
      return dt >= startOfMonth && dt <= now;
    }
    if (range === 'last-month') {
      return dt >= lastMonthStart && dt <= lastMonthEnd;
    }
    if (range === 'current-year') {
      return dt.getFullYear() === now.getFullYear();
    }
    return true;
  };

  const deriveDepartments = (task) => {
    // берём департаменты исполнителя, если нет — создателя
    const assignee = task.assignee_id ? usersById[task.assignee_id] : null;
    const creator  = task.creator_id  ? usersById[task.creator_id]  : null;
    const depts = (assignee?.departments?.length ? assignee.departments
                 : creator?.departments?.length ? creator.departments
                 : []);
    return depts?.length ? depts : ['UNKNOWN'];
  };

  // ---- фильтрация
  const filteredTasks = useMemo(() => {
    return (tasks||[]).filter(t => {
      // по доске
      if (filters.boardKey !== 'all' && t.__board?.key !== filters.boardKey) return false;

      // по дате (created_at || updated_at || due_date)
      const d = t.created_at || t.createdAt || t.updated_at || t.updatedAt || t.due_date || t.dueDate;
      if (!dateFits(d, filters.dateRange)) return false;

      // по приоритету
      if (filters.priority !== 'all' && (t.priority || 'medium') !== filters.priority) return false;

      // по исполнителю
      if (filters.assignee === 'unassigned' && t.assignee_id) return false;
      if (filters.assignee !== 'all' && filters.assignee !== 'unassigned' && t.assignee_id !== filters.assignee) return false;

      // по департаменту
      if (filters.department !== 'all') {
        const depts = deriveDepartments(t);
        if (!depts.includes(filters.department)) return false;
      }

      return true;
    });
  }, [tasks, filters]);

  // ---- метрики
  const totalCount = filteredTasks.length;
  const openCount = useMemo(() => {
    // считаем открытыми все НЕ в финальных колонках по эвристике DONE_KEYS
    let done = 0;
    for (const t of filteredTasks) {
      const boardCols = columnsByBoard[t.__board?.id]?.byId || {};
      const col = boardCols[t.column_id];
      const key = String(col?.key || col?.name || '').toUpperCase();
      const isDone = DONE_KEYS.some(k => key.includes(k));
      if (isDone) done++;
    }
    return totalCount - done;
  }, [filteredTasks, columnsByBoard, totalCount]);

  const avgPerDay = useMemo(() => {
    if (!filteredTasks.length) return 0;
    // период между min/max дат
    const dates = filteredTasks.map(t => new Date(t.created_at || t.createdAt || t.updated_at || t.updatedAt || Date.now()));
    dates.sort((a,b)=>a-b);
    const days = Math.max(1, Math.round((dates.at(-1) - dates[0]) / 86400000) + 1);
    return (filteredTasks.length / days);
  }, [filteredTasks]);

  // ---- графики
  // 1) Временной ряд: сколько задач создано по дням/месяцам (автогрануляция)
  const timeSeries = useMemo(() => {
    const items = filteredTasks.map(t => ({
      date: new Date(t.created_at || t.createdAt || t.updated_at || t.updatedAt || Date.now())
    }));
    if (!items.length) return [];
    items.sort((a,b)=>a.date-b.date);
    const first = items[0].date, last = items.at(-1).date;
    const diffDays = Math.max(1, Math.round((last-first)/86400000));
    const fmt = (d) => diffDays > 92
      ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`   // YYYY-MM
      : `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; // YYYY-MM-DD

    const byKey = new Map();
    items.forEach(it => {
      const k = fmt(it.date);
      byKey.set(k, (byKey.get(k)||0) + 1);
    });
    return Array.from(byKey.entries()).map(([label,value])=>({label, value})).sort((a,b)=> a.label>b.label?1:-1);
  }, [filteredTasks]);

  // 2) По приоритету (pie)
  const priorityPie = useMemo(() => {
    const cnt = {};
    filteredTasks.forEach(t => { cnt[t.priority || 'medium'] = (cnt[t.priority || 'medium']||0)+1; });
    return Object.entries(cnt).map(([name, value]) => ({ name: titleCase(name), value }));
  }, [filteredTasks]);

  // 3) По департаментам (bar)
  const departmentBar = useMemo(() => {
    const cnt = {};
    filteredTasks.forEach(t => {
      for (const d of deriveDepartments(t)) {
        cnt[d] = (cnt[d]||0)+1;
      }
    });
    const arr = Object.entries(cnt).map(([name,value])=>({ name, value }));
    arr.sort((a,b)=>b.value - a.value);
    return arr;
  }, [filteredTasks]);

  // 4) По статусам/колонкам (bar)
  const statusBar = useMemo(() => {
    const cnt = {};
    filteredTasks.forEach(t => {
      const boardCols = columnsByBoard[t.__board?.id]?.byId || {};
      const col = boardCols[t.column_id];
      const name = col?.name || col?.key || 'Unknown';
      cnt[name] = (cnt[name]||0)+1;
    });
    const arr = Object.entries(cnt).map(([name,value])=>({ name, value }));
    arr.sort((a,b)=>b.value - a.value);
    return arr;
  }, [filteredTasks, columnsByBoard]);

  // 5) Сводка по доскам (табличка/список)
  const perBoard = useMemo(() => {
    const map = {};
    filteredTasks.forEach(t => {
      const key = t.__board?.key || 'UNKNOWN';
      if (!map[key]) map[key] = { key, name: t.__board?.name || key, count:0, open:0 };
      map[key].count++;
    });
    // посчитаем open через ту же эвристику
    filteredTasks.forEach(t => {
      const boardCols = columnsByBoard[t.__board?.id]?.byId || {};
      const col = boardCols[t.column_id];
      const key = String(col?.key || col?.name || '').toUpperCase();
      const isDone = DONE_KEYS.some(k => key.includes(k));
      if (!isDone) map[t.__board?.key || 'UNKNOWN'].open++;
    });
    return Object.values(map).sort((a,b)=>b.count - a.count);
  }, [filteredTasks, columnsByBoard]);

  if (noAccess) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Access Denied</h1>
        <p className="text-gray-600 dark:text-gray-400">Sign in to view the tasks dashboard.</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto bg-white dark:bg-gray-900 min-h-screen transition-colors duration-300">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Tasks Dashboard</h1>
        <p className="text-gray-600 dark:text-gray-300">Overview across boards, departments and time</p>
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
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Date Range</label>
              <Select value={filters.dateRange} onValueChange={(v)=>setFilters(f=>({...f, dateRange:v}))}>
                <SelectTrigger className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="dark:bg-gray-700 dark:border-gray-600">
                  <SelectItem value="all" className="dark:text-gray-200">All time</SelectItem>
                  <SelectItem value="last-7" className="dark:text-gray-200">Last 7 days</SelectItem>
                  <SelectItem value="last-30" className="dark:text-gray-200">Last 30 days</SelectItem>
                  <SelectItem value="current-month" className="dark:text-gray-200">Current month</SelectItem>
                  <SelectItem value="last-month" className="dark:text-gray-200">Last month</SelectItem>
                  <SelectItem value="current-year" className="dark:text-gray-200">Current year</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Board */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Board</label>
              <Select value={filters.boardKey} onValueChange={(v)=>setFilters(f=>({...f, boardKey:v}))}>
                <SelectTrigger className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="dark:bg-gray-700 dark:border-gray-600">
                  <SelectItem value="all" className="dark:text-gray-200">All boards</SelectItem>
                  {boards.map(b=>(
                    <SelectItem key={b.id} value={b.key} className="dark:text-gray-200">
                      {b.name} ({b.key})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Department */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Department</label>
              <Select value={filters.department} onValueChange={(v)=>setFilters(f=>({...f, department:v}))}>
                <SelectTrigger className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="dark:bg-gray-700 dark:border-gray-600">
                  <SelectItem value="all" className="dark:text-gray-200">All</SelectItem>
                  {allDepartments.map(d=>(
                    <SelectItem key={d} value={d} className="dark:text-gray-200">{d}</SelectItem>
                  ))}
                  <SelectItem value="UNKNOWN" className="dark:text-gray-200">UNKNOWN</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Priority</label>
              <Select value={filters.priority} onValueChange={(v)=>setFilters(f=>({...f, priority:v}))}>
                <SelectTrigger className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="dark:bg-gray-700 dark:border-gray-600">
                  <SelectItem value="all" className="dark:text-gray-200">All</SelectItem>
                  <SelectItem value="high" className="dark:text-gray-200">High</SelectItem>
                  <SelectItem value="medium" className="dark:text-gray-200">Medium</SelectItem>
                  <SelectItem value="low" className="dark:text-gray-200">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Assignee */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Assignee</label>
              <Select value={filters.assignee} onValueChange={(v)=>setFilters(f=>({...f, assignee:v}))}>
                <SelectTrigger className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="dark:bg-gray-700 dark:border-gray-600 max-h-80">
                  <SelectItem value="all" className="dark:text-gray-200">All</SelectItem>
                  <SelectItem value="unassigned" className="dark:text-gray-200">Unassigned</SelectItem>
                  {users.map(u=>(
                    <SelectItem key={u.id} value={u.id} className="dark:text-gray-200">{u.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4">
            <Button
              onClick={bootstrap}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Download className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center space-x-2 text-gray-900 dark:text-gray-100">
              <ListChecks className="w-5 h-5 text-blue-600" />
              <span>Total Tasks</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{fmtNum(totalCount)}</div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Filtered scope</p>
          </CardContent>
        </Card>

        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center space-x-2 text-gray-900 dark:text-gray-100">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
              <span>Avg / Day</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-600">{avgPerDay.toFixed(2)}</div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Creation rate</p>
          </CardContent>
        </Card>

        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center space-x-2 text-gray-900 dark:text-gray-100">
              <Calendar className="w-5 h-5 text-purple-600" />
              <span>Open Tasks</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600">{fmtNum(openCount)}</div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Not in final columns</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Time series */}
        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-gray-100">Tasks Over Time</CardTitle>
          </CardHeader>
          <CardContent style={{ height: 360 }}>
            {timeSeries.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timeSeries} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : <div className="text-sm text-gray-500 dark:text-gray-400">No data</div>}
          </CardContent>
        </Card>

        {/* Priority pie */}
        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-gray-900 dark:text-gray-100">
              <PieIcon className="w-5 h-5" />
              <span>By Priority</span>
            </CardTitle>
          </CardHeader>
          <CardContent style={{ height: 360 }}>
            {priorityPie.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={priorityPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={120} label>
                    {priorityPie.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : <div className="text-sm text-gray-500 dark:text-gray-400">No data</div>}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Departments bar */}
        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-gray-900 dark:text-gray-100">
              <Users className="w-5 h-5" />
              <span>By Department</span>
            </CardTitle>
          </CardHeader>
        <CardContent style={{ height: 360 }}>
          {departmentBar.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={departmentBar} margin={{ top: 10, right: 10, left: 0, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" interval={0} angle={-15} textAnchor="end" height={50}/>
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value">
                  {departmentBar.map((_,i)=> <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="text-sm text-gray-500 dark:text-gray-400">No data</div>}
        </CardContent>
        </Card>

        {/* Status/Columns bar */}
        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-gray-900 dark:text-gray-100">
              <BarChart3 className="w-5 h-5" />
              <span>By Status (Columns)</span>
            </CardTitle>
          </CardHeader>
          <CardContent style={{ height: 360 }}>
            {statusBar.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusBar.slice(0, 15)} margin={{ top: 10, right: 10, left: 0, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" interval={0} angle={-25} textAnchor="end" height={70}/>
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value">
                    {statusBar.slice(0, 15).map((_,i)=> <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="text-sm text-gray-500 dark:text-gray-400">No data</div>}
          </CardContent>
        </Card>
      </div>

      {/* Per-board summary */}
      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="text-gray-900 dark:text-gray-100">Boards Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {perBoard.length ? perBoard.map(b => (
            <div key={b.key} className="flex items-center justify-between p-3 border rounded dark:border-gray-700">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="dark:border-gray-500 dark:text-gray-200">{b.key}</Badge>
                <span className="font-medium text-gray-900 dark:text-gray-100">{b.name}</span>
              </div>
              <div className="text-sm text-gray-700 dark:text-gray-300">
                Total: <span className="font-semibold">{fmtNum(b.count)}</span> &nbsp;•&nbsp; Open: <span className="font-semibold">{fmtNum(b.open)}</span>
              </div>
            </div>
          )) : <div className="text-sm text-gray-500 dark:text-gray-400">No data</div>}
        </CardContent>
      </Card>
    </div>
  );
}