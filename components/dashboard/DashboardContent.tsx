import { Search, Plus, CreditCard, Users, FileText, ChevronRight } from 'lucide-react';
import SearchBar from './SearchBar';

interface DashboardContentProps {
  firstName: string;
}

export default function DashboardContent({ firstName }: DashboardContentProps) {
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Welcome Section */}
      <div className="space-y-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Welcome To Your Dashboard</h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300">Create and manage your AI influencers</p>
        </div>
        
        {/* Train New Influencer Button */}
        <button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-4 sm:px-5 py-2 sm:py-2.5 rounded-lg font-semibold flex items-center justify-center sm:justify-start space-x-2 transition-all duration-300 shadow-lg w-full sm:w-auto">
          <Plus className="w-4 h-4" />
          <span>Train New Influencer</span>
        </button>
      </div>

      {/* Fanvue Bonus Banner */}
      <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-lg p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">Join Fanvue and get a $100 bonus</h3>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">When you make your first $1000</p>
          </div>
          <button className="bg-green-600 hover:bg-green-700 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap">
            Learn More
          </button>
        </div>
      </div>

      {/* Welcome Back Section */}
      <div className="bg-gradient-to-r from-white to-blue-50/50 dark:from-gray-900/30 dark:to-blue-900/20 border border-gray-200/50 dark:border-gray-700/30 rounded-xl p-3 sm:p-4 shadow-sm backdrop-blur-sm">
        <h2 className="text-base sm:text-lg font-semibold bg-gradient-to-r from-gray-900 to-blue-800 dark:from-white dark:to-blue-200 bg-clip-text text-transparent mb-1">Welcome back, {firstName}!</h2>
        <p className="text-gray-600 dark:text-gray-300 text-xs sm:text-sm">Here&apos;s what&apos;s happening with your account today.</p>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
        <div className="bg-gradient-to-br from-white to-blue-50/50 dark:from-gray-900/30 dark:to-blue-900/20 shadow-xl rounded-xl p-3 sm:p-4 border border-blue-200/30 dark:border-blue-700/20 backdrop-blur-sm hover:shadow-2xl transition-all duration-300">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <div>
              <h3 className="text-sm sm:text-base font-medium text-gray-900 dark:text-white">Available Credits</h3>
              <p className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-500 dark:from-blue-400 dark:to-cyan-400 bg-clip-text text-transparent">25</p>
            </div>
            <div className="p-1.5 sm:p-2 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg shadow-lg">
              <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
          </div>
          <button className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white py-1.5 sm:py-2 px-3 sm:px-4 rounded-lg text-xs sm:text-sm font-medium transition-all duration-300 shadow-lg hover:shadow-xl">
            Add Credits
          </button>
        </div>

        <div className="bg-gradient-to-br from-white to-purple-50/50 dark:from-gray-900/30 dark:to-purple-900/20 shadow-xl rounded-xl p-3 sm:p-4 border border-purple-200/30 dark:border-purple-700/20 backdrop-blur-sm hover:shadow-2xl transition-all duration-300 sm:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm sm:text-base font-medium text-gray-900 dark:text-white">Influencers</h3>
              <p className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-500 dark:from-purple-400 dark:to-pink-400 bg-clip-text text-transparent">1</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Total influencers created</p>
            </div>
            <div className="p-1.5 sm:p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg shadow-lg">
              <Users className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-white to-emerald-50/50 dark:from-gray-900/30 dark:to-emerald-900/20 shadow-xl rounded-xl p-3 sm:p-4 border border-emerald-200/30 dark:border-emerald-700/20 backdrop-blur-sm hover:shadow-2xl transition-all duration-300 sm:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm sm:text-base font-medium text-gray-900 dark:text-white">Content Generated</h3>
              <p className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-emerald-600 to-teal-500 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent">0</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Total pieces of content created</p>
            </div>
            <div className="p-1.5 sm:p-2 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-lg shadow-lg">
              <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* My Influencers Section */}
      <div className="bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900/30 dark:to-gray-800/20 border border-gray-200/50 dark:border-gray-700/30 rounded-xl p-3 sm:p-4 shadow-lg backdrop-blur-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 sm:mb-4 gap-2">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">My Influencers</h2>
          <button className="flex items-center space-x-1 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium text-sm sm:text-base self-start sm:self-auto">
            <span>View All</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Search Bar */}
        <SearchBar />

        {/* Influencers Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
          {/* Mila - Influencer Card */}
          <div className="bg-gradient-to-br from-white to-pink-50/30 dark:from-gray-800/50 dark:to-pink-900/10 border border-pink-200/30 dark:border-pink-700/20 rounded-xl p-2 sm:p-3 hover:shadow-lg hover:scale-[1.02] transition-all duration-300 backdrop-blur-sm">
            <div className="space-y-2">
              <div className="w-full aspect-square rounded-lg overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1494790108755-2616b612b77c?w=300&h=300&fit=crop&crop=face"
                  alt="Mila"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="text-center">
                <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">Mila</h3>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Content Creator</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">7/31/2025</p>
                <button className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white py-1.5 sm:py-2 px-2 sm:px-4 rounded-lg text-xs sm:text-sm font-medium transition-all duration-300 shadow-md hover:shadow-lg">
                  View Details
                </button>
              </div>
            </div>
          </div>

          {/* Sample Influencer 2 */}
          <div className="bg-gradient-to-br from-white to-blue-50/30 dark:from-gray-800/50 dark:to-blue-900/10 border border-blue-200/30 dark:border-blue-700/20 rounded-xl p-2 sm:p-3 hover:shadow-lg hover:scale-[1.02] transition-all duration-300 backdrop-blur-sm">
            <div className="space-y-2">
              <div className="w-full aspect-square rounded-lg overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=300&h=300&fit=crop&crop=face"
                  alt="Emma"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="text-center">
                <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">Emma</h3>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Lifestyle Blogger</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">7/30/2025</p>
                <button className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white py-1.5 sm:py-2 px-2 sm:px-4 rounded-lg text-xs sm:text-sm font-medium transition-all duration-300 shadow-md hover:shadow-lg">
                  View Details
                </button>
              </div>
            </div>
          </div>

          {/* Sample Influencer 3 */}
          <div className="bg-gradient-to-br from-white to-purple-50/30 dark:from-gray-800/50 dark:to-purple-900/10 border border-purple-200/30 dark:border-purple-700/20 rounded-xl p-2 sm:p-3 hover:shadow-lg hover:scale-[1.02] transition-all duration-300 backdrop-blur-sm">
            <div className="space-y-2">
              <div className="w-full aspect-square rounded-lg overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&h=300&fit=crop&crop=face"
                  alt="Sofia"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="text-center">
                <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">Sofia</h3>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Fashion Influencer</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">7/29/2025</p>
                <button className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white py-1.5 sm:py-2 px-2 sm:px-4 rounded-lg text-xs sm:text-sm font-medium transition-all duration-300 shadow-md hover:shadow-lg">
                  View Details
                </button>
              </div>
            </div>
          </div>

          {/* Add New Influencer Card */}
          <div className="bg-gradient-to-br from-gray-50 to-blue-50/20 dark:from-gray-800/30 dark:to-blue-900/10 border-2 border-dashed border-blue-300/50 dark:border-blue-600/30 rounded-xl p-2 sm:p-3 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-lg hover:scale-[1.02] transition-all duration-300 backdrop-blur-sm">
            <div className="space-y-2 h-full flex flex-col items-center justify-center text-center">
              <div className="w-full aspect-square rounded-lg bg-gradient-to-br from-gray-100 to-blue-100/50 dark:from-gray-700/50 dark:to-blue-800/20 flex items-center justify-center border border-blue-200/30 dark:border-blue-700/20">
                <Plus className="w-8 h-8 sm:w-12 sm:h-12 text-blue-500 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">Add New</h3>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-2">Train a new influencer</p>
                <button className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white py-1.5 sm:py-2 px-2 sm:px-4 rounded-lg text-xs sm:text-sm font-medium transition-colors">
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