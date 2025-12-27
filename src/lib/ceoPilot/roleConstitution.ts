import {
  ActionImpact,
  PermissionTier,
  RoleConstitutionDecision,
  RoleConstitutionDecisionSchema,
  RoleConstitutionAuditRecord,
  TaskClass,
} from "./contracts";
import { getAgentProfile } from "./agents";
import {
  ensureDefaultRolePolicies,
  loadRolePolicies,
  recordRoleConstitutionAudit,
} from "./runtimeState";
import { createId, nowIso } from "./utils";
import type { AgentRuntimeContext } from "./runtimeTypes";

export type RoleConstitutionInput = {
  identityKey: string;
  agentContext: AgentRuntimeContext;
  requestedTool?: string;
  requestedAction?: string;
  now?: string;
};

export type RoleConstitutionResult = {
  decision: RoleConstitutionDecision;
  audit: RoleConstitutionAuditRecord;
};

const tierRank: Record<PermissionTier, number> = {
  draft: 0,
  suggest: 1,
  execute: 2,
};

const classRank: Record<TaskClass, number> = {
  routine: 0,
  novel: 1,
  high_risk: 2,
};

const impactRank: Record<ActionImpact, number> = {
  reversible: 0,
  difficult: 1,
  irreversible: 2,
};

const buildDecision = (
  status: RoleConstitutionDecision["decision"],
  reasonCode: string,
  roleId: string,
  policyId: string,
  policyVersion: string,
  timestamp: string
): RoleConstitutionDecision =>
  RoleConstitutionDecisionSchema.parse({
    decision: status,
    reasonCode,
    roleId,
    policyId,
    policyVersion,
    timestamp,
  });

const resolveAction = (context: AgentRuntimeContext, requestedAction?: string): string =>
  requestedAction || context.decisionType || context.tool || "action:unknown";

const resolveDomain = (context: AgentRuntimeContext): string => context.actionDomain || "domain:unknown";

const resolveTool = (context: AgentRuntimeContext, requestedTool?: string): string | undefined =>
  requestedTool || context.tool;

const hasRequiredAuditFields = (record: RoleConstitutionAuditRecord, required: string[]): boolean =>
  required.every((field) => Object.prototype.hasOwnProperty.call(record, field));

