/**
 * data-registry.ts — Central data registry for Jason-OS
 *
 * Manages encrypted namespaces per module and enforces cross-module
 * access control via an ACL system.
 */
import type { DataRegistry, DataNamespace, DataPermission, NamespacePermissions } from '@jason-os/shared';
import { PrivacyKernel } from '@jason-os/privacy-kernel';
import { DataNamespaceImpl } from './data-namespace.js';
export declare class DataRegistryImpl implements DataRegistry {
    private readonly _namespaces;
    private readonly _acl;
    private readonly _kernel;
    constructor(kernel?: PrivacyKernel);
    /**
     * Create a new namespace for a module with the given permissions.
     * Throws if the namespace already exists.
     */
    createNamespace(moduleId: string, permissions: NamespacePermissions): DataNamespace;
    /**
     * Retrieve an existing namespace by module ID.
     */
    getNamespace(moduleId: string): DataNamespace | undefined;
    /**
     * Check whether a namespace exists.
     */
    hasNamespace(moduleId: string): boolean;
    /**
     * List all module IDs with registered namespaces.
     */
    listNamespaces(): string[];
    /**
     * Delete a namespace (burns its data and removes it).
     */
    deleteNamespace(moduleId: string): Promise<void>;
    /**
     * Grant permissions for `fromModule` to access `toModule`'s namespace.
     */
    grantAccess(fromModule: string, toModule: string, permissions: DataPermission[]): void;
    /**
     * Revoke all access for `fromModule` to `toModule`'s namespace.
     */
    revokeAccess(fromModule: string, toModule: string): void;
    /**
     * Check whether `fromModule` has a specific permission on `toModule`'s namespace.
     * The owner module always has full access to its own namespace.
     */
    checkAccess(fromModule: string, toModule: string, permission: DataPermission): boolean;
    /**
     * Get a namespace if the requesting module has at least 'read' permission.
     * Throws PrivacyError if access is denied.
     */
    getNamespaceWithAccess(requestingModule: string, targetModule: string): DataNamespace;
    /**
     * Get the underlying PrivacyKernel instance.
     */
    getKernel(): PrivacyKernel;
    /**
     * Get raw ACL entries for a module (for testing / inspection).
     */
    getAclForModule(moduleId: string): Map<string, DataPermission[]> | undefined;
    /**
     * Get the internal namespace implementation (for testing).
     */
    getNamespaceImpl(moduleId: string): DataNamespaceImpl | undefined;
    /**
     * Destroy all namespaces and clear ACLs.
     */
    destroy(): Promise<void>;
}
//# sourceMappingURL=data-registry.d.ts.map