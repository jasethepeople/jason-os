// ============================================================
// EventBus Implementation — @jason-os/event-bus
// Priority queues, glob matching, dead letter, ring buffer
// ============================================================

import {
  type EventBus,
  type EventPayload,
  type EventHandler,
  type Subscription,
  type Priority,
} from '@jason-os/shared';

// ------------------------------------------------------------------
// Constants
// ------------------------------------------------------------------

const DEAD_LETTER_MAX = 10_000;
const RING_BUFFER_SIZE = 1_000;

const PRIORITY_RANK: Record<Priority, number> = {
  CRITICAL: 0,
  HIGH: 1,
  NORMAL: 2,
  LOW: 3,
  BACKGROUND: 4,
};

// ------------------------------------------------------------------
// Internal subscription store
// ------------------------------------------------------------------

interface InternalSubscription extends Subscription {
  _patternRegex?: RegExp;
  _isPattern: boolean;
  /** Set the moment a once-subscription is claimed, so it can never fire twice. */
  _fired?: boolean;
}

// ------------------------------------------------------------------
// Glob matcher — split on '.', '*' matches one segment, '**' matches any path
// ------------------------------------------------------------------

function globToRegex(pattern: string): RegExp {
  const segments = pattern.split('.');
  let regexStr = '^';

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];

    if (seg === '**') {
      // '**' matches any remaining path (including multiple segments)
      if (i === segments.length - 1) {
        // '**' at the end matches anything
        regexStr += '.*';
      } else {
        // '**' followed by more segments — match any path up to those segments
        const remaining = segments.slice(i + 1).map(escapeRegex).join('\\.');
        regexStr += `(?:.*\\.)?${remaining}`;
        break;
      }
    } else if (seg === '*') {
      // '*' matches exactly one segment (any non-dot chars)
      regexStr += '[^.]+';
      if (i < segments.length - 1) {
        regexStr += '\\.';
      }
    } else {
      // Exact segment match
      regexStr += escapeRegex(seg);
      if (i < segments.length - 1) {
        regexStr += '\\.';
      }
    }
  }

  regexStr += '$';
  return new RegExp(regexStr);
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isGlobPattern(type: string): boolean {
  return type.includes('*');
}

function matchGlob(pattern: string, eventType: string): boolean {
  if (pattern === eventType) return true;
  if (!isGlobPattern(pattern)) return false;
  const regex = globToRegex(pattern);
  return regex.test(eventType);
}

// ------------------------------------------------------------------
// EventBus Implementation
// ------------------------------------------------------------------

export class EventBusImpl implements EventBus {
  private _subscriptions: Map<string, InternalSubscription[]> = new Map();
  private _patternSubs: InternalSubscription[] = [];
  private _deadLetterQueue: EventPayload[] = [];
  private _history: (EventPayload | null)[] = new Array(RING_BUFFER_SIZE).fill(null);
  private _historyIndex = 0;
  private _historyCount = 0;
  private _subCounter = 0;

  // -- Event emission ------------------------------------------------

  emit<T>(event: Omit<EventPayload<T>, 'timestamp' | 'traceId'> & Partial<Pick<EventPayload<T>, 'timestamp' | 'traceId'>>): void {
    const fullEvent = this._finalizeEvent(event);
    this._storeInHistory(fullEvent as EventPayload);
    this._dispatch(fullEvent as EventPayload);
  }

  broadcast<T>(event: Omit<EventPayload<T>, 'timestamp' | 'traceId'> & Partial<Pick<EventPayload<T>, 'timestamp' | 'traceId'>>): void {
    const fullEvent = this._finalizeEvent(event);
    this._storeInHistory(fullEvent as EventPayload);
    this._dispatchBroadcast(fullEvent as EventPayload);
  }

  // -- Subscription helpers ------------------------------------------

  on<T>(type: string, handler: EventHandler<T>, options?: { priority?: Priority; once?: boolean }): Subscription {
    return this._addSubscription(type, handler as EventHandler, {
      priority: options?.priority ?? 'NORMAL',
      once: options?.once ?? false,
    });
  }

  once<T>(type: string, handler: EventHandler<T>, options?: { priority?: Priority }): Subscription {
    return this._addSubscription(type, handler as EventHandler, {
      priority: options?.priority ?? 'NORMAL',
      once: true,
    });
  }

  off(subscription: Subscription): void {
    this._removeSubscription(subscription as InternalSubscription);
  }

  subscribe<T>(pattern: string, handler: EventHandler<T>, options?: { priority?: Priority }): Subscription {
    return this._addSubscription(pattern, handler as EventHandler, {
      priority: options?.priority ?? 'NORMAL',
      once: false,
      isPattern: true,
    });
  }

  unsubscribe(subscription: Subscription): void {
    this._removeSubscription(subscription as InternalSubscription);
  }

  // -- Queries -------------------------------------------------------

  getSubscriberCount(type: string): number {
    let count = 0;

    // Exact match subscribers
    const exact = this._subscriptions.get(type);
    if (exact) {
      count += exact.length;
    }

    // Pattern subscribers that match this type
    for (const sub of this._patternSubs) {
      if (matchGlob(sub.type, type)) {
        count++;
      }
    }

    return count;
  }

  clear(): void {
    this._subscriptions.clear();
    this._patternSubs = [];
    this._deadLetterQueue = [];
    this._history = new Array(RING_BUFFER_SIZE).fill(null);
    this._historyIndex = 0;
    this._historyCount = 0;
    this._subCounter = 0;
  }

  // -- Dead letter & history accessors (for testing / introspection) -

  getDeadLetterQueue(): readonly EventPayload[] {
    return Object.freeze([...this._deadLetterQueue]);
  }

