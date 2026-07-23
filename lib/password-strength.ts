export type PasswordStrengthLabel = 'Weak' | 'Strong' | 'Very Strong';

export interface PasswordStrength {
  label: PasswordStrengthLabel;
  score: number; // 0-7
}

const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password123', '12345678', '123456789', 'qwerty123',
  'letmein', 'welcome1', 'admin123', 'iloveyou', 'football', 'baseball', 'monkey123',
]);

export function getPasswordStrength(password: string): PasswordStrength {
  if (!password) return { label: 'Weak', score: 0 };

  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (password.length >= 16) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (password.length < 8 || COMMON_PASSWORDS.has(password.toLowerCase())) {
    return { label: 'Weak', score: Math.min(score, 2) };
  }

  if (score <= 4) return { label: 'Weak', score };
  if (score <= 6) return { label: 'Strong', score };
  return { label: 'Very Strong', score };
}
