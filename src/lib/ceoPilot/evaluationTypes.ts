import type {
  EvaluationDomain,
  EvaluationResult,
  EvaluationTask,
  FailureClass,
} from "./contracts";

export type EvaluationCoverage = {
  domains: Record<EvaluationDomain, number>;
  failureClasses: Record<FailureClass, number>;
};

export type TaskRotationIssue = {
  taskId: string;
  issue: string;
};

export type TaskRotationReport = {
  ok: boolean;
  issues: TaskRotationIssue[];
};

export type EvaluationSummary = {
  runId: string;
  total: number;
  passed: number;
  failed: number;
  passRate: number;
  results: EvaluationResult[];
  startedAt: string;
  completedAt: string;
  coverage: EvaluationCoverage;
  rotation: TaskRotationReport;
};

export type EvaluationRun = {
  runId: string;
  tasks: EvaluationTask[];
  summary: EvaluationSummary;
};

export type EvaluationLedger = {
  record: (run: EvaluationRun) => void;
  list: () => EvaluationRun[];
  latest: () => EvaluationRun | null;
};
