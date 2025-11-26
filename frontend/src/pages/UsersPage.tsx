import { useState, useEffect } from 'react';
import { authApi, User, usersApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { Trash2 } from 'lucide-react';

interface Role {
  id: number;
  name: string;
  description?: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [showRoleManager, setShowRoleManager] = useState(false);
  const [formData, setFormData] = useState({ email: '', full_name: '', is_active: true });
  const [loading, setLoading] = useState(false);
  const { user: currentUser } = useAuth();

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

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setLoading(true);
    try {
      await api.put(`/api/users/${selectedUser.id}`, formData);
      setShowEdit(false);
      setSelectedUser(null);
      await loadUsers();
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to update user');
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
      await loadUsers();
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to update user');
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
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to assign role');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveRole = async (roleId: number) => {
    if (!selectedUser) return;
    if (!confirm('Are you sure you want to remove this role?')) return;
    setLoading(true);
    try {
      await api.delete(`/api/users/${selectedUser.id}/roles/${roleId}`);
      await loadUsers();
      // Refresh selected user data
      const updatedUsers = await api.get('/api/users');
      const updatedUser = updatedUsers.data.find((u: User) => u.id === selectedUser.id);
      if (updatedUser) setSelectedUser(updatedUser);
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to remove role');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (user: User) => {
    if (!confirm(`Are you sure you want to delete user "${user.username}"? This action cannot be undone.`)) {
      return;
    }

    if (!confirm('This will permanently delete the user and all their associated data. Continue?')) {
      return;
    }

    setLoading(true);
    try {
      await usersApi.deleteUser(user.id);
      alert(`User "${user.username}" has been deleted successfully.`);
      await loadUsers();
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to delete user');
    } finally {
      setLoading(false);
    }
  };

  if (!currentUser || (!currentUser.is_superuser && !currentUser.roles.includes('admin'))) {
    return (
      <div className="p-6">
        <p className="text-red-600 dark:text-red-400">You don't have permission to view this page.</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">User Management</h1>

      {showEdit && selectedUser && (
        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Edit User</h2>
          <form onSubmit={handleUpdate} className="space-y-4">
            <input
              type="email"
              placeholder="Email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <input
              type="text"
              placeholder="Full Name"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="mr-2"
              />
              <span className="text-gray-700 dark:text-gray-300">Active</span>
            </label>
            <div className="flex space-x-2">
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading ? 'Updating...' : 'Update'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowEdit(false);
                  setSelectedUser(null);
                }}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-500"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Username
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Full Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Roles
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {users.map((user) => (
              <tr key={user.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                  {user.username}
                  {user.is_superuser && (
                    <span className="ml-2 px-2 py-1 text-xs bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded">
                      Superuser
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {user.email}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {user.full_name || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex flex-wrap gap-1">
                    {user.roles.map((role) => (
                      <span
                        key={role}
                        className="px-2 py-1 text-xs bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 rounded"
                      >
                        {role}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 py-1 text-xs rounded ${
                      user.is_active
                        ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                        : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                    }`}
                  >
                    {user.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                  <button
                    onClick={() => handleEdit(user)}
                    className="text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleManageRoles(user)}
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Roles
                  </button>
                  <button
                    onClick={() => handleToggleActive(user.id, user.is_active)}
                    disabled={loading}
                    className="text-gray-600 dark:text-gray-400 hover:underline disabled:opacity-50"
                  >
                    {user.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  {currentUser && currentUser.id !== user.id && (
                    <button
                      onClick={() => handleDeleteUser(user)}
                      disabled={loading}
                      className="text-red-600 dark:text-red-400 hover:underline disabled:opacity-50 flex items-center gap-1"
                      title="Delete user"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {users.length === 0 && (
        <p className="text-center text-gray-500 dark:text-gray-400 mt-8">No users found.</p>
      )}

      {showRoleManager && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
              Manage Roles for {selectedUser.username}
            </h2>

            <div className="mb-4">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Current Roles:</h3>
              <div className="flex flex-wrap gap-2">
                {selectedUser.roles.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No roles assigned</p>
                ) : (
                  selectedUser.roles.map((roleName) => {
                    const role = roles.find(r => r.name === roleName);
                    return role ? (
                      <span
                        key={role.id}
                        className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200"
                      >
                        {roleName}
                        <button
                          onClick={() => handleRemoveRole(role.id)}
                          className="ml-2 text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200"
                        >
                          ×
                        </button>
                      </span>
                    ) : null;
                  })
                )}
              </div>
            </div>

            <div className="mb-4">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Available Roles:</h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {roles
                  .filter(role => !selectedUser.roles.includes(role.name))
                  .map((role) => (
                    <div
                      key={role.id}
                      className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{role.name}</p>
                        {role.description && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">{role.description}</p>
                        )}
                      </div>
                      <button
                        onClick={() => handleAssignRole(role.id)}
                        disabled={loading}
                        className="px-3 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
                      >
                        Add
                      </button>
                    </div>
                  ))}
              </div>
            </div>

            <button
              onClick={() => {
                setShowRoleManager(false);
                setSelectedUser(null);
              }}
              className="w-full px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-500"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

