import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { boardsAPI } from '../lib/api';
import { toast } from 'sonner';
import CreateBoard from './CreateBoard';
import { 
  Kanban, 
  Users, 
  Calendar,
  Plus,
  Archive,
  Settings,
  ArrowRight
} from 'lucide-react';

const BoardsList = ({ user }) => {
  const [boards, setBoards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createBoardOpen, setCreateBoardOpen] = useState(false);

  useEffect(() => {
    fetchBoards();
  }, []);

  const fetchBoards = async () => {
    try {
      const response = await boardsAPI.getAll();
      setBoards(response.data);
    } catch (error) {
      toast.error('Failed to load boards');
    } finally {
      setLoading(false);
    }
  };

  const handleBoardCreated = (newBoard) => {
    setBoards([...boards, newBoard]);
    toast.success(`Board "${newBoard.name}" created successfully`);
  };

  const getBoardColor = (key) => {
    const colors = {
      BUY: 'from-emerald-500 to-teal-600',
      DES: 'from-rose-500 to-pink-600', 
      TECH: 'from-blue-500 to-indigo-600',
      EXPENSES: 'from-amber-500 to-orange-600'
    };
    return colors[key] || 'from-gray-500 to-slate-600';
  };

  const getBoardIcon = (key) => {
    const icons = {
      BUY: '💼',
      DES: '🎨', 
      TECH: '⚡'
    };
    return icons[key] || '📋';
  };

  const getRoleColor = (role) => {
    const colors = {
      admin: 'bg-violet-100 text-violet-800',
      buyer: 'bg-emerald-100 text-emerald-800',
      designer: 'bg-rose-100 text-rose-800',
      tech: 'bg-blue-100 text-blue-800'
    };
    return colors[role] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <div className="h-8 bg-gray-200 rounded-lg w-48 animate-pulse mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-64 animate-pulse"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="pb-3">
                  <div className="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </CardHeader>
                <CardContent>
                  <div className="h-20 bg-gray-200 rounded"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2" data-testid="boards-title">
                My Boards
              </h1>
              <p className="text-gray-600">
                Manage your projects and collaborate with your team
              </p>
            </div>
            
            {/* Only show Create Board button for admins */}
            {user && user.roles && user.roles.includes('admin') && (
              <Button 
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg" 
                onClick={() => setCreateBoardOpen(true)}
                data-testid="create-board-button"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Board
              </Button>
            )}
          </div>
        </div>

        {/* Boards Grid */}
        {boards.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Kanban className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No boards available</h3>
            <p className="text-gray-500 mb-6">You don't have access to any boards yet.</p>
            <Button variant="outline" data-testid="contact-admin-button">
              Contact Admin
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {boards.map((board) => (
              <Card 
                key={board.id} 
                className="card-hover glass border-0 shadow-lg group overflow-hidden"
                data-testid={`board-card-${board.key.toLowerCase()}`}
              >
                {/* Board Header with Gradient */}
                <div className={`h-20 bg-gradient-to-br ${getBoardColor(board.key)} relative`}>
                  <div className="absolute inset-0 bg-black/10"></div>
                  <div className="relative p-4 flex items-center justify-between h-full">
                    <div className="flex items-center space-x-3">
                      <div className="text-2xl">{getBoardIcon(board.key)}</div>
                      <div>
                        <h3 className="font-bold text-white text-lg">{board.name}</h3>
                        <p className="text-white/80 text-sm">{board.key}</p>
                      </div>
                    </div>
                    {board.is_archived && (
                      <Badge className="bg-yellow-500 text-white">
                        <Archive className="w-3 h-3 mr-1" />
                        Archived
                      </Badge>
                    )}
                  </div>
                </div>

                <CardContent className="p-4">
                  {/* Board Info */}
                  <div className="space-y-4">
                    {/* Allowed Roles */}
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-2">Access Roles</p>
                      <div className="flex flex-wrap gap-1">
                        {board.allowed_roles?.map((role) => (
                          <Badge 
                            key={role} 
                            variant="outline" 
                            className={getRoleColor(role)}
                          >
                            {role}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Board Stats */}
                    <div className="flex items-center justify-between text-sm text-gray-500">
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-1">
                          <Users className="w-4 h-4" />
                          <span>{board.members?.length || 0} members</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Calendar className="w-4 h-4" />
                          <span>{new Date(board.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* Settings Info */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 text-sm text-gray-500">
                        <Settings className="w-4 h-4" />
                        <span>Assignee: {board.settings?.assignee_enabled ? 'Enabled' : 'Disabled'}</span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {board.template}
                      </Badge>
                    </div>
                  </div>

                  {/* Action Button */}
                  <div className="mt-6">
                    <Link to={`/boards/${board.key}`} className="w-full">
                      <Button 
                        className="w-full group bg-gray-50 hover:bg-gray-100 text-gray-700 hover:text-gray-900 border border-gray-200"
                        data-testid={`open-board-${board.key.toLowerCase()}-button`}
                      >
                        <span>Open Board</span>
                        <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Quick Stats */}
        {boards.length > 0 && (
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="glass border-0 shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <Kanban className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{boards.length}</p>
                    <p className="text-sm text-gray-600">Active Boards</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass border-0 shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
                    <Users className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">
                      {boards.reduce((sum, board) => sum + (board.members?.length || 0), 0)}
                    </p>
                    <p className="text-sm text-gray-600">Total Members</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass border-0 shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-violet-100 rounded-full flex items-center justify-center">
                    <Settings className="w-6 h-6 text-violet-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">
                      {boards.filter(b => b.settings?.assignee_enabled).length}
                    </p>
                    <p className="text-sm text-gray-600">Assignment Enabled</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Create Board Modal */}
      <CreateBoard 
        open={createBoardOpen} 
        onOpenChange={setCreateBoardOpen}
        onBoardCreated={handleBoardCreated}
      />
    </div>
  );
};

export default BoardsList;