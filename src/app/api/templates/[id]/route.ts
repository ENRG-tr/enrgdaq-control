import { NextResponse } from 'next/server';
import { TemplateController } from '@/lib/templates';

// PUT update template
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { displayName, config } = body;

    const template = await TemplateController.updateTemplate(parseInt(id), { displayName, config });
    if (!template) {
      return NextResponse.json({ error: 'Template not found or not editable' }, { status: 404 });
    }
    return NextResponse.json(template);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE template
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const success = await TemplateController.deleteTemplate(parseInt(id));
    if (!success) {
      return NextResponse.json({ error: 'Template not found or not editable' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
