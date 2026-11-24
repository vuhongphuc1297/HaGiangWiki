const shortCode = /^[a-z0-9]{6}$/i;
const legacyToken = /^[a-f0-9]{64}$/i;

function normalize(token: string) {
  if (shortCode.test(token)) return token.toUpperCase();
  if (legacyToken.test(token)) return token.toLowerCase();
}

export function inviteTokenFromInput(input: string): string | undefined {
  const value = input.trim();
  if (!value.includes('://')) return normalize(value);

  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return;
    const token = /^\/join\/([^/]+)\/?$/.exec(url.pathname)?.[1];
    if (token) return normalize(decodeURIComponent(token));
  } catch {
    return;
  }
}
