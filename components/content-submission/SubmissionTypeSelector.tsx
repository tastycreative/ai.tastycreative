'use client';

import { FileText, Calendar } from 'lucide-react';

interface SubmissionTypeSelectorProps {
  value: 'otp' | 'ptr';
  onChange: (value: 'otp' | 'ptr') => void;
}

export function SubmissionTypeSelector({ value, onChange }: SubmissionTypeSelectorProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {/* OTP Card */}
      <button
        type="button"
        onClick={() => onChange('otp')}
        className={`
          relative p-6 rounded-xl border-2 transition-all
          ${value === 'otp'
            ? 'border-brand-light-pink bg-brand-light-pink/10'
            : 'border-gray-200 dark:border-gray-700 hover:border-brand-light-pink/50'
          }
        `}
      >
        <div className="flex flex-col items-start space-y-3">
          <div className={`
            w-12 h-12 rounded-lg flex items-center justify-center
            ${value === 'otp' ? 'bg-brand-light-pink' : 'bg-gray-100 dark:bg-gray-800'}
          `}>
            <FileText className={`w-6 h-6 ${value === 'otp' ? 'text-white' : 'text-gray-600'}`} />
          </div>
          <div className="text-left">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              One-Time Post (OTP)
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Single post content for immediate publication
            </p>
          </div>
          <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
            <li>✓ Quick submission</li>
            <li>✓ Immediate publishing</li>
            <li>✓ Standard workflow</li>
          </ul>
        </div>
      </button>

      {/* PTR Card */}
      <button
        type="button"
        onClick={() => onChange('ptr')}
        className={`
          relative p-6 rounded-xl border-2 transition-all
          ${value === 'ptr'
            ? 'border-brand-light-pink bg-brand-light-pink/10'
            : 'border-gray-200 dark:border-gray-700 hover:border-brand-light-pink/50'
          }
        `}
      >
        <div className="flex flex-col items-start space-y-3">
          <div className={`
            w-12 h-12 rounded-lg flex items-center justify-center
            ${value === 'ptr' ? 'bg-brand-light-pink' : 'bg-gray-100 dark:bg-gray-800'}
          `}>
            <Calendar className={`w-6 h-6 ${value === 'ptr' ? 'text-white' : 'text-gray-600'}`} />
          </div>
          <div className="text-left">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Pay-to-Release (PTR)
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Premium content with scheduled release
            </p>
          </div>
          <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
            <li>✓ Scheduled release date</li>
            <li>✓ Minimum pricing</li>
            <li>✓ Premium positioning</li>
          </ul>
        </div>
      </button>
    </div>
  );
}
