import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const DEFAULT_APP_ORIGIN = "https://amirok196888-cloud.github.io";

export function env(name: string): string {
  return (Deno.env.get(name) ?? "").trim();
}

function namedKey(dictionaryName: string): string {
  const raw = env(dictionaryName);
  if (!raw) return "";
  try {
    const keys = JSON.parse(raw) as Record<string, string>;
    return String(keys.default ?? "").trim();
  } catch {
    return "";
  }
}

export function supabaseAdmin() {
  // Use the legacy service-role JWT first while the function gateway still
  // performs JWT verification. A new sb_secret key is not a JWT and can be
  // forwarded as an invalid Authorization bearer by older client paths,
  // which makes privileged reads silently fall back to RLS.
  const key = env("SUPABASE_SERVICE_ROLE_KEY") || namedKey("SUPABASE_SECRET_KEYS");
  if (!key) throw new Error("server_secret_missing");
  return createClient(env("SUPABASE_URL"), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function supabaseForUser(authorization: string) {
  const key = namedKey("SUPABASE_PUBLISHABLE_KEYS") || env("SUPABASE_ANON_KEY");
  if (!key) throw new Error("publishable_key_missing");
  return createClient(env("SUPABASE_URL"), key, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function authenticatedUser(req: Request) {
  const authorization = req.headers.get("authorization") ?? "";
  if (!authorization.toLowerCase().startsWith("bearer ")) return null;
  const token = authorization.slice(7).trim();
  if (!token) return null;
  const client = supabaseForUser(authorization);
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

export function allowedOrigin(req: Request): string {
  const origin = req.headers.get("origin") ?? "";
  const configured = env("MEHIRLI_ALLOWED_ORIGINS")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const allowed = configured.length ? configured : [DEFAULT_APP_ORIGIN];
  return allowed.includes(origin) ? origin : allowed[0];
}

export function corsHeaders(req: Request): HeadersInit {
  return {
    "Access-Control-Allow-Origin": allowedOrigin(req),
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

export function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json; charset=utf-8" },
  });
}

export function publicAppUrl(): URL {
  const raw = env("MEHIRLI_PUBLIC_URL") || "https://amirok196888-cloud.github.io/mehirli-app/";
  return new URL(raw);
}
