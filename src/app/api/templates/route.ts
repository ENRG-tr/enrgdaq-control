import { NextResponse } from 'next/server';
import { TemplateController } from '@/lib/templates';

// GET all templates
export async function GET() {
  try {
    const templates = await TemplateController.getAllTemplates();
    return NextResponse.json(templates);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST create new template
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      name,
      displayName,
      config,
      type,
      runTypeIds,
      messageType,
      payloadTemplate,
      targetDaqJobType,
    } = body;

    // For message templates, config is optional (we use payloadTemplate instead)
    if (!name || !displayName) {
      return NextResponse.json(
        { error: 'Missing name or displayName' },
        { status: 400 }
      );
    }

    // For non-message templates, config is required
    if (type !== 'message' && !config) {
      return NextResponse.json(
        { error: 'Missing config for non-message template' },
        { status: 400 }
      );
    }

    // For message templates, messageType and payloadTemplate are required
    if (type === 'message' && (!messageType || !payloadTemplate)) {
      return NextResponse.json(
        {
          error: 'Missing messageType or payloadTemplate for message template',
        },
        { status: 400 }
      );
    }

    const template = await TemplateController.createTemplate({
      name,
      displayName,
      config: config || '', // Empty config for message templates
      type,
      runTypeIds,
      messageType,
      payloadTemplate,
      targetDaqJobType,
    });
    return NextResponse.json(template);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
