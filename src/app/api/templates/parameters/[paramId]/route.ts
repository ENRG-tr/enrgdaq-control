import { NextResponse } from 'next/server';
import { MessageController } from '@/lib/messages';

// DELETE a template parameter
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ paramId: string }> }
) {
  try {
    const { paramId } = await params;
    await MessageController.deleteTemplateParameter(parseInt(paramId));
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// UPDATE a template parameter
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ paramId: string }> }
) {
  try {
    const { paramId } = await params;
    const body = await req.json();
    const updated = await MessageController.updateTemplateParameter(
      parseInt(paramId),
      body
    );
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
