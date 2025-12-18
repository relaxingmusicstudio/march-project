/**
 * Support Bundle & Evidence Pack - The Loop Killer
 * Canonical JSON objects that capture ALL diagnostic evidence
 */

import type { RouteNavAuditResult as AuditResult, AuditContext } from "./routeNavAudit";

export interface PreflightReport {
  ok: boolean;
  checked_at?: string;
  types?: Record<string, boolean>;
  functions?: Record<string, boolean>;
  permissions?: Record<string, boolean>;
  tables?: Record<string, boolean>;
  suspects?: Array<{ object: string; type: string; fix_sql: string }>;
  suspect_count?: number;
  error?: string;
  error_code?: string;
  error_detail?: string;
}

export interface EdgeConsoleRun {
  timestamp: string;
  function_name: string;
  request: {
    method: string;
    headers: Record<string, string>;
    body: unknown;
  };
  response: {
    status: number;
    headers: Record<string, string>;
    body: unknown;
  };
  duration_ms: number;
}

export interface HumanActionRequired {
  action: string;
  location: string;
  value?: string;
  validation_endpoint?: string;
  completed?: boolean;
}

export interface RouteNavAuditResult {
  summary: { critical: number; warning: number; passed: number; total_tools?: number; total_checks?: number };
  findings: Array<{
    severity: string;
    issue_code: string;
    tool_id?: string;
    identifier?: string;
    route: string;
    description: string;
  }>;
  counters: Record<string, number>;
}

/**
 * Evidence Pack - Comprehensive diagnostic snapshot
 * Proves what's true at runtime, no guessing.
 */
export interface EvidencePack {
  // Meta
  timestamp: string;
  app_version: string;
  current_route: string;
  
  // User context
  user_id_masked: string;
  role_flags: {
    isOwner: boolean;
    isAdmin: boolean;
    isClient: boolean;
    isAuthenticated: boolean;
  };
  
  // Navigation & Routes
  nav_routes_visible: string[];
  tool_registry_snapshot: Array<{ id: string; route: string; requires: string }>;
  route_guard_snapshot: Array<{ path: string; requires: string }>;
  
  // Audit Results
  route_nav_audit: AuditResult | null;
  
  // Edge Console
  latest_edge_console_run: EdgeConsoleRun | null;
  
  // QA
  qa_debug_json: unknown | null;
  qa_access_status: "available" | "denied" | "not_run";
  
  // Issue Counters
  recurring_issue_counts: Record<string, number>;
}

export interface SupportBundle {
  // Meta
  timestamp: string;
  app_version: string;
  build_timestamp: string;
  
  // User context
  user_id: string | null;
  role: string | null;
  tenant_ids: string[];
  isOwner: boolean;
  isAdmin: boolean;
  
  // Environment
  supabase_url: string;
  edge_base_url: string;
  
  // Diagnostics
  db_doctor_report: PreflightReport | null;
  edge_preflight: PreflightReport | null;
  route_nav_audit: RouteNavAuditResult | null;
  
  // Recent activity
  recent_audit_logs: unknown[];
  edge_console_runs: EdgeConsoleRun[];
  
  // QA
  qa_debug_json: unknown | null;
  
  // Human actions
  human_actions_required: HumanActionRequired[];
  
  // Counts
  ceo_alerts_count: number;
  lead_profiles_count: number;
  
  // Last errors
  last_edge_error: unknown | null;
  
  // URLs used
  urls_used: Record<string, string>;
}

export function createEmptyBundle(): SupportBundle {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "(undefined)";
  const edgeBaseUrl = supabaseUrl !== "(undefined)" ? `${supabaseUrl}/functions/v1` : "(undefined)";
  
  return {
    timestamp: new Date().toISOString(),
    app_version: "1.0.0",
    build_timestamp: new Date().toISOString(),
    user_id: null,
    role: null,
    tenant_ids: [],
    isOwner: false,
    isAdmin: false,
    supabase_url: supabaseUrl,
    edge_base_url: edgeBaseUrl,
    db_doctor_report: null,
    edge_preflight: null,
    route_nav_audit: null,
    recent_audit_logs: [],
    edge_console_runs: [],
    qa_debug_json: null,
    human_actions_required: [],
    ceo_alerts_count: 0,
    lead_profiles_count: 0,
    last_edge_error: null,
    urls_used: {
      lead_normalize: `${edgeBaseUrl}/lead-normalize`,
      ceo_scheduler: `${edgeBaseUrl}/ceo-scheduler`,
    },
  };
}

/**
 * Create an empty Evidence Pack for runtime population.
 */
export function createEmptyEvidencePack(): EvidencePack {
  return {
    timestamp: new Date().toISOString(),
    app_version: "1.0.0",
    current_route: typeof window !== "undefined" ? window.location.pathname : "",
    user_id_masked: "",
    role_flags: {
      isOwner: false,
      isAdmin: false,
      isClient: false,
      isAuthenticated: false,
    },
    nav_routes_visible: [],
    tool_registry_snapshot: [],
    route_guard_snapshot: [],
    route_nav_audit: null,
    latest_edge_console_run: null,
    qa_debug_json: null,
    qa_access_status: "not_run",
    recurring_issue_counts: {},
  };
}

export async function copyBundleToClipboard(bundle: SupportBundle): Promise<{ success: boolean; fallbackText?: string }> {
  const jsonStr = JSON.stringify(bundle, null, 2);
  try {
    await navigator.clipboard.writeText(jsonStr);
    return { success: true };
  } catch {
    return { success: false, fallbackText: jsonStr };
  }
}

export async function copyEvidencePackToClipboard(pack: EvidencePack): Promise<{ success: boolean; fallbackText?: string }> {
  const jsonStr = JSON.stringify(pack, null, 2);
  try {
    await navigator.clipboard.writeText(jsonStr);
    return { success: true };
  } catch {
    return { success: false, fallbackText: jsonStr };
  }
}

export function downloadBundle(bundle: SupportBundle): void {
  const jsonStr = JSON.stringify(bundle, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `support-bundle-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadEvidencePack(pack: EvidencePack): void {
  const jsonStr = JSON.stringify(pack, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `evidence-pack-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function generateSecretValue(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
