import { NextResponse } from 'next/server';
import { MessageController } from '@/lib/messages';

// GET all message templates
export async function GET() {
  try {
    const data = await MessageController.getMessageTemplates();
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
