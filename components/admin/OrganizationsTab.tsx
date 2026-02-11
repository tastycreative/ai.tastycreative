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
  Settings,
  Loader2,
} from 'lucide-react';
import OrganizationPermissionsModal from './OrganizationPermissionsModal';

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
    firstName: string | null;
    lastName: string | null;
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
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [showChangePlanModal, setShowChangePlanModal] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [changingPlan, setChangingPlan] = useState(false);
  const [addingMember, setAddingMember] = useState(false);
  const [creatingOrg, setCreatingOrg] = useState(false);

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
      const [orgsRes, usersRes, plansRes] = await Promise.all([
        fetch('/api/admin/organizations'),
        fetch('/api/admin/users'),
        fetch('/api/admin/plans'),
      ]);

      if (orgsRes.ok) {
        const orgsData = await orgsRes.json();
        setOrganizations(orgsData.organizations || []);
      }

      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(usersData.users || []);
      }

      if (plansRes.ok) {
        const plansData = await plansRes.json();
        setPlans(plansData.plans || []);
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
      setCreatingOrg(true);
      setError(null);

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
    } finally {
      setCreatingOrg(false);
    }
  };

  const handleAddMember = async () => {
    if (!selectedOrg || !selectedUserId || !selectedRole) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setAddingMember(true);
      setError(null);

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
    } finally {
      setAddingMember(false);
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

  const handleChangePlan = async () => {
    if (!selectedOrg || !selectedPlanId) {
      return;
    }

    try {
      setChangingPlan(true);
      setError(null);

      const response = await fetch(`/api/admin/organizations/${selectedOrg.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscriptionPlanId: selectedPlanId === 'none' ? null : selectedPlanId
        }),
      });

      if (response.ok) {
        setSuccess('Plan updated successfully');
        setShowChangePlanModal(false);
        setSelectedPlanId('');
        fetchData();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to update plan');
      }
    } catch (err) {
      setError('Failed to update plan');
    } finally {
      setChangingPlan(false);
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role.toUpperCase()) {
      case 'OWNER':
        return <Crown className="w-4 h-4 text-[#F774B9]" />;
      case 'ADMIN':
        return <Shield className="w-4 h-4 text-[#EC67A1]" />;
      case 'MANAGER':
        return <Users className="w-4 h-4 text-[#5DC3F8]" />;
      default:
        return <User className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { bg: string; border: string; icon: string; label: string }> = {
      TRIAL: { bg: 'bg-blue-50/50 dark:bg-blue-950/30', border: 'border-[#5DC3F8]/30', icon: 'text-[#5DC3F8]', label: 'Trial' },
      ACTIVE: { bg: 'bg-green-50/50 dark:bg-green-950/30', border: 'border-green-500/30', icon: 'text-green-600 dark:text-green-400', label: 'Active' },
      PAST_DUE: { bg: 'bg-yellow-50/50 dark:bg-yellow-950/30', border: 'border-yellow-500/30', icon: 'text-yellow-600 dark:text-yellow-400', label: 'Past Due' },
      CANCELLED: { bg: 'bg-red-50/50 dark:bg-red-950/30', border: 'border-red-500/30', icon: 'text-red-600 dark:text-red-400', label: 'Cancelled' },
      PAUSED: { bg: 'bg-muted/50', border: 'border-border', icon: 'text-muted-foreground', label: 'Paused' },
    };

    const statusInfo = statusMap[status] || statusMap.TRIAL;
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full border ${statusInfo.bg} ${statusInfo.border} text-foreground`}>
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
        <h3 className="text-lg font-semibold text-foreground">Organizations Management</h3>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#EC67A1]"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div>
        <h3 className="text-xl font-semibold text-foreground mb-2">Organizations Management</h3>
        <p className="text-muted-foreground">Manage organizations, members, and permissions</p>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
            <span className="text-foreground">{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900/50 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
            <span className="text-foreground">{success}</span>
          </div>
          <button onClick={() => setSuccess(null)} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Search and Actions */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search organizations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-border bg-background rounded-lg focus:ring-2 focus:ring-[#EC67A1] focus:border-[#EC67A1] text-foreground placeholder:text-muted-foreground"
          />
        </div>
        <button
          onClick={() => setShowCreateOrgModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#EC67A1] to-[#F774B9] text-white rounded-lg hover:from-[#E1518E] hover:to-[#EC67A1] transition-all active:scale-95 shadow-lg shadow-[#EC67A1]/25"
        >
          <Plus className="w-5 h-5" />
          <span>Create Organization</span>
        </button>
      </div>

      {/* Organizations List */}
      <div className="space-y-4 flex-1 overflow-auto min-h-0 mt-4">
        {filteredOrganizations.map((org) => (
          <div key={org.id} className="bg-card border border-border rounded-lg p-6 hover:shadow-md hover:border-[#EC67A1]/30 transition-all">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-4">
                {org.logoUrl ? (
                  <img src={org.logoUrl} alt={org.name} className="w-12 h-12 rounded-lg border border-border" />
                ) : (
                  <div className="w-12 h-12 bg-gradient-to-br from-[#5DC3F8] to-[#EC67A1] rounded-lg flex items-center justify-center shadow-sm">
                    <Building2 className="w-6 h-6 text-white" />
                  </div>
                )}
                <div>
                  <h4 className="text-lg font-semibold text-foreground">{org.name}</h4>
                  <p className="text-sm text-muted-foreground">/{org.slug}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {getStatusBadge(org.subscriptionStatus)}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Plan</p>
                <p className="text-sm font-medium text-foreground">
                  {org.subscriptionPlan?.displayName || 'Free'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Members</p>
                <p className="text-sm font-medium text-foreground">{org.memberCount}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Workspaces</p>
                <p className="text-sm font-medium text-foreground">{org.workspaceCount}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Credits Used</p>
                <p className="text-sm font-medium text-foreground">{org.creditsUsedThisMonth}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="border-t border-border pt-4 mb-4">
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => {
                    setSelectedOrg(org);
                    setSelectedPlanId(org.subscriptionPlan?.id || 'none');
                    setShowChangePlanModal(true);
                  }}
                  className="flex items-center gap-2 px-3 py-2 text-sm bg-background border border-[#EC67A1]/30 text-foreground rounded-lg hover:bg-[#F774B9]/10 hover:border-[#EC67A1] transition-all"
                >
                  <Crown className="w-4 h-4 text-[#F774B9]" />
                  Change Plan
                </button>
                <button
                  onClick={() => {
                    setSelectedOrg(org);
                    setShowPermissionsModal(true);
                  }}
                  className="flex items-center gap-2 px-3 py-2 text-sm bg-background border border-[#5DC3F8]/30 text-foreground rounded-lg hover:bg-[#5DC3F8]/10 hover:border-[#5DC3F8] transition-all"
                >
                  <Settings className="w-4 h-4 text-[#5DC3F8]" />
                  Manage Permissions
                </button>
              </div>
            </div>

            {/* Members Section */}
            <div className="border-t border-border pt-4">
              <div className="flex items-center justify-between mb-3">
                <h5 className="text-sm font-medium text-foreground">Team Members</h5>
                <button
                  onClick={() => {
                    setSelectedOrg(org);
                    setShowAddMemberModal(true);
                  }}
                  className="text-xs text-[#5DC3F8] hover:text-[#EC67A1] font-medium transition-colors"
                >
                  Add Member
                </button>
              </div>
              <div className="space-y-2">
                {org.members.map((member) => (
                  <div key={member.id} className="flex items-center justify-between p-2 bg-muted/50 border border-border rounded-lg hover:border-[#EC67A1]/30 transition-colors">
                    <div className="flex items-center gap-3">
                      {member.user.avatarUrl ? (
                        <img src={member.user.avatarUrl} alt={`${member.user.firstName || ''} ${member.user.lastName || ''}`.trim() || 'User'} className="w-8 h-8 rounded-full border border-border" />
                      ) : (
                        <div className="w-8 h-8 bg-gradient-to-br from-[#5DC3F8] to-[#EC67A1] rounded-full flex items-center justify-center">
                          <User className="w-4 h-4 text-white" />
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {member.user.firstName || member.user.lastName
                            ? `${member.user.firstName || ''} ${member.user.lastName || ''}`.trim()
                            : 'Unnamed User'}
                        </p>
                        <p className="text-xs text-muted-foreground">{member.user.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2">
                        {getRoleIcon(member.role)}
                        <span className={`px-2 py-1 text-xs font-medium rounded-full border text-foreground ${
                          member.role === 'OWNER'
                            ? 'bg-yellow-50/50 dark:bg-yellow-950/30 border-[#F774B9]/30'
                            : member.role === 'ADMIN'
                            ? 'bg-red-50/50 dark:bg-red-950/30 border-[#EC67A1]/30'
                            : member.role === 'MANAGER'
                            ? 'bg-purple-50/50 dark:bg-purple-950/30 border-[#5DC3F8]/30'
                            : member.role === 'CREATOR'
                            ? 'bg-green-50/50 dark:bg-green-950/30 border-green-500/30'
                            : member.role === 'VIEWER'
                            ? 'bg-blue-50/50 dark:bg-blue-950/30 border-[#5DC3F8]/30'
                            : 'bg-muted/50 border-border'
                        }`}>
                          {member.role.charAt(0) + member.role.slice(1).toLowerCase()}
                        </span>
                      </div>
                      <button
                        onClick={() => handleRemoveMember(member.id)}
                        className="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded transition-colors active:scale-95"
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
              className="relative bg-card border border-border rounded-xl shadow-2xl p-6 max-w-lg w-full my-8 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-foreground">Create New Organization</h2>
              <button
                onClick={() => setShowCreateOrgModal(false)}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  Organization Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newOrgName}
                  onChange={(e) => {
                    const name = e.target.value;
                    setNewOrgName(name);
                    // Auto-generate slug from organization name
                    const slug = name
                      .toLowerCase()
                      .trim()
                      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
                      .replace(/\s+/g, '-') // Replace spaces with hyphens
                      .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
                      .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
                    setNewOrgSlug(slug);
                  }}
                  className="w-full px-4 py-2.5 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-[#EC67A1] focus:border-[#EC67A1] transition-all placeholder:text-muted-foreground"
                  placeholder="Acme Inc."
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  Slug <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">/</span>
                  <input
                    type="text"
                    value={newOrgSlug}
                    onChange={(e) => setNewOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                    className="w-full pl-6 pr-4 py-2.5 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-[#EC67A1] focus:border-[#EC67A1] transition-all placeholder:text-muted-foreground"
                    placeholder="acme-inc"
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">URL-friendly identifier (lowercase, hyphens allowed)</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  Owner <span className="text-red-500">*</span>
                </label>
                <select
                  value={newOrgOwnerId}
                  onChange={(e) => setNewOrgOwnerId(e.target.value)}
                  className="w-full px-4 py-2.5 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-[#EC67A1] focus:border-[#EC67A1] transition-all"
                >
                  <option value="">Select owner...</option>
                  {(users || []).filter(u => u.inDatabase).map((user) => (
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
                className="px-5 py-2.5 border border-border rounded-lg text-foreground hover:bg-muted font-medium transition-all active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateOrganization}
                disabled={!newOrgName || !newOrgSlug || !newOrgOwnerId || creatingOrg}
                className="px-5 py-2.5 bg-gradient-to-r from-[#EC67A1] to-[#F774B9] text-white rounded-lg hover:from-[#E1518E] hover:to-[#EC67A1] font-medium transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#EC67A1]/25 flex items-center gap-2"
              >
                {creatingOrg ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Organization'
                )}
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
            <div className="relative bg-card border border-border rounded-xl shadow-2xl p-6 max-w-lg w-full my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-foreground">Add Team Member</h2>
                <p className="text-sm text-muted-foreground mt-1">to {selectedOrg.name}</p>
              </div>
              <button
                onClick={() => {
                  setShowAddMemberModal(false);
                  setSelectedUserId('');
                  setSelectedRole('MEMBER');
                }}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  Select User <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full px-4 py-2.5 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-[#5DC3F8] focus:border-[#5DC3F8] transition-all"
                  autoFocus
                >
                  <option value="">Choose a user...</option>
                  {(users || [])
                    .filter((user) => user.inDatabase && !selectedOrg.members.some((m) => m.userId === user.id))
                    .map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.firstName} {user.lastName} ({user.email})
                      </option>
                    ))}
                </select>
                <p className="mt-1 text-xs text-muted-foreground">
                  {(users || []).filter((user) => user.inDatabase && !selectedOrg.members.some((m) => m.userId === user.id)).length} users available
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  Role <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="w-full px-4 py-2.5 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-[#5DC3F8] focus:border-[#5DC3F8] transition-all"
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
                className="px-5 py-2.5 border border-border rounded-lg text-foreground hover:bg-muted font-medium transition-all active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={handleAddMember}
                disabled={!selectedUserId || !selectedRole || addingMember}
                className="px-5 py-2.5 bg-gradient-to-r from-[#5DC3F8] to-[#EC67A1] text-white rounded-lg hover:from-[#5DC3F8]/90 hover:to-[#EC67A1]/90 font-medium transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#5DC3F8]/25 flex items-center gap-2"
              >
                {addingMember ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  'Add Member'
                )}
              </button>
            </div>
            </div>
          </div>
        </div>
      )}

      {/* Change Plan Modal */}
      {showChangePlanModal && selectedOrg && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm"
          onClick={() => {
            setShowChangePlanModal(false);
            setSelectedOrg(null);
            setSelectedPlanId('');
          }}
        >
          <div className="flex min-h-screen items-center justify-center p-4">
            <div
              className="relative bg-card border border-border rounded-xl shadow-2xl p-6 max-w-lg w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                    <Crown className="w-6 h-6 text-[#F774B9]" />
                    Change Subscription Plan
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">{selectedOrg.name}</p>
                </div>
                <button
                  onClick={() => {
                    setShowChangePlanModal(false);
                    setSelectedOrg(null);
                    setSelectedPlanId('');
                  }}
                  className="p-2 hover:bg-muted rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>

              <div className="mb-6">
                <p className="text-sm text-muted-foreground mb-1">Current Plan:</p>
                <p className="text-lg font-semibold text-foreground">
                  {selectedOrg.subscriptionPlan?.displayName || 'No Plan'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  New Plan <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedPlanId}
                  onChange={(e) => setSelectedPlanId(e.target.value)}
                  className="w-full px-4 py-2.5 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-[#F774B9] focus:border-[#F774B9] transition-all"
                  autoFocus
                >
                  <option value="">Select a plan...</option>
                  <option value="none">No Plan (Remove subscription)</option>
                  {plans
                    .filter((plan) => plan.isActive)
                    .map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.displayName} - ${plan.price}/{plan.billingInterval.toLowerCase()}
                      </option>
                    ))}
                </select>
              </div>

              <div className="mt-6 flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowChangePlanModal(false);
                    setSelectedOrg(null);
                    setSelectedPlanId('');
                  }}
                  disabled={changingPlan}
                  className="px-5 py-2.5 border border-border rounded-lg text-foreground hover:bg-muted font-medium transition-all active:scale-95 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleChangePlan}
                  disabled={!selectedPlanId || changingPlan}
                  className="px-5 py-2.5 bg-gradient-to-r from-[#EC67A1] to-[#F774B9] text-white rounded-lg hover:from-[#E1518E] hover:to-[#EC67A1] font-medium transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#EC67A1]/25 flex items-center gap-2"
                >
                  {changingPlan ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    'Change Plan'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Permissions Modal */}
      {showPermissionsModal && selectedOrg && (
        <OrganizationPermissionsModal
          organizationId={selectedOrg.id}
          organizationName={selectedOrg.name}
          onClose={() => {
            setShowPermissionsModal(false);
            setSelectedOrg(null);
          }}
          onSuccess={() => {
            setSuccess('Permissions updated successfully!');
            setTimeout(() => setSuccess(null), 3000);
          }}
        />
      )}
    </div>
  );
}
