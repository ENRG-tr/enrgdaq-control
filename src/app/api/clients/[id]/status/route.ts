import { NextResponse } from 'next/server';
import { ENRGDAQClient } from '@/lib/enrgdaq-client';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const status = await ENRGDAQClient.getStatus(id);
    return NextResponse.json(status);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
