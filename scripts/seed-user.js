import { createClient } from "@supabase/supabase-js";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const REQUIRED_ENV = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
const missing = REQUIRED_ENV.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error("[seed:user] missing env:", missing.join(", "));
  process.exit(1);
}

const email = "apexlocal360@gmail.com";
const password = "Beagles#11";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const ensureUser = async () => {
  const { data: listData, error: listError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });

  if (listError) {
    console.error("[seed:user] listUsers failed:", listError.message);
    process.exit(1);
  }

  const existing = listData?.users?.find((user) => user.email?.toLowerCase() === email.toLowerCase());
  if (existing) {
    const { error } = await supabase.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
    });
    if (error) {
      console.error("[seed:user] updateUser failed:", error.message);
      process.exit(1);
    }
    console.log(`[seed:user] updated ${existing.id}`);
    return;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error || !data?.user?.id) {
    console.error("[seed:user] createUser failed:", error?.message ?? "unknown");
    process.exit(1);
  }

  console.log(`[seed:user] created ${data.user.id}`);
};

ensureUser().catch((error) => {
  console.error("[seed:user] failed:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
