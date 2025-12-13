/**
 * Admin access is determined by the X-Admin-Access header.
 *
 * SECURITY NOTE: This header is set by Caddy (reverse proxy) based on
 * IP allowlist or client certificate validation. Caddy strips/overwrites
 * any client-provided X-Admin-Access header, so by the time the request
 * reaches Next.js, this header is trustworthy and cannot be spoofed.
 */

export interface HeaderLike {
  get(name: string): string | null | undefined;
}

export function checkAdminAccess(headers: HeaderLike): boolean {
  return headers.get('X-Admin-Access')?.trim() === '1';
}
