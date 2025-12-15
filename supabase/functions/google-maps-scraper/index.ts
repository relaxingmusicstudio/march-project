import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ScrapeRequest {
  action: "scrape" | "get_prospects" | "update_prospect" | "detect_phone_type";
  query?: string;
  location?: string;
  radius_miles?: number;
  limit?: number;
  prospect_id?: string;
  updates?: Record<string, unknown>;
  phone_number?: string;
}

// Phone type detection using Twilio Lookup API
async function detectPhoneType(phoneNumber: string): Promise<{
  phone_type: string;
  carrier_name: string | null;
  is_mobile: boolean;
}> {
  const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const twilioAuth = Deno.env.get("TWILIO_AUTH_TOKEN");

  if (!twilioSid || !twilioAuth) {
    console.log("[google-maps-scraper] Twilio not configured, defaulting to unknown");
    return { phone_type: "unknown", carrier_name: null, is_mobile: false };
  }

  try {
    // Clean phone number
    const cleanPhone = phoneNumber.replace(/\D/g, "");
    const formattedPhone = cleanPhone.startsWith("1") ? `+${cleanPhone}` : `+1${cleanPhone}`;

    const lookupUrl = `https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(formattedPhone)}?Fields=line_type_intelligence`;
    
    const response = await fetch(lookupUrl, {
      headers: {
        "Authorization": `Basic ${btoa(`${twilioSid}:${twilioAuth}`)}`,
      },
    });

    if (!response.ok) {
      console.error("[google-maps-scraper] Twilio lookup failed:", response.status);
      return { phone_type: "unknown", carrier_name: null, is_mobile: false };
    }

    const data = await response.json();
    const lineType = data.line_type_intelligence?.type || "unknown";
    const carrierName = data.line_type_intelligence?.carrier_name || null;
    const isMobile = ["mobile", "voip"].includes(lineType.toLowerCase());

    console.log(`[google-maps-scraper] Phone ${formattedPhone}: ${lineType} (${carrierName})`);

    return {
      phone_type: lineType,
      carrier_name: carrierName,
      is_mobile: isMobile,
    };
  } catch (error) {
    console.error("[google-maps-scraper] Phone type detection error:", error);
    return { phone_type: "unknown", carrier_name: null, is_mobile: false };
  }
}

// Simulated Google Maps scraping (would use Firecrawl or similar in production)
async function scrapeGoogleMaps(query: string, location: string, radiusMiles: number, limit: number) {
  const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
  
  console.log(`[google-maps-scraper] Scraping: "${query}" near "${location}" (${radiusMiles}mi radius, limit ${limit})`);

  // In production, this would use Firecrawl or a Maps API
  // For now, we'll create structured mock data that demonstrates the flow
  const mockBusinesses = [
    {
      business_name: `${query} Pro Services`,
      phone: "+15551234567",
      website: `https://${query.toLowerCase().replace(/\s/g, "")}-pro.com`,
      address: `123 Main St, ${location}`,
      latitude: 40.7128,
      longitude: -74.0060,
      rating: 4.5,
      review_count: 127,
      business_hours: { monday: "8AM-6PM", tuesday: "8AM-6PM" },
      categories: [query, "Local Services"],
    },
    {
      business_name: `${location} ${query} Experts`,
      phone: "+15559876543",
      website: null,
      address: `456 Oak Ave, ${location}`,
      latitude: 40.7138,
      longitude: -74.0070,
      rating: 4.2,
      review_count: 89,
      business_hours: { monday: "7AM-5PM" },
      categories: [query],
    },
  ];

  // Detect phone types for all businesses
  const businessesWithPhoneTypes = await Promise.all(
    mockBusinesses.slice(0, limit).map(async (business) => {
      if (business.phone) {
        const phoneInfo = await detectPhoneType(business.phone);
        return {
          ...business,
          phone_type: phoneInfo.phone_type,
          carrier_name: phoneInfo.carrier_name,
          sms_capable: phoneInfo.is_mobile,
        };
      }
      return { ...business, phone_type: "unknown", carrier_name: null, sms_capable: false };
    })
  );

  return businessesWithPhoneTypes;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body: ScrapeRequest = await req.json();
    const { action } = body;

    console.log(`[google-maps-scraper] Action: ${action}`);

    // Action: Detect phone type for a single number
    if (action === "detect_phone_type") {
      if (!body.phone_number) {
        return new Response(
          JSON.stringify({ error: "phone_number required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const phoneInfo = await detectPhoneType(body.phone_number);
      return new Response(
        JSON.stringify({ success: true, ...phoneInfo }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: Scrape Google Maps
    if (action === "scrape") {
      const query = body.query || "HVAC contractors";
      const location = body.location || "Austin, TX";
      const radiusMiles = body.radius_miles || 25;
      const limit = body.limit || 50;

      const businesses = await scrapeGoogleMaps(query, location, radiusMiles, limit);

      // Insert into scraped_prospects
      const prospects = businesses.map((biz) => ({
        source_type: "google_maps",
        source_query: query,
        source_location: location,
        business_name: biz.business_name,
        phone: biz.phone,
        phone_type: biz.phone_type,
        sms_capable: biz.sms_capable,
        website: biz.website,
        address: biz.address,
        latitude: biz.latitude,
        longitude: biz.longitude,
        rating: biz.rating,
        review_count: biz.review_count,
        business_hours: biz.business_hours,
        categories: biz.categories,
        scraped_at: new Date().toISOString(),
        status: "new",
        priority_score: calculatePriorityScore(biz),
      }));

      const { data: inserted, error } = await supabase
        .from("scraped_prospects")
        .upsert(prospects, { onConflict: "phone" })
        .select();

      if (error) {
        console.error("[google-maps-scraper] Insert error:", error);
        throw error;
      }

      console.log(`[google-maps-scraper] Inserted ${inserted?.length || 0} prospects`);

      return new Response(
        JSON.stringify({
          success: true,
          scraped_count: businesses.length,
          inserted_count: inserted?.length || 0,
          prospects: inserted,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: Get prospects with filters
    if (action === "get_prospects") {
      let query = supabase
        .from("scraped_prospects")
        .select("*")
        .order("priority_score", { ascending: false });

      if (body.limit) {
        query = query.limit(body.limit);
      }

      const { data, error } = await query;

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, prospects: data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: Update prospect
    if (action === "update_prospect") {
      if (!body.prospect_id || !body.updates) {
        return new Response(
          JSON.stringify({ error: "prospect_id and updates required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data, error } = await supabase
        .from("scraped_prospects")
        .update(body.updates)
        .eq("id", body.prospect_id)
        .select()
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, prospect: data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[google-maps-scraper] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Calculate priority score based on business signals
function calculatePriorityScore(business: Record<string, unknown>): number {
  let score = 50;

  // SMS capability is crucial
  if (business.sms_capable) score += 20;

  // Good ratings indicate established business
  const rating = business.rating as number || 0;
  if (rating >= 4.5) score += 15;
  else if (rating >= 4.0) score += 10;
  else if (rating < 3.0) score -= 10;

  // Review count indicates business activity
  const reviews = business.review_count as number || 0;
  if (reviews >= 100) score += 15;
  else if (reviews >= 50) score += 10;
  else if (reviews < 10) score -= 5;

  // No website = might need our help more
  if (!business.website) score += 5;

  return Math.min(100, Math.max(0, score));
}
