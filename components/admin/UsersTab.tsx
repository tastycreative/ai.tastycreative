'use client';

import { useState, useEffect } from 'react';
import { User, Mail, Calendar, Eye, Search, Filter } from 'lucide-react';

interface UserData {
  id: string;
  clerkId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
  role: 'USER' | 'MANAGER' | 'ADMIN';
  createdAt: string;
  lastSignInAt: string | null;
  inDatabase?: boolean;
  isOrphaned?: boolean;
  _count: {
    images: number;
    videos: number;
    jobs: number;
    influencers: number;
  };
}

export default function UsersTab() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'email' | 'created' | 'activity'>('created');
  const [updatingRoles, setUpdatingRoles] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/admin/users');
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      const data = await response.json();
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: 'USER' | 'MANAGER' | 'ADMIN') => {
    // Prevent multiple simultaneous updates for the same user
    if (updatingRoles.has(userId)) return;

    setUpdatingRoles(prev => new Set(prev).add(userId));

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: newRole }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update user role');
      }

      const result = await response.json();

      // If the user was created in the database (was Clerk-only before)
      if (result.created) {
        // Refresh the entire user list to get the updated status
        await fetchUsers();
        console.log(`User created in database and role set to ${newRole}`);
      } else {
        // Just update the user in the local state
        setUsers(prevUsers =>
          prevUsers.map(user =>
            user.clerkId === userId
              ? { ...user, role: newRole }
              : user
          )
        );
        console.log(`User role updated to ${newRole}`);
      }

    } catch (error) {
      console.error('Error updating user role:', error);
      // Revert the dropdown to the original value by refetching
      fetchUsers();
      // You could show an error toast here
      alert(error instanceof Error ? error.message : 'Failed to update user role');
    } finally {
      setUpdatingRoles(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
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
      // First, sort by role priority: ADMIN > MANAGER > USER
      const getRolePriority = (role: string) => {
        switch (role) {
          case 'ADMIN': return 0;
          case 'MANAGER': return 1;
          case 'USER': return 2;
          default: return 3;
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
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
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
      <div className="space-y-4">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Users Management</h3>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Users Management</h3>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">Error: {error}</p>
          <button
            onClick={fetchUsers}
            className="mt-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Users Management</h3>
        
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800/50 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 text-sm"
            />
          </div>

          {/* Sort Dropdown */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="pl-10 pr-8 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800/50 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white text-sm appearance-none"
            >
              <option value="created">Newest First</option>
              <option value="name">Name</option>
              <option value="email">Email</option>
              <option value="activity">Most Active</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users Count & Debug Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gradient-to-r from-blue-50/50 to-purple-50/50 dark:from-blue-900/10 dark:to-purple-900/10 border border-blue-200/30 dark:border-blue-700/20 rounded-lg p-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Showing <span className="font-semibold text-blue-600 dark:text-blue-400">{filteredUsers.length}</span> of{' '}
            <span className="font-semibold text-blue-600 dark:text-blue-400">{users.length}</span> total users
          </p>
        </div>
        
        <div className="bg-gradient-to-r from-emerald-50/50 to-teal-50/50 dark:from-emerald-900/10 dark:to-teal-900/10 border border-emerald-200/30 dark:border-emerald-700/20 rounded-lg p-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            <span className="font-semibold text-green-600 dark:text-green-400">{users.filter(u => u.inDatabase && !u.isOrphaned).length}</span> Synced,{' '}
            <span className="font-semibold text-yellow-600 dark:text-yellow-400">{users.filter(u => !u.inDatabase).length}</span> Clerk only,{' '}
            <span className="font-semibold text-red-600 dark:text-red-400">{users.filter(u => u.isOrphaned).length}</span> Orphaned
          </p>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-800/50 dark:to-gray-900/30 border border-gray-200/50 dark:border-gray-700/30 rounded-xl shadow-lg backdrop-blur-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-gray-50 to-blue-50/30 dark:from-gray-900/50 dark:to-blue-900/20 border-b border-gray-200/50 dark:border-gray-700/30">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  Activity
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  Dates
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
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
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                        {user.imageUrl ? (
                          <img src={user.imageUrl} alt={user.firstName || 'User'} className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-5 h-5 text-white" />
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {user.firstName && user.lastName
                            ? `${user.firstName} ${user.lastName}`
                            : user.firstName || user.lastName || 'Anonymous User'}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          ID: {user.clerkId.slice(-8)}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Contact Info */}
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-1 text-sm">
                      <Mail className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-700 dark:text-gray-300">
                        {user.email || 'No email'}
                      </span>
                    </div>
                  </td>

                  {/* Role */}
                  <td className="px-6 py-4">
                    <select
                      value={user.role}
                      onChange={(e) => handleRoleChange(user.clerkId, e.target.value as 'USER' | 'MANAGER' | 'ADMIN')}
                      disabled={updatingRoles.has(user.clerkId)}
                      className={`px-3 py-1 rounded-full text-xs font-medium border-0 cursor-pointer transition-colors ${
                        updatingRoles.has(user.clerkId)
                          ? 'opacity-50 cursor-not-allowed bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                          : user.role === 'ADMIN'
                          ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50'
                          : user.role === 'MANAGER'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800/50'
                      } focus:ring-2 focus:ring-blue-500 focus:outline-none`}
                    >
                      <option value="USER">User</option>
                      <option value="MANAGER">Manager</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                    {updatingRoles.has(user.clerkId) && (
                      <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Updating...
                      </div>
                    )}
                  </td>

                  {/* Status */}
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      {user.isOrphaned ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                          Orphaned (DB only)
                        </span>
                      ) : user.inDatabase ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                          Synced
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                          Clerk only
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Activity Stats */}
                  <td className="px-6 py-4">
                    <div className="grid grid-cols-2 gap-2 text-xs">
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
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-1">
                        <Calendar className="w-3 h-3 text-gray-400" />
                        <span>Joined: {new Date(user.createdAt).toLocaleDateString()}</span>
                      </div>
                      {user.lastSignInAt && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Last active: {new Date(user.lastSignInAt).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="px-6 py-4">
                    <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors group">
                      <Eye className="w-4 h-4 text-gray-500 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {filteredUsers.length === 0 && (
        <div className="text-center py-12">
          <User className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No users found</h3>
          <p className="text-gray-500 dark:text-gray-400">
            {searchTerm ? 'Try adjusting your search terms' : 'No users have signed up yet'}
          </p>
        </div>
      )}
    </div>
  );
}