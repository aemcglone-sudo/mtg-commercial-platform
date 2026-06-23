import { NextRequest } from 'next/server';

export const FIXED_USER_ID = 'passcode-user-001';
export const FIXED_SHOP_OWNER_ID = 'passcode-shop-001';

export async function getAuthenticatedUserId(req: NextRequest): Promise<string | null> {
  const token = req.cookies.get('auth_token')?.value;
  if (token === 'enthusiast' || token === 'authenticated') return FIXED_USER_ID;
  if (token === 'shop_owner') return FIXED_SHOP_OWNER_ID;
  return null;
}

export function getRole(req: NextRequest): 'enthusiast' | 'shop_owner' | null {
  const token = req.cookies.get('auth_token')?.value;
  if (token === 'enthusiast' || token === 'authenticated') return 'enthusiast';
  if (token === 'shop_owner') return 'shop_owner';
  return null;
}
