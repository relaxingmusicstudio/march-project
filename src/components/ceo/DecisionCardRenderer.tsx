/**
 * Decision Card Renderer
 * 
 * Renders a validated Decision Card in a structured, readable format
 * for human review in the DecisionsDashboard.
 */

import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DecisionCard, extractDecisionCard } from "@/lib/decisionSchema";
import {
  Target,
  Clock,
  TrendingUp,
  DollarSign,
  AlertTriangle,
  RotateCcw,
  CheckSquare,
  Gauge,
  ChevronDown,
  FileJson,
} from "lucide-react";
import { useState } from "react";

interface DecisionCardRendererProps {
  actionPayload: Record<string, unknown> | null;
  claudeReasoning?: string;
}

export function DecisionCardRenderer({ actionPayload, claudeReasoning }: DecisionCardRendererProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const decisionCard = extractDecisionCard(actionPayload);

  // If no valid decision card, show legacy format
  if (!decisionCard) {
    return (
      <div className="space-y-3">
        {claudeReasoning && (
          <div className="bg-muted/50 p-3 rounded-lg">
            <p className="text-xs font-medium text-muted-foreground mb-1">AI Reasoning:</p>
            <p className="text-sm">{claudeReasoning}</p>
          </div>
        )}
        {actionPayload && (
          <div className="bg-muted/30 p-3 rounded-lg">
            <p className="text-xs font-medium text-muted-foreground mb-1">Proposed Action (Legacy):</p>
            <pre className="text-xs overflow-auto max-h-24">
              {JSON.stringify(actionPayload, null, 2)}
            </pre>
          </div>
        )}
      </div>
    );
  }

  const getRiskBadge = (risk: string) => {
    const level = risk.split(' ')[0]?.toLowerCase() || 'medium';
    if (level === 'high') return <Badge variant="destructive">High Risk</Badge>;
    if (level === 'low') return <Badge className="bg-green-500">Low Risk</Badge>;
    return <Badge className="bg-orange-500">Medium Risk</Badge>;
  };

  const getReversibilityBadge = (rev: string) => {
    const r = rev.toLowerCase();
    if (r === 'instant') return <Badge variant="outline" className="border-green-500 text-green-600">Instant</Badge>;
    if (r === 'easy') return <Badge variant="outline" className="border-blue-500 text-blue-600">Easy</Badge>;
    return <Badge variant="outline" className="border-red-500 text-red-600">Hard</Badge>;
  };

  const getConfidenceColor = (conf: number) => {
    if (conf >= 0.8) return 'text-green-600';
    if (conf >= 0.5) return 'text-orange-500';
    return 'text-red-500';
  };

  return (
    <div className="space-y-4">
      {/* Summary - Most prominent */}
      <div className="bg-primary/5 border border-primary/20 p-4 rounded-lg">
        <div className="flex items-start gap-2">
          <Target className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Decision</p>
            <p className="font-medium">{decisionCard.summary}</p>
          </div>
        </div>
      </div>

      {/* Key metrics grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Why Now */}
        <div className="bg-muted/30 p-3 rounded-lg">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
            <Clock className="h-3 w-3" />
            Why Now
          </div>
          <p className="text-sm">{decisionCard.why_now}</p>
        </div>

        {/* Expected Impact */}
        <div className="bg-muted/30 p-3 rounded-lg">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
            <TrendingUp className="h-3 w-3" />
            Expected Impact
          </div>
          <p className="text-sm">{decisionCard.expected_impact}</p>
        </div>

        {/* Cost */}
        <div className="bg-muted/30 p-3 rounded-lg">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
            <DollarSign className="h-3 w-3" />
            Cost
          </div>
          <p className="text-sm">{decisionCard.cost}</p>
        </div>

        {/* Risk */}
        <div className="bg-muted/30 p-3 rounded-lg">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
            <AlertTriangle className="h-3 w-3" />
            Risk
          </div>
          <div className="flex items-center gap-2">
            {getRiskBadge(decisionCard.risk)}
            <span className="text-xs text-muted-foreground">
              {decisionCard.risk.includes(' - ') ? decisionCard.risk.split(' - ')[1] : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Reversibility & Confidence Row */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <RotateCcw className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Reversibility:</span>
            {getReversibilityBadge(decisionCard.reversibility)}
          </div>
          <div className="flex items-center gap-1.5">
            <Gauge className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Confidence:</span>
            <span className={`text-sm font-medium ${getConfidenceColor(decisionCard.confidence)}`}>
              {Math.round(decisionCard.confidence * 100)}%
            </span>
          </div>
        </div>
      </div>

      {/* Requirements */}
      {decisionCard.requires.length > 0 && (
        <div className="px-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
            <CheckSquare className="h-3 w-3" />
            Requires
          </div>
          <div className="flex flex-wrap gap-1">
            {decisionCard.requires.map((req, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                {req}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Success Metric & Rollback Hint */}
      {(decisionCard.success_metric || decisionCard.rollback_hint) && (
        <div className="text-xs text-muted-foreground space-y-1 px-1 pt-2 border-t">
          {decisionCard.success_metric && (
            <p><strong>Success Metric:</strong> {decisionCard.success_metric}</p>
          )}
          {decisionCard.rollback_hint && (
            <p><strong>Rollback:</strong> {decisionCard.rollback_hint}</p>
          )}
        </div>
      )}

      {/* Human Modification */}
      {decisionCard.human_modification && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 p-3 rounded-lg">
          <p className="text-xs font-medium text-yellow-700 dark:text-yellow-400 mb-1">
            Human Modification Request:
          </p>
          <p className="text-sm">{decisionCard.human_modification}</p>
        </div>
      )}

      {/* Advanced - Raw JSON */}
      <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
        <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <FileJson className="h-3 w-3" />
          <span>Advanced</span>
          <ChevronDown className={`h-3 w-3 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          <div className="bg-muted/30 p-3 rounded-lg">
            <pre className="text-xs overflow-auto max-h-48">
              {JSON.stringify(actionPayload, null, 2)}
            </pre>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
