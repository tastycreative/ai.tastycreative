'use client';

import { CheckCircle, XCircle, AlertCircle, CreditCard, Users, HardDrive, Zap, Plus } from 'lucide-react';
import { PRICING_PLANS } from '@/lib/pricing-data';
import { CREDIT_PACKAGES } from '@/lib/credit-packages';
import { useBillingInfo } from '@/lib/hooks/useBilling.query';

interface BillingOverviewProps {
  onSubscribe: (planId: string) => void;
  onPurchaseCredits: (packageId: string) => void;
  onManageSubscription: (action: 'cancel' | 'resume' | 'cancel_now') => void;
  processingPlan: string | null;
  processingCredits: string | null;
  creditsRef: React.RefObject<HTMLDivElement | null>;
}

export default function BillingOverview({
  onSubscribe,
  onPurchaseCredits,
  onManageSubscription,
  processingPlan,
  processingCredits,
  creditsRef,
}: BillingOverviewProps) {
  const { data: billingInfo, isLoading: loading } = useBillingInfo();

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { icon: React.ReactNode; text: string; className: string }> = {
      ACTIVE: {
        icon: <CheckCircle className="w-4 h-4" />,
        text: 'Active',
        className: 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30',
      },
      TRIAL: {
        icon: <AlertCircle className="w-4 h-4" />,
        text: 'Trial',
        className: 'bg-brand-blue/20 text-brand-blue border border-brand-blue/30',
      },
      PAST_DUE: {
        icon: <AlertCircle className="w-4 h-4" />,
        text: 'Past Due',
        className: 'bg-amber-500/20 text-amber-500 border border-amber-500/30',
      },
      CANCELED: {
        icon: <XCircle className="w-4 h-4" />,
        text: 'Canceled',
        className: 'bg-rose-500/20 text-rose-500 border border-rose-500/30',
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
            <Icon className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">{label}</span>
          </div>
          <span className={`text-sm font-semibold ${isNearLimit ? 'text-red-500' : 'text-foreground'}`}>
            {current} / {max}
          </span>
        </div>
        <div className="w-full bg-muted rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${
              isNearLimit ? 'bg-rose-500' : 'bg-brand-blue'
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-mid-pink mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading billing information...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Current Subscription Status */}
      {billingInfo && (
        <div className="mb-12">
          <div className="bg-card border border-brand-mid-pink/20 rounded-2xl p-6 md:p-8 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold mb-2 text-brand-mid-pink">Current Plan</h2>
                <div className="flex items-center space-x-3">
                  <span className="text-xl font-semibold text-brand-mid-pink">
                    {billingInfo.plan?.displayName || 'No Plan'}
                  </span>
                  {getStatusBadge(billingInfo.organization.subscriptionStatus)}
                </div>
              </div>
              {billingInfo.plan && (
                <div className="mt-4 md:mt-0 text-left md:text-right">
                  <div className="text-3xl font-bold text-foreground">
                    ${billingInfo.plan.price}
                    <span className="text-lg text-muted-foreground">/month</span>
                  </div>
                  {billingInfo.organization.currentPeriodEnd && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {billingInfo.organization.cancelAtPeriodEnd ? 'Cancels' : 'Renews'} on{' '}
                      {new Date(billingInfo.organization.currentPeriodEnd).toLocaleDateString()}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Subscription Actions */}
            {billingInfo.organization.subscriptionStatus === 'ACTIVE' && (
              <div className="flex flex-wrap gap-3 pt-6 border-t border-border">
                {!billingInfo.organization.cancelAtPeriodEnd ? (
                  <button
                    onClick={() => onManageSubscription('cancel')}
                    className="px-4 py-2 bg-rose-500/20 text-rose-500 rounded-lg hover:bg-rose-500/30 transition-colors font-medium border border-rose-500/30"
                  >
                    Cancel Subscription
                  </button>
                ) : (
                  <button
                    onClick={() => onManageSubscription('resume')}
                    className="px-4 py-2 bg-emerald-500/20 text-emerald-500 rounded-lg hover:bg-emerald-500/30 transition-colors font-medium border border-emerald-500/30"
                  >
                    Resume Subscription
                  </button>
                )}
              </div>
            )}

            {billingInfo.organization.cancelAtPeriodEnd && (
              <div className="mt-4 p-4 bg-amber-500/20 border border-amber-500/30 rounded-lg">
                <p className="text-sm text-amber-600 dark:text-amber-400">
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
          <h2 className="text-2xl font-bold mb-6 text-brand-mid-pink">Usage This Month</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-brand-mid-pink/50 transition-all">
              <UsageBar
                label="Team Members"
                current={billingInfo.usage.members.current}
                max={billingInfo.usage.members.max}
                icon={Users}
              />
            </div>
            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-brand-mid-pink/50 transition-all">
              <UsageBar
                label="Content Profiles"
                current={billingInfo.usage.profiles.current}
                max={billingInfo.usage.profiles.max}
                icon={CreditCard}
              />
            </div>
            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-brand-mid-pink/50 transition-all">
              <UsageBar
                label="Storage (GB)"
                current={Math.round(billingInfo.usage.storage.current * 10) / 10}
                max={billingInfo.usage.storage.max}
                icon={HardDrive}
              />
            </div>
            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-brand-mid-pink/50 transition-all">
              <UsageBar
                label="AI Credits"
                current={billingInfo.usage.credits.used}
                max={billingInfo.usage.credits.available}
                icon={Zap}
              />
              <p className="text-xs text-muted-foreground mt-2">
                {billingInfo.usage.credits.available} credits available
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Pricing Plans */}
      <div className="mb-12">
        <h2 className="text-xl sm:text-2xl font-bold mb-6 text-center text-brand-mid-pink">Available Plans</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {PRICING_PLANS.map((plan, index) => {
            const isCurrentPlan = billingInfo?.plan?.name === plan.name;
            const isProcessing = processingPlan === plan.name;
            const hasActiveSubscription = billingInfo?.organization?.subscriptionStatus === 'ACTIVE';

            return (
              <div
                key={index}
                className={`bg-card border rounded-2xl p-6 transition-all duration-300 relative overflow-visible shadow-sm hover:shadow-xl hover:-translate-y-1 flex flex-col ${
                  isCurrentPlan
                    ? 'border-brand-mid-pink ring-2 ring-brand-mid-pink'
                    : 'border-border hover:border-brand-mid-pink/50'
                }`}
              >
                {plan.badge && isCurrentPlan ? (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 z-10 flex flex-col gap-1 items-center">
                    <span className="bg-brand-mid-pink text-white text-xs font-medium px-2 sm:px-3 py-1 rounded-full whitespace-nowrap shadow-md">
                      {plan.badge}
                    </span>
                    <span className="bg-emerald-600 text-white text-xs font-medium px-2 sm:px-3 py-1 rounded-full whitespace-nowrap shadow-md">
                      Current Plan
                    </span>
                  </div>
                ) : plan.badge ? (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 z-10">
                    <span className="bg-brand-mid-pink text-white text-xs font-medium px-2 sm:px-3 py-1 rounded-full whitespace-nowrap shadow-md">
                      {plan.badge}
                    </span>
                  </div>
                ) : isCurrentPlan ? (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 z-10">
                    <span className="bg-emerald-600 text-white text-xs font-medium px-2 sm:px-3 py-1 rounded-full whitespace-nowrap shadow-md">
                      Current Plan
                    </span>
                  </div>
                ) : null}
                <div className={`text-center mb-6 px-2 ${plan.badge && isCurrentPlan ? 'mt-10' : (plan.badge || isCurrentPlan) ? 'mt-4' : ''}`}>
                  <h3 className="text-base sm:text-lg font-semibold text-foreground mb-2">
                    {plan.displayName || plan.name}
                  </h3>
                  <div className="mb-2">
                    <span className="text-2xl sm:text-3xl font-bold text-foreground">
                      {plan.price}
                    </span>
                    <span className="text-sm sm:text-base text-muted-foreground">
                      {plan.period}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    {plan.credits}
                  </p>
                </div>
                <ul className="space-y-3 mb-6 flex-grow">
                  {plan.features.map((feature, featureIndex) => (
                    <li
                      key={featureIndex}
                      className="text-sm text-muted-foreground flex items-start"
                    >
                      <span className="text-brand-mid-pink mr-2">✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>
                <div className="mt-auto">
                  {plan.price === 'Custom' ? (
                    <button className="w-full bg-muted text-foreground py-2 px-4 rounded-lg hover:bg-muted/80 transition-colors font-medium shadow-md border border-border">
                      {plan.cta || 'Contact Sales'}
                    </button>
                  ) : isCurrentPlan ? (
                    <button
                      disabled
                      className="w-full bg-emerald-500 text-white py-2 px-4 rounded-lg font-medium cursor-not-allowed shadow-md"
                    >
                      Active Subscription
                    </button>
                  ) : (
                    <button
                      onClick={() => onSubscribe(plan.name)}
                      disabled={isProcessing}
                      className="w-full bg-gradient-to-r from-brand-mid-pink to-brand-light-pink text-white py-2 px-4 rounded-lg hover:from-brand-mid-pink/90 hover:to-brand-light-pink/90 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-brand-mid-pink/25"
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
      <div ref={creditsRef} className="mb-12 scroll-mt-24">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold mb-2 text-brand-mid-pink">Need More Credits?</h2>
          <p className="text-muted-foreground">Purchase additional credits anytime. Credits never expire and stack with your plan.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {CREDIT_PACKAGES.map((pkg) => {
            const isProcessing = processingCredits === pkg.id;
            const totalCredits = pkg.credits + (pkg.bonus || 0);

            return (
              <div
                key={pkg.id}
                className={`bg-card border rounded-2xl p-6 transition-all duration-300 relative shadow-sm hover:shadow-xl hover:-translate-y-1 flex flex-col ${
                  pkg.popular
                    ? 'border-brand-mid-pink ring-2 ring-brand-mid-pink'
                    : 'border-border hover:border-brand-mid-pink/50'
                }`}
              >
                {pkg.popular && (
                  <div className="absolute -top-3 right-4 z-10">
                    <span className="bg-brand-mid-pink text-white text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap shadow-md">
                      Popular
                    </span>
                  </div>
                )}
                <div className="text-center mb-4">
                  <div className="w-12 h-12 bg-brand-mid-pink/10 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Plus className="w-6 h-6 text-brand-mid-pink" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    {pkg.name}
                  </h3>
                  <div className="mb-2">
                    <span className="text-3xl font-bold text-foreground">
                      ${pkg.price}
                    </span>
                  </div>
                  <div className="text-sm">
                    <span className="text-brand-mid-pink font-semibold">
                      {totalCredits.toLocaleString()} Credits
                    </span>
                    {pkg.bonus && (
                      <div className="text-xs text-emerald-500 mt-1">
                        +{pkg.bonus} Bonus Credits
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-auto">
                  <button
                    onClick={() => onPurchaseCredits(pkg.id)}
                    disabled={isProcessing}
                    className="w-full bg-gradient-to-r from-brand-mid-pink to-brand-light-pink text-white py-2 px-4 rounded-lg hover:from-brand-mid-pink/90 hover:to-brand-light-pink/90 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-brand-mid-pink/25"
                  >
                    {isProcessing ? 'Processing...' : 'Purchase Credits'}
                  </button>
                  <p className="text-xs text-center text-muted-foreground mt-2">
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
        <div className="bg-muted border border-brand-mid-pink/30 rounded-2xl p-8 shadow-sm">
          <h3 className="text-2xl font-bold mb-4 text-brand-mid-pink">
            Need help choosing a plan?
          </h3>
          <p className="text-muted-foreground mb-6">
            Our team is here to help you find the perfect plan for your content creation needs.
          </p>
          <button className="bg-gradient-to-r from-brand-mid-pink to-brand-light-pink text-white px-6 py-3 rounded-lg hover:from-brand-mid-pink/90 hover:to-brand-light-pink/90 transition-colors font-medium shadow-md shadow-brand-mid-pink/25">
            Contact Sales
          </button>
        </div>
      </div>
    </>
  );
}
