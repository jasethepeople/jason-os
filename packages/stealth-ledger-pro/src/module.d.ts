import type { LedgerEntry, StealthLedgerState, FilterCriteria, CategorySummary, LedgerConfig } from './types.js';
export declare const stealth_ledger_pro_module: {
    id: string;
    name: string;
    category: 'privacy';
    version: string;
    permissions: readonly ['data:read', 'data:write', 'events:emit'];
    description: string;
};
export declare class StealthLedgerPro {
    private state;
    private _bus;
    private _config;
    private _entryIdCounter;
    constructor(bus?: unknown, config?: LedgerConfig);
    init(): Promise<void>;
    /**
     * Add a new ledger entry.
     * @param entry - Entry data (without id/timestamp)
     * @returns The created entry with generated id and timestamp
     */
    addEntry(entry: Omit<LedgerEntry, 'id' | 'timestamp'>): LedgerEntry;
    /**
     * Get the current computed balance.
     * @returns Sum of all entry amounts
     */
    getBalance(): number;
    /**
     * Recalculate balance from all entries (useful for data integrity checks).
     * @returns Recalculated balance
     */
    recalculateBalance(): number;
    /**
     * Filter entries by multiple criteria.
     * @param criteria - Filter conditions
     * @returns Matching entries
     */
    filterEntries(criteria: FilterCriteria): LedgerEntry[];
    /**
     * Get a summary of totals grouped by category.
     * @returns Array of category summaries
     */
    getSummaryByCategory(): CategorySummary[];
    /**
     * Get an entry by its ID.
     * @param entryId - Entry ID to find
     * @returns Entry or undefined
     */
    getEntry(entryId: string): LedgerEntry | undefined;
    /**
     * Get all entries.
     * @returns All ledger entries
     */
    getAllEntries(): LedgerEntry[];
    /**
     * Get the number of entries.
     * @returns Entry count
     */
    getEntryCount(): number;
    /**
     * Remove an entry by ID.
     * @param entryId - Entry ID to remove
     * @returns Whether the entry was found and removed
     */
    removeEntry(entryId: string): boolean;
    /**
     * Export entries as encrypted payload.
     * @returns Encrypted export string
     */
    exportEncrypted(): string;
    /**
     * Get the full current state of the ledger.
     * @returns Deep-cloned state snapshot
     */
    getState(): StealthLedgerState;
    destroy(): Promise<void>;
    private emit;
}
export declare function createStealthLedgerProModule(bus?: unknown, config?: LedgerConfig): StealthLedgerPro;
//# sourceMappingURL=module.d.ts.map