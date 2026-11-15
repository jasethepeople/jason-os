import { describe, it, expect } from 'vitest';
import { StorageRouter } from './storage-router.js';
import { PrivacyKernel } from '../../privacy-kernel/src/privacy-kernel.js';

describe('GHOST storage lifetime', () => {
  it('wipes GHOST memory when leaving the tier', async () => {
    const router = new StorageRouter();
    const kernel = new PrivacyKernel();
    router.bindToKernel(kernel);
    kernel.setPrivacyTier('GHOST');
    await router.selectAdapter('GHOST', 'notes').set('diary', 'private');
    kernel.setPrivacyTier('SOFT');
    expect(await router.selectAdapter('GHOST', 'notes').get('diary')).toBeNull();
  });

  it('starts every GHOST session empty', async () => {
    const router = new StorageRouter();
    const kernel = new PrivacyKernel();
    router.bindToKernel(kernel);
    await router.selectAdapter('GHOST', 'n2').set('stale', 'x'); // leaked before entering
    kernel.setPrivacyTier('GHOST');
    expect(await router.selectAdapter('GHOST', 'n2').get('stale')).toBeNull();
  });

  it('does not touch non-GHOST data', async () => {
    const router = new StorageRouter();
    const kernel = new PrivacyKernel();
    router.bindToKernel(kernel);
    await router.selectAdapter('PUBLIC', 'keep').set('k', 'v');
    kernel.setPrivacyTier('GHOST');
    kernel.setPrivacyTier('SOFT');
    expect(await router.selectAdapter('PUBLIC', 'keep').get('k')).toBe('v');
  });
});
