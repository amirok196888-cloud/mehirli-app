import {
  authenticatedUser,
  corsHeaders,
  env,
  json,
  publicAppUrl,
  supabaseAdmin,
} from "../_shared/platform.ts";

const DELIVERY_TABLE = "whatsapp_install_deliveries";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }
  if (req.method !== "POST") return json(req, { error: "method_not_allowed" }, 405);

  const user = await authenticatedUser(req);
  if (!user) return json(req, { error: "not_authenticated" }, 401);

  const metadata = user.user_metadata ?? {};
  const phone = String(metadata.whatsapp_install_phone ?? "").trim();
  const optedIn = metadata.whatsapp_install_opt_in === true;
  const consentAt = String(metadata.whatsapp_install_opt_in_at ?? "").trim();
  if (!optedIn || !consentAt || !/^\+9725\d{8}$/.test(phone)) {
    return json(req, { sent: false, error: "whatsapp_opt_in_required" }, 400);
  }

  const accessToken = env("META_WHATSAPP_ACCESS_TOKEN");
  const phoneNumberId = env("META_WHATSAPP_PHONE_NUMBER_ID");
  const templateName = env("META_WHATSAPP_TEMPLATE_NAME");
  const templateLanguage = env("META_WHATSAPP_TEMPLATE_LANGUAGE") || "he";
  const graphVersion = env("META_GRAPH_API_VERSION");
  if (!accessToken || !phoneNumberId || !templateName || !graphVersion) {
    return json(req, { sent: false, error: "whatsapp_not_configured" }, 503);
  }
  if (!/^v\d+\.\d+$/.test(graphVersion)) {
    return json(req, { sent: false, error: "whatsapp_configuration_invalid" }, 503);
  }

  const admin = supabaseAdmin();
  const { data: claimed, error: claimError } = await admin.rpc(
    "claim_whatsapp_install_delivery",
    { p_user_id: user.id, p_phone_e164: phone },
  );
  if (claimError) return json(req, { sent: false, error: "delivery_claim_failed" }, 500);
  if (!claimed) {
    const { data: existing } = await admin.from(DELIVERY_TABLE)
      .select("status")
      .eq("user_id", user.id)
      .maybeSingle();
    return json(req, {
      sent: false,
      already_sent: existing?.status === "sent",
      pending: existing?.status === "sending",
    });
  }

  const installUrl = publicAppUrl().toString();
  const endpoint = `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`;
  let response: Response;
  let result: Record<string, unknown> = {};
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: phone.slice(1),
        type: "template",
        template: {
          name: templateName,
          language: { code: templateLanguage },
          components: [{
            type: "body",
            parameters: [{ type: "text", text: installUrl }],
          }],
        },
      }),
    });
    result = await response.json().catch(() => ({})) as Record<string, unknown>;
  } catch {
    // The provider may have accepted the request before the connection failed.
    // Keep the delivery claim so later logins cannot accidentally send twice.
    return json(req, { sent: false, pending: true, error: "provider_response_unknown" }, 502);
  }

  if (!response.ok) {
    const errorObject = result.error && typeof result.error === "object"
      ? result.error as Record<string, unknown>
      : {};
    await admin.from(DELIVERY_TABLE).update({
      status: "failed",
      error_code: String(errorObject.code ?? `http_${response.status}`).slice(0, 80),
      updated_at: new Date().toISOString(),
    }).eq("user_id", user.id);
    return json(req, { sent: false, error: "provider_rejected_message" }, 502);
  }

  const messages = Array.isArray(result.messages) ? result.messages : [];
  const providerMessageId = messages[0] && typeof messages[0] === "object"
    ? String((messages[0] as Record<string, unknown>).id ?? "")
    : "";
  await admin.from(DELIVERY_TABLE).update({
    status: "sent",
    provider_message_id: providerMessageId || null,
    error_code: null,
    updated_at: new Date().toISOString(),
    sent_at: new Date().toISOString(),
  }).eq("user_id", user.id);

  return json(req, { sent: true });
});
