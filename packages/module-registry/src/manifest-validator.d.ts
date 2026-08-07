import { type ModuleManifest } from '@jason-os/shared';
export declare class ManifestValidator {
    private readonly _registeredIds;
    /**
     * Validate and return a ModuleManifest from an unknown value.
     * Throws ValidationError for any schema violation.
     */
    validate(manifest: unknown, registeredIds?: Set<string>): ModuleManifest;
    /**
     * Register an ID as used (to detect duplicates).
     */
    registerId(id: string): void;
    /**
     * Unregister an ID (free it for reuse).
     */
    unregisterId(id: string): void;
    /**
     * Reset all registered IDs (useful for testing).
     */
    reset(): void;
    private _extractString;
    private _extractCategory;
    private _extractStringArray;
    private _extractOptionalStringArray;
    private _extractPermissions;
    private _extractEvents;
    private _extractUI;
    private _validateId;
    private _validateVersion;
    private _validateEventTypes;
}
//# sourceMappingURL=manifest-validator.d.ts.map