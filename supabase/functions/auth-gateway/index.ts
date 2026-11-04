import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status, headers: { ...cors, "Content-Type": "application/json" },
  });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !service) return json({ error: "Authentication service is not configured." }, 503);
  const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });

  try {
    const body = await req.json();
    const { action, username, password, account, token } = body;
    if (typeof action !== "string") return json({ error: "Invalid request." }, 400);

    if (action === "login") {
      if (typeof password !== "string" || password.length < 1 || password.length > 256 || typeof username !== "string" || username.length > 30) {
        return json({ error: "Username or password was not accepted." }, 401);
      }
      const { data: profile, error } = await admin.from("user_profiles")
        .select("email").eq("username", String(username ?? "").trim().toLowerCase()).maybeSingle();
      if (error || !profile) return json({ error: "Username or password was not accepted." }, 401);
      const result = await fetch(`${url}/auth/v1/token?grant_type=password`, {
        method: "POST", headers: { apikey: anon, "Content-Type": "application/json" },
        body: JSON.stringify({ email: profile.email, password }),
      });
      if (!result.ok) return json({ error: "Username or password was not accepted." }, 401);
      return json(await result.json());
    }

    let email: string | null = null;
    const input = String(account ?? "").trim().toLowerCase();
    if (input.includes("@")) {
      email = input.endsWith("@gmail.com") ? input : null;
    } else {
      const { data } = await admin.from("user_profiles").select("email")
        .eq("username", input).maybeSingle();
      email = data?.email ?? null;
    }
    if (!email) return json({ message: "If the account exists, a reset code has been sent." });

    if (action === "reset_request") {
      const response = await fetch(`${url}/auth/v1/recover`, {
        method: "POST", headers: { apikey: anon, "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!response.ok) return json({ error: "Could not request a reset code." }, 429);
      return json({ message: "If the account exists, a reset code has been sent." });
    }

    if (action === "reset_complete") {
      if (typeof password !== "string" || password.length < 10 || password.length > 256 || typeof token !== "string" || token.length > 32) {
        return json({ error: "Use a password with at least 10 characters and enter the valid reset code." }, 400);
      }
      if (!email) return json({ error: "The reset code is invalid or expired." }, 400);
      const verified = await fetch(`${url}/auth/v1/verify`, {
        method: "POST", headers: { apikey: anon, "Content-Type": "application/json" },
        body: JSON.stringify({ email, token, type: "recovery" }),
      });
      if (!verified.ok) return json({ error: "The reset code is invalid or expired." }, 400);
      const session = await verified.json();
      const changed = await fetch(`${url}/auth/v1/user`, {
        method: "PUT", headers: {
          apikey: anon, Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        }, body: JSON.stringify({ password }),
      });
      if (!changed.ok) return json({ error: "Could not update the password." }, 400);
      return json({ message: "Password updated." });
    }
    return json({ error: "Unknown action." }, 400);
  } catch (_error) {
    return json({ error: "Authentication service is temporarily unavailable." }, 500);
  }
});