export const enforceRoleConstitution = (input: RoleConstitutionInput): RoleConstitutionResult => {
  const now = input.now ?? nowIso();
  ensureDefaultRolePolicies(input.identityKey);
  const policies = loadRolePolicies(input.identityKey);

  const agentProfile = getAgentProfile(input.agentContext.agentId);
  const roleId = agentProfile?.role ?? "unknown";
  const policy = policies.find((entry) => entry.roleId === roleId);

  const action = resolveAction(input.agentContext, input.requestedAction);
  const domain = resolveDomain(input.agentContext);
  const tool = resolveTool(input.agentContext, input.requestedTool);
  const permissionTier = input.agentContext.permissionTier;
  const impact = input.agentContext.impact ?? "reversible";
  const noveltyScore = input.agentContext.noveltyScore ?? 0;
  const taskClass =
    input.agentContext.taskClass ??
    (impact === "irreversible" || impact === "difficult"
      ? "high_risk"
      : noveltyScore >= 0.6
        ? "novel"
        : "routine");
  const estimatedCostCents = input.agentContext.estimatedCostCents;
  const handoff = input.agentContext.handoff;
  const requesterAgentId = handoff?.fromAgentId;
  const requesterRoleId = requesterAgentId ? getAgentProfile(requesterAgentId)?.role : undefined;

  if (!policy) {
    const decision = buildDecision("deny", "role_policy_missing", roleId, "policy:missing", "unknown", now);
    const audit: RoleConstitutionAuditRecord = {
      auditId: createId("role-audit"),
      identityKey: input.identityKey,
      roleId,
      roleName: agentProfile?.displayName ?? "unknown",
      policyId: "policy:missing",
      policyVersion: "unknown",
      action,
      domain,
      tool,
      decision: decision.decision,
      reasonCode: decision.reasonCode,
      taskClass,
      impact,
      estimatedCostCents,
      createdAt: now,
    };
    recordRoleConstitutionAudit(input.identityKey, audit);
    return { decision, audit };
  }

  const policyId = policy.policyId;
  const policyVersion = policy.version;

  const recordAudit = (status: RoleConstitutionDecision["decision"], reasonCode: string) => {
    const audit: RoleConstitutionAuditRecord = {
      auditId: createId("role-audit"),
      identityKey: input.identityKey,
      roleId: policy.roleId,
      roleName: policy.roleName,
      policyId,
      policyVersion,
      action,
      domain,
      tool,
      decision: status,
      reasonCode,
      requestedByRoleId: requesterRoleId,
      requestedByAgentId: requesterAgentId,
      taskClass,
      impact,
      estimatedCostCents,
      createdAt: now,
    };
    if (!hasRequiredAuditFields(audit, policy.auditRequirements.requiredFields)) {
      const fallback = {
        ...audit,
        reasonCode: "audit_requirements_failed",
        decision: "deny" as const,
      };
      recordRoleConstitutionAudit(input.identityKey, fallback);
      return {
        decision: buildDecision("deny", "audit_requirements_failed", policy.roleId, policyId, policyVersion, now),
        audit: fallback,
      };
    }
    recordRoleConstitutionAudit(input.identityKey, audit);
    return {
      decision: buildDecision(status, reasonCode, policy.roleId, policyId, policyVersion, now),
      audit,
    };
  };

  if (!policy.jurisdiction.domains.includes(domain)) {
    return recordAudit("deny", "jurisdiction_domain_denied");
  }
  if (!policy.jurisdiction.actions.includes(action)) {
    return recordAudit("deny", "jurisdiction_action_denied");
  }
  if (policy.deniedActions.includes(action)) {
    return recordAudit("deny", "denied_action");
  }
  if (tool && !policy.toolAccess.allowedTools.includes(tool)) {
    return recordAudit("deny", "tool_access_denied");
  }
  const dataCategories = input.agentContext.dataCategories ?? [];
  if (dataCategories.some((category) => !policy.dataAccess.allowedCategories.includes(category))) {
    return recordAudit("deny", "data_access_denied");
  }

  if (handoff) {
    if (handoff.toAgentId && handoff.toAgentId !== input.agentContext.agentId) {
      return recordAudit("deny", "handoff_target_mismatch");
    }
    const requesterProfile = getAgentProfile(handoff.fromAgentId);
    const requesterRole = requesterProfile?.role ?? "unknown";
    const requesterPolicy = policies.find((entry) => entry.roleId === requesterRole);
    if (!requesterPolicy) {
      return recordAudit("deny", "handoff_requester_policy_missing");
    }
    if (!requesterPolicy.chainOfCommand.canRequestFromRoles.includes(policy.roleId)) {
      return recordAudit("deny", "handoff_request_denied");
    }
    if (!policy.chainOfCommand.canApproveForRoles.includes(requesterPolicy.roleId)) {
      return recordAudit("deny", "handoff_receive_denied");
    }
    if (!requesterPolicy.jurisdiction.domains.includes(domain)) {
      return recordAudit("deny", "handoff_request_outside_jurisdiction");
    }
    if (!requesterPolicy.jurisdiction.actions.includes(action)) {
      return recordAudit("deny", "handoff_request_outside_jurisdiction");
    }
    if (requesterPolicy.deniedActions.includes(action)) {
      return recordAudit("deny", "handoff_request_denied_action");
    }
    if (tool && !requesterPolicy.toolAccess.allowedTools.includes(tool)) {
      return recordAudit("deny", "handoff_request_tool_denied");
    }
    if (dataCategories.some((category) => !requesterPolicy.dataAccess.allowedCategories.includes(category))) {
      return recordAudit("deny", "handoff_request_data_denied");
    }
  }

  if (tierRank[permissionTier] > tierRank[policy.authorityCeiling.maxPermissionTier]) {
    return recordAudit("escalate", "authority_permission_tier_exceeded");
  }
  if (taskClass && classRank[taskClass] > classRank[policy.authorityCeiling.maxTaskClass]) {
    return recordAudit("escalate", "authority_task_class_exceeded");
  }
  if (impact && impactRank[impact] > impactRank[policy.authorityCeiling.maxImpact]) {
    return recordAudit("escalate", "authority_impact_exceeded");
  }
  if (
    typeof estimatedCostCents === "number" &&
    estimatedCostCents > policy.authorityCeiling.maxEstimatedCostCents
  ) {
    return recordAudit("escalate", "authority_cost_exceeded");
  }

  if (policy.escalationRules.alwaysEscalateActions.includes(action)) {
    return recordAudit("escalate", "escalation_rule_action");
  }
  if (policy.escalationRules.alwaysEscalateDomains.includes(domain)) {
    return recordAudit("escalate", "escalation_rule_domain");
  }
  if (
    taskClass &&
    policy.escalationRules.escalateAboveTaskClass &&
    classRank[taskClass] >= classRank[policy.escalationRules.escalateAboveTaskClass]
  ) {
    return recordAudit("escalate", "escalation_rule_task_class");
  }
  if (
    impact &&
    policy.escalationRules.escalateAboveImpact &&
    impactRank[impact] >= impactRank[policy.escalationRules.escalateAboveImpact]
  ) {
    return recordAudit("escalate", "escalation_rule_impact");
  }
  if (
    typeof estimatedCostCents === "number" &&
    policy.escalationRules.escalateAboveCostCents !== undefined &&
    estimatedCostCents >= policy.escalationRules.escalateAboveCostCents
  ) {
    return recordAudit("escalate", "escalation_rule_cost");
  }

  return recordAudit("allow", "role_policy_ok");
};
