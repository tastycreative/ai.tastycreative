'use client';

import { memo, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';

interface FormFieldProps {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  success?: boolean;
  children: ReactNode;
  className?: string;
}

export const FormField = memo(function FormField({
  label,
  error,
  hint,
  required,
  success,
  children,
  className = '',
}: FormFieldProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      {/* Label */}
      <label className="flex items-center gap-2 text-sm font-medium text-zinc-300">
        <span>{label}</span>
        {required && (
          <span className="text-brand-light-pink text-xs">*</span>
        )}
        {hint && (
          <div className="group relative">
            <Info className="w-3.5 h-3.5 text-zinc-500 cursor-help" />
            <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block z-50">
              <div className="bg-zinc-800 text-white text-xs px-3 py-2 rounded-lg shadow-xl max-w-xs whitespace-normal border border-zinc-700">
                {hint}
                <div className="absolute top-full left-4 -mt-1 border-4 border-transparent border-t-zinc-800" />
              </div>
            </div>
          </div>
        )}
      </label>

      {/* Input Container */}
      <div className="relative">
        {children}

        {/* Success Indicator */}
        <AnimatePresence>
          {success && !error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, x: -10 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.8, x: -10 }}
              className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
            >
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Error Message */}
      <AnimatePresence mode="wait">
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="flex items-start gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

// Optimized Input Component
interface OptimizedInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  success?: boolean;
}

export const OptimizedInput = memo(
  function OptimizedInput({
    error,
    success,
    className = '',
    ...props
  }: OptimizedInputProps) {
    return (
      <input
        className={`
        w-full px-4 py-3 rounded-xl
        bg-zinc-900/50 backdrop-blur-sm
        border-2 transition-all duration-200
        text-white placeholder-zinc-500
        focus:outline-none focus:ring-2 focus:ring-offset-0
        disabled:opacity-50 disabled:cursor-not-allowed
        ${
          error
            ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20'
            : success
            ? 'border-green-500/50 focus:border-green-500 focus:ring-green-500/20'
            : 'border-zinc-700/50 focus:border-brand-light-pink focus:ring-brand-light-pink/20'
        }
        ${className}
      `}
        {...props}
      />
    );
  }
);

// Optimized Textarea Component
interface OptimizedTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
  success?: boolean;
}

export const OptimizedTextarea = memo(
  function OptimizedTextarea({
    error,
    success,
    className = '',
    ...props
  }: OptimizedTextareaProps) {
    return (
      <textarea
        className={`
        w-full px-4 py-3 rounded-xl
        bg-zinc-900/50 backdrop-blur-sm
        border-2 transition-all duration-200
        text-white placeholder-zinc-500
        focus:outline-none focus:ring-2 focus:ring-offset-0
        disabled:opacity-50 disabled:cursor-not-allowed
        resize-none
        ${
          error
            ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20'
            : success
            ? 'border-green-500/50 focus:border-green-500 focus:ring-green-500/20'
            : 'border-zinc-700/50 focus:border-brand-light-pink focus:ring-brand-light-pink/20'
        }
        ${className}
      `}
        {...props}
      />
    );
  }
);

// Optimized Select Component
interface OptimizedSelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
  success?: boolean;
}

export const OptimizedSelect = memo(
  function OptimizedSelect({
    error,
    success,
    className = '',
    children,
    ...props
  }: OptimizedSelectProps) {
    return (
      <select
        className={`
        w-full px-4 py-3 rounded-xl
        bg-zinc-900/50 backdrop-blur-sm
        border-2 transition-all duration-200
        text-white
        focus:outline-none focus:ring-2 focus:ring-offset-0
        disabled:opacity-50 disabled:cursor-not-allowed
        appearance-none cursor-pointer
        ${
          error
            ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20'
            : success
            ? 'border-green-500/50 focus:border-green-500 focus:ring-green-500/20'
            : 'border-zinc-700/50 focus:border-brand-light-pink focus:ring-brand-light-pink/20'
        }
        ${className}
      `}
        style={{
          backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
          backgroundPosition: 'right 0.5rem center',
          backgroundRepeat: 'no-repeat',
          backgroundSize: '1.5em 1.5em',
          paddingRight: '2.5rem',
        }}
        {...props}
      >
        {children}
      </select>
    );
  }
);
