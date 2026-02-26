/**
 * Admin access is determined by the X-Admin-Access header.
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

const DEV_USER_INFO: UserInfo = {
  id: 1,
  email: 'dev@dev.com',
  name: 'dev',
  roles: ['enrgdaq-control', 'enrgdaq-control-superadmin'],
};

export async function checkAuthSession(
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

    const userInfo = (payload.user_info as UserInfo) || null;

    // If userInfo is null or has no enrgdaq-control role, reject unless in development
    if (
      !userInfo ||
      !Array.isArray(userInfo.roles) ||
      !userInfo.roles.includes('enrgdaq-control')
    ) {
      return { isAdmin: isDev, userInfo: isDev ? DEV_USER_INFO : null };
    }

    const isAdmin =
      Array.isArray(userInfo.roles) &&
      userInfo.roles.includes('enrgdaq-control-superadmin');

    return {
      isAdmin,
      userInfo,
    };
  } catch (error) {
    console.error('Failed to verify X-Admin-Access JWT:', error);
    // Invalid token: reject unless in development
    return { isAdmin: isDev, userInfo: isDev ? DEV_USER_INFO : null };
  }
}
