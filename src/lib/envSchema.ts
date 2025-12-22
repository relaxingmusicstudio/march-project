export type EnvScope = "client" | "server";
export type EnvRequiredFor = "mock" | "live" | "both";

export interface EnvVarSpec {
  name: string;
  scope: EnvScope;
  requiredFor: EnvRequiredFor;
  description: string;
  validate?: (value: string) => boolean;
  usedBy: string[];
}

const prefixCheck = (value: string, prefixes: string[]) =>
  prefixes.some((p) => value?.startsWith(p));

export const envSchema: EnvVarSpec[] = [
  {
    name: "SUPABASE_URL",
    scope: "client",
    requiredFor: "live",
    description: "Supabase project URL (public)",
    usedBy: ["supabase client", "edge functions"],
  },
  {
    name: "SUPABASE_ANON_KEY",
    scope: "client",
    requiredFor: "live",
    description: "Supabase anon key (public)",
    usedBy: ["supabase client"],
  },
  {
    name: "OPENAI_API_KEY",
    scope: "server",
    requiredFor: "live",
    description: "OpenAI key (server-only)",
    validate: (v) => prefixCheck(v, ["sk-", "sk-proj-"]),
    usedBy: ["llm-gateway"],
  },
  {
    name: "GEMINI_API_KEY",
    scope: "server",
    requiredFor: "live",
    description: "Gemini key (server-only)",
    validate: (v) => prefixCheck(v, ["AI", "AIza", "GEMINI"]),
    usedBy: ["llm-gateway"],
  },
  {
    name: "LLM_ALLOW_DEMO_KEYS",
    scope: "server",
    requiredFor: "both",
    description: "Enable server-held demo keys (optional)",
    usedBy: ["llm-gateway"],
  },
  {
    name: "TWILIO_ACCOUNT_SID",
    scope: "server",
    requiredFor: "live",
    description: "Twilio account SID",
    validate: (v) => prefixCheck(v, ["AC"]),
    usedBy: ["notify-gateway"],
  },
  {
    name: "TWILIO_AUTH_TOKEN",
    scope: "server",
    requiredFor: "live",
    description: "Twilio auth token",
    usedBy: ["notify-gateway"],
  },
  {
    name: "TWILIO_FROM_NUMBER",
    scope: "server",
    requiredFor: "live",
    description: "Twilio sending number (E.164)",
    usedBy: ["notify-gateway"],
  },
  {
    name: "RESEND_API_KEY",
    scope: "server",
    requiredFor: "live",
    description: "Resend API key",
    usedBy: ["notify-gateway"],
  },
  {
    name: "EMAIL_FROM",
    scope: "server",
    requiredFor: "live",
    description: "Verified sender email",
    usedBy: ["notify-gateway"],
  },
  {
    name: "STRIPE_SECRET_KEY",
    scope: "server",
    requiredFor: "live",
    description: "Stripe secret (server-only)",
    validate: (v) => prefixCheck(v, ["sk_test_", "sk_live_"]),
    usedBy: ["billing future"],
  },
  {
    name: "STRIPE_WEBHOOK_SECRET",
    scope: "server",
    requiredFor: "live",
    description: "Stripe webhook signing secret",
    validate: (v) => prefixCheck(v, ["whsec_"]),
    usedBy: ["billing future"],
  },
  {
    name: "VITE_STRIPE_PUBLISHABLE_KEY",
    scope: "client",
    requiredFor: "live",
    description: "Stripe publishable key (client-safe)",
    validate: (v) => prefixCheck(v, ["pk_test_", "pk_live_"]),
    usedBy: ["billing future"],
  },
  {
    name: "VITE_MOCK_AUTH",
    scope: "client",
    requiredFor: "both",
    description: "Mock mode toggle for local/CI",
    validate: (v) => v === "true" || v === "false",
    usedBy: ["mock auth", "proofgate"],
  },
];
