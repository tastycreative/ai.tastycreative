# Creative Ink AI - Development Guidelines

**No Need to add another guidelines unless stated**

**CRITICAL: Always reference these guidelines when creating or updating UI components.**

---

## 📦 Data Fetching with TanStack Query

### Source of Truth

**Location**: [`lib/hooks/*.query.ts`](lib/hooks/)

This project uses **TanStack Query (React Query)** for all data fetching and state management.

### ✅ Correct Usage

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

### ❌ Wrong Usage

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
      // Invalidate and refetch related queries
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

## 🎨 Color System

## 🎨 Brand Colors

### Source of Truth

**Location**: [`lib/colors.ts`](lib/colors.ts)

```typescript
const brandColors = {
  'brand-light-pink': '#F774B9',  // Primary accent - vibrant and energetic
  'brand-dark-pink': '#E1518E',   // Secondary accent - deeper and more intense
  'brand-mid-pink': '#EC67A1',    // Balanced pink tone - versatile
  'brand-blue': '#5DC3F8',        // Cool accent - fresh and modern
  'brand-off-white': '#F8F8F8',   // Neutral background - soft and clean
};
```

### Tailwind Configuration

**Location**: [`app/globals.css`](app/globals.css) (lines 46-51)

This project uses **Tailwind CSS v4** with CSS-based configuration (NO `tailwind.config.ts`).

---

## ✅ Correct Usage

```tsx
// Use Tailwind brand color classes
<div className="bg-brand-light-pink text-brand-blue border-brand-dark-pink">
<button className="hover:bg-brand-mid-pink text-brand-off-white">
<span className="bg-brand-blue">
```

## ❌ Wrong Usage

```tsx
// DON'T use arbitrary hex values
<div className="bg-[#F774B9]">
<button style={{ backgroundColor: '#E1518E' }}>
```

---

## 🌓 Dark Mode Support

Always add dark mode variants using brand colors:

```tsx
// Use brand colors for dark backgrounds
<div className="bg-white dark:bg-brand-dark-pink/10">
<p className="text-gray-900 dark:text-brand-off-white">
<div className="border-gray-200 dark:border-brand-mid-pink/30">

// Brand color accents in dark mode
<button className="bg-brand-light-pink hover:bg-brand-mid-pink dark:bg-brand-dark-pink dark:hover:bg-brand-mid-pink">
<span className="text-brand-blue dark:text-brand-light-pink">

// Gradient overlays with brand colors
<div className="bg-gradient-to-r from-brand-light-pink/10 via-brand-blue/10 to-brand-dark-pink/10
                dark:from-brand-dark-pink/5 dark:via-brand-blue/5 dark:to-brand-mid-pink/5">

// Cards and surfaces
<div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-brand-mid-pink/20">
<div className="bg-gray-50 dark:bg-brand-dark-pink/5">
```

### Dark Mode Brand Color Usage

- **Backgrounds**: Use `brand-dark-pink/10` or `brand-dark-pink/5` for subtle brand presence
- **Accents**: Use `brand-light-pink`, `brand-mid-pink`, `brand-blue` for interactive elements
- **Text**: Use `brand-off-white` for primary text, `brand-light-pink` for highlights
- **Borders**: Use `brand-mid-pink/20` or `brand-mid-pink/30` for subtle definition
- **Gradients**: Combine brand colors with low opacity for ambient effects

---