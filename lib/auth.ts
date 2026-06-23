import { NextRequest } from 'next/server';
import { getSession, Role } from './session';

export function getAuthenticatedUserId(req: NextRequest): string | null {
  return getSession(req)?.userId ?? null;
}

export function getRole(req: NextRequest): Role | null {
  return getSession(req)?.role ?? null;
}

export function requireRole(req: NextRequest, role: Role): boolean {
  return getRole(req) === role;
}
