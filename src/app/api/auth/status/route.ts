import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { checkAdminAccess } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const headersList = await headers();
  const authSession = await checkAdminAccess(headersList);

  return NextResponse.json(authSession);
}
