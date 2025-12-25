import { auth } from "@/lib/auth";
import { NextResponse, NextRequest } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";

// Rate limit configurations by route type
const rateLimitConfigs = {
  login: { windowMs: 60 * 1000, maxRequests: 5 },      // 5 per minute for login
  api: { windowMs: 60 * 1000, maxRequests: 100 },      // 100 per minute for general API
  agent: { windowMs: 60 * 1000, maxRequests: 500 },    // 500 per minute for agent endpoints
};

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const pathname = req.nextUrl.pathname;
  const isAuthPage = pathname.startsWith("/login") || pathname.startsWith("/register");
  const isDashboard = pathname.startsWith("/dashboard");
  const isApiAuth = pathname.startsWith("/api/auth");
  const isApiRoute = pathname.startsWith("/api");
  const isLoginEndpoint = pathname === "/api/auth/signin" || pathname === "/api/auth/callback";

  // Apply rate limiting for API routes
  if (isApiRoute && !isApiAuth) {
    const config = isLoginEndpoint ? rateLimitConfigs.login : rateLimitConfigs.api;
    const result = checkRateLimit(req as unknown as NextRequest, config);

    if (result.limited) {
      const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000);
      return NextResponse.json(
        { error: "Too many requests, please try again later" },
        {
          status: 429,
          headers: {
            "Retry-After": retryAfter.toString(),
            "X-RateLimit-Limit": config.maxRequests.toString(),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": result.resetTime.toString(),
          },
        }
      );
    }
  }

  // Allow API auth routes
  if (isApiAuth) {
    return NextResponse.next();
  }

  // Redirect logged-in users away from auth pages
  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Protect dashboard routes
  if (!isLoggedIn && isDashboard) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
