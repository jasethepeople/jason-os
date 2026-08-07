// ============================================================
// StealthLedgerPro — Test Suite
// ============================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  StealthLedgerPro,
  createStealthLedgerProModule,
  stealth_ledger_pro_module,
} from './module.js';
import type { LedgerEntry, StealthLedgerState } from './types.js';

describe('StealthLedgerPro', () => {
  let ledger: StealthLedgerPro;

  beforeEach(() => {
    ledger = new StealthLedgerPro();
  });

  // ----------------------------------------------------------------
  // 1. Constructor creates instance with initial state
  // ----------------------------------------------------------------
  it('constructor creates instance with initial state', () => {
    const state = ledger.getState();
    expect(state.entries).toEqual([]);
    expect(state.balance).toBe(0);
    expect(state.categories).toEqual([]);
    expect(state.lastEntryAt).toBeNull();
  });

  // ----------------------------------------------------------------
  // 2. init resolves without error
  // ----------------------------------------------------------------
  it('init resolves without error', async () => {
    await expect(ledger.init()).resolves.toBeUndefined();
  });

  // ----------------------------------------------------------------
  // 3. addEntry creates entry with generated id and timestamp
  // ----------------------------------------------------------------
  it('addEntry creates entry with generated id and timestamp', () => {
    const before = Date.now();
    const entry = ledger.addEntry({
      amount: 100,
      currency: 'USD',
      category: 'income',
      description: 'Salary',
      encrypted: false,
      tags: ['monthly'],
    });
    const after = Date.now();

    expect(entry.id).toMatch(/^entry-\d+-\d+$/);
    expect(entry.timestamp).toBeGreaterThanOrEqual(before);
    expect(entry.timestamp).toBeLessThanOrEqual(after);
    expect(entry.amount).toBe(100);
    expect(entry.currency).toBe('USD');
  });

  // ----------------------------------------------------------------
  // 4. addEntry updates balance
  // ----------------------------------------------------------------
  it('addEntry updates balance', () => {
    ledger.addEntry({
      amount: 100,
      currency: 'USD',
      category: 'income',
      description: 'Income',
      encrypted: false,
      tags: [],
    });
    expect(ledger.getBalance()).toBe(100);

    ledger.addEntry({
      amount: -30,
      currency: 'USD',
      category: 'food',
      description: 'Lunch',
      encrypted: false,
      tags: [],
    });
    expect(ledger.getBalance()).toBe(70);
  });

  // ----------------------------------------------------------------
  // 5. addEntry adds new category
  // ----------------------------------------------------------------
  it('addEntry adds new category', () => {
    ledger.addEntry({
      amount: 100,
      currency: 'USD',
      category: 'income',
      description: 'Salary',
      encrypted: false,
      tags: [],
    });
    expect(ledger.getState().categories).toContain('income');
  });

  // ----------------------------------------------------------------
  // 6. addEntry uses default currency
  // ----------------------------------------------------------------
  it('addEntry uses default currency', () => {
    const entry = ledger.addEntry({
      amount: 50,
      currency: '',
      category: 'test',
      description: 'Test',
      encrypted: false,
      tags: [],
    });
    expect(entry.currency).toBe('USD');
  });

  // ----------------------------------------------------------------
  // 7. addEntry emits event on bus
  // ----------------------------------------------------------------
  it('addEntry emits event on bus', () => {
    const emitFn = vi.fn();
    const bus = { emit: emitFn };
    const instance = new StealthLedgerPro(bus);
    instance.addEntry({
      amount: 100,
      currency: 'USD',
      category: 'income',
      description: 'Salary',
      encrypted: false,
      tags: [],
    });
    expect(emitFn).toHaveBeenCalledTimes(1);
    const call = emitFn.mock.calls[0]![0] as Record<string, unknown>;
    expect(call.type).toBe('ledger:entry-added');
    expect((call.data as Record<string, unknown>).category).toBe('income');
  });

  // ----------------------------------------------------------------
  // 8. getBalance returns correct total
  // ----------------------------------------------------------------
  it('getBalance returns correct total', () => {
    expect(ledger.getBalance()).toBe(0);
    ledger.addEntry({ amount: 10, currency: 'USD', category: 'a', description: '1', encrypted: false, tags: [] });
    ledger.addEntry({ amount: 20, currency: 'USD', category: 'b', description: '2', encrypted: false, tags: [] });
    ledger.addEntry({ amount: -5, currency: 'USD', category: 'c', description: '3', encrypted: false, tags: [] });
    expect(ledger.getBalance()).toBe(25);
  });

  // ----------------------------------------------------------------
  // 9. recalculateBalance recomputes from entries
  // ----------------------------------------------------------------
  it('recalculateBalance recomputes from entries', () => {
    ledger.addEntry({ amount: 100, currency: 'USD', category: 'a', description: '1', encrypted: false, tags: [] });
    ledger.addEntry({ amount: 50, currency: 'USD', category: 'b', description: '2', encrypted: false, tags: [] });
    expect(ledger.recalculateBalance()).toBe(150);
  });

  // ----------------------------------------------------------------
  // 10. filterEntries by category
  // ----------------------------------------------------------------
  it('filterEntries by category', () => {
    ledger.addEntry({ amount: 100, currency: 'USD', category: 'income', description: 'Salary', encrypted: false, tags: [] });
    ledger.addEntry({ amount: -50, currency: 'USD', category: 'food', description: 'Lunch', encrypted: false, tags: [] });
    const filtered = ledger.filterEntries({ category: 'income' });
    expect(filtered.length).toBe(1);
    expect(filtered[0]!.category).toBe('income');
  });

  // ----------------------------------------------------------------
  // 11. filterEntries by tags
  // ----------------------------------------------------------------
  it('filterEntries by tags', () => {
    ledger.addEntry({ amount: 100, currency: 'USD', category: 'a', description: '1', encrypted: false, tags: ['urgent', 'monthly'] });
    ledger.addEntry({ amount: 50, currency: 'USD', category: 'a', description: '2', encrypted: false, tags: ['monthly'] });
    ledger.addEntry({ amount: 25, currency: 'USD', category: 'a', description: '3', encrypted: false, tags: ['urgent'] });

    const urgent = ledger.filterEntries({ tags: ['urgent'] });
    expect(urgent.length).toBe(2);

    const monthlyUrgent = ledger.filterEntries({ tags: ['urgent', 'monthly'] });
    expect(monthlyUrgent.length).toBe(1);
  });

  // ----------------------------------------------------------------
  // 12. filterEntries by amount range
  // ----------------------------------------------------------------
  it('filterEntries by amount range', () => {
    ledger.addEntry({ amount: 10, currency: 'USD', category: 'a', description: '1', encrypted: false, tags: [] });
    ledger.addEntry({ amount: 50, currency: 'USD', category: 'a', description: '2', encrypted: false, tags: [] });
    ledger.addEntry({ amount: 100, currency: 'USD', category: 'a', description: '3', encrypted: false, tags: [] });

    const range = ledger.filterEntries({ minAmount: 20, maxAmount: 80 });
    expect(range.length).toBe(1);
    expect(range[0]!.amount).toBe(50);
  });

  // ----------------------------------------------------------------
  // 13. filterEntries by time range
  // ----------------------------------------------------------------
  it('filterEntries by time range', () => {
    const now = Date.now();
    ledger.addEntry({ amount: 10, currency: 'USD', category: 'a', description: 'old', encrypted: false, tags: [] });

    // Manually set timestamp to past
    const entries = ledger.getAllEntries();
    entries[0]!.timestamp = now - 10000;

    const filtered = ledger.filterEntries({ after: now - 5000 });
    expect(filtered.length).toBe(0);
  });

  // ----------------------------------------------------------------
  // 14. filterEntries by currency
  // ----------------------------------------------------------------
  it('filterEntries by currency', () => {
    ledger.addEntry({ amount: 100, currency: 'USD', category: 'a', description: '1', encrypted: false, tags: [] });
    ledger.addEntry({ amount: 80, currency: 'EUR', category: 'a', description: '2', encrypted: false, tags: [] });

    const usd = ledger.filterEntries({ currency: 'USD' });
    expect(usd.length).toBe(1);
    expect(usd[0]!.currency).toBe('USD');
  });

  // ----------------------------------------------------------------
  // 15. getSummaryByCategory returns correct totals
  // ----------------------------------------------------------------
  it('getSummaryByCategory returns correct totals', () => {
    ledger.addEntry({ amount: 100, currency: 'USD', category: 'income', description: '1', encrypted: false, tags: [] });
    ledger.addEntry({ amount: 200, currency: 'USD', category: 'income', description: '2', encrypted: false, tags: [] });
    ledger.addEntry({ amount: -50, currency: 'USD', category: 'food', description: '3', encrypted: false, tags: [] });

    const summary = ledger.getSummaryByCategory();
    expect(summary.length).toBe(2);

    const income = summary.find((s) => s.category === 'income');
    expect(income).toBeDefined();
    expect(income!.total).toBe(300);
    expect(income!.count).toBe(2);
    expect(income!.average).toBe(150);

    const food = summary.find((s) => s.category === 'food');
    expect(food).toBeDefined();
    expect(food!.total).toBe(-50);
    expect(food!.count).toBe(1);
  });

  // ----------------------------------------------------------------
  // 16. getEntry returns entry by ID
  // ----------------------------------------------------------------
  it('getEntry returns entry by ID', () => {
    const added = ledger.addEntry({
      amount: 100, currency: 'USD', category: 'a', description: 'Test', encrypted: false, tags: ['t1'],
    });
    const found = ledger.getEntry(added.id);
    expect(found).toBeDefined();
    expect(found!.id).toBe(added.id);
    expect(found!.tags).toEqual(['t1']);
  });

  // ----------------------------------------------------------------
  // 17. getEntry returns undefined for unknown ID
  // ----------------------------------------------------------------
  it('getEntry returns undefined for unknown ID', () => {
    expect(ledger.getEntry('nonexistent')).toBeUndefined();
  });

  // ----------------------------------------------------------------
  // 18. getAllEntries returns all entries
  // ----------------------------------------------------------------
  it('getAllEntries returns all entries', () => {
    ledger.addEntry({ amount: 10, currency: 'USD', category: 'a', description: '1', encrypted: false, tags: [] });
    ledger.addEntry({ amount: 20, currency: 'USD', category: 'b', description: '2', encrypted: false, tags: [] });
    expect(ledger.getAllEntries().length).toBe(2);
  });

  // ----------------------------------------------------------------
  // 19. getEntryCount returns correct count
  // ----------------------------------------------------------------
  it('getEntryCount returns correct count', () => {
    expect(ledger.getEntryCount()).toBe(0);
    ledger.addEntry({ amount: 10, currency: 'USD', category: 'a', description: '1', encrypted: false, tags: [] });
    expect(ledger.getEntryCount()).toBe(1);
  });

  // ----------------------------------------------------------------
  // 20. removeEntry removes entry and updates balance
  // ----------------------------------------------------------------
  it('removeEntry removes entry and updates balance', () => {
    const entry = ledger.addEntry({
      amount: 100, currency: 'USD', category: 'a', description: 'Test', encrypted: false, tags: [],
    });
    expect(ledger.getBalance()).toBe(100);
    const removed = ledger.removeEntry(entry.id);
    expect(removed).toBe(true);
    expect(ledger.getBalance()).toBe(0);
    expect(ledger.getEntryCount()).toBe(0);
  });

  // ----------------------------------------------------------------
  // 21. removeEntry returns false for unknown ID
  // ----------------------------------------------------------------
  it('removeEntry returns false for unknown ID', () => {
    expect(ledger.removeEntry('missing')).toBe(false);
  });

  // ----------------------------------------------------------------
  // 22. exportEncrypted returns string
  // ----------------------------------------------------------------
  it('exportEncrypted returns string', () => {
    ledger.addEntry({
      amount: 100, currency: 'USD', category: 'income', description: 'Salary', encrypted: false, tags: ['t1'],
    });
    const exported = ledger.exportEncrypted();
    expect(typeof exported).toBe('string');
    expect(exported.startsWith('STEALTH:')).toBe(true);
  });

  // ----------------------------------------------------------------
  // 23. getState returns independent copy
  // ----------------------------------------------------------------
  it('getState returns independent copy', () => {
    ledger.addEntry({ amount: 10, currency: 'USD', category: 'a', description: '1', encrypted: false, tags: [] });
    const state1: StealthLedgerState = ledger.getState();
    ledger.addEntry({ amount: 20, currency: 'USD', category: 'b', description: '2', encrypted: false, tags: [] });
    const state2: StealthLedgerState = ledger.getState();
    expect(state1.entries.length).toBe(1);
    expect(state2.entries.length).toBe(2);
    expect(state1.balance).toBe(10);
    expect(state2.balance).toBe(30);
  });

  // ----------------------------------------------------------------
  // 24. destroy resets all state
  // ----------------------------------------------------------------
  it('destroy resets all state', async () => {
    ledger.addEntry({ amount: 100, currency: 'USD', category: 'a', description: '1', encrypted: false, tags: [] });
    await ledger.destroy();
    expect(ledger.getBalance()).toBe(0);
    expect(ledger.getEntryCount()).toBe(0);
    expect(ledger.getState().categories).toEqual([]);
    expect(ledger.getState().lastEntryAt).toBeNull();
  });

  // ----------------------------------------------------------------
  // 25. multiple categories tracked correctly
  // ----------------------------------------------------------------
  it('multiple categories tracked correctly', () => {
    ledger.addEntry({ amount: 100, currency: 'USD', category: 'income', description: '1', encrypted: false, tags: [] });
    ledger.addEntry({ amount: -50, currency: 'USD', category: 'food', description: '2', encrypted: false, tags: [] });
    ledger.addEntry({ amount: -30, currency: 'USD', category: 'transport', description: '3', encrypted: false, tags: [] });
    expect(ledger.getState().categories).toEqual(['income', 'food', 'transport']);
  });

  // ----------------------------------------------------------------
  // 26. addEntry with custom config default currency
  // ----------------------------------------------------------------
  it('addEntry with custom config default currency', () => {
    const instance = new StealthLedgerPro(undefined, { defaultCurrency: 'EUR' });
    const entry = instance.addEntry({
      amount: 50, currency: '', category: 'a', description: 'Test', encrypted: false, tags: [],
    });
    expect(entry.currency).toBe('EUR');
  });

  // ----------------------------------------------------------------
  // 27. empty filter returns all entries
  // ----------------------------------------------------------------
  it('empty filter returns all entries', () => {
    ledger.addEntry({ amount: 10, currency: 'USD', category: 'a', description: '1', encrypted: false, tags: [] });
    ledger.addEntry({ amount: 20, currency: 'USD', category: 'b', description: '2', encrypted: false, tags: [] });
    expect(ledger.filterEntries({}).length).toBe(2);
  });

  // ----------------------------------------------------------------
  // 28. getSummaryByCategory empty ledger returns empty
  // ----------------------------------------------------------------
  it('getSummaryByCategory empty ledger returns empty', () => {
    expect(ledger.getSummaryByCategory()).toEqual([]);
  });

  // ----------------------------------------------------------------
  // 29. negative balance from expenses
  // ----------------------------------------------------------------
  it('negative balance from expenses', () => {
    ledger.addEntry({ amount: -100, currency: 'USD', category: 'expense', description: 'Big purchase', encrypted: false, tags: [] });
    expect(ledger.getBalance()).toBe(-100);
  });
});

