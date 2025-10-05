'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, User, Instagram, Cpu, CheckCircle, XCircle, Clock, Image, Video, FileText, Plus, X } from 'lucide-react';

interface ProductionTrackerTabProps {
  stats: {
    activeJobs: number;
  };
}

interface ProductionEntry {
  id: string;
  deadline: string;
  assignee: string;
  influencer: string;
  instagramSource: string;
  loraModel: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  imagesTarget: number;
  imagesGenerated: number;
  videosTarget: number;
  videosGenerated: number;
  notes: string | null;
  createdAt?: string;
  updatedAt?: string;
}

interface NewEntryForm {
  date: string;
  assignee: string;
  influencer: string;
  instagramSource: string;
  loraModel: string;
  imagesTarget: number;
  videosTarget: number;
}

interface ContentCreator {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  role: string;
}

// Global Modal Component using React Portal
function GlobalModal({ isOpen, onClose, children }: { isOpen: boolean; onClose: () => void; children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

export default function ProductionTrackerTab({ stats }: ProductionTrackerTabProps) {
  const [productionData, setProductionData] = useState<ProductionEntry[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [contentCreators, setContentCreators] = useState<ContentCreator[]>([]);
  const [contentCreatorsLoading, setContentCreatorsLoading] = useState(true);
  const [selectedCreatorId, setSelectedCreatorId] = useState<string>('all');
  const [formData, setFormData] = useState<NewEntryForm>({
    date: '',
    assignee: '',
    influencer: '',
    instagramSource: '',
    loraModel: '',
    imagesTarget: 0,
    videosTarget: 0,
  });

  // Load production data from database on component mount
  useEffect(() => {
    fetchProductionEntries();
  }, []);

  // Fetch content creators when component mounts
  useEffect(() => {
    fetchContentCreators();
  }, []);

  const fetchProductionEntries = async () => {
    try {
      setLoading(true);
      console.log('Fetching production entries...');
      const response = await fetch('/api/admin/production-entries', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const entries = await response.json();
        console.log('Fetched production entries:', entries);
        setProductionData(entries);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Failed to fetch production entries:', response.status, errorData);
      }
    } catch (error) {
      console.error('Error fetching production entries:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchContentCreators = async () => {
    try {
      setContentCreatorsLoading(true);
      const response = await fetch('/api/admin/content-creators', {
        method: 'GET',
        credentials: 'include', // Include cookies for authentication
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Fetched content creators successfully:', data);
        setContentCreators(data);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('API error:', response.status, errorData);
        
        // If no content creators found or authentication issues, provide a helpful fallback
        if (response.status === 401) {
          console.log('Authentication required - user may need to be logged in as admin');
        } else if (response.status === 403) {
          console.log('Admin access required');
        }
        
        // Use empty array instead of mock data to indicate no content creators found
        setContentCreators([]);
      }
    } catch (error) {
      console.error('Network error fetching content creators:', error);
      // Use empty array to indicate error state
      setContentCreators([]);
    } finally {
      setContentCreatorsLoading(false);
    }
  };

  // Generate automatic status and notes based on progress
  const generateStatusAndNotes = (imagesTarget: number, imagesGenerated: number, videosTarget: number, videosGenerated: number): { status: ProductionEntry['status'], notes: string } => {
    // If both targets are met
    if (imagesGenerated >= imagesTarget && videosGenerated >= videosTarget) {
      return {
        status: 'COMPLETED',
        notes: 'All content generated successfully'
      };
    }
    
    // If no progress made
    if (imagesGenerated === 0 && videosGenerated === 0) {
      return {
        status: 'PENDING',
        notes: 'Awaiting generation start'
      };
    }
    
    // In progress
    let notes = '';
    if (imagesTarget > 0) {
      if (imagesGenerated < imagesTarget) {
        notes += `Image gen in progress (${imagesGenerated}/${imagesTarget})`;
      } else {
        notes += `Images completed (${imagesGenerated}/${imagesTarget})`;
      }
    }
    
    if (videosTarget > 0) {
      if (notes) notes += ', ';
      if (videosGenerated < videosTarget) {
        notes += `Video gen in progress (${videosGenerated}/${videosTarget})`;
      } else {
        notes += `Videos completed (${videosGenerated}/${videosTarget})`;
      }
    }
    
    return {
      status: 'IN_PROGRESS',
      notes
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      
      const response = await fetch('/api/admin/production-entries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deadline: formData.date,
          assignee: formData.assignee,
          influencer: formData.influencer,
          instagramSource: formData.instagramSource,
          loraModel: formData.loraModel,
          imagesTarget: formData.imagesTarget,
          videosTarget: formData.videosTarget,
          notes: ''
        }),
      });
      
      if (response.ok) {
        const newEntry = await response.json();
        console.log('New entry created:', newEntry);
        setProductionData(prev => [newEntry, ...prev]);
        setShowAddForm(false);
        setFormData({
          date: '',
          assignee: '',
          influencer: '',
          instagramSource: '',
          loraModel: '',
          imagesTarget: 0,
          videosTarget: 0,
        });
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Failed to create production entry:', response.status, errorData);
        alert(`Failed to create production entry: ${response.status} - ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error creating production entry:', error);
    } finally {
      setLoading(false);
    }
  };

  const clearAllData = async () => {
    if (confirm('Are you sure you want to clear all production data? This cannot be undone.')) {
      try {
        // Delete all entries from database
        for (const entry of productionData) {
          await fetch(`/api/admin/production-entries/${entry.id}`, {
            method: 'DELETE',
          });
        }
        setProductionData([]);
      } catch (error) {
        console.error('Error clearing production data:', error);
      }
    }
  };

  const getStatusBadge = (status: ProductionEntry['status']) => {
    const statusConfig = {
      PENDING: {
        icon: Clock,
        bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
        textColor: 'text-yellow-700 dark:text-yellow-300',
        borderColor: 'border-yellow-200 dark:border-yellow-700/30'
      },
      IN_PROGRESS: {
        icon: Clock,
        bgColor: 'bg-blue-50 dark:bg-blue-900/20',
        textColor: 'text-blue-700 dark:text-blue-300',
        borderColor: 'border-blue-200 dark:border-blue-700/30'
      },
      COMPLETED: {
        icon: CheckCircle,
        bgColor: 'bg-green-50 dark:bg-green-900/20',
        textColor: 'text-green-700 dark:text-green-300',
        borderColor: 'border-green-200 dark:border-green-700/30'
      },
      FAILED: {
        icon: XCircle,
        bgColor: 'bg-red-50 dark:bg-red-900/20',
        textColor: 'text-red-700 dark:text-red-300',
        borderColor: 'border-red-200 dark:border-red-700/30'
      }
    };

    const config = statusConfig[status];
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.bgColor} ${config.textColor} ${config.borderColor}`}>
        <Icon className="w-3 h-3 mr-1" />
        {status.charAt(0) + status.slice(1).toLowerCase().replace('_', ' ')}
      </span>
    );
  };

  const getCreatorDisplayName = (creator: ContentCreator): string => {
    if (creator.firstName && creator.lastName) {
      return `${creator.firstName} ${creator.lastName}`;
    } else if (creator.firstName) {
      return creator.firstName;
    } else if (creator.lastName) {
      return creator.lastName;
    } else if (creator.email) {
      return creator.email;
    }
    return 'Unknown Creator';
  };

  // Filter production data based on selected content creator
  const filteredProductionData = selectedCreatorId === 'all' 
    ? productionData 
    : productionData.filter(entry => {
        const assigneeCreator = contentCreators.find(creator => 
          getCreatorDisplayName(creator) === entry.assignee
        );
        return assigneeCreator?.id === selectedCreatorId;
      });

  return (
    <div className="bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900/30 dark:to-gray-800/20 border border-gray-200/50 dark:border-gray-700/30 rounded-xl p-6 shadow-lg backdrop-blur-sm">
      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Master Production Tracker</h3>
      
      {/* Content Creator Filter */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Filter by Content Creator
        </label>
        <select
          value={selectedCreatorId}
          onChange={(e) => setSelectedCreatorId(e.target.value)}
          disabled={contentCreatorsLoading}
          className="w-full md:w-64 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="all">All Content Creators</option>
          {contentCreators.map((creator) => (
            <option key={creator.id} value={creator.id}>
              {getCreatorDisplayName(creator)}
            </option>
          ))}
        </select>
      </div>
      
      <div className="space-y-6">
        {/* Production Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-900/20 dark:to-blue-800/10 border border-blue-200/50 dark:border-blue-700/30 rounded-lg p-4">
            <h4 className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">Active Jobs</h4>
            <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
              {filteredProductionData.filter(item => item.status === 'IN_PROGRESS').length}
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Currently processing</p>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-900/20 dark:to-green-800/10 border border-green-200/50 dark:border-green-700/30 rounded-lg p-4">
            <h4 className="text-sm font-medium text-green-700 dark:text-green-300 mb-2">Completed Today</h4>
            <p className="text-2xl font-bold text-green-900 dark:text-green-100">
              {filteredProductionData.filter(item => item.status === 'COMPLETED' && new Date(item.createdAt || item.deadline).toDateString() === new Date().toDateString()).length}
            </p>
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">Jobs finished</p>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-900/20 dark:to-purple-800/10 border border-purple-200/50 dark:border-purple-700/30 rounded-lg p-4">
            <h4 className="text-sm font-medium text-purple-700 dark:text-purple-300 mb-2">Queue Length</h4>
            <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
              {filteredProductionData.filter(item => item.status === 'PENDING').length}
            </p>
            <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">Jobs waiting</p>
          </div>
        </div>

        {/* Production Table */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Production Entries</h4>
            <div className="flex items-center space-x-2">
              {productionData.length > 0 && selectedCreatorId === 'all' && (
                <button 
                  onClick={clearAllData}
                  className="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 shadow-lg flex items-center space-x-2"
                >
                  <span>Clear All</span>
                </button>
              )}
              <button 
                onClick={() => setShowAddForm(true)}
                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 shadow-lg flex items-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>Add New Entry</span>
              </button>
            </div>
          </div>
          
          <div className="bg-white/70 dark:bg-gray-800/40 border border-gray-200/50 dark:border-gray-700/30 rounded-xl shadow-lg backdrop-blur-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-gray-50 to-blue-50/30 dark:from-gray-900/50 dark:to-blue-900/20 border-b border-gray-200/50 dark:border-gray-700/30">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                      <div className="flex items-center space-x-1">
                        <Calendar className="w-3 h-3" />
                        <span>Deadline</span>
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                      <div className="flex items-center space-x-1">
                        <User className="w-3 h-3" />
                        <span>Assignee</span>
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                      Influencer
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                      <div className="flex items-center space-x-1">
                        <Instagram className="w-3 h-3" />
                        <span>Instagram Source</span>
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                      <div className="flex items-center space-x-1">
                        <Cpu className="w-3 h-3" />
                        <span>LoRA Model</span>
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                      <div className="flex items-center space-x-1">
                        {/* eslint-disable-next-line jsx-a11y/alt-text */}
                        <Image className="w-3 h-3" />
                        <span>Images</span>
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                      <div className="flex items-center space-x-1">
                        <Video className="w-3 h-3" />
                        <span>Videos</span>
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                      <div className="flex items-center space-x-1">
                        <FileText className="w-3 h-3" />
                        <span>Notes</span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200/50 dark:divide-gray-700/30">
                  {filteredProductionData.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                        {selectedCreatorId === 'all' 
                          ? 'No production entries yet. Click "Add New Entry" to get started.'
                          : 'No production entries found for this content creator.'}
                      </td>
                    </tr>
                  ) : (
                    filteredProductionData.map((entry, index) => (
                      <tr 
                        key={entry.id}
                        className={`${
                          index % 2 === 0 
                            ? 'bg-white/50 dark:bg-gray-900/20' 
                            : 'bg-gray-50/30 dark:bg-gray-800/20'
                        } hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors duration-200`}
                      >
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                          {new Date(entry.deadline).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                          {entry.assignee}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                          {entry.influencer}
                        </td>
                        <td className="px-4 py-3 text-sm text-blue-600 dark:text-blue-400 font-mono">
                          <a href={entry.instagramSource.startsWith('http') ? entry.instagramSource : `https://instagram.com/${entry.instagramSource.replace('@', '')}`} 
                             target="_blank" 
                             rel="noopener noreferrer" 
                             className="hover:underline">
                            {entry.instagramSource}
                          </a>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 font-mono">
                          {entry.loraModel}
                        </td>
                        <td className="px-4 py-3">
                          {getStatusBadge(entry.status)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 text-center">
                          <span className="inline-flex items-center px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 text-xs font-medium">
                            {entry.imagesGenerated}/{entry.imagesTarget}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 text-center">
                          <span className="inline-flex items-center px-2 py-1 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 text-xs font-medium">
                            {entry.videosGenerated}/{entry.videosTarget}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 max-w-xs truncate">
                          {entry.notes}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Add New Entry Modal */}
      <GlobalModal isOpen={showAddForm} onClose={() => setShowAddForm(false)}>
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Add New Production Entry</h3>
          <button
            onClick={() => setShowAddForm(false)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Deadline
              </label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Assignee (Content Creator)
              </label>
              <select
                required
                value={formData.assignee}
                onChange={(e) => setFormData(prev => ({ ...prev, assignee: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                disabled={contentCreatorsLoading}
              >
                <option value="">
                  {contentCreatorsLoading 
                    ? 'Loading content creators...' 
                    : contentCreators.length === 0 
                      ? 'No content creators found - Create some content creators first' 
                      : 'Select Content Creator'
                  }
                </option>
                {contentCreators.map((creator: ContentCreator) => {
                  const displayName = creator.firstName && creator.lastName 
                    ? `${creator.firstName} ${creator.lastName}`
                    : creator.firstName || creator.lastName || creator.email || 'Unknown Creator';
                  return (
                    <option key={creator.id} value={displayName}>
                      {displayName}
                    </option>
                  );
                })}
              </select>
              {!contentCreatorsLoading && contentCreators.length === 0 && (
                <p className="mt-1 text-sm text-yellow-600 dark:text-yellow-400">
                  No content creators found. You may need to assign some users the CONTENT_CREATOR role first.
                </p>
              )}
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Influencer Name
            </label>
            <input
              type="text"
              required
              value={formData.influencer}
              onChange={(e) => setFormData(prev => ({ ...prev, influencer: e.target.value }))}
              placeholder="Enter influencer name"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Instagram Source (URL or @handle)
            </label>
            <input
              type="text"
              required
              value={formData.instagramSource}
              onChange={(e) => setFormData(prev => ({ ...prev, instagramSource: e.target.value }))}
              placeholder="@username or https://instagram.com/username"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              LoRA Model Name
            </label>
            <input
              type="text"
              required
              value={formData.loraModel}
              onChange={(e) => setFormData(prev => ({ ...prev, loraModel: e.target.value }))}
              placeholder="e.g. fashion_v2.1"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Target Images to Generate
              </label>
              <input
                type="number"
                min="0"
                required
                value={formData.imagesTarget}
                onChange={(e) => setFormData(prev => ({ ...prev, imagesTarget: parseInt(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Target Videos to Generate
              </label>
              <input
                type="number"
                min="0"
                required
                value={formData.videosTarget}
                onChange={(e) => setFormData(prev => ({ ...prev, videosTarget: parseInt(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>
          
          <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 rounded-lg transition-all duration-200 shadow-lg disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Add Entry'}
            </button>
          </div>
        </form>
      </GlobalModal>
    </div>
  );
}