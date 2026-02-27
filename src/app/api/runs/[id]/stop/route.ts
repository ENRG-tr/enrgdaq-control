import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { RunController } from '@/lib/runs';
import { checkAuthSession, canControlRuns } from '@/lib/auth';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const headersList = await headers();
    const authSession = await checkAuthSession(headersList);
    if (!canControlRuns(authSession.role)) {
      return NextResponse.json(
        { error: 'Unauthorized: Insufficient privileges to stop runs' },
        { status: 403 },
      );
    }

    const { id } = await params;
    const body = await req.json();
    const { clientId } = body;

    if (!clientId) {
      return NextResponse.json({ error: 'Missing clientId' }, { status: 400 });
    }

    await RunController.stopRun(parseInt(id), clientId);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
