/**
 * @jason-os/storage-adapters
 *
 * StorageRouter — selects the most appropriate StorageAdapter based on
 * the active privacy tier.
 *
 * Tier → Adapter mapping:
 *   PUBLIC  → localStorage (fast, durable, no encryption needed)
 *   SOFT    → localStorage + light encryption handled upstream
 *   SHADOW  → IndexedDB   (more secure, larger quota)
 *   GHOST   → memory only (ephemeral, zero persistence)
 *
 * In Node / SSR environments the router automatically falls back to
 * MemoryAdapter when browser-only stores are unavailable.
 */

import type { PrivacyTier } from '@jason-os/shared';
import type { StorageAdapter } from './storage-adapter.js';
import { MemoryAdapter } from './memory-adapter.js';
import { LocalStorageAdapter } from './localstorage-adapter.js';
import { IndexedDBAdapter } from './indexeddb-adapter.js';

/** Cache of adapter instances keyed by "tier:namespace". */
const adapterCache = new Map<string, StorageAdapter>();

export class StorageRouter {
  private readonly preferred: string | undefined;

  constructor(options?: { preferred?: string }) {
    this.preferred = options?.preferred;
  }

  /**
   * Select the best adapter for the given privacy tier.
   *
   * @param tier     — Privacy tier (PUBLIC | SOFT | SHADOW | GHOST)
   * @param moduleId — Namespace / module identifier for key isolation
   */
  selectAdapter(tier: PrivacyTier, moduleId = 'default'): StorageAdapter {
    const cacheKey = `${tier}:${moduleId}:${this.preferred ?? 'auto'}`;

    if (adapterCache.has(cacheKey)) {
      return adapterCache.get(cacheKey)!;
    }

    let adapter: StorageAdapter;

    switch (tier) {
      case 'PUBLIC': {
        const ls = new LocalStorageAdapter(moduleId);
        adapter = ls.isAvailable() ? ls : new MemoryAdapter(moduleId);
        break;
      }

      case 'SOFT': {
        // SOFT tier stores on localStorage; light encryption is applied
        // by the privacy-kernel layer *before* values reach the adapter.
        const ls = new LocalStorageAdapter(moduleId);
        adapter = ls.isAvailable() ? ls : new MemoryAdapter(moduleId);
        break;
      }

      case 'SHADOW': {
        // Prefer IndexedDB for SHADOW — larger quota and not visible
        // in simple localStorage inspectors.
        adapter = new IndexedDBAdapter(moduleId);
        break;
      }

      case 'GHOST': {
        // GHOST = ephemeral — never persist to disk.
        adapter = new MemoryAdapter(moduleId);
        break;
      }

      default: {
        // Unknown tier → safest fallback is memory (no persistence leak).
        adapter = new MemoryAdapter(moduleId);
        break;
      }
    }

    adapterCache.set(cacheKey, adapter);
    return adapter;
  }

  /** Clear the internal adapter cache (useful in tests). */
  clearCache(): void {
    adapterCache.clear();
  }

  /** Return current cache size for debugging / introspection. */
  getCacheSize(): number {
    return adapterCache.size;
  }
}
