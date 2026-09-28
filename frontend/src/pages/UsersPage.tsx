import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { Info, KeyRound, Lock, Pencil, Search, Trash2, UserCheck, UserPlus, UserX, Users } from 'lucide-react';
import api, { authApi, usersApi } from '../services/api';
import type { Role, User } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { humanize } from '../utils/format';
import {
  Avatar,
  Badge,
  Card,
  EmptyState,
  Field,
  IconButton,
  Modal,
  PageHeader,
  Spinner,
  Switch,
  useConfirm,
  useToast,
} from '../components/ui';
import { errorDetail } from '../utils/errors';

function displayName(user: Pick<User, 'username' | 'full_name'>): string {
  return user.full_name || user.username;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [showRoleManager, setShowRoleManager] = useState(false);
  const [formData, setFormData] = useState({ email: '', full_name: '', is_active: true });
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { user: currentUser } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [showCreate, setShowCreate] = useState(false);
  const [createData, setCreateData] = useState({ username: '', email: '', full_name: '', password: '', role: 'viewer' });
  const [createdNote, setCreatedNote] = useState<string | null>(null);

  // Accounts are issued here: the API creates the user with a temporary password that must be replaced at the first sign-in.
  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const created = await authApi.register({
        username: createData.username.trim(),
        email: createData.email.trim(),
        password: createData.password,
        full_name: createData.full_name.trim() || undefined,
      });
      const role = roles.find((r) => r.name === createData.role);
      if (role && createData.role !== 'viewer') {
        await api.post(`/api/users/${created.id}/roles`, { role_id: role.id });
      }
      setCreatedNote(`${created.username} can sign in with the temporary password and will be asked to choose a new one.`);
      setCreateData({ username: '', email: '', full_name: '', password: '', role: 'viewer' });
      toast.success('User created', `${created.username} was added${role && createData.role !== 'viewer' ? ` as ${humanize(role.name)}` : ''}.`);
      await loadUsers();
    } catch (error) {
      toast.error('Could not create the user', errorDetail(error) || 'Check the details and try again.');
    } finally {
      setLoading(false);
    }
  };

  // Non-admins see the access notice instead of the list, so load errors stay quiet for them.
  const canManageUsers = !!currentUser && (currentUser.is_superuser || currentUser.roles.includes('admin'));

  useEffect(() => {
    loadUsers();
    loadRoles();
  }, []);

  const loadUsers = async () => {
    try {
      const response = await api.get('/api/users');
      setUsers(response.data);
    } catch (error) {
      console.error('Failed to load users:', error);
      if (canManageUsers) toast.error('Could not load users', 'Check that the API is running and try again.');
    } finally {
      setListLoading(false);
    }
  };

  const loadRoles = async () => {
    try {
      const response = await api.get('/api/roles');
      setRoles(response.data);
    } catch (error) {
      console.error('Failed to load roles:', error);
    }
  };

  const handleUpdate = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setLoading(true);
    try {
      await api.put(`/api/users/${selectedUser.id}`, formData);
      setShowEdit(false);
      setSelectedUser(null);
      toast.success('User updated');
      await loadUsers();
    } catch (error) {
      toast.error('Could not update user', errorDetail(error));
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (user: User) => {
    setSelectedUser(user);
    setFormData({
      email: user.email,
      full_name: user.full_name || '',
      is_active: user.is_active,
    });
    setShowEdit(true);
  };

  const handleToggleActive = async (userId: number, currentStatus: boolean) => {
    setLoading(true);
    try {
      await api.put(`/api/users/${userId}`, { is_active: !currentStatus });
      toast.success(currentStatus ? 'User deactivated' : 'User activated');
      await loadUsers();
    } catch (error) {
      toast.error('Could not update user', errorDetail(error));
    } finally {
      setLoading(false);
    }
  };

  const handleManageRoles = (user: User) => {
    setSelectedUser(user);
    setShowRoleManager(true);
  };

  const handleAssignRole = async (roleId: number) => {
    if (!selectedUser) return;
    setLoading(true);
    try {
      await api.post(`/api/users/${selectedUser.id}/roles`, { role_id: roleId });
      await loadUsers();
      // Refresh selected user data
      const updatedUsers = await api.get('/api/users');
      const updatedUser = updatedUsers.data.find((u: User) => u.id === selectedUser.id);
      if (updatedUser) setSelectedUser(updatedUser);
    } catch (error) {
      toast.error('Could not assign role', errorDetail(error));
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveRole = async (roleId: number) => {
    if (!selectedUser) return;
    const role = roles.find((r) => r.id === roleId);
    const confirmed = await confirm({
      title: 'Remove this role?',
      description: `${displayName(selectedUser)} will lose the ${role ? humanize(role.name) : 'selected'} role and the permissions that come with it.`,
      confirmLabel: 'Remove role',
    });
    if (!confirmed) return;

    setLoading(true);
    try {
      await api.delete(`/api/users/${selectedUser.id}/roles/${roleId}`);
      await loadUsers();
      // Refresh selected user data
      const updatedUsers = await api.get('/api/users');
      const updatedUser = updatedUsers.data.find((u: User) => u.id === selectedUser.id);
      if (updatedUser) setSelectedUser(updatedUser);
    } catch (error) {
      toast.error('Could not remove role', errorDetail(error));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (user: User) => {
    const confirmed = await confirm({
      title: 'Delete this user?',
      description: `"${user.username}" and all of their associated data will be permanently deleted. This can't be undone.`,
      confirmLabel: 'Delete user',
    });
    if (!confirmed) return;

    setLoading(true);
    try {
      await usersApi.deleteUser(user.id);
      toast.success('User deleted', `"${user.username}" has been removed.`);
      await loadUsers();
    } catch (error) {
      toast.error('Could not delete user', errorDetail(error));
    } finally {
      setLoading(false);
    }
  };

  const closeEdit = () => {
    setShowEdit(false);
    setSelectedUser(null);
  };

  const closeRoles = () => {
    setShowRoleManager(false);
    setSelectedUser(null);
  };

  if (!currentUser || (!currentUser.is_superuser && !currentUser.roles.includes('admin'))) {
    return (
      <div>
        <PageHeader title="Users" description="Manage access and roles." />
        <Card>
          <EmptyState
            icon={Lock}
            title="You don't have access to this page"
            description="Only administrators can manage users and roles. Ask an administrator if you need access."
          />
        </Card>
      </div>
    );
  }

  const query = searchTerm.trim().toLowerCase();
  const filteredUsers = query
    ? users.filter((u) => [u.full_name, u.username, u.email].some((value) => value?.toLowerCase().includes(query)))
    : users;

  return (
    <div>
      <PageHeader
        title="Users"
        description="Manage access and roles."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => { setCreatedNote(null); setShowCreate(true); }}>
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            Add user
          </button>
        }
      />

      <Card className="overflow-hidden">
        {/* Toolbar */}
        <div className="border-b border-line p-4">
          <div className="relative sm:max-w-sm">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-faint"
              aria-hidden="true"
            />
            <input
              type="search"
              placeholder="Search name, email or username"
              aria-label="Search users"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-9"
            />
          </div>
        </div>

        {!listLoading && filteredUsers.length === 0 ? (
          query ? (
            <EmptyState
              icon={Search}
              title="No matching users"
              description="Try a different name, email or username."
              action={
                <button type="button" onClick={() => setSearchTerm('')} className="btn btn-secondary">
                  Clear search
                </button>
              }
            />
          ) : (
            <EmptyState
              icon={Users}
              title="No users yet"
              description="People appear here after they create an account."
            />
          )
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="data-table data-table-hover">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Username</th>
                    <th>Roles</th>
                    <th>Teams</th>
                    <th>Status</th>
                    <th className="text-right">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {listLoading
                    ? Array.from({ length: 5 }, (_, i) => (
                        <tr key={i}>
                          <td>
                            <div className="flex items-center gap-3">
                              <div className="skeleton h-8 w-8 shrink-0 rounded-full" />
                              <div>
                                <div className="skeleton h-4 w-32" />
                                <div className="skeleton mt-2 h-3 w-44" />
                              </div>
                            </div>
                          </td>
                          <td><div className="skeleton h-4 w-20" /></td>
                          <td><div className="skeleton h-5 w-16" /></td>
                          <td><div className="skeleton h-4 w-24" /></td>
                          <td><div className="skeleton h-5 w-16" /></td>
                          <td />
                        </tr>
                      ))
                    : filteredUsers.map((user) => (
                        <tr key={user.id}>
                          <td>
                            <div className="flex items-center gap-3">
                              <Avatar name={displayName(user)} />
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="truncate font-medium text-fg">{displayName(user)}</p>
                                  {currentUser.id === user.id && <Badge>You</Badge>}
                                </div>
                                <p className="truncate text-xs text-fg-subtle">{user.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="whitespace-nowrap text-fg-muted">{user.username}</td>
                          <td>
                            {user.roles.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {user.roles.map((role) => (
                                  <Badge key={role} tone={role === 'admin' ? 'accent' : 'neutral'}>
                                    {humanize(role)}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <span className="text-fg-faint">—</span>
                            )}
                          </td>
                          <td>
                            {user.teams.length > 0 ? (
                              <span className="block max-w-[14rem] truncate text-fg-muted" title={user.teams.join(', ')}>
                                {user.teams.join(', ')}
                              </span>
                            ) : (
                              <span className="text-fg-faint">—</span>
                            )}
                          </td>
                          <td>
                            <div className="flex flex-wrap items-center gap-1.5">
                              {user.is_active ? (
                                <Badge tone="success" dot>
                                  Active
                                </Badge>
                              ) : (
                                <Badge tone="neutral" dot>
                                  Inactive
                                </Badge>
                              )}
                              {user.is_superuser && <Badge tone="accent">Superuser</Badge>}
                            </div>
                          </td>
                          <td>
                            <div className="flex items-center justify-end gap-0.5">
                              <IconButton icon={KeyRound} label="Manage roles" onClick={() => handleManageRoles(user)} />
                              <IconButton icon={Pencil} label="Edit user" onClick={() => handleEdit(user)} />
                              <IconButton
                                icon={user.is_active ? UserX : UserCheck}
                                label={user.is_active ? 'Deactivate user' : 'Activate user'}
                                disabled={loading}
                                onClick={() => handleToggleActive(user.id, user.is_active)}
                              />
                              {currentUser && currentUser.id !== user.id ? (
                                <IconButton
                                  icon={Trash2}
                                  label="Delete user"
                                  tone="danger"
                                  disabled={loading}
                                  onClick={() => handleDeleteUser(user)}
                                />
                              ) : (
                                // Keeps the action columns aligned on your own row, which can't be deleted.
                                <span className="h-8 w-8 shrink-0" aria-hidden="true" />
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>

            <div className="border-t border-line px-4 py-3">
              <p className="text-[13px] tabular-nums text-fg-subtle">
                {listLoading
                  ? 'Loading…'
                  : query
                    ? `Showing ${filteredUsers.length} of ${users.length} users`
                    : `${users.length} ${users.length === 1 ? 'user' : 'users'}`}
              </p>
            </div>
          </>
        )}
      </Card>

      {/* Edit user */}
      <Modal
        open={showEdit && selectedUser !== null}
        onClose={closeEdit}
        size="lg"
        title="Edit user"
        description={
          selectedUser && (
            <>
              Update profile details for <span className="font-medium text-fg">{selectedUser.username}</span>.
            </>
          )
        }
        footer={
          <>
            <button type="button" onClick={closeEdit} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" form="edit-user-form" disabled={loading} className="btn btn-primary">
              {loading && <Spinner />}
              {loading ? 'Saving…' : 'Save changes'}
            </button>
          </>
        }
      >
        <form id="edit-user-form" onSubmit={handleUpdate} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" htmlFor="user-full-name">
              <input
                id="user-full-name"
                type="text"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="Email" htmlFor="user-email" required>
              <input
                id="user-email"
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="input"
              />
            </Field>
          </div>
          <div className="rounded-lg border border-line px-4 py-3">
            <Switch
              checked={formData.is_active}
              onChange={(checked) => setFormData({ ...formData, is_active: checked })}
              label="Active"
              description="Inactive users can't sign in."
            />
          </div>
        </form>
      </Modal>

      {/* Role management */}
      <Modal
        open={showRoleManager && selectedUser !== null}
        onClose={closeRoles}
        title="Manage roles"
        description={
          selectedUser && (
            <>
              Choose what <span className="font-medium text-fg">{displayName(selectedUser)}</span> can access. Changes
              apply right away.
            </>
          )
        }
        footer={
          <button type="button" onClick={closeRoles} className="btn btn-secondary">
            Done
          </button>
        }
      >
        {selectedUser && (
          <div className="space-y-4">
            {selectedUser.is_superuser && (
              <div className="callout callout-info">
                <Info />
                <div>Superusers have every permission, whatever roles they're assigned.</div>
              </div>
            )}
            {roles.length === 0 ? (
              <p className="py-4 text-center text-sm text-fg-subtle">No roles are available.</p>
            ) : (
              <ul className="divide-y divide-line">
                {roles.map((role) => (
                  <li key={role.id} className="py-3 first:pt-0 last:pb-0">
                    <Switch
                      checked={selectedUser.roles.includes(role.name)}
                      onChange={(checked) => {
                        if (checked) handleAssignRole(role.id);
                        else handleRemoveRole(role.id);
                      }}
                      label={humanize(role.name)}
                      description={role.description}
                      disabled={loading}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Add user"
        description="Set a temporary password to hand over; the user replaces it at the first sign-in."
        icon={<UserPlus className="h-5 w-5" aria-hidden="true" />}
      >
        <form className="space-y-4" onSubmit={handleCreate}>
          {createdNote && (
            <div className="callout callout-success" role="status">
              <UserCheck />
              <p>{createdNote}</p>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Username" htmlFor="new-username" required>
              <input id="new-username" className="input" required autoComplete="off" value={createData.username} onChange={(e) => setCreateData({ ...createData, username: e.target.value })} />
            </Field>
            <Field label="Email" htmlFor="new-email" required>
              <input id="new-email" type="email" className="input" required autoComplete="off" value={createData.email} onChange={(e) => setCreateData({ ...createData, email: e.target.value })} />
            </Field>
          </div>
          <Field label="Full name" htmlFor="new-full-name">
            <input id="new-full-name" className="input" value={createData.full_name} onChange={(e) => setCreateData({ ...createData, full_name: e.target.value })} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Temporary password" htmlFor="new-password" help="At least 12 characters. Share it with the user directly." required>
              <input id="new-password" type="text" className="input font-mono" required minLength={12} autoComplete="off" value={createData.password} onChange={(e) => setCreateData({ ...createData, password: e.target.value })} />
            </Field>
            <Field label="Role" htmlFor="new-role">
              <select id="new-role" className="input" value={createData.role} onChange={(e) => setCreateData({ ...createData, role: e.target.value })}>
                {(roles.length ? roles : [{ id: 0, name: 'viewer' } as Role]).map((role) => (
                  <option key={role.name} value={role.name}>
                    {humanize(role.name)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>
              Close
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading && <Spinner />}
              Create user
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
