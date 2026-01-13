# User Authentication Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement secure email/password authentication with session-based tokens for the Kanban app.

**Architecture:** Session-based auth using KV cache for token storage. Passwords hashed with PBKDF2 via Web Crypto API (Cloudflare Workers compatible). Sessions stored as `session:{token}` in KV with TTL. Existing `requireAuth()` middleware already validates tokens.

**Tech Stack:** Hono, Zod validation, Cloudflare D1 (users table), Cloudflare KV (sessions), Web Crypto API (PBKDF2)

---

## Task 1: Add Password Hash Column to Users Table

**Files:**
- Create: `migrations/0003_add_password_hash.sql`

**Step 1: Create migration file**

```sql
-- Migration: Add password_hash column to users table
-- This enables email/password authentication

ALTER TABLE users ADD COLUMN password_hash TEXT;

-- Index for faster email lookups during login
CREATE INDEX IF NOT EXISTS idx_users_email_password ON users(email) WHERE password_hash IS NOT NULL;
```

**Step 2: Apply migration locally**

Run: `npm run d1:migrate`
Expected: Migration applied successfully

**Step 3: Verify migration**

Run: `npm run d1:execute -- --command "PRAGMA table_info(users);"`
Expected: Output shows `password_hash` column

**Step 4: Commit**

```bash
git add migrations/0003_add_password_hash.sql
git commit -m "feat(auth): add password_hash column to users table"
```

---

## Task 2: Create Password Hashing Utilities

**Files:**
- Create: `src/utils/password.ts`
- Create: `src/utils/index.ts`

**Step 1: Create password utility file**

```typescript
// src/utils/password.ts
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
```

**Step 2: Create utils barrel export**

```typescript
// src/utils/index.ts
export * from './password';
```

**Step 3: Verify TypeScript compiles**

Run: `npm run typecheck`
Expected: No errors

**Step 4: Commit**

```bash
git add src/utils/password.ts src/utils/index.ts
git commit -m "feat(auth): add password hashing utilities with PBKDF2"
```

---

## Task 3: Create Session Management Utilities

**Files:**
- Create: `src/utils/session.ts`
- Modify: `src/utils/index.ts`

**Step 1: Create session utility file**

```typescript
// src/utils/session.ts
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
```

**Step 2: Update utils barrel export**

```typescript
// src/utils/index.ts
export * from './password';
export * from './session';
```

**Step 3: Verify TypeScript compiles**

Run: `npm run typecheck`
Expected: No errors

**Step 4: Commit**

```bash
git add src/utils/session.ts src/utils/index.ts
git commit -m "feat(auth): add session management utilities"
```

---

## Task 4: Create Zod Schemas for Auth Endpoints

**Files:**
- Create: `src/schemas/auth.ts`
- Create: `src/schemas/index.ts`

**Step 1: Create auth schemas file**

```typescript
// src/schemas/auth.ts
import { z } from 'zod';

export const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one lowercase letter, one uppercase letter, and one number'
    ),
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be at most 100 characters')
    .trim(),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
```

**Step 2: Create schemas barrel export**

```typescript
// src/schemas/index.ts
export * from './auth';
```

**Step 3: Verify TypeScript compiles**

Run: `npm run typecheck`
Expected: No errors

**Step 4: Commit**

```bash
git add src/schemas/auth.ts src/schemas/index.ts
git commit -m "feat(auth): add Zod schemas for signup and login"
```

---

## Task 5: Implement Signup Endpoint

**Files:**
- Modify: `src/routes/auth.ts`

**Step 1: Read current auth routes file**

Run: Read `src/routes/auth.ts`

**Step 2: Implement signup endpoint**

Replace the contents of `src/routes/auth.ts` with:

