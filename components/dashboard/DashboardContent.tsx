'use client';

import { Plus, CreditCard, Users, FileText, ChevronRight } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useOrganization } from '@/lib/hooks/useOrganization.query';
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
  const router = useRouter();
  const params = useParams();
  const tenant = params.tenant as string;
  const { currentOrganization, loading } = useOrganization();

  const availableCredits = currentOrganization?.availableCredits ?? 0;

  const handleAddCredits = () => {
    // Navigate to billing page and scroll to credits section
    router.push(`/${tenant}/billing?scrollTo=credits`);
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Welcome Section */}
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-zinc-900 dark:text-white tracking-tight">Dashboard</h1>
          <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 mt-1">Manage your AI influencers</p>
        </div>
        
        {/* Train New Influencer Button */}
        <button className="bg-gradient-to-r from-[#EC67A1] via-[#F774B9] to-[#6366F1] hover:from-[#F774B9] hover:to-[#6366F1] text-white px-5 sm:px-6 py-2.5 sm:py-3 rounded-lg font-semibold flex items-center justify-center sm:justify-start space-x-2 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 w-full sm:w-auto">
          <Plus className="w-4 h-4" />
          <span>Start Training</span>
        </button>
      </div>

      {/* Fanvue Bonus Banner */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-500/10 dark:to-emerald-500/10 border border-green-300 dark:border-green-600/30 rounded-xl p-4 sm:p-5 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-white">Join Fanvue and get a $100 bonus</h3>
            <p className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 mt-0.5">When you make your first $1000</p>
          </div>
          <button className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-300 shadow-md hover:shadow-lg hover:scale-105 whitespace-nowrap">
            Learn More
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        <div className="bg-white dark:bg-white/5 border border-[#EC67A1]/20 rounded-xl p-5 sm:p-6 shadow-xl hover:shadow-2xl hover:scale-105 backdrop-blur-sm transition-all duration-300">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h3 className="text-xs sm:text-sm font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">Credits</h3>
              {loading ? (
                <div className="h-10 w-20 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg mt-2" />
              ) : (
                <p className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-600 to-cyan-500 dark:from-blue-400 dark:to-cyan-400 bg-clip-text text-transparent mt-2">
                  {availableCredits.toLocaleString()}
                </p>
              )}
            </div>
            <div className="p-2 bg-gradient-to-br from-[#EC67A1] to-[#F774B9] rounded-lg shadow-lg">
              <CreditCard className="w-5 h-5 text-white" />
            </div>
          </div>
          <button
            onClick={handleAddCredits}
            className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white py-2 px-4 rounded-lg text-sm font-semibold transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
          >
            Add Credits
          </button>
        </div>

        <div className="bg-white dark:bg-white/5 border border-[#6366F1]/20 rounded-xl p-5 sm:p-6 shadow-xl hover:shadow-2xl hover:scale-105 backdrop-blur-sm transition-all duration-300">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-xs sm:text-sm font-semibold text-[#6366F1] uppercase tracking-wide">Influencers</h3>
              <p className="text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-white mt-2">{totalInfluencers}</p>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">Total created</p>
            </div>
            <div className="p-2 bg-gradient-to-br from-[#6366F1] to-[#EC67A1] rounded-lg shadow-lg">
              <Users className="w-5 h-5 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-white/5 border border-[#EC67A1]/20 rounded-xl p-5 sm:p-6 shadow-xl hover:shadow-2xl hover:scale-105 backdrop-blur-sm transition-all duration-300 sm:col-span-2 lg:col-span-1">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-xs sm:text-sm font-semibold text-[#EC67A1] uppercase tracking-wide">Content</h3>
              <p className="text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-white mt-2">{totalContentGenerated}</p>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">Pieces generated</p>
            </div>
            <div className="p-2 bg-gradient-to-br from-[#F774B9] to-[#6366F1] rounded-lg shadow-lg">
              <FileText className="w-5 h-5 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* My Influencers Section */}
      <div className="bg-white dark:bg-white/5 border border-[#EC67A1]/20 rounded-xl p-5 sm:p-6 shadow-lg backdrop-blur-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-5 sm:mb-6 gap-2">
          <h2 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">My Influencers</h2>
          <button className="flex items-center space-x-1 text-[#EC67A1] hover:text-[#F774B9] font-semibold text-sm self-start sm:self-auto transition-all duration-300 hover:scale-105">
            <span>View All</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Search Bar */}
        <SearchBar />

        {/* Influencers Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {influencers.length === 0 ? (
            <div className="col-span-full bg-zinc-50 dark:bg-zinc-800/30 border border-dashed border-zinc-300 dark:border-zinc-600 rounded-lg p-8 sm:p-12 text-center space-y-2">
              <h3 className="text-base sm:text-lg font-medium text-zinc-900 dark:text-white">No influencers yet</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Get started by training your first AI influencer.
              </p>
            </div>
          ) : (
            influencers.map((influencer) => (
              <div
                key={influencer.id}
                className="bg-white dark:bg-zinc-800/50 border border-[#EC67A1]/20 rounded-xl p-3 shadow-md hover:shadow-xl hover:scale-105 backdrop-blur-sm transition-all duration-300"
              >
                <div className="space-y-3">
                  <div className="w-full aspect-square rounded-lg overflow-hidden bg-zinc-50 dark:bg-zinc-900/30 flex items-center justify-center">
                    {influencer.thumbnailUrl ? (
                      <img
                        src={influencer.thumbnailUrl}
                        alt={influencer.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-3xl sm:text-4xl font-bold text-[#EC67A1]">
                        {influencer.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div>
                      <h3 className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-white truncate">
                        {influencer.name}
                      </h3>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 truncate">
                        {influencer.description || 'AI Influencer'}
                      </p>
                    </div>
                    <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-500">
                      <span>{formatDate(influencer.uploadedAt)}</span>
                      <span>{influencer.usageCount} uses</span>
                    </div>
                    <button className="w-full bg-gradient-to-r from-[#EC67A1] to-[#6366F1] hover:from-[#F774B9] hover:to-[#6366F1] text-white py-2 px-4 rounded-lg text-sm font-semibold transition-all duration-300 shadow-md hover:shadow-lg hover:scale-105">
                      View Details
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}

          <div className="bg-zinc-50 dark:bg-zinc-800/40 border-2 border-dashed border-[#EC67A1]/30 rounded-xl p-3 shadow-md hover:shadow-xl hover:scale-105 backdrop-blur-sm transition-all duration-300 hover:border-[#EC67A1]/50">
            <div className="space-y-3 h-full flex flex-col items-center justify-center text-center">
              <div className="w-full aspect-square rounded-lg bg-zinc-100 dark:bg-zinc-900/30 flex items-center justify-center">
                <Plus className="w-10 h-10 sm:w-12 sm:h-12 text-[#EC67A1]" />
              </div>
              <div className="space-y-2">
                <div>
                  <h3 className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-white">Add New</h3>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400">Train a new influencer</p>
                </div>
                <button className="w-full bg-gradient-to-r from-[#EC67A1] to-[#6366F1] hover:from-[#F774B9] hover:to-[#6366F1] text-white py-2 px-4 rounded-lg text-sm font-semibold transition-all duration-300 shadow-md hover:shadow-lg hover:scale-105">
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