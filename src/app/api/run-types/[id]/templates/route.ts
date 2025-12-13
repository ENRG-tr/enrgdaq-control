import { NextResponse } from 'next/server';
import { TemplateController } from '@/lib/templates';

// POST update templates associated with a run type
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { templateIds } = body;

    if (!Array.isArray(templateIds)) {
      return NextResponse.json(
        { error: 'templateIds must be an array' },
        { status: 400 }
      );
    }

    await TemplateController.updateRunTypeTemplates(
      parseInt(id),
      templateIds.map((id: number | string) => parseInt(String(id)))
    );

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
