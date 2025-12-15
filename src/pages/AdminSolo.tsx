import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  User, Battery, Brain, Clock, Heart, DollarSign,
  Users, Zap, Coffee, Target, CheckCircle2, XCircle,
  TrendingUp, AlertTriangle, Sparkles, Calendar, Bell
} from "lucide-react";
import AdminLayout from "@/components/AdminLayout";
import { toast } from "sonner";

// Mock data for demo
const mockPriorities = [
  { id: 1, title: "Follow up with 3 hot leads", category: "sales", impact: "high", timeEstimate: 30 },
  { id: 2, title: "Review monthly cash flow", category: "finance", impact: "high", timeEstimate: 15 },
  { id: 3, title: "Send weekly client update", category: "relationships", impact: "medium", timeEstimate: 20 },
];

const mockDecisions = [
  { id: 1, question: "New marketing channel?", options: ["LinkedIn Ads", "YouTube", "Skip for now"], recommended: 1 },
  { id: 2, question: "Hire contractor or do yourself?", options: ["Hire", "DIY", "Postpone"], recommended: 0 },
];

const mockRelationships = [
  { id: 1, name: "John Smith", company: "ABC Corp", lastContact: "5 days ago", health: 85, nextAction: "Send case study" },
  { id: 2, name: "Sarah Johnson", company: "XYZ Inc", lastContact: "12 days ago", health: 60, nextAction: "Schedule call" },
  { id: 3, name: "Mike Chen", company: "Tech Co", lastContact: "3 days ago", health: 95, nextAction: "None needed" },
];