describe('createStealthLedgerProModule factory', () => {
  // ----------------------------------------------------------------
  // 30. Factory creates a working instance
  // ----------------------------------------------------------------
  it('factory creates a working instance', () => {
    const instance = createStealthLedgerProModule();
    expect(instance).toBeDefined();
    expect(instance).toBeInstanceOf(StealthLedgerPro);
  });

  // ----------------------------------------------------------------
  // 31. Factory accepts bus and config parameters
  // ----------------------------------------------------------------
  it('factory accepts bus and config parameters', () => {
    const bus = { emit: () => undefined };
    const instance = createStealthLedgerProModule(bus, { defaultCurrency: 'GBP' });
    expect(instance).toBeDefined();
  });
});

describe('stealth_ledger_pro_module metadata', () => {
  // ----------------------------------------------------------------
  // 32. Module metadata is correct
  // ----------------------------------------------------------------
  it('module metadata is correct', () => {
    expect(stealth_ledger_pro_module.id).toBe('stealth-ledger-pro');
    expect(stealth_ledger_pro_module.name).toBe('StealthLedgerPro');
    expect(stealth_ledger_pro_module.category).toBe('privacy');
    expect(stealth_ledger_pro_module.version).toBe('0.1.0');
    expect(stealth_ledger_pro_module.permissions).toEqual([
      'data:read',
      'data:write',
      'events:emit',
    ]);
    expect(stealth_ledger_pro_module.description).toBeDefined();
  });
});
