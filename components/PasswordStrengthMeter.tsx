'use client';

import { getPasswordStrength } from '@/lib/password-strength';

const STYLES: Record<string, { bar: string; text: string; segments: number }> = {
  Weak: { bar: 'bg-red-500', text: 'text-red-400', segments: 1 },
  Strong: { bar: 'bg-amber-400', text: 'text-amber-400', segments: 2 },
  'Very Strong': { bar: 'bg-green-500', text: 'text-green-400', segments: 3 },
};

export default function PasswordStrengthMeter({ password }: { password: string }) {
  if (!password) return null;
  const { label } = getPasswordStrength(password);
  const style = STYLES[label];

  return (
    <div className="space-y-1">
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i < style.segments ? style.bar : 'bg-zinc-800'}`} />
        ))}
      </div>
      <p className={`text-xs ${style.text}`}>{label}</p>
    </div>
  );
}
