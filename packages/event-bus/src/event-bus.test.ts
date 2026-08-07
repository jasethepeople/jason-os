// ============================================================
// EventBus Tests — Comprehensive Coverage
// Vitest + Strict TypeScript
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventBusImpl, createEventBus } from './event-bus.js';
import type { EventPayload, Subscription } from '@jason-os/shared';

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => queueMicrotask(resolve));
}

// ------------------------------------------------------------------
// Test Suite
// ------------------------------------------------------------------

describe('EventBusImpl', () => {
  let bus: EventBusImpl;

  beforeEach(() => {
    bus = new EventBusImpl();
  });

  // ================================================================
  // 1. Basic emit/on flow
  // ================================================================
  describe('basic emit/on flow', () => {
    it('should deliver an event to a subscriber', async () => {
      const handler = vi.fn();
      bus.on('test.event', handler);

      bus.emit({
        type: 'test.event',
        payload: { foo: 'bar' },
        priority: 'NORMAL',
        source: 'test',
        traceId: 'trace-1',
      });

      await flushMicrotasks();

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'test.event',
          payload: { foo: 'bar' },
        }),
      );
    });

    it('should deliver multiple events to the same subscriber', async () => {
      const handler = vi.fn();
      bus.on('multi.event', handler);

      bus.emit({ type: 'multi.event', payload: 1, priority: 'NORMAL', source: 'test', traceId: 't1' });
      bus.emit({ type: 'multi.event', payload: 2, priority: 'NORMAL', source: 'test', traceId: 't2' });

      await flushMicrotasks();

      expect(handler).toHaveBeenCalledTimes(2);
    });

    it('should support different payload types', async () => {
      const stringHandler = vi.fn();
      const numberHandler = vi.fn();
      const objectHandler = vi.fn();

      bus.on('str', stringHandler);
      bus.on('num', numberHandler);
      bus.on('obj', objectHandler);

      bus.emit({ type: 'str', payload: 'hello', priority: 'NORMAL', source: 'test', traceId: 't1' });
      bus.emit({ type: 'num', payload: 42, priority: 'NORMAL', source: 'test', traceId: 't2' });
      bus.emit({ type: 'obj', payload: { nested: true }, priority: 'NORMAL', source: 'test', traceId: 't3' });

      await flushMicrotasks();

      expect(stringHandler).toHaveBeenCalledWith(expect.objectContaining({ payload: 'hello' }));
      expect(numberHandler).toHaveBeenCalledWith(expect.objectContaining({ payload: 42 }));
      expect(objectHandler).toHaveBeenCalledWith(expect.objectContaining({ payload: { nested: true } }));
    });
  });

  // ================================================================
  // 2. Priority ordering
  // ================================================================
  describe('priority ordering', () => {
    it('should dispatch CRITICAL events synchronously', () => {
      const handler = vi.fn();
      bus.on('crit.event', handler, { priority: 'CRITICAL' });

      bus.emit({
        type: 'crit.event',
        payload: null,
        priority: 'CRITICAL',
        source: 'test',
        traceId: 't1',
      });

      // No await needed — CRITICAL is sync
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should dispatch HIGH/NORMAL/LOW/BACKGROUND asynchronously', async () => {
      const handler = vi.fn();
      bus.on('async.event', handler, { priority: 'HIGH' });

      bus.emit({
        type: 'async.event',
        payload: null,
        priority: 'HIGH',
        source: 'test',
        traceId: 't1',
      });

      // Should NOT be called synchronously
      expect(handler).not.toHaveBeenCalled();

      await flushMicrotasks();

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should process multiple priorities in correct order', async () => {
      const order: string[] = [];

      bus.on('order.test', () => { order.push('BACKGROUND'); }, { priority: 'BACKGROUND' });
      bus.on('order.test', () => { order.push('LOW'); }, { priority: 'LOW' });
      bus.on('order.test', () => { order.push('NORMAL'); }, { priority: 'NORMAL' });
      bus.on('order.test', () => { order.push('HIGH'); }, { priority: 'HIGH' });
      bus.on('order.test', () => { order.push('CRITICAL'); }, { priority: 'CRITICAL' });

      bus.emit({
        type: 'order.test',
        payload: null,
        priority: 'NORMAL',
        source: 'test',
        traceId: 't1',
      });

      // CRITICAL fires immediately (sync)
      expect(order).toEqual(['CRITICAL']);

      await flushMicrotasks();

      // Others fire in priority order via microtask
      expect(order).toEqual(['CRITICAL', 'HIGH', 'NORMAL', 'LOW', 'BACKGROUND']);
    });

    it('should default to NORMAL priority when not specified', async () => {
      const handler = vi.fn();
      bus.on('default.priority', handler);

      bus.emit({
        type: 'default.priority',
        payload: null,
        priority: 'NORMAL',
        source: 'test',
        traceId: 't1',
      });

      expect(handler).not.toHaveBeenCalled();
      await flushMicrotasks();
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  // ================================================================
  // 3. Once subscriptions auto-remove
  // ================================================================
  describe('once subscriptions', () => {
    it('should auto-remove after first fire', async () => {
      const handler = vi.fn();
      bus.once('once.event', handler);

      bus.emit({ type: 'once.event', payload: 1, priority: 'NORMAL', source: 'test', traceId: 't1' });
      bus.emit({ type: 'once.event', payload: 2, priority: 'NORMAL', source: 'test', traceId: 't2' });

      await flushMicrotasks();

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ payload: 1 }));
    });

    it('should work with CRITICAL priority', () => {
      const handler = vi.fn();
      bus.once('once.crit', handler, { priority: 'CRITICAL' });

      bus.emit({ type: 'once.crit', payload: 1, priority: 'CRITICAL', source: 'test', traceId: 't1' });
      bus.emit({ type: 'once.crit', payload: 2, priority: 'CRITICAL', source: 'test', traceId: 't2' });

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  // ================================================================
  // 4. Off/unsubscribe cleanup
  // ================================================================
  describe('off/unsubscribe cleanup', () => {
    it('should remove a subscription with off()', async () => {
      const handler = vi.fn();
      const sub = bus.on('off.test', handler);

      bus.off(sub);

      bus.emit({ type: 'off.test', payload: null, priority: 'NORMAL', source: 'test', traceId: 't1' });
      await flushMicrotasks();

      expect(handler).not.toHaveBeenCalled();
    });

    it('should remove a subscription with unsubscribe()', async () => {
      const handler = vi.fn();
      const sub = bus.subscribe('unsub.test', handler);

      bus.unsubscribe(sub);

      bus.emit({ type: 'unsub.test', payload: null, priority: 'NORMAL', source: 'test', traceId: 't1' });
      await flushMicrotasks();

      expect(handler).not.toHaveBeenCalled();
    });

    it('should not affect other subscribers when removing one', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const sub1 = bus.on('multi.sub', handler1);
      bus.on('multi.sub', handler2);

      bus.off(sub1);

      bus.emit({ type: 'multi.sub', payload: null, priority: 'NORMAL', source: 'test', traceId: 't1' });
      await flushMicrotasks();

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('should report zero subscribers after cleanup', () => {
      const sub = bus.on('count.test', () => {});
      expect(bus.getSubscriberCount('count.test')).toBe(1);

      bus.off(sub);
      expect(bus.getSubscriberCount('count.test')).toBe(0);
    });
  });

  // ================================================================
  // 5. Glob pattern matching
  // ================================================================
  describe('glob pattern matching', () => {
    it('should match exact event types', async () => {
      const handler = vi.fn();
      bus.on('exact.match', handler);

      bus.emit({ type: 'exact.match', payload: null, priority: 'NORMAL', source: 'test', traceId: 't1' });
      await flushMicrotasks();

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should match wildcard * for one segment', async () => {
      const handler = vi.fn();
      bus.subscribe('user.*', handler);

      bus.emit({ type: 'user.login', payload: null, priority: 'NORMAL', source: 'test', traceId: 't1' });
      bus.emit({ type: 'user.logout', payload: null, priority: 'NORMAL', source: 'test', traceId: 't2' });
      bus.emit({ type: 'user.profile.update', payload: null, priority: 'NORMAL', source: 'test', traceId: 't3' });

      await flushMicrotasks();

      // user.* matches user.login and user.logout but NOT user.profile.update
      expect(handler).toHaveBeenCalledTimes(2);
    });

    it('should match double-wildcard ** for any path', async () => {
      const handler = vi.fn();
      bus.subscribe('app.**', handler);

      bus.emit({ type: 'app.init', payload: null, priority: 'NORMAL', source: 'test', traceId: 't1' });
      bus.emit({ type: 'app.module.load', payload: null, priority: 'NORMAL', source: 'test', traceId: 't2' });
      bus.emit({ type: 'app.deep.nested.event', payload: null, priority: 'NORMAL', source: 'test', traceId: 't3' });

      await flushMicrotasks();

      expect(handler).toHaveBeenCalledTimes(3);
    });

    it('should match wildcard in the middle of a pattern', async () => {
      const handler = vi.fn();
      bus.subscribe('a.*.c', handler);

      bus.emit({ type: 'a.b.c', payload: null, priority: 'NORMAL', source: 'test', traceId: 't1' });
      bus.emit({ type: 'a.x.c', payload: null, priority: 'NORMAL', source: 'test', traceId: 't2' });
      bus.emit({ type: 'a.b.d', payload: null, priority: 'NORMAL', source: 'test', traceId: 't3' });

      await flushMicrotasks();

      expect(handler).toHaveBeenCalledTimes(2);
    });

    it('should match ** at end of pattern (prefix match)', async () => {
      const handler = vi.fn();
      bus.subscribe('system.**', handler);

      bus.emit({ type: 'system.start', payload: null, priority: 'NORMAL', source: 'test', traceId: 't1' });
      bus.emit({ type: 'system.submodule.init', payload: null, priority: 'NORMAL', source: 'test', traceId: 't2' });
      bus.emit({ type: 'other.system', payload: null, priority: 'NORMAL', source: 'test', traceId: 't3' });

      await flushMicrotasks();

      expect(handler).toHaveBeenCalledTimes(2);
    });

    it('should not match if segments differ before wildcard', async () => {
      const handler = vi.fn();
      bus.subscribe('foo.*', handler);

      bus.emit({ type: 'bar.baz', payload: null, priority: 'NORMAL', source: 'test', traceId: 't1' });
      await flushMicrotasks();

      expect(handler).not.toHaveBeenCalled();
    });
  });

  // ================================================================
  // 6. Broadcast reaches pattern subscribers too
  // ================================================================
  describe('broadcast', () => {
    it('should deliver to both exact and pattern subscribers', async () => {
      const exactHandler = vi.fn();
      const patternHandler = vi.fn();

      bus.on('user.login', exactHandler);
      bus.subscribe('user.*', patternHandler);

      bus.broadcast({ type: 'user.login', payload: null, priority: 'NORMAL', source: 'test', traceId: 't1' });
      await flushMicrotasks();

      expect(exactHandler).toHaveBeenCalledTimes(1);
      expect(patternHandler).toHaveBeenCalledTimes(1);
    });

    it('should not deliver pattern subscribers on regular emit', async () => {
      const exactHandler = vi.fn();
      const patternHandler = vi.fn();

      bus.on('user.login', exactHandler);
      bus.subscribe('user.*', patternHandler);

      bus.emit({ type: 'user.login', payload: null, priority: 'NORMAL', source: 'test', traceId: 't1' });
      await flushMicrotasks();

      expect(exactHandler).toHaveBeenCalledTimes(1);
      expect(patternHandler).not.toHaveBeenCalled();
    });

    it('should deliver broadcast CRITICAL sync to pattern subs too', () => {
      const patternHandler = vi.fn();
      bus.subscribe('crit.**', patternHandler, { priority: 'CRITICAL' });

      bus.broadcast({ type: 'crit.alert', payload: null, priority: 'CRITICAL', source: 'test', traceId: 't1' });

      expect(patternHandler).toHaveBeenCalledTimes(1);
    });
  });

  // ================================================================
  // 7. Dead letter queue
  // ================================================================
  describe('dead letter queue', () => {
    it('should store events with no subscribers', () => {
      bus.emit({ type: 'orphan.event', payload: { data: 1 }, priority: 'NORMAL', source: 'test', traceId: 't1' });

      expect(bus.getDeadLetterCount()).toBe(1);
      const dlq = bus.getDeadLetterQueue();
      expect(dlq[0]).toMatchObject({ type: 'orphan.event', payload: { data: 1 } });
    });

    it('should NOT store events that have subscribers', async () => {
      bus.on('subscribed.event', () => {});

      bus.emit({ type: 'subscribed.event', payload: null, priority: 'NORMAL', source: 'test', traceId: 't1' });
      await flushMicrotasks();

      expect(bus.getDeadLetterCount()).toBe(0);
    });

    it('should NOT store broadcast events that have pattern subscribers', () => {
      bus.subscribe('pattern.**', () => {});

      bus.broadcast({ type: 'pattern.match', payload: null, priority: 'NORMAL', source: 'test', traceId: 't1' });

      expect(bus.getDeadLetterCount()).toBe(0);
    });

    it('should cap dead letter queue at 10000 entries', () => {
      // Emit 10050 events with no subscribers
      for (let i = 0; i < 10_050; i++) {
        bus.emit({
          type: `dlq.event.${i}`,
          payload: i,
          priority: 'NORMAL',
          source: 'test',
          traceId: `t${i}`,
        });
      }

      expect(bus.getDeadLetterCount()).toBe(10_000);
    });
  });

  // ================================================================
  // 8. Trace ID auto-generation
  // ================================================================
  describe('trace ID auto-generation', () => {
    it('should auto-generate traceId when not provided', async () => {
      const handler = vi.fn();
      bus.on('trace.test', handler);

      bus.emit({
        type: 'trace.test',
        payload: null,
        priority: 'NORMAL',
        source: 'test',
        // no traceId
      } as Omit<EventPayload, 'timestamp' | 'traceId'>);

      await flushMicrotasks();

      const received = handler.mock.calls[0][0] as EventPayload;
      expect(received.traceId).toBeDefined();
      expect(received.traceId.length).toBeGreaterThan(0);
    });

    it('should use provided traceId when given', async () => {
      const handler = vi.fn();
      bus.on('trace.provided', handler);

      bus.emit({
        type: 'trace.provided',
        payload: null,
        priority: 'NORMAL',
        source: 'test',
        traceId: 'my-custom-trace',
      });

      await flushMicrotasks();

      const received = handler.mock.calls[0][0] as EventPayload;
      expect(received.traceId).toBe('my-custom-trace');
    });

    it('should auto-generate timestamp when not provided', async () => {
      const handler = vi.fn();
      bus.on('ts.test', handler);

      const before = Date.now();
      bus.emit({
        type: 'ts.test',
        payload: null,
        priority: 'NORMAL',
        source: 'test',
        traceId: 't1',
      });
      const after = Date.now();

      await flushMicrotasks();

      const received = handler.mock.calls[0][0] as EventPayload;
      expect(received.timestamp).toBeGreaterThanOrEqual(before);
      expect(received.timestamp).toBeLessThanOrEqual(after);
    });
  });

  // ================================================================
  // 9. Error isolation
  // ================================================================
  describe('error isolation', () => {
    it('should not let a throwing handler break other handlers', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const goodHandler = vi.fn();
      const badHandler = vi.fn().mockImplementation(() => {
        throw new Error('boom');
      });

      bus.on('error.test', badHandler);
      bus.on('error.test', goodHandler);

      bus.emit({ type: 'error.test', payload: null, priority: 'NORMAL', source: 'test', traceId: 't1' });
      await flushMicrotasks();

      expect(badHandler).toHaveBeenCalledTimes(1);
      expect(goodHandler).toHaveBeenCalledTimes(1);

      consoleSpy.mockRestore();
    });

    it('should catch async errors from handlers', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const goodHandler = vi.fn();
      const badHandler = vi.fn().mockImplementation(() => {
        return Promise.reject(new Error('async boom'));
      });

      bus.on('async.error', badHandler);
      bus.on('async.error', goodHandler);

      bus.emit({ type: 'async.error', payload: null, priority: 'NORMAL', source: 'test', traceId: 't1' });
      await flushMicrotasks();
      // Wait a tick for the promise rejection to be caught
      await wait(10);

      expect(badHandler).toHaveBeenCalledTimes(1);
      expect(goodHandler).toHaveBeenCalledTimes(1);

      consoleSpy.mockRestore();
    });

    it('should log handler errors to console.error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      bus.on('log.error', () => {
        throw new Error('intentional failure');
      });

      bus.emit({ type: 'log.error', payload: null, priority: 'NORMAL', source: 'test', traceId: 't1' });
      await flushMicrotasks();

      expect(consoleSpy).toHaveBeenCalledWith(
        '[EventBus] Handler error for "log.error":',
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });
  });

  // ================================================================
  // 10. Concurrent event handling
  // ================================================================
  describe('concurrent event handling', () => {
    it('should handle many subscribers for one event', async () => {
      const handlers: ReturnType<typeof vi.fn>[] = [];
      const count = 100;

      for (let i = 0; i < count; i++) {
        const h = vi.fn();
        handlers.push(h);
        bus.on('concurrent.many', h);
      }

      bus.emit({ type: 'concurrent.many', payload: null, priority: 'NORMAL', source: 'test', traceId: 't1' });
      await flushMicrotasks();

      for (const h of handlers) {
        expect(h).toHaveBeenCalledTimes(1);
      }
    });

    it('should handle events with 1000 subscribers within 5ms', async () => {
      const handler = (): void => {
        // Minimal work
      };
      const count = 1_000;

      for (let i = 0; i < count; i++) {
        bus.on('perf.test', handler);
      }

      const start = performance.now();
      bus.emit({ type: 'perf.test', payload: null, priority: 'CRITICAL', source: 'test', traceId: 't1' });
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(5);
    });

    it('should handle interleaved event types independently', async () => {
      const handlerA = vi.fn();
      const handlerB = vi.fn();

      bus.on('type.a', handlerA);
      bus.on('type.b', handlerB);

      bus.emit({ type: 'type.a', payload: 'a1', priority: 'NORMAL', source: 'test', traceId: 't1' });
      bus.emit({ type: 'type.b', payload: 'b1', priority: 'NORMAL', source: 'test', traceId: 't2' });
      bus.emit({ type: 'type.a', payload: 'a2', priority: 'NORMAL', source: 'test', traceId: 't3' });

      await flushMicrotasks();

      expect(handlerA).toHaveBeenCalledTimes(2);
      expect(handlerB).toHaveBeenCalledTimes(1);
    });
  });

  // ================================================================
  // 11. Ring buffer history
  // ================================================================
  describe('ring buffer history', () => {
    it('should store events in history', () => {
      bus.emit({ type: 'hist.1', payload: 1, priority: 'NORMAL', source: 'test', traceId: 't1' });
      bus.emit({ type: 'hist.2', payload: 2, priority: 'NORMAL', source: 'test', traceId: 't2' });

      const history = bus.getHistory();
      expect(history.length).toBe(2);
      expect(history[0]).toMatchObject({ type: 'hist.1', payload: 1 });
      expect(history[1]).toMatchObject({ type: 'hist.2', payload: 2 });
    });

    it('should keep last 1000 events (ring buffer)', () => {
      // Emit 1050 events
      for (let i = 0; i < 1_050; i++) {
        bus.emit({
          type: `hist.ev.${i}`,
          payload: i,
          priority: 'NORMAL',
          source: 'test',
          traceId: `t${i}`,
        });
      }

      const history = bus.getHistory();
      expect(history.length).toBe(1_000);
      // Should contain the most recent events (payloads 50-1049)
      expect(history[0]).toMatchObject({ payload: 50 });
      expect(history[999]).toMatchObject({ payload: 1_049 });
    });

    it('should return empty history initially', () => {
      expect(bus.getHistory()).toEqual([]);
      expect(bus.getHistoryCount()).toBe(0);
    });
  });

  // ================================================================
  // 12. clear() removes all subscribers
  // ================================================================
  describe('clear()', () => {
    it('should remove all exact subscriptions', async () => {
      const handler = vi.fn();
      bus.on('clear.test', handler);

      bus.clear();

      bus.emit({ type: 'clear.test', payload: null, priority: 'NORMAL', source: 'test', traceId: 't1' });
      await flushMicrotasks();

      expect(handler).not.toHaveBeenCalled();
    });

    it('should remove all pattern subscriptions', async () => {
      const handler = vi.fn();
      bus.subscribe('clear.**', handler);

      bus.clear();

      bus.broadcast({ type: 'clear.x', payload: null, priority: 'NORMAL', source: 'test', traceId: 't1' });
      await flushMicrotasks();

      expect(handler).not.toHaveBeenCalled();
    });

    it('should clear dead letter queue', () => {
      bus.emit({ type: 'orphan.1', payload: null, priority: 'NORMAL', source: 'test', traceId: 't1' });
      expect(bus.getDeadLetterCount()).toBe(1);

      bus.clear();
      expect(bus.getDeadLetterCount()).toBe(0);
    });

    it('should clear history', () => {
      bus.emit({ type: 'hist.1', payload: null, priority: 'NORMAL', source: 'test', traceId: 't1' });
      expect(bus.getHistoryCount()).toBe(1);

      bus.clear();
      expect(bus.getHistoryCount()).toBe(0);
    });

    it('should reset subscriber counts to zero', () => {
      bus.on('a.b', () => {});
      bus.subscribe('c.**', () => {});

      expect(bus.getSubscriberCount('a.b')).toBe(1);

      bus.clear();

      expect(bus.getSubscriberCount('a.b')).toBe(0);
    });
  });
});

// ------------------------------------------------------------------
// Factory function
// ------------------------------------------------------------------

describe('createEventBus', () => {
  it('should return an EventBusImpl instance', () => {
    const eb = createEventBus();
    expect(eb).toBeInstanceOf(EventBusImpl);
  });
});
