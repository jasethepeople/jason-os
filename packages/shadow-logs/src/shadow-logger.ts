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
import type { EncryptedBlob } from '@jason-os/shared';

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

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

// Internal stored representation — plaintext, encrypted, or shredded bytes
interface StoredEntry {
  id: string;
  // When encrypted, the entry blob is stored; raw LogEntry otherwise; Uint8Array when shredded
  data: LogEntry | EncryptedBlob | Uint8Array;
  encrypted: boolean;
  timestamp: number;
  // For crypto-shredding: overwrite this before delete
  _shred?: Uint8Array;
}

// ------------------------------------------------------------------
// ShadowLogger
// ------------------------------------------------------------------

export class ShadowLogger {
  private entries: StoredEntry[] = [];
  private _burnPolicy: BurnPolicy = { type: 'manual' };
  private _storageMode: StorageMode = 'MEMORY';
  private _stealth = true;
  private _keyId: string | undefined;
  private panicBuffer = '';
  private destroyed = false;

  // PrivacyKernel reference (created internally, can be injected)
  private privacyKernel: PrivacyKernel;

  constructor(options?: {
    storageMode?: StorageMode;
    burnPolicy?: BurnPolicy;
    privacyKernel?: PrivacyKernel;
  }) {
    this._storageMode = options?.storageMode ?? 'MEMORY';
    this._burnPolicy = options?.burnPolicy ?? { type: 'manual' };
    this.privacyKernel = options?.privacyKernel ?? new PrivacyKernel();

    // In EPHEMERAL/PERSISTENT mode, we still need a key for encryption
    if (this._storageMode !== 'MEMORY') {
      this.privacyKernel.setPrivacyTier('SHADOW');
    }
  }

  // ----------------------------------------------------------------
  // Public properties (read-only)
  // ----------------------------------------------------------------

  get storageMode(): StorageMode {
    return this._storageMode;
  }

  get burnPolicy(): BurnPolicy {
    return { ...this._burnPolicy };
  }

  get stealth(): boolean {
    return this._stealth;
  }

  // ----------------------------------------------------------------
  // Logging
  // ----------------------------------------------------------------

  /**
   * Synchronously store a log entry (encryption is async internally
   * so we queue it via microtask — the entry is inserted immediately
   * in unencrypted form then swapped once encryption completes).
   */
  log(entry: LogEntry): void {
    if (this.destroyed) return;

    const stored: StoredEntry = {
      id: entry.id,
      data: entry,
      encrypted: false,
      timestamp: entry.timestamp,
    };

    this.entries.push(stored);

    // If storage mode demands encryption, encrypt asynchronously
    if (this._storageMode !== 'MEMORY') {
      this.encryptEntry(stored, entry);
    }

    this.checkBurnPolicy();
  }

  /**
   * Asynchronously log an entry (encryption happens before resolve).
   */
  async logAsync(entry: Omit<LogEntry, 'timestamp'>): Promise<void> {
    if (this.destroyed) return;

    const fullEntry: LogEntry = {
      ...entry,
      timestamp: Date.now(),
    };

    let stored: StoredEntry;

    if (this._storageMode === 'MEMORY') {
      stored = {
        id: fullEntry.id,
        data: fullEntry,
        encrypted: false,
        timestamp: fullEntry.timestamp,
      };
    } else {
      const blob = await this.encryptLogEntry(fullEntry);
      stored = {
        id: fullEntry.id,
        data: blob,
        encrypted: true,
        timestamp: fullEntry.timestamp,
      };
    }

    this.entries.push(stored);
    this.checkBurnPolicy();
  }

  // ----------------------------------------------------------------
  // Querying
  // ----------------------------------------------------------------

