export type TaskTrigger = 'schedule' | 'event' | 'condition';

export interface AutomatedTask {
  id: string;
  name: string;
  trigger: TaskTrigger;
  config: Record<string, unknown>;
  lastRunAt: number | null;
  runCount: number;
  enabled: boolean;
  silent: boolean;
}

export interface SilentOpsState {
  tasks: AutomatedTask[];
  queue: string[];
  activeRunners: number;
}

export interface TaskRunRecord {
  taskId: string;
  startedAt: number;
  completedAt: number;
  result: 'success' | 'failure';
  output?: string;
}

export interface SilentOpsConfig {
  maxConcurrentRunners: number;
  defaultSilent: boolean;
  busEmitEnabled: boolean;
}

export interface SilentOpsEvents {
  'silent-ops:task-completed': { taskId: string; taskName: string; completedAt: number; silent: boolean };
}
