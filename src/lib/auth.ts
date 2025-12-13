export interface HeaderLike {
  get(name: string): string | null | undefined;
}

export function checkAdminAccess(headers: HeaderLike): boolean {
  return headers.get('X-Admin-Access')?.trim() === '1';
}
