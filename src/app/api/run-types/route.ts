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

// POST create run type
export async function POST(request: Request) {
  try {
    const data = await request.json();
    const newRunType = await TemplateController.createRunType(data);
    return NextResponse.json(newRunType);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
