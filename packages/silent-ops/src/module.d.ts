import type { AutomatedTask, SilentOpsState, TaskRunRecord, SilentOpsConfig, TaskTrigger, SilentOpsEvents } from './types.js';
export interface EventBus {
    emit<K extends keyof SilentOpsEvents>(event: K, payload: SilentOpsEvents[K]): void;
}
export declare class SilentOps {
    private readonly tasks;
    private readonly queue;
    private runHistory;
    private activeRunners;
    private readonly config;
    private bus;
    constructor(options?: Partial<SilentOpsConfig> & {
        bus?: EventBus;
    });
    /**
     * Define a new automated task.
     */
    defineTask(name: string, trigger: TaskTrigger, config: Record<string, unknown>, silent?: boolean): AutomatedTask;
    /**
     * Enable a previously disabled task.
     */
    enableTask(taskId: string): AutomatedTask;
    /**
     * Disable a task so it will not run.
     */
    disableTask(taskId: string): AutomatedTask;
    /**
     * Run a task by ID. Executes silently (no UI feedback).
     * Emits event to bus only, not UI.
     */
    runTask(taskId: string): Promise<TaskRunRecord>;
    /**
     * Get the current execution queue.
     */
    getQueue(): string[];
    /**
     * Get full task run history.
     */
    getRunHistory(taskId?: string): TaskRunRecord[];
    /**
     * Get current state snapshot.
     */
    getState(): SilentOpsState;
    /**
     * Get a single task by ID.
     */
    getTask(taskId: string): AutomatedTask | undefined;
    /**
     * Get all defined tasks.
     */
    getAllTasks(): AutomatedTask[];
    /**
     * Remove a task entirely.
     */
    removeTask(taskId: string): boolean;
    /**
     * Clear the entire queue.
     */
    clearQueue(): void;
    private executeTask;
    private processQueue;
    private generateId;
}
//# sourceMappingURL=module.d.ts.map