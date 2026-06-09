import { NextRequest } from 'next/server';

const PASSCODE = 'Magic8581';
const FIXED_USER_ID = 'passcode-user-001'; // Fixed user ID for all passcode users

export async function getAuthenticatedUserId(req: NextRequest): Promise<string | null> {
  const authToken = req.cookies.get('auth_token')?.value;
  if (authToken === 'authenticated') {
    return FIXED_USER_ID;
  }
  return null;
}
