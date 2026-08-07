/**
 * shadow-logger.test.ts — Tests for the ShadowLogger
 *
 * Coverage targets:
 *   1. Log entry stored (memory mode)
 *   2. Log entry encrypted before storage
 *   3. Query returns matching entries
 *   4. Query with level filter
 *   5. Query with time range filter
 *   6. Query with category filter
 *   7. Get recent N entries
 *   8. TTL burn policy auto-removes old entries
 *   9. Count burn policy limits entries
 *  10. Manual burn wipes all logs
 *  11. Panic gesture triggers burn
 *  12. No console output in stealth mode
 *  13. Stats return correct counts
 *  14. Different categories tracked separately
 *  15. Source attribution correct
 *  16. Async log doesn't block
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ShadowLogger } from './shadow-logger.js';
import type { LogEntry, BurnPolicy } from './shadow-logger.js';

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function makeEntry(partial: Partial<LogEntry> = {}): LogEntry {
  return {
    id: crypto.randomUUID(),
    level: 'INFO',
    category: 'test',
    message: 'test message',
    timestamp: Date.now(),
    source: 'test-source',
    encrypted: false,
    ...partial,
  };
}

// Helper to wait for async operations to settle
function tick(ms = 10): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ------------------------------------------------------------------
// Tests
// ------------------------------------------------------------------

describe('ShadowLogger', () => {
  let logger: ShadowLogger;

  beforeEach(() => {
    logger = new ShadowLogger({ storageMode: 'MEMORY' });
  });

  afterEach(() => {
    logger.destroy();
  });

  // -- Test 1: Log entry stored (memory mode) --------------------
  it('stores a log entry in memory mode', async () => {
    const entry = makeEntry({ message: 'hello memory' });
    logger.log(entry);

    const recent = await logger.getRecent(10);
    expect(recent).toHaveLength(1);
    expect(recent[0].message).toBe('hello memory');
  });

  // -- Test 2: Log entry encrypted before storage ----------------
  it('encrypts log entries before storage in non-memory mode', async () => {
    const encLogger = new ShadowLogger({ storageMode: 'EPHEMERAL' });
    const entry = makeEntry({ message: 'secret data' });

    await encLogger.logAsync(entry);

    // Stats should report encrypted = true
    const stats = encLogger.getStats();
    expect(stats.encrypted).toBe(true);
    expect(stats.totalEntries).toBe(1);

    encLogger.destroy();
  });

  // -- Test 3: Query returns matching entries --------------------
  it('query returns entries that match the filter', async () => {
    logger.log(makeEntry({ message: 'alpha', category: 'cat-a' }));
    logger.log(makeEntry({ message: 'beta', category: 'cat-b' }));
    logger.log(makeEntry({ message: 'gamma', category: 'cat-a' }));

    const results = await logger.query({ categories: ['cat-a'] });
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.message)).toContain('alpha');
    expect(results.map((r) => r.message)).toContain('gamma');
  });

  // -- Test 4: Query with level filter ---------------------------
  it('filters entries by log level', async () => {
    logger.log(makeEntry({ level: 'DEBUG', message: 'd1' }));
    logger.log(makeEntry({ level: 'INFO', message: 'i1' }));
    logger.log(makeEntry({ level: 'ERROR', message: 'e1' }));
    logger.log(makeEntry({ level: 'INFO', message: 'i2' }));

    const errors = await logger.query({ levels: ['ERROR'] });
    expect(errors).toHaveLength(1);
    expect(errors[0].level).toBe('ERROR');

    const infos = await logger.query({ levels: ['INFO'] });
    expect(infos).toHaveLength(2);

    const multi = await logger.query({ levels: ['DEBUG', 'ERROR'] });
    expect(multi).toHaveLength(2);
  });

  // -- Test 5: Query with time range filter ----------------------
  it('filters entries by time range', async () => {
    const t0 = Date.now();
    logger.log(makeEntry({ timestamp: t0, message: 'm0' }));
    logger.log(makeEntry({ timestamp: t0 + 1000, message: 'm1' }));
    logger.log(makeEntry({ timestamp: t0 + 2000, message: 'm2' }));
    logger.log(makeEntry({ timestamp: t0 + 3000, message: 'm3' }));

    const mid = await logger.query({ since: t0 + 500, until: t0 + 2500 });
    expect(mid).toHaveLength(2);
    expect(mid.map((m) => m.message)).toContain('m1');
    expect(mid.map((m) => m.message)).toContain('m2');
  });

  // -- Test 6: Query with category filter ------------------------
  it('filters entries by category', async () => {
    logger.log(makeEntry({ category: 'auth', message: 'login' }));
    logger.log(makeEntry({ category: 'network', message: 'request' }));
    logger.log(makeEntry({ category: 'auth', message: 'logout' }));
    logger.log(makeEntry({ category: 'ui', message: 'click' }));

    const authLogs = await logger.query({ categories: ['auth'] });
    expect(authLogs).toHaveLength(2);
    expect(authLogs.every((l) => l.category === 'auth')).toBe(true);
  });

  // -- Test 7: Get recent N entries ------------------------------
  it('returns the N most recent entries in descending order', async () => {
    const t0 = Date.now();
    logger.log(makeEntry({ timestamp: t0, message: 'oldest' }));
    logger.log(makeEntry({ timestamp: t0 + 100, message: 'middle' }));
    logger.log(makeEntry({ timestamp: t0 + 200, message: 'newest' }));

    const recent = await logger.getRecent(2);
    expect(recent).toHaveLength(2);
    expect(recent[0].message).toBe('newest');
    expect(recent[1].message).toBe('middle');
  });

  // -- Test 8: TTL burn policy auto-removes old entries ----------
  it('auto-removes entries older than TTL', async () => {
    const ttlLogger = new ShadowLogger({
      storageMode: 'MEMORY',
      burnPolicy: { type: 'ttl', ttlMs: 100 },
    });

    ttlLogger.log(makeEntry({ message: 'old', timestamp: Date.now() - 200 }));
    ttlLogger.log(makeEntry({ message: 'new', timestamp: Date.now() }));

    // Trigger burn check via another log
    ttlLogger.log(makeEntry({ message: 'trigger', timestamp: Date.now() }));

    const recent = await ttlLogger.getRecent(10);
    const messages = recent.map((r) => r.message);
    expect(messages).not.toContain('old');
    expect(messages).toContain('new');
    expect(messages).toContain('trigger');

    ttlLogger.destroy();
  });

  // -- Test 9: Count burn policy limits entries ------------------
  it('keeps only the N most recent entries with count policy', () => {
    const countLogger = new ShadowLogger({
      storageMode: 'MEMORY',
      burnPolicy: { type: 'count', maxEntries: 3 },
    });

    countLogger.log(makeEntry({ message: '1' }));
    countLogger.log(makeEntry({ message: '2' }));
    countLogger.log(makeEntry({ message: '3' }));
    countLogger.log(makeEntry({ message: '4' }));
    countLogger.log(makeEntry({ message: '5' }));

    const stats = countLogger.getStats();
    expect(stats.totalEntries).toBe(3);

    countLogger.destroy();
  });

  // -- Test 10: Manual burn wipes all logs -----------------------
  it('burn() wipes all logs via cryptographic shredding', async () => {
    logger.log(makeEntry({ message: 'a' }));
    logger.log(makeEntry({ message: 'b' }));
    logger.log(makeEntry({ message: 'c' }));

    expect(logger.getStats().totalEntries).toBe(3);

    await logger.burn();

    expect(logger.getStats().totalEntries).toBe(0);
    const recent = await logger.getRecent(10);
    expect(recent).toHaveLength(0);
  });

  // -- Test 11: Panic gesture triggers burn ----------------------
  it('burns all logs when the panic gesture is entered', () => {
    const panicLogger = new ShadowLogger({
      storageMode: 'MEMORY',
      burnPolicy: { type: 'panic', panicGesture: '!!!burn!!!' },
    });

    panicLogger.log(makeEntry({ message: 'sensitive' }));
    panicLogger.log(makeEntry({ message: 'data' }));
    expect(panicLogger.getStats().totalEntries).toBe(2);

    // Feed the panic gesture one character at a time
    for (const char of '!!!burn!!!') {
      panicLogger.feedPanicGesture(char);
    }

    expect(panicLogger.getStats().totalEntries).toBe(0);

    panicLogger.destroy();
  });

  // -- Test 12: No console output in stealth mode ----------------
  it('never writes to console in stealth mode', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    logger.log(makeEntry({ message: 'should not appear' }));
    logger.log(makeEntry({ level: 'ERROR', message: 'also hidden' }));

    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    expect(infoSpy).not.toHaveBeenCalled();

    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
    infoSpy.mockRestore();
  });

  // -- Test 13: Stats return correct counts ----------------------
  it('returns accurate statistics', () => {
    logger.log(makeEntry({ level: 'INFO', timestamp: 1000 }));
    logger.log(makeEntry({ level: 'INFO', timestamp: 2000 }));
    logger.log(makeEntry({ level: 'WARN', timestamp: 3000 }));
    logger.log(makeEntry({ level: 'ERROR', timestamp: 4000 }));

    const stats = logger.getStats();
    expect(stats.totalEntries).toBe(4);
    expect(stats.byLevel.INFO).toBe(2);
    expect(stats.byLevel.WARN).toBe(1);
    expect(stats.byLevel.ERROR).toBe(1);
    expect(stats.byLevel.DEBUG).toBe(0);
    expect(stats.byLevel.CRITICAL).toBe(0);
    expect(stats.oldestEntry).toBe(1000);
    expect(stats.newestEntry).toBe(4000);
    expect(stats.encrypted).toBe(false); // memory mode
  });

  // -- Test 14: Different categories tracked separately ----------
  it('tracks different categories separately in queries', async () => {
    logger.log(makeEntry({ category: 'security', message: 'login attempt' }));
    logger.log(makeEntry({ category: 'performance', message: 'slow query' }));
    logger.log(makeEntry({ category: 'security', message: 'login success' }));
    logger.log(makeEntry({ category: 'ui', message: 'button click' }));

    const security = await logger.query({ categories: ['security'] });
    expect(security).toHaveLength(2);

    const perf = await logger.query({ categories: ['performance'] });
    expect(perf).toHaveLength(1);
    expect(perf[0].message).toBe('slow query');

    const ui = await logger.query({ categories: ['ui'] });
    expect(ui).toHaveLength(1);

    const multi = await logger.query({ categories: ['security', 'ui'] });
    expect(multi).toHaveLength(3);
  });

  // -- Test 15: Source attribution correct -----------------------
  it('preserves correct source attribution for each entry', async () => {
    logger.log(makeEntry({ source: 'module-a', message: 'from a' }));
    logger.log(makeEntry({ source: 'module-b', message: 'from b' }));
    logger.log(makeEntry({ source: 'module-a', message: 'from a again' }));

    const fromA = await logger.query({ sources: ['module-a'] });
    expect(fromA).toHaveLength(2);
    expect(fromA.every((e) => e.source === 'module-a')).toBe(true);

    const fromB = await logger.query({ sources: ['module-b'] });
    expect(fromB).toHaveLength(1);
    expect(fromB[0].source).toBe('module-b');
  });

  // -- Test 16: Async log does not block -------------------------
  it('logAsync resolves without blocking subsequent code', async () => {
    let asyncDone = false;

    const promise = logger.logAsync({
      id: crypto.randomUUID(),
      level: 'INFO',
      category: 'async-test',
      message: 'async entry',
      source: 'test',
    });

    // This line should execute before the promise resolves
    expect(asyncDone).toBe(false);

    // Synchronous code can still run
    logger.log(makeEntry({ message: 'sync entry' }));

    await promise;
    asyncDone = true;

    expect(asyncDone).toBe(true);

    const recent = await logger.getRecent(10);
    expect(recent.length).toBeGreaterThanOrEqual(2);
  });
});

// ------------------------------------------------------------------
// Edge-case / additional coverage
// ------------------------------------------------------------------

describe('ShadowLogger — edge cases', () => {
  it('query respects limit and offset', async () => {
    const logger = new ShadowLogger({ storageMode: 'MEMORY' });

    for (let i = 1; i <= 10; i++) {
      logger.log(makeEntry({ message: `msg-${i}`, timestamp: i * 1000 }));
    }

    const page1 = await logger.query({ limit: 3, offset: 0 });
    expect(page1).toHaveLength(3);

    const page2 = await logger.query({ limit: 3, offset: 3 });
    expect(page2).toHaveLength(3);

    logger.destroy();
  });

  it('setBurnPolicy updates the active policy', () => {
    const logger = new ShadowLogger({
      storageMode: 'MEMORY',
      burnPolicy: { type: 'manual' },
    });

    expect(logger.burnPolicy.type).toBe('manual');

    logger.setBurnPolicy({ type: 'count', maxEntries: 5 });
    expect(logger.burnPolicy.type).toBe('count');
    expect(logger.burnPolicy.maxEntries).toBe(5);

    logger.destroy();
  });

  it('destroy prevents further logging', () => {
    const logger = new ShadowLogger({ storageMode: 'MEMORY' });
    logger.log(makeEntry({ message: 'before destroy' }));
    expect(logger.getStats().totalEntries).toBe(1);

    logger.destroy();
    logger.log(makeEntry({ message: 'after destroy' }));
    expect(logger.getStats().totalEntries).toBe(0);
  });

  it('works in PERSISTENT storage mode (encrypts)', async () => {
    const logger = new ShadowLogger({ storageMode: 'PERSISTENT' });

    await logger.logAsync({
      id: crypto.randomUUID(),
      level: 'INFO',
      category: 'persist-test',
      message: 'persistent entry',
      source: 'test',
    });

    const stats = logger.getStats();
    expect(stats.totalEntries).toBe(1);
    expect(stats.encrypted).toBe(true);

    logger.destroy();
  });
});
