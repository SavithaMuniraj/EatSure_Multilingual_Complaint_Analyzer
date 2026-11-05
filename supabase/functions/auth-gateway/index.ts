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
      if (typeof password !== "string" || password.length < 1 || password.length > 256 || typeof username !== "string" || username.length > 254) {
        return json({ error: "Username or password was not accepted." }, 401);
      }
      const loginId = String(username).trim().toLowerCase();
      let loginEmail: string | null = null;
      if (loginId.includes("@")) {
        if (loginId.endsWith("@gmail.com")) loginEmail = loginId;
      } else {
        const { data: profile, error } = await admin.from("user_profiles")
          .select("email").eq("username", loginId).maybeSingle();
        if (!error && profile) loginEmail = profile.email;
      }
      if (!loginEmail) return json({ error: "Username/email or password was not accepted." }, 401);
      const result = await fetch(`${url}/auth/v1/token?grant_type=password`, {
        method: "POST", headers: { apikey: anon, "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password }),
      });
      if (!result.ok) return json({ error: "Username/email or password was not accepted." }, 401);
      return json(await result.json());
    }

    let email: string | null = null;
    const input = String(account ?? "").trim().toLowerCase();
    if (action !== "reset_request" && action !== "reset_complete") return json({ error: "Unknown action." }, 400);
    if (!input || input.length > 254) return json({ error: "Enter your Gmail address or username." }, 400);
    if (input.includes("@")) {
      if (!/^[^\s@]+@gmail\.com$/i.test(input)) return json({ error: "Enter a Gmail address ending in @gmail.com, or use your username." }, 400);
      email = input;
    } else {
      if (!/^[a-z0-9_]{3,30}$/.test(input)) return json({ error: "Enter a valid Gmail address or 3–30 character username." }, 400);
      const { data, error } = await admin.from("user_profiles").select("email")
        .eq("username", input).maybeSingle();
      if (error) return json({ error: "We couldn’t look up that username right now. Please try again shortly." }, 503);
      email = data?.email ?? null;
    }
    if (!email) return json({ message: "If the account exists, a reset code has been sent." });

    if (action === "reset_request") {
      const allowedRedirect = "https://eatsure-complaint-intelligence-savitha.onrender.com";
      const requestedRedirect = typeof body.redirect_to === "string" ? body.redirect_to : allowedRedirect;
      let redirectTo = allowedRedirect;
      try {
        if (new URL(requestedRedirect).origin === allowedRedirect) redirectTo = requestedRedirect;
      } catch (_error) {
        // Fall back to the fixed app origin; never allow an external redirect.
      }
      const response = await fetch(`${url}/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`, {
        method: "POST", headers: { apikey: anon, "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!response.ok) {
        if (response.status === 429) return json({ error: "Too many reset emails were requested. Wait before trying again." }, 429);
        return json({ error: "The reset email service is unavailable. Please try again later or contact the app owner." }, 503);
      }
      return json({ message: "If the account exists, a reset code has been sent." });
    }

    if (action === "reset_complete") {
      if (typeof password !== "string" || password.length < 5 || password.length > 256 || typeof token !== "string" || !/^\d{6}$/.test(token)) {
        return json({ error: "Use a password with at least 5 characters and enter the valid reset code." }, 400);
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
      if (!changed.ok) return json({ error: "Could not update the password. Check the password requirements and request a new code if this code expired." }, 400);
      return json({ message: "Password updated." });
    }
    return json({ error: "Unknown action." }, 400);
  } catch (_error) {
    return json({ error: "Authentication service is temporarily unavailable." }, 500);
  }
});
