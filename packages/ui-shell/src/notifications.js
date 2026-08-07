export class NotificationLayer {
    _queue = [];
    _quietMode = false;
    _maxBatchSize = 10;
    setQuietMode(v) {
        this._quietMode = v;
    }
    isQuietMode() {
        return this._quietMode;
    }
    push(message, priority = 'normal', moduleId) {
        // Quiet mode: batch non-critical, suppress normal/low
        if (this._quietMode && priority !== 'critical') {
            if (priority === 'low' || priority === 'normal') {
                const existing = this._queue.find((n) => !n.dismissed && n.priority === priority);
                if (existing) {
                    const count = (existing.message.match(/\(\+(\d+)\)/)?.[1]);
                    const num = count ? parseInt(count) + 1 : 1;
                    existing.message = existing.message.replace(/\s*\(\+\d+\)/, '') + ` (+${num})`;
                    return existing;
                }
            }
        }
        const n = {
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
    dismiss(id) {
        const n = this._queue.find((x) => x.id === id);
        if (n)
            n.dismissed = true;
    }
    getVisible() {
        return this._queue
            .filter((n) => !n.dismissed)
            .sort((a, b) => (b.priority === 'critical' ? 1 : 0) -
            (a.priority === 'critical' ? 1 : 0) ||
            b.timestamp - a.timestamp);
    }
    getAll() {
        return [...this._queue];
    }
    clear() {
        this._queue = [];
    }
    count() {
        return this._queue.filter((n) => !n.dismissed).length;
    }
}
export function createNotificationLayer() {
    return new NotificationLayer();
}
//# sourceMappingURL=notifications.js.map