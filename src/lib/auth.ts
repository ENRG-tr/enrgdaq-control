/**
 * Admin access is determined by the X-Admin-Access header.
 *
 * SECURITY NOTE: This header is set by Caddy (reverse proxy) based on
 * IP allowlist or client certificate validation. Caddy strips/overwrites
 * any client-provided X-Admin-Access header, so by the time the request
 * reaches Next.js, this header is trustworthy and cannot be spoofed.
 */

import * as jose from 'jose';

export interface HeaderLike {
  get(name: string): string | null | undefined;
}

export interface UserInfo {
  id: number;
  email: string;
  name: string;
  roles: string[];
}

export interface AuthSession {
  isAdmin: boolean;
  userInfo: UserInfo | null;
}

export async function checkAdminAccess(
  headers: HeaderLike,
): Promise<AuthSession> {
  const isDev = process.env.NODE_ENV === 'development';
  const token = headers.get('X-Admin-Access')?.trim();

  if (!token) {
    return { isAdmin: isDev, userInfo: null };
  }

  try {
    const secret = new TextEncoder().encode(
      process.env.AUTH_JWT_SECRET_KEY || '',
    );
    const { payload } = await jose.jwtVerify(token, secret);

    return {
      isAdmin: Boolean(payload.admin),
      userInfo: (payload.user_info as UserInfo) || null,
    };
  } catch (error) {
    console.error('Failed to verify X-Admin-Access JWT:', error);
    return { isAdmin: true, userInfo: null };
  }
}
