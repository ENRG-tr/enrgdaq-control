import { NextResponse } from 'next/server';
import { TemplateController } from '@/lib/templates';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const {
      displayName,
      config,
      type,
      runTypeIds,
      messageType,
      payloadTemplate,
      targetDaqJobType,
    } = body;

    const template = await TemplateController.updateTemplate(parseInt(id), {
      displayName,
      config,
      type,
      runTypeIds,
      messageType,
      payloadTemplate,
      targetDaqJobType,
    });
    if (!template) {
      return NextResponse.json(
        { error: 'Template not found or not editable' },
        { status: 404 }
      );
    }
    return NextResponse.json(template);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
