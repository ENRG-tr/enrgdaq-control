import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { runMetadata } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { checkAuthSession } from '@/lib/auth';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const runId = parseInt(id, 10);

    let [metadata] = await db
      .select()
      .from(runMetadata)
      .where(eq(runMetadata.runId, runId));

    if (!metadata) {
      return NextResponse.json(null);
    }
    return NextResponse.json(metadata);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const runId = parseInt(id, 10);
    const body = await req.json();
    const { details } = body;

    const headersList = await headers();
    const authSession = await checkAuthSession(headersList);

    if (!authSession.isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized: Admin access required' },
        { status: 403 },
      );
    }

    const updatedBy =
      authSession?.userInfo?.name ||
      authSession?.userInfo?.email ||
      'Unknown User';

    let [existing] = await db
      .select()
      .from(runMetadata)
      .where(eq(runMetadata.runId, runId));

    if (existing) {
      [existing] = await db
        .update(runMetadata)
        .set({
          details,
          updatedBy,
          updatedAt: new Date(),
        })
        .where(eq(runMetadata.runId, runId))
        .returning();
    } else {
      [existing] = await db
        .insert(runMetadata)
        .values({
          runId,
          details,
          updatedBy,
          updatedAt: new Date(),
        })
        .returning();
    }

    return NextResponse.json(existing);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
