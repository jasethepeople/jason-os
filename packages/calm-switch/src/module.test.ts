// ============================================================
// CalmSwitch — Test Suite
// ============================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CalmSwitch,
  createCalmSwitchModule,
  calm_switch_module,
} from './module.js';
import type { CalmState } from './types.js';

describe('CalmSwitch', () => {
  let calm: CalmSwitch;

  beforeEach(() => {
    calm = new CalmSwitch();
    // Use deterministic RNG for predictable test results
    calm.setRng(() => 0);
  });

  // ----------------------------------------------------------------
  // 1. Constructor creates instance with initial state
  // ----------------------------------------------------------------
  it('constructor creates instance with initial state', () => {
    const state = calm.getState();
    expect(state.active).toBe(false);
    expect(state.interventions).toBe(0);
    expect(state.lastActivatedAt).toBeNull();
    expect(state.currentTechnique).toBeNull();
    expect(state.transitionLog).toEqual([]);
  });

  // ----------------------------------------------------------------
  // 2. init resolves without error
  // ----------------------------------------------------------------
  it('init resolves without error', async () => {
    await expect(calm.init()).resolves.toBeUndefined();
  });

  // ----------------------------------------------------------------
  // 3. activate sets active state
  // ----------------------------------------------------------------
  it('activate sets active state', () => {
    calm.activate('anxious');
    expect(calm.isActive()).toBe(true);
  });

  // ----------------------------------------------------------------
  // 4. activate increments interventions
  // ----------------------------------------------------------------
  it('activate increments interventions', () => {
    calm.activate('angry');
    expect(calm.getInterventionCount()).toBe(1);
    calm.activate('sad');
    expect(calm.getInterventionCount()).toBe(2);
  });

  // ----------------------------------------------------------------
  // 5. activate sets lastActivatedAt
  // ----------------------------------------------------------------
  it('activate sets lastActivatedAt', () => {
    const before = Date.now();
    calm.activate('anxious');
    const after = Date.now();
    const state = calm.getState();
    expect(state.lastActivatedAt).not.toBeNull();
    expect(state.lastActivatedAt).toBeGreaterThanOrEqual(before);
    expect(state.lastActivatedAt).toBeLessThanOrEqual(after);
  });

  // ----------------------------------------------------------------
  // 6. activate selects technique from mapped pool
  // ----------------------------------------------------------------
  it('activate selects technique from mapped pool', () => {
    // With rng returning 0, always picks first technique
    calm.activate('angry');
    expect(calm.getState().currentTechnique).toBe('box-breathing');
  });

  // ----------------------------------------------------------------
  // 7. activate adds transition log entry
  // ----------------------------------------------------------------
  it('activate adds transition log entry', () => {
    calm.activate('anxious');
    const log = calm.getState().transitionLog;
    expect(log.length).toBe(1);
    expect(log[0]!.from).toBe('anxious');
    expect(log[0]!.to).toBe('calm');
    expect(log[0]!.technique).toBe('grounding-5-4-3-2-1');
    expect(log[0]!.at).toBeGreaterThan(0);
  });

  // ----------------------------------------------------------------
  // 8. activate emits event on bus
  // ----------------------------------------------------------------
  it('activate emits event on bus', () => {
    const emitFn = vi.fn();
    const bus = { emit: emitFn };
    const instance = new CalmSwitch(bus);
    instance.setRng(() => 0);
    instance.activate('sad');
    expect(emitFn).toHaveBeenCalledTimes(1);
    expect(emitFn).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'calm-switch:activated',
        data: { technique: 'compassion-focus', state: 'sad' },
        source: 'calm-switch',
      })
    );
  });

  // ----------------------------------------------------------------
  // 9. selectTechnique returns technique from state pool
  // ----------------------------------------------------------------
  it('selectTechnique returns technique from state pool', () => {
    calm.setRng(() => 0.5);
    const technique = calm.selectTechnique('anxious');
    expect(['grounding-5-4-3-2-1', 'tapping', 'vagus-nerve']).toContain(
      technique
    );
  });

  // ----------------------------------------------------------------
  // 10. selectTechnique falls back to default for unknown state
  // ----------------------------------------------------------------
  it('selectTechnique falls back to default for unknown state', () => {
    calm.setRng(() => 0);
    const technique = calm.selectTechnique('confused');
    expect(technique).toBe('box-breathing'); // first default
  });

  // ----------------------------------------------------------------
  // 11. deactivate clears active state
  // ----------------------------------------------------------------
  it('deactivate clears active state', () => {
    calm.activate('angry');
    expect(calm.isActive()).toBe(true);
    calm.deactivate();
    expect(calm.isActive()).toBe(false);
    expect(calm.getState().currentTechnique).toBeNull();
  });

  // ----------------------------------------------------------------
  // 12. getLastTransition returns most recent entry
  // ----------------------------------------------------------------
  it('getLastTransition returns most recent entry', () => {
    calm.setRng(() => 0);
    calm.activate('angry');
    calm.deactivate();
    calm.setRng(() => 0);
    calm.activate('sad');
    const last = calm.getLastTransition();
    expect(last).not.toBeNull();
    expect(last!.from).toBe('sad');
  });

  // ----------------------------------------------------------------
  // 13. getLastTransition returns null with empty log
  // ----------------------------------------------------------------
  it('getLastTransition returns null with empty log', () => {
    expect(calm.getLastTransition()).toBeNull();
  });

  // ----------------------------------------------------------------
  // 14. getTransitionsForState filters correctly
  // ----------------------------------------------------------------
  it('getTransitionsForState filters correctly', () => {
    calm.setRng(() => 0);
    calm.activate('angry');
    calm.deactivate();
    calm.activate('angry');
    calm.deactivate();
    calm.activate('sad');
    const angryTransitions = calm.getTransitionsForState('angry');
    expect(angryTransitions.length).toBe(2);
    const sadTransitions = calm.getTransitionsForState('sad');
    expect(sadTransitions.length).toBe(1);
  });

  // ----------------------------------------------------------------
  // 15. getState returns independent copy
  // ----------------------------------------------------------------
  it('getState returns independent copy', () => {
    calm.activate('angry');
    const state1: CalmState = calm.getState();
    calm.activate('sad');
    const state2: CalmState = calm.getState();
    expect(state1.transitionLog.length).toBe(1);
    expect(state2.transitionLog.length).toBe(2);
  });

  // ----------------------------------------------------------------
  // 16. clearLog empties transition log
  // ----------------------------------------------------------------
  it('clearLog empties transition log', () => {
    calm.activate('angry');
    calm.activate('sad');
    expect(calm.getState().transitionLog.length).toBe(2);
    calm.clearLog();
    expect(calm.getState().transitionLog.length).toBe(0);
  });

  // ----------------------------------------------------------------
  // 17. clearLog does not reset interventions
  // ----------------------------------------------------------------
  it('clearLog does not reset interventions', () => {
    calm.activate('angry');
    calm.activate('sad');
    calm.clearLog();
    expect(calm.getInterventionCount()).toBe(2);
  });

  // ----------------------------------------------------------------
  // 18. destroy resets all state
  // ----------------------------------------------------------------
  it('destroy resets all state', async () => {
    calm.activate('angry');
    calm.activate('sad');
    await calm.destroy();
    const state = calm.getState();
    expect(state.active).toBe(false);
    expect(state.interventions).toBe(0);
    expect(state.lastActivatedAt).toBeNull();
    expect(state.currentTechnique).toBeNull();
    expect(state.transitionLog.length).toBe(0);
  });

  // ----------------------------------------------------------------
  // 19. activate without bus does not throw
  // ----------------------------------------------------------------
  it('activate without bus does not throw', () => {
    expect(() => calm.activate('angry')).not.toThrow();
  });

  // ----------------------------------------------------------------
  // 20. activate with bus missing emit does not throw
  // ----------------------------------------------------------------
  it('activate with bus missing emit does not throw', () => {
    const bus = {};
    const instance = new CalmSwitch(bus);
    expect(() => instance.activate('angry')).not.toThrow();
  });

  // ----------------------------------------------------------------
  // 21. setTechniques overrides default mappings
  // ----------------------------------------------------------------
  it('setTechniques overrides default mappings', () => {
    calm.setTechniques({
      angry: ['scream-into-pillow', 'punching-bag'],
      default: ['box-breathing'],
    });
    calm.setRng(() => 0);
    const technique = calm.selectTechnique('angry');
    expect(technique).toBe('scream-into-pillow');
  });

  // ----------------------------------------------------------------
  // 22. getTechniquesForState returns techniques for a state
  // ----------------------------------------------------------------
  it('getTechniquesForState returns techniques for a state', () => {
    const techniques = calm.getTechniquesForState('angry');
    expect(techniques).toEqual([
      'box-breathing',
      'cold-water-face',
      'progressive-relaxation',
    ]);
  });

  // ----------------------------------------------------------------
  // 23. getTechniquesForState returns default for unknown state
  // ----------------------------------------------------------------
  it('getTechniquesForState returns default for unknown state', () => {
    const techniques = calm.getTechniquesForState('confused');
    expect(techniques).toEqual([
      'box-breathing',
      'soft-anchor',
      'quiet-moment',
    ]);
  });

  // ----------------------------------------------------------------
  // 24. RNG determinism via setRng
  // ----------------------------------------------------------------
  it('RNG determinism via setRng', () => {
    calm.setRng(() => 0.5);
    const t1 = calm.selectTechnique('angry');
    const t2 = calm.selectTechnique('angry');
    expect(t1).toBe(t2);
  });

  // ----------------------------------------------------------------
  // 25. All default emotion states have techniques
  // ----------------------------------------------------------------
  it('all default emotion states have techniques', () => {
    const states = ['angry', 'anxious', 'sad', 'overwhelmed'];
    for (const state of states) {
      const techniques = calm.getTechniquesForState(state);
      expect(techniques.length).toBeGreaterThan(0);
    }
  });

  // ----------------------------------------------------------------
  // 26. deactivate is idempotent
  // ----------------------------------------------------------------
  it('deactivate is idempotent', () => {
    calm.deactivate();
    expect(calm.isActive()).toBe(false);
    calm.deactivate();
    expect(calm.isActive()).toBe(false);
  });

  // ----------------------------------------------------------------
  // 27. activate after deactivate starts new intervention
  // ----------------------------------------------------------------
  it('activate after deactivate starts new intervention', () => {
    calm.setRng(() => 0);
    calm.activate('angry');
    calm.deactivate();
    calm.setRng(() => 1);
    calm.activate('anxious');
    expect(calm.getInterventionCount()).toBe(2);
    expect(calm.isActive()).toBe(true);
  });
});

