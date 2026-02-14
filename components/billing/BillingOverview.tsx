'use client';

import { useState } from 'react';
import { CheckCircle, XCircle, AlertCircle, CreditCard, Users, HardDrive, Zap, Plus, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { PRICING_PLANS } from '@/lib/pricing-data';
import { CREDIT_PACKAGES } from '@/lib/credit-packages';
import { useBillingInfo } from '@/lib/hooks/useBilling.query';
import { useStorageData } from '@/lib/hooks/useStorage.query';
import { PurchaseMemberSlotsModal } from './PurchaseMemberSlotsModal';
import { ManageMemberSlotsModal } from './ManageMemberSlotsModal';
import { PurchaseContentProfileSlotsModal } from './PurchaseContentProfileSlotsModal';
import { ManageContentProfileSlotsModal } from './ManageContentProfileSlotsModal';
import { PurchaseStorageSlotsModal } from './PurchaseStorageSlotsModal';
import { ManageStorageSlotsModal } from './ManageStorageSlotsModal';
import StorageBreakdown from './StorageBreakdown';

import { CreditPackage } from '@/lib/credit-packages';
import { PricingPlan } from '@/lib/pricing-data';

interface BillingOverviewProps {
  onSubscribe: (plan: PricingPlan) => void;
  onPurchaseCredits: (pkg: CreditPackage) => void;
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
  const { data: billingInfo, isLoading: loading, refetch } = useBillingInfo();
  const { data: storageData, isLoading: storageLoading } = useStorageData();
  const [purchasingSlots, setPurchasingSlots] = useState(false);
  const [showMemberSlotModal, setShowMemberSlotModal] = useState(false);
  const [showManageSlotModal, setShowManageSlotModal] = useState(false);
  const [purchasingProfileSlots, setPurchasingProfileSlots] = useState(false);
  const [showProfileSlotModal, setShowProfileSlotModal] = useState(false);
  const [showManageProfileSlotModal, setShowManageProfileSlotModal] = useState(false);
  const [purchasingStorageSlots, setPurchasingStorageSlots] = useState(false);
  const [showStorageSlotModal, setShowStorageSlotModal] = useState(false);
  const [showManageStorageSlotModal, setShowManageStorageSlotModal] = useState(false);

  const handlePurchaseMemberSlots = async (numberOfSlots: number) => {
    try {
      setPurchasingSlots(true);
      const response = await fetch('/api/billing/purchase-member-slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numberOfSlots }),
      });

      if (!response.ok) {
        throw new Error('Failed to create purchase session');
      }

      const data = await response.json();

      if (data.url) {
        // Redirect to Stripe Checkout (new subscription)
        // Keep modal open and show loading state until redirect
        window.location.href = data.url;
      } else {
        // Updated existing subscription, no redirect needed
        setShowMemberSlotModal(false);
        setPurchasingSlots(false);
        toast.success(data.message || 'Member slots added successfully!');
        refetch(); // Refresh billing info
      }
    } catch (error) {
      console.error('Error purchasing member slots:', error);
      toast.error('Failed to start purchase. Please try again.');
      setPurchasingSlots(false);
    }
  };

  const handleRemoveMemberSlots = async (numberOfSlots: number) => {
    try {
      const response = await fetch('/api/billing/cancel-member-slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numberOfSlots }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error,
          message: data.message,
          currentMembers: data.currentMembers,
          newLimit: data.newLimit,
          membersToRemove: data.membersToRemove,
        };
      }

      // Success - refetch billing info to update UI
      await refetch();
      toast.success(data.message || 'Member slots removed successfully!');

      return {
        success: true,
        message: data.message,
      };
    } catch (error) {
      console.error('Error removing member slots:', error);
      return {
        success: false,
        error: 'An unexpected error occurred',
      };
    }
  };

  const handlePurchaseContentProfileSlots = async (numberOfSlots: number) => {
    try {
      setPurchasingProfileSlots(true);
      const response = await fetch('/api/billing/purchase-content-profile-slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numberOfSlots }),
      });

      if (!response.ok) {
        throw new Error('Failed to create purchase session');
      }

      const data = await response.json();

      if (data.url) {
        // Redirect to Stripe Checkout (new subscription)
        // Keep modal open and show loading state until redirect
        window.location.href = data.url;
      } else {
        // Updated existing subscription, no redirect needed
        setShowProfileSlotModal(false);
        setPurchasingProfileSlots(false);
        toast.success(data.message || 'Content profile slots added successfully!');
        refetch(); // Refresh billing info
      }
    } catch (error) {
      console.error('Error purchasing content profile slots:', error);
      toast.error('Failed to start purchase. Please try again.');
      setPurchasingProfileSlots(false);
    }
  };

  const handleRemoveContentProfileSlots = async (numberOfSlots: number) => {
    try {
      const response = await fetch('/api/billing/cancel-content-profile-slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numberOfSlots }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error,
          message: data.message,
          currentProfiles: data.currentProfiles,
          newLimit: data.newLimit,
          profilesToRemove: data.profilesToRemove,
        };
      }

      // Success - refetch billing info to update UI
      await refetch();
      toast.success(data.message || 'Content profile slots removed successfully!');

      return {
        success: true,
        message: data.message,
      };
    } catch (error) {
      console.error('Error removing content profile slots:', error);
      return {
        success: false,
        error: 'An unexpected error occurred',
      };
    }
  };

  const handlePurchaseStorageSlots = async (numberOfGB: number) => {
    try {
      setPurchasingStorageSlots(true);
      const response = await fetch('/api/billing/purchase-storage-slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numberOfGB }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create purchase session');
      }

      const data = await response.json();

      if (data.url) {
        // Redirect to Stripe Checkout (new subscription)
        window.location.href = data.url;
      } else {
        // Updated existing subscription, no redirect needed
        setShowStorageSlotModal(false);
        setPurchasingStorageSlots(false);
        toast.success(data.message || 'Storage added successfully!');
        refetch(); // Refresh billing info
      }
    } catch (error) {
      console.error('Error purchasing storage:', error);
      toast.error('Failed to start purchase. Please try again.');
      setPurchasingStorageSlots(false);
    }
  };

  const handleRemoveStorageSlots = async (numberOfGB: number) => {
    try {
      const response = await fetch('/api/billing/cancel-storage-slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numberOfGB }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error,
          message: data.message,
          currentUsageGB: data.currentUsageGB,
          newLimitGB: data.newLimitGB,
          requiredToFree: data.requiredToFree,
        };
      }

      // Success - refetch billing info to update UI
      await refetch();
      toast.success(data.message || 'Storage removed successfully!');

      return {
        success: true,
        message: data.message,
      };
    } catch (error) {
      console.error('Error removing storage:', error);
      return {
        success: false,
        error: 'An unexpected error occurred',
      };
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { icon: React.ReactNode; text: string; className: string }> = {
      ACTIVE: {
        icon: <CheckCircle className="w-4 h-4" />,
        text: 'Active',
        className: 'bg-brand-blue/10 text-brand-blue dark:bg-brand-blue/20 dark:text-brand-blue',
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
      <>
        {/* Skeleton for Current Subscription */}
        <div className="mb-12">
          <div className="bg-card border border-border rounded-2xl p-6 md:p-8 shadow-sm animate-pulse">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
              <div className="space-y-3">
                <div className="h-8 w-32 bg-muted rounded"></div>
                <div className="h-6 w-24 bg-muted rounded"></div>
              </div>
              <div className="mt-4 md:mt-0">
                <div className="h-10 w-32 bg-muted rounded"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Skeleton for Usage Statistics */}
        <div className="mb-12">
          <div className="h-8 w-48 bg-muted rounded mb-6 animate-pulse"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-card border border-border rounded-2xl p-6 shadow-sm animate-pulse">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 bg-muted rounded"></div>
                      <div className="h-4 w-24 bg-muted rounded"></div>
                    </div>
                    <div className="h-4 w-16 bg-muted rounded"></div>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Current Subscription Status */}
      {billingInfo && (
        <div className="mb-12">
          <div className="bg-card border border-brand-mid-pink/20 rounded-2xl shadow-sm overflow-hidden">
            {/* Header Section */}
            <div className="bg-gradient-to-r from-brand-mid-pink/10 to-brand-light-pink/10 dark:from-brand-mid-pink/5 dark:to-brand-light-pink/5 p-6 md:p-8 border-b border-border">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold mb-2 text-brand-mid-pink">Current Plan</h2>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-xl font-semibold text-foreground">
                      {billingInfo.plan?.displayName || 'No Plan'}
                    </span>
                    {getStatusBadge(billingInfo.organization.subscriptionStatus)}
                  </div>
                </div>
                {billingInfo.organization.currentPeriodEnd && (
                  <div className="text-left md:text-right">
                    <p className="text-sm text-muted-foreground">
                      {billingInfo.organization.cancelAtPeriodEnd ? 'Cancels' : 'Next billing date'}
                    </p>
                    <p className="text-lg font-semibold text-foreground">
                      {new Date(billingInfo.organization.currentPeriodEnd).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Billing Breakdown */}
            {billingInfo.plan && (
              <div className="p-6 md:p-8">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Monthly Breakdown</h3>
                <div className="space-y-3">
                  {/* Base Plan */}
                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-brand-mid-pink/10 flex items-center justify-center">
                        <Zap className="w-4 h-4 text-brand-mid-pink" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{billingInfo.plan.displayName} Plan</p>
                        <p className="text-xs text-muted-foreground">{billingInfo.plan.monthlyCredits?.toLocaleString() || 0} credits/month</p>
                      </div>
                    </div>
                    <span className="font-semibold text-foreground">${billingInfo.plan.price.toFixed(2)}</span>
                  </div>

                  {/* Member Slots Add-on */}
                  {billingInfo.usage.members.additionalSlots > 0 && (
                    <div className="flex items-center justify-between py-2 border-t border-dashed border-border">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                          <Users className="w-4 h-4 text-blue-500" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">Additional Member Slots</p>
                          <p className="text-xs text-muted-foreground">{billingInfo.usage.members.additionalSlots} slot{billingInfo.usage.members.additionalSlots > 1 ? 's' : ''} × ${billingInfo.usage.members.memberSlotPrice}/mo</p>
                        </div>
                      </div>
                      <span className="font-semibold text-foreground">
                        ${(billingInfo.usage.members.memberSlotPrice * billingInfo.usage.members.additionalSlots).toFixed(2)}
                      </span>
                    </div>
                  )}

                  {/* Content Profile Slots Add-on */}
                  {billingInfo.usage.profiles.additionalSlots > 0 && (
                    <div className="flex items-center justify-between py-2 border-t border-dashed border-border">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                          <CreditCard className="w-4 h-4 text-purple-500" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">Additional Content Profiles</p>
                          <p className="text-xs text-muted-foreground">{billingInfo.usage.profiles.additionalSlots} slot{billingInfo.usage.profiles.additionalSlots > 1 ? 's' : ''} × ${billingInfo.usage.profiles.contentProfileSlotPrice}/mo</p>
                        </div>
                      </div>
                      <span className="font-semibold text-foreground">
                        ${(billingInfo.usage.profiles.contentProfileSlotPrice * billingInfo.usage.profiles.additionalSlots).toFixed(2)}
                      </span>
                    </div>
                  )}

                  {/* Storage Add-on */}
                  {billingInfo.usage.storage.additionalGB !== undefined && billingInfo.usage.storage.additionalGB > 0 && (
                    <div className="flex items-center justify-between py-2 border-t border-dashed border-border">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                          <HardDrive className="w-4 h-4 text-amber-500" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">Additional Storage</p>
                          <p className="text-xs text-muted-foreground">{billingInfo.usage.storage.additionalGB} GB × ${billingInfo.usage.storage.storageSlotPrice || 0.50}/mo</p>
                        </div>
                      </div>
                      <span className="font-semibold text-foreground">
                        ${((billingInfo.usage.storage.storageSlotPrice || 0.50) * billingInfo.usage.storage.additionalGB).toFixed(2)}
                      </span>
                    </div>
                  )}

                  {/* Total */}
                  <div className="flex items-center justify-between py-4 mt-2 border-t-2 border-border">
                    <span className="text-lg font-bold text-foreground">Total Monthly</span>
                    <span className="text-2xl font-bold text-brand-mid-pink">
                      ${(
                        billingInfo.plan.price +
                        (billingInfo.usage.members.memberSlotPrice * billingInfo.usage.members.additionalSlots) +
                        (billingInfo.usage.profiles.contentProfileSlotPrice * billingInfo.usage.profiles.additionalSlots) +
                        ((billingInfo.usage.storage.storageSlotPrice || 0.50) * (billingInfo.usage.storage.additionalGB || 0))
                      ).toFixed(2)}
                      <span className="text-sm font-normal text-muted-foreground">/mo</span>
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Payment Method & Actions */}
            <div className="bg-muted/30 p-6 md:p-8 border-t border-border">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                {/* Payment Method */}
                {billingInfo.paymentMethod ? (
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-4 py-2 bg-background rounded-lg border border-border">
                      {billingInfo.paymentMethod.brand === 'visa' && (
                        <svg className="w-8 h-5" viewBox="0 0 24 16" fill="none">
                          <rect width="24" height="16" rx="2" fill="#1A1F71"/>
                          <path d="M9.5 10.5L10.5 5.5H12L11 10.5H9.5Z" fill="white"/>
                          <path d="M15.5 5.5L14 8.5L13.8 7.5L13.2 5.9C13.2 5.9 13.1 5.5 12.5 5.5H10.2L10.1 5.7C10.1 5.7 11.2 5.9 12.2 6.6L13.8 10.5H15.3L17.2 5.5H15.5Z" fill="white"/>
                          <path d="M7.7 5.5L6 10.5H4.5L5.6 6.4C5.6 6.1 5.4 5.8 5 5.7C4.6 5.6 4 5.5 4 5.5V5.3H6.3C6.7 5.3 7 5.6 7 5.9L7.5 8.5L9 5.5H7.7Z" fill="white"/>
                          <path d="M18.5 10.5C18.5 10.5 18.3 10.3 18.1 10.3C17.7 10.3 17.5 10.5 17.5 10.5L16 5.5H17.5L18.3 8.5L18.5 7.5L19 5.5H20.5L18.5 10.5Z" fill="white"/>
                        </svg>
                      )}
                      {billingInfo.paymentMethod.brand === 'mastercard' && (
                        <svg className="w-8 h-5" viewBox="0 0 24 16" fill="none">
                          <rect width="24" height="16" rx="2" fill="#F7F7F7"/>
                          <circle cx="9" cy="8" r="5" fill="#EB001B"/>
                          <circle cx="15" cy="8" r="5" fill="#F79E1B"/>
                          <path d="M12 4.5C13.2 5.5 14 6.7 14 8C14 9.3 13.2 10.5 12 11.5C10.8 10.5 10 9.3 10 8C10 6.7 10.8 5.5 12 4.5Z" fill="#FF5F00"/>
                        </svg>
                      )}
                      {billingInfo.paymentMethod.brand === 'amex' && (
                        <svg className="w-8 h-5" viewBox="0 0 24 16" fill="none">
                          <rect width="24" height="16" rx="2" fill="#006FCF"/>
                          <path d="M4 8L6 5H8L10 8L8 11H6L4 8Z" fill="white"/>
                          <path d="M10 5H14V6H11V7H14V8H11V9H14V11H10V5Z" fill="white"/>
                          <path d="M15 5H17L18 7L19 5H21L18 11H16L15 5Z" fill="white"/>
                        </svg>
                      )}
                      {!['visa', 'mastercard', 'amex'].includes(billingInfo.paymentMethod.brand) && (
                        <CreditCard className="w-6 h-5 text-muted-foreground" />
                      )}
                      <div className="flex flex-col">
                        <span className="text-sm font-medium capitalize">{billingInfo.paymentMethod.brand} •••• {billingInfo.paymentMethod.last4}</span>
                        <span className="text-xs text-muted-foreground">
                          Expires {billingInfo.paymentMethod.expMonth.toString().padStart(2, '0')}/{billingInfo.paymentMethod.expYear}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">No payment method on file</div>
                )}

                {/* Subscription Actions */}
                {billingInfo.organization.subscriptionStatus === 'ACTIVE' && (
                  <div className="flex flex-wrap gap-3">
                    {!billingInfo.organization.cancelAtPeriodEnd ? (
                      <button
                        onClick={() => onManageSubscription('cancel')}
                        className="px-4 py-2 bg-rose-500/10 text-rose-500 rounded-lg hover:bg-rose-500/20 transition-colors font-medium text-sm"
                      >
                        Cancel Subscription
                      </button>
                    ) : (
                      <button
                        onClick={() => onManageSubscription('resume')}
                        className="px-4 py-2 bg-brand-blue/10 text-brand-blue rounded-lg hover:bg-brand-blue/20 transition-colors font-medium text-sm"
                      >
                        Resume Subscription
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Cancellation Warning */}
            {billingInfo.organization.cancelAtPeriodEnd && (
              <div className="p-4 bg-amber-500/10 border-t border-amber-500/30">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                  <p className="text-sm text-amber-600 dark:text-amber-400">
                    Your subscription will be canceled on{' '}
                    <span className="font-semibold">
                      {billingInfo.organization.currentPeriodEnd &&
                        new Date(billingInfo.organization.currentPeriodEnd).toLocaleDateString('en-US', {
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                    </span>
                    . You'll continue to have access until then.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Usage Statistics */}
      {billingInfo && (
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-6 text-brand-mid-pink">Usage This Month</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-brand-mid-pink/50 transition-all">
              <UsageBar
                label="Team Members"
                current={billingInfo.usage.members.current}
                max={billingInfo.usage.members.max}
                icon={Users}
              />
              {billingInfo.usage.members.additionalSlots > 0 && (
                <div className="mt-3 text-xs text-gray-600 dark:text-gray-400">
                  Base: {billingInfo.usage.members.baseLimit} + {billingInfo.usage.members.additionalSlots} add-on slot{billingInfo.usage.members.additionalSlots > 1 ? 's' : ''}
                </div>
              )}
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => setShowMemberSlotModal(true)}
                  disabled={purchasingSlots}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 bg-brand-mid-pink/10 dark:bg-brand-mid-pink/20 hover:bg-brand-mid-pink/20 dark:hover:bg-brand-mid-pink/30 text-brand-mid-pink dark:text-brand-light-pink rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-4 h-4" />
                  Add Slots
                </button>
                {billingInfo.usage.members.additionalSlots > 0 && (
                  <button
                    onClick={() => setShowManageSlotModal(true)}
                    className="inline-flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium transition-colors"
                    title="Manage member slots"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-brand-mid-pink/50 transition-all">
              <UsageBar
                label="Content Profiles"
                current={billingInfo.usage.profiles.current}
                max={billingInfo.usage.profiles.max}
                icon={CreditCard}
              />
              {billingInfo.usage.profiles.additionalSlots > 0 && (
                <div className="mt-3 text-xs text-gray-600 dark:text-gray-400">
                  Base: {billingInfo.usage.profiles.baseLimit} + {billingInfo.usage.profiles.additionalSlots} add-on slot{billingInfo.usage.profiles.additionalSlots > 1 ? 's' : ''}
                </div>
              )}
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => setShowProfileSlotModal(true)}
                  disabled={purchasingProfileSlots}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 bg-brand-mid-pink/10 dark:bg-brand-mid-pink/20 hover:bg-brand-mid-pink/20 dark:hover:bg-brand-mid-pink/30 text-brand-mid-pink dark:text-brand-light-pink rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-4 h-4" />
                  Add Slots
                </button>
                {billingInfo.usage.profiles.additionalSlots > 0 && (
                  <button
                    onClick={() => setShowManageProfileSlotModal(true)}
                    className="inline-flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium transition-colors"
                    title="Manage content profile slots"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            {/* Storage Card - loads separately for better performance */}
            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-brand-mid-pink/50 transition-all">
              {storageLoading ? (
                <div className="space-y-4 animate-pulse">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <HardDrive className="w-4 h-4 text-muted-foreground opacity-50" />
                      <div className="h-4 w-28 bg-muted rounded"></div>
                    </div>
                    <div className="h-4 w-20 bg-muted rounded"></div>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2"></div>
                  <p className="text-xs text-muted-foreground animate-pulse">Calculating storage...</p>
                </div>
              ) : storageData?.breakdown ? (
                <>
                  <UsageBar
                    label="Storage (GB)"
                    current={Math.round(storageData.breakdown.totalGB * 10) / 10}
                    max={billingInfo.usage.storage.max}
                    icon={HardDrive}
                  />
                  {billingInfo.usage.storage.additionalGB !== undefined && billingInfo.usage.storage.additionalGB > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {billingInfo.usage.storage.baseGB || 0} base + {billingInfo.usage.storage.additionalGB} additional GB
                    </p>
                  )}
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => setShowStorageSlotModal(true)}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 bg-brand-mid-pink/10 dark:bg-brand-mid-pink/20 hover:bg-brand-mid-pink/20 dark:hover:bg-brand-mid-pink/30 text-brand-mid-pink dark:text-brand-light-pink rounded-lg text-sm font-medium transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Add Storage
                    </button>
                    {billingInfo.usage.storage.additionalGB !== undefined && billingInfo.usage.storage.additionalGB > 0 && (
                      <button
                        onClick={() => setShowManageStorageSlotModal(true)}
                        className="inline-flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium transition-colors"
                        title="Manage storage"
                      >
                        <Settings className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <UsageBar
                    label="Storage (GB)"
                    current={Math.round(billingInfo.usage.storage.current * 10) / 10}
                    max={billingInfo.usage.storage.max}
                    icon={HardDrive}
                  />
                  {billingInfo.usage.storage.additionalGB !== undefined && billingInfo.usage.storage.additionalGB > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {billingInfo.usage.storage.baseGB || 0} base + {billingInfo.usage.storage.additionalGB} additional GB
                    </p>
                  )}
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => setShowStorageSlotModal(true)}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 bg-brand-mid-pink/10 dark:bg-brand-mid-pink/20 hover:bg-brand-mid-pink/20 dark:hover:bg-brand-mid-pink/30 text-brand-mid-pink dark:text-brand-light-pink rounded-lg text-sm font-medium transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Add Storage
                    </button>
                    {billingInfo.usage.storage.additionalGB !== undefined && billingInfo.usage.storage.additionalGB > 0 && (
                      <button
                        onClick={() => setShowManageStorageSlotModal(true)}
                        className="inline-flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium transition-colors"
                        title="Manage storage"
                      >
                        <Settings className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-brand-mid-pink/50 transition-all">
              <UsageBar
                label="AI Credits Used This Month"
                current={billingInfo.usage.credits.used}
                max={billingInfo.usage.credits.max}
                icon={Zap}
              />
              <p className="text-xs text-muted-foreground mt-2">
                {billingInfo.usage.credits.available.toLocaleString()} credits available • {billingInfo.usage.credits.max.toLocaleString()}/month included
              </p>
            </div>
          </div>

          {/* Detailed Storage Breakdown */}
          <StorageBreakdown />
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
                    <span className="bg-brand-blue text-white text-xs font-medium px-2 sm:px-3 py-1 rounded-full whitespace-nowrap shadow-md">
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
                    <span className="bg-brand-blue text-white text-xs font-medium px-2 sm:px-3 py-1 rounded-full whitespace-nowrap shadow-md">
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
                      className="w-full bg-brand-blue text-white py-2 px-4 rounded-lg font-medium cursor-not-allowed shadow-md"
                    >
                      Active Subscription
                    </button>
                  ) : (
                    <button
                      onClick={() => onSubscribe(plan)}
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
                      <div className="text-xs text-brand-blue dark:text-brand-blue mt-1">
                        +{pkg.bonus} Bonus Credits
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-auto">
                  <button
                    onClick={() => onPurchaseCredits(pkg)}
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

      {/* Member Slot Purchase Modal */}
      {billingInfo && (
        <>
          <PurchaseMemberSlotsModal
            isOpen={showMemberSlotModal}
            onClose={() => setShowMemberSlotModal(false)}
            onPurchase={handlePurchaseMemberSlots}
            pricePerSlot={billingInfo.usage.members.memberSlotPrice}
            currentSlots={billingInfo.usage.members.additionalSlots}
            baseLimit={billingInfo.usage.members.baseLimit}
            purchasing={purchasingSlots}
          />
          <ManageMemberSlotsModal
            isOpen={showManageSlotModal}
            onClose={() => setShowManageSlotModal(false)}
            onRemove={handleRemoveMemberSlots}
            pricePerSlot={billingInfo.usage.members.memberSlotPrice}
            currentSlots={billingInfo.usage.members.additionalSlots}
            baseLimit={billingInfo.usage.members.baseLimit}
            currentMembers={billingInfo.usage.members.current}
          />

          {/* Content Profile Slot Modals */}
          <PurchaseContentProfileSlotsModal
            isOpen={showProfileSlotModal}
            onClose={() => setShowProfileSlotModal(false)}
            onPurchase={handlePurchaseContentProfileSlots}
            pricePerSlot={billingInfo.usage.profiles.contentProfileSlotPrice}
            currentSlots={billingInfo.usage.profiles.additionalSlots}
            baseLimit={billingInfo.usage.profiles.baseLimit}
            purchasing={purchasingProfileSlots}
          />
          <ManageContentProfileSlotsModal
            isOpen={showManageProfileSlotModal}
            onClose={() => setShowManageProfileSlotModal(false)}
            onRemove={handleRemoveContentProfileSlots}
            pricePerSlot={billingInfo.usage.profiles.contentProfileSlotPrice}
            currentSlots={billingInfo.usage.profiles.additionalSlots}
            baseLimit={billingInfo.usage.profiles.baseLimit}
            currentProfiles={billingInfo.usage.profiles.current}
          />

          {/* Storage Slot Modals */}
          <PurchaseStorageSlotsModal
            isOpen={showStorageSlotModal}
            onClose={() => setShowStorageSlotModal(false)}
            onPurchase={handlePurchaseStorageSlots}
            pricePerGB={billingInfo.usage.storage.storageSlotPrice || 0.50}
            currentAdditionalGB={billingInfo.usage.storage.additionalGB || 0}
            baseStorageGB={billingInfo.usage.storage.baseGB || billingInfo.usage.storage.max}
            purchasing={purchasingStorageSlots}
          />
          <ManageStorageSlotsModal
            isOpen={showManageStorageSlotModal}
            onClose={() => setShowManageStorageSlotModal(false)}
            onRemove={handleRemoveStorageSlots}
            pricePerGB={billingInfo.usage.storage.storageSlotPrice || 0.50}
            currentAdditionalGB={billingInfo.usage.storage.additionalGB || 0}
            baseStorageGB={billingInfo.usage.storage.baseGB || billingInfo.usage.storage.max}
            currentUsageGB={storageData?.breakdown?.totalGB || billingInfo.usage.storage.current}
          />
        </>
      )}
    </>
  );
}
