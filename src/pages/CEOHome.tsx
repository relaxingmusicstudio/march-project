// src/pages/CEOHome.tsx
/**
 * PHASE 1 LOCK ?
 * - [LOCKED] Page renders without crashing
 * - [LOCKED] Helmet works because main.tsx provides <HelmetProvider>
 * - [TODO-P2] Mount CEO agent chat + onboarding panels once Phase 1 stable
 */

import React from "react";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useOnboardingStatus } from "@/hooks/useOnboardingStatus";
import { getOnboardingData } from "@/lib/onboarding";
import { useCEOAgent } from "@/hooks/useCEOAgent";
import { CEOPlan, computeOnboardingHash, loadCEOPlan, saveCEOPlan } from "@/lib/ceoPlan";
import { useEffect, useMemo, useState } from "react";

export default function CEOHome() {
  const { email, role, signOut } = useAuth();
  const { status, isOnboardingComplete } = useOnboardingStatus();
  const navigate = useNavigate();
  const context = getOnboardingData(undefined, email);
  const { askCEO, isLoading: agentLoading } = useCEOAgent();
  const [plan, setPlan] = useState<CEOPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(false);

  const hasContext =
    !!context.businessName ||
    !!context.industry ||
    !!context.serviceArea ||
    !!context.primaryGoal ||
    !!context.offerPricing;

  const onboardingHash = useMemo(() => computeOnboardingHash(undefined, email), [email, context]);

  useEffect(() => {
    const existing = loadCEOPlan(undefined, email);
    setPlan(existing);
  }, [email]);

  const handleGeneratePlan = async () => {
    setPlanLoading(true);
    const resp = await askCEO(
      "Generate a concise CEO plan using the provided onboarding context. Return markdown with sections: Goals, Offers, ICP, Lead Sources, Next 7 Days.",
      "30d",
      [],
      undefined,
      "generate_ceo_plan"
    );
    if (resp?.response) {
      const next: CEOPlan = {
        planMarkdown: resp.response,
        createdAt: plan?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        onboardingSnapshotHash: onboardingHash,
      };
      saveCEOPlan(next, undefined, email);
      setPlan(next);
    }
    setPlanLoading(false);
  };

  const planOutOfDate = plan && plan.onboardingSnapshotHash !== onboardingHash;

  return (
    <div data-testid="dashboard-home" style={{ padding: 24, fontFamily: "system-ui" }}>
      <Helmet>
        <title>PipelinePRO - CEO</title>
      </Helmet>

      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>CEO Home</h1>
      <div style={{ opacity: 0.8, marginBottom: 16 }}>
        Signed in as <b>{email ?? "unknown"}</b> - role: <b>{role}</b>
      </div>

      {status === "in_progress" && (
        <div
          style={{
            padding: 12,
            borderRadius: 10,
            border: "1px solid rgba(0,0,0,0.1)",
            background: "rgba(0,0,0,0.02)",
            marginBottom: 16,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Finish onboarding</div>
          <p style={{ marginBottom: 10, opacity: 0.8 }}>
            You started onboarding. Resume to finalize the CEO Agent setup.
          </p>
          <button
            data-testid="resume-onboarding"
            onClick={() => navigate("/app/onboarding")}
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid rgba(0,0,0,0.15)",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            Resume onboarding
          </button>
        </div>
      )}

      {isOnboardingComplete && (
        <div
          style={{
            padding: 16,
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.1)",
            background: "rgba(0,0,0,0.02)",
            marginBottom: 16,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontWeight: 800, fontSize: 16 }}>Business Context</div>
            {!hasContext && (
              <button
                onClick={() => navigate("/app/onboarding")}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid rgba(0,0,0,0.15)",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                Re-run onboarding
              </button>
            )}
          </div>
          {!hasContext && (
            <div style={{ marginBottom: 8, color: "#b7791f", fontWeight: 600 }}>
              Onboarding data is missing or incomplete. Re-run onboarding to fill it in.
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 8 }}>
            <ContextField label="Business name" value={context.businessName} />
            <ContextField label="Industry" value={context.industry} />
            <ContextField label="Service area" value={context.serviceArea} />
            <ContextField label="Primary goal" value={context.primaryGoal} />
            <ContextField label="Offer & pricing" value={context.offerPricing} />
          </div>
        </div>
      )}

      {isOnboardingComplete && (
        <div
          style={{
            padding: 16,
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.1)",
            background: "rgba(0,0,0,0.02)",
            marginBottom: 16,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontWeight: 800, fontSize: 16, display: "flex", gap: 8, alignItems: "center" }}>
              CEO Plan
              {planOutOfDate && (
                <span style={{ padding: "2px 8px", borderRadius: 999, background: "#fef3c7", color: "#92400e", fontSize: 12 }}>
                  Plan out of date
                </span>
              )}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={handleGeneratePlan}
                disabled={agentLoading || planLoading}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid rgba(0,0,0,0.15)",
                  cursor: "pointer",
                  fontWeight: 700,
                  opacity: agentLoading || planLoading ? 0.6 : 1,
                }}
              >
                {plan ? "Regenerate" : "Generate CEO Plan"}
              </button>
            </div>
          </div>
          {plan && (
            <div
              style={{
                border: "1px solid rgba(0,0,0,0.08)",
                borderRadius: 8,
                padding: 12,
                background: "white",
                whiteSpace: "pre-wrap",
                lineHeight: 1.5,
                fontFamily: "Inter, system-ui, sans-serif",
              }}
            >
              {plan.planMarkdown}
            </div>
          )}
          {!plan && (
            <div style={{ opacity: 0.7 }}>No plan generated yet. Use your onboarding data to draft a CEO action plan.</div>
          )}
        </div>
      )}

      <button
        data-testid="sign-out"
        onClick={() => signOut()}
        style={{
          padding: "10px 14px",
          borderRadius: 10,
          border: "1px solid rgba(0,0,0,0.15)",
          cursor: "pointer",
          fontWeight: 700,
        }}
      >
        Sign out
      </button>

      <button
        data-testid="go-integrations"
        onClick={() => navigate("/app/integrations")}
        style={{
          padding: "10px 14px",
          borderRadius: 10,
          border: "1px solid rgba(0,0,0,0.15)",
          cursor: "pointer",
          fontWeight: 700,
          marginLeft: 12,
        }}
      >
        Integrations
      </button>

      <hr style={{ margin: "24px 0", opacity: 0.2 }} />

      <div style={{ opacity: 0.85 }}>
        ? Phase 1: routing + auth + stability is the mission.  
        Next: we plug in the CEO Agent panel without breaking the app.
      </div>
    </div>
  );
}

const ContextField = ({ label, value }: { label: string; value?: string }) => (
  <div
    style={{
      padding: 10,
      borderRadius: 8,
      border: "1px solid rgba(0,0,0,0.1)",
      background: "white",
      minHeight: 64,
    }}
  >
    <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.4, opacity: 0.6 }}>{label}</div>
    <div style={{ fontWeight: 700, marginTop: 4 }}>{value || "—"}</div>
  </div>
);
