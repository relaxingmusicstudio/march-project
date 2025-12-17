/**
 * Agent Hierarchy System
 * 
 * Classification:
 * - AI CEO (single, visible) → full long-term memory write
 * - Strategy Agents (visible as "Strategies") → summarized memory only
 * - Task Agents (invisible) → NO memory write access
 * - Micro Agents (disposable) → NO memory write access
 */

export type AgentTier = 'ceo' | 'strategy' | 'task' | 'micro';

export interface AgentClassification {
  id: string;
  displayName: string;
  tier: AgentTier;
  canWriteMemory: boolean;
  canWriteSummary: boolean;
  visibleInUI: boolean;
  description: string;
}

/**
 * Agent Classifications
 * Reclassified from flat structure to hierarchical governance
 */
export const AGENT_CLASSIFICATIONS: Record<string, AgentClassification> = {
  // AI CEO - Single visible agent
  'ceo-agent': {
    id: 'ceo-agent',
    displayName: 'AI CEO',
    tier: 'ceo',
    canWriteMemory: true,
    canWriteSummary: true,
    visibleInUI: true,
    description: 'Strategic intelligence and business oversight'
  },
  
  // Strategy Agents - Visible as "Strategies", not agents
  'funnel-agent': {
    id: 'funnel-agent',
    displayName: 'Funnel Strategy',
    tier: 'strategy',
    canWriteMemory: false,
    canWriteSummary: true,
    visibleInUI: false, // Hidden by default
    description: 'Conversion optimization strategy'
  },
  'ads-agent': {
    id: 'ads-agent',
    displayName: 'Advertising Strategy',
    tier: 'strategy',
    canWriteMemory: false,
    canWriteSummary: true,
    visibleInUI: false,
    description: 'Paid advertising strategy'
  },
  'content-agent': {
    id: 'content-agent',
    displayName: 'Content Strategy',
    tier: 'strategy',
    canWriteMemory: false,
    canWriteSummary: true,
    visibleInUI: false,
    description: 'Content creation strategy'
  },
  'social-agent': {
    id: 'social-agent',
    displayName: 'Social Strategy',
    tier: 'strategy',
    canWriteMemory: false,
    canWriteSummary: true,
    visibleInUI: false,
    description: 'Social media strategy'
  },
  'sequences-agent': {
    id: 'sequences-agent',
    displayName: 'Nurture Strategy',
    tier: 'strategy',
    canWriteMemory: false,
    canWriteSummary: true,
    visibleInUI: false,
    description: 'Email/SMS nurture strategy'
  },
  'finance-agent': {
    id: 'finance-agent',
    displayName: 'Finance Strategy',
    tier: 'strategy',
    canWriteMemory: false,
    canWriteSummary: true,
    visibleInUI: false,
    description: 'Financial intelligence strategy'
  },
  'inbox-agent': {
    id: 'inbox-agent',
    displayName: 'Response Strategy',
    tier: 'strategy',
    canWriteMemory: false,
    canWriteSummary: true,
    visibleInUI: false,
    description: 'Customer response strategy'
  },
  'youtube-agent': {
    id: 'youtube-agent',
    displayName: 'YouTube Strategy',
    tier: 'strategy',
    canWriteMemory: false,
    canWriteSummary: true,
    visibleInUI: false,
    description: 'YouTube growth strategy'
  },
  
  // Task Agents - Invisible execution layer
  'video-coordinator': {
    id: 'video-coordinator',
    displayName: 'Video Coordinator',
    tier: 'task',
    canWriteMemory: false,
    canWriteSummary: false,
    visibleInUI: false,
    description: 'Video production coordination'
  },
  'video-router': {
    id: 'video-router',
    displayName: 'Video Router',
    tier: 'task',
    canWriteMemory: false,
    canWriteSummary: false,
    visibleInUI: false,
    description: 'Video provider routing'
  },
  'video-editor': {
    id: 'video-editor',
    displayName: 'Video Editor',
    tier: 'task',
    canWriteMemory: false,
    canWriteSummary: false,
    visibleInUI: false,
    description: 'Video editing tasks'
  },
  'video-quality': {
    id: 'video-quality',
    displayName: 'Video QA',
    tier: 'task',
    canWriteMemory: false,
    canWriteSummary: false,
    visibleInUI: false,
    description: 'Video quality assurance'
  },
  'video-cost': {
    id: 'video-cost',
    displayName: 'Video Cost',
    tier: 'task',
    canWriteMemory: false,
    canWriteSummary: false,
    visibleInUI: false,
    description: 'Video cost tracking'
  },
  'lead-enrichment': {
    id: 'lead-enrichment',
    displayName: 'Lead Enrichment',
    tier: 'task',
    canWriteMemory: false,
    canWriteSummary: false,
    visibleInUI: false,
    description: 'Lead data enrichment'
  },
  'analyze-lead': {
    id: 'analyze-lead',
    displayName: 'Lead Analysis',
    tier: 'task',
    canWriteMemory: false,
    canWriteSummary: false,
    visibleInUI: false,
    description: 'Lead scoring and analysis'
  },
  'outreach-agent': {
    id: 'outreach-agent',
    displayName: 'Outreach Executor',
    tier: 'task',
    canWriteMemory: false,
    canWriteSummary: false,
    visibleInUI: false,
    description: 'Outreach execution'
  },
  'billing-agent': {
    id: 'billing-agent',
    displayName: 'Billing Handler',
    tier: 'task',
    canWriteMemory: false,
    canWriteSummary: false,
    visibleInUI: false,
    description: 'Billing operations'
  },
  'alex-chat': {
    id: 'alex-chat',
    displayName: 'Chat Interface',
    tier: 'task',
    canWriteMemory: false,
    canWriteSummary: false,
    visibleInUI: false,
    description: 'Public chat interface'
  },
  
  // Micro Agents - Disposable, stateless
  'content-generator': {
    id: 'content-generator',
    displayName: 'Content Generator',
    tier: 'micro',
    canWriteMemory: false,
    canWriteSummary: false,
    visibleInUI: false,
    description: 'Generates content pieces'
  },
  'prompt-enhancer': {
    id: 'prompt-enhancer',
    displayName: 'Prompt Enhancer',
    tier: 'micro',
    canWriteMemory: false,
    canWriteSummary: false,
    visibleInUI: false,
    description: 'Enhances prompts'
  },
  'embedding-service': {
    id: 'embedding-service',
    displayName: 'Embedding Service',
    tier: 'micro',
    canWriteMemory: false,
    canWriteSummary: false,
    visibleInUI: false,
    description: 'Vector embeddings'
  },
  'llm-gateway': {
    id: 'llm-gateway',
    displayName: 'LLM Gateway',
    tier: 'micro',
    canWriteMemory: false,
    canWriteSummary: false,
    visibleInUI: false,
    description: 'LLM routing'
  },
};

