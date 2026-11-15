import type { Veil, UnderveilState } from './types.js';

export const underveil_module = {
  id: 'underveil',
  name: 'Underveil',
  category: 'communication' as const,
  version: '0.1.0',
  permissions: ['identity:read', 'storage:write'] as const,
  description: 'Consent-based communication veils for identity protection',
};

export class Underveil {
  private state: UnderveilState = {
    veils: [],
    consentGiven: false,
    consentTimestamp: null,
    activeVeilId: null,
  };
  private _bus: unknown;

  constructor(bus?: unknown) {
    this._bus = bus;
  }

  async init(): Promise<void> {
    /* no-op */
  }

  private veilCounter = 0;

  giveConsent(): void {
    this.state.consentGiven = true;
    this.state.consentTimestamp = Date.now();
    this.emit('underveil:consent-given', {});
  }

  revokeConsent(): void {
    this.state.consentGiven = false;
    this.state.consentTimestamp = null;
    this.state.activeVeilId = null;
    // Revoking consent must also switch every veil off
    this.state.veils.forEach((v) => {
      v.active = false;
    });
    this.emit('underveil:consent-revoked', {});
  }

  createVeil(label: string): Veil {
    const veil: Veil = {
      id: `veil-${Date.now().toString(36)}-${++this.veilCounter}-${Math.random().toString(36).slice(2, 8)}`,
      label,
      active: false,
      createdAt: Date.now(),
    };
    this.state.veils.push(veil);
    return veil;
  }

  activateVeil(id: string): void {
    if (!this.state.consentGiven) {
      throw new Error('Consent required before activating veil');
    }
    this.state.veils.forEach((v) => {
      v.active = false;
    });
    const veil = this.state.veils.find((v) => v.id === id);
    if (veil) {
      veil.active = true;
    }
    this.state.activeVeilId = id;
  }

  getActiveVeil(): Veil | null {
    return this.state.veils.find((v) => v.id === this.state.activeVeilId) ?? null;
  }

  getState(): UnderveilState {
    return { ...this.state, veils: this.state.veils.map((v) => ({ ...v })) };
  }

  async destroy(): Promise<void> {
    /* no-op */
  }

  private emit(type: string, data: unknown): void {
    if (this._bus && typeof this._bus === 'object' && this._bus !== null) {
      const b = this._bus as Record<string, unknown>;
      if (b.emit && typeof b.emit === 'function') {
        (b.emit as (...args: unknown[]) => void)({
          type,
          data,
          source: 'underveil',
        });
      }
    }
  }
}

export function createUnderveilModule(bus?: unknown): Underveil {
  return new Underveil(bus);
}
