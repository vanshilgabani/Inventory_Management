import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import {
  FiUsers, FiPlus, FiTrash2, FiUserCheck, FiUserX,
  FiEye, FiEyeOff, FiKey, FiEdit2, FiShield,
  FiSearch, FiX, FiCheck,
} from 'react-icons/fi';

/* ─── Stats Card ─── */
const StatCard = ({ icon: Icon, label, value, color, bg }) => (
  <div style={{
    background: '#fff', borderRadius: '16px', padding: '1.5rem',
    border: '1px solid #f1f5f9', boxShadow: '0 1px 3px rgba(0,0,0,.06)',
    display: 'flex', alignItems: 'center', gap: '1rem',
  }}>
    <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Icon size={22} color={color} />
    </div>
    <div>
      <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>{label}</p>
      <p style={{ fontSize: '1.75rem', fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>{value}</p>
    </div>
  </div>
);

/* ─── Password Input ─── */
const PasswordInput = ({ value, onChange, placeholder = 'Enter password', disabled, name }) => {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        name={name}
        placeholder={placeholder}
        disabled={disabled}
        required
        style={{
          width: '100%', padding: '0.75rem 3rem 0.75rem 0.875rem',
          border: '1.5px solid #e2e8f0', borderRadius: '10px',
          fontSize: '0.875rem', color: '#0f172a', outline: 'none',
          background: disabled ? '#f8fafc' : '#fff',
          fontFamily: 'Satoshi, sans-serif',
          transition: 'border-color .2s, box-shadow .2s',
        }}
        onFocus={e => { e.target.style.borderColor = '#10b981'; e.target.style.boxShadow = '0 0 0 3px rgba(16,185,129,.1)'; }}
        onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; }}
      />
      <button
        type="button"
        onClick={() => setShow(p => !p)}
        disabled={disabled}
        style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center', transition: 'color .2s' }}
        onMouseEnter={e => e.currentTarget.style.color = '#10b981'}
        onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
      >
        {show ? <FiEyeOff size={16} /> : <FiEye size={16} />}
      </button>
    </div>
  );
};

/* ─── Modal Shell ─── */
const Sheet = ({ open, onClose, title, subtitle, children, width = '480px' }) => {
  if (!open) return null;
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)', backdropFilter: 'blur(4px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: '#fff', borderRadius: '20px', width: '100%', maxWidth: width, boxShadow: '0 24px 64px rgba(0,0,0,.18)', overflow: 'hidden' }}>
        {/* Modal header */}
        <div style={{ padding: '1.5rem 1.75rem 1.25rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h3 style={{ fontWeight: 800, fontSize: '1.1rem', color: '#0f172a', marginBottom: '2px' }}>{title}</h3>
            {subtitle && <p style={{ fontSize: '0.8rem', color: '#64748b' }}>{subtitle}</p>}
          </div>
          <button onClick={onClose} style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#f8fafc', border: '1px solid #e2e8f0', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', flexShrink: 0, transition: 'background .2s' }}
            onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
            onMouseLeave={e => e.currentTarget.style.background = '#f8fafc'}>
            <FiX size={16} />
          </button>
        </div>
        <div style={{ padding: '1.5rem 1.75rem' }}>{children}</div>
      </div>
    </div>
  );
};

/* ─── Form Field ─── */
const Field = ({ label, required, children }) => (
  <div>
    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#374151', marginBottom: '0.4rem', letterSpacing: '0.01em' }}>
      {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
    </label>
    {children}
  </div>
);

const TextInput = ({ value, onChange, type = 'text', placeholder, disabled, required, name }) => (
  <input
    type={type} value={value} onChange={onChange} name={name}
    placeholder={placeholder} disabled={disabled} required={required}
    style={{
      width: '100%', padding: '0.75rem 0.875rem',
      border: '1.5px solid #e2e8f0', borderRadius: '10px',
      fontSize: '0.875rem', color: '#0f172a', outline: 'none',
      background: disabled ? '#f8fafc' : '#fff',
      fontFamily: 'Satoshi, sans-serif',
      transition: 'border-color .2s, box-shadow .2s',
    }}
    onFocus={e => { e.target.style.borderColor = '#10b981'; e.target.style.boxShadow = '0 0 0 3px rgba(16,185,129,.1)'; }}
    onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; }}
  />
);

