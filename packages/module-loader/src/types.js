export class Sandbox {
    _perms;
    _breaches = [];
    _quarantined = false;
    _breachThreshold = 3;
    constructor(perms = {}) {
        this._perms = {
            file: false,
            network: false,
            storage: true,
            telemetry: false,
            clipboard: false,
            filesystem: false,
            llm: false,
            notifications: false,
            ...perms,
        };
    }
    check(action) {
        const allowed = this._perms[action];
        if (!allowed) {
            this._breaches.push(`Denied ${action} at ${new Date().toISOString()}`);
            if (this._breaches.length >= this._breachThreshold) {
                this._quarantined = true;
            }
        }
        return allowed;
    }
    getBreaches() {
        return [...this._breaches];
    }
    isQuarantined() {
        return this._quarantined;
    }
    quarantine() {
        this._quarantined = true;
    }
    reset() {
        this._breaches = [];
        this._quarantined = false;
    }
    getPermissions() {
        return { ...this._perms };
    }
}
export function createSandbox(perms) {
    return new Sandbox(perms);
}
//# sourceMappingURL=types.js.map