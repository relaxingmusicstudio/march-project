import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Building2,
  Phone,
  MessageSquare,
  Zap,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Rocket,
  Settings,
  Users,
  Target,
} from "lucide-react";

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}

const steps: OnboardingStep[] = [
  {
    id: "welcome",
    title: "Welcome to ApexLocal360",
    description: "Let's get your AI voice agent set up in a few simple steps.",
    icon: <Rocket className="h-8 w-8" />,
  },
  {
    id: "business",
    title: "Business Information",
    description: "Tell us about your HVAC business so we can customize your AI agent.",
    icon: <Building2 className="h-8 w-8" />,
  },
  {
    id: "services",
    title: "Your Services",
    description: "What services do you offer? This helps the AI answer customer questions.",
    icon: <Settings className="h-8 w-8" />,
  },
  {
    id: "goals",
    title: "Your Goals",
    description: "What do you want to achieve with your AI voice agent?",
    icon: <Target className="h-8 w-8" />,
  },
  {
    id: "complete",
    title: "You're All Set!",
    description: "Your AI agent is ready to start capturing leads 24/7.",
    icon: <CheckCircle className="h-8 w-8" />,
  },
];

const ONBOARDING_KEY = "onboarding_completed";

interface OnboardingWizardProps {
  forceShow?: boolean;
}

