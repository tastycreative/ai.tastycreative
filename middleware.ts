import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/settings(.*)',
  '/billing(.*)',
  '/team(.*)',
  '/workspace(.*)',
  // Removed '/api/webhooks(.*)' - webhooks need to be public for external services
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
  '/api/debug(.*)',
  '/api/test(.*)',
  '/api/diagnostic(.*)', // ✅ Add diagnostic routes as public
  '/api/webhooks(.*)',  // ✅ Add webhooks as public API routes
  '/api/webhook(.*)', // ✅ Add singular webhook routes (fps-boost, flux-kontext, etc.)
  '/api/webhook-test(.*)', // ✅ Also add your test webhook
  '/api/models/upload-from-training(.*)', // ✅ Add training upload endpoint
  '/api/training/jobs(.*)', // ✅ Add training jobs endpoint for RunPod handler
  '/api/influencers/training-complete(.*)', // ✅ Add training complete endpoint for RunPod handler
  '/api/proxy(.*)', // ✅ Add proxy routes as public (needed for image loading)
  '/api/instagram(.*)', // ✅ Add Instagram API routes as public
  '/api/images/s3(.*)', // ✅ Add S3 image proxy as public for browser image loading
  '/api/google-drive(.*)', // ✅ Add Google Drive API routes as public
  '/api/auth/google(.*)', // ✅ Add Google OAuth routes as public (needed for authentication flow)
]);

// ✅ Special handling for API routes that need custom auth
const isCustomAuthApiRoute = createRouteMatcher([
  '/api/user/influencers(.*)', // These routes handle their own authentication
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
  
  // Handle API routes
  if (req.nextUrl.pathname.startsWith('/api/')) {
    // Skip middleware auth for routes that handle their own authentication
    if (isCustomAuthApiRoute(req)) {
      return; // Let the route handle authentication internally
    }
    
    // Skip middleware auth for truly public API routes (including webhooks)
    if (isPublicApiRoute(req)) {
      return;
    }
    
    // For other API routes, check auth but don't call protect() to avoid method issues
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
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