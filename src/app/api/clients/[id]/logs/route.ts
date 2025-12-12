import { NextResponse } from 'next/server';
import { pollingService } from '@/lib/polling-service';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // Using cached logs from the polling service
    const logs = pollingService.getLogs(id);
    return NextResponse.json({ logs });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
