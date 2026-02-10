'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Users, Plus, Minus } from 'lucide-react';

interface PurchaseMemberSlotsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPurchase: (quantity: number) => void;
  pricePerSlot: number;
  currentSlots: number;
  baseLimit: number;
}

export function PurchaseMemberSlotsModal({
  isOpen,
  onClose,
  onPurchase,
  pricePerSlot,
  currentSlots,
  baseLimit,
}: PurchaseMemberSlotsModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [purchasing, setPurchasing] = useState(false);
  const [mounted, setMounted] = useState(false);

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

  if (!isOpen || !mounted) return null;

  const handlePurchase = async () => {
    setPurchasing(true);
    await onPurchase(quantity);
    setPurchasing(false);
  };

  const totalPrice = pricePerSlot * quantity;
  const newTotalSlots = baseLimit + currentSlots + quantity;

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
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full border border-brand-mid-pink/30 overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-brand-mid-pink/10 dark:bg-brand-mid-pink/20 rounded-xl">
                <Users className="w-6 h-6 text-brand-mid-pink" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Add Member Slots
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
              <div className="bg-brand-light-pink/10 dark:bg-brand-light-pink/20 rounded-xl p-5 border border-brand-light-pink/30">
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2 uppercase tracking-wide">Current Setup</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-brand-mid-pink">
                    {baseLimit + currentSlots}
                  </span>
                  <span className="text-base text-gray-600 dark:text-gray-400">
                    member slots
                  </span>
                </div>
                {currentSlots > 0 && (
                  <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                    {baseLimit} included + {currentSlots} add-on{currentSlots > 1 ? 's' : ''}
                  </p>
                )}
              </div>
            </div>

            {/* Quantity Selector */}
            <div>
              <label className="block text-base font-semibold text-gray-900 dark:text-white mb-5">
                How many slots would you like to add?
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
                    max="50"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
                    className="w-full text-center text-5xl font-bold bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-2xl px-6 py-4 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-mid-pink focus:border-brand-mid-pink transition-all"
                  />
                  <div className="absolute -bottom-6 left-0 right-0 text-center text-xs text-gray-500 dark:text-gray-500">
                    ${(pricePerSlot * quantity).toFixed(2)}/month
                  </div>
                </div>

                <button
                  onClick={() => setQuantity(Math.min(50, quantity + 1))}
                  disabled={quantity >= 50}
                  className="flex-shrink-0 w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95 flex items-center justify-center"
                >
                  <Plus className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </button>
              </div>

              {/* Quick Select Buttons */}
              <div className="grid grid-cols-4 gap-3 mt-8">
                {[1, 3, 5, 10].map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setQuantity(preset)}
                    className={`px-4 py-3.5 rounded-xl text-base font-bold transition-all ${
                      quantity === preset
                        ? 'bg-brand-mid-pink text-white shadow-lg ring-2 ring-brand-mid-pink ring-offset-2 dark:ring-offset-gray-900'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Features/Benefits */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">What you get:</h3>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-brand-mid-pink/10 dark:bg-brand-mid-pink/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <div className="w-2 h-2 rounded-full bg-brand-mid-pink" />
                  </div>
                  <span>Invite more team members to collaborate</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-brand-mid-pink/10 dark:bg-brand-mid-pink/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <div className="w-2 h-2 rounded-full bg-brand-mid-pink" />
                  </div>
                  <span>Billed monthly, cancel anytime</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-brand-mid-pink/10 dark:bg-brand-mid-pink/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <div className="w-2 h-2 rounded-full bg-brand-mid-pink" />
                  </div>
                  <span>Slots persist across plan changes</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Right Column - Summary & Checkout (2/5 = 40%) */}
          <div className="md:col-span-2 p-8 bg-gray-50 dark:bg-gray-800/50 space-y-6 flex flex-col">
            <div className="flex-1 space-y-6">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Order Summary</h3>

                {/* Price Breakdown */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">Additional Member Slots</p>
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">${pricePerSlot.toFixed(2)}/month per slot</p>
                    </div>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">× {quantity}</p>
                  </div>

                  <div className="flex items-center justify-between py-3">
                    <p className="text-base font-semibold text-gray-900 dark:text-white">Monthly Subtotal</p>
                    <p className="text-2xl font-bold text-brand-mid-pink">${totalPrice.toFixed(2)}</p>
                  </div>
                </div>

                {/* Billing Info */}
                <div className="mt-6 p-4 bg-brand-blue dark:bg-brand-blue/20 rounded-xl border border-brand-blue dark:border-brand-blue">
                  <p className="text-xs font-semibold text-brand-blue dark:text-brand-blue0 mb-2">Billing Details</p>
                  <ul className="text-xs text-brand-blue dark:text-brand-blue space-y-1">
                    <li>• First charge: ${totalPrice.toFixed(2)} today</li>
                    <li>• Recurring: ${totalPrice.toFixed(2)}/month</li>
                    <li>• Next billing: {new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}</li>
                  </ul>
                </div>

                {/* After Purchase Preview */}
                <div className="mt-6 p-5 bg-gradient-to-br from-brand-mid-pink/10 to-brand-light-pink/10 dark:from-brand-mid-pink/20 dark:to-brand-light-pink/20 rounded-xl border border-brand-mid-pink/30">
                  <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">After purchase:</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold text-brand-mid-pink">
                      {newTotalSlots}
                    </span>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      total slots
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                    {baseLimit} base + {currentSlots + quantity} add-on{currentSlots + quantity > 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <button
                onClick={handlePurchase}
                disabled={purchasing}
                className="w-full px-6 py-4 rounded-xl bg-brand-mid-pink hover:bg-brand-dark-pink text-white font-bold text-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {purchasing ? (
                  <>
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Users className="w-6 h-6" />
                    Purchase for ${totalPrice.toFixed(2)}/mo
                  </>
                )}
              </button>
              <button
                onClick={onClose}
                disabled={purchasing}
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
