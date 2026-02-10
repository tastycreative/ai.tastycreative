'use client';

interface BillingTabsProps {
  activeTab: 'overview' | 'transactions' | 'invoices';
  onTabChange: (tab: 'overview' | 'transactions' | 'invoices') => void;
}

export default function BillingTabs({ activeTab, onTabChange }: BillingTabsProps) {
  return (
    <div className="flex justify-center mb-8 overflow-x-auto">
      <div className="inline-flex bg-muted rounded-lg p-1 border border-border">
        <button
          onClick={() => onTabChange('overview')}
          className={`px-4 sm:px-6 py-2 rounded-md font-medium transition-colors text-sm sm:text-base whitespace-nowrap ${
            activeTab === 'overview'
              ? 'bg-card text-brand-mid-pink shadow-sm border border-brand-mid-pink/30'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => onTabChange('invoices')}
          className={`px-4 sm:px-6 py-2 rounded-md font-medium transition-colors text-sm sm:text-base whitespace-nowrap ${
            activeTab === 'invoices'
              ? 'bg-card text-brand-mid-pink shadow-sm border border-brand-mid-pink/30'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Invoices
        </button>
        <button
          onClick={() => onTabChange('transactions')}
          className={`px-4 sm:px-6 py-2 rounded-md font-medium transition-colors text-sm sm:text-base whitespace-nowrap ${
            activeTab === 'transactions'
              ? 'bg-card text-brand-mid-pink shadow-sm border border-brand-mid-pink/30'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <span className="hidden sm:inline">Transaction History</span>
          <span className="sm:hidden">Transactions</span>
        </button>
      </div>
    </div>
  );
}
