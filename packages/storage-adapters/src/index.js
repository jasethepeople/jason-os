/**
 * @jason-os/storage-adapters
 *
 * Unified storage layer for Jason-OS.
 *
 * Re-exports every adapter and the privacy-tier router so consumers
 * can import everything from the package root:
 *
 *   import { StorageRouter, MemoryAdapter } from '@jason-os/storage-adapters';
 */
// Concrete adapters
export { MemoryAdapter } from './memory-adapter.js';
export { LocalStorageAdapter } from './localstorage-adapter.js';
export { IndexedDBAdapter } from './indexeddb-adapter.js';
// Tier-based router
export { StorageRouter } from './storage-router.js';
//# sourceMappingURL=index.js.map