import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { checkAuthSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const headersList = await headers();
  const authSession = await checkAuthSession(headersList);

  return NextResponse.json(authSession);
}
