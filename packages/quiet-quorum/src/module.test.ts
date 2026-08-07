// ============================================================
// QuietQuorum — Test Suite
// ============================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  QuietQuorum,
  createQuietQuorumModule,
  quiet_quorum_module,
} from './module.js';
import type { QuorumState } from './types.js';

describe('QuietQuorum', () => {
  let quorum: QuietQuorum;

  beforeEach(() => {
    quorum = new QuietQuorum();
  });

  // ----------------------------------------------------------------
  // 1. Constructor creates instance with initial state
  // ----------------------------------------------------------------
  it('constructor creates instance with initial state', () => {
    const state = quorum.getState();
    expect(state.decisionId).toBeNull();
    expect(state.options).toEqual([]);
    expect(state.consensusReached).toBe(false);
    expect(state.winningOptionId).toBeNull();
    expect(state.moduleVotes.size).toBe(0);
  });

  // ----------------------------------------------------------------
  // 2. init resolves without error
  // ----------------------------------------------------------------
  it('init resolves without error', async () => {
    await expect(quorum.init()).resolves.toBeUndefined();
  });

  // ----------------------------------------------------------------
  // 3. proposeDecision sets decision and options
  // ----------------------------------------------------------------
  it('proposeDecision sets decision and options', () => {
    quorum.proposeDecision('dec-1', [
      { id: 'opt-a', label: 'Option A' },
      { id: 'opt-b', label: 'Option B' },
    ]);
    expect(quorum.getActiveDecision()).toBe('dec-1');
    const state = quorum.getState();
    expect(state.options.length).toBe(2);
    expect(state.options[0]!.id).toBe('opt-a');
    expect(state.options[0]!.label).toBe('Option A');
    expect(state.options[0]!.votes).toBe(0);
    expect(state.options[0]!.score).toBe(0);
  });

  // ----------------------------------------------------------------
  // 4. proposeDecision throws on empty options
  // ----------------------------------------------------------------
  it('proposeDecision throws on empty options', () => {
    expect(() => quorum.proposeDecision('dec-1', [])).toThrow(
      'Decision must have at least one option'
    );
  });

  // ----------------------------------------------------------------
  // 5. vote increments option votes
  // ----------------------------------------------------------------
  it('vote increments option votes', () => {
    quorum.proposeDecision('dec-1', [
      { id: 'opt-a', label: 'Option A' },
      { id: 'opt-b', label: 'Option B' },
    ]);
    quorum.vote('mod-1', 'opt-a', 1.0);
    const state = quorum.getState();
    expect(state.options[0]!.votes).toBe(1);
    expect(state.options[0]!.moduleSources).toContain('mod-1');
  });

  // ----------------------------------------------------------------
  // 6. vote throws when no active decision
  // ----------------------------------------------------------------
  it('vote throws when no active decision', () => {
    expect(() => quorum.vote('mod-1', 'opt-a', 1.0)).toThrow(
      'No active decision'
    );
  });

  // ----------------------------------------------------------------
  // 7. vote throws for invalid option
  // ----------------------------------------------------------------
  it('vote throws for invalid option', () => {
    quorum.proposeDecision('dec-1', [
      { id: 'opt-a', label: 'Option A' },
    ]);
    expect(() => quorum.vote('mod-1', 'opt-z', 1.0)).toThrow(
      'Option "opt-z" not found'
    );
  });

  // ----------------------------------------------------------------
  // 8. vote throws for weight out of range
  // ----------------------------------------------------------------
  it('vote throws for weight out of range', () => {
    quorum.proposeDecision('dec-1', [
      { id: 'opt-a', label: 'Option A' },
    ]);
    expect(() => quorum.vote('mod-1', 'opt-a', -0.5)).toThrow(
      'Vote weight must be between 0 and 1'
    );
    expect(() => quorum.vote('mod-1', 'opt-a', 1.5)).toThrow(
      'Vote weight must be between 0 and 1'
    );
  });

  // ----------------------------------------------------------------
  // 9. vote changes previous vote from same module
  // ----------------------------------------------------------------
  it('vote changes previous vote from same module', () => {
    quorum.proposeDecision('dec-1', [
      { id: 'opt-a', label: 'Option A' },
      { id: 'opt-b', label: 'Option B' },
    ]);
    quorum.vote('mod-1', 'opt-a', 1.0);
    quorum.vote('mod-1', 'opt-b', 1.0);
    const state = quorum.getState();
    expect(state.options[0]!.votes).toBe(0);
    expect(state.options[1]!.votes).toBe(1);
    expect(state.moduleVotes.get('mod-1')).toBe('opt-b');
  });

  // ----------------------------------------------------------------
  // 10. tally calculates scores correctly
  // ----------------------------------------------------------------
  it('tally calculates scores correctly', () => {
    quorum.proposeDecision('dec-1', [
      { id: 'opt-a', label: 'Option A' },
      { id: 'opt-b', label: 'Option B' },
    ]);
    quorum.vote('mod-1', 'opt-a', 1.0);
    quorum.vote('mod-2', 'opt-a', 1.0);
    quorum.vote('mod-3', 'opt-b', 1.0);
    const state = quorum.tally();
    expect(state.options[0]!.score).toBe(2 / 3);
    expect(state.options[1]!.score).toBe(1 / 3);
  });

  // ----------------------------------------------------------------
  // 11. consensus detected at 60% threshold
  // ----------------------------------------------------------------
  it('consensus detected at 60% threshold', () => {
    quorum.proposeDecision('dec-1', [
      { id: 'opt-a', label: 'Option A' },
      { id: 'opt-b', label: 'Option B' },
    ]);
    quorum.vote('mod-1', 'opt-a', 1.0);
    quorum.vote('mod-2', 'opt-a', 1.0);
    quorum.vote('mod-3', 'opt-a', 1.0);
    // 3/3 = 100% >= 60%
    const state = quorum.getState();
    expect(state.consensusReached).toBe(true);
    expect(state.winningOptionId).toBe('opt-a');
  });

  // ----------------------------------------------------------------
  // 12. no consensus below threshold
  // ----------------------------------------------------------------
  it('no consensus below threshold', () => {
    quorum.proposeDecision('dec-1', [
      { id: 'opt-a', label: 'Option A' },
      { id: 'opt-b', label: 'Option B' },
    ]);
    quorum.vote('mod-1', 'opt-a', 1.0);
    quorum.vote('mod-2', 'opt-b', 1.0);
    // 1/2 = 50% < 60%
    const state = quorum.getState();
    expect(state.consensusReached).toBe(false);
    expect(state.winningOptionId).toBeNull();
  });

  // ----------------------------------------------------------------
  // 13. getConsensus returns correct result
  // ----------------------------------------------------------------
  it('getConsensus returns correct result', () => {
    quorum.proposeDecision('dec-1', [
      { id: 'opt-a', label: 'Option A' },
      { id: 'opt-b', label: 'Option B' },
    ]);
    quorum.vote('mod-1', 'opt-a', 1.0);
    quorum.vote('mod-2', 'opt-a', 1.0);
    quorum.vote('mod-3', 'opt-a', 1.0);
    const result = quorum.getConsensus();
    expect(result.reached).toBe(true);
    expect(result.winner).toBe('opt-a');
    expect(result.score).toBe(1);
  });

  // ----------------------------------------------------------------
  // 14. getConsensus returns null before consensus
  // ----------------------------------------------------------------
  it('getConsensus returns null before consensus', () => {
    quorum.proposeDecision('dec-1', [
      { id: 'opt-a', label: 'Option A' },
    ]);
    const result = quorum.getConsensus();
    expect(result.reached).toBe(false);
    expect(result.winner).toBeNull();
    expect(result.score).toBe(0);
  });

  // ----------------------------------------------------------------
  // 15. getState returns independent copy
  // ----------------------------------------------------------------
  it('getState returns independent copy', () => {
    quorum.proposeDecision('dec-1', [
      { id: 'opt-a', label: 'Option A' },
    ]);
    const state1: QuorumState = quorum.getState();
    quorum.vote('mod-1', 'opt-a', 1.0);
    const state2: QuorumState = quorum.getState();
    expect(state1.moduleVotes.size).toBe(0);
    expect(state2.moduleVotes.size).toBe(1);
  });

  // ----------------------------------------------------------------
  // 16. hasVoted returns correct result
  // ----------------------------------------------------------------
  it('hasVoted returns correct result', () => {
    quorum.proposeDecision('dec-1', [
      { id: 'opt-a', label: 'Option A' },
    ]);
    expect(quorum.hasVoted('mod-1')).toBe(false);
    quorum.vote('mod-1', 'opt-a', 1.0);
    expect(quorum.hasVoted('mod-1')).toBe(true);
  });

  // ----------------------------------------------------------------
  // 17. getModuleVote returns correct vote
  // ----------------------------------------------------------------
  it('getModuleVote returns correct vote', () => {
    quorum.proposeDecision('dec-1', [
      { id: 'opt-a', label: 'Option A' },
      { id: 'opt-b', label: 'Option B' },
    ]);
    quorum.vote('mod-1', 'opt-b', 1.0);
    expect(quorum.getModuleVote('mod-1')).toBe('opt-b');
    expect(quorum.getModuleVote('mod-x')).toBeUndefined();
  });

  // ----------------------------------------------------------------
  // 18. getVoterCount returns correct count
  // ----------------------------------------------------------------
  it('getVoterCount returns correct count', () => {
    quorum.proposeDecision('dec-1', [
      { id: 'opt-a', label: 'Option A' },
    ]);
    expect(quorum.getVoterCount()).toBe(0);
    quorum.vote('mod-1', 'opt-a', 1.0);
    expect(quorum.getVoterCount()).toBe(1);
    quorum.vote('mod-2', 'opt-a', 1.0);
    expect(quorum.getVoterCount()).toBe(2);
  });

  // ----------------------------------------------------------------
  // 19. endDecision resets state
  // ----------------------------------------------------------------
  it('endDecision resets state', () => {
    quorum.proposeDecision('dec-1', [
      { id: 'opt-a', label: 'Option A' },
    ]);
    quorum.vote('mod-1', 'opt-a', 1.0);
    quorum.endDecision();
    const state = quorum.getState();
    expect(state.decisionId).toBeNull();
    expect(state.options).toEqual([]);
    expect(state.consensusReached).toBe(false);
    expect(state.winningOptionId).toBeNull();
    expect(state.moduleVotes.size).toBe(0);
  });

  // ----------------------------------------------------------------
  // 20. destroy resets all state
  // ----------------------------------------------------------------
  it('destroy resets all state', async () => {
    quorum.proposeDecision('dec-1', [
      { id: 'opt-a', label: 'Option A' },
    ]);
    quorum.vote('mod-1', 'opt-a', 1.0);
    await quorum.destroy();
    expect(quorum.getActiveDecision()).toBeNull();
    expect(quorum.getVoterCount()).toBe(0);
  });

  // ----------------------------------------------------------------
  // 21. vote emits quorum:vote-cast event
  // ----------------------------------------------------------------
  it('vote emits quorum:vote-cast event', () => {
    const emitFn = vi.fn();
    const bus = { emit: emitFn };
    const instance = new QuietQuorum(bus);
    instance.proposeDecision('dec-1', [
      { id: 'opt-a', label: 'Option A' },
    ]);
    instance.vote('mod-1', 'opt-a', 0.8);
    expect(emitFn).toHaveBeenCalledTimes(1);
    const call = emitFn.mock.calls[0]![0] as Record<string, unknown>;
    expect(call.type).toBe('quorum:vote-cast');
    expect((call.data as Record<string, unknown>).moduleId).toBe('mod-1');
    expect((call.data as Record<string, unknown>).optionId).toBe('opt-a');
    expect((call.data as Record<string, unknown>).weight).toBe(0.8);
  });

  // ----------------------------------------------------------------
  // 22. consensus emits quorum:consensus-reached event
  // ----------------------------------------------------------------
  it('consensus emits quorum:consensus-reached event', () => {
    const emitFn = vi.fn();
    const bus = { emit: emitFn };
    const instance = new QuietQuorum(bus);
    instance.proposeDecision('dec-1', [
      { id: 'opt-a', label: 'Option A' },
      { id: 'opt-b', label: 'Option B' },
    ]);
    instance.vote('mod-1', 'opt-a', 1.0);
    instance.vote('mod-2', 'opt-a', 1.0);
    instance.vote('mod-3', 'opt-a', 1.0);
    expect(emitFn).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'quorum:consensus-reached',
        data: expect.objectContaining({
          winningOptionId: 'opt-a',
          winningScore: 1,
        }),
        source: 'quiet-quorum',
      })
    );
  });

  // ----------------------------------------------------------------
  // 23. custom consensus threshold via config
  // ----------------------------------------------------------------
  it('custom consensus threshold via config', () => {
    const instance = new QuietQuorum(undefined, { consensusThreshold: 0.3 });
    instance.proposeDecision('dec-1', [
      { id: 'opt-a', label: 'Option A' },
      { id: 'opt-b', label: 'Option B' },
    ]);
    instance.vote('mod-1', 'opt-a', 1.0);
    instance.vote('mod-2', 'opt-b', 1.0);
    instance.vote('mod-3', 'opt-a', 1.0);
    // 2/3 = 66.7% >= 30%
    expect(instance.getConsensus().reached).toBe(true);
  });

  // ----------------------------------------------------------------
  // 24. multiple options with split votes
  // ----------------------------------------------------------------
  it('multiple options with split votes', () => {
    quorum.proposeDecision('dec-1', [
      { id: 'opt-a', label: 'Option A' },
      { id: 'opt-b', label: 'Option B' },
      { id: 'opt-c', label: 'Option C' },
    ]);
    quorum.vote('mod-1', 'opt-a', 1.0);
    quorum.vote('mod-2', 'opt-b', 1.0);
    quorum.vote('mod-3', 'opt-c', 1.0);
    quorum.vote('mod-4', 'opt-a', 1.0);
    // opt-a: 2/4 = 50% < 60% — no consensus
    expect(quorum.getConsensus().reached).toBe(false);
  });

  // ----------------------------------------------------------------
  // 25. getActiveDecision returns null after endDecision
  // ----------------------------------------------------------------
  it('getActiveDecision returns null after endDecision', () => {
    quorum.proposeDecision('dec-1', [
      { id: 'opt-a', label: 'Option A' },
    ]);
    expect(quorum.getActiveDecision()).toBe('dec-1');
    quorum.endDecision();
    expect(quorum.getActiveDecision()).toBeNull();
  });

  // ----------------------------------------------------------------
  // 26. vote with weight 0 does not affect scores
  // ----------------------------------------------------------------
  it('vote with weight 0 is valid', () => {
    quorum.proposeDecision('dec-1', [
      { id: 'opt-a', label: 'Option A' },
    ]);
    quorum.vote('mod-1', 'opt-a', 0);
    expect(quorum.hasVoted('mod-1')).toBe(true);
    expect(quorum.getVoterCount()).toBe(1);
  });

  // ----------------------------------------------------------------
  // 27. proposeDecision resets previous decision state
  // ----------------------------------------------------------------
  it('proposeDecision resets previous decision state', () => {
    quorum.proposeDecision('dec-1', [
      { id: 'opt-a', label: 'Option A' },
    ]);
    quorum.vote('mod-1', 'opt-a', 1.0);
    quorum.proposeDecision('dec-2', [
      { id: 'opt-x', label: 'Option X' },
    ]);
    expect(quorum.getActiveDecision()).toBe('dec-2');
    expect(quorum.getVoterCount()).toBe(0);
  });

  // ----------------------------------------------------------------
  // 28. tally returns state without votes
  // ----------------------------------------------------------------
  it('tally returns state without votes', () => {
    quorum.proposeDecision('dec-1', [
      { id: 'opt-a', label: 'Option A' },
    ]);
    const state = quorum.tally();
    expect(state.options[0]!.score).toBe(0);
    expect(state.consensusReached).toBe(false);
  });
});

