import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  ArrowLeft, TrendingUp, DollarSign, Target, Eye, MousePointer,
  BarChart3, PlusCircle, Loader2, Sparkles, Search, Play, Pause
} from "lucide-react";
import { Link } from "react-router-dom";

interface Campaign {
  id: string;
  platform: string;
  name: string;
  objective: string | null;
  budget_daily: number | null;
  status: string;
  targeting: Record<string, unknown> | null;
  performance: {
    impressions?: number;
    clicks?: number;
    conversions?: number;
    spend?: number;
    ctr?: number;
    cpc?: number;
  };
  created_at: string;
}

interface Keyword {
  id: string;
  keyword: string;
  search_volume: number | null;
  competition: string | null;
  cpc_estimate: number | null;
  status: string;
  current_rank: number | null;
}

const AdminAds = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("campaigns");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // Campaign form
  const [campaignName, setCampaignName] = useState("");
  const [campaignPlatform, setCampaignPlatform] = useState("google");
  const [campaignObjective, setCampaignObjective] = useState("conversions");
  const [campaignBudget, setCampaignBudget] = useState("50");
  const [adCopy, setAdCopy] = useState("");

  // Keyword research
  const [seedKeyword, setSeedKeyword] = useState("");
  const [researchingKeywords, setResearchingKeywords] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [campaignsRes, keywordsRes] = await Promise.all([
        supabase.from("ad_campaigns").select("*").order("created_at", { ascending: false }),
        supabase.from("keywords").select("*").order("search_volume", { ascending: false }).limit(50)
      ]);

      setCampaigns((campaignsRes.data as Campaign[]) || []);
      setKeywords((keywordsRes.data as Keyword[]) || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const createCampaign = async () => {
    if (!campaignName) return;
    setCreating(true);
    try {
      const { error } = await supabase.from("ad_campaigns").insert({
        name: campaignName,
        platform: campaignPlatform,
        objective: campaignObjective,
        budget_daily: parseFloat(campaignBudget),
        status: "draft"
      });

      if (error) throw error;

      toast({ title: "Campaign Created", description: "Your campaign has been saved as a draft." });
      setCampaignName("");
      setAdCopy("");
      fetchData();
    } catch (error) {
      console.error("Error creating campaign:", error);
      toast({ title: "Error", description: "Failed to create campaign.", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const generateAdCopy = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("content-generator", {
        body: {
          topic: campaignName,
          format: "ad",
          platform: campaignPlatform
        }
      });

      if (error) throw error;
      setAdCopy(data?.content || "");
      toast({ title: "Ad Copy Generated", description: "AI has created ad copy for your campaign." });
    } catch (error) {
      console.error("Error generating ad copy:", error);
      toast({ title: "Error", description: "Failed to generate ad copy.", variant: "destructive" });
    }
  };

  const researchKeywords = async () => {
    if (!seedKeyword) return;
    setResearchingKeywords(true);
    try {
      const { data, error } = await supabase.functions.invoke("keyword-planner", {
        body: { seed_keyword: seedKeyword }
      });

      if (error) throw error;

      toast({ 
        title: "Keywords Found", 
        description: `Discovered ${data?.keywords?.length || 0} related keywords.` 
      });
      fetchData();
    } catch (error) {
      console.error("Error researching keywords:", error);
      toast({ title: "Error", description: "Failed to research keywords.", variant: "destructive" });
    } finally {
      setResearchingKeywords(false);
    }
  };

  const updateCampaignStatus = async (id: string, status: string) => {
    await supabase.from("ad_campaigns").update({ status }).eq("id", id);
    fetchData();
    toast({ title: "Campaign Updated", description: `Status changed to ${status}.` });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-green-500/20 text-green-400";
      case "paused": return "bg-yellow-500/20 text-yellow-400";
      case "ended": return "bg-red-500/20 text-red-400";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getPlatformColor = (platform: string) => {
    switch (platform) {
      case "google": return "bg-blue-500/20 text-blue-400";
      case "meta": return "bg-indigo-500/20 text-indigo-400";
      case "facebook": return "bg-indigo-500/20 text-indigo-400";
      default: return "bg-muted text-muted-foreground";
    }
  };

  // Calculate totals
  const totalSpend = campaigns.reduce((sum, c) => sum + (c.performance?.spend || 0), 0);
  const totalImpressions = campaigns.reduce((sum, c) => sum + (c.performance?.impressions || 0), 0);
  const totalClicks = campaigns.reduce((sum, c) => sum + (c.performance?.clicks || 0), 0);
  const totalConversions = campaigns.reduce((sum, c) => sum + (c.performance?.conversions || 0), 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/admin/ceo" className="text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <BarChart3 className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-foreground">Ads Manager</h1>
                  <p className="text-sm text-muted-foreground">Google & Meta advertising</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Overview Stats */}
        <div className="grid gap-4 md:grid-cols-4 mb-8">
          <Card className="bg-card border-border">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-5 w-5 text-green-400" />
                <span className="text-muted-foreground">Total Spend</span>
              </div>
              <p className="text-2xl font-bold">${totalSpend.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-2">
                <Eye className="h-5 w-5 text-blue-400" />
                <span className="text-muted-foreground">Impressions</span>
              </div>
              <p className="text-2xl font-bold">{totalImpressions.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-2">
                <MousePointer className="h-5 w-5 text-purple-400" />
                <span className="text-muted-foreground">Clicks</span>
              </div>
              <p className="text-2xl font-bold">{totalClicks.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-5 w-5 text-orange-400" />
                <span className="text-muted-foreground">Conversions</span>
              </div>
              <p className="text-2xl font-bold">{totalConversions.toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="campaigns" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" /> Campaigns
            </TabsTrigger>
            <TabsTrigger value="create" className="flex items-center gap-2">
              <PlusCircle className="h-4 w-4" /> Create Campaign
            </TabsTrigger>
            <TabsTrigger value="keywords" className="flex items-center gap-2">
              <Search className="h-4 w-4" /> Keywords
            </TabsTrigger>
          </TabsList>

          {/* Campaigns Tab */}
          <TabsContent value="campaigns" className="space-y-4">
            {campaigns.length === 0 ? (
              <Card className="bg-card border-border">
                <CardContent className="py-12 text-center">
                  <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">No Campaigns Yet</h3>
                  <p className="text-muted-foreground mb-4">Create your first ad campaign to get started.</p>
                  <Button onClick={() => setActiveTab("create")}>
                    <PlusCircle className="h-4 w-4 mr-2" /> Create Campaign
                  </Button>
                </CardContent>
              </Card>
            ) : (
              campaigns.map(campaign => (
                <Card key={campaign.id} className="bg-card border-border">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={getPlatformColor(campaign.platform)}>
                            {campaign.platform === "google" ? "Google Ads" : "Meta Ads"}
                          </Badge>
                          <Badge className={getStatusColor(campaign.status)}>{campaign.status}</Badge>
                        </div>
                        <CardTitle className="text-lg">{campaign.name}</CardTitle>
                        <CardDescription>
                          Objective: {campaign.objective} • Budget: ${campaign.budget_daily}/day
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        {campaign.status === "active" ? (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => updateCampaignStatus(campaign.id, "paused")}
                          >
                            <Pause className="h-4 w-4 mr-2" /> Pause
                          </Button>
                        ) : (
                          <Button 
                            size="sm"
                            onClick={() => updateCampaignStatus(campaign.id, "active")}
                          >
                            <Play className="h-4 w-4 mr-2" /> Activate
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-5 gap-4 text-center">
                      <div>
                        <p className="text-2xl font-bold">{(campaign.performance?.impressions || 0).toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Impressions</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{(campaign.performance?.clicks || 0).toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Clicks</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{(campaign.performance?.ctr || 0).toFixed(2)}%</p>
                        <p className="text-xs text-muted-foreground">CTR</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold">${(campaign.performance?.cpc || 0).toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">CPC</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{campaign.performance?.conversions || 0}</p>
                        <p className="text-xs text-muted-foreground">Conversions</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Create Campaign Tab */}
          <TabsContent value="create" className="space-y-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PlusCircle className="h-5 w-5 text-primary" />
                  Create New Campaign
                </CardTitle>
                <CardDescription>Set up a new advertising campaign</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-muted-foreground mb-2 block">Campaign Name</label>
                    <Input
                      placeholder="Summer HVAC Special"
                      value={campaignName}
                      onChange={(e) => setCampaignName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-2 block">Platform</label>
                    <select
                      value={campaignPlatform}
                      onChange={(e) => setCampaignPlatform(e.target.value)}
                      className="w-full p-2 rounded-md bg-background border border-border"
                    >
                      <option value="google">Google Ads</option>
                      <option value="meta">Meta (Facebook/Instagram)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-muted-foreground mb-2 block">Objective</label>
                    <select
                      value={campaignObjective}
                      onChange={(e) => setCampaignObjective(e.target.value)}
                      className="w-full p-2 rounded-md bg-background border border-border"
                    >
                      <option value="conversions">Conversions</option>
                      <option value="traffic">Website Traffic</option>
                      <option value="awareness">Brand Awareness</option>
                      <option value="leads">Lead Generation</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-2 block">Daily Budget ($)</label>
                    <Input
                      type="number"
                      placeholder="50"
                      value={campaignBudget}
                      onChange={(e) => setCampaignBudget(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm text-muted-foreground">Ad Copy</label>
                    <Button size="sm" variant="outline" onClick={generateAdCopy} disabled={!campaignName}>
                      <Sparkles className="h-4 w-4 mr-2" /> Generate with AI
                    </Button>
                  </div>
                  <Textarea
                    placeholder="Your ad copy will appear here..."
                    value={adCopy}
                    onChange={(e) => setAdCopy(e.target.value)}
                    rows={4}
                  />
                </div>

                <Button onClick={createCampaign} disabled={creating || !campaignName} className="w-full">
                  {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <PlusCircle className="h-4 w-4 mr-2" />}
                  Create Campaign
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Keywords Tab */}
          <TabsContent value="keywords" className="space-y-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5 text-primary" />
                  Keyword Research
                </CardTitle>
                <CardDescription>Discover high-value keywords for your campaigns</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-4">
                  <Input
                    placeholder="Enter a seed keyword (e.g., 'HVAC repair')"
                    value={seedKeyword}
                    onChange={(e) => setSeedKeyword(e.target.value)}
                    className="flex-1"
                  />
                  <Button onClick={researchKeywords} disabled={researchingKeywords || !seedKeyword}>
                    {researchingKeywords ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Search className="h-4 w-4 mr-2" />
                    )}
                    Research
                  </Button>
                </div>
              </CardContent>
            </Card>

            {keywords.length > 0 && (
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle>Keyword Opportunities</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-3 px-4 text-muted-foreground font-medium">Keyword</th>
                          <th className="text-right py-3 px-4 text-muted-foreground font-medium">Volume</th>
                          <th className="text-right py-3 px-4 text-muted-foreground font-medium">Competition</th>
                          <th className="text-right py-3 px-4 text-muted-foreground font-medium">Est. CPC</th>
                          <th className="text-right py-3 px-4 text-muted-foreground font-medium">Rank</th>
                        </tr>
                      </thead>
                      <tbody>
                        {keywords.map(kw => (
                          <tr key={kw.id} className="border-b border-border/50 hover:bg-muted/30">
                            <td className="py-3 px-4 font-medium">{kw.keyword}</td>
                            <td className="py-3 px-4 text-right">{kw.search_volume?.toLocaleString() || "-"}</td>
                            <td className="py-3 px-4 text-right">
                              <Badge variant="outline" className={
                                kw.competition === "low" ? "text-green-400" :
                                kw.competition === "medium" ? "text-yellow-400" : "text-red-400"
                              }>
                                {kw.competition || "unknown"}
                              </Badge>
                            </td>
                            <td className="py-3 px-4 text-right">
                              {kw.cpc_estimate ? `$${kw.cpc_estimate.toFixed(2)}` : "-"}
                            </td>
                            <td className="py-3 px-4 text-right">
                              {kw.current_rank ? `#${kw.current_rank}` : "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminAds;