```typescript
// src/routes/auth.ts
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { Env, Variables } from '../types/env';
import { signupSchema, loginSchema } from '../schemas';
import { hashPassword, verifyPassword } from '../utils';
import { createSession, deleteSession, refreshSession } from '../utils';
import { requireAuth } from '../middleware';
import { ApiError, ErrorCode } from '../middleware/error-handler';

const auth = new Hono<{ Bindings: Env; Variables: Variables }>();

// POST /api/v1/auth/signup - Create new user account
auth.post('/signup', zValidator('json', signupSchema), async (c) => {
  const { email, password, name } = c.req.valid('json');

  // Check if email already exists
  const existingUser = await c.env.DB.prepare(
    'SELECT id FROM users WHERE email = ?'
  ).bind(email.toLowerCase()).first();

  if (existingUser) {
    throw new ApiError(
      ErrorCode.VALIDATION_ERROR,
      'Email already registered',
      409,
      { field: 'email' }
    );
  }

  // Hash password
  const passwordHash = await hashPassword(password);

  // Generate user ID
  const userId = crypto.randomUUID();

  // Insert user
  await c.env.DB.prepare(
    `INSERT INTO users (id, email, name, password_hash, created_at, updated_at)
     VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`
  ).bind(userId, email.toLowerCase(), name.trim(), passwordHash).run();

  // Create session
  const { token, expiresAt } = await createSession(c.env.CACHE, {
    id: userId,
    email: email.toLowerCase(),
    name: name.trim(),
  });

  return c.json({
    user: {
      id: userId,
      email: email.toLowerCase(),
      name: name.trim(),
    },
    token,
    expiresAt,
  }, 201);
});

// POST /api/v1/auth/login - Login with email/password
auth.post('/login', zValidator('json', loginSchema), async (c) => {
  const { email, password } = c.req.valid('json');

  // Find user by email
  const user = await c.env.DB.prepare(
    'SELECT id, email, name, password_hash FROM users WHERE email = ?'
  ).bind(email.toLowerCase()).first<{
    id: string;
    email: string;
    name: string;
    password_hash: string | null;
  }>();

  if (!user || !user.password_hash) {
    throw new ApiError(
      ErrorCode.AUTH_001,
      'Invalid email or password',
      401
    );
  }

  // Verify password
  const isValid = await verifyPassword(password, user.password_hash);

  if (!isValid) {
    throw new ApiError(
      ErrorCode.AUTH_001,
      'Invalid email or password',
      401
    );
  }

  // Create session
  const { token, expiresAt } = await createSession(c.env.CACHE, {
    id: user.id,
    email: user.email,
    name: user.name,
  });

  return c.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
    },
    token,
    expiresAt,
  });
});

// POST /api/v1/auth/logout - Logout and invalidate session
auth.post('/logout', requireAuth(), async (c) => {
  const authHeader = c.req.header('Authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (token) {
    await deleteSession(c.env.CACHE, token);
  }

  return c.json({ message: 'Logged out successfully' });
});

// GET /api/v1/auth/me - Get current authenticated user
auth.get('/me', requireAuth(), async (c) => {
  const user = c.get('user');

  // Get full user details from DB
  const fullUser = await c.env.DB.prepare(
    'SELECT id, email, name, avatar_url, created_at FROM users WHERE id = ?'
  ).bind(user!.id).first<{
    id: string;
    email: string;
    name: string;
    avatar_url: string | null;
    created_at: string;
  }>();

  if (!fullUser) {
    throw new ApiError(
      ErrorCode.NOT_FOUND,
      'User not found',
      404
    );
  }

  return c.json({
    user: {
      id: fullUser.id,
      email: fullUser.email,
      name: fullUser.name,
      avatarUrl: fullUser.avatar_url,
      createdAt: fullUser.created_at,
    },
  });
});

// POST /api/v1/auth/refresh - Refresh session token
auth.post('/refresh', requireAuth(), async (c) => {
  const authHeader = c.req.header('Authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!token) {
    throw new ApiError(
      ErrorCode.AUTH_003,
      'Missing authentication token',
      401
    );
  }

  const newSession = await refreshSession(c.env.CACHE, token);

  if (!newSession) {
    throw new ApiError(
      ErrorCode.AUTH_002,
      'Session expired or invalid',
      401
    );
  }

  const user = c.get('user');

  return c.json({
    user: {
      id: user!.id,
      email: user!.email,
      name: user!.name,
    },
    token: newSession.token,
    expiresAt: newSession.expiresAt,
  });
});

export default auth;
```

**Step 3: Verify TypeScript compiles**

Run: `npm run typecheck`
Expected: No errors

**Step 4: Commit**

```bash
git add src/routes/auth.ts
git commit -m "feat(auth): implement signup, login, logout, me, and refresh endpoints"
```

---

## Task 6: Add Missing ErrorCode Constants

**Files:**
- Modify: `src/middleware/error-handler.ts`

**Step 1: Read current error-handler file**

Run: Read `src/middleware/error-handler.ts`

**Step 2: Add missing error codes if needed**

Ensure these error codes exist in the `ErrorCode` enum:

```typescript
// Add to ErrorCode enum if not present:
VALIDATION_ERROR = 'VALIDATION_ERROR',
NOT_FOUND = 'NOT_FOUND',
AUTH_001 = 'AUTH_001',  // Invalid credentials
AUTH_002 = 'AUTH_002',  // Session expired
AUTH_003 = 'AUTH_003',  // Missing authentication
```

