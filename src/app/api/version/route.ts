import { NextResponse } from 'next/server';
import { execSync } from 'child_process';

export const dynamic = 'force-dynamic';

function getCommitHash(): string {
  // Build-time injected hash takes precedence when available
  if (process.env.NEXT_PUBLIC_COMMIT_HASH) {
    return process.env.NEXT_PUBLIC_COMMIT_HASH;
  }
  try {
    return execSync('git rev-parse --short HEAD', {
      encoding: 'utf-8',
      timeout: 3000,
    }).trim();
  } catch {
    return 'unknown';
  }
}

export async function GET() {
  return NextResponse.json({ commitHash: getCommitHash() });
}
