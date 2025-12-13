import { NextResponse } from 'next/server';
import { MessageController } from '@/lib/messages';

// GET parameters for a template
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await MessageController.getTemplateParameters(parseInt(id));
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST create a new parameter for a template
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { name, displayName, type, defaultValue, required } = body;

    if (!name || !displayName) {
      return NextResponse.json(
        { error: 'Missing name or displayName' },
        { status: 400 }
      );
    }

    const param = await MessageController.createTemplateParameter(
      parseInt(id),
      {
        name,
        displayName,
        type,
        defaultValue,
        required,
      }
    );
    return NextResponse.json(param);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
