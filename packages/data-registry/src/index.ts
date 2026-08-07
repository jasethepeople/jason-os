/**
 * @jason-os/data-registry
 *
 * Encrypted namespace data isolation and cross-module permissions.
 * Provides per-module isolated storage with optional AES-256-GCM encryption
 * and fine-grained ACL for cross-module data sharing.
 */

export { DataNamespaceImpl } from './data-namespace.js';
export { DataRegistryImpl } from './data-registry.js';
