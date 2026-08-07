/**
 * shadow-mode-controller.ts — Shadow Mode Controller for Jason-OS
 *
 * The privacy emergency system. When activated, it makes Jason-OS disappear.
 * Features: ghost mode activation, stealth behavior, decoy UI, panic mode,
 * duress password, hidden panels, burner sessions, and configurable triggers.
 */
// ------------------------------------------------------------------
// Validation helpers
// ------------------------------------------------------------------
function isValidTriggerType(type) {
    return ['hotkey', 'time', 'emotional', 'inactivity', 'coercion'].includes(type);
}
function validateTriggerConfig(type, config) {
    switch (type) {
        case 'hotkey':
            if (!('keyCombo' in config) || typeof config.keyCombo !== 'string') {
                throw new Error('Hotkey trigger requires a string "keyCombo"');
            }
            break;
        case 'time':
            if (!('schedule' in config) || typeof config.schedule !== 'string') {
                throw new Error('Time trigger requires a string "schedule"');
            }
            break;
        case 'emotional':
            if (!('emotion' in config) ||
                typeof config.emotion !== 'string' ||
                !('threshold' in config) ||
                typeof config.threshold !== 'number') {
                throw new Error('Emotional trigger requires "emotion" (string) and "threshold" (number)');
            }
            break;
        case 'inactivity':
            if (!('timeoutMs' in config) || typeof config.timeoutMs !== 'number') {
                throw new Error('Inactivity trigger requires a number "timeoutMs"');
            }
            break;
        case 'coercion':
            if (!('duressSignal' in config) || typeof config.duressSignal !== 'string') {
                throw new Error('Coercion trigger requires a string "duressSignal"');
            }
            break;
        default:
            throw new Error(`Unknown trigger type: ${type}`);
    }
}
// ------------------------------------------------------------------
// ShadowModeControllerImpl
// ------------------------------------------------------------------
export class ShadowModeControllerImpl {
    _active = false;
    _activatedAt = 0;
    _reason = 'manual';
    _triggers = new Map();
    _hiddenPanels = new Set();
    _decoyMode = false;
    _burnerActive = false;
    _duressPassword = null;
    _handlers = new Map();
    _privacyKernel;
    _sessionManager;
    constructor(privacyKernel, sessionManager) {
        this._privacyKernel = privacyKernel;
        this._sessionManager = sessionManager;
    }
    // ================================================================
    // Activation
    // ================================================================
    /**
     * Activate shadow mode — the privacy emergency system engages.
     *
     * 1. Set privacy tier to GHOST.
     * 2. Hide specified panels.
     * 3. Optionally enable decoy mode.
     * 4. Optionally create a burner session.
     * 5. Emit the 'activate' event.
     */
    activate(options = {}) {
        if (this._active)
            return;
        const reason = options.reason ?? 'manual';
        this._reason = reason;
        this._active = true;
        this._activatedAt = Date.now();
        // Step 1: Elevate privacy tier to GHOST
        this._privacyKernel.setPrivacyTier('GHOST');
        // Step 2: Hide requested panels
        if (options.hidePanels) {
            for (const panelId of options.hidePanels) {
                this._hiddenPanels.add(panelId);
            }
        }
        // Step 3: Enable decoy mode if requested
        if (options.decoyMode) {
            this._decoyMode = true;
        }
        // Step 4: Create burner session if requested
        if (options.switchToBurner) {
            this.createBurnerSession();
        }
        // Step 5: Notify listeners
        this._emit('activate', reason);
    }
    /**
     * Deactivate shadow mode — restore normal operation.
     *
     * 1. Restore privacy tier to SOFT.
     * 2. Show all hidden panels.
     * 3. Disable decoy mode.
     * 4. Reset burner state.
     * 5. Emit the 'deactivate' event.
     */
    deactivate() {
        if (!this._active)
            return;
        this._active = false;
        this._activatedAt = 0;
        this._reason = 'manual';
        // Restore privacy tier
        this._privacyKernel.setPrivacyTier('SOFT');
        // Show all panels
        this._hiddenPanels.clear();
        // Disable decoy
        this._decoyMode = false;
        // Reset burner state
        this._burnerActive = false;
        this._emit('deactivate');
    }
    /** Returns whether shadow mode is currently active. */
    isActive() {
        return this._active;
    }
    /** Returns the most recent activation reason. */
    getActivationReason() {
        return this._reason;
    }
    // ================================================================
    // Triggers
    // ================================================================
    /**
     * Register a new ghost trigger.
     *
     * Validates the trigger type and config shape before storing.
     */
    registerTrigger(trigger) {
        if (!trigger.id || typeof trigger.id !== 'string') {
            throw new Error('Trigger must have a non-empty string id');
        }
        if (!isValidTriggerType(trigger.type)) {
            throw new Error(`Invalid trigger type: ${trigger.type}`);
        }
        validateTriggerConfig(trigger.type, trigger.config);
        this._triggers.set(trigger.id, { ...trigger });
    }
    /** Remove a trigger by its id. */
    removeTrigger(triggerId) {
        this._triggers.delete(triggerId);
    }
    /** List all registered triggers. */
    listTriggers() {
        return Array.from(this._triggers.values());
    }
    /**
     * Evaluate all active triggers and return matching trigger IDs.
     *
     * This is called by the trigger scheduler / event loop. It checks
     * each active trigger against the current system state and returns
     * a list of trigger IDs that have fired.
     */
    checkTriggers(context) {
        const fired = [];
        for (const [id, trigger] of this._triggers) {
            if (!trigger.active)
                continue;
            switch (trigger.type) {
                case 'emotional': {
                    const cfg = trigger.config;
                    if (context?.emotion === cfg.emotion &&
                        context?.stress !== undefined &&
                        context.stress >= cfg.threshold) {
                        fired.push(id);
                    }
                    break;
                }
                case 'hotkey':
                    // Hotkey triggers are evaluated by the keyboard event handler
                    break;
                case 'time':
                    // Time triggers are evaluated by a cron scheduler
                    break;
                case 'inactivity':
                    // Inactivity triggers are evaluated by an idle timer
                    break;
                case 'coercion': {
                    const cfg = trigger.config;
                    if (context?.emotion === cfg.duressSignal) {
                        fired.push(id);
                    }
                    break;
                }
            }
        }
        return fired;
    }
    // ================================================================
    // Stealth behavior
    // ================================================================
    /** Get a snapshot of the current stealth status. */
    getStealthStatus() {
        const tier = this._privacyKernel.getPrivacyTier();
        return {
            active: this._active,
            since: this._activatedAt,
            reason: this._reason,
            hiddenPanels: this._hiddenPanels.size,
            decoyEnabled: this._decoyMode,
            burnerActive: this._burnerActive,
            encrypted: tier === 'SHADOW' || tier === 'GHOST',
        };
    }
    /** Enable or disable decoy mode. */
    setDecoyMode(enabled) {
        this._decoyMode = enabled;
    }
    /** Returns whether decoy mode is currently enabled. */
    isDecoyMode() {
        return this._decoyMode;
    }
    // ================================================================
    // Hidden UI
    // ================================================================
    /** Returns a list of currently hidden panel IDs. */
    getHiddenPanels() {
        return Array.from(this._hiddenPanels);
    }
    /** Toggle a panel's visibility (hide if visible, show if hidden). */
    togglePanelVisibility(panelId) {
        if (this._hiddenPanels.has(panelId)) {
            this._hiddenPanels.delete(panelId);
        }
        else {
            this._hiddenPanels.add(panelId);
        }
    }
    // ================================================================
    // Burner session
    // ================================================================
    /** Create a burner session via the session manager. */
    createBurnerSession() {
        void this._sessionManager.createBurnerSession().then(() => {
            this._burnerActive = true;
        });
    }
    /** Returns whether a burner session is active. */
    isBurnerActive() {
        return this._burnerActive;
    }
    // ================================================================
    // Emergency
    // ================================================================
    /**
     * Immediate full lockdown — PANIC mode.
     *
     * 1. Activate ghost mode with reason 'panic'.
     * 2. Burn all active sessions (expunge them).
     * 3. Set privacy tier to GHOST (maximum).
     * 4. Enable decoy mode.
     * 5. Emit the 'panic' event.
     */
    panic() {
        this._active = true;
        this._activatedAt = Date.now();
        this._reason = 'panic';
        // Maximum privacy tier
        this._privacyKernel.setPrivacyTier('GHOST');
        // Burn all sessions
        for (const session of this._sessionManager.listActiveSessions()) {
            void this._sessionManager.expireSession(session.id);
        }
        // Enable decoy
        this._decoyMode = true;
        // Hide everything
        this._burnerActive = true;
        // Notify listeners
        this._emit('panic', 'panic');
    }
    /** Set the duress password — entering this password triggers panic mode. */
    setDuressPassword(password) {
        this._duressPassword = password;
    }
    /**
     * Check whether the supplied password matches the duress password.
     *
     * If it matches, automatically triggers panic mode and returns true.
     * Otherwise returns false.
     */
    checkDuressPassword(password) {
        if (this._duressPassword !== null && password === this._duressPassword) {
            this.panic();
            return true;
        }
        return false;
    }
    // ================================================================
    // Events
    // ================================================================
    /**
     * Subscribe to a shadow mode lifecycle event.
     *
     * Returns an unsubscribe function.
     */
    on(event, handler) {
        const list = this._handlers.get(event) ?? [];
        list.push(handler);
        this._handlers.set(event, list);
        return () => {
            const updated = this._handlers.get(event) ?? [];
            const idx = updated.indexOf(handler);
            if (idx !== -1) {
                updated.splice(idx, 1);
                this._handlers.set(event, updated);
            }
        };
    }
    // ================================================================
    // Internal
    // ================================================================
    _emit(event, reason) {
        const timestamp = Date.now();
        const payload = { type: event, timestamp, ...(reason !== undefined ? { reason } : {}) };
        const handlers = this._handlers.get(event) ?? [];
        for (const handler of handlers) {
            try {
                handler(payload);
            }
            catch {
                // Handler errors must not break the controller
            }
        }
    }
}
// ================================================================
// Factory
// ================================================================
/**
 * Create a new ShadowModeController instance.
 */
export function createShadowModeController(privacyKernel, sessionManager) {
    return new ShadowModeControllerImpl(privacyKernel, sessionManager);
}
//# sourceMappingURL=shadow-mode-controller.js.map