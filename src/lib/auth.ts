/**
 * Role-based access control via the X-Admin-Access JWT header.
 *
 * Roles (derived from JWT user_info.roles):
 *   - 'admin'   : Full access (requires 'enrgdaq-control-superadmin' role)
 *   - 'user'    : Can view dashboard/messages and start/stop runs, send messages
 *   - 'visitor' : Read-only access to Run Dashboard and Messages (requires 'enrgdaq-control-visitor' role)
 */

import * as jose from 'jose';

export type UserRole = 'admin' | 'user' | 'visitor';

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
  role: UserRole;
  isAdmin: boolean;
  userInfo: UserInfo | null;
}

// --- Capability helpers ---

/** Can this role start/stop/delete runs? */
export function canControlRuns(role: UserRole): boolean {
  return role === 'admin' || role === 'user';
}

/** Can this role send messages? */
export function canSendMessages(role: UserRole): boolean {
  return role === 'admin' || role === 'user';
}

// --- Internal helpers ---

const DEV_USER_INFO: UserInfo = {
  id: 1,
  email: 'dev@dev.com',
  name: 'dev',
  roles: ['enrgdaq-control', 'enrgdaq-control-superadmin'],
};

function resolveRole(userInfo: UserInfo): UserRole {
  const roles = userInfo.roles;
  if (roles.includes('enrgdaq-control-superadmin')) return 'admin';
  if (roles.includes('enrgdaq-control-visitor')) return 'visitor';
  return 'user';
}

function makeSession(role: UserRole, userInfo: UserInfo | null): AuthSession {
  return { role, isAdmin: role === 'admin', userInfo };
}

export async function checkAuthSession(
  headers: HeaderLike,
): Promise<AuthSession> {
  const isDev = process.env.NODE_ENV === 'development';
  const token = headers.get('X-Admin-Access')?.trim();

  if (!token) {
    return makeSession(
      isDev ? 'admin' : 'visitor',
      isDev ? DEV_USER_INFO : null,
    );
  }

  try {
    const secret = new TextEncoder().encode(
      process.env.AUTH_JWT_SECRET_KEY || '',
    );
    const { payload } = await jose.jwtVerify(token, secret);

    const userInfo = (payload.user_info as UserInfo) || null;

    // If userInfo is null or has no enrgdaq-control base role, reject unless in development
    if (
      !userInfo ||
      !Array.isArray(userInfo.roles) ||
      (!userInfo.roles.includes('enrgdaq-control') &&
        !userInfo.roles.includes('enrgdaq-control-visitor'))
    ) {
      return makeSession(
        isDev ? 'admin' : 'visitor',
        isDev ? DEV_USER_INFO : null,
      );
    }

    return makeSession(resolveRole(userInfo), userInfo);
  } catch (error) {
    console.error('Failed to verify X-Admin-Access JWT:', error);
    // Invalid token: reject unless in development
    return makeSession(
      isDev ? 'admin' : 'visitor',
      isDev ? DEV_USER_INFO : null,
    );
  }
}
