import { NextResponse } from 'next/server';
import { pollingService } from '@/lib/polling-service';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // Using cached status from the polling service
    const status = pollingService.getStatus(id);

    if (!status) {
      return NextResponse.json(null);
    }

    return NextResponse.json(status);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
