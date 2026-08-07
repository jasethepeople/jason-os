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
export type { StorageAdapter } from './storage-adapter.js';
export { MemoryAdapter } from './memory-adapter.js';
export { LocalStorageAdapter } from './localstorage-adapter.js';
export { IndexedDBAdapter } from './indexeddb-adapter.js';
export { StorageRouter } from './storage-router.js';
//# sourceMappingURL=index.d.ts.map