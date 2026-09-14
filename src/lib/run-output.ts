import { readdir, realpath, stat } from 'node:fs/promises';
import path from 'node:path';

export interface RunOutputEntry {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size: number;
  modifiedAt: string;
}

const MAX_ENTRIES = 1000;

export function getRunOutputRoot(): string {
  return path.resolve(
    process.env.ENRGDAQ_OUT_DIR || path.join(process.cwd(), 'enrgdaq-out'),
  );
}

function isWithin(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function validateRelativePath(relativePath: string): void {
  if (relativePath.includes('\0') || path.isAbsolute(relativePath)) {
    throw new Error('Invalid output path');
  }
}

/** Resolve a path and ensure symlinks cannot escape the run output folder. */
export async function resolveRunOutputPath(
  runId: number,
  relativePath = '',
): Promise<{ runRoot: string; target: string }> {
  validateRelativePath(relativePath);

  const outputRoot = await realpath(getRunOutputRoot());
  const runRootCandidate = path.join(outputRoot, 'runs', String(runId));
  const runRoot = await realpath(runRootCandidate);

  if (!isWithin(outputRoot, runRoot)) {
    throw new Error('Invalid run output path');
  }

  const targetCandidate = path.resolve(runRoot, relativePath || '.');
  if (!isWithin(runRoot, targetCandidate)) {
    throw new Error('Invalid output path');
  }

  const target = await realpath(targetCandidate);
  if (!isWithin(runRoot, target)) {
    throw new Error('Invalid output path');
  }

  return { runRoot, target };
}

export function relativeOutputPath(runRoot: string, target: string): string {
  return path.relative(runRoot, target).split(path.sep).join('/');
}

export async function listRunOutput(
  runId: number,
  relativePath = '',
): Promise<{ path: string; entries: RunOutputEntry[]; truncated: boolean }> {
  const { runRoot, target } = await resolveRunOutputPath(runId, relativePath);
  const targetStats = await stat(target);

  if (!targetStats.isDirectory()) {
    throw new Error('Output path is not a directory');
  }

  const children = await readdir(target, { withFileTypes: true });
  const visibleChildren = children.filter((child) => !child.name.startsWith('.'));
  const entries: RunOutputEntry[] = [];

  for (const child of visibleChildren.slice(0, MAX_ENTRIES)) {

    const childTarget = await realpath(path.join(target, child.name));
    if (!isWithin(runRoot, childTarget)) continue;

    const childStats = await stat(childTarget);
    entries.push({
      name: child.name,
      path: relativeOutputPath(runRoot, childTarget),
      type: childStats.isDirectory() ? 'directory' : 'file',
      size: childStats.isFile() ? childStats.size : 0,
      modifiedAt: childStats.mtime.toISOString(),
    });
  }

  entries.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return {
    path: relativeOutputPath(runRoot, target),
    entries,
    truncated: visibleChildren.length > MAX_ENTRIES,
  };
}
