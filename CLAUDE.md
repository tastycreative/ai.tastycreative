# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**CRITICAL: Always reference these guidelines when creating or updating UI components.**

---

## Commands

| Command | Description |
|---|---|
| `npm run dev` | Next.js dev server with Turbopack |
| `npm run build` | `prisma generate && next build` |
| `npm run lint` | ESLint |
| `npm run remotion:studio` | Launch Remotion Studio UI |
| `npm run remotion:render` | Render Remotion compositions |
| `npx prisma generate` | Regenerate Prisma client (after schema changes) |
| `npx prisma db push` | Push schema changes to database |

---

## Architecture

### Tech Stack

- **Framework**: Next.js (App Router) with React 19, TypeScript
- **Styling**: Tailwind CSS v4 (CSS-based config in `globals.css`, NO `tailwind.config.ts`)
- **Auth**: Clerk (`@clerk/nextjs` v6)
- **Database**: PostgreSQL via Neon (`@neondatabase/serverless`) + Prisma ORM
- **Data fetching**: TanStack Query (React Query) — all hooks in `lib/hooks/*.query.ts`
- **Client state**: Zustand (UI state in `stores/`, editor state in `stores/video-editor-store.ts`)
- **UI components**: shadcn/ui (Radix primitives, configured in `components.json`)
- **Video/GIF**: Remotion (`remotion/` compositions, `@remotion/player`)
- **Storage**: AWS S3 (CDN at `cdn.tastycreative.xyz`), Cloudinary for thumbnails
- **AI compute**: RunPod serverless (generation + training), SeeDream API, Kling API
- **Payments**: Stripe (subscriptions, credits, add-on slots)
- **tRPC**: Used only for training job procedures; REST API routes are the primary pattern
- **Email**: Resend with React Email templates
- **Path alias**: `@/` maps to project root

### Multi-Tenancy & Routing

Routes are structured as `app/[tenant]/(dashboard)/...` where `[tenant]` is either an **org slug** or **personal username**.

**Flow**: Clerk middleware protects `/:tenant/*` routes → `app/[tenant]/layout.tsx` verifies access via `/api/organizations/verify-slug` → redirects if unauthorized. The `/dashboard` page resolves the current org and redirects to `/${slug}/dashboard`.

**Key files**:
- `middleware.ts` — Clerk route protection; public API routes (webhooks, RunPod callbacks, cron, onboarding-public) bypass auth
- `app/[tenant]/layout.tsx` — client-side tenant guard
- `lib/organizationAuth.ts` — server-side org membership/role checks
- `lib/adminAuth.ts` — super-admin checks (`User.role === 'SUPER_ADMIN'`)

### Permission System

`lib/hooks/usePermissions.query.ts` defines 80+ feature flags fetched from `/api/features`. Permissions derive from `SubscriptionPlan.features` (JSON) merged with `CustomOrganizationPermission.permissions`.

- `lib/planFeatures.ts` — central `PLAN_FEATURES` array (key, label, category, type, defaultValue)
- `lib/permissions/routePermissions.ts` — maps URL paths to permission keys
- `components/PermissionGuard.tsx` — conditional UI rendering wrapper

### Database

- **Schema**: `prisma/schema.prisma`
- **Generated client**: `lib/generated/prisma/`
- **Singleton**: `lib/database.ts` — `globalForPrisma.prisma` with exponential-backoff retry wrapper
- Always call `ensureUserExists(clerkId)` before user-scoped DB operations

### Major Feature Areas

| Feature | Route | Key Components |
|---|---|---|
| AI Generation | `workspace/generate-content/*` | RunPod/SeeDream/Kling endpoints, SSE progress |
| GIF Maker | `gif-maker/` | Remotion player, Zustand editor store, canvas export |
| OF Models | `of-models/` | Model profiles, stats, assets |
| Spaces (Kanban) | `spaces/` | Workspaces, boards, columns, items with history/comments |
| Content Submissions | `submissions/` | Multi-step form, S3 uploads, space linking |
| Content Studio | `workspace/content-studio/*` | Calendar, feed posts, stories, reels, pipeline |
| Vault | `workspace/vault/` | Hierarchical folders, S3-backed media |
| LoRA Training | `workspace/train-lora/` | RunPod training, job tracking, model sharing |
| Billing | `billing/` | Stripe subscriptions, credits, add-on slots |
| Admin | `admin/*` | Super-admin panel (analytics, orgs, users, plans) |

### GIF Maker Specifics

