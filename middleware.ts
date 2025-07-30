import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/settings(.*)',
  '/billing(.*)',
  '/team(.*)',
  '/api/webhooks(.*)',
]);

const isPublicApiRoute = createRouteMatcher([
  '/api/trpc/hello(.*)',
  '/api/trpc/getTodos(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  // Protect all routes starting with `/dashboard`, `/settings`, etc.
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
  
  // Protect API routes except public ones
  if (req.nextUrl.pathname.startsWith('/api/') && !isPublicApiRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};