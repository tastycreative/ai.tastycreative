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
  role: 'SUPER_ADMIN' | 'ADMIN' | 'USER';
  createdAt: string;
  lastSignInAt: string | null;
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
      setUsers(data.users || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: 'SUPER_ADMIN' | 'ADMIN' | 'USER') => {
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

      // Refresh the user list to get updated data
      await fetchUsers();
      console.log(`User role updated to ${newRole}`);

    } catch (error) {
      console.error('Error updating user role:', error);

      let errorMessage = 'Failed to update user role';
      if (error instanceof Error) {
        errorMessage = error.message;
      }

      // Revert by refetching
      fetchUsers();

      alert(`Error updating user role: ${errorMessage}`);
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
      // First, sort by role priority: SUPER_ADMIN > ADMIN > USER
      const getRolePriority = (role: string) => {
        switch (role) {
          case 'SUPER_ADMIN': return 0;
          case 'ADMIN': return 1;
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
      <div className="space-y-3 xs:space-y-4">
        <h3 className="text-base xs:text-lg sm:text-xl font-semibold text-foreground">Users Management</h3>
        <div className="flex items-center justify-center py-8 xs:py-12">
          <div className="animate-spin rounded-full h-6 w-6 xs:h-8 xs:w-8 border-b-2 border-[#EC67A1]"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-3 xs:space-y-4">
        <h3 className="text-base xs:text-lg sm:text-xl font-semibold text-foreground">Users Management</h3>
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 xs:p-4">
          <p className="text-destructive text-xs xs:text-sm sm:text-base">Error: {error}</p>
          <button
            onClick={fetchUsers}
            className="mt-2 bg-[#EC67A1] hover:bg-[#F774B9] active:scale-95 text-white px-3 xs:px-4 py-1.5 xs:py-2 rounded-lg text-xs xs:text-sm font-medium transition-all shadow-md shadow-[#EC67A1]/25"
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
        <h3 className="text-base xs:text-lg sm:text-xl font-semibold text-foreground">Users Management</h3>
        
        <div className="flex flex-col xs:flex-row gap-2 xs:gap-3">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-2.5 xs:left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-3.5 h-3.5 xs:w-4 xs:h-4" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 xs:pl-10 pr-3 xs:pr-4 py-1.5 xs:py-2 border border-border bg-card rounded-lg focus:ring-2 focus:ring-[#EC67A1] focus:border-transparent text-foreground placeholder-muted-foreground text-xs xs:text-sm transition-all"
            />
          </div>

          {/* Sort Dropdown */}
          <div className="relative">
            <Filter className="absolute left-2.5 xs:left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-3.5 h-3.5 xs:w-4 xs:h-4" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="pl-8 xs:pl-10 pr-7 xs:pr-8 py-1.5 xs:py-2 border border-border bg-card rounded-lg focus:ring-2 focus:ring-[#5DC3F8] focus:border-transparent text-foreground text-xs xs:text-sm appearance-none transition-all"
            >
              <option value="created">Newest First</option>
              <option value="name">Name</option>
              <option value="email">Email</option>
              <option value="activity">Most Active</option>
            </select>
          </div>

          {/* Add User Button - Optional, can be removed if users are managed through Clerk */}
        </div>
      </div>

      {/* Members Count */}
      <div className="bg-gradient-to-r from-[#EC67A1]/5 to-[#5DC3F8]/5 border border-[#EC67A1]/20 rounded-lg p-2.5 xs:p-3 sm:p-4">
        <p className="text-xs xs:text-sm text-foreground/80">
          Showing <span className="font-semibold text-[#EC67A1]">{filteredUsers.length}</span> of{' '}
          <span className="font-semibold text-[#5DC3F8]">{users.length}</span> total users
        </p>
      </div>

      {/* Users Table */}
      <div className="bg-card/50 backdrop-blur-sm border border-border rounded-lg sm:rounded-xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead className="bg-gradient-to-r from-[#EC67A1]/5 to-[#5DC3F8]/5 border-b border-border">
              <tr>
                <th className="px-3 xs:px-4 sm:px-6 py-2.5 xs:py-3 sm:py-4 text-left text-[10px] xs:text-xs font-semibold text-foreground/70 uppercase tracking-wider">
                  User
                </th>
                <th className="px-3 xs:px-4 sm:px-6 py-2.5 xs:py-3 sm:py-4 text-left text-[10px] xs:text-xs font-semibold text-foreground/70 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-3 xs:px-4 sm:px-6 py-2.5 xs:py-3 sm:py-4 text-left text-[10px] xs:text-xs font-semibold text-foreground/70 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-3 xs:px-4 sm:px-6 py-2.5 xs:py-3 sm:py-4 text-left text-[10px] xs:text-xs font-semibold text-foreground/70 uppercase tracking-wider">
                  Activity
                </th>
                <th className="px-3 xs:px-4 sm:px-6 py-2.5 xs:py-3 sm:py-4 text-left text-[10px] xs:text-xs font-semibold text-foreground/70 uppercase tracking-wider">
                  Dates
                </th>
                <th className="px-3 xs:px-4 sm:px-6 py-2.5 xs:py-3 sm:py-4 text-left text-[10px] xs:text-xs font-semibold text-foreground/70 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredUsers.map((user, index) => (
                <tr 
                  key={user.id}
                  className={`${
                    index % 2 === 0 
                      ? 'bg-card/30' 
                      : 'bg-accent/30'
                  } hover:bg-[#EC67A1]/5 transition-colors duration-200`}
                >
                  {/* User Info */}
                  <td className="px-3 xs:px-4 sm:px-6 py-2.5 xs:py-3 sm:py-4">
                    <div className="flex items-center space-x-2 xs:space-x-3">
                      <div className="w-8 h-8 xs:w-10 xs:h-10 rounded-full overflow-hidden bg-gradient-to-br from-[#EC67A1] to-[#F774B9] flex items-center justify-center flex-shrink-0 shadow-md shadow-[#EC67A1]/25">
                        {user.imageUrl ? (
                          <img src={user.imageUrl} alt={user.firstName || 'User'} className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-4 h-4 xs:w-5 xs:h-5 text-white" />
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-foreground text-xs xs:text-sm">
                          {user.firstName && user.lastName
                            ? `${user.firstName} ${user.lastName}`
                            : user.firstName || user.lastName || 'Anonymous User'}
                        </p>
                        <p className="text-[10px] xs:text-xs text-muted-foreground">
                          ID: {user.clerkId.slice(-8)}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Contact Info */}
                  <td className="px-3 xs:px-4 sm:px-6 py-2.5 xs:py-3 sm:py-4">
                    <div className="flex items-center space-x-1 text-xs xs:text-sm">
                      <Mail className="w-3 h-3 xs:w-4 xs:h-4 text-[#5DC3F8] flex-shrink-0" />
                      <span className="text-foreground/80 truncate max-w-[120px] xs:max-w-none">
                        {user.email || 'No email'}
                      </span>
                    </div>
                  </td>

                  {/* Role */}
                  <td className="px-3 xs:px-4 sm:px-6 py-2.5 xs:py-3 sm:py-4">
                    <select
                      value={user.role}
                      onChange={(e) => handleRoleChange(user.clerkId, e.target.value as 'SUPER_ADMIN' | 'ADMIN' | 'USER')}
                      disabled={updatingRoles.has(user.clerkId) || user.role === 'SUPER_ADMIN'}
                      className={`px-2 xs:px-3 py-1 rounded-full text-[10px] xs:text-xs font-medium border border-border cursor-pointer transition-colors ${
                        updatingRoles.has(user.clerkId) || user.role === 'SUPER_ADMIN'
                          ? 'opacity-50 cursor-not-allowed bg-[#EC67A1]/20 text-[#EC67A1] border-[#EC67A1]/30'
                          : user.role === 'ADMIN'
                          ? 'bg-[#F774B9]/10 text-[#F774B9] border-[#F774B9]/30 hover:bg-[#F774B9]/20'
                          : 'bg-accent text-foreground hover:bg-accent/80'
                      } focus:ring-2 focus:ring-[#EC67A1] focus:outline-none`}
                    >
                      <option value="SUPER_ADMIN">Super Admin</option>
                      <option value="ADMIN">Admin</option>
                      <option value="USER">User</option>
                    </select>
                    {updatingRoles.has(user.clerkId) && (
                      <div className="mt-1 text-[10px] xs:text-xs text-muted-foreground">
                        Updating...
                      </div>
                    )}
                  </td>

                  {/* Activity Stats */}
                  <td className="px-3 xs:px-4 sm:px-6 py-2.5 xs:py-3 sm:py-4">
                    <div className="flex flex-col gap-1 xs:grid xs:grid-cols-2 xs:gap-2 text-[10px] xs:text-xs min-w-[140px]">
                      <div className="bg-[#EC67A1]/10 border border-[#EC67A1]/20 rounded px-2 py-1 text-center">
                        <span className="font-semibold text-[#EC67A1]">{user._count.influencers}</span>
                        <span className="text-foreground/70 ml-1">Influencers</span>
                      </div>
                      <div className="bg-[#F774B9]/10 border border-[#F774B9]/20 rounded px-2 py-1 text-center">
                        <span className="font-semibold text-[#F774B9]">{user._count.jobs}</span>
                        <span className="text-foreground/70 ml-1">Jobs</span>
                      </div>
                      <div className="bg-[#5DC3F8]/10 border border-[#5DC3F8]/20 rounded px-2 py-1 text-center">
                        <span className="font-semibold text-[#5DC3F8]">{user._count.images}</span>
                        <span className="text-foreground/70 ml-1">Images</span>
                      </div>
                      <div className="bg-accent border border-border rounded px-2 py-1 text-center">
                        <span className="font-semibold text-foreground">{user._count.videos}</span>
                        <span className="text-foreground/70 ml-1">Videos</span>
                      </div>
                    </div>
                  </td>

                  {/* Dates */}
                  <td className="px-3 xs:px-4 sm:px-6 py-2.5 xs:py-3 sm:py-4 text-xs xs:text-sm text-foreground/80">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-1">
                        <Calendar className="w-3 h-3 text-[#EC67A1] flex-shrink-0" />
                        <span className="whitespace-nowrap">Created: {new Date(user.createdAt).toLocaleDateString()}</span>
                      </div>
                      {user.lastSignInAt && (
                        <div className="text-[10px] xs:text-xs text-muted-foreground whitespace-nowrap">
                          Last active: {new Date(user.lastSignInAt).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="px-3 xs:px-4 sm:px-6 py-2.5 xs:py-3 sm:py-4">
                    <button className="p-1.5 xs:p-2 hover:bg-accent rounded-lg transition-colors group active:scale-95 border border-transparent hover:border-[#5DC3F8]/30">
                      <Eye className="w-3.5 h-3.5 xs:w-4 xs:h-4 text-muted-foreground group-hover:text-[#5DC3F8]" />
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
          <User className="w-10 h-10 xs:w-12 xs:h-12 text-muted-foreground mx-auto mb-3 xs:mb-4" />
          <h3 className="text-base xs:text-lg font-medium text-foreground mb-2">No users found</h3>
          <p className="text-xs xs:text-sm sm:text-base text-muted-foreground">
            {searchTerm ? 'Try adjusting your search terms' : 'No users have signed up yet'}
          </p>
        </div>
      )}


    </div>
  );
}
