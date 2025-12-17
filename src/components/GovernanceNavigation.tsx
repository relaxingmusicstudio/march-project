/**
 * Governance Navigation
 * 
 * UI Surface per governance hierarchy:
 * 
 * AI CEO (visible):
 * - Home, Opportunities, Strategies, Issues & Risks, History & Learning
 * 
 * Human Operator (visible):
 * - Decisions (default entry), Controls, Business Health, Audit Log
 * 
 * HIDDEN BY DEFAULT (Advanced Mode):
 * - Funnels, Ads, Sequences, Content, Social, YouTube, Command Center, Agent workspaces
 */

import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Brain,
  CheckCircle2,
  Lightbulb,
  Target,
  AlertTriangle,
  History,
  Settings,
  Activity,
  Shield,
  FileSearch,
  Eye,
  EyeOff,
  LayoutGrid,
} from "lucide-react";

interface NavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  badgeVariant?: "default" | "secondary" | "destructive";
}

interface NavSection {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavItem[];
}

// AI CEO visible surfaces
const CEO_NAVIGATION: NavSection = {
  id: "ceo",
  label: "AI CEO",
  icon: Brain,
  items: [
    { path: "/app/ceo", label: "Intelligence Home", icon: Brain },
    { path: "/app/ceo/opportunities", label: "Opportunities", icon: Lightbulb },
    { path: "/app/ceo/strategies", label: "Strategies", icon: Target },
    { path: "/app/ceo/risks", label: "Issues & Risks", icon: AlertTriangle },
    { path: "/app/ceo/learning", label: "History & Learning", icon: History },
  ],
};

// Human Operator visible surfaces
const OPERATOR_NAVIGATION: NavSection = {
  id: "operator",
  label: "Human Controls",
  icon: Shield,
  items: [
    { path: "/app", label: "Decisions", icon: CheckCircle2, badge: "Default" },
    { path: "/app/controls", label: "Controls", icon: Settings },
    { path: "/app/health", label: "Business Health", icon: Activity },
    { path: "/app/audit", label: "Audit Log", icon: FileSearch },
  ],
};

// Advanced Mode - Hidden by default
const ADVANCED_NAVIGATION: NavSection = {
  id: "advanced",
  label: "Execution Tools",
  icon: LayoutGrid,
  items: [
    { path: "/app/command-center", label: "Command Center", icon: LayoutGrid },
    { path: "/app/command-center/crm", label: "CRM", icon: Target },
    { path: "/app/command-center/pipeline", label: "Pipeline", icon: Target },
    { path: "/app/command-center/content", label: "Content", icon: Target },
    { path: "/app/command-center/sequences", label: "Sequences", icon: Target },
    { path: "/app/command-center/social", label: "Social", icon: Target },
  ],
};

interface GovernanceNavigationProps {
  className?: string;
  showAdvanced?: boolean;
  onAdvancedToggle?: (show: boolean) => void;
}

export function GovernanceNavigation({ 
  className = "", 
  showAdvanced = false,
  onAdvancedToggle 
}: GovernanceNavigationProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [advancedMode, setAdvancedMode] = useState(showAdvanced);

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  const isActive = (path: string) => location.pathname === path;

  const toggleAdvanced = (enabled: boolean) => {
    setAdvancedMode(enabled);
    onAdvancedToggle?.(enabled);
  };

  const renderSection = (section: NavSection) => (
    <div key={section.id} className="space-y-1">
      <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {React.createElement(section.icon, { className: "h-3 w-3" })}
        {section.label}
      </div>
      {section.items.map((item) => (
        <Button
          key={item.path}
          variant={isActive(item.path) ? "secondary" : "ghost"}
          size="sm"
          className={`w-full justify-start gap-2 ${isActive(item.path) ? 'bg-primary/10 text-primary' : ''}`}
          onClick={() => handleNavigation(item.path)}
        >
          {React.createElement(item.icon, { className: "h-4 w-4" })}
          {item.label}
          {item.badge && (
            <Badge 
              variant={item.badgeVariant || "secondary"} 
              className="ml-auto text-xs"
            >
              {item.badge}
            </Badge>
          )}
        </Button>
      ))}
    </div>
  );

  return (
    <nav className={`space-y-4 ${className}`}>
      {/* Human Operator Controls - Primary */}
      {renderSection(OPERATOR_NAVIGATION)}
      
      <Separator />
      
      {/* AI CEO Intelligence - Read Only */}
      {renderSection(CEO_NAVIGATION)}
      
      <Separator />
      
      {/* Advanced Mode Toggle */}
      <div className="px-3 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {advancedMode ? (
              <Eye className="h-3 w-3" />
            ) : (
              <EyeOff className="h-3 w-3" />
            )}
            Advanced Mode
          </div>
          <Switch
            checked={advancedMode}
            onCheckedChange={toggleAdvanced}
            className="scale-75"
          />
        </div>
        {advancedMode && (
          <p className="text-xs text-muted-foreground mt-1">
            Execution tools visible
          </p>
        )}
      </div>
      
      {/* Advanced/Execution Tools - Hidden by default */}
      {advancedMode && (
        <>
          <Separator />
          {renderSection(ADVANCED_NAVIGATION)}
        </>
      )}
    </nav>
  );
}

export default GovernanceNavigation;
