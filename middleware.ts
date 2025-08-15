import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/settings(.*)',
  '/billing(.*)',
  '/team(.*)',
  '/workspace(.*)',
  '/api/generate(.*)',
  '/api/jobs(.*)',
  '/api/models(.*)',
  '/api/user(.*)',
]);

const isPublicRoute = createRouteMatcher([
  '/',
  '/login(.*)',
  '/register(.*)',
  '/forgot-password(.*)',
  '/about(.*)',
  '/pricing(.*)',
  '/demo(.*)',
]);

const isAuthRoute = createRouteMatcher([
  '/login(.*)',
  '/register(.*)',
  '/forgot-password(.*)',
]);

const isPublicApiRoute = createRouteMatcher([
  '/api/trpc/hello(.*)',
  '/api/trpc/getTodos(.*)',
  '/api/webhooks(.*)',  // Allow webhooks to be called without authentication
  '/api/user/influencers/upload-url(.*)',  // Allow Vercel Blob upload URL generation
  '/api/user/influencers/server-upload(.*)',  // Allow server-side upload
  '/api/user/influencers/blob-complete(.*)',  // Allow blob completion processing
  '/api/user/influencers/direct-upload(.*)',  // Allow direct upload bypassing blob storage
  '/api/debug(.*)',  // Allow debug endpoints
]);

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth();
  
  // If user is logged in and trying to access auth routes, redirect to dashboard
  if (userId && isAuthRoute(req)) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }
  
  // If user is logged in and accessing homepage, redirect to dashboard
  if (userId && req.nextUrl.pathname === '/') {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }
  
  // Allow public routes for non-authenticated users
  if (isPublicRoute(req)) {
    return;
  }
  
  // Protect all routes starting with `/dashboard`, `/settings`, etc.
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
  
  // Protect API routes except public ones; allow API key for specific endpoints
  if (req.nextUrl.pathname.startsWith('/api/') && !isPublicApiRoute(req)) {
    // Allow training streaming uploads with API key (external RunPod)
    if (req.nextUrl.pathname.startsWith('/api/models/upload-streaming')) {
      const key = req.headers.get('x-api-key');
      const expected = process.env.TRAINING_UPLOAD_KEY;
      if (expected && key === expected) {
        return; // bypass Clerk auth
      }
    }
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