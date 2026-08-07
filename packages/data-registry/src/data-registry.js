/**
 * data-registry.ts — Central data registry for Jason-OS
 *
 * Manages encrypted namespaces per module and enforces cross-module
 * access control via an ACL system.
 */
import { PrivacyError } from '@jason-os/shared';
import { PrivacyKernel } from '@jason-os/privacy-kernel';
import { DataNamespaceImpl } from './data-namespace.js';
// ------------------------------------------------------------------
// DataRegistryImpl
// ------------------------------------------------------------------
export class DataRegistryImpl {
    _namespaces;
    _acl;
    _kernel;
    constructor(kernel) {
        this._namespaces = new Map();
        this._acl = new Map();
        this._kernel = kernel ?? new PrivacyKernel();
    }
    // ------------------------------------------------------------------
    // Namespace management
    // ------------------------------------------------------------------
    /**
     * Create a new namespace for a module with the given permissions.
     * Throws if the namespace already exists.
     */
    createNamespace(moduleId, permissions) {
        if (this._namespaces.has(moduleId)) {
            throw new PrivacyError(`Namespace already exists for module: ${moduleId}`, { moduleId });
        }
        const ns = new DataNamespaceImpl(moduleId, permissions, this._kernel);
        this._namespaces.set(moduleId, ns);
        return ns;
    }
    /**
     * Retrieve an existing namespace by module ID.
     */
    getNamespace(moduleId) {
        return this._namespaces.get(moduleId);
    }
    /**
     * Check whether a namespace exists.
     */
    hasNamespace(moduleId) {
        return this._namespaces.has(moduleId);
    }
    /**
     * List all module IDs with registered namespaces.
     */
    listNamespaces() {
        return Array.from(this._namespaces.keys());
    }
    /**
     * Delete a namespace (burns its data and removes it).
     */
    async deleteNamespace(moduleId) {
        const ns = this._namespaces.get(moduleId);
        if (ns !== undefined) {
            await ns.burn();
        }
        this._namespaces.delete(moduleId);
        this._acl.delete(moduleId);
        // Also remove any grants *from* this module to others
        for (const [, grants] of this._acl) {
            grants.delete(moduleId);
        }
    }
    // ------------------------------------------------------------------
    // Access control (ACL)
    // ------------------------------------------------------------------
    /**
     * Grant permissions for `fromModule` to access `toModule`'s namespace.
     */
    grantAccess(fromModule, toModule, permissions) {
        if (!this._acl.has(toModule)) {
            this._acl.set(toModule, new Map());
        }
        const grants = this._acl.get(toModule);
        const existing = grants.get(fromModule) ?? [];
        // Merge, deduplicate
        const merged = [...new Set([...existing, ...permissions])];
        grants.set(fromModule, merged);
    }
    /**
     * Revoke all access for `fromModule` to `toModule`'s namespace.
     */
    revokeAccess(fromModule, toModule) {
        const grants = this._acl.get(toModule);
        if (grants !== undefined) {
            grants.delete(fromModule);
        }
    }
    /**
     * Check whether `fromModule` has a specific permission on `toModule`'s namespace.
     * The owner module always has full access to its own namespace.
     */
    checkAccess(fromModule, toModule, permission) {
        // Owner always has full access
        const ns = this._namespaces.get(toModule);
        if (ns !== undefined && ns.getPermissions().owner === fromModule) {
            return true;
        }
        const grants = this._acl.get(toModule);
        if (grants === undefined) {
            return false;
        }
        const permissions = grants.get(fromModule);
        if (permissions === undefined) {
            return false;
        }
        return permissions.includes(permission);
    }
    // ------------------------------------------------------------------
    // Cross-module data access helpers
    // ------------------------------------------------------------------
    /**
     * Get a namespace if the requesting module has at least 'read' permission.
     * Throws PrivacyError if access is denied.
     */
    getNamespaceWithAccess(requestingModule, targetModule) {
        const ns = this._namespaces.get(targetModule);
        if (ns === undefined) {
            throw new PrivacyError(`Namespace not found: ${targetModule}`, { targetModule });
        }
        if (!this.checkAccess(requestingModule, targetModule, 'read')) {
            throw new PrivacyError(`Module ${requestingModule} does not have read access to namespace ${targetModule}`, { requestingModule, targetModule });
        }
        return ns;
    }
    // ------------------------------------------------------------------
    // Internal helpers
    // ------------------------------------------------------------------
    /**
     * Get the underlying PrivacyKernel instance.
     */
    getKernel() {
        return this._kernel;
    }
    /**
     * Get raw ACL entries for a module (for testing / inspection).
     */
    getAclForModule(moduleId) {
        return this._acl.get(moduleId);
    }
    /**
     * Get the internal namespace implementation (for testing).
     */
    getNamespaceImpl(moduleId) {
        return this._namespaces.get(moduleId);
    }
    /**
     * Destroy all namespaces and clear ACLs.
     */
    async destroy() {
        for (const [, ns] of this._namespaces) {
            await ns.burn();
        }
        this._namespaces.clear();
        this._acl.clear();
        this._kernel.destroy();
    }
}
//# sourceMappingURL=data-registry.js.map