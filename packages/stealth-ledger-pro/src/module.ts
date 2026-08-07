// ============================================================
// StealthLedgerPro Module — Encrypted Accounting
// Privacy-preserving ledger with encrypted entries and category tracking
// ============================================================

import type {
  LedgerEntry,
  StealthLedgerState,
  FilterCriteria,
  CategorySummary,
  LedgerConfig,
} from './types.js';

// ------------------------------------------------------------------
// Module Definition
// ------------------------------------------------------------------

export const stealth_ledger_pro_module = {
  id: 'stealth-ledger-pro',
  name: 'StealthLedgerPro',
  category: 'privacy' as const,
  version: '0.1.0',
  permissions: ['data:read', 'data:write', 'events:emit'] as const,
  description: 'Privacy-preserving ledger with encrypted entries and category tracking',
};

// ------------------------------------------------------------------
// Defaults
// ------------------------------------------------------------------

const DEFAULT_CURRENCY = 'USD';

// Simple encryption: base64 encode (placeholder for real encryption)
function encryptAmount(amount: number, _key?: string): string {
  return `ENC:${btoa(amount.toString())}`;
}

// ------------------------------------------------------------------
// StealthLedgerPro Implementation
// ------------------------------------------------------------------

export class StealthLedgerPro {
  private state: StealthLedgerState = {
    entries: [],
    balance: 0,
    categories: [],
    lastEntryAt: null,
  };

  private _bus: unknown;
  private _config: Required<LedgerConfig>;
  private _entryIdCounter = 0;

  constructor(bus?: unknown, config: LedgerConfig = {}) {
    this._bus = bus;
    void this._bus;
    this._config = {
      defaultCurrency: config.defaultCurrency ?? DEFAULT_CURRENCY,
      encryptByDefault: config.encryptByDefault ?? false,
    };
  }

  async init(): Promise<void> {
    return Promise.resolve();
  }

  /**
   * Add a new ledger entry.
   * @param entry - Entry data (without id/timestamp)
   * @returns The created entry with generated id and timestamp
   */
  addEntry(
    entry: Omit<LedgerEntry, 'id' | 'timestamp'>
  ): LedgerEntry {
    this._entryIdCounter++;
    const id = `entry-${this._entryIdCounter}-${Date.now()}`;
    const timestamp = Date.now();

    const newEntry: LedgerEntry = {
      ...entry,
      id,
      timestamp,
      currency: entry.currency || this._config.defaultCurrency,
      encrypted: entry.encrypted ?? this._config.encryptByDefault,
    };

    this.state.entries.push({ ...newEntry });
    this.state.balance += newEntry.amount;

    if (!this.state.categories.includes(newEntry.category)) {
      this.state.categories.push(newEntry.category);
    }

    this.state.lastEntryAt = timestamp;

    this.emit('ledger:entry-added', {
      entryId: id,
      amount: newEntry.amount,
      category: newEntry.category,
    });

    return { ...newEntry };
  }

  /**
   * Get the current computed balance.
   * @returns Sum of all entry amounts
   */
  getBalance(): number {
    return this.state.balance;
  }

  /**
   * Recalculate balance from all entries (useful for data integrity checks).
   * @returns Recalculated balance
   */
  recalculateBalance(): number {
    this.state.balance = this.state.entries.reduce(
      (sum, entry) => sum + entry.amount,
      0
    );
    return this.state.balance;
  }

  /**
   * Filter entries by multiple criteria.
   * @param criteria - Filter conditions
   * @returns Matching entries
   */
  filterEntries(criteria: FilterCriteria): LedgerEntry[] {
    return this.state.entries.filter((entry) => {
      if (criteria.category !== undefined && entry.category !== criteria.category) {
        return false;
      }
      if (criteria.currency !== undefined && entry.currency !== criteria.currency) {
        return false;
      }
      if (criteria.after !== undefined && entry.timestamp <= criteria.after) {
        return false;
      }
      if (criteria.before !== undefined && entry.timestamp > criteria.before) {
        return false;
      }
      if (criteria.minAmount !== undefined && entry.amount < criteria.minAmount) {
        return false;
      }
      if (criteria.maxAmount !== undefined && entry.amount > criteria.maxAmount) {
        return false;
      }
      if (criteria.tags !== undefined && criteria.tags.length > 0) {
        const hasAllTags = criteria.tags.every((tag) => entry.tags.includes(tag));
        if (!hasAllTags) return false;
      }
      return true;
    }).map((e) => ({ ...e, tags: [...e.tags] }));
  }

