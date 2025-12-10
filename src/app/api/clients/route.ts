import { NextResponse } from 'next/server';
import { ENRGDAQClient } from '@/lib/enrgdaq-client';

export async function GET() {
  try {
    const clients = await ENRGDAQClient.getClients();
    return NextResponse.json(clients);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
