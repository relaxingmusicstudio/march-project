import { HelmetProvider } from "react-helmet-async";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { VisitorProvider } from "@/contexts/VisitorContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Blog from "./pages/Blog";
import BlogPost from "./pages/BlogPost";
import Auth from "./pages/Auth";
import AdminAnalytics from "./pages/AdminAnalytics";
import AdminInbox from "./pages/AdminInbox";
import AdminContacts from "./pages/AdminContacts";
import AdminSequences from "./pages/AdminSequences";
import CEOConsole from "./pages/CEOConsole";
import AdminSettings from "./pages/AdminSettings";
import AdminContent from "./pages/AdminContent";
import AdminSocial from "./pages/AdminSocial";
import AdminAds from "./pages/AdminAds";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <VisitorProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/blog" element={<Blog />} />
              <Route path="/blog/:slug" element={<BlogPost />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/admin/analytics" element={<ProtectedRoute requireAdmin><AdminAnalytics /></ProtectedRoute>} />
              <Route path="/admin/ceo" element={<ProtectedRoute requireAdmin><CEOConsole /></ProtectedRoute>} />
              <Route path="/admin/inbox" element={<ProtectedRoute requireAdmin><AdminInbox /></ProtectedRoute>} />
              <Route path="/admin/contacts" element={<ProtectedRoute requireAdmin><AdminContacts /></ProtectedRoute>} />
              <Route path="/admin/sequences" element={<ProtectedRoute requireAdmin><AdminSequences /></ProtectedRoute>} />
              <Route path="/admin/settings" element={<ProtectedRoute requireAdmin><AdminSettings /></ProtectedRoute>} />
              <Route path="/admin/content" element={<ProtectedRoute requireAdmin><AdminContent /></ProtectedRoute>} />
              <Route path="/admin/social" element={<ProtectedRoute requireAdmin><AdminSocial /></ProtectedRoute>} />
              <Route path="/admin/ads" element={<ProtectedRoute requireAdmin><AdminAds /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </VisitorProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
