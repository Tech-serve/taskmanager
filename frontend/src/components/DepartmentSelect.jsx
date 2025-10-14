'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Plus, X } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Удобный мультиселект департаментов:
 * - value: string[] (UPPERCASE keys)
 * - onChange: (string[]) => void
 * - allowCreate: boolean (показывать кнопку для быстрого создания нового департамента из селектора)
 * - placeholder: string
 */
const DepartmentSelect = ({
  label = 'Departments',
  value = [],
  onChange,
  allowCreate = true,
  placeholder = 'Select departments…',
}) => {
  const [all, setAll] = useState([]);
  const [openCreate, setOpenCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ key: '', name: '' });

  const load = async () => {
    try {
      const r = await api.get('/admin/departments'); // доступен админу/тимлиду
      setAll((r.data || []).filter(d => d.isActive !== false));
    } catch {
      // fallback: пустой список
      setAll([]);
    }
  };

  useEffect(() => { load(); }, []);

  const selected = useMemo(() => {
    const set = new Set((value || []).map(v => String(v).toUpperCase()));
    return (all || []).filter(d => set.has(d.key));
  }, [value, all]);

  const toggle = (key) => {
    const k = String(key || '').toUpperCase();
    const set = new Set((value || []).map(v => String(v).toUpperCase()));
    if (set.has(k)) set.delete(k); else set.add(k);
    onChange?.(Array.from(set));
  };

  const createQuick = async () => {
    try {
      const key = String(createForm.key || '').toUpperCase();
      const name = String(createForm.name || '').trim();
      if (!key || !name) return toast.error('Key and Name are required');

      await api.post('/admin/departments', { key, name });
      setOpenCreate(false);
      setCreateForm({ key: '', name: '' });
      await load();
      // авто-добавить в выбор
      toggle(key);
      toast.success('Department created');
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Create failed');
    }
  };

  return (
    <div className="space-y-2">
      {label && <Label className="text-sm font-medium text-gray-700 dark:text-white">{label}</Label>}

      {/* кнопки-пилюли со всеми департаментами (активные подсвечены) */}
      <div className="flex flex-wrap gap-2">
        {(all || []).map((d) => {
          const active = (value || []).map(String).map(v => v.toUpperCase()).includes(d.key);
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => toggle(d.key)}
              className={
                'px-2.5 py-1.5 rounded-md text-sm border transition ' +
                (active
                  ? 'bg-indigo-600 text-white border-indigo-600 dark:bg-indigo-500'
                  : 'bg-transparent text-gray-800 dark:text-white border-gray-300 dark:border-gray-300 hover:bg-gray-100 dark:hover:bg-gray-400/40')
              }
              title={d.name}
            >
              {d.name}
              <span className="opacity-70 ml-1 text-xs">({d.key})</span>
            </button>
          );
        })}
      </div>

      {/* выбранные */}
      {(selected || []).length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map((d) => (
            <Badge key={d.key} variant="outline" className="flex items-center gap-1">
              {d.name}
              <button
                type="button"
                className="ml-1 opacity-60 hover:opacity-100"
                onClick={() => toggle(d.key)}
                title="Remove"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* add new inline */}
      {/* {allowCreate && (
        <div className="pt-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setOpenCreate(true)}>
            <Plus className="w-3 h-3 mr-1" /> Add new department
          </Button>
        </div>
      )} */}

      {/* Create dialog */}
      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Department</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Key (UPPERCASE, unique)</Label>
              <Input
                value={createForm.key}
                onChange={(e) => setCreateForm({ ...createForm, key: e.target.value.toUpperCase() })}
                placeholder="e.g. SWIP"
              />
            </div>
            <div>
              <Label>Name</Label>
              <Input
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                placeholder="Sweepstakes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenCreate(false)}>Cancel</Button>
            <Button onClick={createQuick}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DepartmentSelect;