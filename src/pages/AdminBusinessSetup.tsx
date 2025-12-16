import React from 'react';
import AdminLayout from '@/components/AdminLayout';
import { BusinessDiscoveryWizard } from '@/components/BusinessDiscoveryWizard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sparkles, FileText, Copy, RotateCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export default function AdminBusinessSetup() {
  const navigate = useNavigate();

  const handleComplete = (data: Record<string, unknown>) => {
    console.log('Business configured:', data);
    toast.success('Business setup complete! Redirecting to command center...');
    setTimeout(() => {
      navigate('/app/command-center');
    }, 2000);
  };

  return (
    <AdminLayout title="AI Business Setup" subtitle="Let our AI configure your entire business in minutes">
      <div className="space-y-6">
        {/* Main Content */}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Wizard */}
          <div className="lg:col-span-2">
            <BusinessDiscoveryWizard 
              onComplete={handleComplete}
            />
          </div>

          {/* Side Panel */}
          <div className="space-y-4">
            {/* How It Works */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">How It Works</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 text-xs font-bold text-primary">
                    1
                  </div>
                  <div>
                    <p className="font-medium">Answer Questions</p>
                    <p className="text-muted-foreground text-xs">
                      Our AI asks about your business, services, and goals
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 text-xs font-bold text-primary">
                    2
                  </div>
                  <div>
                    <p className="font-medium">AI Configures Everything</p>
                    <p className="text-muted-foreground text-xs">
                      Automatically sets up your AI receptionist, profiles, and settings
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 text-xs font-bold text-primary">
                    3
                  </div>
                  <div>
                    <p className="font-medium">Launch & Go Live</p>
                    <p className="text-muted-foreground text-xs">
                      One click to activate your fully configured business
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <FileText className="mr-2 h-4 w-4" />
                  Use Existing Template
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <Copy className="mr-2 h-4 w-4" />
                  Clone From Business
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reset & Start Over
                </Button>
              </CardContent>
            </Card>

            {/* Industry Stats Preview */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Industry Insights</CardTitle>
                <CardDescription className="text-xs">
                  We'll use real data to optimize your setup
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="p-2 rounded-lg bg-muted/50">
                    <p className="text-lg font-bold text-primary">27%</p>
                    <p className="text-[10px] text-muted-foreground">Missed Calls</p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/50">
                    <p className="text-lg font-bold text-primary">$351</p>
                    <p className="text-[10px] text-muted-foreground">Avg Job Value</p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/50">
                    <p className="text-lg font-bold text-primary">80%</p>
                    <p className="text-[10px] text-muted-foreground">VM Abandon</p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/50">
                    <p className="text-lg font-bold text-primary">$15K+</p>
                    <p className="text-[10px] text-muted-foreground">Customer LTV</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
