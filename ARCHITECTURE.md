# Architecture Overview

This project uses a modern Next.js 15 stack with the following technologies:

## Tech Stack

- **Next.js 15** - App Router with TypeScript
- **tRPC** - End-to-end typesafe APIs
- **TanStack Query** - Server state management with caching
- **Zustand** - Client state management
- **React Hook Form** - Forms with performance optimization
- **Zod** - Runtime type validation
- **Tailwind CSS** - Utility-first CSS framework

## Folder Structure

```
├── app/
│   ├── (auth)/           # Auth routes (login, register, etc.)
│   ├── (dashboard)/      # Protected dashboard routes
│   ├── (marketing)/      # Public marketing pages
│   ├── api/
│   │   └── trpc/         # tRPC API routes
│   ├── layout.tsx        # Root layout with providers
│   └── providers.tsx     # tRPC + TanStack Query providers
├── components/
│   ├── examples/         # Demo components
│   └── forms/           # Form components
├── lib/
│   ├── trpc.ts          # tRPC server setup
│   ├── trpc-client.ts   # tRPC client setup
│   └── validations/     # Zod schemas
├── server/
│   └── router.ts        # tRPC router definitions
└── stores/
    ├── auth-store.ts    # Authentication state
    └── ui-store.ts      # UI state
```

## Key Features

### tRPC + TanStack Query
- Type-safe API calls from client to server
- Automatic caching and background refetching
- Optimistic updates and error handling
- Server-side procedures with input validation

### Zustand State Management
- Simple, lightweight state management
- Persistent storage for auth state
- Separate stores for different concerns

### React Hook Form + Zod
- Performance-optimized forms
- Runtime validation with TypeScript inference
- Reusable validation schemas
- Form submission handling

## Usage Examples

### tRPC Query
```tsx
const { data, isLoading } = trpc.getTodos.useQuery();
```

### Zustand Store
```tsx
const { user, login, logout } = useAuthStore();
```

### Form with Validation
```tsx
const form = useForm<LoginInput>({
  resolver: zodResolver(loginSchema),
});
```

## Getting Started

1. Install dependencies: `npm install`
2. Run development server: `npm run dev`
3. Visit http://localhost:3000 to see the demo

The homepage showcases all the integrated technologies working together.