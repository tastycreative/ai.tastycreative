import { TRPCExample } from '@/components/examples/trpc-example';
import { ZustandExample } from '@/components/examples/zustand-example';
import { LoginForm } from '@/components/forms/login-form';
import { ThemeToggle, ThemeSelector } from '@/components/ui/theme-toggle';
import { ThemeDemo } from '@/components/examples/theme-demo';
import { AuthExample } from '@/components/examples/auth-example';
import { AuthButtons } from '@/components/auth/auth-buttons';

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-8">
          <div className="text-center flex-1">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100">
              Architecture Demo
            </h1>
            <p className="mt-4 text-xl text-gray-600 dark:text-gray-400">
              tRPC + TanStack Query + Zustand + React Hook Form + Zod + Clerk Auth
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <ThemeToggle />
            <AuthButtons />
          </div>
        </div>
        
        <div className="mb-8">
          <ThemeSelector />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
          <div>
            <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Login Form</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">React Hook Form + Zod validation</p>
            <LoginForm />
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-100">tRPC + TanStack Query</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">Type-safe API calls with caching</p>
            <TRPCExample />
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Zustand State</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">Client-side state management</p>
            <ZustandExample />
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Theme System</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">Light/Dark mode with system detection</p>
            <ThemeDemo />
          </div>

          <div className="lg:col-span-2">
            <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Authentication</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">Clerk auth with protected tRPC procedures</p>
            <AuthExample />
          </div>
        </div>
      </div>
    </div>
  );
}