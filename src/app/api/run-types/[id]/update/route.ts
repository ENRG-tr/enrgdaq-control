import { NextResponse } from 'next/server';
import { TemplateController } from '@/lib/templates';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idStr } = await params;
    const id = parseInt(idStr);
    const data = await request.json();
    const updated = await TemplateController.updateRunType(id, data);
    if (!updated) {
      return NextResponse.json({ error: 'RunType not found' }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
