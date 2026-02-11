'use client';

import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { SubmissionForm } from '@/components/content-submission/SubmissionForm';
import { ClassicSubmissionForm } from '@/components/content-submission/ClassicSubmissionForm';
import { Button } from '@/components/ui/button';
import { Sparkles, Layers } from 'lucide-react';

export default function NewSubmissionPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const tenant = params.tenant as string;
  const mode = searchParams?.get('mode') || 'wizard';

  const handleModeToggle = () => {
    const newMode = mode === 'wizard' ? 'classic' : 'wizard';
    router.push(`/${tenant}/submissions/new?mode=${newMode}`);
  };

  const handleSuccess = (id: string) => {
    router.push(`/${tenant}/submissions`);
  };

  const handleCancel = () => {
    router.push(`/${tenant}/submissions`);
  };

  return (
    <div>
      {/* Mode Toggle Header */}
      <div className="sticky top-0 z-50 bg-[#0a0a0b]/80 backdrop-blur-xl border-b border-zinc-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-brand-light-pink to-brand-blue bg-clip-text text-transparent">
                New Content Submission
              </h1>
              <p className="text-sm text-zinc-400 mt-1">
                {mode === 'wizard' ? 'Step-by-step guided wizard' : 'All-in-one form view'}
              </p>
            </div>

            <Button
              onClick={handleModeToggle}
              variant="outline"
              className="flex items-center gap-2 border-zinc-700 hover:border-brand-light-pink hover:text-brand-light-pink transition-colors"
            >
              {mode === 'wizard' ? (
                <>
                  <Layers className="w-4 h-4" />
                  <span className="hidden sm:inline">Switch to Classic</span>
                  <span className="sm:hidden">Classic</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span className="hidden sm:inline">Switch to Wizard</span>
                  <span className="sm:hidden">Wizard</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Form */}
      {mode === 'wizard' ? (
        <SubmissionForm onSuccess={handleSuccess} onCancel={handleCancel} />
      ) : (
        <ClassicSubmissionForm onSuccess={handleSuccess} onCancel={handleCancel} />
      )}
    </div>
  );
}
