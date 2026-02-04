"use client";
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { PRICING_PLANS } from '@/lib/pricing-data';
import { CREDIT_PACKAGES } from '@/lib/credit-packages';
import { CheckCircle, XCircle, AlertCircle, CreditCard, Users, HardDrive, Zap, Plus } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';

interface BillingInfo {
  organization: {
    id: string;
    name: string;
    subscriptionStatus: string;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    trialEndsAt: string | null;
  };
  plan: {
    id: string;
    name: string;
    displayName: string;
    price: number;
    billingInterval: string;
    monthlyCredits: number;
  } | null;
  usage: {
    members: { current: number; max: number; percentage: number };
    profiles: { current: number; max: number; percentage: number };
    storage: { current: number; max: number; percentage: number };
    credits: { used: number; max: number; remaining: number; available: number; percentage: number };
  };
}

const BillingPage = () => {
  const [billingInfo, setBillingInfo] = useState<BillingInfo | null>(null);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    fetchBillingInfo();

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
        fetchBillingInfo(); // Refresh billing info
        // Remove query params but stay on current page
        const currentPath = window.location.pathname;
        router.replace(currentPath);
      } else if (searchParams.get('credits_purchased')) {
        toast.success('Credits purchased successfully!');
        setHasShownToast(true);
        fetchBillingInfo(); // Refresh billing info
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
  }, [searchParams, router, hasShownToast]);

  const fetchBillingInfo = async () => {
    try {
      const response = await fetch('/api/billing/current');
      if (response.ok) {
        const data = await response.json();
        setBillingInfo(data);
      }
    } catch (error) {
      console.error('Error fetching billing info:', error);
      toast.error('Failed to load billing information');
    } finally {
      setLoading(false);
    }
  };

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
          fetchBillingInfo();
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
      fetchBillingInfo();
    } catch (error) {
      console.error('Error managing subscription:', error);
      toast.error('Failed to manage subscription');
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { icon: React.ReactNode; text: string; className: string }> = {
      ACTIVE: {
        icon: <CheckCircle className="w-4 h-4" />,
        text: 'Active',
        className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      },
      TRIAL: {
        icon: <AlertCircle className="w-4 h-4" />,
        text: 'Trial',
        className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      },
      PAST_DUE: {
        icon: <AlertCircle className="w-4 h-4" />,
        text: 'Past Due',
        className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      },
      CANCELED: {
        icon: <XCircle className="w-4 h-4" />,
        text: 'Canceled',
        className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      },
    };

    const config = statusConfig[status] || statusConfig.TRIAL;

    return (
      <div className={`inline-flex items-center space-x-2 px-3 py-1 rounded-full text-sm font-medium ${config.className}`}>
        {config.icon}
        <span>{config.text}</span>
      </div>
    );
  };

  const UsageBar = ({ label, current, max, icon: Icon }: { label: string; current: number; max: number; icon: React.ElementType }) => {
    const percentage = Math.min((current / max) * 100, 100);
    const isNearLimit = percentage > 80;

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Icon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
          </div>
          <span className={`text-sm font-semibold ${isNearLimit ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
            {current} / {max}
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${
              isNearLimit ? 'bg-red-500' : 'bg-blue-600'
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading billing information...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-blue-50/50 to-white dark:from-gray-950 dark:via-blue-950/40 dark:to-gray-950 text-gray-900 dark:text-white">
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-12 md:py-20">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 text-gray-900 dark:text-white">
            Billing & Subscription
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Manage your subscription and view usage statistics
          </p>
        </div>

        {/* Current Subscription Status */}
        {billingInfo && (
          <div className="mb-12">
            <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 md:p-8">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold mb-2">Current Plan</h2>
                  <div className="flex items-center space-x-3">
                    <span className="text-xl font-semibold text-blue-600 dark:text-blue-400">
                      {billingInfo.plan?.displayName || 'No Plan'}
                    </span>
                    {getStatusBadge(billingInfo.organization.subscriptionStatus)}
                  </div>
                </div>
                {billingInfo.plan && (
                  <div className="mt-4 md:mt-0 text-left md:text-right">
                    <div className="text-3xl font-bold text-gray-900 dark:text-white">
                      ${billingInfo.plan.price}
                      <span className="text-lg text-gray-600 dark:text-gray-400">/month</span>
                    </div>
                    {billingInfo.organization.currentPeriodEnd && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {billingInfo.organization.cancelAtPeriodEnd ? 'Cancels' : 'Renews'} on{' '}
                        {new Date(billingInfo.organization.currentPeriodEnd).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Subscription Actions */}
              {billingInfo.organization.subscriptionStatus === 'ACTIVE' && (
                <div className="flex flex-wrap gap-3 pt-6 border-t border-gray-200 dark:border-gray-700">
                  {!billingInfo.organization.cancelAtPeriodEnd ? (
                    <button
                      onClick={() => handleManageSubscription('cancel')}
                      className="px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors font-medium"
                    >
                      Cancel Subscription
                    </button>
                  ) : (
                    <button
                      onClick={() => handleManageSubscription('resume')}
                      className="px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors font-medium"
                    >
                      Resume Subscription
                    </button>
                  )}
                </div>
              )}

              {billingInfo.organization.cancelAtPeriodEnd && (
                <div className="mt-4 p-4 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 rounded-lg">
                  <p className="text-sm text-yellow-800 dark:text-yellow-300">
                    Your subscription will be canceled on{' '}
                    {billingInfo.organization.currentPeriodEnd &&
                      new Date(billingInfo.organization.currentPeriodEnd).toLocaleDateString()}
                    . You'll continue to have access until then.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Usage Statistics */}
        {billingInfo && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-6">Usage This Month</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-2xl p-6">
                <UsageBar
                  label="Team Members"
                  current={billingInfo.usage.members.current}
                  max={billingInfo.usage.members.max}
                  icon={Users}
                />
              </div>
              <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-2xl p-6">
                <UsageBar
                  label="Content Profiles"
                  current={billingInfo.usage.profiles.current}
                  max={billingInfo.usage.profiles.max}
                  icon={CreditCard}
                />
              </div>
              <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-2xl p-6">
                <UsageBar
                  label="Storage (GB)"
                  current={Math.round(billingInfo.usage.storage.current * 10) / 10}
                  max={billingInfo.usage.storage.max}
                  icon={HardDrive}
                />
              </div>
              <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-2xl p-6">
                <UsageBar
                  label="AI Credits"
                  current={billingInfo.usage.credits.used}
                  max={billingInfo.usage.credits.available}
                  icon={Zap}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  {billingInfo.usage.credits.available} credits available
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Pricing Plans */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-6 text-center">Available Plans</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {PRICING_PLANS.map((plan, index) => {
              const isCurrentPlan = billingInfo?.plan?.name === plan.name;
              const isProcessing = processingPlan === plan.name;
              // Only ACTIVE (paid) subscriptions can change plans without checkout
              // TRIAL subscriptions must go through checkout to collect payment
              const hasActiveSubscription = billingInfo?.organization?.subscriptionStatus === 'ACTIVE';

              return (
                <div
                  key={index}
                  className={`bg-white dark:bg-gray-900/30 border rounded-2xl p-6 transition-all duration-300 relative overflow-visible shadow-sm hover:shadow-xl hover:-translate-y-1 flex flex-col ${
                    isCurrentPlan
                      ? 'border-blue-500 ring-2 ring-blue-500'
                      : 'border-gray-300 dark:border-gray-800 hover:border-blue-400 dark:hover:border-blue-500'
                  }`}
                >
                  {plan.badge && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 z-10">
                      <span className="bg-blue-600 text-white text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap">
                        {plan.badge}
                      </span>
                    </div>
                  )}
                  {isCurrentPlan && (
                    <div className="absolute -top-3 right-4 z-10">
                      <span className="bg-green-600 text-white text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap">
                        Current Plan
                      </span>
                    </div>
                  )}
                  <div className="text-center mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      {plan.displayName || plan.name}
                    </h3>
                    <div className="mb-2">
                      <span className="text-3xl font-bold text-gray-900 dark:text-white">
                        {plan.price}
                      </span>
                      <span className="text-gray-600 dark:text-gray-400">
                        {plan.period}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {plan.credits}
                    </p>
                  </div>
                  <ul className="space-y-3 mb-6 flex-grow">
                    {plan.features.map((feature, featureIndex) => (
                      <li
                        key={featureIndex}
                        className="text-sm text-gray-600 dark:text-gray-400 flex items-start"
                      >
                        <span className="text-green-500 mr-2">✓</span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-auto">
                    {plan.price === 'Custom' ? (
                      <button className="w-full bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors font-medium">
                        {plan.cta || 'Contact Sales'}
                      </button>
                    ) : isCurrentPlan ? (
                      <button
                        disabled
                        className="w-full bg-green-600 text-white py-2 px-4 rounded-lg font-medium cursor-not-allowed"
                      >
                        Active Subscription
                      </button>
                    ) : (
                      <button
                        onClick={() => openPlanConfirmation(plan)}
                        disabled={isProcessing}
                        className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isProcessing ? 'Processing...' : hasActiveSubscription ? 'Change to This Plan' : 'Subscribe'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Credit Packages */}
        <div className="mb-12">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">Need More Credits?</h2>
            <p className="text-gray-600 dark:text-gray-400">Purchase additional credits anytime. Credits never expire and stack with your plan.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {CREDIT_PACKAGES.map((pkg) => {
              const isProcessing = processingCredits === pkg.id;
              const totalCredits = pkg.credits + (pkg.bonus || 0);

              return (
                <div
                  key={pkg.id}
                  className={`bg-white dark:bg-gray-900/30 border rounded-2xl p-6 transition-all duration-300 relative shadow-sm hover:shadow-xl hover:-translate-y-1 flex flex-col ${
                    pkg.popular
                      ? 'border-purple-500 ring-2 ring-purple-500'
                      : 'border-gray-300 dark:border-gray-800 hover:border-purple-400 dark:hover:border-purple-500'
                  }`}
                >
                  {pkg.popular && (
                    <div className="absolute -top-3 right-4 z-10">
                      <span className="bg-purple-600 text-white text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap">
                        Popular
                      </span>
                    </div>
                  )}
                  <div className="text-center mb-4">
                    <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Plus className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      {pkg.name}
                    </h3>
                    <div className="mb-2">
                      <span className="text-3xl font-bold text-gray-900 dark:text-white">
                        ${pkg.price}
                      </span>
                    </div>
                    <div className="text-sm">
                      <span className="text-purple-600 dark:text-purple-400 font-semibold">
                        {totalCredits.toLocaleString()} Credits
                      </span>
                      {pkg.bonus && (
                        <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                          +{pkg.bonus} Bonus Credits
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-auto">
                    <button
                      onClick={() => openCreditsConfirmation(pkg)}
                      disabled={isProcessing}
                      className="w-full bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isProcessing ? 'Processing...' : 'Purchase Credits'}
                    </button>
                    <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-2">
                      One-time payment
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Help Section */}
        <div className="text-center">
          <div className="bg-gradient-to-r from-blue-600/10 to-purple-600/10 border border-blue-500/20 rounded-2xl p-8">
            <h3 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
              Need help choosing a plan?
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Our team is here to help you find the perfect plan for your content creation needs.
            </p>
            <button className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium">
              Contact Sales
            </button>
          </div>
        </div>
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
};

export default BillingPage;
