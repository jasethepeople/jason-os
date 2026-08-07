type Priority = 'low' | 'normal' | 'high' | 'critical';
interface AppNotification {
    id: string;
    message: string;
    priority: Priority;
    timestamp: number;
    dismissed: boolean;
    moduleId?: string;
}
export declare class NotificationLayer {
    private _queue;
    private _quietMode;
    private _maxBatchSize;
    setQuietMode(v: boolean): void;
    isQuietMode(): boolean;
    push(message: string, priority?: Priority, moduleId?: string): AppNotification;
    dismiss(id: string): void;
    getVisible(): AppNotification[];
    getAll(): AppNotification[];
    clear(): void;
    count(): number;
}
export declare function createNotificationLayer(): NotificationLayer;
export {};
//# sourceMappingURL=notifications.d.ts.map