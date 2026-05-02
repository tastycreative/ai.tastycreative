import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

const PUBLIC_ROUTES: RegExp[] = [
  /^\/$/,
  /^\/login(\/.*)?$/,
  /^\/register(\/.*)?$/,
  /^\/forgot-password(\/.*)?$/,
  /^\/about(\/.*)?$/,
  /^\/pricing(\/.*)?$/,
  /^\/test(\/.*)?$/,
  /^\/onboarding\/public(\/.*)?$/,
];

const AUTH_ROUTES: RegExp[] = [
  /^\/login(\/.*)?$/,
  /^\/register(\/.*)?$/,
  /^\/forgot-password(\/.*)?$/,
];

const PUBLIC_API_ROUTES: RegExp[] = [
  /^\/api\/auth(\/.*)?$/,
  /^\/api\/trpc\/hello(\/.*)?$/,
  /^\/api\/trpc\/getTodos(\/.*)?$/,
  /^\/api\/debug(\/.*)?$/,
  /^\/api\/test(\/.*)?$/,
  /^\/api\/diagnostic(\/.*)?$/,
  /^\/api\/webhooks(\/.*)?$/,
  /^\/api\/webhook(\/.*)?$/,
  /^\/api\/webhook-test(\/.*)?$/,
  /^\/api\/billing\/webhook$/,
  /^\/api\/models\/upload-from-training(\/.*)?$/,
  /^\/api\/training\/jobs(\/.*)?$/,
  /^\/api\/influencers\/training-complete(\/.*)?$/,
  /^\/api\/proxy(\/.*)?$/,
  /^\/api\/instagram(\/.*)?$/,
  /^\/api\/images\/s3(\/.*)?$/,
  /^\/api\/google-drive(\/.*)?$/,
  /^\/api\/auth\/google(\/.*)?$/,
  /^\/api\/feed(\/.*)?$/,
  /^\/api\/cron(\/.*)?$/,
  /^\/api\/sexting-sets(\/.*)?$/,
  /^\/api\/sexting-sets\/media(\/.*)?$/,
  /^\/api\/export\/platform-ready$/,
  /^\/api\/onboarding-invitations\/validate(\/.*)?$/,
  /^\/api\/onboarding-public(\/.*)?$/,
  /^\/api\/upload\/profile-image(\/.*)?$/,
  /^\/api\/spaces\/[^/]+\/webhook\/.+$/,
];

const CUSTOM_AUTH_API_ROUTES: RegExp[] = [
  /^\/api\/user\/influencers(\/.*)?$/,
  /^\/api\/sexting-sets(\/.*)?$/,
];

const TENANT_PROTECTED: RegExp = /^\/[^/]+\/.+/;

function matches(path: string, list: RegExp[]) {
  return list.some((re) => re.test(path));
}

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/api/")) {
    if (matches(pathname, PUBLIC_API_ROUTES)) return NextResponse.next();
    if (matches(pathname, CUSTOM_AUTH_API_ROUTES)) return NextResponse.next();
  }

  const sessionCookie = getSessionCookie(req);
  const isAuthed = !!sessionCookie;

  if (isAuthed && matches(pathname, AUTH_ROUTES)) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  if (isAuthed && pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  if (matches(pathname, PUBLIC_ROUTES)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    if (!isAuthed) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  if (TENANT_PROTECTED.test(pathname) && !isAuthed) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
