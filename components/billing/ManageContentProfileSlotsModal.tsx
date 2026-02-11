'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, User, Minus, AlertTriangle, Trash2 } from 'lucide-react';

interface ManageContentProfileSlotsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRemove: (quantity: number) => Promise<{ success: boolean; error?: string; message?: string; currentProfiles?: number; newLimit?: number; profilesToRemove?: number }>;
  pricePerSlot: number;
  currentSlots: number;
  baseLimit: number;
  currentProfiles: number;
}

export function ManageContentProfileSlotsModal({
  isOpen,
  onClose,
  onRemove,
  pricePerSlot,
  currentSlots,
  baseLimit,
  currentProfiles,
}: ManageContentProfileSlotsModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [removing, setRemoving] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overflowWarning, setOverflowWarning] = useState<{
    currentProfiles: number;
    newLimit: number;
    profilesToRemove: number;
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
    if (currentProfiles > newLimit) {
      setOverflowWarning({
        currentProfiles,
        newLimit,
        profilesToRemove: currentProfiles - newLimit,
      });
    } else {
      setOverflowWarning(null);
    }
  }, [quantity, currentSlots, baseLimit, currentProfiles]);

  if (!isOpen || !mounted) return null;

  const handleRemove = async () => {
    setRemoving(true);
    setError(null);

    try {
      const result = await onRemove(quantity);

      if (!result.success) {
        setError(result.error || result.message || 'Failed to remove content profile slots');

        // If there's overflow info in the error response, show it
        if (result.currentProfiles && result.newLimit && result.profilesToRemove) {
          setOverflowWarning({
            currentProfiles: result.currentProfiles,
            newLimit: result.newLimit,
            profilesToRemove: result.profilesToRemove,
          });
        }

        setRemoving(false);
        return;
      }

      // Success - close modal
      onClose();
    } catch (error) {
      console.error('Error removing content profile slots:', error);
      setError('An unexpected error occurred');
      setRemoving(false);
    }
  };

  const totalSavings = pricePerSlot * quantity;
  const newTotalSlots = baseLimit + (currentSlots - quantity);

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
                  Remove Content Profile Slots
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
                <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-5 border border-red-200 dark:border-red-800">
                  <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2 uppercase tracking-wide">Current Setup</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold text-red-600 dark:text-red-500">
                      {baseLimit + currentSlots}
                    </span>
                    <span className="text-base text-gray-600 dark:text-gray-400">
                      content profile slots
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                    {baseLimit} base + {currentSlots} add-on{currentSlots > 1 ? 's' : ''}
                  </p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">
                    <span className="font-semibold">Current usage:</span> {currentProfiles} profile{currentProfiles !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-500 rounded-xl p-4">
                  <p className="text-sm text-red-800 dark:text-red-200 font-medium">{error}</p>
                </div>
              )}

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
                        You currently have <strong>{overflowWarning.currentProfiles} content profiles</strong>, but removing {quantity} slot{quantity > 1 ? 's' : ''} would reduce your limit to <strong>{overflowWarning.newLimit}</strong>.
                      </p>
                      <p className="text-sm font-semibold text-red-900 dark:text-red-200">
                        Please delete {overflowWarning.profilesToRemove} content profile{overflowWarning.profilesToRemove > 1 ? 's' : ''} before cancelling these slots.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Quantity Selector */}
              <div>
                <label className="block text-base font-semibold text-gray-900 dark:text-white mb-5">
                  How many slots would you like to remove?
                </label>

                {/* Number Input with - button */}
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
                      Save ${(pricePerSlot * quantity).toFixed(2)}/month
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
                  {[1, Math.min(3, currentSlots), Math.min(5, currentSlots), currentSlots].filter((v, i, a) => a.indexOf(v) === i && v > 0).map((preset) => (
                    <button
                      key={preset}
                      onClick={() => setQuantity(preset)}
                      className={`px-4 py-3.5 rounded-xl text-base font-bold transition-all ${
                        quantity === preset
                          ? 'bg-red-500 text-white shadow-lg ring-2 ring-red-500 ring-offset-2 dark:ring-offset-gray-900'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                    >
                      {preset === currentSlots ? 'All' : preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column - Summary (2/5 = 40%) */}
            <div className="md:col-span-2 p-8 bg-gray-50 dark:bg-gray-800/50 space-y-6 flex flex-col">
              <div className="flex-1 space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Removal Summary</h3>

                  {/* Price Breakdown */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">Content Profile Slots to Remove</p>
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">${pricePerSlot.toFixed(2)}/month per slot</p>
                      </div>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">× {quantity}</p>
                    </div>

                    <div className="flex items-center justify-between py-3">
                      <p className="text-base font-semibold text-gray-900 dark:text-white">Monthly Savings</p>
                      <p className="text-2xl font-bold text-green-600 dark:text-green-500">${totalSavings.toFixed(2)}</p>
                    </div>
                  </div>

                  {/* Refund Info */}
                  <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                    <p className="text-xs font-semibold text-blue-900 dark:text-blue-200 mb-2">💡 About Refunds</p>
                    <p className="text-xs text-blue-800 dark:text-blue-300">
                      You will receive a <strong>prorated credit</strong> for unused time, applied to your next invoice. No cash refund will be issued.
                    </p>
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
                  disabled={removing || !!overflowWarning}
                  className="w-full px-6 py-4 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {removing ? (
                    <>
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white" />
                      Removing...
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
