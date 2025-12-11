import { NextResponse } from 'next/server';
import { ENRGDAQClient } from '@/lib/enrgdaq-client';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { daq_job_name } = body;
    await ENRGDAQClient.stopJob(id, daq_job_name);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
