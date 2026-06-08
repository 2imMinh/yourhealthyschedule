// src/middleware.ts
// Protects the (app) routes; leaves marketing, auth, and webhooks public.
// Webhooks MUST stay public (they're machine-to-machine, signature-verified).

import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/tasks(.*)",
  "/calendar(.*)",
  "/analytics(.*)",
  "/settings(.*)",
  "/api/((?!webhooks).*)", // protect API except /api/webhooks/*
]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next internals and static files; always run on API routes.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