  getHistory(): readonly EventPayload[] {
    if (this._historyCount === 0) return Object.freeze([]);

    const result: EventPayload[] = [];
    const start = this._historyCount < RING_BUFFER_SIZE ? 0 : this._historyIndex;
    const len = Math.min(this._historyCount, RING_BUFFER_SIZE);

    for (let i = 0; i < len; i++) {
      const idx = (start + i) % RING_BUFFER_SIZE;
      const item = this._history[idx];
      if (item !== null) {
        result.push(item);
      }
    }

    return Object.freeze(result);
  }

  getDeadLetterCount(): number {
    return this._deadLetterQueue.length;
  }

  getHistoryCount(): number {
    return Math.min(this._historyCount, RING_BUFFER_SIZE);
  }

  // -- Private helpers -----------------------------------------------

  private _finalizeEvent<T>(
    event: Omit<EventPayload<T>, 'timestamp' | 'traceId'> & Partial<Pick<EventPayload<T>, 'timestamp' | 'traceId'>>,
  ): EventPayload<T> {
    return {
      ...event,
      timestamp: event.timestamp ?? Date.now(),
      traceId: event.traceId ?? this._generateTraceId(),
    } as EventPayload<T>;
  }

  private _generateTraceId(): string {
    try {
      return crypto.randomUUID();
    } catch {
      // Fallback for environments without crypto.randomUUID
      return `trace-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    }
  }

  private _storeInHistory(event: EventPayload): void {
    this._history[this._historyIndex] = event;
    this._historyIndex = (this._historyIndex + 1) % RING_BUFFER_SIZE;
    this._historyCount++;
  }

  private _addSubscription(
    type: string,
    handler: EventHandler,
    opts: { priority: Priority; once: boolean; isPattern?: boolean },
  ): InternalSubscription {
    this._subCounter++;
    const id = `sub-${this._subCounter}-${Date.now()}`;
    const isPattern = opts.isPattern ?? isGlobPattern(type);

    const sub: InternalSubscription = {
      id,
      type,
      handler,
      priority: opts.priority,
      once: opts.once,
      _isPattern: isPattern,
    };

    if (isPattern) {
      sub._patternRegex = globToRegex(type);
      this._patternSubs.push(sub);
      // Sort pattern subs by priority rank (lower number = higher priority)
      this._patternSubs.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
    } else {
      const list = this._subscriptions.get(type) ?? [];
      list.push(sub);
      // Sort by priority
      list.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
      this._subscriptions.set(type, list);
    }

    return sub;
  }

  private _removeSubscription(sub: InternalSubscription): void {
    if (sub._isPattern) {
      this._patternSubs = this._patternSubs.filter((s) => s.id !== sub.id);
    } else {
      const list = this._subscriptions.get(sub.type);
      if (list) {
        const filtered = list.filter((s) => s.id !== sub.id);
        if (filtered.length === 0) {
          this._subscriptions.delete(sub.type);
        } else {
          this._subscriptions.set(sub.type, filtered);
        }
      }
    }
  }

  private _removeSubscriptionById(sub: InternalSubscription): void {
    this._removeSubscription(sub);
  }

  /**
   * Single dispatch path. emit() is targeted (exact subscribers only);
   * broadcast() additionally reaches every glob subscriber that matches.
   * Both share this code so priority ordering, once-handling and dead-letter
   * behaviour can't drift apart again.
   */
  private _dispatch<T>(event: EventPayload<T>, includePatterns = false): void {
    const exact = this._subscriptions.get(event.type) ?? [];
    const patterns = includePatterns
      ? this._patternSubs.filter(
          (sub) => sub._patternRegex !== undefined && sub._patternRegex.test(event.type),
        )
      : [];

    // Snapshot + priority order across exact and pattern subscribers
    const all = [...exact, ...patterns].sort(
      (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority],
    );

    if (all.length === 0) {
      this._addToDeadLetter(event as EventPayload);
      return;
    }

    // CRITICAL handlers run synchronously, the rest in a microtask
    const asyncSubs: InternalSubscription[] = [];
    for (const sub of all) {
      if (sub.priority === 'CRITICAL') {
        this._invokeHandler(sub, event);
      } else {
        asyncSubs.push(sub);
      }
    }

    if (asyncSubs.length > 0) {
      queueMicrotask(() => {
        for (const sub of asyncSubs) {
          this._invokeHandler(sub, event);
        }
      });
    }
  }

  private _dispatchBroadcast<T>(event: EventPayload<T>): void {
    this._dispatch(event, true);
  }

  private _invokeHandler<T>(sub: InternalSubscription, event: EventPayload<T>): void {
    // A once-subscription is claimed *before* running, and unregistered
    // immediately. Async handlers are queued in a microtask, so removing it
    // only afterwards let a second emit() grab it before the first ran.
    if (sub.once) {
      if (sub._fired) return;
      sub._fired = true;
      this._removeSubscriptionById(sub);
    }
    try {
      const result = sub.handler(event as EventPayload<unknown>);
      if (result && typeof result.then === 'function') {
        // It's a promise — catch async errors
        result.catch((err: unknown) => {
          // Async error isolated — do not rethrow
          console.error(`[EventBus] Async handler error for "${sub.type}":`, err);
        });
      }
    } catch (err) {
      // Sync error isolated — do not rethrow
      console.error(`[EventBus] Handler error for "${sub.type}":`, err);
    }
  }

  private _addToDeadLetter(event: EventPayload): void {
    if (this._deadLetterQueue.length >= DEAD_LETTER_MAX) {
      this._deadLetterQueue.shift();
    }
    this._deadLetterQueue.push(event);
  }
}

// ------------------------------------------------------------------
// Factory
// ------------------------------------------------------------------

export function createEventBus(): EventBusImpl {
  return new EventBusImpl();
}