  /**
   * Get a summary of totals grouped by category.
   * @returns Array of category summaries
   */
  getSummaryByCategory(): CategorySummary[] {
    const map = new Map<string, { total: number; count: number }>();

    for (const entry of this.state.entries) {
      const existing = map.get(entry.category);
      if (existing) {
        existing.total += entry.amount;
        existing.count += 1;
      } else {
        map.set(entry.category, { total: entry.amount, count: 1 });
      }
    }

    return Array.from(map.entries()).map(([category, data]) => ({
      category,
      total: data.total,
      count: data.count,
      average: data.count > 0 ? data.total / data.count : 0,
    }));
  }

  /**
   * Get an entry by its ID.
   * @param entryId - Entry ID to find
   * @returns Entry or undefined
   */
  getEntry(entryId: string): LedgerEntry | undefined {
    const entry = this.state.entries.find((e) => e.id === entryId);
    return entry ? { ...entry, tags: [...entry.tags] } : undefined;
  }

  /**
   * Get all entries.
   * @returns All ledger entries
   */
  getAllEntries(): LedgerEntry[] {
    return [...this.state.entries];
  }

  /**
   * Get the number of entries.
   * @returns Entry count
   */
  getEntryCount(): number {
    return this.state.entries.length;
  }

  /**
   * Remove an entry by ID.
   * @param entryId - Entry ID to remove
   * @returns Whether the entry was found and removed
   */
  removeEntry(entryId: string): boolean {
    const idx = this.state.entries.findIndex((e) => e.id === entryId);
    if (idx === -1) return false;
    const removed = this.state.entries.splice(idx, 1)[0];
    if (removed) {
      this.state.balance -= removed.amount;
    }
    // Recalculate categories
    this.state.categories = [
      ...new Set(this.state.entries.map((e) => e.category)),
    ];
    return true;
  }

  /**
   * Export entries as encrypted payload.
   * @returns Encrypted export string
   */
  exportEncrypted(): string {
    const payload = {
      entries: this.state.entries.map((e) => ({
        ...e,
        encryptedAmount: e.encrypted ? e.amount : encryptAmount(e.amount),
      })),
      balance: this.state.balance,
      categories: [...this.state.categories],
      exportedAt: Date.now(),
    };
    return `STEALTH:${btoa(JSON.stringify(payload))}`;
  }

  /**
   * Get the full current state of the ledger.
   * @returns Deep-cloned state snapshot
   */
  getState(): StealthLedgerState {
    return {
      entries: this.state.entries.map((e) => ({ ...e, tags: [...e.tags] })),
      balance: this.state.balance,
      categories: [...this.state.categories],
      lastEntryAt: this.state.lastEntryAt,
    };
  }

  async destroy(): Promise<void> {
    this.state = {
      entries: [],
      balance: 0,
      categories: [],
      lastEntryAt: null,
    };
    this._entryIdCounter = 0;
    this._bus = undefined;
    return Promise.resolve();
  }

  // ------------------------------------------------------------------
  // Event emission helper
  // ------------------------------------------------------------------

  private emit(type: string, data: Record<string, unknown>): void {
    if (
      this._bus &&
      typeof this._bus === 'object' &&
      this._bus !== null
    ) {
      const b = this._bus as Record<string, unknown>;
      if (b.emit && typeof b.emit === 'function') {
        (b.emit as (event: unknown) => void)({ type, data, source: 'stealth-ledger-pro' });
      }
    }
  }
}

// ------------------------------------------------------------------
// Factory
// ------------------------------------------------------------------

export function createStealthLedgerProModule(
  bus?: unknown,
  config?: LedgerConfig
): StealthLedgerPro {
  return new StealthLedgerPro(bus, config);
}
