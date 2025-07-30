import { TRPCExample } from '@/components/examples/trpc-example';
import { ZustandExample } from '@/components/examples/zustand-example';
import { LoginForm } from '@/components/forms/login-form';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900">
            Architecture Demo
          </h1>
          <p className="mt-4 text-xl text-gray-600">
            tRPC + TanStack Query + Zustand + React Hook Form + Zod
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div>
            <h2 className="text-2xl font-semibold mb-4">Login Form</h2>
            <p className="text-gray-600 mb-4">React Hook Form + Zod validation</p>
            <LoginForm />
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-4">tRPC + TanStack Query</h2>
            <p className="text-gray-600 mb-4">Type-safe API calls with caching</p>
            <TRPCExample />
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-4">Zustand State</h2>
            <p className="text-gray-600 mb-4">Client-side state management</p>
            <ZustandExample />
          </div>
        </div>
      </div>
    </div>
  );
}
