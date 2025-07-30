# Architecture Overview

This project uses a modern Next.js 15 stack with the following technologies:

## Tech Stack

- **Next.js 15** - App Router with TypeScript
- **tRPC** - End-to-end typesafe APIs
- **TanStack Query** - Server state management with caching
- **Zustand** - Client state management with persistence
- **React Hook Form** - Forms with performance optimization
- **Zod** - Runtime type validation
- **Tailwind CSS** - Utility-first CSS framework with dark mode support
- **Theme System** - Light/Dark mode with system detection

## Folder Structure

```
├── app/
│   ├── (auth)/           # Auth routes (login, register, etc.)
│   ├── (dashboard)/      # Protected dashboard routes
│   ├── (marketing)/      # Public marketing pages
│   ├── api/
│   │   └── trpc/         # tRPC API routes
│   ├── layout.tsx        # Root layout with providers
│   └── providers.tsx     # tRPC + TanStack Query + Theme providers
├── components/
│   ├── examples/         # Demo components (tRPC, Zustand, Theme)
│   ├── forms/           # Form components with validation
│   ├── providers/       # Theme provider
│   └── ui/              # UI components (theme toggle)
├── lib/
│   ├── trpc.ts          # tRPC server setup
│   ├── trpc-client.ts   # tRPC client setup
│   └── validations/     # Zod schemas (auth, common)
├── server/
│   └── router.ts        # tRPC router definitions
└── stores/
    ├── auth-store.ts    # Authentication state with persistence
    └── ui-store.ts      # UI state (theme, sidebar) with persistence
```

## Key Features

### tRPC + TanStack Query
- Type-safe API calls from client to server
- Automatic caching and background refetching
- Optimistic updates and error handling
- Server-side procedures with input validation

### Zustand State Management
- Simple, lightweight state management
- Persistent storage for auth and UI state
- Separate stores for different concerns (auth, UI)
- Theme state management with system detection

### React Hook Form + Zod
- Performance-optimized forms
- Runtime validation with TypeScript inference
- Reusable validation schemas
- Form submission handling

### Theme System
- Light/Dark/System theme modes
- Automatic system preference detection
- Persistent theme storage
- CSS variable-based styling
- Smooth transitions between themes

## Usage Examples

### tRPC Query
```tsx
const { data, isLoading } = trpc.getTodos.useQuery();
```

### Zustand Store
```tsx
// Auth store
const { user, login, logout } = useAuthStore();

// UI store with theme
const { theme, toggleTheme, setTheme } = useUIStore();
```

### Form with Validation
```tsx
const form = useForm<LoginInput>({
  resolver: zodResolver(loginSchema),
});
```

### Theme Usage
```tsx
// Theme toggle component
import { ThemeToggle } from '@/components/ui/theme-toggle';

// Theme state
const { theme, resolvedTheme } = useUIStore();
```

## Getting Started

1. Install dependencies: `npm install`
2. Run development server: `npm run dev`
3. Visit http://localhost:3000 to see the demo

The homepage showcases all the integrated technologies working together, including:
- Live tRPC queries with TanStack Query caching
- Zustand state management examples
- React Hook Form with Zod validation
- Interactive theme system with light/dark/system modes

## Architecture Benefits

- **Type Safety**: End-to-end TypeScript with tRPC and Zod
- **Performance**: Optimized with TanStack Query caching and React Hook Form
- **User Experience**: Persistent themes, smooth transitions, system integration
- **Developer Experience**: Hot reload, type inference, and clear separation of concerns
- **Scalability**: Modular architecture with separate stores and validation schemas