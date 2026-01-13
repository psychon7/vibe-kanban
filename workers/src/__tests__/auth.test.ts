import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../utils/password';

describe('Password Utilities', () => {
  it('hashes password correctly', async () => {
    const password = 'SecurePass123!';
    const hash = await hashPassword(password);
    
    expect(hash).toBeDefined();
    expect(hash).toContain(':'); // salt:hash format
    expect(hash.length).toBeGreaterThan(32);
  });

  it('verifies correct password', async () => {
    const password = 'SecurePass123!';
    const hash = await hashPassword(password);
    
    const isValid = await verifyPassword(password, hash);
    expect(isValid).toBe(true);
  });

  it('rejects incorrect password', async () => {
    const password = 'SecurePass123!';
    const wrongPassword = 'WrongPass456!';
    const hash = await hashPassword(password);
    
    const isValid = await verifyPassword(wrongPassword, hash);
    expect(isValid).toBe(false);
  });

  it('generates different hashes for same password', async () => {
    const password = 'SecurePass123!';
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);
    
    expect(hash1).not.toBe(hash2); // Different salts
  });
});