**Step 3: Verify TypeScript compiles**

Run: `npm run typecheck`
Expected: No errors

**Step 4: Commit (if changes made)**

```bash
git add src/middleware/error-handler.ts
git commit -m "feat(auth): add missing error codes"
```

---

## Task 7: Update Types for Session Storage

**Files:**
- Modify: `src/types/env.ts`

**Step 1: Read current env.ts file**

Run: Read `src/types/env.ts`

**Step 2: Verify CACHE binding exists**

Ensure the `Env` interface includes:

```typescript
CACHE: KVNamespace;
```

If missing, add it. The wrangler.toml already has this binding configured.

**Step 3: Verify TypeScript compiles**

Run: `npm run typecheck`
Expected: No errors

**Step 4: Commit (if changes made)**

```bash
git add src/types/env.ts
git commit -m "chore: ensure CACHE binding in Env types"
```

---

## Task 8: Integration Testing with Local Server

**Files:**
- None (testing only)

**Step 1: Start dev server**

Run: `npm run dev`
Expected: Server starts on localhost

**Step 2: Apply migrations**

Run: `npm run d1:migrate`
Expected: Migration 0003 applied

**Step 3: Test signup endpoint**

Run:
```bash
curl -X POST http://localhost:8787/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"TestPass123","name":"Test User"}'
```
Expected: 201 response with user object and token

**Step 4: Test login endpoint**

Run:
```bash
curl -X POST http://localhost:8787/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"TestPass123"}'
```
Expected: 200 response with user object and token

**Step 5: Test /me endpoint**

Run (using token from login):
```bash
curl http://localhost:8787/api/v1/auth/me \
  -H "Authorization: Bearer <token>"
```
Expected: 200 response with user details

**Step 6: Test logout endpoint**

Run:
```bash
curl -X POST http://localhost:8787/api/v1/auth/logout \
  -H "Authorization: Bearer <token>"
```
Expected: 200 response with logout message

**Step 7: Verify session invalidated**

Run (using same token):
```bash
curl http://localhost:8787/api/v1/auth/me \
  -H "Authorization: Bearer <token>"
```
Expected: 401 response (session no longer valid)

**Step 8: Stop dev server**

Run: Ctrl+C
Expected: Server stopped

---

## Task 9: Test Error Cases

**Files:**
- None (testing only)

**Step 1: Start dev server**

Run: `npm run dev`
Expected: Server starts

**Step 2: Test duplicate email signup**

Run:
```bash
curl -X POST http://localhost:8787/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"TestPass123","name":"Another User"}'
```
Expected: 409 response with "Email already registered"

**Step 3: Test invalid password format**

Run:
```bash
curl -X POST http://localhost:8787/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"new@example.com","password":"weak","name":"New User"}'
```
Expected: 400 response with validation error

**Step 4: Test wrong password login**

Run:
```bash
curl -X POST http://localhost:8787/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"WrongPassword123"}'
```
Expected: 401 response with "Invalid email or password"

**Step 5: Test nonexistent email login**

Run:
```bash
curl -X POST http://localhost:8787/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"nonexistent@example.com","password":"TestPass123"}'
```
Expected: 401 response with "Invalid email or password"

**Step 6: Test missing auth token**

Run:
```bash
curl http://localhost:8787/api/v1/auth/me
```
Expected: 401 response with "Missing authentication"

**Step 7: Stop dev server**

Run: Ctrl+C
Expected: Server stopped

---

## Task 10: Final Commit and Cleanup

**Files:**
- None (git operations only)

**Step 1: Run full type check**

Run: `npm run typecheck`
Expected: No errors

**Step 2: Run linting**

Run: `npm run lint`
Expected: No errors (or fix any issues)

**Step 3: Create final commit if needed**

If any uncommitted changes:
```bash
git add .
git commit -m "chore: final cleanup for auth implementation"
```

**Step 4: Review all commits**

Run: `git log --oneline -10`
Expected: See all auth-related commits

---

## Summary

After completing all tasks, you will have:

1. **Password hashing** - Secure PBKDF2 with constant-time comparison
2. **Session management** - KV-based with 7-day TTL
3. **Signup endpoint** - Email validation, password requirements, duplicate check
4. **Login endpoint** - Credential verification, session creation
5. **Logout endpoint** - Session invalidation
6. **Me endpoint** - Current user details
7. **Refresh endpoint** - Token rotation

The authentication system integrates with the existing:
- `requireAuth()` middleware for protected routes
- Error handling with proper codes
- CORS and security headers
- Request ID tracing