describe('createQuietQuorumModule factory', () => {
  // ----------------------------------------------------------------
  // 29. Factory creates a working instance
  // ----------------------------------------------------------------
  it('factory creates a working instance', () => {
    const instance = createQuietQuorumModule();
    expect(instance).toBeDefined();
    expect(instance).toBeInstanceOf(QuietQuorum);
  });

  // ----------------------------------------------------------------
  // 30. Factory accepts bus and config parameters
  // ----------------------------------------------------------------
  it('factory accepts bus and config parameters', () => {
    const bus = { emit: () => undefined };
    const instance = createQuietQuorumModule(bus, { consensusThreshold: 0.75 });
    expect(instance).toBeDefined();
  });
});

describe('quiet_quorum_module metadata', () => {
  // ----------------------------------------------------------------
  // 31. Module metadata is correct
  // ----------------------------------------------------------------
  it('module metadata is correct', () => {
    expect(quiet_quorum_module.id).toBe('quiet-quorum');
    expect(quiet_quorum_module.name).toBe('QuietQuorum');
    expect(quiet_quorum_module.category).toBe('productivity');
    expect(quiet_quorum_module.version).toBe('0.1.0');
    expect(quiet_quorum_module.permissions).toEqual([
      'events:emit',
      'events:listen',
    ]);
    expect(quiet_quorum_module.description).toBeDefined();
  });
});
