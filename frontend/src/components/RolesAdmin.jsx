import React, { useEffect, useState } from 'react';
import { rolesAPI } from '../../lib/api';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { toast } from 'sonner';

const RolesAdmin = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const [openAdd, setOpenAdd] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [current, setCurrent] = useState(null);
  const [form, setForm] = useState({ key: '', name: '', description: '' });

  const load = async () => {
    setLoading(true);
    try {
      const r = await rolesAPI.list();
      setItems(r.data || []);
    } catch (e) {
      toast.error('Failed to load roles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const startAdd = () => {
    setForm({ key: '', name: '', description: '' });
    setOpenAdd(true);
  };

  const submitAdd = async () => {
    try {
      if (!form.key || !form.name) {
        toast.error('Key and Name are required');
        return;
      }
      await rolesAPI.create({
        key: String(form.key).trim().toLowerCase(),
        name: form.name,
        description: form.description || ''
      });
      toast.success('Role created');
      setOpenAdd(false);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Create failed');
    }
  };

  const startEdit = (role) => {
    setCurrent(role);
    setForm({ key: role.key, name: role.name, description: role.description || '' });
    setOpenEdit(true);
  };

  const submitEdit = async () => {
    try {
      await rolesAPI.update(current.id, {
        key: String(form.key).trim().toLowerCase(),
        name: form.name,
        description: form.description || ''
      });
      toast.success('Role updated');
      setOpenEdit(false);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Update failed');
    }
  };

  const toggleActive = async (role) => {
    try {
      await rolesAPI.update(role.id, { isActive: !role.isActive });
      load();
    } catch {
      toast.error('Update failed');
    }
  };

  const remove = async (role) => {
    try {
      await rolesAPI.remove(role.id);
      toast.success('Role deleted');
      load();
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Delete failed');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Roles</h2>
          <p className="text-gray-600">Create roles and control board visibility by roles</p>
        </div>
        <Button onClick={startAdd}>Add Role</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Roles</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-gray-500">Loading…</div>
          ) : items.length === 0 ? (
            <div className="py-8 text-center text-gray-500">No roles yet</div>
          ) : (
            <div className="space-y-2">
              {items.map(r => (
                <div key={r.id} className="flex items-center justify-between border rounded p-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{r.key}</Badge>
                      <span className="font-medium">{r.name}</span>
                      {!r.isActive && <Badge className="bg-gray-200 text-gray-700">inactive</Badge>}
                    </div>
                    {r.description && <div className="text-sm text-gray-600">{r.description}</div>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => toggleActive(r)}>
                      {r.isActive ? 'Disable' : 'Enable'}
                    </Button>
                    <Button variant="outline" onClick={() => startEdit(r)}>Edit</Button>
                    <Button variant="destructive" onClick={() => remove(r)}>Delete</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add */}
      <Dialog open={openAdd} onOpenChange={setOpenAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Role</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Key (lowercase, unique)</Label>
              <Input value={form.key} onChange={e => setForm({ ...form, key: e.target.value })} placeholder="e.g. qa" />
            </div>
            <div>
              <Label>Name</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. QA Team" />
            </div>
            <div>
              <Label>Description</Label>
              <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="optional" />
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
            <DialogTitle>Edit Role</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Key</Label>
              <Input value={form.key} onChange={e => setForm({ ...form, key: e.target.value })} />
            </div>
            <div>
              <Label>Name</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>Description</Label>
              <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
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
};

export default RolesAdmin;