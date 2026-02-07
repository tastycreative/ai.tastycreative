'use client';

import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { useBillingInfo, useCancelSubscription } from '@/lib/hooks/useBilling.query';
import BillingTabs from './BillingTabs';
import BillingOverview from './BillingOverview';
import Invoices from './Invoices';
import BillingTransactions from './BillingTransactions';

export default function BillingPageClient() {
  // Refs
  const creditsRef = useRef<HTMLDivElement>(null);

  // Local state
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'invoices'>('overview');
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);
  const [processingCredits, setProcessingCredits] = useState<string | null>(null);
  const [hasShownToast, setHasShownToast] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: 'plan' | 'credits' | null;
    data: any;
  }>({ isOpen: false, type: null, data: null });
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  // TanStack Query hooks
  const { data: billingInfo, isLoading: loading, refetch: refetchBilling } = useBillingInfo();
  const cancelSubscriptionMutation = useCancelSubscription();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle scroll to credits section
  useEffect(() => {
    const scrollTo = searchParams.get('scrollTo');
    // Wait for component to mount, data to load, and ref to be available
    if (scrollTo === 'credits' && creditsRef.current && mounted && !loading) {
      // Delay scroll to ensure DOM is fully rendered
      setTimeout(() => {
        creditsRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }, 300);
    }
  }, [searchParams, mounted, loading]);

  useEffect(() => {
    // Handle success/cancel redirects from Stripe (only once)
    if (!hasShownToast) {
      if (searchParams.get('success')) {
        toast.success('Subscription activated successfully!');
        setHasShownToast(true);
        // Remove query params but stay on current page
        const currentPath = window.location.pathname;
        router.replace(currentPath);
      } else if (searchParams.get('plan_changed')) {
        toast.success('Plan updated successfully! Changes are effective immediately.');
        setHasShownToast(true);
        refetchBilling(); // Refresh billing info
        // Remove query params but stay on current page
        const currentPath = window.location.pathname;
        router.replace(currentPath);
      } else if (searchParams.get('credits_purchased')) {
        toast.success('Credits purchased successfully!');
        setHasShownToast(true);
        refetchBilling(); // Refresh billing info
        // Remove query params but stay on current page
        const currentPath = window.location.pathname;
        router.replace(currentPath);
      } else if (searchParams.get('canceled')) {
        toast.info('Checkout canceled');
        setHasShownToast(true);
        // Remove query params but stay on current page
        const currentPath = window.location.pathname;
        router.replace(currentPath);
      }
    }
  }, [searchParams, router, hasShownToast, refetchBilling]);

  const handleSubscribe = async (planId: string) => {
    setProcessingPlan(planId);
    setConfirmModal({ isOpen: false, type: null, data: null });

    try {
      const response = await fetch('/api/billing/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Checkout error:', errorData);

        // Handle specific error codes
        if (response.status === 402) {
          toast.error('Payment failed. Please check your payment method and try again.');
        } else if (response.status === 404) {
          toast.error('Subscription not found. Please contact support.');
        } else if (response.status === 400) {
          toast.error(errorData.error || 'Invalid request. Please try again.');
        } else {
          toast.error(errorData.error || 'Failed to process your request. Please try again.');
        }

        setProcessingPlan(null);
        return;
      }

      const data = await response.json();

      // If it's a plan change (no url, just redirect)
      if (data.url === null || data.url.includes('plan_changed=true')) {
        toast.success(data.message || 'Plan updated successfully! Your credits will be updated shortly.');

        // Wait a moment for webhook to process, then refresh
        setTimeout(() => {
          refetchBilling();
        }, 2000);

        setProcessingPlan(null);
        return;
      }

      // Otherwise redirect to checkout
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to start checkout process';
      toast.error(errorMessage);
      setProcessingPlan(null);
    }
  };

  const openPlanConfirmation = (plan: any) => {
    setConfirmModal({
      isOpen: true,
      type: 'plan',
      data: plan,
    });
  };

  const handlePurchaseCredits = async (packageId: string) => {
    setProcessingCredits(packageId);
    setConfirmModal({ isOpen: false, type: null, data: null });

    try {
      const response = await fetch('/api/billing/purchase-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Credit purchase error:', errorData);
        throw new Error(errorData.details || errorData.error || 'Failed to create purchase session');
      }

      const data = await response.json();

      // Redirect to checkout
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Error purchasing credits:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to start purchase process';
      toast.error(errorMessage);
      setProcessingCredits(null);
    }
  };

  const openCreditsConfirmation = (pkg: any) => {
    setConfirmModal({
      isOpen: true,
      type: 'credits',
      data: pkg,
    });
  };

  const handleManageSubscription = async (action: 'cancel' | 'resume' | 'cancel_now') => {
    try {
      const response = await fetch('/api/billing/manage-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      if (!response.ok) {
        throw new Error('Failed to manage subscription');
      }

      const data = await response.json();
      toast.success(data.message);
      refetchBilling();
    } catch (error) {
      console.error('Error managing subscription:', error);
      toast.error('Failed to manage subscription');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-blue-50/50 to-white dark:from-gray-950 dark:via-blue-950/40 dark:to-gray-950 text-gray-900 dark:text-white">
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-12 md:py-20">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 text-gray-900 dark:text-white">
            Billing & Subscription
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Manage your subscription and view usage statistics
          </p>
        </div>

        {/* Tabs */}
        <BillingTabs activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <BillingOverview
            onSubscribe={openPlanConfirmation}
            onPurchaseCredits={openCreditsConfirmation}
            onManageSubscription={handleManageSubscription}
            processingPlan={processingPlan}
            processingCredits={processingCredits}
            creditsRef={creditsRef}
          />
        )}

        {activeTab === 'invoices' && <Invoices />}

        {activeTab === 'transactions' && <BillingTransactions />}
      </div>

      {/* Confirmation Modal - Rendered using Portal */}
      {mounted && confirmModal.isOpen && createPortal(
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setConfirmModal({ isOpen: false, type: null, data: null });
            }
          }}
        >
          <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-800">
            {confirmModal.type === 'plan' ? (
              <>
                <h3 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
                  {billingInfo?.organization?.subscriptionStatus === 'ACTIVE' ? 'Change Plan?' : 'Subscribe to Plan?'}
                </h3>
                <div className="mb-6">
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 mb-4">
                    <p className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      {confirmModal.data.displayName || confirmModal.data.name}
                    </p>
                    <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                      {confirmModal.data.price}
                      <span className="text-base text-gray-600 dark:text-gray-400">{confirmModal.data.period}</span>
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                      {confirmModal.data.credits}
                    </p>
                  </div>
                  {billingInfo?.organization?.subscriptionStatus === 'ACTIVE' ? (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Your plan will be changed immediately. You'll be charged or credited the prorated difference for the remaining billing period.
                    </p>
                  ) : (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      You'll be redirected to a secure payment page to complete your subscription.
                    </p>
                  )}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setConfirmModal({ isOpen: false, type: null, data: null })}
                    className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleSubscribe(confirmModal.data.name)}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    {billingInfo?.organization?.subscriptionStatus === 'ACTIVE' ? 'Change Plan' : 'Continue'}
                  </button>
                </div>
              </>
            ) : confirmModal.type === 'credits' ? (
              <>
                <h3 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
                  Purchase Credits?
                </h3>
                <div className="mb-6">
                  <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 mb-4">
                    <p className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      {confirmModal.data.name}
                    </p>
                    <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                      ${confirmModal.data.price}
                    </p>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                      <span className="font-semibold text-purple-600 dark:text-purple-400">
                        {(confirmModal.data.credits + (confirmModal.data.bonus || 0)).toLocaleString()} Credits
                      </span>
                      {confirmModal.data.bonus && (
                        <span className="text-xs text-green-600 dark:text-green-400 ml-2">
                          (+{confirmModal.data.bonus} Bonus)
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    This is a one-time payment. Credits will be added to your account immediately after payment and never expire.
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setConfirmModal({ isOpen: false, type: null, data: null })}
                    className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handlePurchaseCredits(confirmModal.data.id)}
                    className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
                  >
                    Purchase Now
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
