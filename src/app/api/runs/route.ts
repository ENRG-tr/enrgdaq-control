import { NextResponse } from 'next/server';
import { RunController } from '@/lib/runs';

export async function GET() {
  try {
    const runs = await RunController.getAllRuns();
    return NextResponse.json(runs);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST start new run
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { description, clientId, runTypeId } = body;

    if (!description || !clientId) {
      return NextResponse.json({ error: 'Missing description or clientId' }, { status: 400 });
    }

    const run = await RunController.startRun(description, clientId, runTypeId);
    return NextResponse.json(run);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
