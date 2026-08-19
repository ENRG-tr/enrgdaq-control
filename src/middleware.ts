import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { checkAuthSession } from '@/lib/auth';

const adminPaths = [
  '/advanced',
  '/templates',
  '/run-types',
  '/webhooks',
  '/api/templates',
  '/api/run-types',
  '/api/webhooks',
];

export async function middleware(request: NextRequest) {
  const authSession = await checkAuthSession(request.headers);
  const { pathname } = request.nextUrl;

  if (!authSession.userInfo && !authSession.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const isAdminPath = adminPaths.some((path) => pathname.startsWith(path));

  if (isAdminPath && !authSession.isAdmin) {
    return NextResponse.json(
      { error: 'Forbidden: Admin access required' },
      { status: 403 },
    );
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