/**
 * Get agent classification by ID
 */
export function getAgentClassification(agentId: string): AgentClassification | null {
  // Normalize agent ID (handle variations like content_agent, content-agent)
  const normalizedId = agentId.toLowerCase().replace(/_/g, '-');
  return AGENT_CLASSIFICATIONS[normalizedId] || null;
}

/**
 * Check if agent can write to long-term memory
 */
export function canAgentWriteMemory(agentId: string): boolean {
  const classification = getAgentClassification(agentId);
  return classification?.canWriteMemory ?? false;
}

/**
 * Check if agent can write summaries
 */
export function canAgentWriteSummary(agentId: string): boolean {
  const classification = getAgentClassification(agentId);
  return classification?.canWriteSummary ?? false;
}

/**
 * Get agent tier
 */
export function getAgentTier(agentId: string): AgentTier | null {
  const classification = getAgentClassification(agentId);
  return classification?.tier ?? null;
}

/**
 * Check if agent should be visible in UI
 */
export function isAgentVisibleInUI(agentId: string): boolean {
  const classification = getAgentClassification(agentId);
  return classification?.visibleInUI ?? false;
}

/**
 * Get all agents by tier
 */
export function getAgentsByTier(tier: AgentTier): AgentClassification[] {
  return Object.values(AGENT_CLASSIFICATIONS).filter(a => a.tier === tier);
}

/**
 * Get display name for agent (uses "Strategy" suffix for strategy tier)
 */
export function getAgentDisplayName(agentId: string): string {
  const classification = getAgentClassification(agentId);
  if (!classification) return agentId;
  return classification.displayName;
}
