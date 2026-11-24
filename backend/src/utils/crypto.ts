import { createHash, randomBytes, randomInt } from 'node:crypto';

const inviteAlphabet = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const shortInvitePattern = new RegExp(`^[${inviteAlphabet}]{6}$`, 'i');

export function generateInviteCode(length = 6): string {
  return Array.from({ length }, () => inviteAlphabet.charAt(randomInt(inviteAlphabet.length))).join('');
}

export function normalizeInviteToken(token: string): string | undefined {
  const value = token.trim();
  if (shortInvitePattern.test(value)) return value.toUpperCase();
  if (/^[a-f0-9]{64}$/i.test(value)) return value.toLowerCase();
}

export function generateRandomToken(bytes = 32): string {
  return randomBytes(bytes).toString('hex');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
