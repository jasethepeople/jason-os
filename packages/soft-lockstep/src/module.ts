// ============================================================
// SoftLockstep Module — Synchronized Focus Companion
// Pair-based productivity through mutual focus tracking
// ============================================================

import type { LockstepPartner, LockstepState, EmotionInput } from './types.js';

// ------------------------------------------------------------------
// Module Definition
// ------------------------------------------------------------------

export const soft_lockstep_module = {
  id: 'soft-lockstep',
  name: 'SoftLockstep',
  category: 'productivity' as const,
  version: '0.1.0',
  permissions: ['telemetry:read', 'events:emit', 'partner:connect'] as const,
  description:
    'Synchronized focus companion — pair-based productivity through mutual focus tracking',
};

// ------------------------------------------------------------------
// SoftLockstep Implementation
// ------------------------------------------------------------------

export class SoftLockstep {
  private state: LockstepState = {
    active: false,
    partner: null,
    sessionStart: null,
    mutualFocusScore: 0,
    syncStatus: 'solo',
  };

  private _bus: unknown;
  private _heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private _heartbeatMs: number;
  private _partnerTimeoutMs: number;

  constructor(bus?: unknown, options?: { heartbeatMs?: number; partnerTimeoutMs?: number }) {
    this._bus = bus;
    void this._bus;
    this._heartbeatMs = options?.heartbeatMs ?? 5000;
    this._partnerTimeoutMs = options?.partnerTimeoutMs ?? 15000;
  }

  async init(): Promise<void> {
    return Promise.resolve();
  }

  // ----------------------------------------------------------------
  // Session Management
  // ----------------------------------------------------------------

  /**
   * Start a paired focus session with a partner.
   * @param partner - The partner to pair with
   */
  startPairedSession(partner: LockstepPartner): void {
    this.state.partner = { ...partner };
    this.state.active = true;
    this.state.sessionStart = Date.now();
    this.state.syncStatus = 'paired';
    this.state.mutualFocusScore = this.computeMutualFocus(
      { valence: 0.5, arousal: 0.5 },
      partner.focusScore
    );
    this.startHeartbeat();
    this.emit('lockstep:paired', { partnerId: partner.id, displayName: partner.displayName });
  }

  /**
   * End the current focus session.
   */
  endSession(): void {
    const partnerId = this.state.partner?.id ?? null;
    this.emit('lockstep:unpaired', { partnerId, durationMs: this.getSessionDuration() });
    this.stopHeartbeat();
    this.state.active = false;
    this.state.partner = null;
    this.state.sessionStart = null;
    this.state.mutualFocusScore = 0;
    this.state.syncStatus = 'solo';
  }

  // ----------------------------------------------------------------
  // Partner & Scoring
  // ----------------------------------------------------------------

  /**
   * Update the partner's focus score from their emotional telemetry.
   * @param emotion - The partner's current emotional state (valence + arousal)
   * @param partnerFocusScore - Direct focus score override (0-1)
   */
  updatePartnerScore(emotion: EmotionInput, partnerFocusScore?: number): void {
    if (!this.state.partner) return;
    const computedScore = partnerFocusScore ?? this.scoreFromEmotion(emotion);
    this.state.partner.focusScore = computedScore;
    this.state.partner.lastPingAt = Date.now();
    const selfEmotion: EmotionInput = { valence: 0.5, arousal: 0.5 };
    this.state.mutualFocusScore = this.computeMutualFocus(selfEmotion, computedScore);
  }

  /**
   * Get the current mutual focus score.
   * @returns Mutual focus score between 0 and 1
   */
  getMutualFocusScore(): number {
    return this.state.mutualFocusScore;
  }

  /**
   * Ping the partner to signal liveness.
   */
  ping(): void {
    if (this.state.partner) {
      this.state.partner.lastPingAt = Date.now();
    }
  }

  /**
   * Check if the partner is still alive based on last ping.
   * @returns True if partner has pinged within the timeout window
   */
  isPartnerAlive(): boolean {
    if (!this.state.partner) return false;
    return Date.now() - this.state.partner.lastPingAt < this._partnerTimeoutMs;
  }

  // ----------------------------------------------------------------
  // Sync Status
  // ----------------------------------------------------------------

  /**
   * Switch sync status (solo, paired, or group).
   * @param status - The new sync status
   */
  setSyncStatus(status: LockstepState['syncStatus']): void {
    this.state.syncStatus = status;
  }

  /**
   * Get the current sync status.
   * @returns Current synchronization status
   */
  getSyncStatus(): LockstepState['syncStatus'] {
    return this.state.syncStatus;
  }

  // ----------------------------------------------------------------
  // Getters
  // ----------------------------------------------------------------

  /**
   * Get the current partner, or null if none.
   * @returns Current partner copy
   */
  getPartner(): LockstepPartner | null {
    return this.state.partner ? { ...this.state.partner } : null;
  }

  /**
   * Get the duration of the current session in milliseconds.
   * @returns Session duration, or 0 if no active session
   */
  getSessionDuration(): number {
    if (!this.state.sessionStart) return 0;
    return Date.now() - this.state.sessionStart;
  }

  /**
   * Check if a paired session is currently active.
   * @returns Whether a session is active
   */
  isActive(): boolean {
    return this.state.active;
  }

  /**
   * Get the full current state.
   * @returns Deep-cloned state snapshot
   */
  getState(): LockstepState {
    return {
      active: this.state.active,
      partner: this.state.partner ? { ...this.state.partner } : null,
      sessionStart: this.state.sessionStart,
      mutualFocusScore: this.state.mutualFocusScore,
      syncStatus: this.state.syncStatus,
    };
  }

  // ----------------------------------------------------------------
  // Lifecycle
  // ----------------------------------------------------------------

  async destroy(): Promise<void> {
    this.stopHeartbeat();
    this.state = {
      active: false,
      partner: null,
      sessionStart: null,
      mutualFocusScore: 0,
      syncStatus: 'solo',
    };
    this._bus = undefined;
    return Promise.resolve();
  }

  // ----------------------------------------------------------------
  // Private helpers
  // ----------------------------------------------------------------

  /**
   * Compute a focus score from valence and arousal.
   * Higher valence + moderate arousal = higher focus.
   */
  private scoreFromEmotion(emotion: EmotionInput): number {
    const normalizedValence = (emotion.valence + 1) / 2; // -1..1 => 0..1
    const focusScore = normalizedValence * 0.6 + emotion.arousal * 0.4;
    return Math.min(1, Math.max(0, focusScore));
  }

  /**
   * Compute mutual focus score from self emotion and partner focus score.
   */
  private computeMutualFocus(selfEmotion: EmotionInput, partnerFocusScore: number): number {
    const selfScore = this.scoreFromEmotion(selfEmotion);
    return (selfScore + partnerFocusScore) / 2;
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this._heartbeatTimer = setInterval(() => {
      this.ping();
    }, this._heartbeatMs);
  }

  private stopHeartbeat(): void {
    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = null;
    }
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
        (b.emit as (event: unknown) => void)({ type, data, source: 'soft-lockstep' });
      }
    }
  }
}

// ------------------------------------------------------------------
// Factory
// ------------------------------------------------------------------

export function createSoftLockstepModule(
  bus?: unknown,
  options?: { heartbeatMs?: number; partnerTimeoutMs?: number }
): SoftLockstep {
  return new SoftLockstep(bus, options);
}
