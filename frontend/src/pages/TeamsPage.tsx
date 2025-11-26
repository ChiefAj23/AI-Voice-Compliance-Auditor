import { useState, useEffect } from 'react';
import { teamsApi, Team, TeamCreate } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { User } from '../services/api';

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showMemberManager, setShowMemberManager] = useState(false);
  const [formData, setFormData] = useState<TeamCreate>({ name: '', description: '', department: '' });
  const [loading, setLoading] = useState(false);
  const [filterDept, setFilterDept] = useState<string>('');
  const { user } = useAuth();

  useEffect(() => {
    loadTeams();
    loadUsers();
  }, [filterDept]);

  const loadTeams = async () => {
    try {
      const data = await teamsApi.listTeams(filterDept || undefined);
      setTeams(data);
    } catch (error) {
      console.error('Failed to load teams:', error);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await api.get('/api/users');
      setUsers(response.data);
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await teamsApi.createTeam(formData);
      setShowCreate(false);
      setFormData({ name: '', description: '', department: '' });
      await loadTeams();
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to create team');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeam) return;
    setLoading(true);
    try {
      await teamsApi.updateTeam(selectedTeam.id, formData);
      setShowEdit(false);
      setSelectedTeam(null);
      setFormData({ name: '', description: '', department: '' });
      await loadTeams();
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to update team');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (teamId: number) => {
    if (!confirm('Are you sure you want to deactivate this team?')) return;
    setLoading(true);
    try {
      await teamsApi.deleteTeam(teamId);
      await loadTeams();
    } catch (error) {
      console.error('Failed to delete team:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (team: Team) => {
    setSelectedTeam(team);
    setFormData({
      name: team.name,
      description: team.description || '',
      department: team.department || '',
    });
    setShowEdit(true);
  };

  const handleManageMembers = async (team: Team) => {
    // Load full team data with members
    try {
      const fullTeam = await teamsApi.getTeam(team.id);
      setSelectedTeam(fullTeam);
      setShowMemberManager(true);
    } catch (error) {
      console.error('Failed to load team details:', error);
      setSelectedTeam(team);
      setShowMemberManager(true);
    }
  };

  const handleAddMember = async (userId: number) => {
    if (!selectedTeam) return;
    setLoading(true);
    try {
      await teamsApi.addMember(selectedTeam.id, userId);
      // Refresh team data
      const updatedTeam = await teamsApi.getTeam(selectedTeam.id);
      setSelectedTeam(updatedTeam);
      await loadTeams();
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to add member');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (userId: number) => {
    if (!selectedTeam) return;
    if (!confirm('Are you sure you want to remove this member from the team?')) return;
    setLoading(true);
    try {
      await teamsApi.removeMember(selectedTeam.id, userId);
      // Refresh team data
      const updatedTeam = await teamsApi.getTeam(selectedTeam.id);
      setSelectedTeam(updatedTeam);
      await loadTeams();
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to remove member');
    } finally {
      setLoading(false);
    }
  };

  const departments = Array.from(new Set(teams.map(t => t.department).filter(Boolean)));

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Teams & Departments</h1>
        {user && (
          <button
            onClick={() => {
              setShowCreate(true);
              setFormData({ name: '', description: '', department: '' });
            }}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            + Create Team
          </button>
        )}
      </div>

      {departments.length > 0 && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Filter by Department:
          </label>
          <select
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="">All Departments</option>
            {departments.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
        </div>
      )}

      {showCreate && (
        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Create Team</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <input
              type="text"
              placeholder="Team Name"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <input
              type="text"
              placeholder="Department (optional)"
              value={formData.department}
              onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <textarea
              placeholder="Description (optional)"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              rows={3}
            />
            <div className="flex space-x-2">
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create'}
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-500"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {showEdit && selectedTeam && (
        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Edit Team</h2>
          <form onSubmit={handleUpdate} className="space-y-4">
            <input
              type="text"
              placeholder="Team Name"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <input
              type="text"
              placeholder="Department (optional)"
              value={formData.department}
              onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <textarea
              placeholder="Description (optional)"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              rows={3}
            />
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
                  setSelectedTeam(null);
                }}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-500"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {teams.map((team) => (
          <div
            key={team.id}
            className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{team.name}</h3>
                {team.department && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    📁 {team.department}
                  </p>
                )}
                {team.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">{team.description}</p>
                )}
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  {team.member_count} member{team.member_count !== 1 ? 's' : ''}
                </p>
                {team.members.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300">Members:</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {team.members.slice(0, 5).map((member) => (
                        <span
                          key={member.id}
                          className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded"
                        >
                          {member.full_name || member.username}
                        </span>
                      ))}
                      {team.members.length > 5 && (
                        <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">
                          +{team.members.length - 5} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
              {user && (
                <div className="flex space-x-2 ml-4">
                  <button
                    onClick={() => handleManageMembers(team)}
                    className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
                  >
                    Members
                  </button>
                  <button
                    onClick={() => handleEdit(team)}
                    className="text-indigo-600 dark:text-indigo-400 hover:underline text-sm"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(team.id)}
                    className="text-red-600 dark:text-red-400 hover:underline text-sm"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {teams.length === 0 && (
        <p className="text-center text-gray-500 dark:text-gray-400 mt-8">No teams found.</p>
      )}

      {showMemberManager && selectedTeam && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
              Manage Members for {selectedTeam.name}
            </h2>

            <div className="mb-4">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Current Members:</h3>
              <div className="space-y-2">
                {selectedTeam.members.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No members</p>
                ) : (
                  selectedTeam.members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded"
                    >
                      <span className="text-sm text-gray-900 dark:text-white">
                        {member.full_name || member.username}
                      </span>
                      <button
                        onClick={() => handleRemoveMember(member.id)}
                        disabled={loading}
                        className="text-red-600 dark:text-red-400 hover:underline text-sm disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="mb-4">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Add Members:</h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {users
                  .filter(u => !selectedTeam.members.some(m => m.id === u.id))
                  .map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {user.full_name || user.username}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
                      </div>
                      <button
                        onClick={() => handleAddMember(user.id)}
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
                setShowMemberManager(false);
                setSelectedTeam(null);
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