describe('createCalmSwitchModule factory', () => {
  // ----------------------------------------------------------------
  // 28. Factory creates a working instance
  // ----------------------------------------------------------------
  it('factory creates a working instance', () => {
    const instance = createCalmSwitchModule();
    expect(instance).toBeDefined();
    expect(instance).toBeInstanceOf(CalmSwitch);
    instance.setRng(() => 0);
    instance.activate('angry');
    expect(instance.isActive()).toBe(true);
  });

  // ----------------------------------------------------------------
  // 29. Factory accepts optional bus parameter
  // ----------------------------------------------------------------
  it('factory accepts optional bus parameter', () => {
    const bus = { emit: () => undefined };
    const instance = createCalmSwitchModule(bus);
    expect(instance).toBeDefined();
  });
});

describe('calm_switch_module metadata', () => {
  // ----------------------------------------------------------------
  // 30. Module metadata is correct
  // ----------------------------------------------------------------
  it('module metadata is correct', () => {
    expect(calm_switch_module.id).toBe('calm-switch');
    expect(calm_switch_module.name).toBe('CalmSwitch');
    expect(calm_switch_module.category).toBe('emotional');
    expect(calm_switch_module.version).toBe('0.1.0');
    expect(calm_switch_module.permissions).toEqual([
      'telemetry:read',
      'events:emit',
    ]);
    expect(calm_switch_module.description).toBeDefined();
  });
});
