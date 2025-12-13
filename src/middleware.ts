import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const hasAuth = request.headers.get('X-Admin-Access') === '1';

  if (!hasAuth) {
    const { pathname } = request.nextUrl;

    // 1. Block API routes for modification (POST, PUT, DELETE, etc.)
    // Allow GET requests so that Dashboard can list types/templates
    if (pathname.startsWith('/api/')) {
      if (request.method !== 'GET') {
        return NextResponse.json(
          { error: 'Unauthorized: Missing or invalid X-Admin-Access header' },
          { status: 403 }
        );
      }
      // Allow GET even without auth
      return NextResponse.next();
    }

    // 2. Block Page routes completely (redirect to home)
    // This covers /advanced, /templates, /run-types based on config matcher
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/advanced/:path*',
    '/templates/:path*',
    '/run-types/:path*',
    '/api/templates/:path*',
    '/api/run-types/:path*',
  ],
};
