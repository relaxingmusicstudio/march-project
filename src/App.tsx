import { HelmetProvider } from "react-helmet-async";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { VisitorProvider } from "@/contexts/VisitorContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AuthRouter from "@/components/AuthRouter";
import ErrorBoundary from "@/components/ErrorBoundary";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import CookieConsentBanner from "@/components/CookieConsentBanner";
import EnhancedTrackingConsent from "@/components/EnhancedTrackingConsent";

// Public pages
import Index from "./pages/Index";
import Blog from "./pages/Blog";
import BlogPost from "./pages/BlogPost";
import Auth from "./pages/Auth";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import CookiePolicy from "./pages/CookiePolicy";
import NotFound from "./pages/NotFound";

// CEO Command Center - Primary Interface
import CEOHome from "./pages/CEOHome";
import DecisionsDashboard from "./pages/DecisionsDashboard";
import OnboardingConversation from "./pages/OnboardingConversation";
import ClientPortal from "./pages/ClientPortal";

// Capability Pages (accessed via Intelligence Grid cards)
import AdminPipeline from "./pages/AdminPipeline";
import AdminInbox from "./pages/AdminInbox";
import AdminAnalytics from "./pages/AdminAnalytics";
import AdminBilling from "./pages/AdminBilling";
import AdminContent from "./pages/AdminContent";
import AdminSettings from "./pages/AdminSettings";
import AdminClients from "./pages/AdminClients";
import AdminLeads from "./pages/AdminLeads";
import AdminSequences from "./pages/AdminSequences";
import AdminCRM from "./pages/AdminCRM";
import AdminContacts from "./pages/AdminContacts";
import KnowledgeVault from "./pages/KnowledgeVault";
import AdminSystemHealth from "./pages/AdminSystemHealth";
import AdminAudit from "./pages/AdminAudit";
import AdminHelp from "./pages/AdminHelp";
import AdminBusinessSetup from "./pages/AdminBusinessSetup";

// Platform Admin (hidden from regular users)
import AdminTenants from "./pages/AdminTenants";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

/**
 * App routing structure:
 * 
 * AuthRouter - SINGLE routing brain that handles:
 *   - !authenticated -> /auth
 *   - authenticated + !onboarding_complete -> /app/onboarding
 *   - authenticated + onboarding_complete + client -> /app/portal
 *   - authenticated + onboarding_complete + owner -> /app
 * 
 * ProtectedRoute - Access guard ONLY (no routing):
 *   - requireOwner -> redirects clients to /app/portal
 *   - requireClient -> redirects owners to /app
 *   - requireAdmin -> shows Access Denied
 */
const App = () => (
  <ErrorBoundary>
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <VisitorProvider>
            <Toaster />
            <Sonner />
            <PWAInstallPrompt />
            <BrowserRouter>
              <CookieConsentBanner />
              <EnhancedTrackingConsent />
              {/* AuthRouter wraps all routes for centralized routing logic */}
              <AuthRouter>
                <Routes>
                  {/* Public Routes */}
                  <Route path="/" element={<Index />} />
                  <Route path="/blog" element={<Blog />} />
                  <Route path="/blog/:slug" element={<BlogPost />} />
                  <Route path="/privacy" element={<PrivacyPolicy />} />
                  <Route path="/terms" element={<TermsOfService />} />
                  <Route path="/cookies" element={<CookiePolicy />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/login" element={<Auth />} />
                  
                  {/* CEO COMMAND CENTER - Primary Landing for Owners */}
                  <Route path="/app" element={<ProtectedRoute requireOwner><CEOHome /></ProtectedRoute>} />
                  
                  {/* Client Portal - Restricted view for client role */}
                  <Route path="/app/portal" element={<ProtectedRoute requireClient><ClientPortal /></ProtectedRoute>} />
                  
                  {/* Onboarding - New user flow (AuthRouter handles routing) */}
                  <Route path="/app/onboarding" element={<ProtectedRoute><OnboardingConversation /></ProtectedRoute>} />
                  
                  {/* Decisions - Human approval surface */}
                  <Route path="/app/decisions" element={<ProtectedRoute requireOwner><DecisionsDashboard /></ProtectedRoute>} />
                  
                  {/* Capability Pages - Owner only (accessed from Intelligence Grid) */}
                  <Route path="/app/pipeline" element={<ProtectedRoute requireOwner><AdminPipeline /></ProtectedRoute>} />
                  <Route path="/app/inbox" element={<ProtectedRoute requireOwner><AdminInbox /></ProtectedRoute>} />
                  <Route path="/app/analytics" element={<ProtectedRoute requireOwner><AdminAnalytics /></ProtectedRoute>} />
                  <Route path="/app/billing" element={<ProtectedRoute requireOwner><AdminBilling /></ProtectedRoute>} />
                  <Route path="/app/content" element={<ProtectedRoute requireOwner><AdminContent /></ProtectedRoute>} />
                  <Route path="/app/clients" element={<ProtectedRoute requireOwner><AdminClients /></ProtectedRoute>} />
                  <Route path="/app/leads" element={<ProtectedRoute requireOwner><AdminLeads /></ProtectedRoute>} />
                  <Route path="/app/sequences" element={<ProtectedRoute requireOwner><AdminSequences /></ProtectedRoute>} />
                  <Route path="/app/crm" element={<ProtectedRoute requireOwner><AdminCRM /></ProtectedRoute>} />
                  <Route path="/app/contacts" element={<ProtectedRoute requireOwner><AdminContacts /></ProtectedRoute>} />
                  <Route path="/app/vault" element={<ProtectedRoute requireOwner><KnowledgeVault /></ProtectedRoute>} />
                  
                  {/* Settings & System - Owner only */}
                  <Route path="/app/settings" element={<ProtectedRoute requireOwner><AdminSettings /></ProtectedRoute>} />
                  <Route path="/app/health" element={<ProtectedRoute requireOwner><AdminSystemHealth /></ProtectedRoute>} />
                  <Route path="/app/audit" element={<ProtectedRoute requireOwner><AdminAudit /></ProtectedRoute>} />
                  <Route path="/app/help" element={<ProtectedRoute requireOwner><AdminHelp /></ProtectedRoute>} />
                  <Route path="/app/business-setup" element={<ProtectedRoute requireOwner><AdminBusinessSetup /></ProtectedRoute>} />
                  
                  {/* Platform Admin - Hidden */}
                  <Route path="/app/admin/tenants" element={<ProtectedRoute requireAdmin><AdminTenants /></ProtectedRoute>} />
                  
                  {/* Catch all - 404 */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </AuthRouter>
            </BrowserRouter>
          </VisitorProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </HelmetProvider>
  </ErrorBoundary>
);

export default App;
