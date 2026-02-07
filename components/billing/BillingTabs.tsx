'use client';

interface BillingTabsProps {
  activeTab: 'overview' | 'transactions' | 'invoices';
  onTabChange: (tab: 'overview' | 'transactions' | 'invoices') => void;
}

export default function BillingTabs({ activeTab, onTabChange }: BillingTabsProps) {
  return (
    <div className="flex justify-center mb-8 overflow-x-auto">
      <div className="inline-flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
        <button
          onClick={() => onTabChange('overview')}
          className={`px-4 sm:px-6 py-2 rounded-md font-medium transition-colors text-sm sm:text-base whitespace-nowrap ${
            activeTab === 'overview'
              ? 'bg-white dark:bg-gray-700 text-brand-blue dark:text-brand-blue shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => onTabChange('invoices')}
          className={`px-4 sm:px-6 py-2 rounded-md font-medium transition-colors text-sm sm:text-base whitespace-nowrap ${
            activeTab === 'invoices'
              ? 'bg-white dark:bg-gray-700 text-brand-blue dark:text-brand-blue shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          Invoices
        </button>
        <button
          onClick={() => onTabChange('transactions')}
          className={`px-4 sm:px-6 py-2 rounded-md font-medium transition-colors text-sm sm:text-base whitespace-nowrap ${
            activeTab === 'transactions'
              ? 'bg-white dark:bg-gray-700 text-brand-blue dark:text-brand-blue shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <span className="hidden sm:inline">Transaction History</span>
          <span className="sm:hidden">Transactions</span>
        </button>
      </div>
    </div>
  );
}
