# ApexLocal360 HVAC AI Voice Agent - Deployment Guide

## 🎯 Production Readiness Checklist

### ✅ Phase 1: Security Hardening (COMPLETE)
- [x] Auth configuration (auto-confirm email enabled)
- [x] Anonymous sign-ups disabled
- [x] RLS policies on all sensitive tables:
  - `clients`, `leads`, `bank_transactions`, `client_invoices`
  - `client_payments`, `bank_connections`, `contacts_unified`
- [x] Server-side validation utilities (`_shared/validation.ts`)
- [x] Audit logging infrastructure (`_shared/auditLogger.ts`)

### ✅ Phase 2: Audit Trail (COMPLETE)
- [x] LLM Gateway audit logging
- [x] CEO Agent audit logging
- [x] Billing Agent audit logging
- [x] Finance Agent audit logging
- [x] Stripe Webhook audit logging
- [x] Multi-Agent Coordinator audit logging
- [x] Compliance Engine audit logging
- [x] Client Lifecycle audit logging
- [x] SMS Blast audit logging
- [x] Cold Outreach audit logging
- [x] Messaging Send audit logging
- [x] Infrastructure Agent audit logging
- [x] Pattern Detector audit logging
- [x] Lead-to-Client audit logging
- [x] Twilio Webhook audit logging

### ✅ Phase 3: Operational Completion (COMPLETE)
- [x] Profiles table with RLS for user metadata
- [x] Auto-profile creation on signup trigger
- [x] LLM Gateway circuit breaker pattern for failover

### ⚠️ Manual Steps Required
- [ ] **Enable Leaked Password Protection** (Supabase Dashboard → Auth → Security)

---

## 🔐 Required Secrets

Configure these in Lovable Cloud → Secrets before deployment:

| Secret Name | Description | Required |
|-------------|-------------|----------|
| `VAPI_API_KEY` | Vapi.ai API key for voice agent | ✅ |
| `VAPI_PUBLIC_KEY` | Vapi.ai public key for client-side | ✅ |
| `STRIPE_SECRET_KEY` | Stripe API secret key | ✅ |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | ✅ |
| `RESEND_API_KEY` | Resend email service API key | ✅ |
| `ELEVENLABS_API_KEY` | ElevenLabs voice synthesis | Optional |
| `DID_API_KEY` | D-ID video generation | Optional |
| `GHL_WEBHOOK_URL` | GoHighLevel webhook endpoint | Optional |
| `GEMINI_API_KEY` | Google Gemini AI key | ✅ |
| `OPENAI_API_KEY` | OpenAI API key (premium tier) | Optional |
| `AI_PROVIDER` | Default AI provider (`gemini`) | Optional |
| `AI_MODEL_DEFAULT` | Default model (`gemini-2.0-flash`) | Optional |
| `AI_PROVIDER_PREMIUM` | Premium provider (`openai`) | Optional |
| `AI_MODEL_PREMIUM` | Premium model (`gpt-4o-mini`) | Optional |
| `AI_PREMIUM_ACTIONS` | CSV of premium purposes | Optional |
| `VAULT_ENCRYPTION_KEY` | 32-byte AES key for credential vault | Production Only |

### Generating VAULT_ENCRYPTION_KEY (Production)
```bash
openssl rand -base64 32
```
**Note:** Development uses auto-generated key derived from service role. For production, set an external key for security.

---

## 🏠 HVAC Industry Customization Checklist

### Content Updates (from Knowledge Base)

#### 1. Global Find/Replace
```
plumber → HVAC technician
plumbers → HVAC technicians  
plumbing → HVAC
Plumber → HVAC Technician
Plumbing → HVAC
pipe → system
drain → unit
ApexLocal360 → [YOUR_COMPANY_NAME]
```

#### 2. Key Statistics to Include
- Total Market Value: $156.2 billion
- Average Repair Cost: $351 (range: $243-$1,567)
- Customer Lifetime Value: $15,340
- Missed Call Rate: 27% (industry average)
- Voicemail Abandonment: 80% call competitor
- Technician Shortage: 110,000 workers needed

#### 3. Files to Update
- [ ] `src/pages/Index.tsx` - SEO meta tags
- [ ] `src/components/HeroSection.tsx` - Headlines
- [ ] `src/components/VoiceDemo.tsx` - HVAC scenarios
- [ ] `src/components/RevenueCalculator.tsx` - $351 default job value
- [ ] `src/components/FAQSection.tsx` - HVAC Q&As
- [ ] `supabase/functions/alex-chat/index.ts` - AI system prompt
- [ ] `src/data/blogPosts.ts` - HVAC articles

#### 4. User Placeholders to Configure
```
[MY_COMPANY_NAME] = Business name
[STRIPE_STARTER_LINK] = Payment link for Starter tier
[STRIPE_GROWTH_LINK] = Payment link for Growth tier
[STRIPE_SCALE_LINK] = Payment link for Scale tier
[VAPI_ASSISTANT_ID] = Trained HVAC voice agent ID
[GHL_CONTACT_WEBHOOK] = Contact form endpoint
[GHL_PLAYBOOK_WEBHOOK] = Lead magnet endpoint
```

