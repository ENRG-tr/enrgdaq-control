import { NextResponse } from 'next/server';
import { RunController } from '@/lib/runs';

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
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
