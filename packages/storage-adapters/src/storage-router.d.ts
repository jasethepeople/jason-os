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
export declare class StorageRouter {
    private readonly preferred;
    constructor(options?: {
        preferred?: string;
    });
    /**
     * Select the best adapter for the given privacy tier.
     *
     * @param tier     — Privacy tier (PUBLIC | SOFT | SHADOW | GHOST)
     * @param moduleId — Namespace / module identifier for key isolation
     */
    selectAdapter(tier: PrivacyTier, moduleId?: string): StorageAdapter;
    /** Clear the internal adapter cache (useful in tests). */
    clearCache(): void;
    /** Return current cache size for debugging / introspection. */
    getCacheSize(): number;
}
//# sourceMappingURL=storage-router.d.ts.map