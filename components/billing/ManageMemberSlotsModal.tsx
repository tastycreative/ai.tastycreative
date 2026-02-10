'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Users, Minus, AlertTriangle, Trash2 } from 'lucide-react';

interface ManageMemberSlotsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRemove: (quantity: number) => Promise<{ success: boolean; error?: string; message?: string; currentMembers?: number; newLimit?: number; membersToRemove?: number }>;
  pricePerSlot: number;
  currentSlots: number;
  baseLimit: number;
  currentMembers: number;
}

export function ManageMemberSlotsModal({
  isOpen,
  onClose,
  onRemove,
  pricePerSlot,
  currentSlots,
  baseLimit,
  currentMembers,
}: ManageMemberSlotsModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [removing, setRemoving] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overflowWarning, setOverflowWarning] = useState<{
    currentMembers: number;
    newLimit: number;
    membersToRemove: number;
  } | null>(null);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setQuantity(Math.min(1, currentSlots));
      setError(null);
      setOverflowWarning(null);
    }
  }, [isOpen, currentSlots]);

  // Check if removal would cause overflow
  useEffect(() => {
    const newLimit = baseLimit + (currentSlots - quantity);
    if (currentMembers > newLimit) {
      setOverflowWarning({
        currentMembers,
        newLimit,
        membersToRemove: currentMembers - newLimit,
      });
    } else {
      setOverflowWarning(null);
    }
  }, [quantity, currentSlots, baseLimit, currentMembers]);

  if (!isOpen || !mounted) return null;

  const handleRemove = async () => {
    setRemoving(true);
    setError(null);

    try {
      const result = await onRemove(quantity);

      if (!result.success) {
        setError(result.error || result.message || 'Failed to remove member slots');

        // If there's overflow info in the error response, show it
        if (result.currentMembers && result.newLimit && result.membersToRemove) {
          setOverflowWarning({
            currentMembers: result.currentMembers,
            newLimit: result.newLimit,
            membersToRemove: result.membersToRemove,
          });
        }
      } else {
        // Success - close modal
        onClose();
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setRemoving(false);
    }
  };

  const totalSavings = pricePerSlot * quantity;
  const newTotalSlots = baseLimit + currentSlots - quantity;
  const canRemove = !overflowWarning;

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full border border-red-500/30 overflow-hidden">
          {/* Header */}
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-500/10 dark:bg-red-500/20 rounded-xl">
                  <Trash2 className="w-6 h-6 text-red-500" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Remove Member Slots
                </h2>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Two Column Layout - 60/40 split */}
          <div className="grid grid-cols-1 md:grid-cols-5 min-h-[500px]">
            {/* Left Column - Configuration (3/5 = 60%) */}
            <div className="md:col-span-3 p-8 space-y-8 border-r border-gray-200 dark:border-gray-700">
              {/* Current Status */}
              <div>
                <div className="bg-gray-100 dark:bg-gray-800 rounded-xl p-5 border border-gray-300 dark:border-gray-600">
                  <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2 uppercase tracking-wide">Current Setup</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold text-gray-900 dark:text-white">
                      {baseLimit + currentSlots}
                    </span>
                    <span className="text-base text-gray-600 dark:text-gray-400">
                      member slots
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                    {baseLimit} base + {currentSlots} add-on{currentSlots > 1 ? 's' : ''}
                  </p>
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mt-3">
                    Currently using: {currentMembers} member{currentMembers !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              {/* Quantity Selector */}
              <div>
                <label className="block text-base font-semibold text-gray-900 dark:text-white mb-5">
                  How many slots would you like to remove?
                </label>

                {/* Number Input with +/- buttons */}
                <div className="flex items-center gap-4 mb-6">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1}
                    className="flex-shrink-0 w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95 flex items-center justify-center"
                  >
                    <Minus className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  </button>

                  <div className="flex-1 relative">
                    <input
                      type="number"
                      min="1"
                      max={currentSlots}
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, Math.min(currentSlots, parseInt(e.target.value) || 1)))}
                      className="w-full text-center text-5xl font-bold bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-2xl px-6 py-4 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all"
                    />
                    <div className="absolute -bottom-6 left-0 right-0 text-center text-xs text-gray-500 dark:text-gray-500">
                      Save ${totalSavings.toFixed(2)}/month
                    </div>
                  </div>

                  <button
                    onClick={() => setQuantity(Math.min(currentSlots, quantity + 1))}
                    disabled={quantity >= currentSlots}
                    className="flex-shrink-0 w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95 flex items-center justify-center"
                  >
                    <Minus className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  </button>
                </div>

                {/* Quick Select Buttons */}
                <div className="grid grid-cols-4 gap-3 mt-8">
                  {[1, Math.floor(currentSlots / 2), currentSlots - 1, currentSlots]
                    .filter((preset, index, arr) => preset > 0 && arr.indexOf(preset) === index)
                    .map((preset) => (
                      <button
                        key={preset}
                        onClick={() => setQuantity(preset)}
                        className={`px-4 py-3.5 rounded-xl text-base font-bold transition-all ${
                          quantity === preset
                            ? 'bg-red-500 text-white shadow-lg ring-2 ring-red-500 ring-offset-2 dark:ring-offset-gray-900'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                </div>
              </div>

              {/* Overflow Warning */}
              {overflowWarning && (
                <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-500 rounded-xl p-5">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-bold text-red-900 dark:text-red-200 mb-2">
                        Cannot Remove Slots
                      </h4>
                      <p className="text-sm text-red-800 dark:text-red-300 mb-3">
                        You currently have <strong>{overflowWarning.currentMembers} active members</strong>, but removing {quantity} slot{quantity > 1 ? 's' : ''} would reduce your limit to <strong>{overflowWarning.newLimit}</strong>.
                      </p>
                      <p className="text-sm font-semibold text-red-900 dark:text-red-200">
                        Please remove {overflowWarning.membersToRemove} member{overflowWarning.membersToRemove > 1 ? 's' : ''} before cancelling these slots.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {error && !overflowWarning && (
                <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-500 rounded-xl p-4">
                  <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
                </div>
              )}

              {/* What happens */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">What happens when you remove slots:</h3>
                <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <li className="flex items-start gap-2">
                    <div className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <div className="w-2 h-2 rounded-full bg-gray-600 dark:bg-gray-400" />
                    </div>
                    <span>Your monthly bill will be reduced immediately</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <div className="w-2 h-2 rounded-full bg-gray-600 dark:bg-gray-400" />
                    </div>
                    <span>You won't be able to invite new members beyond the new limit</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <div className="w-2 h-2 rounded-full bg-gray-600 dark:bg-gray-400" />
                    </div>
                    <span>Existing members will not be affected</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Right Column - Summary & Confirmation (2/5 = 40%) */}
            <div className="md:col-span-2 p-8 bg-gray-50 dark:bg-gray-800/50 space-y-6 flex flex-col">
              <div className="flex-1 space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Removal Summary</h3>

                  {/* Savings Breakdown */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">Member Slots to Remove</p>
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">${pricePerSlot.toFixed(2)}/month per slot</p>
                      </div>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">× {quantity}</p>
                    </div>

                    <div className="flex items-center justify-between py-3">
                      <p className="text-base font-semibold text-gray-900 dark:text-white">Monthly Savings</p>
                      <p className="text-2xl font-bold text-green-600 dark:text-green-500">${totalSavings.toFixed(2)}</p>
                    </div>
                  </div>

                  {/* After Removal Preview */}
                  <div className="mt-6 p-5 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 rounded-xl border border-gray-300 dark:border-gray-600">
                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">After removal:</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-bold text-gray-900 dark:text-white">
                        {newTotalSlots}
                      </span>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        total slots
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                      {baseLimit} base + {currentSlots - quantity} add-on{currentSlots - quantity !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <button
                  onClick={handleRemove}
                  disabled={removing || !canRemove}
                  className="w-full px-6 py-4 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {removing ? (
                    <>
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-6 h-6" />
                      Remove {quantity} Slot{quantity > 1 ? 's' : ''}
                    </>
                  )}
                </button>
                <button
                  onClick={onClose}
                  disabled={removing}
                  className="w-full px-6 py-3 rounded-xl border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
