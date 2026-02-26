import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { checkAuthSession } from '@/lib/auth';

export async function middleware(request: NextRequest) {
  const authSession = await checkAuthSession(request.headers);

  if (!authSession.isAdmin && !authSession.userInfo) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