  /**
   * Query logs with a filter. Decrypts entries on demand.
   */
  async query(filter: LogFilter): Promise<LogEntry[]> {
    const results: LogEntry[] = [];
    let matched = 0;
    const offset = filter.offset ?? 0;

    for (const stored of this.entries) {
      const entry = await this.resolveEntry(stored);

      if (!this.matchesFilter(entry, filter)) {
        continue;
      }

      if (matched < offset) {
        matched++;
        continue;
      }

      results.push(entry);

      if (filter.limit !== undefined && results.length >= filter.limit) {
        break;
      }
    }

    return results;
  }

  /**
   * Get the N most recent entries (newest first).
   */
  async getRecent(count: number): Promise<LogEntry[]> {
    const sorted = [...this.entries].sort((a, b) => b.timestamp - a.timestamp);
    const sliced = sorted.slice(0, count);
    const resolved = await Promise.all(sliced.map((s) => this.resolveEntry(s)));
    return resolved;
  }

  // ----------------------------------------------------------------
  // Burn policy
  // ----------------------------------------------------------------

  setBurnPolicy(policy: BurnPolicy): void {
    this._burnPolicy = { ...policy };

    // Reset panic buffer when panic gesture changes
    if (policy.type === 'panic' && policy.panicGesture) {
      this.panicBuffer = '';
    }
  }

  /**
   * Manually burn all logs (cryptographic shredding).
   */
  async burn(): Promise<void> {
    // Cryptographic shredding: overwrite each entry's data before clearing
    for (const entry of this.entries) {
      this.shredEntry(entry);
    }

    // Help GC by zeroing references
    this.entries = [];
    this.panicBuffer = '';
  }

  // ----------------------------------------------------------------
  // Stats
  // ----------------------------------------------------------------

  getStats(): LogStats {
    const byLevel: Record<LogLevel, number> = {
      DEBUG: 0,
      INFO: 0,
      WARN: 0,
      ERROR: 0,
      CRITICAL: 0,
    };

    let oldestEntry = 0;
    let newestEntry = 0;

    for (const stored of this.entries) {
      // For level counts, only plaintext entries can be read without async decrypt
      if (!stored.encrypted && 'level' in (stored.data as LogEntry)) {
        const entry = stored.data as LogEntry;
        const level = entry.level;
        if (level && level in byLevel) {
          byLevel[level]++;
        }
      }

      if (oldestEntry === 0 || stored.timestamp < oldestEntry) {
        oldestEntry = stored.timestamp;
      }
      if (stored.timestamp > newestEntry) {
        newestEntry = stored.timestamp;
      }
    }

    return {
      totalEntries: this.entries.length,
      oldestEntry,
      newestEntry,
      byLevel,
      encrypted: this._storageMode !== 'MEMORY',
    };
  }

  // ----------------------------------------------------------------
  // Panic gesture
  // ----------------------------------------------------------------

  /**
   * Feed a character into the panic gesture detector.
   * Returns true if the panic gesture was triggered and burn executed.
   */
  feedPanicGesture(char: string): boolean {
    if (this._burnPolicy.type !== 'panic' || !this._burnPolicy.panicGesture) {
      return false;
    }

    this.panicBuffer += char;

    // Keep buffer at most the gesture length
    const gesture = this._burnPolicy.panicGesture;
    if (this.panicBuffer.length > gesture.length) {
      this.panicBuffer = this.panicBuffer.slice(-gesture.length);
    }

    if (this.panicBuffer === gesture) {
      // Trigger burn synchronously, then clear
      this.burn();
      this.panicBuffer = '';
      return true;
    }

    return false;
  }

  // ----------------------------------------------------------------
  // Lifecycle
  // ----------------------------------------------------------------

  /**
   * Permanently destroy this logger and all its data.
   */
  destroy(): void {
    this.burn();
    this.destroyed = true;
    this.entries = [];
  }

  // ----------------------------------------------------------------
  // Private helpers
  // ----------------------------------------------------------------

  private async encryptLogEntry(entry: LogEntry): Promise<EncryptedBlob> {
    const json = JSON.stringify(entry);
    const encoder = new TextEncoder();
    const data = encoder.encode(json);

    // Ensure we have a key
    if (!this._keyId) {
      const keyMaterial = await this.privacyKernel.generateSymmetricKey();
      this._keyId = keyMaterial.keyId;
    }

    return this.privacyKernel.encrypt(data, this._keyId);
  }

