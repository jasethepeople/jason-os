/**
 * shadow-logger.ts — Stealth logging with encrypted storage and burn policies
 *
 * Core principles:
 *   - Zero UI indicators: no console output, no external side effects
 *   - Memory-first: logs live in RAM, wiped on teardown
 *   - Encrypted: PrivacyKernel encrypts entries before storage
 *   - Self-burning: TTL, count, manual, and panic policies destroy logs
 *   - Cryptographic shredding: data is overwritten before deletion
 */
import { PrivacyKernel } from '@jason-os/privacy-kernel';
export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';
export interface LogEntry {
    id: string;
    level: LogLevel;
    category: string;
    message: string;
    metadata?: Record<string, unknown>;
    timestamp: number;
    source: string;
    encrypted: boolean;
}
export interface LogFilter {
    levels?: LogLevel[];
    categories?: string[];
    since?: number;
    until?: number;
    sources?: string[];
    limit?: number;
    offset?: number;
}
export type BurnPolicyType = 'ttl' | 'count' | 'manual' | 'panic';
export interface BurnPolicy {
    type: BurnPolicyType;
    ttlMs?: number;
    maxEntries?: number;
    panicGesture?: string;
}
export interface LogStats {
    totalEntries: number;
    oldestEntry: number;
    newestEntry: number;
    byLevel: Record<LogLevel, number>;
    encrypted: boolean;
}
export type StorageMode = 'MEMORY' | 'EPHEMERAL' | 'PERSISTENT';
export declare class ShadowLogger {
    private entries;
    private _burnPolicy;
    private _storageMode;
    private _stealth;
    private _keyId;
    private panicBuffer;
    private lastBurnCheck;
    private destroyed;
    private privacyKernel;
    constructor(options?: {
        storageMode?: StorageMode;
        burnPolicy?: BurnPolicy;
        privacyKernel?: PrivacyKernel;
    });
    get storageMode(): StorageMode;
    get burnPolicy(): BurnPolicy;
    get stealth(): boolean;
    /**
     * Synchronously store a log entry (encryption is async internally
     * so we queue it via microtask — the entry is inserted immediately
     * in unencrypted form then swapped once encryption completes).
     */
    log(entry: LogEntry): void;
    /**
     * Asynchronously log an entry (encryption happens before resolve).
     */
    logAsync(entry: Omit<LogEntry, 'timestamp'>): Promise<void>;
    /**
     * Query logs with a filter. Decrypts entries on demand.
     */
    query(filter: LogFilter): Promise<LogEntry[]>;
    /**
     * Get the N most recent entries (newest first).
     */
    getRecent(count: number): Promise<LogEntry[]>;
    setBurnPolicy(policy: BurnPolicy): void;
    /**
     * Manually burn all logs (cryptographic shredding).
     */
    burn(): Promise<void>;
    getStats(): LogStats;
    /**
     * Feed a character into the panic gesture detector.
     * Returns true if the panic gesture was triggered and burn executed.
     */
    feedPanicGesture(char: string): boolean;
    /**
     * Permanently destroy this logger and all its data.
     */
    destroy(): void;
    private encryptLogEntry;
    private encryptEntry;
    private resolveEntry;
    private placeholderEntry;
    private matchesFilter;
    private checkBurnPolicy;
    private shredEntry;
}
//# sourceMappingURL=shadow-logger.d.ts.map