import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Target, TrendingUp, Clock, CheckCircle } from "lucide-react";

interface Goal {
  id: string;
  name: string;
  target: number;
  current: number;
  unit: string;
  deadline?: string;
  category: "revenue" | "leads" | "clients" | "other";
}

interface GoalTrackerProps {
  goals: Goal[];
  className?: string;
}

const GoalTracker = ({ goals, className = "" }: GoalTrackerProps) => {
  const getProgress = (current: number, target: number) => {
    return Math.min(100, (current / target) * 100);
  };

  const getCategoryIcon = (category: Goal["category"]) => {
    switch (category) {
      case "revenue":
        return "💰";
      case "leads":
        return "🎯";
      case "clients":
        return "👥";
      default:
        return "📊";
    }
  };

  const getStatusColor = (progress: number) => {
    if (progress >= 100) return "bg-green-500";
    if (progress >= 75) return "bg-primary";
    if (progress >= 50) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getDaysRemaining = (deadline?: string) => {
    if (!deadline) return null;
    const days = Math.ceil(
      (new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    return days;
  };

  const completedGoals = goals.filter(g => g.current >= g.target).length;

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            Goal Tracker
          </div>
          <Badge variant="outline" className="text-xs">
            {completedGoals}/{goals.length} complete
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {goals.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Target className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No goals set yet</p>
          </div>
        ) : (
          goals.map((goal) => {
            const progress = getProgress(goal.current, goal.target);
            const daysRemaining = getDaysRemaining(goal.deadline);
            const isComplete = goal.current >= goal.target;

            return (
              <div 
                key={goal.id}
                className={`p-3 rounded-lg border transition-all ${
                  isComplete 
                    ? "bg-green-500/5 border-green-500/20" 
                    : "bg-muted/30 border-transparent"
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span>{getCategoryIcon(goal.category)}</span>
                    <div>
                      <p className="font-medium text-sm">{goal.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {goal.current.toLocaleString()} / {goal.target.toLocaleString()} {goal.unit}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {isComplete ? (
                      <Badge variant="default" className="bg-green-500 text-xs">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Done
                      </Badge>
                    ) : daysRemaining !== null && (
                      <Badge 
                        variant={daysRemaining < 7 ? "destructive" : "secondary"} 
                        className="text-xs"
                      >
                        <Clock className="h-3 w-3 mr-1" />
                        {daysRemaining}d
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <Progress 
                    value={progress} 
                    className="h-2"
                  />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{progress.toFixed(0)}% complete</span>
                    {!isComplete && (
                      <span>
                        {(goal.target - goal.current).toLocaleString()} {goal.unit} to go
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
};

export default GoalTracker;
