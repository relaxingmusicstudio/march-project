import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Users, 
  Rocket,
  Calendar,
  Video,
  Package,
  ArrowRight
} from "lucide-react";
import OnboardingPipeline from "@/components/onboarding/OnboardingPipeline";
import TaskManager from "@/components/onboarding/TaskManager";
import DeliverableTracker from "@/components/onboarding/DeliverableTracker";
import TrainingScheduler from "@/components/onboarding/TrainingScheduler";

const AdminOnboarding = () => {
  const queryClient = useQueryClient();

  const { data: onboardingData, isLoading } = useQuery({
    queryKey: ['client-onboarding'],
    queryFn: async () => {
      const { data: onboarding, error } = await supabase
        .from('client_onboarding')
        .select(`
          *,
          clients (id, name, email, plan, mrr)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return onboarding;
    }
  });

  const { data: stats } = useQuery({
    queryKey: ['onboarding-stats'],
    queryFn: async () => {
      const { data: onboarding } = await supabase
        .from('client_onboarding')
        .select('status');

      const pending = onboarding?.filter(o => o.status === 'pending').length || 0;
      const inProgress = onboarding?.filter(o => o.status === 'in_progress').length || 0;
      const completed = onboarding?.filter(o => o.status === 'completed').length || 0;
      const live = onboarding?.filter(o => o.status === 'live').length || 0;

      return { pending, inProgress, completed, live, total: onboarding?.length || 0 };
    }
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/10 text-yellow-500';
      case 'in_progress': return 'bg-blue-500/10 text-blue-500';
      case 'completed': return 'bg-green-500/10 text-green-500';
      case 'live': return 'bg-primary/10 text-primary';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  if (isLoading) {
    return (
      <AdminLayout title="Client Onboarding" subtitle="Automated delivery & setup pipeline">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Client Onboarding" subtitle="Automated delivery & setup pipeline">
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-yellow-500/10">
                  <Clock className="h-6 w-6 text-yellow-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-2xl font-bold">{stats?.pending || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-blue-500/10">
                  <Package className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">In Progress</p>
                  <p className="text-2xl font-bold">{stats?.inProgress || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-green-500/10">
                  <CheckCircle2 className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Completed</p>
                  <p className="text-2xl font-bold">{stats?.completed || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <Rocket className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Live</p>
                  <p className="text-2xl font-bold">{stats?.live || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="pipeline" className="space-y-4">
          <TabsList>
            <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
            <TabsTrigger value="deliverables">Deliverables</TabsTrigger>
            <TabsTrigger value="training">Training</TabsTrigger>
          </TabsList>

          <TabsContent value="pipeline">
            <OnboardingPipeline onboardingData={onboardingData || []} />
          </TabsContent>

          <TabsContent value="tasks">
            <TaskManager />
          </TabsContent>

          <TabsContent value="deliverables">
            <DeliverableTracker />
          </TabsContent>

          <TabsContent value="training">
            <TrainingScheduler />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default AdminOnboarding;