const AdminSolo = () => {
  const [energyLevel, setEnergyLevel] = useState(70);
  const [decisionsToday, setDecisionsToday] = useState(8);
  const [focusMode, setFocusMode] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const getEnergyColor = () => {
    if (energyLevel >= 70) return "text-green-500";
    if (energyLevel >= 40) return "text-yellow-500";
    return "text-red-500";
  };

  const getDecisionFatigueLevel = () => {
    if (decisionsToday <= 5) return { level: "Low", color: "text-green-500", message: "You're doing great!" };
    if (decisionsToday <= 10) return { level: "Moderate", color: "text-yellow-500", message: "Consider delegating" };
    return { level: "High", color: "text-red-500", message: "Take a break, postpone decisions" };
  };

  const handleCompleteTask = (taskId: number) => {
    toast.success("Task completed! Great job! 🎉");
    // In real app, would update database
  };

  const handleMakeDecision = (decisionId: number, optionIndex: number) => {
    setDecisionsToday(prev => prev + 1);
    toast.success("Decision recorded. Moving forward!");
    // In real app, would log decision and trigger actions
  };

  const fatigue = getDecisionFatigueLevel();

  return (
    <AdminLayout title="Solo Business HQ">
      <div className="p-6 space-y-6">
        {/* Header with Status */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <User className="h-6 w-6 text-primary" />
              Solo Business HQ
            </h1>
            <p className="text-muted-foreground">
              {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Focus Mode</span>
              <Switch checked={focusMode} onCheckedChange={setFocusMode} />
            </div>
            {focusMode && (
              <Badge variant="default" className="bg-purple-500">
                <Sparkles className="h-3 w-3 mr-1" />
                Focus Active
              </Badge>
            )}
          </div>
        </div>

        {/* Quick Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Energy Level */}
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Battery className={`h-5 w-5 ${getEnergyColor()}`} />
                    <span className="font-medium">Energy Level</span>
                  </div>
                  <span className={`text-xl font-bold ${getEnergyColor()}`}>{energyLevel}%</span>
                </div>
                <Slider
                  value={[energyLevel]}
                  onValueChange={([val]) => setEnergyLevel(val)}
                  max={100}
                  step={5}
                />
                <p className="text-xs text-muted-foreground">
                  {energyLevel >= 70 ? "Peak performance time!" : energyLevel >= 40 ? "Consider lighter tasks" : "Rest recommended"}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Decision Fatigue */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Brain className={`h-5 w-5 ${fatigue.color}`} />
                    <span className="font-medium">Decision Fatigue</span>
                  </div>
                  <p className={`text-xl font-bold ${fatigue.color}`}>{fatigue.level}</p>
                  <p className="text-xs text-muted-foreground">{decisionsToday} decisions today</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">{fatigue.message}</p>
            </CardContent>
          </Card>

          {/* Focus Time */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-blue-500" />
                    <span className="font-medium">Deep Work</span>
                  </div>
                  <p className="text-xl font-bold">2h 15m</p>
                  <p className="text-xs text-muted-foreground">Today's focus time</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Wellness Score */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Heart className="h-5 w-5 text-pink-500" />
                    <span className="font-medium">Wellness</span>
                  </div>
                  <p className="text-xl font-bold">Good</p>
                  <p className="text-xs text-muted-foreground">Break in 45 min</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Priority Queue - Max 3 items */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Today's Priorities (Max 3)
              </CardTitle>
              <CardDescription>Focus on these and nothing else</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockPriorities.map((task, idx) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-accent/5 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold">
                        {idx + 1}
                      </div>
                      <div>
                        <p className="font-medium">{task.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">{task.category}</Badge>
                          <span className="text-xs text-muted-foreground">~{task.timeEstimate}min</span>
                        </div>
                      </div>
                    </div>
                    <Button size="sm" onClick={() => handleCompleteTask(task.id)}>
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Done
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick Decisions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-yellow-500" />
                Quick Decisions
              </CardTitle>
              <CardDescription>AI-simplified choices</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockDecisions.map((decision) => (
                  <div key={decision.id} className="p-3 border rounded-lg space-y-3">
                    <p className="font-medium text-sm">{decision.question}</p>
                    <div className="flex flex-wrap gap-2">
                      {decision.options.map((option, idx) => (
                        <Button
                          key={idx}
                          size="sm"
                          variant={idx === decision.recommended ? "default" : "outline"}
                          onClick={() => handleMakeDecision(decision.id, idx)}
                          className="text-xs"
                        >
                          {idx === decision.recommended && <Sparkles className="h-3 w-3 mr-1" />}
                          {option}
                        </Button>
                      ))}
                    </div>
                    {decision.recommended !== undefined && (
                      <p className="text-xs text-muted-foreground">
                        AI recommends: {decision.options[decision.recommended]}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs for Different Areas */}
        <Tabs defaultValue="relationships" className="space-y-4">
          <TabsList>
            <TabsTrigger value="relationships">
              <Users className="h-4 w-4 mr-2" />
              Relationships
            </TabsTrigger>
            <TabsTrigger value="finances">
              <DollarSign className="h-4 w-4 mr-2" />
              Cash Flow
            </TabsTrigger>
            <TabsTrigger value="wellness">
              <Heart className="h-4 w-4 mr-2" />
              Wellness
            </TabsTrigger>
          </TabsList>

          <TabsContent value="relationships">
            <Card>
              <CardHeader>
                <CardTitle>Relationship Health</CardTitle>
                <CardDescription>Stay connected with key people</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {mockRelationships.map((rel) => (
                    <div key={rel.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{rel.name}</p>
                          <p className="text-xs text-muted-foreground">{rel.company} • {rel.lastContact}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className={`text-sm font-medium ${rel.health >= 80 ? 'text-green-500' : rel.health >= 60 ? 'text-yellow-500' : 'text-red-500'}`}>
                            {rel.health}%
                          </p>
                          <p className="text-xs text-muted-foreground">{rel.nextAction}</p>
                        </div>
                        <Button size="sm" variant="outline">
                          <Bell className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="finances">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-green-500" />
                  Financial Guardian
                </CardTitle>
                <CardDescription>AI-powered cash flow monitoring</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground">Cash on Hand</p>
                    <p className="text-2xl font-bold text-green-500">$24,500</p>
                    <p className="text-xs text-muted-foreground">+$3,200 this month</p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground">Outstanding Invoices</p>
                    <p className="text-2xl font-bold text-yellow-500">$8,750</p>
                    <p className="text-xs text-muted-foreground">3 invoices pending</p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground">Runway</p>
                    <p className="text-2xl font-bold">4.2 months</p>
                    <p className="text-xs text-muted-foreground">At current burn rate</p>
                  </div>
                </div>
                <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-500" />
                    <p className="font-medium">Action Needed</p>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Invoice #1047 is 15 days overdue. Consider sending a follow-up.
                  </p>
                  <Button size="sm" className="mt-2">Send Reminder</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="wellness">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Heart className="h-5 w-5 text-pink-500" />
                  Wellness Monitor
                </CardTitle>
                <CardDescription>Prevent burnout, stay sustainable</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Work Hours This Week</span>
                        <span className="text-sm text-muted-foreground">32 / 40 hrs</span>
                      </div>
                      <Progress value={80} className="h-2" />
                      <p className="text-xs text-muted-foreground mt-1">On track for sustainable week</p>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Breaks Taken</span>
                        <span className="text-sm text-muted-foreground">4 / 6</span>
                      </div>
                      <Progress value={67} className="h-2" />
                    </div>
                  </div>
                  <div className="p-4 border rounded-lg bg-green-500/5">
                    <Coffee className="h-8 w-8 text-green-500 mb-2" />
                    <p className="font-medium">You're doing well!</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Your work patterns this week are sustainable. Keep it up!
                    </p>
                    <div className="mt-3 space-y-2">
                      <p className="text-xs font-medium">Today's suggestions:</p>
                      <ul className="text-xs text-muted-foreground space-y-1">
                        <li>• Take a 15-min walk after lunch</li>
                        <li>• End work by 6 PM</li>
                        <li>• Tomorrow: Start with deep work</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default AdminSolo;
