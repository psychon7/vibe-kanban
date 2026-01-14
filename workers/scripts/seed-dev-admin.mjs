#!/usr/bin/env node
/**
 * Seed Development Admin User
 * 
 * This script creates a test admin user with a properly hashed password.
 * Run with: node scripts/seed-dev-admin.js
 * 
 * Credentials:
 *   Email: admin@vibe-kanban.dev
 *   Password: admin123
 */

import { execSync } from 'child_process';

const TEST_ADMIN = {
  id: 'test-admin-00000-0000-0000-000000000001',
  email: 'admin@vibe-kanban.dev',
  name: 'Test Admin',
  password: 'admin123'
};

const TEST_WORKSPACE = {
  id: 'test-workspace-0000-0000-000000000001',
  name: 'Test Workspace',
  slug: 'test-workspace'
};

const TEST_PROJECT = {
  id: 'test-project-0000-0000-0000-000000000001',
  name: 'Sample Project',
  description: 'A sample project for testing'
};

// PBKDF2 password hash for "admin123"
// Pre-computed using the same algorithm as the Workers runtime
// This is a known hash that will work with verifyPassword()
const ITERATIONS = 100000;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;

async function hashPassword(password) {
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

  const saltBase64 = Buffer.from(salt).toString('base64');
  const hashBase64 = Buffer.from(hashBuffer).toString('base64');

  return `${saltBase64}:${hashBase64}`;
}

async function runSQL(sql, env = '') {
  const envFlag = env ? `--env ${env}` : '';
  const cmd = `npx wrangler d1 execute DB ${envFlag} --remote --command "${sql.replace(/"/g, '\\"')}"`;
  try {
    execSync(cmd, { stdio: 'inherit', cwd: process.cwd() });
    return true;
  } catch (error) {
    console.error('SQL execution failed:', error.message);
    return false;
  }
}

async function seedEnvironment(env = '') {
  const envName = env || 'development';
  console.log(`\n🌱 Seeding ${envName} environment...\n`);

  // Generate password hash
  console.log('🔐 Generating password hash for "admin123"...');
  const passwordHash = await hashPassword(TEST_ADMIN.password);
  console.log(`   Hash: ${passwordHash.substring(0, 30)}...`);

  // Create user
  console.log('\n👤 Creating test admin user...');
  const userSQL = `
    INSERT OR REPLACE INTO users (id, email, name, password_hash, created_at, updated_at)
    VALUES ('${TEST_ADMIN.id}', '${TEST_ADMIN.email}', '${TEST_ADMIN.name}', '${passwordHash}', datetime('now'), datetime('now'))
  `;
  await runSQL(userSQL, env);

  // Create workspace
  console.log('\n🏢 Creating test workspace...');
  const workspaceSQL = `
    INSERT OR IGNORE INTO workspaces_team (id, name, slug, created_by, created_at, updated_at)
    VALUES ('${TEST_WORKSPACE.id}', '${TEST_WORKSPACE.name}', '${TEST_WORKSPACE.slug}', '${TEST_ADMIN.id}', datetime('now'), datetime('now'))
  `;
  await runSQL(workspaceSQL, env);

  // Add admin as owner
  console.log('\n👑 Adding admin as workspace owner...');
  const memberSQL = `
    INSERT OR IGNORE INTO workspace_members (workspace_team_id, user_id, role_id, status, joined_at)
    VALUES ('${TEST_WORKSPACE.id}', '${TEST_ADMIN.id}', 'role-owner', 'active', datetime('now'))
  `;
  await runSQL(memberSQL, env);

  // Create sample project
  console.log('\n📁 Creating sample project...');
  const projectSQL = `
    INSERT OR IGNORE INTO projects (id, workspace_team_id, name, description, status, created_by, created_at, updated_at)
    VALUES ('${TEST_PROJECT.id}', '${TEST_WORKSPACE.id}', '${TEST_PROJECT.name}', '${TEST_PROJECT.description}', 'active', '${TEST_ADMIN.id}', datetime('now'), datetime('now'))
  `;
  await runSQL(projectSQL, env);

  console.log(`\n✅ ${envName} seeding complete!`);
  console.log('\n📋 Test Credentials:');
  console.log(`   Email:    ${TEST_ADMIN.email}`);
  console.log(`   Password: ${TEST_ADMIN.password}`);
  console.log(`   Workspace: ${TEST_WORKSPACE.name}`);
}

async function main() {
  const args = process.argv.slice(2);
  const env = args[0] || '';

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: node scripts/seed-dev-admin.js [environment]

Environments:
  (none)     - Development (default)
  staging    - Staging environment
  production - Production (NOT RECOMMENDED)

Examples:
  node scripts/seed-dev-admin.js
  node scripts/seed-dev-admin.js staging
`);
    process.exit(0);
  }

  if (env === 'production') {
    console.log('⚠️  WARNING: You are about to seed PRODUCTION database!');
    console.log('   This will create a test user with known credentials.');
    console.log('   Press Ctrl+C to abort or wait 5 seconds to continue...');
    await new Promise(r => setTimeout(r, 5000));
  }

  await seedEnvironment(env);
}

main().catch(console.error);
