/**
 * Proof Kernel - Recorder
 * Wrapper that captures step execution with console interception
 */

export interface StepRecord {
  step_id: string;
  started_at: string;
  ended_at: string;
  duration_ms: number;
  ok: boolean;
  result?: unknown;
  error?: string;
  error_stack?: string;
  console_warnings: string[];
  console_errors: string[];
}

export interface RecorderContext {
  records: StepRecord[];
}

/**
 * Create a new recorder context
 */
export function createRecorderContext(): RecorderContext {
  return { records: [] };
}

/**
 * Safe JSON serialization for results
 */
function safeJsonSerialize(value: unknown, maxDepth = 3): unknown {
  if (maxDepth <= 0) return "[MAX_DEPTH]";
  
  if (value === null || value === undefined) return value;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  
  if (value instanceof Error) {
    return { message: value.message, name: value.name };
  }
  
  if (Array.isArray(value)) {
    return value.slice(0, 100).map(v => safeJsonSerialize(v, maxDepth - 1));
  }
  
  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    const keys = Object.keys(value as object).slice(0, 50);
    for (const key of keys) {
      try {
        result[key] = safeJsonSerialize((value as Record<string, unknown>)[key], maxDepth - 1);
      } catch {
        result[key] = "[UNSERIALIZABLE]";
      }
    }
    return result;
  }
  
  return "[UNKNOWN_TYPE]";
}

/**
 * Run a step with proof recording
 * Captures: timing, result, errors, console output
 */
export async function runWithProof<T>(
  ctx: RecorderContext,
  stepId: string,
  fn: () => Promise<T>
): Promise<{ ok: boolean; result?: T; error?: Error; record: StepRecord }> {
  const warnings: string[] = [];
  const errors: string[] = [];
  
  // Capture original console methods
  const originalWarn = console.warn;
  const originalError = console.error;
  
  // Monkeypatch console
  console.warn = (...args) => {
    warnings.push(args.map(String).join(' '));
    originalWarn.apply(console, args);
  };
  
  console.error = (...args) => {
    errors.push(args.map(String).join(' '));
    originalError.apply(console, args);
  };
  
  const started_at = new Date().toISOString();
  const startTime = performance.now();
  
  let ok = false;
  let result: T | undefined;
  let error: Error | undefined;
  let errorStack: string | undefined;
  
  try {
    result = await fn();
    ok = true;
  } catch (e) {
    error = e instanceof Error ? e : new Error(String(e));
    errorStack = error.stack;
    ok = false;
  } finally {
    // Restore console methods
    console.warn = originalWarn;
    console.error = originalError;
  }
  
  const endTime = performance.now();
  const ended_at = new Date().toISOString();
  const duration_ms = Math.round(endTime - startTime);
  
  const record: StepRecord = {
    step_id: stepId,
    started_at,
    ended_at,
    duration_ms,
    ok,
    result: ok ? safeJsonSerialize(result) : undefined,
    error: error?.message,
    error_stack: errorStack,
    console_warnings: warnings,
    console_errors: errors,
  };
  
  ctx.records.push(record);
  
  return { ok, result, error, record };
}

/**
 * Get all records from context
 */
export function getRecords(ctx: RecorderContext): StepRecord[] {
  return [...ctx.records];
}

/**
 * Check if all recorded steps passed
 */
export function allStepsPassed(ctx: RecorderContext): boolean {
  return ctx.records.every(r => r.ok);
}

/**
 * Get failed steps
 */
export function getFailedSteps(ctx: RecorderContext): StepRecord[] {
  return ctx.records.filter(r => !r.ok);
}

/**
 * Get total duration of all steps
 */
export function getTotalDuration(ctx: RecorderContext): number {
  return ctx.records.reduce((sum, r) => sum + r.duration_ms, 0);
}
