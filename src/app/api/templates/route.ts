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
    const { name, displayName, config, runTypeIds } = body;

    if (!name || !displayName || !config) {
      return NextResponse.json({ error: 'Missing name, displayName, or config' }, { status: 400 });
    }

    const template = await TemplateController.createTemplate({ name, displayName, config, runTypeIds });
    return NextResponse.json(template);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
