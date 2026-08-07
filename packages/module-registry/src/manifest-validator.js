// ============================================================
// Manifest Validator — Schema validation for module manifests
// ============================================================
import { ValidationError, } from '@jason-os/shared';
// ------------------------------------------------------------------
// Constants
// ------------------------------------------------------------------
const VALID_CATEGORIES = [
    'EMOTIONAL',
    'IDENTITY',
    'PRODUCTIVITY',
    'NAVIGATION',
    'MEMORY',
    'COMMUNICATION',
    'PRIVACY',
];
const VALID_PERMISSIONS = [
    'storage',
    'network',
    'telemetry',
    'clipboard',
    'filesystem',
    'llm',
    'notifications',
];
// Semver regex following the official semver specification
// Matches: MAJOR.MINOR.PATCH with optional prerelease and build metadata
const SEMVER_REGEX = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;
// ------------------------------------------------------------------
// Validator Class
// ------------------------------------------------------------------
export class ManifestValidator {
    _registeredIds = new Set();
    /**
     * Validate and return a ModuleManifest from an unknown value.
     * Throws ValidationError for any schema violation.
     */
    validate(manifest, registeredIds) {
        // Must be a non-null object
        if (manifest === null || typeof manifest !== 'object') {
            throw new ValidationError('Module manifest must be a non-null object', { received: typeof manifest });
        }
        const obj = manifest;
        // --- Required fields ---
        const id = this._extractString(obj, 'id');
        const name = this._extractString(obj, 'name');
        const version = this._extractString(obj, 'version');
        const category = this._extractCategory(obj);
        const dependencies = this._extractStringArray(obj, 'dependencies');
        const optionalDependencies = this._extractOptionalStringArray(obj, 'optionalDependencies');
        const permissions = this._extractPermissions(obj);
        const events = this._extractEvents(obj);
        // --- Field validations ---
        this._validateId(id, registeredIds);
        this._validateVersion(version);
        this._validateEventTypes(events);
        // Auto-register the validated ID internally
        this._registeredIds.add(id);
        const validated = {
            id,
            name,
            version,
            category,
            dependencies,
            optionalDependencies,
            permissions,
            events,
        };
        // --- Optional fields ---
        if (obj.description !== undefined) {
            validated.description = this._extractString(obj, 'description');
        }
        if (obj.author !== undefined) {
            validated.author = this._extractString(obj, 'author');
        }
        if (obj.ui !== undefined) {
            validated.ui = this._extractUI(obj);
        }
        return validated;
    }
    /**
     * Register an ID as used (to detect duplicates).
     */
    registerId(id) {
        this._registeredIds.add(id);
    }
    /**
     * Unregister an ID (free it for reuse).
     */
    unregisterId(id) {
        this._registeredIds.delete(id);
    }
    /**
     * Reset all registered IDs (useful for testing).
     */
    reset() {
        this._registeredIds.clear();
    }
    // ------------------------------------------------------------------
    // Private helpers
    // ------------------------------------------------------------------
    _extractString(obj, field) {
        const value = obj[field];
        if (typeof value !== 'string' || value.length === 0) {
            throw new ValidationError(`Module manifest must have a non-empty string "${field}"`, { field, received: typeof value });
        }
        return value;
    }
    _extractCategory(obj) {
        const value = obj.category;
        if (typeof value !== 'string') {
            throw new ValidationError('Module manifest "category" must be a string', { received: typeof value });
        }
        if (!VALID_CATEGORIES.includes(value)) {
            throw new ValidationError(`Invalid module category "${value}". Must be one of: ${VALID_CATEGORIES.join(', ')}`, { category: value, validCategories: [...VALID_CATEGORIES] });
        }
        return value;
    }
    _extractStringArray(obj, field) {
        const value = obj[field];
        if (!Array.isArray(value)) {
            throw new ValidationError(`Module manifest "${field}" must be an array of strings`, { field, received: typeof value });
        }
        for (const item of value) {
            if (typeof item !== 'string' || item.length === 0) {
                throw new ValidationError(`Module manifest "${field}" must contain only non-empty strings`, { field, item: typeof item });
            }
        }
        return value;
    }
    _extractOptionalStringArray(obj, field) {
        if (obj[field] === undefined) {
            return [];
        }
        return this._extractStringArray(obj, field);
    }
    _extractPermissions(obj) {
        const value = obj.permissions;
        if (!Array.isArray(value)) {
            throw new ValidationError('Module manifest "permissions" must be an array', { received: typeof value });
        }
        for (const perm of value) {
            if (typeof perm !== 'string' || !VALID_PERMISSIONS.includes(perm)) {
                throw new ValidationError(`Invalid permission "${String(perm)}". Must be one of: ${VALID_PERMISSIONS.join(', ')}`, { permission: perm, validPermissions: [...VALID_PERMISSIONS] });
            }
        }
        return value;
    }
    _extractEvents(obj) {
        const value = obj.events;
        if (value === null || typeof value !== 'object' || Array.isArray(value)) {
            throw new ValidationError('Module manifest "events" must be an object with "emits" and "listens" arrays', { received: typeof value });
        }
        const events = value;
        const emits = this._extractStringArray(events, 'emits');
        const listens = this._extractStringArray(events, 'listens');
        return { emits, listens };
    }
    _extractUI(obj) {
        const value = obj.ui;
        if (value === null || typeof value !== 'object' || Array.isArray(value)) {
            throw new ValidationError('Module manifest "ui" must be an object', { received: typeof value });
        }
        const ui = value;
        const entryPoint = this._extractString(ui, 'entryPoint');
        const icon = this._extractString(ui, 'icon');
        const result = {
            entryPoint,
            icon,
        };
        if (ui.panelMode !== undefined) {
            const mode = ui.panelMode;
            if (typeof mode !== 'string' ||
                !['tabbed', 'split', 'overlay', 'fullscreen'].includes(mode)) {
                throw new ValidationError(`Invalid panelMode "${String(mode)}". Must be one of: tabbed, split, overlay, fullscreen`, { panelMode: mode });
            }
            result.panelMode = mode;
        }
        return result;
    }
    _validateId(id, registeredIds) {
        const ids = registeredIds ?? this._registeredIds;
        if (ids.has(id)) {
            throw new ValidationError(`Duplicate module ID "${id}". A module with this ID is already registered.`, { moduleId: id });
        }
    }
    _validateVersion(version) {
        if (!SEMVER_REGEX.test(version)) {
            throw new ValidationError(`Invalid version "${version}". Must be valid semver (MAJOR.MINOR.PATCH).`, { version });
        }
    }
    _validateEventTypes(events) {
        for (const type of events.emits) {
            if (type.length === 0) {
                throw new ValidationError('Event type strings in "events.emits" must be non-empty', { eventType: type });
            }
        }
        for (const type of events.listens) {
            if (type.length === 0) {
                throw new ValidationError('Event type strings in "events.listens" must be non-empty', { eventType: type });
            }
        }
    }
}
//# sourceMappingURL=manifest-validator.js.map