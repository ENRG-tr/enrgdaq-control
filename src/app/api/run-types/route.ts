import { NextResponse } from 'next/server';
import { TemplateController } from '@/lib/templates';

// GET all run types
export async function GET() {
  try {
    const runTypes = await TemplateController.getAllRunTypes();
    return NextResponse.json(runTypes);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
