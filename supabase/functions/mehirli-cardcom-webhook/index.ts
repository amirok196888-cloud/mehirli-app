import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabaseAdmin } from "../_shared/platform.ts";
import { cardcomCredentials, cardcomPost, uuid } from "../_shared/cardcom.ts";

type CardcomResult = {
  ResponseCode?: number;
  Description?: string;
  TerminalNumber?: number;
  LowProfileId?: string;
  ReturnValue?: string;
  DocumentInfo?: { ResponseCode?: number; DocumentNumber?: number; DocumentUrl?: string };
  TranzactionInfo?: {
    ResponseCode?: number;
    Description?: string;
    TranzactionId?: number;
    TerminalNumber?: number;
    Amount?: number;
    CoinId?: number;
    IsRefund?: boolean;
  };
};

function response(body: string, status = 200): Response {
  return new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

function orderIdFromReturnValue(value: unknown): string {
  const match = /^mehirli:([0-9a-f-]{36})$/i.exec(String(value ?? ""));
  return match ? uuid(match[1]) : "";
}

async function callbackBody(req: Request): Promise<Record<string, unknown>> {
  const raw = await req.text();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
  } catch {
    // Cardcom installations may post form fields rather than JSON.
  }
  return Object.fromEntries(new URLSearchParams(raw));
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return response("method_not_allowed", 405);

  try {
    const incoming = await callbackBody(req);
    const lowProfileId = uuid(
      incoming.LowProfileId ?? incoming.lowProfileId ?? incoming.LowProfileCode ?? incoming.lowprofilecode,
    );
    if (!lowProfileId) return response("invalid_low_profile_id", 400);

    const credentials = await cardcomCredentials();
    const verified = await cardcomPost<CardcomResult>("/LowProfile/GetLpResult", {
      TerminalNumber: credentials.terminalNumber,
      ApiName: credentials.apiName,
      LowProfileId: lowProfileId,
    });

    const verifiedLowProfileId = uuid(verified.LowProfileId);
    const returnOrderId = orderIdFromReturnValue(verified.ReturnValue);
    const transaction = verified.TranzactionInfo;
    if (verifiedLowProfileId !== lowProfileId || !returnOrderId || !transaction) {
      return response("verification_failed", 400);
    }
    if (Number(verified.TerminalNumber) !== credentials.terminalNumber ||
        Number(transaction.TerminalNumber) !== credentials.terminalNumber) {
      return response("terminal_mismatch", 400);
    }

    const admin = supabaseAdmin();
    const { data: order, error: orderError } = await admin
      .from("platform_payment_orders")
      .select("id,professional_id,amount,status,provider_low_profile_id")
      .eq("id", returnOrderId)
      .eq("provider", "cardcom")
      .single();
    if (orderError || !order) return response("order_not_found", 404);
    if (order.provider_low_profile_id && order.provider_low_profile_id !== lowProfileId) {
      return response("order_reference_mismatch", 400);
    }

    const expectedCents = Math.round(Number(order.amount) * 100);
    const actualCents = Math.round(Number(transaction.Amount) * 100);
    const transactionId = Number(transaction.TranzactionId);
    const paid = Number(verified.ResponseCode) === 0 &&
      Number(transaction.ResponseCode) === 0 &&
      Number(transaction.CoinId) === 1 &&
      Number.isSafeInteger(transactionId) && transactionId > 0 &&
      transaction.IsRefund !== true &&
      expectedCents === actualCents;

    if (!paid) {
      if (order.status !== "paid") {
        await admin.from("platform_payment_orders").update({
          status: "failed",
          provider_low_profile_id: lowProfileId,
          provider_response_code: Number(transaction.ResponseCode ?? verified.ResponseCode) || null,
          provider_message: String(transaction.Description || verified.Description || "payment_failed").slice(0, 250),
        }).eq("id", order.id).neq("status", "paid");
      }
      return response("ok");
    }

    if (order.status !== "paid") {
      const documentInfo = verified.DocumentInfo;
      const documentOk = documentInfo && Number(documentInfo.ResponseCode) === 0;
      const { error: updateError } = await admin.from("platform_payment_orders").update({
        status: "paid",
        provider_low_profile_id: lowProfileId,
        provider_transaction_id: transactionId,
        provider_document_number: documentOk ? String(documentInfo.DocumentNumber ?? "") || null : null,
        provider_document_url: documentOk ? String(documentInfo.DocumentUrl ?? "").slice(0, 500) || null : null,
        provider_response_code: 0,
        provider_message: documentOk ? null : "payment_paid_document_requires_attention",
        paid_at: new Date().toISOString(),
      }).eq("id", order.id).neq("status", "paid");
      if (updateError) throw updateError;
    }

    return response("ok");
  } catch (error) {
    console.error("mehirli-cardcom-webhook", error instanceof Error ? error.message : "unexpected_error");
    return response("temporary_error", 500);
  }
});
