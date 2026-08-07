import { type EventBus, type EventPayload, type EventHandler, type Subscription, type Priority } from '@jason-os/shared';
export declare class EventBusImpl implements EventBus {
    private _subscriptions;
    private _patternSubs;
    private _deadLetterQueue;
    private _history;
    private _historyIndex;
    private _historyCount;
    private _subCounter;
    emit<T>(event: Omit<EventPayload<T>, 'timestamp' | 'traceId'> & Partial<Pick<EventPayload<T>, 'timestamp' | 'traceId'>>): void;
    broadcast<T>(event: Omit<EventPayload<T>, 'timestamp' | 'traceId'> & Partial<Pick<EventPayload<T>, 'timestamp' | 'traceId'>>): void;
    on<T>(type: string, handler: EventHandler<T>, options?: {
        priority?: Priority;
        once?: boolean;
    }): Subscription;
    once<T>(type: string, handler: EventHandler<T>, options?: {
        priority?: Priority;
    }): Subscription;
    off(subscription: Subscription): void;
    subscribe<T>(pattern: string, handler: EventHandler<T>, options?: {
        priority?: Priority;
    }): Subscription;
    unsubscribe(subscription: Subscription): void;
    getSubscriberCount(type: string): number;
    clear(): void;
    getDeadLetterQueue(): readonly EventPayload[];
    getHistory(): readonly EventPayload[];
    getDeadLetterCount(): number;
    getHistoryCount(): number;
    private _finalizeEvent;
    private _generateTraceId;
    private _storeInHistory;
    private _addSubscription;
    private _removeSubscription;
    private _removeSubscriptionById;
    private _dispatch;
    private _dispatchBroadcast;
    private _invokeHandler;
    private _addToDeadLetter;
}
export declare function createEventBus(): EventBusImpl;
//# sourceMappingURL=event-bus.d.ts.map