/* ─── GF Button ─── */
const GFBtn = ({ children, onClick, type = 'button', variant = 'primary', disabled, loading, size = 'md' }) => {
  const styles = {
    primary: { background: disabled ? '#9ca3af' : 'linear-gradient(90deg,#059669,#10b981)', color: '#fff', border: 'none' },
    danger:  { background: '#fff', color: '#ef4444', border: '1.5px solid #fecaca' },
    ghost:   { background: '#f8fafc', color: '#64748b', border: '1.5px solid #e2e8f0' },
    warning: { background: '#fff', color: '#d97706', border: '1.5px solid #fde68a' },
  };
  const pad = size === 'sm' ? '0.45rem 0.85rem' : '0.7rem 1.25rem';
  return (
    <button
      type={type} onClick={onClick} disabled={disabled || loading}
      style={{
        ...styles[variant], padding: pad, borderRadius: '10px', fontWeight: 700,
        fontSize: size === 'sm' ? '0.78rem' : '0.875rem', cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        fontFamily: 'Satoshi, sans-serif', transition: 'all .2s ease',
        opacity: disabled ? 0.6 : 1, whiteSpace: 'nowrap',
      }}
      onMouseEnter={e => { if (!disabled && variant === 'primary') e.currentTarget.style.boxShadow = '0 6px 20px rgba(16,185,129,.35)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; }}
    >
      {loading
        ? <><svg style={{ animation: 'ugm-spin .7s linear infinite', width: '14px', height: '14px' }} fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity=".25" /><path fill="currentColor" opacity=".8" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Loading...</>
        : children}
    </button>
  );
};

/* ══════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════ */
const UserManagement = () => {
  const { isAdmin, user: currentUser } = useAuth();

  const [users, setUsers]             = useState([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [filterRole, setFilterRole]   = useState('all');

  // Modals
  const [addModal, setAddModal]       = useState(false);
  const [pwdModal, setPwdModal]       = useState(null); // { user }
  const [deleteTarget, setDeleteTarget] = useState(null); // { user }

  // Form states
  const [formData, setFormData]       = useState({ name: '', email: '', password: '', businessName: '', phone: '', role: 'sales' });
  const [newPwd, setNewPwd]           = useState('');
  const [submitting, setSubmitting]   = useState(false);

  useEffect(() => { if (isAdmin()) fetchUsers(); }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/auth/users');
      setUsers(res.data.users || res.data || []);
    } catch {
      toast.error('Failed to fetch users');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (d) => {
    if (!d) return '—';
    try { return format(new Date(d), 'dd MMM yyyy'); } catch { return '—'; }
  };

  // Filtered users
  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    const matchSearch = !q || u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
    const matchRole   = filterRole === 'all' || u.role === filterRole;
    return matchSearch && matchRole;
  });

  /* ── Add user ── */
  const handleAddUser = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      await api.post('/auth/users', formData);
      toast.success('User created successfully 🎉');
      setAddModal(false);
      setFormData({ name: '', email: '', password: '', businessName: '', phone: '', role: 'sales' });
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create user');
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Toggle active ── */
  const handleToggleStatus = async (userId, currentStatus) => {
    if (userId === currentUser?._id && currentStatus) {
      toast.error('You cannot deactivate your own account');
      return;
    }
    try {
      await api.put(`/auth/users/${userId}`, { isActive: !currentStatus });
      toast.success(`User ${!currentStatus ? 'activated' : 'deactivated'}`);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update user');
    }
  };

  /* ── Delete user ── */
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSubmitting(true);
    try {
      await api.delete(`/auth/users/${deleteTarget._id}`);
      toast.success('User deleted');
      setDeleteTarget(null);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete user');
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Reset password ── */
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!newPwd || newPwd.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    setSubmitting(true);
    try {
      await api.put(`/auth/users/${pwdModal._id}/password`, { newPassword: newPwd });
      toast.success(`Password updated for ${pwdModal.name}`);
      setPwdModal(null);
      setNewPwd('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update password');
    } finally {
      setSubmitting(false);
    }
  };

  // Stats
  const totalUsers  = users.length;
  const activeUsers = users.filter(u => u.isActive).length;
  const salesUsers  = users.filter(u => u.role === 'sales').length;

  if (!isAdmin()) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center', padding: '3rem', background: '#fff', borderRadius: '16px', border: '1px solid #f1f5f9' }}>
          <FiShield size={40} color="#ef4444" style={{ marginBottom: '1rem' }} />
          <p style={{ color: '#ef4444', fontWeight: 700 }}>Admin access required</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://api.fontshare.com/v2/css?f[]=satoshi@400,500,600,700,800,900&display=swap');
        .ugm-root * { box-sizing: border-box; font-family: 'Satoshi', 'Inter', sans-serif; }
        @keyframes ugm-spin { to { transform: rotate(360deg); } }
        @keyframes ugm-fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .ugm-row { transition: background .15s ease; }
        .ugm-row:hover { background: #f8fafc !important; }
        .ugm-icon-btn {
          width: 32px; height: 32px; border-radius: 8px; display: inline-flex;
          align-items: center; justify-content: center; cursor: pointer;
          border: 1.5px solid transparent; transition: all .15s ease;
          background: transparent;
        }
        .ugm-icon-btn:hover { transform: scale(1.1); }
        .ugm-icon-btn.green { color: #059669; }
        .ugm-icon-btn.green:hover { background: #f0fdf4; border-color: #bbf7d0; }
        .ugm-icon-btn.red { color: #ef4444; }
        .ugm-icon-btn.red:hover { background: #fef2f2; border-color: #fecaca; }
        .ugm-icon-btn.blue { color: #3b82f6; }
        .ugm-icon-btn.blue:hover { background: #eff6ff; border-color: #bfdbfe; }
        .ugm-icon-btn.amber { color: #d97706; }
        .ugm-icon-btn.amber:hover { background: #fffbeb; border-color: #fde68a; }
        .ugm-icon-btn.gray { color: #9ca3af; cursor: default; }
        .ugm-select {
          padding: .45rem .85rem; border-radius: 9px; border: 1.5px solid #e2e8f0;
          font-size: .8rem; font-weight: 600; color: #374151; background: #fff;
          outline: none; cursor: pointer; font-family: 'Satoshi', sans-serif;
          transition: border-color .2s;
        }
        .ugm-select:focus { border-color: #10b981; }
        .ugm-search {
          padding: .6rem .875rem .6rem 2.5rem; border-radius: 10px;
          border: 1.5px solid #e2e8f0; font-size: .875rem; color: #0f172a;
          outline: none; background: #f8fafc; width: 240px;
          font-family: 'Satoshi', sans-serif; transition: border-color .2s, background .2s;
        }
        .ugm-search:focus { border-color: #10b981; background: #fff; }
        .ugm-badge {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 3px 10px; border-radius: 999px; font-size: .72rem; font-weight: 700;
        }
      `}</style>

      <div className="ugm-root" style={{ padding: '1.5rem', background: '#f8fafc', minHeight: '100vh' }}>

        {/* ── Page Header ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.75rem', animation: 'ugm-fadeUp .5s ease both' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg,#059669,#10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FiUsers size={18} color="#fff" />
              </div>
              <h1 style={{ fontWeight: 900, fontSize: '1.5rem', color: '#0f172a', letterSpacing: '-0.03em' }}>User Management</h1>
            </div>
            <p style={{ color: '#64748b', fontSize: '0.875rem', marginLeft: '46px' }}>
              Manage sales accounts for your organization
            </p>
          </div>
          <GFBtn onClick={() => setAddModal(true)}>
            <FiPlus size={15} /> Add User
          </GFBtn>
        </div>

        {/* ── Stats ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.75rem', animation: 'ugm-fadeUp .5s .07s ease both' }}>
          <StatCard icon={FiUsers}     label="Total Users"   value={totalUsers}  color="#3b82f6" bg="#eff6ff" />
          <StatCard icon={FiUserCheck} label="Active"        value={activeUsers} color="#10b981" bg="#f0fdf4" />
          <StatCard icon={FiUsers}     label="Sales Accounts" value={salesUsers} color="#8b5cf6" bg="#f5f3ff" />
        </div>

        {/* ── Table Card ── */}
        <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #f1f5f9', boxShadow: '0 1px 3px rgba(0,0,0,.06)', overflow: 'hidden', animation: 'ugm-fadeUp .5s .12s ease both' }}>

          {/* Table toolbar */}
          <div style={{ padding: '1.1rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <FiSearch style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} size={14} />
              <input
                type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search by name or email..."
                className="ugm-search"
                style={{ width: '100%', maxWidth: '320px' }}
              />
            </div>
            <select value={filterRole} onChange={e => setFilterRole(e.target.value)} className="ugm-select">
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="sales">Sales</option>
            </select>
            <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600 }}>
              {filtered.length} of {totalUsers} users
            </span>
          </div>

          {/* Table */}
          {loading ? (
            <div style={{ padding: '4rem', textAlign: 'center' }}>
              <svg style={{ animation: 'ugm-spin .8s linear infinite', width: '32px', height: '32px', color: '#10b981', margin: '0 auto' }} fill="none" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity=".2" />
                <path fill="currentColor" opacity=".8" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p style={{ color: '#94a3b8', marginTop: '12px', fontSize: '0.875rem' }}>Loading users...</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    {['User', 'Role', 'Status', 'Created', 'Actions'].map((h, i) => (
                      <th key={i} style={{
                        padding: '0.75rem 1.25rem', textAlign: i === 4 ? 'right' : 'left',
                        fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8',
                        letterSpacing: '0.07em', textTransform: 'uppercase',
                        whiteSpace: 'nowrap', background: '#fafafa',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(user => (
                    <tr key={user._id} className="ugm-row" style={{ borderBottom: '1px solid #f8fafc' }}>

                      {/* User info */}
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
                            background: user.role === 'admin'
                              ? 'linear-gradient(135deg,#7c3aed,#a78bfa)'
                              : 'linear-gradient(135deg,#059669,#10b981)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.75rem', fontWeight: 900, color: '#fff',
                          }}>
                            {(user.name || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#0f172a' }}>
                              {user.name || '—'}
                              {user._id === currentUser?._id && (
                                <span style={{ marginLeft: '6px', fontSize: '0.65rem', background: '#f0fdf4', color: '#059669', padding: '1px 6px', borderRadius: '999px', fontWeight: 700, border: '1px solid #bbf7d0' }}>You</span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{user.email || '—'}</div>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <span className="ugm-badge" style={
                          user.role === 'admin'
                            ? { background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ede9fe' }
                            : { background: '#f0fdf4', color: '#059669', border: '1px solid #bbf7d0' }
                        }>
                          {user.role === 'admin' ? '👑' : '💼'} {user.role === 'admin' ? 'Admin' : 'Sales'}
                        </span>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <span className="ugm-badge" style={
                          user.isActive
                            ? { background: '#f0fdf4', color: '#059669', border: '1px solid #bbf7d0' }
                            : { background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca' }
                        }>
                          <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: user.isActive ? '#10b981' : '#ef4444' }} />
                          {user.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      {/* Created */}
                      <td style={{ padding: '1rem 1.25rem', fontSize: '0.8rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                        {formatDate(user.createdAt)}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end', alignItems: 'center' }}>

                          {/* Change password — only for sales */}
                          {user.role === 'sales' && (
                            <button
                              className="ugm-icon-btn amber"
                              onClick={() => { setPwdModal(user); setNewPwd(''); }}
                              title="Change password"
                            >
                              <FiKey size={15} />
                            </button>
                          )}

                          {/* Toggle active */}
                          {user._id !== currentUser?._id ? (
                            <button
                              className={`ugm-icon-btn ${user.isActive ? 'red' : 'green'}`}
                              onClick={() => handleToggleStatus(user._id, user.isActive)}
                              title={user.isActive ? 'Deactivate user' : 'Activate user'}
                            >
                              {user.isActive ? <FiUserX size={15} /> : <FiUserCheck size={15} />}
                            </button>
                          ) : (
                            <button className="ugm-icon-btn gray" title="Cannot deactivate yourself" style={{ cursor: 'default' }}>
                              <FiUserCheck size={15} />
                            </button>
                          )}

                          {/* Delete */}
                          {user._id !== currentUser?._id && (
                            <button
                              className="ugm-icon-btn red"
                              onClick={() => setDeleteTarget(user)}
                              title="Delete user"
                            >
                              <FiTrash2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filtered.length === 0 && (
                <div style={{ padding: '4rem', textAlign: 'center' }}>
                  <FiUsers size={36} color="#e2e8f0" style={{ marginBottom: '12px' }} />
                  <p style={{ color: '#94a3b8', fontWeight: 600 }}>
                    {search ? 'No users match your search' : 'No users found'}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ══ ADD USER MODAL ══ */}
      <Sheet
        open={addModal}
        onClose={() => { setAddModal(false); setFormData({ name: '', email: '', password: '', businessName: '', phone: '', role: 'sales' }); }}
        title="Add New User"
        subtitle="Create a sales account for your team"
      >
        <form onSubmit={handleAddUser} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <Field label="Full Name" required>
              <TextInput value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} placeholder="Full name" required />
            </Field>
            <Field label="Role" required>
              <select value={formData.role} onChange={e => setFormData(p => ({ ...p, role: e.target.value }))}
                style={{ width: '100%', padding: '.75rem .875rem', border: '1.5px solid #e2e8f0', borderRadius: '10px', fontSize: '.875rem', color: '#0f172a', outline: 'none', fontFamily: 'Satoshi, sans-serif', background: '#fff', cursor: 'pointer' }}>
                <option value="sales">💼 Sales</option>
                <option value="admin">👑 Admin</option>
              </select>
            </Field>
          </div>

          <Field label="Email Address" required>
            <TextInput type="email" value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} placeholder="user@email.com" required />
          </Field>

          <Field label="Password" required>
            <PasswordInput value={formData.password} onChange={e => setFormData(p => ({ ...p, password: e.target.value }))} placeholder="Set a password" disabled={submitting} />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <Field label="Business Name">
              <TextInput value={formData.businessName} onChange={e => setFormData(p => ({ ...p, businessName: e.target.value }))} placeholder="Business name" />
            </Field>
            <Field label="Phone">
              <TextInput value={formData.phone} onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))} placeholder="10-digit number" />
            </Field>
          </div>

          {/* Info note */}
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '10px 14px', fontSize: '0.78rem', color: '#065f46', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '14px', flexShrink: 0 }}>ℹ️</span>
            <span>Sales accounts cannot reset their own password. You can change it anytime from the Users table using the <strong>🔑 key icon</strong>.</span>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '0.5rem' }}>
            <GFBtn type="submit" loading={submitting} disabled={submitting} style={{ flex: 1 }}>
              <FiCheck size={15} /> Create User
            </GFBtn>
            <GFBtn variant="ghost" onClick={() => setAddModal(false)} disabled={submitting}>
              Cancel
            </GFBtn>
          </div>
        </form>
      </Sheet>

      {/* ══ CHANGE PASSWORD MODAL ══ */}
      <Sheet
        open={!!pwdModal}
        onClose={() => { setPwdModal(null); setNewPwd(''); }}
        title="Change Password"
        subtitle={pwdModal ? `Set new password for ${pwdModal.name}` : ''}
        width="420px"
      >
        {pwdModal && (
          <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* User info pill */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg,#059669,#10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 900, color: '#fff', flexShrink: 0 }}>
                {pwdModal.name?.charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#0f172a' }}>{pwdModal.name}</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{pwdModal.email}</div>
              </div>
              <span className="ugm-badge" style={{ marginLeft: 'auto', background: '#f0fdf4', color: '#059669', border: '1px solid #bbf7d0' }}>💼 Sales</span>
            </div>

            <Field label="New Password" required>
              <PasswordInput
                value={newPwd}
                onChange={e => setNewPwd(e.target.value)}
                placeholder="Min. 6 characters"
                disabled={submitting}
              />
            </Field>

            {/* Strength indicator */}
            {newPwd && (
              <div>
                <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                  {[1, 2, 3, 4].map(i => {
                    const score = newPwd.length >= 10 && /[A-Z]/.test(newPwd) && /[0-9]/.test(newPwd) ? 4
                      : newPwd.length >= 8 && /[A-Z0-9]/.test(newPwd) ? 3
                      : newPwd.length >= 6 ? 2 : 1;
                    const colors = ['#ef4444', '#f97316', '#eab308', '#10b981'];
                    return <div key={i} style={{ flex: 1, height: '3px', borderRadius: '2px', background: i <= score ? colors[score - 1] : '#e2e8f0', transition: 'background .3s' }} />;
                  })}
                </div>
                <p style={{ fontSize: '0.72rem', color: '#64748b' }}>
                  {newPwd.length < 6 ? 'Too short' : newPwd.length < 8 ? 'Weak' : newPwd.length >= 10 && /[A-Z]/.test(newPwd) && /[0-9]/.test(newPwd) ? '💪 Strong' : 'Medium'}
                </p>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: '0.25rem' }}>
              <GFBtn type="submit" loading={submitting} disabled={submitting || newPwd.length < 6} style={{ flex: 1 }}>
                <FiKey size={14} /> Update Password
              </GFBtn>
              <GFBtn variant="ghost" onClick={() => { setPwdModal(null); setNewPwd(''); }} disabled={submitting}>
                Cancel
              </GFBtn>
            </div>
          </form>
        )}
      </Sheet>

      {/* ══ DELETE CONFIRM MODAL ══ */}
      <Sheet
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete User"
        subtitle="This action cannot be undone"
        width="400px"
      >
        {deleteTarget && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', background: '#fef2f2', borderRadius: '10px', border: '1px solid #fecaca' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg,#ef4444,#f87171)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 900, color: '#fff', flexShrink: 0 }}>
                {deleteTarget.name?.charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#0f172a' }}>{deleteTarget.name}</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{deleteTarget.email}</div>
              </div>
            </div>
            <p style={{ fontSize: '0.875rem', color: '#64748b', lineHeight: 1.6 }}>
              Are you sure you want to permanently delete <strong style={{ color: '#0f172a' }}>{deleteTarget.name}</strong>? All their data will be removed from your organization.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <GFBtn variant="danger" onClick={handleDelete} loading={submitting} disabled={submitting} style={{ flex: 1 }}>
                <FiTrash2 size={14} /> Delete User
              </GFBtn>
              <GFBtn variant="ghost" onClick={() => setDeleteTarget(null)} disabled={submitting}>
                Cancel
              </GFBtn>
            </div>
          </div>
        )}
      </Sheet>
    </>
  );
};

export default UserManagement;