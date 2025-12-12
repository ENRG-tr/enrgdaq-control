import { NextResponse } from 'next/server';
import { TemplateController } from '@/lib/templates';

// PUT update run type
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);
    const data = await request.json();
    const updated = await TemplateController.updateRunType(id, data);
    if (!updated) {
        return NextResponse.json({ error: "RunType not found" }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE run type
export async function DELETE(
    request: Request,
    { params }: { params: { id: string } }
  ) {
    try {
      const id = parseInt(params.id);
      const success = await TemplateController.deleteRunType(id);
      if (!success) {
          return NextResponse.json({ error: "RunType not found" }, { status: 404 });
      }
      return NextResponse.json({ success: true });
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
  }
