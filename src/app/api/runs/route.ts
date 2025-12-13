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
  try {
    const body = await req.json();
    const { description, clientId, runTypeId, parameterValues } = body;

    if (!description || !clientId) {
      return NextResponse.json(
        { error: 'Missing description or clientId' },
        { status: 400 }
      );
    }

    const run = await RunController.startRun(
      description,
      clientId,
      runTypeId,
      parameterValues
    );
    return NextResponse.json(run);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
