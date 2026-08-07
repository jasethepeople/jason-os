import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SilentOps } from '../src/module';
import type { EventBus } from '../src/module';
import type { SilentOpsEvents } from '../src/types';

describe('SilentOps', () => {
  let ops: SilentOps;
  let mockBus: EventBus;
  let emittedEvents: Array<{ event: keyof SilentOpsEvents; payload: SilentOpsEvents[keyof SilentOpsEvents] }>;

  beforeEach(() => {
    emittedEvents = [];
    mockBus = {
      emit: vi.fn(<K extends keyof SilentOpsEvents>(event: K, payload: SilentOpsEvents[K]) => {
        emittedEvents.push({ event, payload });
      }),
    };
    ops = new SilentOps({ bus: mockBus, maxConcurrentRunners: 2 });
  });

  describe('defineTask', () => {
    it('should define a task with all required fields', () => {
      const task = ops.defineTask('cleanup', 'schedule', { cron: '0 0 * * *' });
      expect(task.id).toBeDefined();
      expect(task.name).toBe('cleanup');
      expect(task.trigger).toBe('schedule');
      expect(task.config).toEqual({ cron: '0 0 * * *' });
      expect(task.lastRunAt).toBeNull();
      expect(task.runCount).toBe(0);
      expect(task.enabled).toBe(true);
      expect(task.silent).toBe(true);
    });

    it('should allow overriding silent flag', () => {
      const task = ops.defineTask('notify', 'event', {}, false);
      expect(task.silent).toBe(false);
    });

    it('should generate unique IDs for each task', () => {
      const t1 = ops.defineTask('a', 'schedule', {});
      const t2 = ops.defineTask('b', 'schedule', {});
      expect(t1.id).not.toBe(t2.id);
    });
  });

  describe('enableTask', () => {
    it('should enable a disabled task', () => {
      const task = ops.defineTask('t', 'event', {});
      ops.disableTask(task.id);
      expect(ops.getTask(task.id)?.enabled).toBe(false);
      const enabled = ops.enableTask(task.id);
      expect(enabled.enabled).toBe(true);
    });

    it('should throw if task not found', () => {
      expect(() => ops.enableTask('nonexistent')).toThrow('Task not found: nonexistent');
    });
  });

  describe('disableTask', () => {
    it('should disable an enabled task', () => {
      const task = ops.defineTask('t', 'event', {});
      expect(task.enabled).toBe(true);
      const disabled = ops.disableTask(task.id);
      expect(disabled.enabled).toBe(false);
    });

    it('should throw if task not found', () => {
      expect(() => ops.disableTask('nonexistent')).toThrow('Task not found: nonexistent');
    });
  });

  describe('runTask', () => {
    it('should run a task and update metadata', async () => {
      const task = ops.defineTask('t', 'event', {});
      const before = Date.now();
      const record = await ops.runTask(task.id);
      const after = Date.now();

      expect(record.taskId).toBe(task.id);
      expect(record.result).toBe('success');
      expect(record.startedAt).toBeGreaterThanOrEqual(before);
      expect(record.completedAt).toBeLessThanOrEqual(after);
      expect(ops.getTask(task.id)?.runCount).toBe(1);
      expect(ops.getTask(task.id)?.lastRunAt).not.toBeNull();
    });

    it('should emit bus event on completion', async () => {
      const task = ops.defineTask('t', 'event', {});
      await ops.runTask(task.id);

      expect(mockBus.emit).toHaveBeenCalledTimes(1);
      expect(emittedEvents[0].event).toBe('silent-ops:task-completed');
      expect(emittedEvents[0].payload.taskId).toBe(task.id);
      expect(emittedEvents[0].payload.taskName).toBe('t');
      expect(emittedEvents[0].payload.silent).toBe(true);
    });

    it('should throw if task not found', async () => {
      await expect(ops.runTask('nonexistent')).rejects.toThrow('Task not found: nonexistent');
    });

    it('should throw if task is disabled', async () => {
      const task = ops.defineTask('t', 'event', {});
      ops.disableTask(task.id);
      await expect(ops.runTask(task.id)).rejects.toThrow(`Task is disabled: ${task.id}`);
    });

    it('should queue task when max concurrent reached', async () => {
      ops.defineTask('slow1', 'event', { handler: () => new Promise((r) => setTimeout(r, 50)) });
      ops.defineTask('slow2', 'event', { handler: () => new Promise((r) => setTimeout(r, 50)) });
      const t3 = ops.defineTask('t3', 'event', {});

      const p1 = ops.runTask('slow1');
      const p2 = ops.runTask('slow2');

      await expect(ops.runTask(t3.id)).rejects.toThrow('Max concurrent runners reached');

      await p1;
      await p2;
    });

    it('should execute custom handler when provided', async () => {
      const handler = vi.fn().mockResolvedValue('custom-output');
      const task = ops.defineTask('custom', 'event', { handler, extra: true });
      const record = await ops.runTask(task.id);

      expect(handler).toHaveBeenCalledWith({ extra: true });
      expect(record.output).toBe('custom-output');
    });
  });

  describe('getQueue', () => {
    it('should return empty queue initially', () => {
      expect(ops.getQueue()).toEqual([]);
    });
  });

  describe('getRunHistory', () => {
    it('should return all history when no filter', async () => {
      const t1 = ops.defineTask('t1', 'event', {});
      const t2 = ops.defineTask('t2', 'event', {});
      await ops.runTask(t1.id);
      await ops.runTask(t2.id);

      const history = ops.getRunHistory();
      expect(history).toHaveLength(2);
    });

    it('should filter by task ID', async () => {
      const t1 = ops.defineTask('t1', 'event', {});
      const t2 = ops.defineTask('t2', 'event', {});
      await ops.runTask(t1.id);
      await ops.runTask(t2.id);

      const history = ops.getRunHistory(t1.id);
      expect(history).toHaveLength(1);
      expect(history[0]?.taskId).toBe(t1.id);
    });
  });

  describe('getState', () => {
    it('should return current state snapshot', () => {
      const task = ops.defineTask('t', 'event', {});
      const state = ops.getState();

      expect(state.tasks).toHaveLength(1);
      expect(state.tasks[0]?.id).toBe(task.id);
      expect(state.queue).toEqual([]);
      expect(state.activeRunners).toBe(0);
    });
  });

  describe('getTask', () => {
    it('should return task by ID', () => {
      const task = ops.defineTask('t', 'event', {});
      expect(ops.getTask(task.id)).toEqual(task);
    });

    it('should return undefined for unknown ID', () => {
      expect(ops.getTask('unknown')).toBeUndefined();
    });
  });

  describe('getAllTasks', () => {
    it('should return all defined tasks', () => {
      const t1 = ops.defineTask('a', 'schedule', {});
      const t2 = ops.defineTask('b', 'event', {});
      const all = ops.getAllTasks();

      expect(all).toHaveLength(2);
      expect(all.map((t) => t.id)).toContain(t1.id);
      expect(all.map((t) => t.id)).toContain(t2.id);
    });
  });

  describe('removeTask', () => {
    it('should remove a task', () => {
      const task = ops.defineTask('t', 'event', {});
      expect(ops.removeTask(task.id)).toBe(true);
      expect(ops.getTask(task.id)).toBeUndefined();
    });

    it('should return false for unknown task', () => {
      expect(ops.removeTask('unknown')).toBe(false);
    });
  });

  describe('clearQueue', () => {
    it('should clear the queue', () => {
      ops.defineTask('t1', 'event', {});
      ops.defineTask('t2', 'event', {});
      // Manually add to queue to test clearing
      ops.getQueue();
      ops.clearQueue();
      expect(ops.getQueue()).toEqual([]);
    });
  });
});
