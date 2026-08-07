/**
 * shadow-mode-controller.test.ts — Comprehensive test suite for ShadowModeController
 *
 * Uses vitest (describe, it, expect).
 * Covers: activation, deactivation, triggers, decoy mode, hidden panels,
 * burner sessions, panic mode, duress password, stealth status, and events.
 */

import { describe, it, beforeEach, expect } from 'vitest';

import {
  ShadowModeControllerImpl,
  createShadowModeController,
} from './shadow-mode-controller.js';

import type {
  GhostTrigger,
  ShadowEventHandler,
  ActivationReason,
  StealthStatus,
  PrivacyTier,
  ShadowModeController,
} from './shadow-mode-controller.js';

// ------------------------------------------------------------------
// Inlined types for mock construction
// ------------------------------------------------------------------

interface Identity {
  id: string;
  type: 'CORE' | 'BURNER' | 'SHADOW';
  displayName: string;
  avatar?: string;
  createdAt: number;
  metadata?: Record<string, unknown>;
}

interface Session {
  id: string;
  token: string;
  identity: Identity;
  createdAt: number;
  expiresAt: number;
  privacyTier: PrivacyTier;
  isBurner: boolean;
  deviceFingerprint?: string;
}

interface IPrivacyKernel {
  getPrivacyTier(): PrivacyTier;
  setPrivacyTier(tier: PrivacyTier): void;
}

interface SessionManager {
  createBurnerSession(): Promise<Session>;
  listActiveSessions(): Session[];
  expireSession(sessionId: string): Promise<void>;
}

// ------------------------------------------------------------------
// Mocks
// ------------------------------------------------------------------

function createMockPrivacyKernel(): IPrivacyKernel {
  let tier: PrivacyTier = 'PUBLIC';
  return {
    getPrivacyTier: () => tier,
    setPrivacyTier: (t: PrivacyTier) => {
      tier = t;
    },
  };
}

function createMockSessionManager(): SessionManager {
  const sessions: Session[] = [];
  return {
    createBurnerSession: async () => {
      const session: Session = {
        id: `burner-${Date.now()}`,
        token: 'burner-token',
        identity: {
          id: 'burner-id',
          type: 'BURNER',
          displayName: 'Burner User',
          createdAt: Date.now(),
        },
        createdAt: Date.now(),
        expiresAt: Date.now() + 3600000,
        privacyTier: 'GHOST',
        isBurner: true,
      };
      sessions.push(session);
      return session;
    },
    listActiveSessions: () => [...sessions],
    expireSession: async (sessionId: string) => {
      const idx = sessions.findIndex((s) => s.id === sessionId);
      if (idx !== -1) sessions.splice(idx, 1);
    },
  };
}

// ------------------------------------------------------------------
// Test Suite
// ------------------------------------------------------------------

