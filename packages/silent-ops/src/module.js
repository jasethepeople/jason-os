export class SilentOps {
    tasks = new Map();
    queue = [];
    runHistory = [];
    activeRunners = 0;
    config;
    bus;
    constructor(options = {}) {
        this.config = {
            maxConcurrentRunners: 5,
            defaultSilent: true,
            busEmitEnabled: true,
            ...options,
        };
        this.bus = options.bus;
    }
    /**
     * Define a new automated task.
     */
    defineTask(name, trigger, config, silent) {
        const id = this.generateId();
        const task = {
            id,
            name,
            trigger,
            config,
            lastRunAt: null,
            runCount: 0,
            enabled: true,
            silent: silent ?? this.config.defaultSilent,
        };
        this.tasks.set(id, task);
        return task;
    }
    /**
     * Enable a previously disabled task.
     */
    enableTask(taskId) {
        const task = this.tasks.get(taskId);
        if (!task) {
            throw new Error(`Task not found: ${taskId}`);
        }
        task.enabled = true;
        return task;
    }
    /**
     * Disable a task so it will not run.
     */
    disableTask(taskId) {
        const task = this.tasks.get(taskId);
        if (!task) {
            throw new Error(`Task not found: ${taskId}`);
        }
        task.enabled = false;
        return task;
    }
    /**
     * Run a task by ID. Executes silently (no UI feedback).
     * Emits event to bus only, not UI.
     */
    async runTask(taskId) {
        const task = this.tasks.get(taskId) ?? Array.from(this.tasks.values()).find((t) => t.name === taskId);
        if (!task) {
            throw new Error(`Task not found: ${taskId}`);
        }
        if (!task.enabled) {
            throw new Error(`Task is disabled: ${taskId}`);
        }
        if (this.activeRunners >= this.config.maxConcurrentRunners) {
            this.queue.push(taskId);
            throw new Error(`Max concurrent runners reached. Task ${taskId} queued.`);
        }
        this.activeRunners++;
        const startedAt = Date.now();
        try {
            const result = await this.executeTask(task);
            const completedAt = Date.now();
            task.lastRunAt = completedAt;
            task.runCount++;
            const record = {
                taskId,
                startedAt,
                completedAt,
                result: 'success',
                output: result,
            };
            this.runHistory.push(record);
            if (this.config.busEmitEnabled && this.bus) {
                this.bus.emit('silent-ops:task-completed', {
                    taskId,
                    taskName: task.name,
                    completedAt,
                    silent: task.silent,
                });
            }
            return record;
        }
        catch (error) {
            const completedAt = Date.now();
            const record = {
                taskId,
                startedAt,
                completedAt,
                result: 'failure',
                output: error instanceof Error ? error.message : String(error),
            };
            this.runHistory.push(record);
            return record;
        }
        finally {
            this.activeRunners--;
            this.processQueue();
        }
    }
    /**
     * Get the current execution queue.
     */
    getQueue() {
        return [...this.queue];
    }
    /**
     * Get full task run history.
     */
    getRunHistory(taskId) {
        if (taskId) {
            return this.runHistory.filter((r) => r.taskId === taskId);
        }
        return [...this.runHistory];
    }
    /**
     * Get current state snapshot.
     */
    getState() {
        return {
            tasks: Array.from(this.tasks.values()),
            queue: [...this.queue],
            activeRunners: this.activeRunners,
        };
    }
    /**
     * Get a single task by ID.
     */
    getTask(taskId) {
        return this.tasks.get(taskId);
    }
    /**
     * Get all defined tasks.
     */
    getAllTasks() {
        return Array.from(this.tasks.values());
    }
    /**
     * Remove a task entirely.
     */
    removeTask(taskId) {
        return this.tasks.delete(taskId);
    }
    /**
     * Clear the entire queue.
     */
    clearQueue() {
        this.queue.length = 0;
    }
    async executeTask(task) {
        const { handler, ...handlerConfig } = task.config;
        if (typeof handler === 'function') {
            return String(await handler(handlerConfig));
        }
        return `Executed ${task.name} with trigger ${task.trigger}`;
    }
    processQueue() {
        if (this.queue.length > 0 && this.activeRunners < this.config.maxConcurrentRunners) {
            const nextId = this.queue.shift();
            if (nextId) {
                void this.runTask(nextId);
            }
        }
    }
    generateId() {
        return `task_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    }
}
//# sourceMappingURL=module.js.map