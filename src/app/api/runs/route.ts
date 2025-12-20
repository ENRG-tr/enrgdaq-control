import { NextResponse } from 'next/server';
import { RunController } from '@/lib/runs';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;

    const data = await RunController.getAllRuns(limit, offset);
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST start new run
export async function POST(req: Request) {
  console.log('[API /runs POST] Received request');
  try {
    const body = await req.json();
    const {
      description,
      clientId,
      runTypeId,
      parameterValues,
      scheduledEndTime,
    } = body;
    console.log(
      `[API /runs POST] Starting run for client ${clientId}, runTypeId ${runTypeId}`
    );

    if (!description || !clientId) {
      return NextResponse.json(
        { error: 'Missing description or clientId' },
        { status: 400 }
      );
    }

    // Parse scheduledEndTime if provided
    const parsedScheduledEndTime = scheduledEndTime
      ? new Date(scheduledEndTime)
      : undefined;

    const run = await RunController.startRun(
      description,
      clientId,
      runTypeId,
      parameterValues,
      parsedScheduledEndTime
    );
    console.log(`[API /runs POST] Run started successfully: ${run.id}`);
    return NextResponse.json(run);
  } catch (e: any) {
    console.error('[API /runs POST] Error:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
