import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { webhooks } from '@/lib/schema';
import { checkAuthSession } from '@/lib/auth';
import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';

export async function GET() {
  try {
    const list = await db.select().from(webhooks).orderBy(webhooks.createdAt);
    return NextResponse.json(list);
  } catch (error) {
    console.error('Failed to fetch webhooks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch webhooks' },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const authSession = await checkAuthSession(headersList);
    if (!authSession.isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized: Admin access required' },
        { status: 403 },
      );
    }

    const body = await req.json();
    const {
      name,
      url,
      secret,
      triggerOnRun,
      triggerOnMessage,
      isActive,
      payloadTemplate,
    } = body;

    if (!name || !url) {
      return NextResponse.json(
        { error: 'Name and URL are required' },
        { status: 400 },
      );
    }

    const [newWebhook] = await db
      .insert(webhooks)
      .values({
        name,
        url,
        secret: secret || null,
        triggerOnRun: !!triggerOnRun,
        triggerOnMessage: !!triggerOnMessage,
        payloadTemplate: payloadTemplate || null,
        isActive: isActive !== undefined ? !!isActive : true,
      })
      .returning();

    return NextResponse.json(newWebhook);
  } catch (error) {
    console.error('Failed to create webhook:', error);
    return NextResponse.json(
      { error: 'Failed to create webhook' },
      { status: 500 },
    );
  }
}
