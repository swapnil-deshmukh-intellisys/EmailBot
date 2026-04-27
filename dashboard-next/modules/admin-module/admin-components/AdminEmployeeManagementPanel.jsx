'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/Card';
import Button from '@/app/components/ui/Button';
import Input from '@/app/components/ui/Input';

export default function AdminEmployeeManager({ initialUsers = [] }) {
  const [users, setUsers] = useState(initialUsers);
  const [form, setForm] = useState({
    id: '',
    name: '',
    role: 'User',
    status: 'Active'
  });

  const canSubmit = useMemo(() => Boolean(form.id.trim() && form.name.trim()), [form.id, form.name]);

  const updateField = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const addEmployee = () => {
    if (!canSubmit) return;
    setUsers((current) => [
      ...current,
      {
        id: form.id.trim(),
        name: form.name.trim(),
        role: form.role.trim(),
        status: form.status.trim(),
        lastActive: 'Just now'
      }
    ]);
    setForm({ id: '', name: '', role: 'User', status: 'Active' });
  };

  return (
    <Card id="employees" className="admin-employees-card">
      <CardHeader>
        <CardTitle>Employees</CardTitle>
        <CardDescription>Add a new employee and review user-level activity.</CardDescription>
      </CardHeader>
      <CardContent className="admin-employee-shell">
        <div className="admin-form-grid">
          <Input value={form.id} onChange={updateField('id')} placeholder="Employee ID" />
          <Input value={form.name} onChange={updateField('name')} placeholder="Employee Name" />
          <Input value={form.role} onChange={updateField('role')} placeholder="Role" />
          <Input value={form.status} onChange={updateField('status')} placeholder="Status" />
        </div>

        <div className="admin-form-actions">
          <Button onClick={addEmployee} disabled={!canSubmit}>
            Add Employee
          </Button>
        </div>

        <div className="admin-list">
          {users.map((user) => (
            <div key={user.id} className="admin-list-item">
              <strong>{user.name}</strong>
              <p>{user.id} · {user.role} · {user.lastActive || user.status}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
