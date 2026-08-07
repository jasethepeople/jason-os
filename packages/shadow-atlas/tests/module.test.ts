import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ShadowAtlas, createShadowAtlasModule, shadow_atlas_module } from '../src/module.js';
import type { AtlasState } from '../src/types.js';

describe('shadow_atlas_module', () => {
  it('should export correct module metadata', () => {
    expect(shadow_atlas_module.id).toBe('shadow-atlas');
    expect(shadow_atlas_module.name).toBe('ShadowAtlas');
    expect(shadow_atlas_module.category).toBe('identity');
    expect(shadow_atlas_module.version).toBe('0.1.0');
    expect(shadow_atlas_module.permissions).toEqual([
      'identity:read',
      'telemetry:read',
    ]);
    expect(shadow_atlas_module.description).toBe(
      'Visual identity map with emotional state tracking'
    );
  });
});

describe('ShadowAtlas', () => {
  let shadowAtlas: ShadowAtlas;

  beforeEach(() => {
    shadowAtlas = new ShadowAtlas();
  });

  describe('lifecycle', () => {
    it('should initialize without error', async () => {
      await expect(shadowAtlas.init()).resolves.toBeUndefined();
    });

    it('should destroy without error', async () => {
      await expect(shadowAtlas.destroy()).resolves.toBeUndefined();
    });

    it('should return initial state', () => {
      const state = shadowAtlas.getState();
      expect(state.personas).toEqual([]);
      expect(state.activePersonaId).toBeNull();
      expect(state.overlapScore).toBe(0);
    });
  });

  describe('registerPersona', () => {
    it('should register a persona without emotional state', () => {
      shadowAtlas.registerPersona('p1', 'Work Persona');
      const state = shadowAtlas.getState();

      expect(state.personas).toHaveLength(1);
      expect(state.personas[0].id).toBe('p1');
      expect(state.personas[0].displayName).toBe('Work Persona');
      expect(state.personas[0].emotionalState).toBeUndefined();
    });

    it('should register a persona with emotional state', () => {
      shadowAtlas.registerPersona('p2', 'Creative', { valence: 0.8, stress: 0.2 });
      const state = shadowAtlas.getState();

      expect(state.personas[0].emotionalState).toEqual({
        valence: 0.8,
        stress: 0.2,
      });
    });

    it('should register multiple personas', () => {
      shadowAtlas.registerPersona('p1', 'Persona 1');
      shadowAtlas.registerPersona('p2', 'Persona 2');
      shadowAtlas.registerPersona('p3', 'Persona 3');

      const state = shadowAtlas.getState();
      expect(state.personas).toHaveLength(3);
    });
  });

  describe('setActive', () => {
    it('should set active persona id', () => {
      shadowAtlas.registerPersona('p1', 'Work');
      shadowAtlas.setActive('p1');

      const state = shadowAtlas.getState();
      expect(state.activePersonaId).toBe('p1');
    });

    it('should update active persona id', () => {
      shadowAtlas.registerPersona('p1', 'Work');
      shadowAtlas.registerPersona('p2', 'Home');
      shadowAtlas.setActive('p1');
      shadowAtlas.setActive('p2');

      const state = shadowAtlas.getState();
      expect(state.activePersonaId).toBe('p2');
    });
  });

  describe('computeOverlap', () => {
    it('should be 0 with no personas', () => {
      const state = shadowAtlas.getState();
      expect(state.overlapScore).toBe(0);
    });

    it('should be 0 with one persona', () => {
      shadowAtlas.registerPersona('p1', 'Solo');
      const state = shadowAtlas.getState();
      expect(state.overlapScore).toBe(0);
    });

    it('should calculate overlap for multiple personas', () => {
      shadowAtlas.registerPersona('p1', 'Persona 1');
      shadowAtlas.registerPersona('p2', 'Persona 2');
      // overlapScore = (2 - 1) * 0.15 = 0.15
      expect(shadowAtlas.getState().overlapScore).toBeCloseTo(0.15, 5);
    });

    it('should increase overlap with more personas', () => {
      shadowAtlas.registerPersona('p1', 'P1');
      shadowAtlas.registerPersona('p2', 'P2');
      shadowAtlas.registerPersona('p3', 'P3');
      // overlapScore = (3 - 1) * 0.15 = 0.30
      expect(shadowAtlas.getState().overlapScore).toBeCloseTo(0.30, 5);
    });
  });

  describe('getState immutability', () => {
    it('should return a copy of personas array', () => {
      shadowAtlas.registerPersona('p1', 'Test');
      const state1 = shadowAtlas.getState();
      const state2 = shadowAtlas.getState();

      expect(state1.personas).not.toBe(state2.personas);
    });

    it('should return a copy of state object', () => {
      const state1 = shadowAtlas.getState();
      const state2 = shadowAtlas.getState();

      expect(state1).not.toBe(state2);
    });
  });
});

describe('createShadowAtlasModule', () => {
  it('should create a ShadowAtlas instance', () => {
    const mod = createShadowAtlasModule();
    expect(mod).toBeInstanceOf(ShadowAtlas);
  });

  it('should pass bus to constructor', () => {
    const bus = { emit: vi.fn() };
    const mod = createShadowAtlasModule(bus);
    expect(mod).toBeInstanceOf(ShadowAtlas);
  });
});
