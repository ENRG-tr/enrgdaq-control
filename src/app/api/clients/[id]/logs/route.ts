import { NextResponse } from 'next/server';
import { pollingService } from '@/lib/polling-service';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const url = new Request(request.url).url;
    const urlObj = new URL(url);
    const limitParam = urlObj.searchParams.get('limit');

    // Using cached logs from the polling service
    const allLogs = pollingService.getLogs(id);

    let logs = allLogs;
    if (limitParam) {
      const limit = parseInt(limitParam, 10);
      if (!isNaN(limit) && limit > 0) {
        // Return only the most recent 'limit' logs
        logs = allLogs.slice(Math.max(0, allLogs.length - limit));
      }
    }

    return NextResponse.json({ logs });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
