'use client';

import { useState, useEffect } from 'react';
import { FileText, Download, Filter, X, Search } from 'lucide-react';
import { useTransactions, useBillingInfo } from '@/lib/hooks/useBilling.query';
import DateRangePicker from '@/components/ui/DateRangePicker';

export default function Invoices() {
  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [transactionTypeFilter, setTransactionTypeFilter] = useState<'all' | 'subscription' | 'credits'>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Debounced search query
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // API-based filtering
  const transactionFilters = {
    search: debouncedSearch || undefined,
    type: transactionTypeFilter,
    startDate: startDate?.toISOString(),
    endDate: endDate?.toISOString(),
  };

  const { data: transactionsData, isLoading } = useTransactions(transactionFilters, true);
  const { data: billingInfo } = useBillingInfo();

  const transactions = transactionsData?.transactions ?? [];

  // Filter only subscription and credit purchase transactions
  const invoiceTransactions = transactions.filter(t => t.type === 'SUBSCRIPTION_PAYMENT' || t.type === 'CREDIT_PURCHASE');

  // Group transactions when date range is selected
  const shouldGroupInvoices = startDate && endDate;

  const groupedInvoice = shouldGroupInvoices ? {
    transactions: invoiceTransactions,
    startDate,
    endDate,
    totalAmount: invoiceTransactions.reduce((sum, t) => sum + t.amount, 0),
    totalCredits: invoiceTransactions.reduce((sum, t) => sum + (t.creditsAdded || 0), 0),
  } : null;

  // Reset all filters
  const resetFilters = () => {
    setSearchQuery('');
    setStartDate(null);
    setEndDate(null);
    setTransactionTypeFilter('all');
  };

  const hasActiveFilters = searchQuery || startDate || endDate || transactionTypeFilter !== 'all';

  const handleDownloadInvoice = (transactionId: string) => {
    // Open the invoice in a new window which will trigger the print dialog
    window.open(`/api/billing/invoice/${transactionId}/pdf`, '_blank');
  };

  const handleDownloadGroupedInvoice = () => {
    if (!startDate || !endDate) return;
    // Open grouped invoice
    const params = new URLSearchParams({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      type: transactionTypeFilter,
    });
    window.open(`/api/billing/invoice/grouped/pdf?${params.toString()}`, '_blank');
  };

  const getInvoiceNumber = (transaction: any) => {
    // Generate invoice number from transaction ID (last 8 chars) and date
    const datePrefix = new Date(transaction.createdAt).toISOString().slice(0, 7).replace('-', '');
    const idSuffix = transaction.id.slice(-8).toUpperCase();
    return `INV-${datePrefix}-${idSuffix}`;
  };

  const getGroupedInvoiceNumber = () => {
    if (!startDate || !endDate) return '';
    const startPrefix = startDate.toISOString().slice(0, 7).replace('-', '');
    const endPrefix = endDate.toISOString().slice(0, 7).replace('-', '');
    return `INV-${startPrefix}-${endPrefix}-GROUPED`;
  };

  return (
    <div className="space-y-6">
      {/* Filters Section */}
      <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Filter Invoices</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Search and filter your invoices
            </p>
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              showFilters
                ? 'bg-brand-blue text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            <Filter className="w-4 h-4" />
            {showFilters ? 'Hide Filters' : 'Show Filters'}
            {hasActiveFilters && (
              <span className="bg-white dark:bg-gray-900 text-brand-blue px-2 py-0.5 rounded-full text-xs font-semibold">
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
                placeholder="Search by description or plan..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-blue"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  Invoice Type
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
            </div>

            {/* Reset Button */}
            {hasActiveFilters && (
              <div className="flex items-center justify-end pt-2">
                <button
                  onClick={resetFilters}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                  Clear All Filters
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Invoices List */}
      {isLoading ? (
        <div className="p-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-blue mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading invoices...</p>
        </div>
      ) : invoiceTransactions.length === 0 ? (
        <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-2xl p-12 text-center">
          <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            {hasActiveFilters ? 'No invoices match your filters' : 'No invoices yet'}
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {hasActiveFilters
              ? 'Try adjusting your filters to see more results'
              : 'Invoices will appear here once you make purchases'
            }
          </p>
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="px-4 py-2 text-sm text-brand-blue hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : shouldGroupInvoices && groupedInvoice ? (
        // Grouped Invoice for Date Range
        <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-2xl p-6">
          {/* Grouped Invoice Header */}
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6 mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-brand-blue/10 rounded-lg">
                  <FileText className="w-6 h-6 text-brand-blue" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    {getGroupedInvoiceNumber()}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Statement for Period
                  </p>
                </div>
              </div>

              {/* Bill To */}
              <div className="space-y-1">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Bill To</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {billingInfo?.organization.name || 'Organization'}
                </p>
              </div>
            </div>

            {/* Invoice Details */}
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-4 lg:text-right">
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">Period</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} - {endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">Items</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {groupedInvoice.transactions.length} transaction{groupedInvoice.transactions.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </div>

          {/* Invoice Items */}
          <div className="space-y-3 mb-6">
            <div className="grid grid-cols-12 gap-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase pb-2 border-b border-gray-200 dark:border-gray-700">
              <div className="col-span-2">Date</div>
              <div className="col-span-4">Description</div>
              <div className="col-span-2 text-right">Type</div>
              <div className="col-span-2 text-right">Credits</div>
              <div className="col-span-2 text-right">Amount</div>
            </div>

            {groupedInvoice.transactions.map((transaction) => (
              <div key={transaction.id} className="grid grid-cols-12 gap-4 items-center py-2 hover:bg-gray-50 dark:hover:bg-gray-800/30 rounded-lg px-2 -mx-2">
                <div className="col-span-2 text-sm text-gray-900 dark:text-white">
                  {new Date(transaction.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
                <div className="col-span-4">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {transaction.description}
                  </p>
                  {transaction.planName && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {transaction.planName}
                    </p>
                  )}
                </div>
                <div className="col-span-2 text-right">
                  <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                    transaction.type === 'SUBSCRIPTION_PAYMENT'
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                      : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                  }`}>
                    {transaction.type === 'SUBSCRIPTION_PAYMENT' ? 'Subscription' : 'Credits'}
                  </span>
                </div>
                <div className="col-span-2 text-right text-sm text-gray-900 dark:text-white">
                  {transaction.creditsAdded ? `+${transaction.creditsAdded.toLocaleString()}` : '-'}
                </div>
                <div className="col-span-2 text-right text-sm font-semibold text-gray-900 dark:text-white">
                  ${transaction.amount.toFixed(2)}
                </div>
              </div>
            ))}
          </div>

          {/* Summary */}
          {groupedInvoice.totalCredits > 0 && (
            <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Total Credits Added</span>
                <span className="text-lg font-bold text-green-600 dark:text-green-400">
                  +{groupedInvoice.totalCredits.toLocaleString()}
                </span>
              </div>
            </div>
          )}

          {/* Invoice Total */}
          <div className="flex flex-col items-end space-y-2 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between w-full sm:w-64">
              <span className="text-sm text-gray-600 dark:text-gray-400">Subtotal</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                ${groupedInvoice.totalAmount.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between w-full sm:w-64">
              <span className="text-sm text-gray-600 dark:text-gray-400">Tax</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">$0.00</span>
            </div>
            <div className="flex items-center justify-between w-full sm:w-64 pt-2 border-t border-gray-200 dark:border-gray-700">
              <span className="text-lg font-bold text-gray-900 dark:text-white">Total</span>
              <span className="text-lg font-bold text-brand-blue">
                ${groupedInvoice.totalAmount.toFixed(2)} USD
              </span>
            </div>
          </div>

          {/* Download Button */}
          <div className="flex justify-end mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={handleDownloadGroupedInvoice}
              className="flex items-center gap-2 px-4 py-2 bg-brand-blue text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              <Download className="w-4 h-4" />
              Download Statement
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {invoiceTransactions.map((transaction) => (
            <div
              key={transaction.id}
              className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 hover:shadow-lg transition-shadow"
            >
              {/* Invoice Header */}
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6 mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-brand-blue/10 rounded-lg">
                      <FileText className="w-6 h-6 text-brand-blue" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                        {getInvoiceNumber(transaction)}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {transaction.type === 'SUBSCRIPTION_PAYMENT' ? 'Subscription Payment' : 'Credit Purchase'}
                      </p>
                    </div>
                  </div>

                  {/* Bill To */}
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Bill To</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {billingInfo?.organization.name || 'Organization'}
                    </p>
                    {transaction.user && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {transaction.user.firstName && transaction.user.lastName
                          ? `${transaction.user.firstName} ${transaction.user.lastName}`
                          : transaction.user.email || 'Unknown'}
                      </p>
                    )}
                  </div>
                </div>

                {/* Invoice Details */}
                <div className="grid grid-cols-2 lg:grid-cols-1 gap-4 lg:text-right">
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">Issue Date</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {new Date(transaction.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">Status</p>
                    <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${
                      transaction.status === 'COMPLETED'
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                        : transaction.status === 'PENDING'
                        ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                        : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                    }`}>
                      {transaction.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Invoice Items */}
              <div className="space-y-3 mb-6">
                <div className="grid grid-cols-12 gap-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase pb-2 border-b border-gray-200 dark:border-gray-700">
                  <div className="col-span-6">Description</div>
                  <div className="col-span-2 text-right">Quantity</div>
                  <div className="col-span-2 text-right">Unit Price</div>
                  <div className="col-span-2 text-right">Amount</div>
                </div>

                <div className="grid grid-cols-12 gap-4 items-center">
                  <div className="col-span-6">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {transaction.description}
                    </p>
                    {transaction.planName && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Plan: {transaction.planName}
                      </p>
                    )}
                    {transaction.billingPeriodStart && transaction.billingPeriodEnd && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Period: {new Date(transaction.billingPeriodStart).toLocaleDateString()} - {new Date(transaction.billingPeriodEnd).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div className="col-span-2 text-right text-sm text-gray-900 dark:text-white">1</div>
                  <div className="col-span-2 text-right text-sm text-gray-900 dark:text-white">
                    ${transaction.amount.toFixed(2)}
                  </div>
                  <div className="col-span-2 text-right text-sm font-semibold text-gray-900 dark:text-white">
                    ${transaction.amount.toFixed(2)}
                  </div>
                </div>

                {transaction.creditsAdded && (
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 bg-green-50 dark:bg-green-900/20 px-3 py-2 rounded-lg">
                    <span className="text-green-600 dark:text-green-400 font-semibold">
                      +{transaction.creditsAdded.toLocaleString()} credits added
                    </span>
                  </div>
                )}
              </div>

              {/* Invoice Total */}
              <div className="flex flex-col items-end space-y-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between w-full sm:w-64">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Subtotal</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    ${transaction.amount.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between w-full sm:w-64">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Tax</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">$0.00</span>
                </div>
                <div className="flex items-center justify-between w-full sm:w-64 pt-2 border-t border-gray-200 dark:border-gray-700">
                  <span className="text-lg font-bold text-gray-900 dark:text-white">Total</span>
                  <span className="text-lg font-bold text-brand-blue">
                    ${transaction.amount.toFixed(2)} {transaction.currency.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Download Button */}
              <div className="flex justify-end mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => handleDownloadInvoice(transaction.id)}
                  className="flex items-center gap-2 px-4 py-2 bg-brand-blue text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  <Download className="w-4 h-4" />
                  Download Invoice
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
