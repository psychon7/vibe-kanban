// Session management utilities for KV-based authentication

import type { KVNamespace } from '@cloudflare/workers-types';
import { generateSessionToken } from './password';

export interface Session {
  userId: string;
  email: string;
  name: string;
  createdAt: number;
  expiresAt: number;
}

const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
const SESSION_PREFIX = 'session:';

/**
 * Create a new session and store in KV
 */
export async function createSession(
  kv: KVNamespace,
  user: { id: string; email: string; name: string }
): Promise<{ token: string; expiresAt: number }> {
  const token = generateSessionToken();
  const now = Date.now();
  const expiresAt = now + SESSION_TTL_SECONDS * 1000;

  const session: Session = {
    userId: user.id,
    email: user.email,
    name: user.name,
    createdAt: now,
    expiresAt,
  };

  await kv.put(
    `${SESSION_PREFIX}${token}`,
    JSON.stringify(session),
    { expirationTtl: SESSION_TTL_SECONDS }
  );

  return { token, expiresAt };
}

/**
 * Get a session from KV
 */
export async function getSession(
  kv: KVNamespace,
  token: string
): Promise<Session | null> {
  const data = await kv.get(`${SESSION_PREFIX}${token}`);

  if (!data) {
    return null;
  }

  const session = JSON.parse(data) as Session;

  // Double-check expiration (KV TTL should handle this, but be safe)
  if (Date.now() > session.expiresAt) {
    await kv.delete(`${SESSION_PREFIX}${token}`);
    return null;
  }

  return session;
}

/**
 * Delete a session from KV (logout)
 */
export async function deleteSession(
  kv: KVNamespace,
  token: string
): Promise<void> {
  await kv.delete(`${SESSION_PREFIX}${token}`);
}

/**
 * Refresh a session (extend expiration)
 */
export async function refreshSession(
  kv: KVNamespace,
  token: string
): Promise<{ token: string; expiresAt: number } | null> {
  const session = await getSession(kv, token);

  if (!session) {
    return null;
  }

  // Delete old session
  await deleteSession(kv, token);

  // Create new session with fresh token
  return createSession(kv, {
    id: session.userId,
    email: session.email,
    name: session.name,
  });
}
