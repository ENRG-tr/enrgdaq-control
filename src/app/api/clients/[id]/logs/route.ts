import { NextResponse } from 'next/server';
import { ENRGDAQClient } from '@/lib/enrgdaq-client';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const logs = await ENRGDAQClient.getLogs(id);
    return NextResponse.json({ logs });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
