'use client';
import React from 'react';
import { rolesAPI } from '../lib/api';        // <= из src/components/common → ../../lib/api
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';

export default function RoleSelect({
  label = 'Roles',
  value = [],                  // массив ключей ролей: ['ADMIN','BUYER']
  onChange = () => {},
  required = false,
  disabled = false,
  placeholder = 'Select roles…',
  helperText = null,
  className = '',
}) {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [roles, setRoles] = React.useState([]);
  const [q, setQ] = React.useState('');

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      const r = await rolesAPI.list();                 // axios response
      const items = (r.data || []).filter(x => x.isActive !== false);
      setRoles(items);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const selected = new Set(value);
  const filtered = roles.filter(r =>
    [r.key, r.name].join(' ').toLowerCase().includes(q.trim().toLowerCase())
  );

  function toggle(k) {
    const next = new Set(value);
    next.has(k) ? next.delete(k) : next.add(k);
    onChange(Array.from(next));
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between">
        <Label className="mb-1">
          {label}{required && <span className="text-red-500">*</span>}
        </Label>
        {helperText && <div className="text-xs text-muted-foreground">{helperText}</div>}
      </div>

      {/* Trigger */}
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(v => !v)}
          className="w-full inline-flex items-center justify-between rounded-md border px-3 py-2 text-left text-sm bg-white hover:bg-gray-50 focus:outline-none"
        >
          <div className="flex flex-wrap gap-1">
            {value.length === 0 && <span className="text-gray-400">{placeholder}</span>}
            {value.map(k => {
              const role = roles.find(r => r.key === k);
              return <Badge key={k} variant="outline">{role?.name || k}</Badge>;
            })}
          </div>
          <svg className="h-4 w-4 opacity-60" viewBox="0 0 20 20" fill="currentColor">
            <path d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 011.08 1.04l-4.25 4.25a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z"/>
          </svg>
        </button>

        {/* Dropdown */}
        {open && (
          <div className="absolute z-50 mt-1 w-full rounded-md border bg-white shadow-lg">
            <div className="p-2 border-b">
              <Input
                placeholder="Search roles…"
                value={q}
                onChange={e => setQ(e.target.value)}
              />
            </div>

            <div className="max-h-64 overflow-auto p-1">
              {loading && <div className="p-3 text-sm text-gray-500">Loading…</div>}
              {!loading && filtered.length === 0 && (
                <div className="p-3 text-sm text-gray-500">Nothing found</div>
              )}
              {!loading && filtered.map(r => (
                <label key={r.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={selected.has(r.key)}
                    onChange={() => toggle(r.key)}
                  />
                  <span className="text-sm">
                    {r.name} <span className="text-xs text-gray-500">({r.key})</span>
                  </span>
                </label>
              ))}
            </div>

            <div className="flex items-center justify-between p-2 border-t">
              <Button variant="outline" onClick={() => onChange([])} size="sm">Clear</Button>
              <Button onClick={() => setOpen(false)} size="sm">Done</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}