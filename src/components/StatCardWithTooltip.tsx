import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { HelpCircle } from "lucide-react";

interface StatCardWithTooltipProps {
  title: string;
  simpleTitle?: string;
  value: string | number;
  icon?: React.ReactNode;
  tooltip: string;
  action?: string;
  onClick?: () => void;
  variant?: "default" | "success" | "warning" | "danger" | "primary";
  className?: string;
}

const variantStyles = {
  default: "",
  success: "border-green-500/30 hover:border-green-500/50",
  warning: "border-yellow-500/30 hover:border-yellow-500/50",
  danger: "border-red-500/30 hover:border-red-500/50",
  primary: "border-primary/30 hover:border-primary/50",
};

const iconVariantStyles = {
  default: "text-muted-foreground",
  success: "text-green-500",
  warning: "text-yellow-500",
  danger: "text-red-500",
  primary: "text-primary",
};

export function StatCardWithTooltip({
  title,
  simpleTitle,
  value,
  icon,
  tooltip,
  action,
  onClick,
  variant = "default",
  className,
}: StatCardWithTooltipProps) {
  const displayTitle = simpleTitle || title;
  const isClickable = !!onClick;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Card
            className={cn(
              "transition-all duration-200",
              variantStyles[variant],
              isClickable && "cursor-pointer hover:shadow-md hover:scale-[1.02] active:scale-[0.98]",
              className
            )}
            onClick={onClick}
          >
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium text-muted-foreground">
                      {displayTitle}
                    </p>
                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/50" />
                  </div>
                  <p className="text-2xl font-bold tracking-tight">{value}</p>
                  {action && isClickable && (
                    <p className="text-xs text-primary/70 mt-1">
                      Click to {action.toLowerCase()}
                    </p>
                  )}
                </div>
                {icon && (
                  <div className={cn("h-8 w-8", iconVariantStyles[variant])}>
                    {icon}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-1">
            <p className="font-medium">{displayTitle}</p>
            <p className="text-sm text-muted-foreground">{tooltip}</p>
            {action && (
              <p className="text-xs text-primary mt-1">
                {isClickable ? `Click to ${action.toLowerCase()}` : action}
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
