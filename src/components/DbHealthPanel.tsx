import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type CheckStatus = "pending" | "pass" | "fail";

type CheckState = {
  status: CheckStatus;
  detail?: string;
};

const statusVariant: Record<CheckStatus, "default" | "secondary" | "destructive"> = {
  pending: "secondary",
  pass: "default",
  fail: "destructive",
};

const statusLabel: Record<CheckStatus, string> = {
  pending: "PENDING",
  pass: "PASS",
  fail: "FAIL",
};

export default function DbHealthPanel() {
  const { userId } = useAuth();
  const [tableCheck, setTableCheck] = useState<CheckState>({ status: "pending" });
  const [roleCheck, setRoleCheck] = useState<CheckState>({ status: "pending" });

  useEffect(() => {
    let cancelled = false;

    const runChecks = async () => {
      setTableCheck({ status: "pending" });
      setRoleCheck({ status: "pending" });

      try {
        const { data, error } = await supabase.rpc("db_to_regclass", {
          p_name: "public.onboarding_state",
        });
        if (cancelled) return;
        if (error) {
          setTableCheck({ status: "fail", detail: error.message });
        } else {
          setTableCheck({
            status: data ? "pass" : "fail",
            detail: data ? String(data) : "null",
          });
        }
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setTableCheck({ status: "fail", detail: message });
      }

      if (!userId) {
        setRoleCheck({ status: "fail", detail: "no auth user" });
        return;
      }

      try {
        const { data, error } = await supabase.rpc("has_role", {
          role: "user",
          user_id: userId,
        });
        if (cancelled) return;
        if (error) {
          setRoleCheck({ status: "fail", detail: error.message });
        } else {
          setRoleCheck({
            status: data === true ? "pass" : "fail",
            detail: data === true ? "true" : "false",
          });
        }
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setRoleCheck({ status: "fail", detail: message });
      }
    };

    void runChecks();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return (
    <Card className="border-dashed border-muted-foreground/40 bg-muted/20">
      <CardHeader className="py-3">
        <CardTitle className="text-sm font-semibold">DB Health (dev)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <span>to_regclass(public.onboarding_state)</span>
          <div className="flex items-center gap-2">
            {tableCheck.status === "pending" && <Loader2 className="h-3 w-3 animate-spin" />}
            <Badge variant={statusVariant[tableCheck.status]}>{statusLabel[tableCheck.status]}</Badge>
          </div>
        </div>
        {tableCheck.detail && <div className="text-muted-foreground">{tableCheck.detail}</div>}

        <div className="flex items-center justify-between pt-2">
          <span>has_role("user", auth.uid())</span>
          <div className="flex items-center gap-2">
            {roleCheck.status === "pending" && <Loader2 className="h-3 w-3 animate-spin" />}
            <Badge variant={statusVariant[roleCheck.status]}>{statusLabel[roleCheck.status]}</Badge>
          </div>
        </div>
        {roleCheck.detail && <div className="text-muted-foreground">{roleCheck.detail}</div>}
      </CardContent>
    </Card>
  );
}
