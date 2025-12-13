// Visitor Intelligence & Behavioral Analytics System

export interface VisitorSession {
  visitorId: string;
  isReturning: boolean;
  visitCount: number;
  firstVisit: string;
  lastVisit: string;
  currentSessionStart: string;
  
  // Traffic Attribution
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  referrer: string;
  entryPage: string;
  landingUrl: string;
  
  // Device info
  device: 'mobile' | 'tablet' | 'desktop';
  browser: string;
  
  // Behavioral data
  pagesViewed: string[];
  sectionsViewed: string[];
  ctaClicks: string[];
  calculatorUsed: boolean;
  calculatorInputs: Record<string, string | number>;
  demoPlayed: boolean;
  demoWatchTime: number;
  scrollDepth: number;
  timeOnSite: number;
  chatbotOpened: boolean;
  chatbotEngaged: boolean;
  
  // Engagement metrics
  engagementScore: number;
  interestSignals: string[];
  behavioralIntent: string;
}

const STORAGE_KEYS = {
  VISITOR_ID: 'apex_visitor_id',
  FIRST_VISIT: 'apex_first_visit',
  VISIT_COUNT: 'apex_visit_count',
  LAST_VISIT: 'apex_last_visit',
  SESSION_DATA: 'apex_session_data',
};

