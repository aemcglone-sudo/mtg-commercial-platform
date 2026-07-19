'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

const ERROR_MESSAGES: Record<string, string> = {
  google_denied: 'Sign-in was cancelled.',
  google_token: 'Could not complete Google sign-in. Please try again.',
  email_unverified: 'Your Google account email is not verified.',
  user_create: 'Account creation failed. Please try again.',
};

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

function LoginContent() {
  const params = useSearchParams();
  const error = params.get('error');
  const returnTo = params.get('returnTo') ?? '';
  const signedOut = params.get('signed-out');

  const googleUrl = `/api/auth/google${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`;

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8 text-center">
        <div>
          <h1 className="text-4xl font-black text-amber-400">Grimoire</h1>
          <p className="text-zinc-500 text-sm mt-2">Your Magic: The Gathering companion</p>
        </div>

        {signedOut && (
          <p className="text-sm text-emerald-400 bg-emerald-950 border border-emerald-800 rounded-xl px-4 py-3">
            You've been signed out successfully.
          </p>
        )}

        {error && (
          <p className="text-sm text-red-400 bg-red-950/30 border border-red-900 rounded-xl px-4 py-3">
            {ERROR_MESSAGES[error] ?? 'Something went wrong. Please try again.'}
          </p>
        )}

        <div className="space-y-3">
          <a
            href={googleUrl}
            className="flex items-center justify-center gap-3 w-full py-3 px-4 rounded-xl font-semibold text-zinc-900 bg-white hover:bg-zinc-100 transition-colors shadow-md"
          >
            <GoogleIcon />
            Continue with Google
          </a>
          <p className="text-xs text-zinc-600">
            Sign in with your Google account to access Grimoire.
          </p>
        </div>

        <p className="text-xs text-zinc-700">
          Looking for a store?{' '}
          <Link href="/stores" className="text-amber-500 hover:text-amber-400">
            Find nearby shops →
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
