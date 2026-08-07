type Priority = 'low' | 'normal' | 'high' | 'critical';

interface AppNotification {
  id: string;
  message: string;
  priority: Priority;
  timestamp: number;
  dismissed: boolean;
  moduleId?: string;
}

export class NotificationLayer {
  private _queue: AppNotification[] = [];
  private _quietMode = false;
  private _maxBatchSize = 10;

  setQuietMode(v: boolean): void {
    this._quietMode = v;
  }

  isQuietMode(): boolean {
    return this._quietMode;
  }

  push(
    message: string,
    priority: Priority = 'normal',
    moduleId?: string,
  ): AppNotification {
    // Quiet mode: batch non-critical, suppress normal/low
    if (this._quietMode && priority !== 'critical') {
      if (priority === 'low' || priority === 'normal') {
        const existing = this._queue.find(
          (n) => !n.dismissed && n.priority === priority,
        );
        if (existing) {
          const count = (existing.message.match(/\(\+(\d+)\)/)?.[1]);
          const num = count ? parseInt(count) + 1 : 1;
          existing.message = existing.message.replace(/\s*\(\+\d+\)/, '') + ` (+${num})`;
          return existing;
        }
      }
    }

    const n: AppNotification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      message,
      priority,
      timestamp: Date.now(),
      dismissed: false,
      ...(moduleId !== undefined ? { moduleId } : {}),
    };
    this._queue.push(n);

    if (priority === 'critical') {
      console.warn(`[Jason-OS Critical] ${message}`);
    }

    // Prune old dismissed notifications
    if (this._queue.length > this._maxBatchSize * 10) {
      this._queue = this._queue.filter((x) => !x.dismissed).slice(-this._maxBatchSize * 5);
    }

    return n;
  }

  dismiss(id: string): void {
    const n = this._queue.find((x) => x.id === id);
    if (n) n.dismissed = true;
  }

  getVisible(): AppNotification[] {
    return this._queue
      .filter((n) => !n.dismissed)
      .sort(
        (a, b) =>
          (b.priority === 'critical' ? 1 : 0) -
            (a.priority === 'critical' ? 1 : 0) ||
          b.timestamp - a.timestamp,
      );
  }

  getAll(): AppNotification[] {
    return [...this._queue];
  }

  clear(): void {
    this._queue = [];
  }

  count(): number {
    return this._queue.filter((n) => !n.dismissed).length;
  }
}

export function createNotificationLayer(): NotificationLayer {
  return new NotificationLayer();
}