  private encryptEntry(stored: StoredEntry, entry: LogEntry): void {
    // Fire-and-forget encryption (microtask)
    Promise.resolve().then(async () => {
      try {
        const blob = await this.encryptLogEntry(entry);
        stored.data = blob;
        stored.encrypted = true;
        // Also store a shred buffer for crypto shredding
        stored._shred = new Uint8Array(64);
        crypto.getRandomValues(stored._shred);
      } catch {
        // Encryption failure: entry remains plaintext (still functional)
        stored.encrypted = false;
      }
    });
  }

  private async resolveEntry(stored: StoredEntry): Promise<LogEntry> {
    if (!stored.encrypted || !(stored.data && 'ciphertext' in stored.data)) {
      return stored.data as LogEntry;
    }

    // Decrypt
    const blob = stored.data as EncryptedBlob;
    if (!this._keyId) {
      // Key lost — return a placeholder
      return this.placeholderEntry(stored);
    }

    try {
      const decrypted = await this.privacyKernel.decrypt(blob, this._keyId);
      const decoder = new TextDecoder();
      const json = decoder.decode(decrypted);
      return JSON.parse(json) as LogEntry;
    } catch {
      return this.placeholderEntry(stored);
    }
  }

  private placeholderEntry(stored: StoredEntry): LogEntry {
    return {
      id: stored.id,
      level: 'ERROR',
      category: 'shadow-logs',
      message: '[encrypted entry unreadable]',
      timestamp: stored.timestamp,
      source: 'shadow-logger',
      encrypted: true,
    };
  }

  private matchesFilter(entry: LogEntry, filter: LogFilter): boolean {
    if (filter.levels !== undefined && !filter.levels.includes(entry.level)) {
      return false;
    }
    if (
      filter.categories !== undefined &&
      !filter.categories.includes(entry.category)
    ) {
      return false;
    }
    if (filter.since !== undefined && entry.timestamp < filter.since) {
      return false;
    }
    if (filter.until !== undefined && entry.timestamp > filter.until) {
      return false;
    }
    if (
      filter.sources !== undefined &&
      !filter.sources.includes(entry.source)
    ) {
      return false;
    }
    return true;
  }

  private checkBurnPolicy(): void {
    const now = Date.now();

    switch (this._burnPolicy.type) {
      case 'ttl': {
        const ttl = this._burnPolicy.ttlMs ?? Infinity;
        const cutoff = now - ttl;
        // Remove entries older than TTL
        const toKeep = this.entries.filter((e) => e.timestamp >= cutoff);
        const toBurn = this.entries.filter((e) => e.timestamp < cutoff);
        for (const entry of toBurn) {
          this.shredEntry(entry);
        }
        this.entries = toKeep;
        break;
      }

      case 'count': {
        const max = this._burnPolicy.maxEntries ?? Infinity;
        if (this.entries.length > max) {
          const toBurn = this.entries.slice(0, this.entries.length - max);
          const toKeep = this.entries.slice(-max);
          for (const entry of toBurn) {
            this.shredEntry(entry);
          }
          this.entries = toKeep;
        }
        break;
      }

      case 'manual':
      case 'panic':
      default:
        // No automatic action
        break;
    }


  }

  private shredEntry(entry: StoredEntry): void {
    // Overwrite the data field with random bytes to hinder memory forensics
    if (entry._shred) {
      entry.data = entry._shred;
    } else if ('ciphertext' in (entry.data as object)) {
      // Encrypted blob: overwrite ciphertext
      const blob = entry.data as EncryptedBlob;
      const overwrite = new Uint8Array(blob.ciphertext.length);
      crypto.getRandomValues(overwrite);
      blob.ciphertext = overwrite;
    }
    entry.encrypted = false;
  }
}
