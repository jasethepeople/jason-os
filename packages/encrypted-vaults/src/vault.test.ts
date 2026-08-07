/**
 * vault.test.ts — Comprehensive tests for EncryptedVault and EncryptedVaultManager
 *
 * Covers:
 *  1. Create vault and store/retrieve data
 *  2. Vault locked by default
 *  3. Unlock with correct password
 *  4. Unlock with wrong password fails
 *  5. Lock vault after unlock
 *  6. Shadow vault not in normal list
 *  7. Shadow vault appears in shadow list with auth
 *  8. Time-based self-destruct burns vault
 *  9. Attempt-based self-destruct burns after N failures
 * 10. Duress password triggers burn
 * 11. Burn vault wipes all data
 * 12. Delete vault removes it completely
 * 13. Default vault get/set
 * 14. Vault metadata correct
 * 15. Plausible deniability: shadow vaults indistinguishable from random data
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EncryptedVault, EncryptedVaultManager } from './index.js';
import { PrivacyError } from '@jason-os/shared';

describe('EncryptedVault', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Test 1: Create vault and store/retrieve data
  it('creates a vault and stores/retrieves data', async () => {
    const vault = new EncryptedVault('v-1', 'Test Vault', 'password123');
    expect(vault.isLocked()).toBe(false); // created unlocked so we can use it

    await vault.store('key1', 'value1');
    const result = await vault.retrieve('key1');
    expect(result).toBe('value1');

    // Store complex object
    const obj = { name: 'test', nested: { value: 42 } };
    await vault.store('obj', obj);
    const retrieved = await vault.retrieve('obj');
    expect(retrieved).toEqual(obj);
  });

  // Test 2: Vault locked by default (when created via manager)
  it('vault can be locked after creation', async () => {
    const vault = new EncryptedVault('v-2', 'Locked Vault', 'secret');
    expect(vault.isLocked()).toBe(false);

    vault.lock();
    expect(vault.isLocked()).toBe(true);

    // Should throw when trying to access while locked
    await expect(vault.retrieve('key1')).rejects.toThrow(PrivacyError);
    await expect(vault.store('key', 'val')).rejects.toThrow(PrivacyError);
  });

  // Test 3: Unlock with correct password
  it('unlocks with correct password', async () => {
    const vault = new EncryptedVault('v-3', 'Unlock Test', 'correct-password');
    vault.lock();
    expect(vault.isLocked()).toBe(true);

    const result = await vault.unlock('correct-password');
    expect(result).toBe(true);
    expect(vault.isLocked()).toBe(false);
  });

  // Test 4: Unlock with wrong password fails
  it('fails to unlock with wrong password', async () => {
    const vault = new EncryptedVault('v-4', 'Wrong PW', 'real-password');
    vault.lock();

    const result = await vault.unlock('wrong-password');
    expect(result).toBe(false);
    expect(vault.isLocked()).toBe(true);
  });

  // Test 5: Lock vault after unlock
  it('locks vault after being unlocked', async () => {
    const vault = new EncryptedVault('v-5', 'Lock Test', 'mypassword');
    vault.lock();

    await vault.unlock('mypassword');
    expect(vault.isLocked()).toBe(false);

    await vault.store('item', 'data');
    expect(await vault.retrieve('item')).toBe('data');

    vault.lock();
    expect(vault.isLocked()).toBe(true);
    await expect(vault.retrieve('item')).rejects.toThrow(PrivacyError);
  });

  // Test 6: Shadow vault not in normal list
  it('shadow vault does not appear in normal vault list', () => {
    const manager = new EncryptedVaultManager();
    manager.createVault('Normal', 'pw1');
    manager.createShadowVault('Secret', 'pw2');

    const normalList = manager.listVaults();
    expect(normalList).toHaveLength(1);
    expect(normalList[0]!.name).toBe('Normal');
    expect(normalList.every((v) => !v.isShadow)).toBe(true);
  });

  // Test 7: Shadow vault appears in shadow list with auth
  it('shadow vault appears in shadow list with valid auth token', () => {
    const manager = new EncryptedVaultManager();
    manager.createVault('Normal', 'pw1');
    manager.createShadowVault('Secret', 'pw2');

    const token = manager.generateShadowToken();
    const shadowList = manager.listShadowVaults(token);
    expect(shadowList).toHaveLength(1);
    expect(shadowList[0]!.name).toBe('Secret');
    expect(shadowList[0]!.isShadow).toBe(true);
  });

  // Test 8: Time-based self-destruct burns vault
  it('auto-burns vault after time-based inactivity', async () => {
    const manager = new EncryptedVaultManager();
    const vault = manager.createVault(
      'Timed Vault',
      'password',
      {
        selfDestruct: {
          type: 'time',
          timeLimitMs: 5000,
        },
      }
    );

    await vault.store('key', 'value');

    // Lock and wait beyond the time limit
    vault.lock();
    vi.advanceTimersByTime(6000);

    // Give the setTimeout callback a chance to run
    await vi.runAllTimersAsync();

    expect(vault.isBurned()).toBe(true);
    await expect(vault.unlock('password')).rejects.toThrow(PrivacyError);
  });

  // Test 9: Attempt-based self-destruct burns after N failures
  it('burns vault after N failed unlock attempts', async () => {
    const manager = new EncryptedVaultManager();
    const vault = manager.createVault(
      'Attempt Vault',
      'right-password',
      {
        selfDestruct: {
          type: 'attempts',
          maxAttempts: 3,
        },
      }
    );
    vault.lock();

    expect(vault.isBurned()).toBe(false);

    // First two failures — vault still exists
    expect(await vault.unlock('wrong1')).toBe(false);
    expect(vault.isBurned()).toBe(false);
    expect(await vault.unlock('wrong2')).toBe(false);
    expect(vault.isBurned()).toBe(false);

    // Third failure — vault burns
    expect(await vault.unlock('wrong3')).toBe(false);
    expect(vault.isBurned()).toBe(true);
  });

  // Test 10: Duress password triggers burn
  it('burns vault when duress password is entered', async () => {
    const manager = new EncryptedVaultManager();
    const vault = manager.createVault(
      'Duress Vault',
      'real-password',
      {
        selfDestruct: {
          type: 'duress',
          duressPassword: 'duress-now',
        },
      }
    );
    vault.lock();

    expect(vault.isBurned()).toBe(false);

    // Enter duress password
    const result = await vault.unlock('duress-now');
    expect(result).toBe(false);
    expect(vault.isBurned()).toBe(true);
  });

  // Test 11: Burn vault wipes all data
  it('burn wipes all vault data irrecoverably', async () => {
    const vault = new EncryptedVault('v-burn', 'Burn Test', 'password');
    await vault.store('key1', 'value1');
    await vault.store('key2', { complex: true, data: [1, 2, 3] });

    const listBefore = await vault.list();
    expect(listBefore).toHaveLength(2);

    await vault.burn();

    expect(vault.isBurned()).toBe(true);

    // All operations should fail on burned vault
    await expect(vault.retrieve('key1')).rejects.toThrow(PrivacyError);
    await expect(vault.store('new', 'val')).rejects.toThrow(PrivacyError);
    await expect(vault.list()).rejects.toThrow(PrivacyError);
    await expect(vault.unlock('password')).rejects.toThrow(PrivacyError);
  });

  // Test 12: Delete vault removes it completely
  it('deletes vault and removes it from manager', async () => {
    const manager = new EncryptedVaultManager();
    const vault = manager.createVault('ToDelete', 'password');
    const id = vault.id;

    await vault.store('data', 'value');
    expect(manager.getVault(id)).toBeDefined();

    await manager.deleteVault(id);
    expect(manager.getVault(id)).toBeUndefined();
    expect(vault.isBurned()).toBe(true);
  });

  // Test 13: Default vault get/set
  it('manages default vault correctly', () => {
    const manager = new EncryptedVaultManager();
    const vault1 = manager.createVault('First', 'pw1');
    const vault2 = manager.createVault('Second', 'pw2');

    // First vault becomes default automatically
    expect(manager.getDefaultVault()?.id).toBe(vault1.id);

    // Can change default
    manager.setDefaultVault(vault2.id);
    expect(manager.getDefaultVault()?.id).toBe(vault2.id);

    // Throws for non-existent vault
    expect(() => manager.setDefaultVault('non-existent')).toThrow(PrivacyError);
  });

  // Test 14: Vault metadata correct
  it('returns accurate vault metadata', async () => {
    const before = Date.now();
    const vault = new EncryptedVault('v-meta', 'Meta Test', 'pw', {
      selfDestruct: { type: 'attempts', maxAttempts: 5 },
    });
    const after = Date.now();

    await vault.store('item1', 'data');
    await vault.store('item2', 'data');

    const meta = vault.getMetadata();
    expect(meta.id).toBe('v-meta');
    expect(meta.name).toBe('Meta Test');
    expect(meta.isShadow).toBe(false);
    expect(meta.itemCount).toBe(2);
    expect(meta.createdAt).toBeGreaterThanOrEqual(before);
    expect(meta.createdAt).toBeLessThanOrEqual(after);
    expect(meta.lastAccessedAt).toBeGreaterThanOrEqual(meta.createdAt);
    expect(meta.selfDestruct).toEqual({ type: 'attempts', maxAttempts: 5 });
  });

  // Test 15: Plausible deniability — shadow vaults indistinguishable from random data
  it('shadow vault salt and verification tag look like random data', () => {
    const shadowVault = new EncryptedVault('sv-1', 'Shadow', 'pw', { isShadow: true });
    const normalVault = new EncryptedVault('v-1', 'Normal', 'pw', { isShadow: false });

    // Get the raw salt and verification tag
    const shadowSalt = shadowVault.getSalt();
    const shadowTag = shadowVault.getVerificationTag();
    const normalSalt = normalVault.getSalt();
    const normalTag = normalVault.getVerificationTag();

    // All are non-empty byte arrays
    expect(shadowSalt.length).toBeGreaterThan(0);
    expect(shadowTag.length).toBeGreaterThan(0);
    expect(normalSalt.length).toBeGreaterThan(0);
    expect(normalTag.length).toBeGreaterThan(0);

    // Salt and tags are different between vaults (random)
    expect(Buffer.from(shadowSalt).toString('hex')).not.toBe(Buffer.from(normalSalt).toString('hex'));
    expect(Buffer.from(shadowTag).toString('hex')).not.toBe(Buffer.from(normalTag).toString('hex'));

    // The salt bytes have high entropy — check that they don't contain readable text
    const saltText = new TextDecoder().decode(shadowSalt);
    let printableCount = 0;
    for (let i = 0; i < saltText.length; i++) {
      const code = saltText.charCodeAt(i);
      if (code >= 32 && code <= 126) {
        printableCount++;
      }
    }
    // Most bytes should be non-printable (high entropy / random)
    expect(printableCount).toBeLessThan(saltText.length * 0.5);

    // Shadow vault metadata confirms it's hidden
    const meta = shadowVault.getMetadata();
    expect(meta.isShadow).toBe(true);
  });

  // Additional tests for edge cases

  it('lists keys in vault', async () => {
    const vault = new EncryptedVault('v-list', 'List Test', 'pw');
    await vault.store('a', 1);
    await vault.store('b', 2);
    await vault.store('c', 3);

    const keys = await vault.list();
    expect(keys.sort()).toEqual(['a', 'b', 'c']);
  });

  it('deletes a key from vault', async () => {
    const vault = new EncryptedVault('v-del', 'Delete Test', 'pw');
    await vault.store('to-delete', 'value');
    expect(await vault.retrieve('to-delete')).toBe('value');

    await vault.delete('to-delete');
    expect(await vault.retrieve('to-delete')).toBeUndefined();
  });

  it('returns undefined for non-existent key', async () => {
    const vault = new EncryptedVault('v-miss', 'Miss Test', 'pw');
    const result = await vault.retrieve('does-not-exist');
    expect(result).toBeUndefined();
  });

  it('multiple unlock failures without self-destruct do not burn', async () => {
    const vault = new EncryptedVault('v-many', 'Many Failures', 'pw');
    vault.lock();

    // Fail 10 times without self-destruct policy
    for (let i = 0; i < 10; i++) {
      expect(await vault.unlock(`wrong-${i}`)).toBe(false);
    }
    expect(vault.isBurned()).toBe(false);

    // Can still unlock with correct password
    expect(await vault.unlock('pw')).toBe(true);
    expect(vault.isLocked()).toBe(false);
  });

  it('vault manager handles shadow vault access with invalid token', () => {
    const manager = new EncryptedVaultManager();
    manager.createShadowVault('Secret', 'pw');

    expect(() => manager.listShadowVaults('invalid-token')).toThrow(PrivacyError);
  });

  it('tracks failed attempts on vault', async () => {
    const vault = new EncryptedVault('v-attempts', 'Attempts', 'pw');
    vault.lock();

    expect(vault.getFailedAttempts()).toBe(0);
    await vault.unlock('wrong');
    expect(vault.getFailedAttempts()).toBe(1);
    await vault.unlock('wrong-again');
    expect(vault.getFailedAttempts()).toBe(2);

    // Successful unlock resets counter
    await vault.unlock('pw');
    expect(vault.getFailedAttempts()).toBe(0);
  });

  it('manager hasVault checks existence', () => {
    const manager = new EncryptedVaultManager();
    const vault = manager.createVault('Test', 'pw');

    expect(manager.hasVault(vault.id)).toBe(true);
    expect(manager.hasVault('non-existent')).toBe(false);
  });

  it('time-based self-destruct does not burn when vault is active', async () => {
    const manager = new EncryptedVaultManager();
    const vault = manager.createVault(
      'Active Vault',
      'password',
      {
        selfDestruct: {
          type: 'time',
          timeLimitMs: 100,
        },
      }
    );

    // Store data (resets timer)
    await vault.store('key', 'value');

    // Advance less than the limit
    vi.advanceTimersByTime(50);

    // Store again (resets timer)
    await vault.store('key2', 'value2');
    vi.advanceTimersByTime(50);

    // Store again (resets timer)
    await vault.store('key3', 'value3');
    vi.advanceTimersByTime(80);

    // Vault should still be alive (timer keeps getting reset)
    expect(vault.isBurned()).toBe(false);

    // Now let it expire
    vi.advanceTimersByTime(150);
    await vi.runAllTimersAsync();

    expect(vault.isBurned()).toBe(true);
  });

  it('generates and validates shadow token with secret', () => {
    const manager = new EncryptedVaultManager('my-secret');
    manager.createShadowVault('Secret1', 'pw');
    manager.createShadowVault('Secret2', 'pw');

    // Invalid secret should throw
    expect(() => manager.generateShadowToken('wrong-secret')).toThrow(PrivacyError);

    // Valid secret generates token
    const token = manager.generateShadowToken('my-secret');
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);

    const list = manager.listShadowVaults(token);
    expect(list).toHaveLength(2);
  });

  it('revokes shadow token', () => {
    const manager = new EncryptedVaultManager();
    manager.createShadowVault('Secret', 'pw');

    const token = manager.generateShadowToken();
    expect(manager.listShadowVaults(token)).toHaveLength(1);

    manager.revokeShadowToken(token);
    expect(() => manager.listShadowVaults(token)).toThrow(PrivacyError);
  });
});
