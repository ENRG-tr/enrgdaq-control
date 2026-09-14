import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { checkAuthSession, canControlRuns } from '@/lib/auth';
import { db } from '@/lib/db';
import { runs } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';
import {
  listRunOutput,
  resolveRunOutputPath,
} from '@/lib/run-output';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MIME_TYPES: Record<string, string> = {
  '.csv': 'text/csv; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.log': 'text/plain; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.root': 'application/octet-stream',
  '.gz': 'application/gzip',
  '.zst': 'application/zstd',
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unable to access run output';
}

function isMissingPath(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}

function parseRunId(id: string): number | null {
  const runId = Number(id);
  return Number.isSafeInteger(runId) && runId > 0 ? runId : null;
}

function contentDisposition(filename: string): string {
  const safeFilename = filename.replace(/[\r\n"]/g, '_');
  return `attachment; filename*=UTF-8''${encodeURIComponent(safeFilename)}`;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const headersList = await headers();
  const authSession = await checkAuthSession(headersList);
  if (!canControlRuns(authSession.role)) {
    return NextResponse.json(
      { error: 'Unauthorized: run output access requires an authenticated user' },
      { status: 403 },
    );
  }

  const runId = parseRunId((await params).id);
  if (!runId) {
    return NextResponse.json({ error: 'Invalid run ID' }, { status: 400 });
  }

  try {
    const [run] = await db
      .select({ id: runs.id })
      .from(runs)
      .where(and(eq(runs.id, runId), eq(runs.isDeleted, false)))
      .limit(1);

    if (!run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }

    const url = new URL(request.url);
    const relativePath = url.searchParams.get('path') || '';
    const shouldDownload = url.searchParams.get('download') === '1';

    if (!shouldDownload) {
      const output = await listRunOutput(runId, relativePath);
      return NextResponse.json({ runId, ...output });
    }

    const { target } = await resolveRunOutputPath(runId, relativePath);
    const fileStats = await stat(target);
    if (!fileStats.isFile()) {
      return NextResponse.json(
        { error: 'Only files can be downloaded' },
        { status: 400 },
      );
    }

    const filename = path.basename(target);
    const stream = Readable.toWeb(createReadStream(target)) as ReadableStream;
    return new NextResponse(stream, {
      headers: {
        'Content-Type':
          MIME_TYPES[path.extname(filename).toLowerCase()] ||
          'application/octet-stream',
        'Content-Length': String(fileStats.size),
        'Content-Disposition': contentDisposition(filename),
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    if (isMissingPath(error)) {
      return NextResponse.json(
        { error: 'Run output was not found' },
        { status: 404 },
      );
    }

    const message = errorMessage(error);
    if (message === 'Invalid output path' || message === 'Invalid run output path') {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    if (message === 'Output path is not a directory') {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    console.error(`[API /runs/${runId}/files] Error:`, error);
    return NextResponse.json(
      { error: 'Unable to access run output' },
      { status: 500 },
    );
  }
}
