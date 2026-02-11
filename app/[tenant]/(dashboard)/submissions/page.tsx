import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { FileText, Calendar, DollarSign, Upload, Sparkles, ArrowRight } from 'lucide-react';

export default async function SubmissionsPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const user = await currentUser();

  if (!user) {
    redirect('/sign-in');
  }

  const { tenant } = await params;

  return (
    <div className="min-h-screen bg-[#0a0a0b]">
      {/* Ambient background effects - matching gallery aesthetic */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-violet-600/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-fuchsia-600/5 rounded-full blur-[150px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-600/3 rounded-full blur-[200px]" />
      </div>

      <div className="relative z-10 max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header - matching gallery style */}
        <header className="mb-10">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/10">
                  <FileText className="w-6 h-6 text-violet-400" />
                </div>
                <h1 className="text-4xl sm:text-5xl font-light tracking-tight text-white">
                  Content Submissions
                </h1>
              </div>
              <p className="text-zinc-500 text-lg font-light max-w-xl">
                Manage your OTP and PTR content submissions
              </p>
            </div>
            <Link
              href={`/${tenant}/submissions/new`}
              className="group inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-brand-light-pink to-brand-dark-pink hover:from-brand-dark-pink hover:to-brand-light-pink text-white font-medium transition-all duration-300 shadow-lg shadow-brand-light-pink/20 hover:shadow-brand-light-pink/40 hover:scale-105"
            >
              <Sparkles className="w-5 h-5" />
              <span>New Submission</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </header>

        {/* Empty State Container */}
        <div className="relative">
          {/* Decorative background grid */}
          <div className="absolute inset-0 opacity-[0.02]" style={{
            backgroundImage: `
              linear-gradient(to right, #fff 1px, transparent 1px),
              linear-gradient(to bottom, #fff 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px'
          }} />

          {/* Main empty state card */}
          <div className="relative bg-zinc-900/40 backdrop-blur-xl border border-zinc-800/50 rounded-2xl p-12 sm:p-16 overflow-hidden">
            {/* Accent gradient overlay */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-brand-light-pink to-transparent opacity-60" />

            {/* Floating decorative elements */}
            <div className="absolute top-8 right-8 w-32 h-32 bg-violet-500/5 rounded-full blur-3xl" />
            <div className="absolute bottom-8 left-8 w-40 h-40 bg-fuchsia-500/5 rounded-full blur-3xl" />

            <div className="relative space-y-12">
              {/* Illustration Area */}
              <div className="flex justify-center">
                <div className="relative">
                  {/* Central icon with orbital rings */}
                  <div className="relative w-32 h-32 sm:w-40 sm:h-40">
                    {/* Outer ring */}
                    <div className="absolute inset-0 rounded-full border-2 border-dashed border-zinc-700/40 animate-[spin_20s_linear_infinite]" />

                    {/* Middle ring */}
                    <div className="absolute inset-4 rounded-full border border-zinc-700/30 animate-[spin_15s_linear_infinite_reverse]" />

                    {/* Inner glow */}
                    <div className="absolute inset-8 rounded-full bg-gradient-to-br from-brand-light-pink/20 to-brand-dark-pink/20 blur-xl" />

                    {/* Center icon */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="p-6 rounded-2xl bg-gradient-to-br from-zinc-800/80 to-zinc-900/80 border border-zinc-700/50 backdrop-blur-sm shadow-2xl">
                        <FileText className="w-12 h-12 text-brand-light-pink" strokeWidth={1.5} />
                      </div>
                    </div>

                    {/* Floating accent icons */}
                    <div className="absolute -top-4 -right-4 p-3 rounded-xl bg-violet-500/10 border border-violet-500/20 backdrop-blur-sm animate-float">
                      <Calendar className="w-5 h-5 text-violet-400" />
                    </div>
                    <div className="absolute -bottom-4 -left-4 p-3 rounded-xl bg-fuchsia-500/10 border border-fuchsia-500/20 backdrop-blur-sm animate-float [animation-delay:0.5s]">
                      <DollarSign className="w-5 h-5 text-fuchsia-400" />
                    </div>
                    <div className="absolute top-1/2 -right-8 p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 backdrop-blur-sm animate-float [animation-delay:1s]">
                      <Upload className="w-5 h-5 text-indigo-400" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="text-center space-y-6 max-w-2xl mx-auto">
                <div className="space-y-3">
                  <h2 className="text-3xl sm:text-4xl font-light text-white tracking-tight">
                    No submissions yet
                  </h2>
                  <p className="text-lg text-zinc-400 font-light leading-relaxed">
                    Start organizing your content workflow by creating your first submission
                  </p>
                </div>

                {/* Feature cards */}
                <div className="grid sm:grid-cols-2 gap-4 mt-8">
                  {/* OTP Card */}
                  <div className="group p-6 rounded-xl bg-zinc-800/30 border border-zinc-700/30 hover:border-brand-light-pink/30 transition-all duration-300 text-left">
                    <div className="flex items-start gap-4">
                      <div className="p-2.5 rounded-lg bg-gradient-to-br from-brand-light-pink/20 to-brand-dark-pink/20 border border-brand-light-pink/20 group-hover:scale-110 transition-transform duration-300">
                        <FileText className="w-5 h-5 text-brand-light-pink" />
                      </div>
                      <div className="flex-1 space-y-2">
                        <h3 className="text-white font-medium">OTP</h3>
                        <p className="text-sm text-zinc-500 leading-relaxed">
                          <span className="text-zinc-400">One-Time Post</span> – Create and schedule content for immediate publishing
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* PTR Card */}
                  <div className="group p-6 rounded-xl bg-zinc-800/30 border border-zinc-700/30 hover:border-violet-500/30 transition-all duration-300 text-left">
                    <div className="flex items-start gap-4">
                      <div className="p-2.5 rounded-lg bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/20 group-hover:scale-110 transition-transform duration-300">
                        <Calendar className="w-5 h-5 text-violet-400" />
                      </div>
                      <div className="flex-1 space-y-2">
                        <h3 className="text-white font-medium">PTR</h3>
                        <p className="text-sm text-zinc-500 leading-relaxed">
                          <span className="text-zinc-400">Pay-to-Release</span> – Schedule premium content with pricing and release dates
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* CTA */}
                <div className="pt-6">
                  <Link
                    href={`/${tenant}/submissions/new`}
                    className="group inline-flex items-center gap-3 px-8 py-4 rounded-xl bg-gradient-to-r from-brand-light-pink to-brand-dark-pink hover:from-brand-dark-pink hover:to-brand-light-pink text-white font-medium transition-all duration-300 shadow-lg shadow-brand-light-pink/20 hover:shadow-brand-light-pink/40 hover:scale-105"
                  >
                    <Sparkles className="w-5 h-5" />
                    <span className="text-lg">Create Your First Submission</span>
                    <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom feature highlights */}
          <div className="grid sm:grid-cols-3 gap-4 mt-8">
            <div className="p-5 rounded-xl bg-zinc-900/30 border border-zinc-800/40 backdrop-blur-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-2 h-2 rounded-full bg-brand-light-pink" />
                <h4 className="text-sm font-medium text-zinc-300">Smart Organization</h4>
              </div>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Track all submissions with content type, platform, and model associations
              </p>
            </div>

            <div className="p-5 rounded-xl bg-zinc-900/30 border border-zinc-800/40 backdrop-blur-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-2 h-2 rounded-full bg-violet-400" />
                <h4 className="text-sm font-medium text-zinc-300">File Management</h4>
              </div>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Upload and organize media files directly with drag-and-drop support
              </p>
            </div>

            <div className="p-5 rounded-xl bg-zinc-900/30 border border-zinc-800/40 backdrop-blur-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-2 h-2 rounded-full bg-fuchsia-400" />
                <h4 className="text-sm font-medium text-zinc-300">Release Scheduling</h4>
              </div>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Plan your content calendar with precise timing and pricing controls
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
