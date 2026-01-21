"use client";

import { useState, useEffect } from 'react';
import {
  Building2,
  Users,
  Crown,
  Shield,
  User,
  Plus,
  Trash2,
  Search,
  X,
  Check,
  AlertCircle,
} from 'lucide-react';

interface Organization {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  subscriptionStatus: string;
  subscriptionPlan: {
    id: string;
    name: string;
    displayName: string;
  } | null;
  memberCount: number;
  workspaceCount: number;
  currentStorageGB: number;
  creditsUsedThisMonth: number;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  createdAt: Date;
  members: TeamMember[];
}

interface TeamMember {
  id: string;
  role: string;
  userId: string;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    avatarUrl: string | null;
  };
}

interface User {
  id: string;
  clerkId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
  role: string;
  createdAt: string;
  lastSignInAt: string | null;
  inDatabase: boolean;
  isOrphaned?: boolean;
  _count: {
    teamMemberships: number;
  };
  teamMemberships: {
    id: string;
    role: string;
    organization: {
      id: string;
      name: string;
      slug: string;
    };
  }[];
}

export default function OrganizationsTab() {
  const [loading, setLoading] = useState(true);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateOrgModal, setShowCreateOrgModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Create Organization Form State
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgSlug, setNewOrgSlug] = useState('');
  const [newOrgOwnerId, setNewOrgOwnerId] = useState('');

  // Add Member Form State
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState('MEMBER');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [orgsRes, usersRes] = await Promise.all([
        fetch('/api/admin/organizations'),
        fetch('/api/admin/users'),
      ]);

      if (orgsRes.ok) {
        const orgsData = await orgsRes.json();
        setOrganizations(orgsData.organizations || []);
      }

      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(usersData || []);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load organizations data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrganization = async () => {
    if (!newOrgName || !newOrgSlug || !newOrgOwnerId) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      const response = await fetch('/api/admin/organizations/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newOrgName,
          slug: newOrgSlug,
          ownerId: newOrgOwnerId,
        }),
      });

      if (response.ok) {
        setSuccess('Organization created successfully');
        setShowCreateOrgModal(false);
        setNewOrgName('');
        setNewOrgSlug('');
        setNewOrgOwnerId('');
        fetchData();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to create organization');
      }
    } catch (err) {
      setError('Failed to create organization');
    }
  };

  const handleAddMember = async () => {
    if (!selectedOrg || !selectedUserId || !selectedRole) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      const response = await fetch(`/api/admin/organizations/${selectedOrg.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUserId,
          role: selectedRole,
        }),
      });

      if (response.ok) {
        setSuccess('Member added successfully');
        setShowAddMemberModal(false);
        setSelectedUserId('');
        setSelectedRole('MEMBER');
        fetchData();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to add member');
      }
    } catch (err) {
      setError('Failed to add member');
    }
  };

  const handleUpdateMemberRole = async (memberId: string, newRole: string) => {
    try {
      const response = await fetch(`/api/admin/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });

      if (response.ok) {
        setSuccess('Member role updated successfully');
        fetchData();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to update member role');
      }
    } catch (err) {
      setError('Failed to update member role');
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this member?')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/members/${memberId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setSuccess('Member removed successfully');
        fetchData();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to remove member');
      }
    } catch (err) {
      setError('Failed to remove member');
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role.toUpperCase()) {
      case 'OWNER':
        return <Crown className="w-4 h-4 text-yellow-500" />;
      case 'ADMIN':
        return <Shield className="w-4 h-4 text-blue-500" />;
      case 'MANAGER':
        return <Users className="w-4 h-4 text-purple-500" />;
      default:
        return <User className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { bg: string; text: string; label: string }> = {
      TRIAL: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-800 dark:text-blue-300', label: 'Trial' },
      ACTIVE: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-800 dark:text-green-300', label: 'Active' },
      PAST_DUE: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-800 dark:text-yellow-300', label: 'Past Due' },
      CANCELLED: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-800 dark:text-red-300', label: 'Cancelled' },
      PAUSED: { bg: 'bg-gray-100 dark:bg-gray-900/30', text: 'text-gray-800 dark:text-gray-300', label: 'Paused' },
    };

    const statusInfo = statusMap[status] || statusMap.TRIAL;
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusInfo.bg} ${statusInfo.text}`}>
        {statusInfo.label}
      </span>
    );
  };

  const filteredOrganizations = organizations.filter((org) =>
    org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    org.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Organizations Management</h3>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div>
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Organizations Management</h3>
        <p className="text-gray-600 dark:text-gray-400">Manage organizations, members, and permissions</p>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
            <span className="text-red-800 dark:text-red-200">{error}</span>
          </div>
          <button onClick={() => setError(null)}>
            <X className="w-5 h-5 text-red-600 dark:text-red-400" />
          </button>
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
            <span className="text-green-800 dark:text-green-200">{success}</span>
          </div>
          <button onClick={() => setSuccess(null)}>
            <X className="w-5 h-5 text-green-600 dark:text-green-400" />
          </button>
        </div>
      )}

      {/* Search and Actions */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search organizations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800/50 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white"
          />
        </div>
        <button
          onClick={() => setShowCreateOrgModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors active:scale-95"
        >
          <Plus className="w-5 h-5" />
          <span>Create Organization</span>
        </button>
      </div>

      {/* Organizations List */}
      <div className="space-y-4 flex-1 overflow-auto min-h-0 mt-4">
        {filteredOrganizations.map((org) => (
          <div key={org.id} className="bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-800/50 dark:to-gray-900/30 border border-gray-200/50 dark:border-gray-700/30 rounded-lg p-6 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-4">
                {org.logoUrl ? (
                  <img src={org.logoUrl} alt={org.name} className="w-12 h-12 rounded-lg" />
                ) : (
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-white" />
                  </div>
                )}
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white">{org.name}</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">/{org.slug}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {getStatusBadge(org.subscriptionStatus)}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Plan</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {org.subscriptionPlan?.displayName || 'Free'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Members</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{org.memberCount}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Workspaces</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{org.workspaceCount}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Credits Used</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{org.creditsUsedThisMonth}</p>
              </div>
            </div>

            {/* Members Section */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <div className="flex items-center justify-between mb-3">
                <h5 className="text-sm font-medium text-gray-900 dark:text-white">Team Members</h5>
                <button
                  onClick={() => {
                    setSelectedOrg(org);
                    setShowAddMemberModal(true);
                  }}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
                >
                  Add Member
                </button>
              </div>
              <div className="space-y-2">
                {org.members.map((member) => (
                  <div key={member.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      {member.user.avatarUrl ? (
                        <img src={member.user.avatarUrl} alt={member.user.name || ''} className="w-8 h-8 rounded-full" />
                      ) : (
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                          <User className="w-4 h-4 text-white" />
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{member.user.name || 'Unnamed User'}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{member.user.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        {getRoleIcon(member.role)}
                        <select
                          value={member.role}
                          onChange={(e) => handleUpdateMemberRole(member.id, e.target.value)}
                          className="text-xs border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded px-2 py-1"
                        >
                          <option value="OWNER">Owner</option>
                          <option value="ADMIN">Admin</option>
                          <option value="MANAGER">Manager</option>
                          <option value="CREATOR">Creator</option>
                          <option value="VIEWER">Viewer</option>
                          <option value="MEMBER">Member</option>
                        </select>
                      </div>
                      <button
                        onClick={() => handleRemoveMember(member.id)}
                        className="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded active:scale-95"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create Organization Modal */}
      {showCreateOrgModal && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm"
          onClick={() => setShowCreateOrgModal(false)}
        >
          <div className="flex min-h-screen items-center justify-center p-4">
            <div
              className="relative bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-xl shadow-2xl p-6 max-w-lg w-full border border-gray-200 dark:border-gray-700 my-8 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Create New Organization</h2>
              <button
                onClick={() => setShowCreateOrgModal(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Organization Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900/50 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  placeholder="Acme Inc."
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Slug <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">/</span>
                  <input
                    type="text"
                    value={newOrgSlug}
                    onChange={(e) => setNewOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                    className="w-full pl-6 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900/50 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    placeholder="acme-inc"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">URL-friendly identifier (lowercase, hyphens allowed)</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Owner <span className="text-red-500">*</span>
                </label>
                <select
                  value={newOrgOwnerId}
                  onChange={(e) => setNewOrgOwnerId(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900/50 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                >
                  <option value="">Select owner...</option>
                  {users.filter(u => u.inDatabase).map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.firstName} {user.lastName} ({user.email})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-6 flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowCreateOrgModal(false);
                  setNewOrgName('');
                  setNewOrgSlug('');
                  setNewOrgOwnerId('');
                }}
                className="px-5 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 font-medium transition-all active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateOrganization}
                disabled={!newOrgName || !newOrgSlug || !newOrgOwnerId}
                className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 font-medium transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-blue-600 disabled:hover:to-blue-700 shadow-lg shadow-blue-500/25"
              >
                Create Organization
              </button>
            </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {showAddMemberModal && selectedOrg && (
        <div className="fixed h-full inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setShowAddMemberModal(false)} />
            <div className="relative bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-xl shadow-2xl p-6 max-w-lg w-full border border-gray-200 dark:border-gray-700 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Add Team Member</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">to {selectedOrg.name}</p>
              </div>
              <button
                onClick={() => {
                  setShowAddMemberModal(false);
                  setSelectedUserId('');
                  setSelectedRole('MEMBER');
                }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Select User <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900/50 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  autoFocus
                >
                  <option value="">Choose a user...</option>
                  {users
                    .filter((user) => user.inDatabase && !selectedOrg.members.some((m) => m.userId === user.id))
                    .map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.firstName} {user.lastName} ({user.email})
                      </option>
                    ))}
                </select>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {users.filter((user) => user.inDatabase && !selectedOrg.members.some((m) => m.userId === user.id)).length} users available
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Role <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900/50 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                >
                  <option value="MEMBER">Member - Standard access</option>
                  <option value="CREATOR">Creator - Create content</option>
                  <option value="VIEWER">Viewer - Read-only</option>
                  <option value="MANAGER">Manager - Approve & manage</option>
                  <option value="ADMIN">Admin - Full access</option>
                  <option value="OWNER">Owner - Complete control</option>
                </select>
              </div>
            </div>

            <div className="mt-6 flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowAddMemberModal(false);
                  setSelectedUserId('');
                  setSelectedRole('MEMBER');
                }}
                className="px-5 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 font-medium transition-all active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={handleAddMember}
                disabled={!selectedUserId || !selectedRole}
                className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 font-medium transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-blue-600 disabled:hover:to-blue-700 shadow-lg shadow-blue-500/25"
              >
                Add Member
              </button>
            </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