// Generate or retrieve persistent visitor ID
export const getOrCreateVisitorId = (): string => {
  let visitorId = localStorage.getItem(STORAGE_KEYS.VISITOR_ID);
  if (!visitorId) {
    visitorId = `v_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem(STORAGE_KEYS.VISITOR_ID, visitorId);
    localStorage.setItem(STORAGE_KEYS.FIRST_VISIT, new Date().toISOString());
    localStorage.setItem(STORAGE_KEYS.VISIT_COUNT, '1');
  }
  return visitorId;
};

// Get device type
export const getDeviceType = (): 'mobile' | 'tablet' | 'desktop' => {
  const ua = navigator.userAgent;
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    return 'tablet';
  }
  if (/Mobile|iP(hone|od)|Android|BlackBerry|IEMobile|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
    return 'mobile';
  }
  return 'desktop';
};

// Get browser name
export const getBrowser = (): string => {
  const ua = navigator.userAgent;
  if (ua.includes('Chrome') && !ua.includes('Edg')) return 'Chrome';
  if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Edg')) return 'Edge';
  if (ua.includes('Opera') || ua.includes('OPR')) return 'Opera';
  return 'Unknown';
};

// Parse UTM parameters from URL
export const parseUTMParams = (): Record<string, string | null> => {
  const params = new URLSearchParams(window.location.search);
  return {
    utmSource: params.get('utm_source'),
    utmMedium: params.get('utm_medium'),
    utmCampaign: params.get('utm_campaign'),
    utmContent: params.get('utm_content'),
    utmTerm: params.get('utm_term'),
  };
};

// Initialize or update visit tracking
export const initializeVisitTracking = (): { isReturning: boolean; visitCount: number; firstVisit: string; lastVisit: string } => {
  const now = new Date().toISOString();
  const firstVisit = localStorage.getItem(STORAGE_KEYS.FIRST_VISIT) || now;
  const lastVisit = localStorage.getItem(STORAGE_KEYS.LAST_VISIT) || now;
  let visitCount = parseInt(localStorage.getItem(STORAGE_KEYS.VISIT_COUNT) || '1', 10);
  
  // Check if this is a new session (more than 30 minutes since last visit)
  const lastVisitTime = new Date(lastVisit).getTime();
  const timeSinceLastVisit = Date.now() - lastVisitTime;
  const isNewSession = timeSinceLastVisit > 30 * 60 * 1000; // 30 minutes
  
  if (isNewSession && localStorage.getItem(STORAGE_KEYS.VISITOR_ID)) {
    visitCount += 1;
    localStorage.setItem(STORAGE_KEYS.VISIT_COUNT, visitCount.toString());
  }
  
  localStorage.setItem(STORAGE_KEYS.LAST_VISIT, now);
  
  return {
    isReturning: visitCount > 1,
    visitCount,
    firstVisit,
    lastVisit: now,
  };
};

// Calculate engagement score based on behavior
export const calculateEngagementScore = (session: Partial<VisitorSession>): number => {
  let score = 0;
  
  // Visit frequency (max 25 points)
  if (session.isReturning) score += 15;
  if ((session.visitCount || 0) >= 3) score += 10;
  
  // Traffic quality (max 15 points)
  if (session.utmSource === 'google') score += 5;
  if (session.utmMedium === 'cpc') score += 10;
  else if (session.utmMedium === 'organic') score += 5;
  
  // Content engagement (max 30 points)
  if (session.calculatorUsed) score += 15;
  if (session.demoPlayed) score += 10;
  if ((session.demoWatchTime || 0) > 30) score += 5;
  
  // Scroll & time (max 15 points)
  if ((session.scrollDepth || 0) > 75) score += 8;
  else if ((session.scrollDepth || 0) > 50) score += 5;
  if ((session.timeOnSite || 0) > 120) score += 5; // 2+ minutes
  if ((session.timeOnSite || 0) > 300) score += 2; // 5+ minutes
  
  // Sections viewed (max 15 points)
  const sections = session.sectionsViewed || [];
  if (sections.includes('pricing')) score += 8;
  if (sections.includes('contact')) score += 5;
  if (sections.includes('calculator')) score += 2;
  
  // Chatbot engagement (max 15 points)
  if (session.chatbotOpened) score += 5;
  if (session.chatbotEngaged) score += 10;
  
  return Math.min(score, 100);
};

// Determine behavioral intent based on actions
export const determineBehavioralIntent = (session: Partial<VisitorSession>): string => {
  const sections = session.sectionsViewed || [];
  const ctaClicks = session.ctaClicks || [];
  const engagementScore = session.engagementScore || 0;
  
  // High Intent indicators
  if (
    (sections.includes('pricing') && sections.includes('contact')) ||
    ctaClicks.some(c => c.includes('pricing') || c.includes('contact') || c.includes('get-started')) ||
    session.chatbotEngaged ||
    engagementScore >= 70
  ) {
    return 'High Intent - Ready to Buy';
  }
  
  // Medium Intent indicators
  if (
    session.calculatorUsed ||
    session.demoPlayed ||
    sections.includes('pricing') ||
    engagementScore >= 40
  ) {
    return 'Medium Intent - Actively Researching';
  }
  
  // Low Intent
  if (sections.length <= 2 && (session.timeOnSite || 0) < 60) {
    return 'Low Intent - Just Browsing';
  }
  
  return 'Moderate Intent - Exploring Options';
};

// Get interest signals based on behavior
export const getInterestSignals = (session: Partial<VisitorSession>): string[] => {
  const signals: string[] = [];
  const sections = session.sectionsViewed || [];
  const ctaClicks = session.ctaClicks || [];
  
  if (session.isReturning) signals.push('Returning Visitor');
  if ((session.visitCount || 0) >= 3) signals.push('Multiple Visits');
  if (session.calculatorUsed) signals.push('Used Calculator');
  if (session.demoPlayed) signals.push('Watched Demo');
  if ((session.demoWatchTime || 0) > 60) signals.push('Watched Full Demo');
  if (sections.includes('pricing')) signals.push('Viewed Pricing');
  if (sections.includes('contact')) signals.push('Viewed Contact');
  if (sections.includes('faq')) signals.push('Read FAQs');
  if ((session.scrollDepth || 0) > 80) signals.push('Deep Page Scroll');
  if ((session.timeOnSite || 0) > 180) signals.push('3+ Min on Site');
  if (session.chatbotEngaged) signals.push('Engaged with Chatbot');
  if (ctaClicks.length > 2) signals.push('Multiple CTA Clicks');
  if (session.utmMedium === 'cpc') signals.push('Paid Traffic');
  
  return signals;
};

// Format session for sending to GHL
export const formatSessionForGHL = (session: VisitorSession) => {
  return {
    // Visitor Identity
    visitor_id: session.visitorId,
    is_returning_visitor: session.isReturning ? 'YES' : 'NO',
    visit_count: session.visitCount.toString(),
    first_visit_date: session.firstVisit,
    last_visit_date: session.lastVisit,
    
    // Traffic Attribution
    utm_source: session.utmSource || '',
    utm_medium: session.utmMedium || '',
    utm_campaign: session.utmCampaign || '',
    utm_content: session.utmContent || '',
    utm_term: session.utmTerm || '',
    referrer_source: session.referrer || 'Direct',
    landing_page: session.landingUrl || window.location.href,
    entry_page: session.entryPage || window.location.pathname,
    
    // Device Info
    device_type: session.device,
    browser: session.browser,
    
    // Behavioral Data
    pages_viewed: session.pagesViewed.join(', ') || 'Homepage',
    sections_viewed: session.sectionsViewed.join(', ') || 'None',
    cta_clicks: session.ctaClicks.join(', ') || 'None',
    calculator_used: session.calculatorUsed ? 'YES' : 'NO',
    demo_watched: session.demoPlayed ? 'YES' : 'NO',
    demo_watch_time: `${Math.round(session.demoWatchTime || 0)}s`,
    scroll_depth: `${Math.round(session.scrollDepth || 0)}%`,
    time_on_site: `${Math.round((session.timeOnSite || 0) / 60)}min ${Math.round((session.timeOnSite || 0) % 60)}s`,
    chatbot_opened: session.chatbotOpened ? 'YES' : 'NO',
    chatbot_engaged: session.chatbotEngaged ? 'YES' : 'NO',
    
    // Engagement Analysis
    engagement_score: session.engagementScore.toString(),
    interest_signals: session.interestSignals.join(', ') || 'None',
    behavioral_intent: session.behavioralIntent,
  };
};

// Save session to localStorage
export const saveSession = (session: VisitorSession): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.SESSION_DATA, JSON.stringify(session));
  } catch (e) {
    console.error('Failed to save session:', e);
  }
};

// Load session from localStorage
export const loadSession = (): VisitorSession | null => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.SESSION_DATA);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    console.error('Failed to load session:', e);
    return null;
  }
};
