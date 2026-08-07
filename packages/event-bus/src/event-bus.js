// ============================================================
// EventBus Implementation — @jason-os/event-bus
// Priority queues, glob matching, dead letter, ring buffer
// ============================================================
// ------------------------------------------------------------------
// Constants
// ------------------------------------------------------------------
const DEAD_LETTER_MAX = 10_000;
const RING_BUFFER_SIZE = 1_000;
const PRIORITY_RANK = {
    CRITICAL: 0,
    HIGH: 1,
    NORMAL: 2,
    LOW: 3,
    BACKGROUND: 4,
};
// ------------------------------------------------------------------
// Glob matcher — split on '.', '*' matches one segment, '**' matches any path
// ------------------------------------------------------------------
function globToRegex(pattern) {
    const segments = pattern.split('.');
    let regexStr = '^';
    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        if (seg === '**') {
            // '**' matches any remaining path (including multiple segments)
            if (i === segments.length - 1) {
                // '**' at the end matches anything
                regexStr += '.*';
            }
            else {
                // '**' followed by more segments — match any path up to those segments
                const remaining = segments.slice(i + 1).map(escapeRegex).join('\\.');
                regexStr += `(?:.*\\.)?${remaining}`;
                break;
            }
        }
        else if (seg === '*') {
            // '*' matches exactly one segment (any non-dot chars)
            regexStr += '[^.]+';
            if (i < segments.length - 1) {
                regexStr += '\\.';
            }
        }
        else {
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
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function isGlobPattern(type) {
    return type.includes('*');
}
function matchGlob(pattern, eventType) {
    if (pattern === eventType)
        return true;
    if (!isGlobPattern(pattern))
        return false;
    const regex = globToRegex(pattern);
    return regex.test(eventType);
}
// ------------------------------------------------------------------
// EventBus Implementation
// ------------------------------------------------------------------
export class EventBusImpl {
    _subscriptions = new Map();
    _patternSubs = [];
    _deadLetterQueue = [];
    _history = new Array(RING_BUFFER_SIZE).fill(null);
    _historyIndex = 0;
    _historyCount = 0;
    _subCounter = 0;
    // -- Event emission ------------------------------------------------
    emit(event) {
        const fullEvent = this._finalizeEvent(event);
        this._storeInHistory(fullEvent);
        this._dispatch(fullEvent);
    }
    broadcast(event) {
        const fullEvent = this._finalizeEvent(event);
        this._storeInHistory(fullEvent);
        this._dispatchBroadcast(fullEvent);
    }
    // -- Subscription helpers ------------------------------------------
    on(type, handler, options) {
        return this._addSubscription(type, handler, {
            priority: options?.priority ?? 'NORMAL',
            once: options?.once ?? false,
        });
    }
    once(type, handler, options) {
        return this._addSubscription(type, handler, {
            priority: options?.priority ?? 'NORMAL',
            once: true,
        });
    }
    off(subscription) {
        this._removeSubscription(subscription);
    }
    subscribe(pattern, handler, options) {
        return this._addSubscription(pattern, handler, {
            priority: options?.priority ?? 'NORMAL',
            once: false,
            isPattern: true,
        });
    }
    unsubscribe(subscription) {
        this._removeSubscription(subscription);
    }
    // -- Queries -------------------------------------------------------
    getSubscriberCount(type) {
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
    clear() {
        this._subscriptions.clear();
        this._patternSubs = [];
        this._deadLetterQueue = [];
        this._history = new Array(RING_BUFFER_SIZE).fill(null);
        this._historyIndex = 0;
        this._historyCount = 0;
        this._subCounter = 0;
    }
    // -- Dead letter & history accessors (for testing / introspection) -
    getDeadLetterQueue() {
        return Object.freeze([...this._deadLetterQueue]);
    }
    getHistory() {
        if (this._historyCount === 0)
            return Object.freeze([]);
        const result = [];
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
    getDeadLetterCount() {
        return this._deadLetterQueue.length;
    }
    getHistoryCount() {
        return Math.min(this._historyCount, RING_BUFFER_SIZE);
    }
    // -- Private helpers -----------------------------------------------
    _finalizeEvent(event) {
        return {
            ...event,
            timestamp: event.timestamp ?? Date.now(),
            traceId: event.traceId ?? this._generateTraceId(),
        };
    }
    _generateTraceId() {
        try {
            return crypto.randomUUID();
        }
        catch {
            // Fallback for environments without crypto.randomUUID
            return `trace-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
        }
    }
    _storeInHistory(event) {
        this._history[this._historyIndex] = event;
        this._historyIndex = (this._historyIndex + 1) % RING_BUFFER_SIZE;
        this._historyCount++;
    }
    _addSubscription(type, handler, opts) {
        this._subCounter++;
        const id = `sub-${this._subCounter}-${Date.now()}`;
        const isPattern = opts.isPattern ?? isGlobPattern(type);
        const sub = {
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
        }
        else {
            const list = this._subscriptions.get(type) ?? [];
            list.push(sub);
            // Sort by priority
            list.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
            this._subscriptions.set(type, list);
        }
        return sub;
    }
    _removeSubscription(sub) {
        if (sub._isPattern) {
            this._patternSubs = this._patternSubs.filter((s) => s.id !== sub.id);
        }
        else {
            const list = this._subscriptions.get(sub.type);
            if (list) {
                const filtered = list.filter((s) => s.id !== sub.id);
                if (filtered.length === 0) {
                    this._subscriptions.delete(sub.type);
                }
                else {
                    this._subscriptions.set(sub.type, filtered);
                }
            }
        }
    }
    _removeSubscriptionById(sub) {
        this._removeSubscription(sub);
    }
    _dispatch(event) {
        const subs = this._subscriptions.get(event.type) ?? [];
        // Separate by sync vs async priority
        const syncSubs = [];
        const asyncSubs = [];
        for (const sub of subs) {
            if (sub.priority === 'CRITICAL') {
                syncSubs.push(sub);
            }
            else {
                asyncSubs.push(sub);
            }
        }
        // Execute CRITICAL handlers synchronously, in priority order
        for (const sub of syncSubs) {
            this._invokeHandler(sub, event);
        }
        // Execute async handlers via queueMicrotask
        if (asyncSubs.length > 0) {
            queueMicrotask(() => {
                for (const sub of asyncSubs) {
                    this._invokeHandler(sub, event);
                }
            });
        }
        // If no subscribers at all, store in dead letter queue
        if (syncSubs.length === 0 && asyncSubs.length === 0) {
            this._addToDeadLetter(event);
        }
    }
    _dispatchBroadcast(event) {
        const subs = this._subscriptions.get(event.type) ?? [];
        // Collect matching pattern subscribers
        const matchingPatterns = [];
        for (const sub of this._patternSubs) {
            if (sub._patternRegex && sub._patternRegex.test(event.type)) {
                matchingPatterns.push(sub);
            }
        }
        // Separate by sync vs async priority
        const syncSubs = [];
        const asyncSubs = [];
        for (const sub of subs) {
            if (sub.priority === 'CRITICAL') {
                syncSubs.push(sub);
            }
            else {
                asyncSubs.push(sub);
            }
        }
        const syncPatterns = [];
        const asyncPatterns = [];
        for (const sub of matchingPatterns) {
            if (sub.priority === 'CRITICAL') {
                syncPatterns.push(sub);
            }
            else {
                asyncPatterns.push(sub);
            }
        }
        // Execute CRITICAL handlers synchronously
        for (const sub of syncSubs) {
            this._invokeHandler(sub, event);
        }
        for (const sub of syncPatterns) {
            this._invokeHandler(sub, event);
        }
        // Execute async handlers via queueMicrotask
        const allAsync = [...asyncSubs, ...asyncPatterns];
        if (allAsync.length > 0) {
            queueMicrotask(() => {
                for (const sub of allAsync) {
                    this._invokeHandler(sub, event);
                }
            });
        }
        // Dead letter: only if NO subscribers at all (exact + pattern)
        const totalSubs = subs.length + matchingPatterns.length;
        if (totalSubs === 0) {
            this._addToDeadLetter(event);
        }
    }
    _invokeHandler(sub, event) {
        try {
            const result = sub.handler(event);
            if (result && typeof result.then === 'function') {
                // It's a promise — catch async errors
                result.catch((err) => {
                    // Async error isolated — do not rethrow
                    console.error(`[EventBus] Async handler error for "${sub.type}":`, err);
                });
            }
        }
        catch (err) {
            // Sync error isolated — do not rethrow
            console.error(`[EventBus] Handler error for "${sub.type}":`, err);
        }
        finally {
            if (sub.once) {
                this._removeSubscriptionById(sub);
            }
        }
    }
    _addToDeadLetter(event) {
        if (this._deadLetterQueue.length >= DEAD_LETTER_MAX) {
            this._deadLetterQueue.shift();
        }
        this._deadLetterQueue.push(event);
    }
}
// ------------------------------------------------------------------
// Factory
// ------------------------------------------------------------------
export function createEventBus() {
    return new EventBusImpl();
}
//# sourceMappingURL=event-bus.js.map