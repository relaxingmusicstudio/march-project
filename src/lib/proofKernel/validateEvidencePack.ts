/**
 * Proof Kernel - Validate Evidence Pack
 * HARD enforcement - no PASS without machine-verifiable evidence
 */

import type { EvidencePack, HumanActionRequired } from '../evidencePack';

export interface ProofValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  required_actions: HumanActionRequired[];
  validation_timestamp: string;
  checks_performed: string[];
}

/**
 * Validate an Evidence Pack with HARD enforcement rules
 * Returns ok=false if ANY critical check fails
 */
export function validateEvidencePackStrict(pack: EvidencePack): ProofValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const required_actions: HumanActionRequired[] = [];
  const checks_performed: string[] = [];

  // ========== CRITICAL CHECKS (any failure = ok: false) ==========

  // CHECK 1: FS Reality Check must exist and pass
  checks_performed.push("fs_reality_check");
  if (!pack.fs_reality_check) {
    errors.push("CRITICAL: fs_reality_check is missing - cannot verify file existence");
    required_actions.push({
      action: "Run FS Reality Check from Ops Center",
      location: "/platform/ops",
    });
  } else if (!pack.fs_reality_check.all_imports_ok) {
    errors.push(`CRITICAL: FS Reality Check FAIL - failed imports: ${pack.fs_reality_check.failed_imports.join(", ")}`);
    required_actions.push({
      action: "Fix failed imports before claiming PASS",
      location: "/platform/ops",
      value: pack.fs_reality_check.failed_imports.join(", "),
    });
  }

  // CHECK 2: Build output must be present with actual text
  checks_performed.push("build_output");
  if (!pack.build_output.present) {
    errors.push("CRITICAL: build_output.present is false - no build proof captured");
    required_actions.push({
      action: "Paste raw build output in Ops Center → Build Proof section",
      location: "/platform/ops",
    });
  } else if (!pack.build_output.text || pack.build_output.text.trim().length === 0) {
    errors.push("CRITICAL: build_output.text is empty - build proof has no content");
    required_actions.push({
      action: "Paste actual build/compile output (not empty)",
      location: "/platform/ops",
    });
  }

  // CHECK 3: Route/Nav audit must exist and have no critical issues
  checks_performed.push("route_nav_audit");
  if (!pack.route_nav_audit) {
    errors.push("CRITICAL: route_nav_audit is missing - cannot verify routing");
    required_actions.push({
      action: "Run Route & Nav Auditor",
      location: "/platform/route-nav-auditor",
    });
  } else if (pack.route_nav_audit.summary.critical > 0) {
    errors.push(`CRITICAL: route_nav_audit has ${pack.route_nav_audit.summary.critical} critical issue(s)`);
    required_actions.push({
      action: "Fix critical routing issues",
      location: "/platform/route-nav-auditor",
      value: `${pack.route_nav_audit.summary.critical} critical issues`,
    });
  }

  // CHECK 4: QA access status
  checks_performed.push("qa_access_status");
  if (pack.qa_access_status === "denied") {
    errors.push("CRITICAL: qa_access_status is 'denied' - cannot run QA checks");
    required_actions.push({
      action: "Authenticate and re-run Proof Gate",
      location: "/auth",
    });
  } else if (pack.qa_access_status === "not_run") {
    // Check if there's a recorded blocker explaining why
    const hasQABlocker = pack.human_actions_required.some(
      a => a.action.toLowerCase().includes("qa") || a.action.toLowerCase().includes("auth")
    );
    if (!hasQABlocker) {
      errors.push("CRITICAL: qa_access_status is 'not_run' with no recorded blocker");
      required_actions.push({
        action: "Run QA checks or document why blocked",
        location: "/platform/ops",
      });
    }
  }

  // CHECK 5: Human actions must be empty (all resolved)
  checks_performed.push("human_actions_required");
  const unresolvedActions = pack.human_actions_required.filter(a => !a.completed);
  if (unresolvedActions.length > 0) {
    errors.push(`CRITICAL: ${unresolvedActions.length} unresolved human_actions_required`);
    for (const action of unresolvedActions) {
      required_actions.push(action);
    }
  }

  // CHECK 6: Proof runs must exist and have no failures
  checks_performed.push("proof_runs");
  if (!pack.runs || pack.runs.length === 0) {
    errors.push("CRITICAL: No proof runs recorded - Evidence Pack may be fabricated");
    required_actions.push({
      action: "Run Proof Gate to record actual step executions",
      location: "/platform/proof-gate",
    });
  } else {
    const failedRuns = pack.runs.filter(r => !r.ok);
    if (failedRuns.length > 0) {
      errors.push(`CRITICAL: ${failedRuns.length} step(s) failed during proof run`);
      for (const run of failedRuns) {
        required_actions.push({
          action: `Fix failed step: ${run.tool_id}`,
          location: "/platform/proof-gate",
          value: run.error || "Unknown error",
        });
      }
    }
  }

  // CHECK 7: Proof kernel validation must exist
  checks_performed.push("proof_kernel");
  if (!pack.proof_kernel) {
    errors.push("CRITICAL: proof_kernel is missing - no cryptographic proof");
  } else {
    if (!pack.proof_kernel.proof_token) {
      errors.push("CRITICAL: proof_kernel.proof_token is missing");
    }
  }

  // ========== WARNING CHECKS (logged but don't block PASS) ==========

  // WARN 1: Mini QA
  checks_performed.push("mini_qa");
  if (!pack.mini_qa) {
    warnings.push("mini_qa is missing - consider running Mini QA");
  } else if (pack.mini_qa.errors.length > 0) {
    warnings.push(`mini_qa has ${pack.mini_qa.errors.length} error(s): ${pack.mini_qa.errors.join("; ")}`);
  }

  // WARN 2: Tool registry snapshot
  checks_performed.push("tool_registry_snapshot");
  if (!pack.tool_registry_snapshot || pack.tool_registry_snapshot.length === 0) {
    warnings.push("tool_registry_snapshot is empty");
  }

  // WARN 3: Route guard snapshot
  checks_performed.push("route_guard_snapshot");
  if (!pack.route_guard_snapshot || pack.route_guard_snapshot.length === 0) {
    warnings.push("route_guard_snapshot is empty");
  }

  // WARN 4: Not authenticated
  checks_performed.push("authentication");
  if (!pack.role_flags.isAuthenticated) {
    warnings.push("User is not authenticated - some checks may be incomplete");
  }

  // WARN 5: Recurring issues
  checks_performed.push("recurring_issues");
  const recurringCodes = Object.entries(pack.recurring_issue_counts)
    .filter(([_, count]) => count >= 2)
    .map(([code, count]) => `${code}(${count}x)`);
  if (recurringCodes.length > 0) {
    warnings.push(`Recurring issues detected: ${recurringCodes.join(", ")}`);
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    required_actions,
    validation_timestamp: new Date().toISOString(),
    checks_performed,
  };
}

/**
 * Quick check if pack would pass validation
 */
export function wouldPassValidation(pack: EvidencePack): boolean {
  const result = validateEvidencePackStrict(pack);
  return result.ok;
}

/**
 * Get summary of validation status
 */
export function getValidationSummary(pack: EvidencePack): string {
  const result = validateEvidencePackStrict(pack);
  if (result.ok) {
    return `PASS (${result.warnings.length} warning(s))`;
  }
  return `FAIL (${result.errors.length} error(s), ${result.warnings.length} warning(s))`;
}
