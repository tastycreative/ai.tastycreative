'use client';

import { useState, useMemo, useEffect } from 'react';
import { Receipt, Zap, Filter, X, Search } from 'lucide-react';
import { useTransactions, useUsageLogs } from '@/lib/hooks/useBilling.query';
import DateRangePicker from '@/components/ui/DateRangePicker';
import Pagination from '@/components/ui/Pagination';

export default function BillingTransactions() {
  // Unified filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [transactionTypeFilter, setTransactionTypeFilter] = useState<'all' | 'subscription' | 'credits'>('all');
  const [featureFilter, setFeatureFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Pagination state for usage logs
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);

  // Debounced search query
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // API-based filtering for transactions
  const transactionFilters = {
    search: debouncedSearch || undefined,
    type: transactionTypeFilter,
    startDate: startDate?.toISOString(),
    endDate: endDate?.toISOString(),
  };

  // API-based filtering for usage logs (with pagination)
  const usageFilters = {
    search: debouncedSearch || undefined,
    feature: featureFilter,
    startDate: startDate?.toISOString(),
    endDate: endDate?.toISOString(),
    page: currentPage,
    limit: itemsPerPage,
  };

  const { data: transactionsData, isLoading: loadingTransactions } = useTransactions(transactionFilters, true);
  const { data: usageLogsData, isLoading: loadingUsage } = useUsageLogs(usageFilters, true);

  const transactions = transactionsData?.transactions ?? [];
  const usageLogs = usageLogsData?.usageLogs ?? [];
  const usagePagination = usageLogsData?.pagination;

  // Get unique features from usage logs for filter dropdown
  const uniqueFeatures = useMemo(() => {
    const features = new Set(usageLogs.map(log => log.resource));
    return Array.from(features).sort();
  }, [usageLogs]);

  // Reset all filters
  const resetFilters = () => {
    setSearchQuery('');
    setStartDate(null);
    setEndDate(null);
    setTransactionTypeFilter('all');
    setFeatureFilter('all');
    setCurrentPage(1);
  };

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // Scroll to top of usage section
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const hasActiveFilters = searchQuery || startDate || endDate || transactionTypeFilter !== 'all' || featureFilter !== 'all';

  // Filter only subscription and credit purchase transactions
  const filteredTransactions = transactions.filter(t => t.type === 'SUBSCRIPTION_PAYMENT' || t.type === 'CREDIT_PURCHASE');

  return (
    <div className="space-y-8">
      {/* Unified Filters Section */}
      <div className="bg-white dark:bg-gray-900/50 border border-brand-mid-pink/30 dark:border-brand-mid-pink/40 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl font-bold text-brand-mid-pink dark:text-brand-light-pink">Filters</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Apply filters to both billing and usage data
            </p>
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              showFilters
                ? 'bg-brand-mid-pink text-white shadow-md'
                : 'bg-brand-light-pink/10 dark:bg-brand-light-pink/20 text-brand-dark-pink dark:text-brand-light-pink hover:bg-brand-light-pink/20 dark:hover:bg-brand-light-pink/30'
            }`}
          >
            <Filter className="w-4 h-4" />
            {showFilters ? 'Hide Filters' : 'Show Filters'}
            {hasActiveFilters && (
              <span className="bg-white dark:bg-gray-900 text-brand-mid-pink px-2 py-0.5 rounded-full text-xs font-semibold">
                Active
              </span>
            )}
          </button>
        </div>

        {/* Filter Controls */}
        {showFilters && (
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by description, plan, feature, or user..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-blue"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Date Range Filter */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Date Range
                </label>
                <DateRangePicker
                  startDate={startDate}
                  endDate={endDate}
                  onDateChange={(start, end) => {
                    setStartDate(start);
                    setEndDate(end);
                  }}
                  placeholder="Select date range"
                />
              </div>

              {/* Transaction Type Filter */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Transaction Type
                </label>
                <select
                  value={transactionTypeFilter}
                  onChange={(e) => setTransactionTypeFilter(e.target.value as any)}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-blue"
                >
                  <option value="all">All Types</option>
                  <option value="subscription">Subscriptions</option>
                  <option value="credits">Credit Purchases</option>
                </select>
              </div>

              {/* Feature Filter */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Feature (Usage)
                </label>
                <select
                  value={featureFilter}
                  onChange={(e) => setFeatureFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-blue"
                >
                  <option value="all">All Features</option>
                  {uniqueFeatures.map((feature) => (
                    <option key={feature} value={feature}>
                      {feature.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Reset Button */}
            {hasActiveFilters && (
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Filters applied to both sections below
                </span>
                <button
                  onClick={resetFilters}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-brand-dark-pink dark:text-brand-light-pink hover:bg-brand-light-pink/10 dark:hover:bg-brand-light-pink/20 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                  Clear All Filters
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Subscription & Credit Purchases */}
      <div className="bg-white dark:bg-gray-900/50 border border-brand-mid-pink/30 dark:border-brand-mid-pink/40 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-6 border-b border-brand-mid-pink/20 dark:border-brand-mid-pink/30 bg-brand-mid-pink/5 dark:bg-brand-mid-pink/10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-mid-pink/10 dark:bg-brand-mid-pink/20 rounded-lg">
              <Receipt className="w-5 h-5 text-brand-mid-pink" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Billing Summary</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                Overview of your subscription and credit purchases
              </p>
            </div>
          </div>
        </div>

        {loadingTransactions ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-mid-pink mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading billing data...</p>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="p-12 text-center">
            <div className="p-4 bg-brand-mid-pink/10 dark:bg-brand-mid-pink/20 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
              <Receipt className="w-10 h-10 text-brand-mid-pink" />
            </div>
            <p className="text-gray-600 dark:text-gray-400">
              {hasActiveFilters ? 'No results match your filters' : 'No billing history yet'}
            </p>
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="mt-3 px-4 py-2 text-sm font-medium text-brand-dark-pink dark:text-brand-light-pink hover:bg-brand-light-pink/10 dark:hover:bg-brand-light-pink/20 rounded-lg transition-colors"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-brand-mid-pink/5 dark:bg-brand-mid-pink/10">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Plan/Package
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Credits Added
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Purchased By
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredTransactions.map((transaction) => (
                  <tr key={transaction.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {new Date(transaction.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-white max-w-xs">
                      {transaction.description}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {transaction.planName ? (
                        <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-brand-blue/10 text-brand-blue">
                          {transaction.planName}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {transaction.creditsAdded ? (
                        <span className="text-brand-dark-pink dark:text-brand-light-pink font-semibold">
                          +{transaction.creditsAdded.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-white">
                      ${transaction.amount.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {transaction.user ? (
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {transaction.user.firstName && transaction.user.lastName
                              ? `${transaction.user.firstName} ${transaction.user.lastName}`
                              : transaction.user.email || 'Unknown'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-400">System</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Credit Usage Breakdown */}
      <div className="bg-white dark:bg-gray-900/50 border border-brand-mid-pink/30 dark:border-brand-mid-pink/40 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-6 border-b border-brand-mid-pink/20 dark:border-brand-mid-pink/30 bg-brand-mid-pink/5 dark:bg-brand-mid-pink/10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-mid-pink/10 dark:bg-brand-mid-pink/20 rounded-lg">
              <Zap className="w-5 h-5 text-brand-mid-pink" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Credit Usage</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                Detailed breakdown of how your credits were used
              </p>
            </div>
          </div>
        </div>

        {loadingUsage ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-mid-pink mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading usage data...</p>
          </div>
        ) : usageLogs.length === 0 ? (
          <div className="p-12 text-center">
            <div className="p-4 bg-brand-mid-pink/10 dark:bg-brand-mid-pink/20 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
              <Zap className="w-10 h-10 text-brand-mid-pink" />
            </div>
            <p className="text-gray-600 dark:text-gray-400">
              {hasActiveFilters ? 'No results match your filters' : 'No credit usage yet'}
            </p>
            {hasActiveFilters ? (
              <button
                onClick={resetFilters}
                className="mt-3 px-4 py-2 text-sm font-medium text-brand-dark-pink dark:text-brand-light-pink hover:bg-brand-light-pink/10 dark:hover:bg-brand-light-pink/20 rounded-lg transition-colors"
              >
                Clear filters
              </button>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                Start using AI features to see usage details here
              </p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-brand-mid-pink/5 dark:bg-brand-mid-pink/10">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Date & Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Feature Used
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Credits Used
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Used By
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {usageLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {new Date(log.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-900 dark:text-white">
                          {log.metadata?.featureName || log.resource.replace(/_/g, ' ')}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {log.resource}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className="text-red-600 dark:text-red-400 font-semibold">
                        -{log.creditsUsed}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {log.user ? (
                        <span>
                          {log.user.firstName && log.user.lastName
                            ? `${log.user.firstName} ${log.user.lastName}`
                            : log.user.email || 'Unknown'}
                        </span>
                      ) : (
                        <span className="text-gray-400">System</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loadingUsage && usageLogs.length > 0 && usagePagination && (
          <div className="p-6 border-t border-gray-200 dark:border-gray-700">
            <Pagination
              currentPage={usagePagination.currentPage}
              totalPages={usagePagination.totalPages}
              onPageChange={handlePageChange}
              totalItems={usagePagination.totalItems}
              itemsPerPage={usagePagination.itemsPerPage}
              showItemCount={true}
            />
          </div>
        )}
      </div>
    </div>
  );
}