const OnboardingWizard = ({ forceShow = false }: OnboardingWizardProps) => {
  const [open, setOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    businessName: "",
    phone: "",
    serviceArea: "",
    services: [] as string[],
    avgJobValue: "",
    monthlyCallVolume: "",
    goals: [] as string[],
  });

  useEffect(() => {
    const completed = localStorage.getItem(ONBOARDING_KEY);
    if (!completed || forceShow) {
      // Delay showing for better UX
      const timer = setTimeout(() => setOpen(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [forceShow]);

  const progress = ((currentStep + 1) / steps.length) * 100;

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleComplete = () => {
    localStorage.setItem(ONBOARDING_KEY, "true");
    localStorage.setItem("business_profile", JSON.stringify(formData));
    setOpen(false);
  };

  const handleSkip = () => {
    localStorage.setItem(ONBOARDING_KEY, "true");
    setOpen(false);
  };

  const serviceOptions = [
    "AC Repair & Installation",
    "Heating & Furnace",
    "Ductwork",
    "Maintenance Plans",
    "Emergency 24/7 Service",
    "Commercial HVAC",
  ];

  const goalOptions = [
    { id: "calls", label: "Never miss a call", icon: <Phone className="h-4 w-4" /> },
    { id: "leads", label: "Capture more leads", icon: <Users className="h-4 w-4" /> },
    { id: "booking", label: "Book appointments 24/7", icon: <MessageSquare className="h-4 w-4" /> },
    { id: "efficiency", label: "Free up office staff", icon: <Zap className="h-4 w-4" /> },
  ];

  const toggleService = (service: string) => {
    setFormData((prev) => ({
      ...prev,
      services: prev.services.includes(service)
        ? prev.services.filter((s) => s !== service)
        : [...prev.services, service],
    }));
  };

  const toggleGoal = (goal: string) => {
    setFormData((prev) => ({
      ...prev,
      goals: prev.goals.includes(goal)
        ? prev.goals.filter((g) => g !== goal)
        : [...prev.goals, goal],
    }));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-accent/10 rounded-lg text-accent">
              {steps[currentStep].icon}
            </div>
            <div>
              <DialogTitle>{steps[currentStep].title}</DialogTitle>
              <DialogDescription>{steps[currentStep].description}</DialogDescription>
            </div>
          </div>
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground text-right">
            Step {currentStep + 1} of {steps.length}
          </p>
        </DialogHeader>

        <div className="py-4">
          {/* Welcome Step */}
          {currentStep === 0 && (
            <div className="text-center space-y-4">
              <div className="p-8 bg-gradient-to-br from-accent/10 to-accent/5 rounded-lg">
                <Rocket className="h-16 w-16 text-accent mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Let's Get Started!</h3>
                <p className="text-muted-foreground">
                  In just 2 minutes, we'll set up your AI voice agent to handle calls, 
                  book appointments, and capture leads 24/7.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-3 bg-muted rounded-lg">
                  <Phone className="h-6 w-6 mx-auto mb-1 text-accent" />
                  <p className="text-xs text-muted-foreground">24/7 Answering</p>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <MessageSquare className="h-6 w-6 mx-auto mb-1 text-accent" />
                  <p className="text-xs text-muted-foreground">Smart Booking</p>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <Zap className="h-6 w-6 mx-auto mb-1 text-accent" />
                  <p className="text-xs text-muted-foreground">Lead Capture</p>
                </div>
              </div>
            </div>
          )}

          {/* Business Info Step */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="businessName">Business Name</Label>
                <Input
                  id="businessName"
                  placeholder="e.g., Smith's HVAC Services"
                  value={formData.businessName}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, businessName: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Business Phone</Label>
                <Input
                  id="phone"
                  placeholder="(555) 123-4567"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, phone: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="serviceArea">Service Area</Label>
                <Input
                  id="serviceArea"
                  placeholder="e.g., Phoenix Metro Area"
                  value={formData.serviceArea}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, serviceArea: e.target.value }))
                  }
                />
              </div>
            </div>
          )}

          {/* Services Step */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Select all the services you offer:
              </p>
              <div className="grid grid-cols-2 gap-3">
                {serviceOptions.map((service) => (
                  <Card
                    key={service}
                    className={`cursor-pointer transition-all ${
                      formData.services.includes(service)
                        ? "border-accent bg-accent/10"
                        : "hover:border-muted-foreground/50"
                    }`}
                    onClick={() => toggleService(service)}
                  >
                    <CardContent className="p-3 flex items-center gap-2">
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center ${
                          formData.services.includes(service)
                            ? "bg-accent border-accent"
                            : "border-muted-foreground"
                        }`}
                      >
                        {formData.services.includes(service) && (
                          <CheckCircle className="h-3 w-3 text-accent-foreground" />
                        )}
                      </div>
                      <span className="text-sm">{service}</span>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="avgJobValue">Avg Job Value ($)</Label>
                  <Input
                    id="avgJobValue"
                    type="number"
                    placeholder="351"
                    value={formData.avgJobValue}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, avgJobValue: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="monthlyCallVolume">Monthly Calls</Label>
                  <Input
                    id="monthlyCallVolume"
                    type="number"
                    placeholder="80"
                    value={formData.monthlyCallVolume}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, monthlyCallVolume: e.target.value }))
                    }
                  />
                </div>
              </div>
            </div>
          )}

          {/* Goals Step */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                What are your main goals? Select all that apply:
              </p>
              <div className="space-y-3">
                {goalOptions.map((goal) => (
                  <Card
                    key={goal.id}
                    className={`cursor-pointer transition-all ${
                      formData.goals.includes(goal.id)
                        ? "border-accent bg-accent/10"
                        : "hover:border-muted-foreground/50"
                    }`}
                    onClick={() => toggleGoal(goal.id)}
                  >
                    <CardContent className="p-4 flex items-center gap-3">
                      <div
                        className={`w-5 h-5 rounded border flex items-center justify-center ${
                          formData.goals.includes(goal.id)
                            ? "bg-accent border-accent"
                            : "border-muted-foreground"
                        }`}
                      >
                        {formData.goals.includes(goal.id) && (
                          <CheckCircle className="h-4 w-4 text-accent-foreground" />
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {goal.icon}
                        <span>{goal.label}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Complete Step */}
          {currentStep === 4 && (
            <div className="text-center space-y-4">
              <div className="p-8 bg-gradient-to-br from-green-500/10 to-green-500/5 rounded-lg">
                <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">You're All Set!</h3>
                <p className="text-muted-foreground">
                  Your AI voice agent is configured and ready to start capturing leads.
                </p>
              </div>
              <div className="p-4 bg-muted rounded-lg text-left">
                <h4 className="font-medium mb-2">What happens next:</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Your AI agent is trained on your services
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    You'll receive leads in your dashboard
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Analytics tracking is enabled
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-border">
          <div>
            {currentStep > 0 && currentStep < steps.length - 1 && (
              <Button variant="ghost" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {currentStep < steps.length - 1 && (
              <Button variant="ghost" onClick={handleSkip}>
                Skip for now
              </Button>
            )}
            {currentStep < steps.length - 1 ? (
              <Button onClick={handleNext}>
                Continue
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button onClick={handleComplete} className="bg-green-600 hover:bg-green-700">
                Go to Dashboard
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OnboardingWizard;