describe('ShadowModeController', () => {
  let privacyKernel: IPrivacyKernel;
  let sessionManager: SessionManager;
  let controller: ShadowModeControllerImpl;

  beforeEach(() => {
    privacyKernel = createMockPrivacyKernel();
    sessionManager = createMockSessionManager();
    controller = new ShadowModeControllerImpl(privacyKernel, sessionManager);
  });

  // ================================================================
  // 1. Activate shadow mode
  // ================================================================
  it('activate() sets isActive to true', () => {
    expect(controller.isActive()).toBe(false);
    controller.activate();
    expect(controller.isActive()).toBe(true);
    expect(privacyKernel.getPrivacyTier()).toBe('GHOST');
  });

  // ================================================================
  // 2. Deactivate shadow mode
  // ================================================================
  it('deactivate() sets isActive to false', () => {
    controller.activate();
    expect(controller.isActive()).toBe(true);
    controller.deactivate();
    expect(controller.isActive()).toBe(false);
    expect(privacyKernel.getPrivacyTier()).toBe('SOFT');
  });

  // ================================================================
  // 3. isActive returns correct state
  // ================================================================
  it('should return correct active state', () => {
    expect(controller.isActive()).toBe(false);
    controller.activate();
    expect(controller.isActive()).toBe(true);
    controller.deactivate();
    expect(controller.isActive()).toBe(false);
  });

  // ================================================================
  // 4. Activation reason tracked
  // ================================================================
  it('should track the activation reason', () => {
    controller.activate({ reason: 'hotkey' });
    expect(controller.getActivationReason()).toBe('hotkey');

    controller.deactivate();
    controller.activate({ reason: 'emotional-state' });
    expect(controller.getActivationReason()).toBe('emotional-state');
  });

  // ================================================================
  // 5. Register hotkey trigger
  // ================================================================
  it('should register a hotkey trigger', () => {
    const trigger: GhostTrigger = {
      id: 'hk-1',
      type: 'hotkey',
      config: { keyCombo: 'Ctrl+Shift+G' },
      active: true,
    };
    controller.registerTrigger(trigger);
    const triggers = controller.listTriggers();
    expect(triggers.length).toBe(1);
    expect(triggers[0].id).toBe('hk-1');
    expect(triggers[0].type).toBe('hotkey');
  });

  // ================================================================
  // 6. Register emotional trigger
  // ================================================================
  it('should register an emotional trigger', () => {
    const trigger: GhostTrigger = {
      id: 'em-1',
      type: 'emotional',
      config: { emotion: 'stress', threshold: 0.8 },
      active: true,
    };
    controller.registerTrigger(trigger);
    const triggers = controller.listTriggers();
    expect(triggers.length).toBe(1);
    expect(triggers[0].type).toBe('emotional');
    expect((triggers[0].config as { threshold: number }).threshold).toBe(0.8);
  });

  // ================================================================
  // 7. Register time trigger
  // ================================================================
  it('should register a time trigger', () => {
    const trigger: GhostTrigger = {
      id: 'tm-1',
      type: 'time',
      config: { schedule: '0 17 * * *' },
      active: true,
    };
    controller.registerTrigger(trigger);
    const triggers = controller.listTriggers();
    expect(triggers.length).toBe(1);
    expect(triggers[0].type).toBe('time');
  });

  // ================================================================
  // 8. Register inactivity trigger
  // ================================================================
  it('should register an inactivity trigger', () => {
    const trigger: GhostTrigger = {
      id: 'ia-1',
      type: 'inactivity',
      config: { timeoutMs: 300000 },
      active: true,
    };
    controller.registerTrigger(trigger);
    const triggers = controller.listTriggers();
    expect(triggers.length).toBe(1);
    expect(triggers[0].type).toBe('inactivity');
    expect((triggers[0].config as { timeoutMs: number }).timeoutMs).toBe(300000);
  });

  // ================================================================
  // 9. Remove trigger
  // ================================================================
  it('should remove a trigger by id', () => {
    controller.registerTrigger({
      id: 'hk-1',
      type: 'hotkey',
      config: { keyCombo: 'Ctrl+Shift+G' },
      active: true,
    });
    expect(controller.listTriggers().length).toBe(1);
    controller.removeTrigger('hk-1');
    expect(controller.listTriggers().length).toBe(0);
  });

  // ================================================================
  // 10. Decoy mode enabled
  // ================================================================
  it('setDecoyMode toggles decoy on', () => {
    expect(controller.isDecoyMode()).toBe(false);
    controller.setDecoyMode(true);
    expect(controller.isDecoyMode()).toBe(true);
  });

  // ================================================================
  // 11. Decoy mode disabled
  // ================================================================
  it('setDecoyMode toggles decoy off', () => {
    controller.setDecoyMode(true);
    expect(controller.isDecoyMode()).toBe(true);
    controller.setDecoyMode(false);
    expect(controller.isDecoyMode()).toBe(false);
  });

  // ================================================================
  // 12. Hidden panels tracked
  // ================================================================
  it('should track hidden panels', () => {
    controller.togglePanelVisibility('vault-panel');
    controller.togglePanelVisibility('identity-panel');
    const hidden = controller.getHiddenPanels();
    expect(hidden.includes('vault-panel')).toBe(true);
    expect(hidden.includes('identity-panel')).toBe(true);
    expect(hidden.length).toBe(2);
  });

  // ================================================================
  // 13. Toggle panel visibility
  // ================================================================
  it('should toggle panel visibility on and off', () => {
    controller.togglePanelVisibility('settings-panel');
    expect(controller.getHiddenPanels().includes('settings-panel')).toBe(true);
    controller.togglePanelVisibility('settings-panel');
    expect(controller.getHiddenPanels().includes('settings-panel')).toBe(false);
  });

  // ================================================================
  // 14. Create burner session on activate
  // ================================================================
  it('createBurnerSession creates a burner', async () => {
    controller.activate({ switchToBurner: true });

    // Allow the async createBurnerSession to settle
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(controller.isBurnerActive()).toBe(true);
  });

  // ================================================================
  // 15. Panic mode burns everything
  // ================================================================
  it('panic() sets everything to locked-down state', () => {
    controller.panic();

    expect(controller.isActive()).toBe(true);
    expect(controller.getActivationReason()).toBe('panic');
    expect(privacyKernel.getPrivacyTier()).toBe('GHOST');
    expect(controller.isDecoyMode()).toBe(true);
    expect(controller.isBurnerActive()).toBe(true);
  });

  // ================================================================
  // 16. Duress password set and detected
  // ================================================================
  it('should set and detect duress password', () => {
    controller.setDuressPassword('duress123');

    // Duress detection returns true and triggers panic
    const result = controller.checkDuressPassword('duress123');
    expect(result).toBe(true);
    expect(controller.isActive()).toBe(true);
    expect(controller.getActivationReason()).toBe('panic');
  });

  // ================================================================
  // 17. Manual activation
  // ================================================================
  it('should support manual activation', () => {
    controller.activate({ reason: 'manual' });
    expect(controller.isActive()).toBe(true);
    expect(controller.getActivationReason()).toBe('manual');
  });

  // ================================================================
  // 18. Emotional activation (stress threshold)
  // ================================================================
  it('should activate via emotional trigger when stress exceeds threshold', () => {
    controller.registerTrigger({
      id: 'stress-trigger',
      type: 'emotional',
      config: { emotion: 'stress', threshold: 0.75 },
      active: true,
    });

    const fired = controller.checkTriggers({ emotion: 'stress', stress: 0.9 });
    expect(fired.includes('stress-trigger')).toBe(true);
  });

  // ================================================================
  // 19. Coercion trigger detected
  // ================================================================
  it('should detect coercion trigger via duress signal', () => {
    controller.registerTrigger({
      id: 'coercion-1',
      type: 'coercion',
      config: { duressSignal: 'forced-unlock-attempt' },
      active: true,
    });

    const fired = controller.checkTriggers({ emotion: 'forced-unlock-attempt' });
    expect(fired.includes('coercion-1')).toBe(true);
  });

  // ================================================================
  // 20. Stealth status complete
  // ================================================================
  it('should return a complete stealth status', () => {
    controller.activate({
      reason: 'hotkey',
      hidePanels: ['panel-a', 'panel-b'],
      decoyMode: true,
    });

    const status = controller.getStealthStatus();
    expect(status.active).toBe(true);
    expect(status.since).toBeGreaterThan(0);
    expect(status.reason).toBe('hotkey');
    expect(status.hiddenPanels).toBe(2);
    expect(status.decoyEnabled).toBe(true);
    expect(status.encrypted).toBe(true);
  });

  // ================================================================
  // 21. Activate event emitted
  // ================================================================
  it('should emit activate event', () => {
    let received = false;
    controller.on('activate', (event) => {
      received = true;
      expect(event.type).toBe('activate');
      expect(event.reason).toBe('manual');
    });

    controller.activate({ reason: 'manual' });
    expect(received).toBe(true);
  });

  // ================================================================
  // 22. Deactivate event emitted
  // ================================================================
  it('should emit deactivate event', () => {
    let received = false;
    controller.on('deactivate', (event) => {
      received = true;
      expect(event.type).toBe('deactivate');
    });

    controller.activate();
    controller.deactivate();
    expect(received).toBe(true);
  });

  // ================================================================
  // 23. Panic event emitted
  // ================================================================
  it('should emit panic event', () => {
    let received = false;
    controller.on('panic', (event) => {
      received = true;
      expect(event.type).toBe('panic');
      expect(event.reason).toBe('panic');
    });

    controller.panic();
    expect(received).toBe(true);
  });

  // ================================================================
  // 24. Multiple triggers can be active
  // ================================================================
  it('should support multiple active triggers', () => {
    controller.registerTrigger({
      id: 'hk-1',
      type: 'hotkey',
      config: { keyCombo: 'Ctrl+Shift+G' },
      active: true,
    });
    controller.registerTrigger({
      id: 'em-1',
      type: 'emotional',
      config: { emotion: 'stress', threshold: 0.8 },
      active: true,
    });
    controller.registerTrigger({
      id: 'tm-1',
      type: 'time',
      config: { schedule: '0 17 * * *' },
      active: true,
    });
    controller.registerTrigger({
      id: 'ia-1',
      type: 'inactivity',
      config: { timeoutMs: 300000 },
      active: true,
    });

    const triggers = controller.listTriggers();
    expect(triggers.length).toBe(4);

    // All should be independently retrievable
    const ids = triggers.map((t) => t.id).sort();
    expect(ids).toEqual(['em-1', 'hk-1', 'ia-1', 'tm-1']);
  });

  // ================================================================
  // Additional edge-case and validation tests
  // ================================================================

  it('should not re-activate when already active', () => {
    controller.activate();
    expect(controller.isActive()).toBe(true);

    // Second activate: tier should still be GHOST (set once)
    const tier = privacyKernel.getPrivacyTier();
    controller.activate();
    expect(privacyKernel.getPrivacyTier()).toBe(tier);
  });

  it('should not deactivate when already inactive', () => {
    // deactivate without activate should be a no-op
    controller.deactivate();
    expect(privacyKernel.getPrivacyTier()).toBe('PUBLIC');
  });

  it('should throw on invalid trigger type', () => {
    expect(() =>
      controller.registerTrigger({
        id: 'bad',
        type: 'invalid' as never,
        config: {},
        active: true,
      }),
    ).toThrow(/Invalid trigger type/);
  });

  it('should throw on missing trigger id', () => {
    expect(() =>
      controller.registerTrigger({
        id: '',
        type: 'hotkey',
        config: { keyCombo: 'Ctrl+G' },
        active: true,
      }),
    ).toThrow(/non-empty string id/);
  });

  it('should return empty array when no triggers match emotional context', () => {
    controller.registerTrigger({
      id: 'stress-trigger',
      type: 'emotional',
      config: { emotion: 'stress', threshold: 0.75 },
      active: true,
    });

    // Stress too low
    const firedLow = controller.checkTriggers({ emotion: 'stress', stress: 0.5 });
    expect(firedLow.length).toBe(0);

    // Wrong emotion
    const firedWrong = controller.checkTriggers({ emotion: 'joy', stress: 0.9 });
    expect(firedWrong.length).toBe(0);
  });

  it('should return false for non-matching duress password', () => {
    controller.setDuressPassword('secret-duress');
    const result = controller.checkDuressPassword('wrong-password');
    expect(result).toBe(false);
    expect(controller.isActive()).toBe(false);
  });

  it('should allow event handler unsubscription', () => {
    let callCount = 0;
    const handler = () => {
      callCount++;
    };
    const unsubscribe = controller.on('activate', handler);

    controller.activate();
    expect(callCount).toBe(1);

    unsubscribe();
    controller.deactivate();
    controller.activate();
    // Handler should not have been called again
    expect(callCount).toBe(1);
  });

  it('should include panels in activation options', () => {
    controller.activate({
      hidePanels: ['vault', 'chat', 'identity'],
    });
    const hidden = controller.getHiddenPanels();
    expect(hidden).toEqual(['vault', 'chat', 'identity']);
  });

  it('factory function should create a controller instance', () => {
    const ctrl = createShadowModeController(privacyKernel, sessionManager);
    expect(ctrl).toBeInstanceOf(ShadowModeControllerImpl);
    ctrl.activate();
    expect(ctrl.isActive()).toBe(true);
  });

  it('checkTriggers should skip inactive triggers', () => {
    controller.registerTrigger({
      id: 'inactive-trigger',
      type: 'emotional',
      config: { emotion: 'stress', threshold: 0.1 },
      active: false,
    });

    const fired = controller.checkTriggers({ emotion: 'stress', stress: 0.99 });
    expect(fired.length).toBe(0);
  });

  it('panic should expire all active sessions', () => {
    // Pre-populate a session
    sessionManager.createBurnerSession();

    controller.panic();
    // After panic, the session manager should have had expireSession called
    expect(sessionManager.listActiveSessions().length).toBe(0);
  });

  it('stealth status reflects burner active after panic', () => {
    controller.panic();
    const status = controller.getStealthStatus();
    expect(status.burnerActive).toBe(true);
    expect(status.active).toBe(true);
    expect(status.reason).toBe('panic');
  });
});
