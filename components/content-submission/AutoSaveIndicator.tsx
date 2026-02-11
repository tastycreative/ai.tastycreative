'use client';

import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Cloud, AlertCircle, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface AutoSaveIndicatorProps {
  isSaving: boolean;
  lastSaved: Date | null;
  error: Error | null;
}

export const AutoSaveIndicator = memo(function AutoSaveIndicator({
  isSaving,
  lastSaved,
  error,
}: AutoSaveIndicatorProps) {
  const getStatus = () => {
    if (isSaving) {
      return {
        icon: Loader2,
        text: 'Saving...',
        color: 'text-brand-blue',
        bgColor: 'bg-brand-blue/10',
        borderColor: 'border-brand-blue/30',
      };
    }

    if (error) {
      return {
        icon: AlertCircle,
        text: 'Failed to save',
        color: 'text-red-400',
        bgColor: 'bg-red-500/10',
        borderColor: 'border-red-500/30',
      };
    }

    if (lastSaved) {
      return {
        icon: Check,
        text: `Saved ${formatDistanceToNow(lastSaved, { addSuffix: true })}`,
        color: 'text-green-400',
        bgColor: 'bg-green-500/10',
        borderColor: 'border-green-500/30',
      };
    }

    return {
      icon: Cloud,
      text: 'Auto-save enabled',
      color: 'text-zinc-400',
      bgColor: 'bg-zinc-800/30',
      borderColor: 'border-zinc-700/30',
    };
  };

  const status = getStatus();
  const Icon = status.icon;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={status.text}
        initial={{ opacity: 0, scale: 0.9, y: -10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: -10 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className={`
          inline-flex items-center gap-2 px-3 py-1.5 rounded-full
          border backdrop-blur-sm text-xs font-medium
          ${status.color} ${status.bgColor} ${status.borderColor}
        `}
      >
        <Icon
          className={`w-3.5 h-3.5 ${isSaving ? 'animate-spin' : ''}`}
        />
        <span>{status.text}</span>
      </motion.div>
    </AnimatePresence>
  );
});
