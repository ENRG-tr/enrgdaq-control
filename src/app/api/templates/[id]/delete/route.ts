import { NextResponse } from 'next/server';
import { TemplateController } from '@/lib/templates';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const success = await TemplateController.deleteTemplate(parseInt(id));
    if (!success) {
      return NextResponse.json(
        { error: 'Template not found or not editable' },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
