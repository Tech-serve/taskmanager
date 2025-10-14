'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { toast } from 'sonner';
import { Plus, Edit2, Trash2, ToggleLeft, ToggleRight, Search } from 'lucide-react';

const upper = (s) => String(s ?? '').trim().toUpperCase();

export default function DepartmentsAdmin() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const [filter, setFilter] = useState('');
  const [openAdd, setOpenAdd] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [current, setCurrent] = useState(null);

  const [form, setForm] = useState({ key: '', name: '', description: '' });

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/admin/departments');
      setItems(r.data || []);
    } catch {
      toast.error('Failed to load departments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = filter.toLowerCase();
    return (items || []).filter(i =>
      (i.name || '').toLowerCase().includes(q) ||
      (i.key || '').toLowerCase().includes(q) ||
      (i.description || '').toLowerCase().includes(q)
    );
  }, [items, filter]);

  const startAdd = () => {
    setForm({ key: '', name: '', description: '' });
    setOpenAdd(true);
  };

  const submitAdd = async () => {
    try {
      if (!form.key || !form.name) {
        return toast.error('Key and Name are required');
      }
      await api.post('/admin/departments', {
        key: upper(form.key),
        name: form.name,
        description: form.description || '',
      });
      toast.success('Department created');
      setOpenAdd(false);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Create failed');
    }
  };

  const startEdit = (dep) => {
    setCurrent(dep);
    setForm({ key: dep.key, name: dep.name, description: dep.description || '' });
    setOpenEdit(true);
  };

  const submitEdit = async () => {
    try {
      await api.patch(`/admin/departments/${current.id}`, {
        key: upper(form.key),
        name: form.name,
        description: form.description || '',
      });
      toast.success('Department updated');
      setOpenEdit(false);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Update failed');
    }
  };

  const toggleActive = async (dep) => {
    try {
      await api.patch(`/admin/departments/${dep.id}`, { isActive: !dep.isActive });
      load();
    } catch {
      toast.error('Update failed');
    }
  };

  const remove = async (dep) => {
    try {
      await api.delete(`/admin/departments/${dep.id}`);
      toast.success('Department deleted');
      load();
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Delete failed');
    }
  };

  return (
    <div className="h-full min-h-0 flex flex-col p-6">
      <div className="flex items-center justify-between gap-3 shrink-0">
        <div className="flex-1">
          <h2 className="text-xl font-semibold text-gray-900">Departments</h2>
          <p className="text-gray-600">Create and manage departments. Keys are UPPERCASE.</p>
        </div>
        <Button onClick={startAdd} className="shrink-0">
          <Plus className="w-4 h-4 mr-2" /> Add Department
        </Button>
      </div>

      <div className="relative max-w-md mt-4 shrink-0">
        <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
        <Input
          placeholder="Search by name, key or description…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto mt-4">
        <Card>
          <CardHeader>
            <CardTitle>All Departments</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8 text-center text-gray-500">Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="py-8 text-center text-gray-500">No departments yet</div>
            ) : (
              <div className="space-y-2">
                {filtered.map(d => (
                  <div key={d.id} className="flex items-center justify-between border rounded p-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{d.key}</Badge>
                        <span className="font-medium">{d.name}</span>
                        {!d.isActive && <Badge className="bg-gray-200 text-gray-700">inactive</Badge>}
                      </div>
                      {d.description && <div className="text-sm text-gray-600">{d.description}</div>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" onClick={() => toggleActive(d)} title="Enable/Disable">
                        {d.isActive ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                      </Button>
                      <Button variant="outline" onClick={() => startEdit(d)}>
                        <Edit2 className="w-4 h-4 mr-1" /> Edit
                      </Button>
                      <Button variant="destructive" onClick={() => remove(d)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add */}
      <Dialog open={openAdd} onOpenChange={setOpenAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Department</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Key (UPPERCASE, unique)</Label>
              <Input
                value={form.key}
                onChange={e => setForm({ ...form, key: e.target.value.toUpperCase() })}
                placeholder="e.g. GAMBLING"
              />
            </div>
            <div>
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="Department name"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Input
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="optional"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenAdd(false)}>Cancel</Button>
            <Button onClick={submitAdd}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit */}
      <Dialog open={openEdit} onOpenChange={setOpenEdit}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Department</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Key</Label>
              <Input
                value={form.key}
                onChange={e => setForm({ ...form, key: e.target.value.toUpperCase() })}
              />
            </div>
            <div>
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <Label>Description</Label>
              <Input
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenEdit(false)}>Cancel</Button>
            <Button onClick={submitEdit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}