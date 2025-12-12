import { NextResponse } from 'next/server';
import { TemplateController } from '@/lib/templates';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idStr } = await params;
    const id = parseInt(idStr);
    const success = await TemplateController.deleteRunType(id);
    if (!success) {
      return NextResponse.json({ error: 'RunType not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
