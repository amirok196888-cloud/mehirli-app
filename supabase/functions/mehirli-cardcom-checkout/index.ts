import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { authenticatedUser, corsHeaders, json, publicAppUrl, supabaseAdmin } from "../_shared/platform.ts";
import { cardcomCredentials, cardcomPost, safeCardcomCheckoutUrl, uuid } from "../_shared/cardcom.ts";

type CheckoutResponse = {
  ResponseCode?: number;
  Description?: string;
  LowProfileId?: string;
  Url?: string;
};

const PRODUCT_CODE = "MEHIRLI-MONTHLY";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "method_not_allowed" }, 405);

  try {
    const user = await authenticatedUser(req);
    if (!user) return json(req, { error: "not_authenticated" }, 401);

    const admin = supabaseAdmin();
    const { data: adminRow } = await admin.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle();
    if (adminRow?.user_id) return json(req, { error: "admin_not_billable" }, 409);

    const { data: settings, error: settingsError } = await admin
      .from("platform_billing_settings")
      .select("monthly_price,payment_mode,cardcom_product_code,merchant_brand_label")
      .eq("singleton", true)
      .single();
    if (settingsError || !settings) throw new Error("billing_settings_unavailable");
    if (settings.payment_mode !== "cardcom") {
      return json(req, { error: "cardcom_waiting_for_approval" }, 409);
    }

    const amount = Number(settings.monthly_price);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("invalid_subscription_price");
    const productCode = String(settings.cardcom_product_code || PRODUCT_CODE).slice(0, 50);

    const activeSince = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: existing } = await admin
      .from("platform_payment_orders")
      .select("id,checkout_url,expires_at")
      .eq("professional_id", user.id)
      .eq("product_code", productCode)
      .eq("amount", amount)
      .eq("status", "checkout_ready")
      .gt("created_at", activeSince)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const existingUrl = safeCardcomCheckoutUrl(existing?.checkout_url);
    if (existing?.id && existingUrl) {
      return json(req, { order_id: existing.id, checkout_url: existingUrl, reused: true });
    }

    const { data: order, error: orderError } = await admin
      .from("platform_payment_orders")
      .insert({
        professional_id: user.id,
        product_code: productCode,
        amount,
        currency: "ILS",
        provider: "cardcom",
        status: "created",
      })
      .select("id")
      .single();
    if (orderError || !order) throw new Error("payment_order_not_created");

    const [{ data: business }, { data: profile }] = await Promise.all([
      admin.from("business_profiles").select("business_name,business_phone").eq("user_id", user.id).maybeSingle(),
      admin.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    ]);

    const credentials = await cardcomCredentials();
    const successUrl = publicAppUrl();
    successUrl.searchParams.set("payment", "success");
    successUrl.searchParams.set("order", order.id);
    const failedUrl = publicAppUrl();
    failedUrl.searchParams.set("payment", "failed");
    failedUrl.searchParams.set("order", order.id);
    const cancelUrl = publicAppUrl();
    cancelUrl.searchParams.set("payment", "cancelled");
    cancelUrl.searchParams.set("order", order.id);
    const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/mehirli-cardcom-webhook`;
    const buyerName = String(business?.business_name || profile?.full_name || user.email || "לקוח מחירלי").slice(0, 50);
    const productDescription = "מחירלי – מנוי חודשי ל-30 יום";

    const cardcom = await cardcomPost<CheckoutResponse>("/LowProfile/Create", {
      TerminalNumber: credentials.terminalNumber,
      ApiName: credentials.apiName,
      Operation: "ChargeOnly",
      ReturnValue: `mehirli:${order.id}`,
      Amount: amount,
      SuccessRedirectUrl: successUrl.href,
      FailedRedirectUrl: failedUrl.href,
      CancelRedirectUrl: cancelUrl.href,
      WebHookUrl: webhookUrl,
      ProductName: productDescription,
      Language: "he",
      ISOCoinId: 1,
      Document: {
        DocumentTypeToCreate: "Auto",
        Name: buyerName,
        Email: user.email?.slice(0, 50),
        IsSendByEmail: Boolean(user.email),
        Mobile: String(business?.business_phone || "").slice(0, 50) || undefined,
        Comments: `שירות מחירלי · ${String(settings.merchant_brand_label || "ROKACH DIGITAL").slice(0, 80)}`,
        DepartmentId: credentials.departmentId,
        ExternalId: order.id.slice(0, 50),
        Products: [{
          ProductID: productCode,
          Description: productDescription,
          Quantity: 1,
          UnitCost: amount,
          TotalLineCost: amount,
          IsVatFree: false,
        }],
        IsAllowEditDocument: true,
        Language: "he",
      },
      UTM: { Source: "mehirli", Medium: "app", Campaign: "monthly_subscription" },
    });

    const checkoutUrl = safeCardcomCheckoutUrl(cardcom.Url);
    const lowProfileId = uuid(cardcom.LowProfileId);
    if (Number(cardcom.ResponseCode) !== 0 || !checkoutUrl || !lowProfileId) {
      await admin.from("platform_payment_orders").update({
        status: "failed",
        provider_response_code: Number(cardcom.ResponseCode) || null,
        provider_message: String(cardcom.Description || "cardcom_checkout_failed").slice(0, 250),
      }).eq("id", order.id).eq("professional_id", user.id);
      return json(req, { error: "cardcom_checkout_failed" }, 502);
    }

    const { error: updateError } = await admin.from("platform_payment_orders").update({
      status: "checkout_ready",
      provider_low_profile_id: lowProfileId,
      checkout_url: checkoutUrl,
      provider_response_code: 0,
      provider_message: null,
    }).eq("id", order.id).eq("professional_id", user.id).eq("status", "created");
    if (updateError) throw new Error("payment_order_not_updated");

    return json(req, { order_id: order.id, checkout_url: checkoutUrl, reused: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected_error";
    console.error("mehirli-cardcom-checkout", message);
    const status = message === "cardcom_not_configured" ? 503 : 500;
    return json(req, { error: message }, status);
  }
});
