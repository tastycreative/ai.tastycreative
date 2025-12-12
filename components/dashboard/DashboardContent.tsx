import { Plus, CreditCard, Users, FileText, ChevronRight } from 'lucide-react';
import SearchBar from './SearchBar';

interface DashboardInfluencer {
  id: string;
  name: string;
  description: string | null;
  thumbnailUrl: string | null;
  uploadedAt: string;
  usageCount: number;
}

interface DashboardContentProps {
  firstName: string;
  totalInfluencers: number;
  totalContentGenerated: number;
  influencers: DashboardInfluencer[];
}

function formatDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '--';
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export default function DashboardContent({
  firstName,
  totalInfluencers,
  totalContentGenerated,
  influencers,
}: DashboardContentProps) {
  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Welcome Section */}
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 dark:text-white tracking-tight">Dashboard</h1>
          <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mt-1">Manage your AI influencers</p>
        </div>
        
        {/* Train New Influencer Button */}
        <button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-5 sm:px-6 py-2.5 sm:py-3 rounded-lg font-semibold flex items-center justify-center sm:justify-start space-x-2 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 w-full sm:w-auto">
          <Plus className="w-4 h-4" />
          <span>Start Training</span>
        </button>
      </div>

      {/* Fanvue Bonus Banner */}
      <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/30 dark:border-green-600/30 rounded-xl p-4 sm:p-5 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">Join Fanvue and get a $100 bonus</h3>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 mt-0.5">When you make your first $1000</p>
          </div>
          <button className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-300 shadow-md hover:shadow-lg hover:scale-105 whitespace-nowrap">
            Learn More
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        <div className="bg-gradient-to-br from-white to-blue-50/50 dark:from-gray-900/40 dark:to-blue-900/20 border border-blue-200/40 dark:border-blue-700/30 rounded-xl p-5 sm:p-6 shadow-xl hover:shadow-2xl hover:scale-105 backdrop-blur-sm transition-all duration-300">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h3 className="text-xs sm:text-sm font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">Credits</h3>
              <p className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-600 to-cyan-500 dark:from-blue-400 dark:to-cyan-400 bg-clip-text text-transparent mt-2">25</p>
            </div>
            <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg shadow-lg">
              <CreditCard className="w-5 h-5 text-white" />
            </div>
          </div>
          <button className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white py-2 px-4 rounded-lg text-sm font-semibold transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105">
            Add Credits
          </button>
        </div>

        <div className="bg-gradient-to-br from-white to-purple-50/50 dark:from-gray-900/40 dark:to-purple-900/20 border border-purple-200/40 dark:border-purple-700/30 rounded-xl p-5 sm:p-6 shadow-xl hover:shadow-2xl hover:scale-105 backdrop-blur-sm transition-all duration-300">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-xs sm:text-sm font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wide">Influencers</h3>
              <p className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-500 dark:from-purple-400 dark:to-pink-400 bg-clip-text text-transparent mt-2">{totalInfluencers}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Total created</p>
            </div>
            <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg shadow-lg">
              <Users className="w-5 h-5 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-white to-emerald-50/50 dark:from-gray-900/40 dark:to-emerald-900/20 border border-emerald-200/40 dark:border-emerald-700/30 rounded-xl p-5 sm:p-6 shadow-xl hover:shadow-2xl hover:scale-105 backdrop-blur-sm transition-all duration-300 sm:col-span-2 lg:col-span-1">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-xs sm:text-sm font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">Content</h3>
              <p className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-emerald-600 to-teal-500 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent mt-2">{totalContentGenerated}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Pieces generated</p>
            </div>
            <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-lg shadow-lg">
              <FileText className="w-5 h-5 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* My Influencers Section */}
      <div className="bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900/40 dark:to-gray-800/20 border border-gray-200/50 dark:border-gray-700/30 rounded-xl p-5 sm:p-6 shadow-lg backdrop-blur-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-5 sm:mb-6 gap-2">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">My Influencers</h2>
          <button className="flex items-center space-x-1 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-semibold text-sm self-start sm:self-auto transition-all duration-300 hover:scale-105">
            <span>View All</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Search Bar */}
        <SearchBar />

        {/* Influencers Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {influencers.length === 0 ? (
            <div className="col-span-full bg-gray-50 dark:bg-gray-800/30 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 sm:p-12 text-center space-y-2">
              <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white">No influencers yet</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Get started by training your first AI influencer.
              </p>
            </div>
          ) : (
            influencers.map((influencer) => (
              <div
                key={influencer.id}
                className="bg-gradient-to-br from-white to-blue-50/30 dark:from-gray-800/50 dark:to-blue-900/10 border border-blue-200/30 dark:border-blue-700/20 rounded-xl p-3 shadow-md hover:shadow-xl hover:scale-105 backdrop-blur-sm transition-all duration-300"
              >
                <div className="space-y-3">
                  <div className="w-full aspect-square rounded-lg overflow-hidden bg-gradient-to-br from-blue-50 to-blue-100/40 dark:from-blue-900/30 dark:to-blue-800/20 flex items-center justify-center">
                    {influencer.thumbnailUrl ? (
                      <img
                        src={influencer.thumbnailUrl}
                        alt={influencer.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-3xl sm:text-4xl font-bold text-blue-500 dark:text-blue-400">
                        {influencer.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div>
                      <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white truncate">
                        {influencer.name}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {influencer.description || 'AI Influencer'}
                      </p>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500">
                      <span>{formatDate(influencer.uploadedAt)}</span>
                      <span>{influencer.usageCount} uses</span>
                    </div>
                    <button className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white py-2 px-4 rounded-lg text-sm font-semibold transition-all duration-300 shadow-md hover:shadow-lg hover:scale-105">
                      View Details
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}

          <div className="bg-gradient-to-br from-gray-50 to-blue-50/30 dark:from-gray-800/40 dark:to-blue-900/10 border-2 border-dashed border-blue-300/50 dark:border-blue-700/30 rounded-xl p-3 shadow-md hover:shadow-xl hover:scale-105 backdrop-blur-sm transition-all duration-300 hover:border-blue-400 dark:hover:border-blue-600">
            <div className="space-y-3 h-full flex flex-col items-center justify-center text-center">
              <div className="w-full aspect-square rounded-lg bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-900/30 dark:to-blue-800/20 flex items-center justify-center">
                <Plus className="w-10 h-10 sm:w-12 sm:h-12 text-blue-500 dark:text-blue-400" />
              </div>
              <div className="space-y-2">
                <div>
                  <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">Add New</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Train a new influencer</p>
                </div>
                <button className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white py-2 px-4 rounded-lg text-sm font-semibold transition-all duration-300 shadow-md hover:shadow-lg hover:scale-105">
                  Get Started
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}