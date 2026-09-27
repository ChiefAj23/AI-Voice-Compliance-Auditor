import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { Pencil, Plus, Search, Trash2, UserMinus, UserPlus, Users } from 'lucide-react';
import api, { teamsApi } from '../services/api';
import type { Team, TeamCreate, User } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
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
  useConfirm,
  useToast,
} from '../components/ui';
import { errorDetail } from '../utils/errors';

/** How many member avatars the table shows before summarizing with the count. */
const AVATAR_STACK_LIMIT = 4;

function personName(person: { username: string; full_name?: string }): string {
  return person.full_name || person.username;
}

/** Overlapping avatars of the first few members, followed by the total count. */
function MemberStack({ team }: { team: Team }) {
  if (team.member_count === 0) {
    return <span className="text-[13px] text-fg-faint">No members</span>;
  }

  return (
    <div className="flex items-center gap-2.5">
      <div className="flex -space-x-1.5">
        {team.members.slice(0, AVATAR_STACK_LIMIT).map((member) => (
          <span key={member.id} title={personName(member)} className="inline-flex rounded-full ring-2 ring-surface">
            <Avatar name={personName(member)} size="sm" />
          </span>
        ))}
      </div>
      <span className="whitespace-nowrap text-[13px] tabular-nums text-fg-muted">
        {team.member_count} {team.member_count === 1 ? 'member' : 'members'}
      </span>
    </div>
  );
}

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
  const [listLoading, setListLoading] = useState(true);
  const [departments, setDepartments] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  useEffect(() => {
    loadTeams();
    loadUsers();
  }, [filterDept]);

  // The API returns only the filtered teams, so remember the departments seen
  // while a filter is applied; the unfiltered list refreshes them.
  useEffect(() => {
    const current = teams.map((t) => t.department).filter((dept): dept is string => Boolean(dept));
    setDepartments((previous) =>
      Array.from(new Set(filterDept ? [...previous, ...current] : current)).sort((a, b) => a.localeCompare(b)),
    );
  }, [teams]);

  const loadTeams = async () => {
    try {
      const data = await teamsApi.listTeams(filterDept || undefined);
      setTeams(data);
    } catch (error) {
      console.error('Failed to load teams:', error);
      toast.error('Could not load teams', 'Check that the API is running and try again.');
    } finally {
      setListLoading(false);
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

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await teamsApi.createTeam(formData);
      setShowCreate(false);
      setFormData({ name: '', description: '', department: '' });
      toast.success('Team created');
      await loadTeams();
    } catch (error) {
      toast.error('Could not create team', errorDetail(error));
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedTeam) return;
    setLoading(true);
    try {
      await teamsApi.updateTeam(selectedTeam.id, formData);
      setShowEdit(false);
      setSelectedTeam(null);
      setFormData({ name: '', description: '', department: '' });
      toast.success('Team updated');
      await loadTeams();
    } catch (error) {
      toast.error('Could not update team', errorDetail(error));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (teamId: number) => {
    const team = teams.find((t) => t.id === teamId);
    const confirmed = await confirm({
      title: 'Delete this team?',
      description: `${team ? `"${team.name}"` : 'This team'} will be deactivated and removed from the list. Member accounts aren't affected.`,
      confirmLabel: 'Delete team',
    });
    if (!confirmed) return;

    setLoading(true);
    try {
      await teamsApi.deleteTeam(teamId);
      toast.success('Team deleted');
      await loadTeams();
    } catch (error) {
      console.error('Failed to delete team:', error);
      toast.error('Could not delete team', errorDetail(error));
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
    } catch (error) {
      toast.error('Could not add member', errorDetail(error));
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (userId: number) => {
    if (!selectedTeam) return;
    const member = selectedTeam.members.find((m) => m.id === userId);
    const confirmed = await confirm({
      title: 'Remove this member?',
      description: `${member ? personName(member) : 'This person'} will be removed from ${selectedTeam.name}.`,
      confirmLabel: 'Remove member',
    });
    if (!confirmed) return;

    setLoading(true);
    try {
      await teamsApi.removeMember(selectedTeam.id, userId);
      // Refresh team data
      const updatedTeam = await teamsApi.getTeam(selectedTeam.id);
      setSelectedTeam(updatedTeam);
      await loadTeams();
    } catch (error) {
      toast.error('Could not remove member', errorDetail(error));
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setShowCreate(true);
    setFormData({ name: '', description: '', department: '' });
  };

  const closeForm = () => {
    if (showEdit) {
      setShowEdit(false);
      setSelectedTeam(null);
    } else {
      setShowCreate(false);
    }
  };

  const closeMembers = () => {
    setShowMemberManager(false);
    setSelectedTeam(null);
    setMemberSearch('');
  };

  const isEditing = showEdit && selectedTeam !== null;
  const availableUsers = selectedTeam
    ? users.filter((u) => !selectedTeam.members.some((m) => m.id === u.id))
    : [];
  const memberQuery = memberSearch.trim().toLowerCase();
  const matchingUsers = memberQuery
    ? availableUsers.filter((u) =>
        [u.full_name, u.username, u.email].some((value) => value?.toLowerCase().includes(memberQuery)),
      )
    : availableUsers;

  return (
    <div>
      <PageHeader
        title="Teams"
        description="Group reviewers and agents by department."
        actions={
          user && (
            <button type="button" onClick={openCreate} className="btn btn-primary">
              <Plus />
              Create team
            </button>
          )
        }
      />

      <Card className="overflow-hidden">
        {departments.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-line p-4">
            <select
              value={filterDept}
              onChange={(e) => setFilterDept(e.target.value)}
              aria-label="Filter by department"
              className="input sm:w-60"
            >
              <option value="">All departments</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
            {filterDept && (
              <button type="button" onClick={() => setFilterDept('')} className="btn btn-ghost">
                Clear
              </button>
            )}
          </div>
        )}

        {!listLoading && teams.length === 0 ? (
          filterDept ? (
            <EmptyState
              icon={Search}
              title="No teams in this department"
              description={`No active teams are assigned to ${filterDept}.`}
              action={
                <button type="button" onClick={() => setFilterDept('')} className="btn btn-secondary">
                  Clear filter
                </button>
              }
            />
          ) : (
            <EmptyState
              icon={Users}
              title="No teams yet"
              description="Create a team to group reviewers and agents by department."
              action={
                user && (
                  <button type="button" onClick={openCreate} className="btn btn-secondary">
                    <Plus />
                    Create team
                  </button>
                )
              }
            />
          )
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="data-table data-table-hover">
                <thead>
                  <tr>
                    <th>Team</th>
                    <th>Department</th>
                    <th>Members</th>
                    <th className="text-right">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {listLoading
                    ? Array.from({ length: 4 }, (_, i) => (
                        <tr key={i}>
                          <td>
                            <div className="flex items-center gap-3">
                              <div className="skeleton h-8 w-8 shrink-0" />
                              <div>
                                <div className="skeleton h-4 w-40" />
                                <div className="skeleton mt-2 h-3 w-56" />
                              </div>
                            </div>
                          </td>
                          <td><div className="skeleton h-5 w-24" /></td>
                          <td><div className="skeleton h-7 w-36" /></td>
                          <td />
                        </tr>
                      ))
                    : teams.map((team) => (
                        <tr key={team.id}>
                          <td>
                            <div className="flex items-center gap-3">
                              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-surface-subtle text-fg-subtle">
                                <Users className="h-4 w-4" aria-hidden="true" />
                              </span>
                              <div className="min-w-0">
                                <p className="truncate font-medium text-fg">{team.name}</p>
                                {team.description && (
                                  <p className="max-w-md truncate text-xs text-fg-subtle" title={team.description}>
                                    {team.description}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td>
                            {team.department ? (
                              <Badge>{team.department}</Badge>
                            ) : (
                              <span className="text-fg-faint">—</span>
                            )}
                          </td>
                          <td>
                            <MemberStack team={team} />
                          </td>
                          <td>
                            {user && (
                              <div className="flex items-center justify-end gap-0.5">
                                <IconButton icon={UserPlus} label="Manage members" onClick={() => handleManageMembers(team)} />
                                <IconButton icon={Pencil} label="Edit team" onClick={() => handleEdit(team)} />
                                <IconButton icon={Trash2} label="Delete team" tone="danger" onClick={() => handleDelete(team.id)} />
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>

            <div className="border-t border-line px-4 py-3">
              <p className="text-[13px] tabular-nums text-fg-subtle">
                {listLoading ? 'Loading…' : `${teams.length} ${teams.length === 1 ? 'team' : 'teams'}`}
              </p>
            </div>
          </>
        )}
      </Card>

      {/* Create / edit team */}
      <Modal
        open={showCreate || isEditing}
        onClose={closeForm}
        size="lg"
        title={isEditing ? 'Edit team' : 'Create team'}
        description={
          isEditing
            ? 'Update the team name, department and description.'
            : 'Teams group reviewers and agents. Add members once the team exists.'
        }
        footer={
          <>
            <button type="button" onClick={closeForm} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" form="team-form" disabled={loading} className="btn btn-primary">
              {loading && <Spinner />}
              {isEditing ? (loading ? 'Saving…' : 'Save changes') : loading ? 'Creating…' : 'Create team'}
            </button>
          </>
        }
      >
        <form id="team-form" onSubmit={isEditing ? handleUpdate : handleCreate} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="team-name" required>
              <input
                id="team-name"
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="Department" htmlFor="team-department" help="Optional. Used to filter teams.">
              <input
                id="team-department"
                type="text"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                className="input"
              />
            </Field>
          </div>
          <Field label="Description" htmlFor="team-description" help="Optional. What this team reviews or handles.">
            <textarea
              id="team-description"
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="input"
            />
          </Field>
        </form>
      </Modal>

      {/* Member management */}
      <Modal
        open={showMemberManager && selectedTeam !== null}
        onClose={closeMembers}
        size="lg"
        title="Manage members"
        description={
          selectedTeam && (
            <>
              Add or remove people on <span className="font-medium text-fg">{selectedTeam.name}</span>.
            </>
          )
        }
        footer={
          <button type="button" onClick={closeMembers} className="btn btn-secondary">
            Done
          </button>
        }
      >
        {selectedTeam && (
          <div className="space-y-6">
            <section>
              <div className="mb-2 flex items-baseline justify-between gap-4">
                <h3 className="section-title">Members</h3>
                <span className="text-[13px] tabular-nums text-fg-subtle">{selectedTeam.members.length}</span>
              </div>
              {selectedTeam.members.length === 0 ? (
                <p className="rounded-lg border border-line bg-surface-subtle px-4 py-5 text-center text-sm text-fg-subtle">
                  No members yet. Add people from the list below.
                </p>
              ) : (
                <ul className="divide-y divide-line rounded-lg border border-line">
                  {selectedTeam.members.map((member) => (
                    <li key={member.id} className="flex items-center gap-3 px-3 py-2.5">
                      <Avatar name={personName(member)} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-fg">{personName(member)}</p>
                        {member.full_name && <p className="truncate text-xs text-fg-subtle">{member.username}</p>}
                      </div>
                      <IconButton
                        icon={UserMinus}
                        label={`Remove ${personName(member)}`}
                        tone="danger"
                        disabled={loading}
                        onClick={() => handleRemoveMember(member.id)}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h3 className="section-title">Add member</h3>
              <p className="mt-0.5 text-[13px] text-fg-subtle">People who aren't on this team yet.</p>
              {availableUsers.length > 0 && (
                <div className="relative mt-3">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-faint"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    placeholder="Search name, username or email"
                    aria-label="Search people to add"
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    className="input pl-9"
                  />
                </div>
              )}
              <div className="mt-3 overflow-hidden rounded-lg border border-line">
                {matchingUsers.length === 0 ? (
                  <p className="px-4 py-5 text-center text-sm text-fg-subtle">
                    {users.length === 0
                      ? 'No users available to add.'
                      : availableUsers.length === 0
                        ? 'Everyone is already on this team.'
                        : `No one matches "${memberSearch.trim()}".`}
                  </p>
                ) : (
                  <ul className="max-h-64 divide-y divide-line overflow-y-auto">
                    {matchingUsers.map((candidate) => (
                      <li key={candidate.id} className="flex items-center gap-3 px-3 py-2.5">
                        <Avatar name={personName(candidate)} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-medium text-fg">{personName(candidate)}</p>
                            {!candidate.is_active && <Badge>Inactive</Badge>}
                          </div>
                          <p className="truncate text-xs text-fg-subtle">{candidate.email}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAddMember(candidate.id)}
                          disabled={loading}
                          className="btn btn-secondary btn-sm"
                        >
                          <Plus />
                          Add
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </div>
        )}
      </Modal>
    </div>
  );
}
