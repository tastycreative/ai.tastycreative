'use client';

import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { Suspense, lazy, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Sparkles, Layers, Zap, Keyboard } from 'lucide-react';
import { SkeletonLoader } from '@/components/content-submission/SkeletonLoader';
import { useKeyboardShortcut } from '@/lib/hooks/useKeyboardShortcut';

// Lazy load forms for better performance
const SubmissionForm = lazy(() =>
  import('@/components/content-submission/SubmissionForm').then((mod) => ({
    default: mod.SubmissionForm,
  }))
);

const ClassicSubmissionForm = lazy(() =>
  import('@/components/content-submission/ClassicSubmissionForm').then(
    (mod) => ({
      default: mod.ClassicSubmissionForm,
    })
  )
);

export default function NewSubmissionPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const tenant = params.tenant as string;
  const mode = searchParams?.get('mode') || 'wizard';
  const [showShortcuts, setShowShortcuts] = useState(false);

  const handleModeToggle = useCallback(() => {
    const newMode = mode === 'wizard' ? 'classic' : 'wizard';
    router.push(`/${tenant}/submissions/new?mode=${newMode}`);
  }, [mode, router, tenant]);

  const handleSuccess = useCallback(
    (id: string) => {
      router.push(`/${tenant}/submissions`);
    },
    [router, tenant]
  );

  const handleCancel = useCallback(() => {
    router.push(`/${tenant}/submissions`);
  }, [router, tenant]);

  // Keyboard shortcuts
  useKeyboardShortcut({ key: 'm', ctrl: true }, handleModeToggle);
  useKeyboardShortcut(
    { key: '?', shift: true },
    () => setShowShortcuts(true)
  );
  useKeyboardShortcut({ key: 'Escape' }, () => setShowShortcuts(false));

  return (
    <div className="relative min-h-screen bg-[#0a0a0b]">
      {/* Sophisticated Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {/* Animated gradient orbs */}
        <motion.div
          className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-violet-600/5 rounded-full blur-[150px]"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        <motion.div
          className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-fuchsia-600/5 rounded-full blur-[150px]"
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 1,
          }}
        />
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-600/3 rounded-full blur-[200px]"
          animate={{
            rotate: [0, 360],
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: 'linear',
          }}
        />

        {/* Noise texture overlay */}
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          }}
        />
      </div>

      {/* Sticky Header with Glass Morphism */}
      <motion.div
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 100, damping: 20 }}
        className="sticky top-0 z-50 bg-[#0a0a0b]/80 backdrop-blur-xl border-b border-zinc-800/50"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            {/* Title Section */}
            <motion.div
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-brand-light-pink via-brand-mid-pink to-brand-blue bg-clip-text text-transparent">
                New Content Submission
              </h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-sm text-zinc-400 mt-1 flex items-center gap-2"
              >
                <Zap className="w-3.5 h-3.5 text-brand-blue" />
                {mode === 'wizard'
                  ? 'Step-by-step guided wizard'
                  : 'All-in-one form view'}
              </motion.p>
            </motion.div>

            {/* Action Buttons */}
            <motion.div
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="flex items-center gap-3"
            >
              {/* Keyboard Shortcuts Button */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowShortcuts(true)}
                className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-700/50 bg-zinc-900/50 text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors"
                title="Keyboard shortcuts"
              >
                <Keyboard className="w-4 h-4" />
              </motion.button>

              {/* Mode Toggle Button */}
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button
                  onClick={handleModeToggle}
                  variant="outline"
                  className="group relative flex items-center gap-2 border-zinc-700 hover:border-brand-light-pink transition-all overflow-hidden"
                >
                  {/* Animated background gradient */}
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-brand-light-pink/10 to-brand-blue/10 opacity-0 group-hover:opacity-100 transition-opacity"
                    animate={{
                      x: ['-100%', '100%'],
                    }}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      ease: 'linear',
                    }}
                  />

                  <span className="relative flex items-center gap-2">
                    {mode === 'wizard' ? (
                      <>
                        <Layers className="w-4 h-4" />
                        <span className="hidden sm:inline">
                          Switch to Classic
                        </span>
                        <span className="sm:hidden">Classic</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span className="hidden sm:inline">
                          Switch to Wizard
                        </span>
                        <span className="sm:hidden">Wizard</span>
                      </>
                    )}
                  </span>
                </Button>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* Form Content with Animated Transitions */}
      <div className="relative z-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={mode}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{
              type: 'spring',
              stiffness: 100,
              damping: 20,
            }}
          >
            <Suspense fallback={<SkeletonLoader />}>
              {mode === 'wizard' ? (
                <SubmissionForm
                  onSuccess={handleSuccess}
                  onCancel={handleCancel}
                />
              ) : (
                <ClassicSubmissionForm
                  onSuccess={handleSuccess}
                  onCancel={handleCancel}
                />
              )}
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Keyboard Shortcuts Modal */}
      <AnimatePresence>
        {showShortcuts && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => setShowShortcuts(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 max-w-md w-full shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Keyboard className="w-5 h-5 text-brand-light-pink" />
                  Keyboard Shortcuts
                </h3>
                <button
                  onClick={() => setShowShortcuts(false)}
                  className="text-zinc-400 hover:text-white transition-colors"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              <div className="space-y-3">
                <ShortcutItem
                  keys={['Ctrl', 'M']}
                  description="Toggle form mode"
                />
                <ShortcutItem
                  keys={['Shift', '?']}
                  description="Show shortcuts"
                />
                <ShortcutItem keys={['Esc']} description="Close modal" />
                <ShortcutItem
                  keys={['Ctrl', 'S']}
                  description="Save draft (auto-save)"
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Shortcut Item Component
function ShortcutItem({
  keys,
  description,
}: {
  keys: string[];
  description: string;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-zinc-400">{description}</span>
      <div className="flex items-center gap-1">
        {keys.map((key, index) => (
          <span key={index} className="flex items-center gap-1">
            <kbd className="px-2 py-1 text-xs font-mono bg-zinc-800 border border-zinc-700 rounded text-zinc-300">
              {key}
            </kbd>
            {index < keys.length - 1 && (
              <span className="text-zinc-600">+</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
