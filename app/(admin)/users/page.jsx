'use client';

import { useEffect, useState }  from 'react';
import { useUserStore }         from '@/store/userStore';
import { useToast }             from '@/components/shared/Toast';
import { useConfirm }           from '@/components/shared/ConfirmDialog';
import LoadingSpinner           from '@/components/shared/LoadingSpinner';
import { LockIcon, UserIcon }   from '@/components/icons';

const ROLE_STYLES = {
  customer:   'bg-blue-500/10   text-blue-400   border-blue-500/20',
  worker:     'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  superadmin: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  editor:     'bg-amber-500/10  text-amber-400  border-amber-500/20',
};

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

export default function UsersAdminPage() {
  const { allUsers, allUsersLoading, fetchAllUsers, setUserActive } = useUserStore();
  const toast   = useToast((s) => s.show);
  const confirm = useConfirm((s) => s.confirm);

  const [search,     setSearch]     = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  useEffect(() => {
    fetchAllUsers();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = allUsers.filter((u) => {
    const matchSearch =
      !search ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === 'all' || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  async function handleToggleActive(user) {
    const action = user.isActive ? 'Disable' : 'Enable';
    const ok     = await confirm(
      `${action} "${user.name}"?`,
      user.isActive
        ? 'The user will not be able to log in until re-enabled.'
        : 'The user account will be re-activated.',
    );
    if (!ok) return;
    try {
      await setUserActive(user.id, !user.isActive);
      toast(`User ${action.toLowerCase()}d.`, 'success');
    } catch (err) {
      toast(err.message ?? 'Action failed.', 'error');
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-admin-text">Users</h1>
          <p className="text-admin-muted text-sm mt-0.5">
            {allUsers.length} registered user{allUsers.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={fetchAllUsers}
          className="px-4 py-2.5 bg-admin-card border border-admin-border rounded-xl
                     text-admin-muted hover:text-admin-text text-sm font-medium transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* ⚠️ Security notice — passwords never stored in Firestore */}
      <div className="flex items-start gap-3 bg-admin-card border border-admin-border
                      rounded-xl px-4 py-3">
        <LockIcon className="w-5 h-5 text-amber-400 shrink-0" />
        <p className="text-admin-muted text-xs leading-relaxed">
          <strong className="text-admin-text">Security:</strong> Passwords are managed
          exclusively by Firebase Authentication and are never stored in Firestore.
          This panel cannot view or expose user passwords.
          To reset a password, use Firebase Console → Authentication.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-0 max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-admin-muted"
               fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full pl-9 pr-4 py-2.5 bg-admin-card border border-admin-border
                       rounded-xl text-admin-text text-sm placeholder-admin-muted/40
                       focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div className="flex gap-1 bg-admin-bg border border-admin-border rounded-xl p-1">
          {['all', 'customer', 'worker'].map((id) => (
            <button
              key={id}
              onClick={() => setRoleFilter(id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors capitalize
                          ${roleFilter === id
                            ? 'bg-brand-600 text-white'
                            : 'text-admin-muted hover:text-admin-text'}`}
            >
              {id === 'all' ? 'All' : id + 's'}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {allUsersLoading && (
        <div className="flex justify-center py-16">
          <LoadingSpinner size="lg" label="Loading users…" />
        </div>
      )}

      {/* Table */}
      {!allUsersLoading && (
        <div className="bg-admin-card border border-admin-border rounded-2xl overflow-hidden">
          {filtered.length === 0 ? (
            <div className="p-12 text-center">
              <UserIcon className="w-12 h-12 mb-4 mx-auto text-admin-muted/40" />
              <p className="text-admin-muted">
                {search ? 'No users match the search' : 'No users registered yet'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-admin-border">
                    {['User', 'Role', 'Joined', 'Last Login', 'Status', 'Action'].map((h) => (
                      <th key={h}
                          className="text-left text-xs font-semibold text-admin-muted uppercase
                                     tracking-wider px-5 py-3">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-admin-border">
                  {filtered.map((user) => (
                    <tr key={user.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-500
                                          to-brand-700 flex items-center justify-center text-white
                                          text-sm font-bold shrink-0">
                            {(user.name || user.email || '?')[0].toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-admin-text truncate">
                              {user.name || '—'}
                            </p>
                            <p className="text-admin-muted text-xs truncate">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border
                                          ${ROLE_STYLES[user.role] ?? ROLE_STYLES.customer}`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-admin-muted text-xs whitespace-nowrap">
                        {formatDate(user.createdAt)}
                      </td>
                      <td className="px-5 py-4 text-admin-muted text-xs whitespace-nowrap">
                        {formatDate(user.lastLogin)}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border
                                          ${user.isActive !== false
                                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                            : 'bg-red-500/10    text-red-400    border-red-500/20'}`}>
                          {user.isActive !== false ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <button
                          onClick={() => handleToggleActive(user)}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors
                                      ${user.isActive !== false
                                        ? 'bg-admin-bg border-admin-border text-red-400/70 hover:text-red-400 hover:border-red-500/50'
                                        : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'}`}
                        >
                          {user.isActive !== false ? 'Disable' : 'Enable'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}