- **Clip types**: `VideoClip | ImageClip` discriminated union via `type: "video" | "image"`
- **Collage system**: 12 `CollageLayout` presets (split, grid, PiP); clips use `slotIndex` for slot assignment
- **Store**: `stores/video-editor-store.ts` — full editor state (clips, overlays, transitions, playback, export)
- **Remotion**: `ClipEditor` composition renders multi-clip timelines; `VideoToGif` for simple conversions
- **Export**: `lib/gif-maker/gif-renderer.ts` — canvas-based capture for collage/mixed, fast video path for video-only

### API Routes

REST routes live in `app/api/`. Major groups: `billing/`, `organizations/`, `spaces/`, `content-submissions/`, `generate/`, `webhook/` (RunPod callbacks), `webhooks/` (Stripe), `models/`, `of-models/`, `vault/`, `captions/`, `feed/`, `admin/`.

Public API routes bypass Clerk: webhooks, RunPod callbacks, proxy routes, cron (protected by `CRON_SECRET`), onboarding-public.

---

## Data Fetching with TanStack Query

### Source of Truth

**Location**: [`lib/hooks/*.query.ts`](lib/hooks/)

This project uses **TanStack Query (React Query)** for all data fetching and state management.

### Correct Usage

Always create custom hooks in `lib/hooks/` with the `.query.ts` suffix:

```typescript
// lib/hooks/useBilling.query.ts
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@clerk/nextjs';

async function fetchData(): Promise<DataType> {
  const response = await fetch('/api/endpoint');
  if (!response.ok) {
    throw new Error('Failed to fetch data');
  }
  return response.json();
}

export function useData() {
  const { user } = useUser();

  return useQuery({
    queryKey: ['data', user?.id],
    queryFn: fetchData,
    enabled: !!user,
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
  });
}
```

**Using the hook in components**:

```tsx
import { useData } from '@/lib/hooks/useData.query';

function MyComponent() {
  const { data, isLoading, error, refetch } = useData();

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return <div>{data?.value}</div>;
}
```

### Wrong Usage

```tsx
// DON'T use useState + useEffect for API calls
const [data, setData] = useState(null);
const [loading, setLoading] = useState(true);

useEffect(() => {
  fetch('/api/endpoint')
    .then(res => res.json())
    .then(data => setData(data))
    .finally(() => setLoading(false));
}, []);
```

### Mutations

For data modifications (POST, PUT, DELETE):

```typescript
export function useUpdateData() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: PayloadType) => {
      const response = await fetch('/api/endpoint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error('Failed to update');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['data'] });
    },
  });
}
```

### Conditional Fetching

Use the `enabled` option to control when queries run:

```typescript
// Only fetch when tab is active
const { data } = useTransactions(activeTab === 'transactions');

// In the hook:
export function useTransactions(enabled: boolean = true) {
  return useQuery({
    queryKey: ['transactions'],
    queryFn: fetchTransactions,
    enabled: enabled && !!user,
  });
}
```

---

## Color System & Brand Colors

### Source of Truth

**Location**: [`lib/colors.ts`](lib/colors.ts) and [`app/globals.css`](app/globals.css) (lines 51-56)

```typescript
const brandColors = {
  'brand-light-pink': '#F774B9',  // Primary accent
  'brand-dark-pink': '#E1518E',   // Secondary accent
  'brand-mid-pink': '#EC67A1',    // Balanced pink
  'brand-blue': '#5DC3F8',        // Cool accent
  'brand-off-white': '#F8F8F8',   // Neutral background
};
```

### Correct Usage

```tsx
// Use Tailwind brand color classes
<div className="bg-brand-light-pink text-brand-blue border-brand-dark-pink">
<button className="hover:bg-brand-mid-pink text-brand-off-white">
```

### Wrong Usage

```tsx
// DON'T use arbitrary hex values
<div className="bg-[#F774B9]">
<button style={{ backgroundColor: '#E1518E' }}>
```

---

## Dark Mode Support

Always add dark mode variants using brand colors:

```tsx
<div className="bg-white dark:bg-brand-dark-pink/10">
<p className="text-gray-900 dark:text-brand-off-white">
<div className="border-gray-200 dark:border-brand-mid-pink/30">

// Interactive elements
<button className="bg-brand-light-pink hover:bg-brand-mid-pink dark:bg-brand-dark-pink dark:hover:bg-brand-mid-pink">

// Cards and surfaces
<div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-brand-mid-pink/20">
```

### Dark Mode Brand Color Usage

- **Backgrounds**: `brand-dark-pink/10` or `brand-dark-pink/5` for subtle brand presence
- **Accents**: `brand-light-pink`, `brand-mid-pink`, `brand-blue` for interactive elements
- **Text**: `brand-off-white` for primary text, `brand-light-pink` for highlights
- **Borders**: `brand-mid-pink/20` or `brand-mid-pink/30` for subtle definition
- **Gradients**: Combine brand colors with low opacity for ambient effects
