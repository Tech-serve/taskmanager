import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { EXPENSE_CATEGORIES, getCategoryDisplayName } from './CategorySelector';
import { tasksAPI } from '../lib/api';
import { toast } from 'sonner';
import { 
  DollarSign, 
  TrendingUp, 
  Calendar, 
  PieChart, 
  BarChart3,
  Filter,
  Download
} from 'lucide-react';

const ExpensesDashboard = ({ user }) => {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    dateRange: 'current-month',
    category: 'all',
    status: 'all'
  });

  useEffect(() => {
    fetchExpenses();
  }, [filters]);

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const response = await tasksAPI.getByBoard('EXPENSES');
      setExpenses(response.data.filter(task => task.amount));
    } catch (error) {
      toast.error('Failed to load expenses data');
    } finally {
      setLoading(false);
    }
  };

  // Filter expenses based on current filters
  const filteredExpenses = expenses.filter(expense => {
    // Category filter
    if (filters.category !== 'all' && !expense.category?.startsWith(filters.category)) {
      return false;
    }

    // Date range filter
    const expenseDate = new Date(expense.created_at);
    const now = new Date();
    
    switch (filters.dateRange) {
      case 'current-month':
        return expenseDate.getMonth() === now.getMonth() && 
               expenseDate.getFullYear() === now.getFullYear();
      case 'last-month':
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1);
        return expenseDate.getMonth() === lastMonth.getMonth() && 
               expenseDate.getFullYear() === lastMonth.getFullYear();
      case 'current-year':
        return expenseDate.getFullYear() === now.getFullYear();
      default:
        return true;
    }
  });

  // Calculate statistics
  const totalAmount = filteredExpenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);
  const averageExpense = filteredExpenses.length > 0 ? totalAmount / filteredExpenses.length : 0;
  const expenseCount = filteredExpenses.length;

  // Group by categories
  const categoriesData = {};
  filteredExpenses.forEach(expense => {
    if (expense.category) {
      const [mainCategory] = expense.category.split('.');
      if (!categoriesData[mainCategory]) {
        categoriesData[mainCategory] = {
          name: EXPENSE_CATEGORIES[mainCategory]?.name || mainCategory,
          total: 0,
          count: 0,
          subcategories: {}
        };
      }
      categoriesData[mainCategory].total += expense.amount;
      categoriesData[mainCategory].count += 1;

      // Subcategories
      const [, subCategory] = expense.category.split('.');
      if (subCategory) {
        if (!categoriesData[mainCategory].subcategories[subCategory]) {
          categoriesData[mainCategory].subcategories[subCategory] = {
            name: EXPENSE_CATEGORIES[mainCategory]?.subcategories[subCategory] || subCategory,
            total: 0,
            count: 0
          };
        }
        categoriesData[mainCategory].subcategories[subCategory].total += expense.amount;
        categoriesData[mainCategory].subcategories[subCategory].count += 1;
      }
    }
  });

  // Group by status (columns)
  const statusData = {};
  filteredExpenses.forEach(expense => {
    const status = expense.column_id; // This will be mapped to column names
    if (!statusData[status]) {
      statusData[status] = {
        total: 0,
        count: 0
      };
    }
    statusData[status].total += expense.amount;
    statusData[status].count += 1;
  });

  if (!user || (!user.roles.includes('admin') && !user.roles.includes('main_admin'))) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">Access Denied</h1>
        <p className="text-gray-600 dark:text-gray-400">Only administrators can access the expenses dashboard.</p>
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
              <Select value={filters.dateRange} onValueChange={(value) => setFilters({...filters, dateRange: value})}>
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
              <Select value={filters.category} onValueChange={(value) => setFilters({...filters, category: value})}>
                <SelectTrigger className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="dark:bg-gray-700 dark:border-gray-600">
                  <SelectItem value="all" className="dark:text-gray-200">All Categories</SelectItem>
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
                Export Data
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
            <div className="text-3xl font-bold text-green-600">
              ₽{totalAmount.toLocaleString()}
            </div>
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
              ₽{Math.round(averageExpense).toLocaleString()}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Per expense item
            </p>
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
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Selected time range
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Categories Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Main Categories */}
        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-gray-900 dark:text-gray-100">
              <PieChart className="w-5 h-5" />
              <span>Categories Overview</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(categoriesData).map(([key, data]) => (
                <div key={key} className="p-4 border rounded-lg dark:border-gray-600">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">{data.name}</h3>
                    <Badge variant="outline" className="dark:border-gray-500 dark:text-gray-200">
                      {data.count} item{data.count !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                  <div className="text-2xl font-bold text-green-600">
                    ₽{data.total.toLocaleString()}
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2 mt-2">
                    <div 
                      className="bg-green-600 h-2 rounded-full" 
                      style={{ width: `${(data.total / totalAmount) * 100}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {((data.total / totalAmount) * 100).toFixed(1)}% of total
                  </p>
                </div>
              ))}
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
              {Object.entries(categoriesData).map(([mainKey, mainData]) => (
                <div key={mainKey}>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 border-b dark:border-gray-600 pb-2">
                    {mainData.name}
                  </h3>
                  <div className="space-y-2 ml-4">
                    {Object.entries(mainData.subcategories).map(([subKey, subData]) => (
                      <div key={subKey} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded">
                        <span className="text-sm text-gray-700 dark:text-gray-300">{subData.name}</span>
                        <div className="text-right">
                          <div className="font-semibold text-gray-900 dark:text-gray-100">
                            ₽{subData.total.toLocaleString()}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {subData.count} item{subData.count !== 1 ? 's' : ''}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ExpensesDashboard;