---

## 📦 File Upload Requirements

After code customization, upload these assets:

| File | Destination | Purpose |
|------|-------------|---------|
| HVAC-Playbook.pdf | `public/` | Lead magnet download |
| hvac-playbook-cover.png | `src/assets/` | Playbook cover image |
| alex-avatar.png | `public/` | AI agent avatar (optional) |

---

## 🚀 Deployment Workflow

### Development → Staging
1. Make changes in Lovable editor
2. Test in preview mode
3. Verify all integrations work

### Staging → Production
1. Click "Publish" in Lovable
2. Connect custom domain (Settings → Domains)
3. Verify SSL certificate is active
4. Test all critical user flows:
   - Voice demo playback
   - Contact form submission
   - Lead magnet download
   - Pricing page links

### Post-Launch Monitoring
1. Check audit logs in `platform_audit_log` table
2. Monitor LLM costs in `ai_cost_log` table
3. Review circuit breaker triggers in edge function logs
4. Set up alerts for failed payments (Stripe dashboard)

---

## 🔧 Scheduled Jobs (Cron Functions)

These functions may need cron triggers for automation:

| Function | Suggested Schedule | Purpose |
|----------|-------------------|---------|
| `ceo-daily-briefing` | Daily 7:00 AM | CEO morning report |
| `client-health-score` | Every 6 hours | Update client health metrics |
| `lead-score-refresher` | Every hour | Refresh lead scores |
| `pattern-detector` | Every 15 minutes | Detect system anomalies |
| `credential-health-monitor` | Every 15 minutes | Check integration credentials |
| `auto-dunning` (billing-agent) | Daily 9:00 AM | Payment reminders |

To configure cron jobs, use the SQL editor in Supabase:
```sql
select cron.schedule(
  'daily-ceo-briefing',
  '0 7 * * *',
  $$
  select net.http_post(
    url:='https://[PROJECT_ID].supabase.co/functions/v1/ceo-daily-briefing',
    headers:='{"Authorization": "Bearer [ANON_KEY]"}'::jsonb,
    body:='{}'::jsonb
  );
  $$
);
```

---

## 📊 ROI Calculator Defaults (HVAC)

Pre-configured for HVAC industry metrics:
- Average Job Value: $351
- Monthly Call Volume: 80
- Missed Call Rate: 27%
- Monthly Revenue Leak: $7,581.60
- Break-even: 1-3 captured jobs

---

## 🆘 Troubleshooting

### Voice Agent Not Responding
1. Verify `VAPI_API_KEY` is configured
2. Check VAPI dashboard for assistant status
3. Review edge function logs for errors

### Payments Not Processing
1. Verify Stripe secret key is correct
2. Check webhook endpoint is accessible
3. Review `stripe-webhook` function logs

### Emails Not Sending
1. Verify `RESEND_API_KEY` is configured
2. Check sender domain is verified in Resend
3. Review `messaging-send` function logs

### Database Access Issues
1. Verify RLS policies are not blocking access
2. Check user has correct role assignment
3. Review `platform_audit_log` for failed operations

---

## ✅ Final Verification

Before going live, verify:
- [ ] All secrets are configured
- [ ] Custom domain is connected and SSL active
- [ ] Voice agent responds correctly
- [ ] Contact form submissions work
- [ ] Payment links redirect to correct Stripe checkout
- [ ] Lead magnet download works
- [ ] Mobile responsiveness is good
- [ ] SEO meta tags are updated
- [ ] Analytics tracking is active

---

## ℹ️ About Legacy Gateway References in Migrations

The `supabase/migrations/` folder contains historical seed data that references the old Lovable AI gateway (`ai.gateway.lovable.dev`) and `LOVABLE_API_KEY`. These are **immutable migration files** and cannot be modified.

**Important:** Runtime code does NOT use the gateway. All edge functions call `aiChat()` from `supabase/functions/_shared/ai.ts`, which routes directly to Gemini (`generativelanguage.googleapis.com`) or OpenAI (`api.openai.com`) based on environment configuration.

### Verifying Runtime Status

To confirm no runtime code uses the legacy gateway, run these searches excluding migrations and this doc file (to avoid self-matching):

```bash
# Should return 0 matches
rg -n "ai\.gateway\.lovable\.dev" --glob "!supabase/migrations/**" --glob "!DEPLOYMENT.md" .

# Should return 0 matches  
rg -n "LOVABLE_API_KEY" --glob "!supabase/migrations/**" --glob "!DEPLOYMENT.md" .
```

> **Note:** If auditing runtime usage, exclude this documentation file to avoid self-matching on the explanatory text above.

### AI Provider Configuration

All AI calls are configured via environment variables (see Required Secrets above):
- `GEMINI_API_KEY` - Required for default Gemini provider
- `OPENAI_API_KEY` - Optional for premium routing
- `AI_PROVIDER`, `AI_MODEL_DEFAULT` - Default routing config
- `AI_PROVIDER_PREMIUM`, `AI_MODEL_PREMIUM`, `AI_PREMIUM_ACTIONS` - Premium routing config
