// ============================================================
// Jason-OS Shared Types — Single Source of Truth
// Phase 0 + Phase 1 Foundation
// Reconstructed from dist/index.d.ts — all packages depend on this
// ============================================================
// ------------------------------------------------------------------
// Errors
// ------------------------------------------------------------------
export class JasonOSError extends Error {
    code;
    context;
    constructor(message, code, context) {
        super(message);
        this.code = code;
        this.context = context;
        this.name = 'JasonOSError';
    }
}
export class PrivacyError extends JasonOSError {
    constructor(message, context) {
        super(message, 'PRIVACY_VIOLATION', context);
        this.name = 'PrivacyError';
    }
}
export class ModuleError extends JasonOSError {
    constructor(message, context) {
        super(message, 'MODULE_ERROR', context);
        this.name = 'ModuleError';
    }
}
export class ValidationError extends JasonOSError {
    constructor(message, context) {
        super(message, 'VALIDATION_ERROR', context);
        this.name = 'ValidationError';
    }
}
//# sourceMappingURL=index.js.map