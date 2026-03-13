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

  const isAdminPath = adminPaths.includes(pathname);
  if (isAdminPath && !authSession.isAdmin) {
    return NextResponse.json(
      { error: 'Forbidden: Admin access required' },
      { status: 403 },
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api/auth/status|_next/static|_next/image|favicon.ico).*)'],
};
