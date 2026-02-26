import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { webhooks } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { checkAuthSession } from '@/lib/auth';
import { headers } from 'next/headers';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const headersList = await headers();
    const authSession = await checkAuthSession(headersList);
    if (!authSession.isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized: Admin access required' },
        { status: 403 },
      );
    }

    const { id } = await params;

    const [deleted] = await db
      .delete(webhooks)
      .where(eq(webhooks.id, Number(id)))
      .returning();

    if (!deleted) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete webhook:', error);
    return NextResponse.json(
      { error: 'Failed to delete webhook' },
      { status: 500 },
    );
  }
}
