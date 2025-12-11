import { NextResponse } from 'next/server';
import { ENRGDAQClient } from '@/lib/enrgdaq-client';

export async function GET() {
  try {
    const schemas = await ENRGDAQClient.getDAQJobSchemas();
    return NextResponse.json(schemas);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
