import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// The 7 strategies content for the lead magnet
const leadMagnetContent = {
  title: "7 Ways to Generate More Local Plumbing Leads",
  subtitle: "Proven strategies that top plumbers use to fill their calendars with high-paying jobs",
  strategies: [
    {
      number: 1,
      title: "Never Miss Another Call with 24/7 AI Dispatching",
      content: `The average plumber misses 40% of incoming calls. That's money walking out the door every single day. When a homeowner has a burst pipe at 2 AM, they're not leaving a voicemail—they're calling your competitor.

**The Solution:** Implement an AI-powered phone system that answers every call instantly, 24/7/365. Modern AI dispatchers can:
- Answer calls in under 2 seconds
- Qualify leads and book appointments
- Handle emergency dispatching
- Upsell additional services

**Real Results:** Plumbers using AI dispatching report 35-50% more booked jobs within the first month.`
    },
    {
      number: 2,
      title: "Dominate Google Maps with Strategic Reviews",
      content: `93% of consumers read online reviews before hiring a service provider. Your Google Business Profile is your most valuable free marketing asset.

**Action Steps:**
- Ask for reviews at the moment of maximum satisfaction (right after completing a job)
- Respond to every review within 24 hours
- Include photos of completed work in your responses
- Use review management software to automate follow-ups

**Pro Tip:** Aim for 5+ new reviews per week. Businesses with 50+ reviews get 266% more leads than those with fewer.`
    },
    {
      number: 3,
      title: "Build a Referral Engine That Runs on Autopilot",
      content: `Word-of-mouth referrals convert 4x better than any other lead source. The problem? Most plumbers leave referrals to chance.

**Systemize Your Referrals:**
- Offer a $50 credit for every referral that books
- Send thank-you cards with referral cards included
- Create a "VIP Club" for repeat customers
- Partner with realtors, property managers, and contractors

**Expected ROI:** A proper referral system should generate 20-30% of your new business within 6 months.`
    },
    {
      number: 4,
      title: "Target Emergency Keywords in Local SEO",
      content: `When someone searches "emergency plumber near me," they're ready to pay premium prices. These high-intent keywords are gold.

**Focus On:**
- "Emergency plumber [your city]"
- "24 hour plumber near me"
- "Same day plumbing service"
- "Burst pipe repair [your city]"

**Quick Win:** Create dedicated landing pages for each emergency service. Include your phone number prominently and enable click-to-call on mobile.`
    },
    {
      number: 5,
      title: "Convert Website Visitors with Live Chat",
      content: `78% of customers buy from the first business that responds. A live chat or AI chatbot on your website captures leads while you're on the job.

**Best Practices:**
- Greet visitors within 10 seconds
- Qualify leads with 3-4 simple questions
- Offer instant appointment booking
- Capture contact info for follow-up

**The Numbers:** Websites with chat convert 40% more visitors into leads.`
    },
    {
      number: 6,
      title: "Run Hyper-Local Facebook Ads",
      content: `Facebook lets you target homeowners within a 5-mile radius of your service area. This precision targeting means every dollar works harder.

**Winning Ad Strategy:**
- Target homeowners aged 35-65
- Use before/after photos of your work
- Highlight emergency availability
- Include a clear call-to-action

**Budget Tip:** Start with $10-20/day and scale what works. Track cost-per-lead religiously.`
    },
    {
      number: 7,
      title: "Follow Up Like Your Business Depends On It",
      content: `80% of sales require 5+ follow-ups, but most plumbers give up after one. The money is in the follow-up.

**Create a Follow-Up System:**
- Day 1: Thank-you text/email
- Day 3: Check-in call
- Week 2: Maintenance reminder
- Month 3: Seasonal service offer

**Automation is Key:** Use a CRM or AI assistant to handle follow-ups automatically. You should be fixing pipes, not chasing paperwork.`
    }
  ],
  conclusion: `These 7 strategies work together as a complete lead generation system. Start with #1 (never miss a call) and #2 (reviews), then layer in the others as you grow.

**Ready to 10x Your Leads?**

The fastest way to implement strategy #1 is with an AI-powered dispatcher that works 24/7, books appointments, and never takes a sick day.

Visit ServiceAgentAI.com to see it in action.`
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();
    
    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log the lead capture
    console.log(`Lead captured: ${email}`);

    // Return the content (in a real scenario, you'd also:
    // 1. Save the email to a database/CRM
    // 2. Trigger an email with the PDF attachment
    // 3. Add to email marketing list)
    
    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Lead captured successfully',
        content: leadMagnetContent
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
