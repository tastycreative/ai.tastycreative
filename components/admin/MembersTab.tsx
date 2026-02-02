'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { User, Mail, Calendar, Eye, Search, Filter, UserPlus, Trash2 } from 'lucide-react';
import { InviteMembersModal } from '../InviteMembersModal';
import { useOrganization } from '@/lib/hooks/useOrganization';

interface MemberData {
  id: string;
  userId: string;
  clerkId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
  role: 'OWNER' | 'ADMIN' | 'MANAGER' | 'CREATOR' | 'VIEWER' | 'MEMBER';
  joinedAt: string;
  lastSignInAt: string | null;
  inClerk: boolean;
  _count: {
    images: number;
    videos: number;
    jobs: number;
    influencers: number;
  };
}

export default function MembersTab() {
  const params = useParams();
  const tenant = params.tenant as string;
  const { currentOrganization, loading: orgLoading } = useOrganization();
  const [users, setUsers] = useState<MemberData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'email' | 'created' | 'activity'>('created');
  const [updatingRoles, setUpdatingRoles] = useState<Set<string>>(new Set());
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  useEffect(() => {
    if (tenant && currentOrganization) {
      fetchUsers();
    }
  }, [tenant, currentOrganization]);

  const fetchUsers = async () => {
    if (!tenant || !currentOrganization) return;

    try {
      const response = await fetch(`/api/tenant/${tenant}/members`);
      if (!response.ok) {
        throw new Error('Failed to fetch members');
      }
      const data = await response.json();
      setUsers(data.members || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch members');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (memberId: string, newRole: 'OWNER' | 'ADMIN' | 'MANAGER' | 'CREATOR' | 'VIEWER' | 'MEMBER') => {
    // Prevent multiple simultaneous updates for the same member
    if (updatingRoles.has(memberId)) return;

    setUpdatingRoles(prev => new Set(prev).add(memberId));

    try {
      const response = await fetch(`/api/tenant/${tenant}/members`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ memberId, role: newRole }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update member role');
      }

      // Refresh the member list to get updated data
      await fetchUsers();
      console.log(`Member role updated to ${newRole}`);

    } catch (error) {
      console.error('Error updating member role:', error);

      let errorMessage = 'Failed to update member role';
      if (error instanceof Error) {
        errorMessage = error.message;
      }

      // Revert by refetching
      fetchUsers();

      alert(`Error updating member role: ${errorMessage}`);
    } finally {
      setUpdatingRoles(prev => {
        const newSet = new Set(prev);
        newSet.delete(memberId);
        return newSet;
      });
    }
  };

  const filteredUsers = users
    .filter((user) => {
      const searchLower = searchTerm.toLowerCase();
      const fullName = `${user.firstName || ''} ${user.lastName || ''}`.toLowerCase();
      const email = user.email?.toLowerCase() || '';
      return fullName.includes(searchLower) || email.includes(searchLower);
    })
    .sort((a, b) => {
      // First, sort by role priority: OWNER > ADMIN > MANAGER > CREATOR > VIEWER > MEMBER
      const getRolePriority = (role: string) => {
        switch (role) {
          case 'OWNER': return 0;
          case 'ADMIN': return 1;
          case 'MANAGER': return 2;
          case 'CREATOR': return 3;
          case 'VIEWER': return 4;
          case 'MEMBER': return 5;
          default: return 6;
        }
      };

      const rolePriorityA = getRolePriority(a.role);
      const rolePriorityB = getRolePriority(b.role);

      if (rolePriorityA !== rolePriorityB) {
        return rolePriorityA - rolePriorityB;
      }

      // If roles are the same, then sort by the selected criteria
      switch (sortBy) {
        case 'name':
          const nameA = `${a.firstName || ''} ${a.lastName || ''}`.trim();
          const nameB = `${b.firstName || ''} ${b.lastName || ''}`.trim();
          return nameA.localeCompare(nameB);
        case 'email':
          return (a.email || '').localeCompare(b.email || '');
        case 'created':
          return new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime();
        case 'activity':
          const activityA = a._count.images + a._count.videos + a._count.jobs;
          const activityB = b._count.images + b._count.videos + b._count.jobs;
          return activityB - activityA;
        default:
          // Default to name sorting within the same role
          const defaultNameA = `${a.firstName || ''} ${a.lastName || ''}`.trim();
          const defaultNameB = `${b.firstName || ''} ${b.lastName || ''}`.trim();
          return defaultNameA.localeCompare(defaultNameB);
      }
    });

  if (loading) {
    return (
      <div className="space-y-3 xs:space-y-4">
        <h3 className="text-base xs:text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">Organization Members</h3>
        <div className="flex items-center justify-center py-8 xs:py-12">
          <div className="animate-spin rounded-full h-6 w-6 xs:h-8 xs:w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-3 xs:space-y-4">
        <h3 className="text-base xs:text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">Organization Members</h3>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 xs:p-4">
          <p className="text-red-800 dark:text-red-200 text-xs xs:text-sm sm:text-base">Error: {error}</p>
          <button
            onClick={fetchUsers}
            className="mt-2 bg-red-600 hover:bg-red-700 active:scale-95 text-white px-3 xs:px-4 py-1.5 xs:py-2 rounded-lg text-xs xs:text-sm font-medium transition-all"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 xs:space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 xs:gap-4">
        <h3 className="text-base xs:text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">Organization Members</h3>
        
        <div className="flex flex-col xs:flex-row gap-2 xs:gap-3">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-2.5 xs:left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-3.5 h-3.5 xs:w-4 xs:h-4" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 xs:pl-10 pr-3 xs:pr-4 py-1.5 xs:py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800/50 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 text-xs xs:text-sm"
            />
          </div>

          {/* Sort Dropdown */}
          <div className="relative">
            <Filter className="absolute left-2.5 xs:left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-3.5 h-3.5 xs:w-4 xs:h-4" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="pl-8 xs:pl-10 pr-7 xs:pr-8 py-1.5 xs:py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800/50 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white text-xs xs:text-sm appearance-none"
            >
              <option value="created">Newest First</option>
              <option value="name">Name</option>
              <option value="email">Email</option>
              <option value="activity">Most Active</option>
            </select>
          </div>

          {/* Invite Members Button */}
          {currentOrganization && (
            <button
              onClick={() => setIsInviteModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg transition-all shadow-lg hover:shadow-xl text-xs xs:text-sm font-medium"
            >
              <UserPlus className="w-4 h-4" />
              <span className="hidden xs:inline">Invite Members</span>
              <span className="xs:hidden">Invite</span>
            </button>
          )}
        </div>
      </div>

      {/* Members Count */}
      <div className="bg-gradient-to-r from-blue-50/50 to-purple-50/50 dark:from-blue-900/10 dark:to-purple-900/10 border border-blue-200/30 dark:border-blue-700/20 rounded-lg p-2.5 xs:p-3 sm:p-4">
        <p className="text-xs xs:text-sm text-gray-600 dark:text-gray-300">
          Showing <span className="font-semibold text-blue-600 dark:text-blue-400">{filteredUsers.length}</span> of{' '}
          <span className="font-semibold text-blue-600 dark:text-blue-400">{users.length}</span> total members
        </p>
      </div>

      {/* Users Table */}
      <div className="bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-800/50 dark:to-gray-900/30 border border-gray-200/50 dark:border-gray-700/30 rounded-lg sm:rounded-xl shadow-lg backdrop-blur-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead className="bg-gradient-to-r from-gray-50 to-blue-50/30 dark:from-gray-900/50 dark:to-blue-900/20 border-b border-gray-200/50 dark:border-gray-700/30">
              <tr>
                <th className="px-3 xs:px-4 sm:px-6 py-2.5 xs:py-3 sm:py-4 text-left text-[10px] xs:text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  User
                </th>
                <th className="px-3 xs:px-4 sm:px-6 py-2.5 xs:py-3 sm:py-4 text-left text-[10px] xs:text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-3 xs:px-4 sm:px-6 py-2.5 xs:py-3 sm:py-4 text-left text-[10px] xs:text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-3 xs:px-4 sm:px-6 py-2.5 xs:py-3 sm:py-4 text-left text-[10px] xs:text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  Activity
                </th>
                <th className="px-3 xs:px-4 sm:px-6 py-2.5 xs:py-3 sm:py-4 text-left text-[10px] xs:text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  Dates
                </th>
                <th className="px-3 xs:px-4 sm:px-6 py-2.5 xs:py-3 sm:py-4 text-left text-[10px] xs:text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200/50 dark:divide-gray-700/30">
              {filteredUsers.map((user, index) => (
                <tr 
                  key={user.id}
                  className={`${
                    index % 2 === 0 
                      ? 'bg-white/50 dark:bg-gray-900/20' 
                      : 'bg-gray-50/30 dark:bg-gray-800/20'
                  } hover:bg-blue-50/50 dark:hover:bg-blue-900/20 transition-colors duration-200`}
                >
                  {/* User Info */}
                  <td className="px-3 xs:px-4 sm:px-6 py-2.5 xs:py-3 sm:py-4">
                    <div className="flex items-center space-x-2 xs:space-x-3">
                      <div className="w-8 h-8 xs:w-10 xs:h-10 rounded-full overflow-hidden bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                        {user.imageUrl ? (
                          <img src={user.imageUrl} alt={user.firstName || 'User'} className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-4 h-4 xs:w-5 xs:h-5 text-white" />
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white text-xs xs:text-sm">
                          {user.firstName && user.lastName
                            ? `${user.firstName} ${user.lastName}`
                            : user.firstName || user.lastName || 'Anonymous User'}
                        </p>
                        <p className="text-[10px] xs:text-xs text-gray-500 dark:text-gray-400">
                          ID: {user.clerkId.slice(-8)}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Contact Info */}
                  <td className="px-3 xs:px-4 sm:px-6 py-2.5 xs:py-3 sm:py-4">
                    <div className="flex items-center space-x-1 text-xs xs:text-sm">
                      <Mail className="w-3 h-3 xs:w-4 xs:h-4 text-gray-400 flex-shrink-0" />
                      <span className="text-gray-700 dark:text-gray-300 truncate max-w-[120px] xs:max-w-none">
                        {user.email || 'No email'}
                      </span>
                    </div>
                  </td>

                  {/* Role */}
                  <td className="px-3 xs:px-4 sm:px-6 py-2.5 xs:py-3 sm:py-4">
                    <select
                      value={user.role}
                      onChange={(e) => handleRoleChange(user.id, e.target.value as 'OWNER' | 'ADMIN' | 'MANAGER' | 'CREATOR' | 'VIEWER' | 'MEMBER')}
                      disabled={updatingRoles.has(user.id) || user.role === 'OWNER'}
                      className={`px-2 xs:px-3 py-1 rounded-full text-[10px] xs:text-xs font-medium border-0 cursor-pointer transition-colors ${
                        updatingRoles.has(user.id) || user.role === 'OWNER'
                          ? 'opacity-50 cursor-not-allowed bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                          : user.role === 'ADMIN'
                          ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50'
                          : user.role === 'MANAGER'
                          ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-900/50'
                          : user.role === 'CREATOR'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50'
                          : user.role === 'VIEWER'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800/50'
                      } focus:ring-2 focus:ring-blue-500 focus:outline-none`}
                    >
                      <option value="OWNER">Owner</option>
                      <option value="ADMIN">Admin</option>
                      <option value="MANAGER">Manager</option>
                      <option value="CREATOR">Creator</option>
                      <option value="VIEWER">Viewer</option>
                      <option value="MEMBER">Member</option>
                    </select>
                    {updatingRoles.has(user.id) && (
                      <div className="mt-1 text-[10px] xs:text-xs text-gray-500 dark:text-gray-400">
                        Updating...
                      </div>
                    )}
                  </td>

                  {/* Activity Stats */}
                  <td className="px-3 xs:px-4 sm:px-6 py-2.5 xs:py-3 sm:py-4">
                    <div className="flex flex-col gap-1 xs:grid xs:grid-cols-2 xs:gap-2 text-[10px] xs:text-xs min-w-[140px]">
                      <div className="bg-blue-100/50 dark:bg-blue-900/30 rounded px-2 py-1 text-center">
                        <span className="font-semibold text-blue-800 dark:text-blue-300">{user._count.influencers}</span>
                        <span className="text-blue-600 dark:text-blue-400 ml-1">Influencers</span>
                      </div>
                      <div className="bg-purple-100/50 dark:bg-purple-900/30 rounded px-2 py-1 text-center">
                        <span className="font-semibold text-purple-800 dark:text-purple-300">{user._count.jobs}</span>
                        <span className="text-purple-600 dark:text-purple-400 ml-1">Jobs</span>
                      </div>
                      <div className="bg-emerald-100/50 dark:bg-emerald-900/30 rounded px-2 py-1 text-center">
                        <span className="font-semibold text-emerald-800 dark:text-emerald-300">{user._count.images}</span>
                        <span className="text-emerald-600 dark:text-emerald-400 ml-1">Images</span>
                      </div>
                      <div className="bg-orange-100/50 dark:bg-orange-900/30 rounded px-2 py-1 text-center">
                        <span className="font-semibold text-orange-800 dark:text-orange-300">{user._count.videos}</span>
                        <span className="text-orange-600 dark:text-orange-400 ml-1">Videos</span>
                      </div>
                    </div>
                  </td>

                  {/* Dates */}
                  <td className="px-3 xs:px-4 sm:px-6 py-2.5 xs:py-3 sm:py-4 text-xs xs:text-sm text-gray-600 dark:text-gray-300">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-1">
                        <Calendar className="w-3 h-3 text-gray-400 flex-shrink-0" />
                        <span className="whitespace-nowrap">Joined: {new Date(user.joinedAt).toLocaleDateString()}</span>
                      </div>
                      {user.lastSignInAt && (
                        <div className="text-[10px] xs:text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                          Last active: {new Date(user.lastSignInAt).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="px-3 xs:px-4 sm:px-6 py-2.5 xs:py-3 sm:py-4">
                    <button className="p-1.5 xs:p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors group active:scale-95">
                      <Eye className="w-3.5 h-3.5 xs:w-4 xs:h-4 text-gray-500 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {filteredUsers.length === 0 && (
        <div className="text-center py-8 xs:py-12">
          <User className="w-10 h-10 xs:w-12 xs:h-12 text-gray-400 mx-auto mb-3 xs:mb-4" />
          <h3 className="text-base xs:text-lg font-medium text-gray-900 dark:text-white mb-2">No users found</h3>
          <p className="text-xs xs:text-sm sm:text-base text-gray-500 dark:text-gray-400">
            {searchTerm ? 'Try adjusting your search terms' : 'No users have signed up yet'}
          </p>
        </div>
      )}

      {/* Invite Members Modal */}
      {currentOrganization && (
        <InviteMembersModal
          organizationSlug={currentOrganization.slug}
          organizationName={currentOrganization.name}
          isOpen={isInviteModalOpen}
          onClose={() => setIsInviteModalOpen(false)}
          onSuccess={fetchUsers}
        />
      )}
    </div>
  );
}