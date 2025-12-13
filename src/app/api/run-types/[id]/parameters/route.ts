import { NextResponse } from 'next/server';
import { TemplateController } from '@/lib/templates';

// GET aggregated parameters for a run type (from associated templates)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idStr } = await params;
    const id = parseInt(idStr);
    const parameters =
      await TemplateController.getAggregatedParametersForRunType(id);
    return NextResponse.json(parameters);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST set a default value for a parameter on this run type
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idStr } = await params;
    const runTypeId = parseInt(idStr);
    const data = await request.json();

    if (!data.parameterId) {
      return NextResponse.json(
        { error: 'parameterId is required' },
        { status: 400 }
      );
    }

    if (data.defaultValue !== undefined && data.defaultValue !== null) {
      await TemplateController.setRunTypeParameterDefault(
        runTypeId,
        data.parameterId,
        data.defaultValue
      );
    } else {
      await TemplateController.removeRunTypeParameterDefault(
        runTypeId,
        data.parameterId
      );
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
