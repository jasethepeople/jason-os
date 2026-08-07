// ============================================================
// StealthLedgerPro Types — Encrypted Accounting Module
// ============================================================

export interface LedgerEntry {
  /** Unique identifier for the entry */
  id: string;
  /** Monetary amount (positive = income, negative = expense) */
  amount: number;
  /** Currency code (e.g., USD, EUR) */
  currency: string;
  /** Category classification */
  category: string;
  /** Entry description */
  description: string;
  /** Whether the entry is stored encrypted */
  encrypted: boolean;
  /** Timestamp of the entry (ms since epoch) */
  timestamp: number;
  /** Tags for filtering */
  tags: string[];
}

export interface StealthLedgerState {
  /** All ledger entries */
  entries: LedgerEntry[];
  /** Computed balance from all entries */
  balance: number;
  /** Unique categories in use */
  categories: string[];
  /** Timestamp of last entry, or null */
  lastEntryAt: number | null;
}

export interface FilterCriteria {
  /** Filter by category */
  category?: string;
  /** Filter by tags (all must match) */
  tags?: string[];
  /** Filter entries after this timestamp */
  after?: number;
  /** Filter entries before this timestamp */
  before?: number;
  /** Filter by currency */
  currency?: string;
  /** Filter by minimum amount */
  minAmount?: number;
  /** Filter by maximum amount */
  maxAmount?: number;
}

export interface CategorySummary {
  /** Category name */
  category: string;
  /** Total amount in this category */
  total: number;
  /** Number of entries */
  count: number;
  /** Average amount */
  average: number;
}

export interface LedgerConfig {
  /** Default currency for new entries */
  defaultCurrency?: string;
  /** Encrypt new entries by default */
  encryptByDefault?: boolean;
}
