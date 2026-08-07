import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Underveil, createUnderveilModule, underveil_module } from './module.js';
import type { Veil, UnderveilState } from './types.js';

describe('Underveil — module definition', () => {
  it('should export correct module metadata', () => {
    expect(underveil_module.id).toBe('underveil');
    expect(underveil_module.name).toBe('Underveil');
    expect(underveil_module.category).toBe('communication');
    expect(underveil_module.version).toBe('0.1.0');
    expect(underveil_module.permissions).toEqual([
      'identity:read',
      'storage:write',
    ]);
    expect(underveil_module.description).toBe(
      'Consent-based communication veils for identity protection'
    );
  });
});

describe('Underveil — construction', () => {
  it('should create instance without bus', () => {
    const uv = new Underveil();
    expect(uv).toBeDefined();
    expect(uv.getState()).toEqual({
      veils: [],
      consentGiven: false,
      consentTimestamp: null,
      activeVeilId: null,
    });
  });

  it('should create instance with bus', () => {
    const bus = { emit: vi.fn() };
    const uv = new Underveil(bus);
    expect(uv).toBeDefined();
  });

  it('should init without error', async () => {
    const uv = new Underveil();
    await expect(uv.init()).resolves.toBeUndefined();
  });

  it('should create via factory', () => {
    const uv = createUnderveilModule();
    expect(uv).toBeInstanceOf(Underveil);
  });
});

describe('Underveil — consent management', () => {
  it('should not have consent by default', () => {
    const uv = new Underveil();
    expect(uv.getState().consentGiven).toBe(false);
    expect(uv.getState().consentTimestamp).toBeNull();
  });

  it('should give consent', () => {
    const uv = new Underveil();
    uv.giveConsent();
    expect(uv.getState().consentGiven).toBe(true);
    expect(uv.getState().consentTimestamp).not.toBeNull();
  });

  it('should revoke consent', () => {
    const uv = new Underveil();
    uv.giveConsent();
    expect(uv.getState().consentGiven).toBe(true);
    uv.revokeConsent();
    expect(uv.getState().consentGiven).toBe(false);
    expect(uv.getState().consentTimestamp).toBeNull();
    expect(uv.getState().activeVeilId).toBeNull();
  });

  it('should emit consent-given event', () => {
    const emit = vi.fn();
    const uv = new Underveil({ emit });
    uv.giveConsent();
    expect(emit).toHaveBeenCalledWith({
      type: 'underveil:consent-given',
      data: {},
      source: 'underveil',
    });
  });

  it('should emit consent-revoked event', () => {
    const emit = vi.fn();
    const uv = new Underveil({ emit });
    uv.giveConsent();
    uv.revokeConsent();
    expect(emit).toHaveBeenCalledWith({
      type: 'underveil:consent-revoked',
      data: {},
      source: 'underveil',
    });
  });
});

describe('Underveil — veil management', () => {
  it('should create a veil', () => {
    const uv = new Underveil();
    const veil = uv.createVeil('work-persona');
    expect(veil.label).toBe('work-persona');
    expect(veil.active).toBe(false);
    expect(veil.id.startsWith('veil-')).toBe(true);
    expect(veil.createdAt).toBeGreaterThan(0);
  });

  it('should create multiple veils', () => {
    const uv = new Underveil();
    uv.createVeil('work');
    uv.createVeil('personal');
    uv.createVeil('anonymous');
    expect(uv.getState().veils.length).toBe(3);
  });

  it('should throw when activating veil without consent', () => {
    const uv = new Underveil();
    const veil = uv.createVeil('test');
    expect(() => uv.activateVeil(veil.id)).toThrow(
      'Consent required before activating veil'
    );
  });

  it('should activate a veil with consent', () => {
    const uv = new Underveil();
    uv.giveConsent();
    const veil = uv.createVeil('test');
    uv.activateVeil(veil.id);
    expect(uv.getState().activeVeilId).toBe(veil.id);
    expect(uv.getActiveVeil()?.id).toBe(veil.id);
    expect(uv.getActiveVeil()?.active).toBe(true);
  });

  it('should deactivate other veils when activating one', () => {
    const uv = new Underveil();
    uv.giveConsent();
    const v1 = uv.createVeil('first');
    const v2 = uv.createVeil('second');
    uv.activateVeil(v1.id);
    uv.activateVeil(v2.id);
    expect(uv.getActiveVeil()?.id).toBe(v2.id);
    expect(uv.getState().veils.find((v) => v.id === v1.id)?.active).toBe(false);
    expect(uv.getState().veils.find((v) => v.id === v2.id)?.active).toBe(true);
  });

  it('should return null for active veil when none is active', () => {
    const uv = new Underveil();
    expect(uv.getActiveVeil()).toBeNull();
  });

  it('should return null for active veil after consent revocation', () => {
    const uv = new Underveil();
    uv.giveConsent();
    const veil = uv.createVeil('test');
    uv.activateVeil(veil.id);
    expect(uv.getActiveVeil()).not.toBeNull();
    uv.revokeConsent();
    expect(uv.getActiveVeil()).toBeNull();
  });
});

describe('Underveil — state immutability', () => {
  it('should return a copy of state, not reference', () => {
    const uv = new Underveil();
    const state1 = uv.getState();
    uv.giveConsent();
    const state2 = uv.getState();
    expect(state1).not.toBe(state2);
    expect(state1.consentGiven).toBe(false);
    expect(state2.consentGiven).toBe(true);
    expect(state1.consentGiven).toBe(false);
    expect(state2.consentGiven).toBe(true);
  });

  it('should return a copy of veils array', () => {
    const uv = new Underveil();
    uv.createVeil('test');
    const state = uv.getState();
    state.veils.push({ id: 'fake', label: 'fake', active: false, createdAt: 0 });
    expect(uv.getState().veils.length).toBe(1);
  });
});

describe('Underveil — destroy', () => {
  it('should destroy cleanly', async () => {
    const uv = new Underveil();
    uv.giveConsent();
    uv.createVeil('test');
    await expect(uv.destroy()).resolves.toBeUndefined();
  });
});
