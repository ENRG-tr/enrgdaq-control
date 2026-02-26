import { NextResponse } from 'next/server';
import { RunController } from '@/lib/runs';
import { checkAuthSession } from '@/lib/auth';
import { headers } from 'next/headers';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const headersList = await headers();
    const authSession = await checkAuthSession(headersList);
    if (!authSession.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const runId = parseInt((await params).id);
    if (isNaN(runId)) {
      return NextResponse.json({ error: 'Invalid run ID' }, { status: 400 });
    }
    await RunController.deleteRun(runId);
    return NextResponse.json({ message: 'Run deleted successfully' });
  } catch (e: any) {
    console.error('[API /runs/[id] DELETE] Error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
