'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, HardDrive, Minus, AlertTriangle, Trash2 } from 'lucide-react';

interface ManageStorageSlotsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRemove: (quantity: number) => Promise<{ success: boolean; error?: string; message?: string; currentUsageGB?: number; newLimitGB?: number }>;
  pricePerGB: number;
  currentAdditionalGB: number;
  baseStorageGB: number;
  currentUsageGB: number;
}

export function ManageStorageSlotsModal({
  isOpen,
  onClose,
  onRemove,
  pricePerGB,
  currentAdditionalGB,
  baseStorageGB,
  currentUsageGB,
}: ManageStorageSlotsModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [removing, setRemoving] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overflowWarning, setOverflowWarning] = useState<{
    currentUsageGB: number;
    newLimitGB: number;
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
      setQuantity(Math.min(1, currentAdditionalGB));
      setError(null);
      setOverflowWarning(null);
    }
  }, [isOpen, currentAdditionalGB]);

  // Check if removal would cause overflow
  useEffect(() => {
    const newLimitGB = baseStorageGB + (currentAdditionalGB - quantity);
    if (currentUsageGB > newLimitGB) {
      setOverflowWarning({
        currentUsageGB,
        newLimitGB,
      });
    } else {
      setOverflowWarning(null);
    }
  }, [quantity, currentAdditionalGB, baseStorageGB, currentUsageGB]);

  if (!isOpen || !mounted) return null;

  const handleRemove = async () => {
    setRemoving(true);
    setError(null);

    try {
      const result = await onRemove(quantity);

      if (!result.success) {
        setError(result.error || result.message || 'Failed to remove storage');

        // If there's overflow info in the error response, show it
        if (result.currentUsageGB && result.newLimitGB) {
          setOverflowWarning({
            currentUsageGB: result.currentUsageGB,
            newLimitGB: result.newLimitGB,
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

  const totalSavings = pricePerGB * quantity;
  const newTotalStorageGB = baseStorageGB + currentAdditionalGB - quantity;
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
                  Remove Storage
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

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 md:grid-cols-5 min-h-[450px]">
            {/* Left Column - Configuration */}
            <div className="md:col-span-3 p-8 space-y-6 border-r border-gray-200 dark:border-gray-700">
              {/* Current Status */}
              <div>
                <div className="bg-gray-100 dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2 uppercase tracking-wide">Current Storage</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold text-gray-900 dark:text-white">
                      {baseStorageGB + currentAdditionalGB}
                    </span>
                    <span className="text-base text-gray-600 dark:text-gray-400">
                      GB total
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                    {baseStorageGB} GB included + {currentAdditionalGB} GB add-on
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                    Currently using: <span className="font-semibold">{currentUsageGB.toFixed(2)} GB</span>
                  </p>
                </div>
              </div>

              {/* Quantity Selector */}
              <div>
                <label className="block text-base font-semibold text-gray-900 dark:text-white mb-4">
                  How much storage would you like to remove?
                </label>

                <div className="flex items-center gap-4 mb-4">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1}
                    className="flex-shrink-0 w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center"
                  >
                    <Minus className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  </button>

                  <div className="flex-1 relative">
                    <input
                      type="number"
                      min="1"
                      max={currentAdditionalGB}
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, Math.min(currentAdditionalGB, parseInt(e.target.value) || 1)))}
                      className="w-full text-center text-4xl font-bold bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-2xl px-6 py-3 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all"
                    />
                    <div className="absolute -bottom-6 left-0 right-0 text-center text-xs text-gray-500">
                      Save ${(pricePerGB * quantity).toFixed(2)}/month
                    </div>
                  </div>

                  <button
                    onClick={() => setQuantity(Math.min(currentAdditionalGB, quantity + 1))}
                    disabled={quantity >= currentAdditionalGB}
                    className="flex-shrink-0 w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center"
                  >
                    <HardDrive className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  </button>
                </div>

                {/* Quick Select */}
                <div className="grid grid-cols-4 gap-2 mt-8">
                  {[1, 5, 10, currentAdditionalGB].filter((v, i, arr) => arr.indexOf(v) === i && v <= currentAdditionalGB).map((preset) => (
                    <button
                      key={preset}
                      onClick={() => setQuantity(preset)}
                      className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                        quantity === preset
                          ? 'bg-red-500 text-white'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                    >
                      {preset === currentAdditionalGB ? 'All' : `${preset} GB`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Warning about overflow */}
              {overflowWarning && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-red-700 dark:text-red-400">
                        Cannot remove storage
                      </p>
                      <p className="text-sm text-red-600 dark:text-red-300 mt-1">
                        You&apos;re currently using {overflowWarning.currentUsageGB.toFixed(2)} GB, but removing {quantity} GB would leave you with only {overflowWarning.newLimitGB} GB capacity.
                      </p>
                      <p className="text-sm text-red-600 dark:text-red-300 mt-2">
                        Please delete some files first to reduce your usage below {overflowWarning.newLimitGB} GB.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {error && !overflowWarning && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}
            </div>

            {/* Right Column - Summary */}
            <div className="md:col-span-2 p-8 bg-gray-50 dark:bg-gray-800/50 space-y-6 flex flex-col">
              <div className="flex-1 space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Summary</h3>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">Storage to Remove</p>
                        <p className="text-xs text-gray-500 mt-1">${pricePerGB.toFixed(2)}/month per GB</p>
                      </div>
                      <p className="text-lg font-semibold text-red-500">- {quantity} GB</p>
                    </div>

                    <div className="flex items-center justify-between py-3">
                      <p className="text-base font-semibold text-gray-900 dark:text-white">Monthly Savings</p>
                      <p className="text-2xl font-bold text-green-500">${totalSavings.toFixed(2)}</p>
                    </div>
                  </div>

                  {/* After Removal Preview */}
                  <div className="mt-6 p-5 bg-gray-100 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">After removal:</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold text-gray-900 dark:text-white">
                        {newTotalStorageGB}
                      </span>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        GB total
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      {baseStorageGB} GB base + {currentAdditionalGB - quantity} GB add-on
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <button
                  onClick={handleRemove}
                  disabled={removing || !canRemove}
                  className="w-full px-6 py-4 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-lg shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {removing ? (
                    <>
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-5 h-5" />
                      Remove {quantity} GB
                    </>
                  )}
                </button>
                <button
                  onClick={onClose}
                  disabled={removing}
                  className="w-full px-6 py-3 rounded-xl border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
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
