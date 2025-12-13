import { NextResponse } from 'next/server';
import { ENRGDAQClient } from '@/lib/enrgdaq-client';

// GET message schemas from ENRGDAQ API
export async function GET() {
  try {
    const data = await ENRGDAQClient.getMessageSchemas();
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
