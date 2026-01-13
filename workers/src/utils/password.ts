// Password hashing utilities using Web Crypto API (Cloudflare Workers compatible)

const ITERATIONS = 100000;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;

/**
 * Hash a password using PBKDF2
 * Returns: salt:hash (both base64 encoded)
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    KEY_LENGTH * 8
  );

  const saltBase64 = btoa(String.fromCharCode(...salt));
  const hashBase64 = btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));

  return `${saltBase64}:${hashBase64}`;
}

/**
 * Verify a password against a stored hash
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [saltBase64, hashBase64] = storedHash.split(':');

  if (!saltBase64 || !hashBase64) {
    return false;
  }

  const salt = Uint8Array.from(atob(saltBase64), c => c.charCodeAt(0));
  const expectedHash = Uint8Array.from(atob(hashBase64), c => c.charCodeAt(0));

  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    KEY_LENGTH * 8
  );

  const actualHash = new Uint8Array(hashBuffer);

  // Constant-time comparison to prevent timing attacks
  if (actualHash.length !== expectedHash.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < actualHash.length; i++) {
    result |= actualHash[i] ^ expectedHash[i];
  }

  return result === 0;
}

/**
 * Generate a secure random session token
 */
export function generateSessionToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
