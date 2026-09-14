import { env } from "./platform.ts";

const API_ROOT = "https://secure.cardcom.solutions/api/v11";

export type CardcomCredentials = {
  terminalNumber: number;
  apiName: string;
  departmentId?: number;
};

export function cardcomCredentials(): CardcomCredentials {
  const terminalNumber = Number(env("CARDCOM_TERMINAL_NUMBER"));
  const apiName = env("CARDCOM_API_NAME");
  const department = Number(env("CARDCOM_MEHIRLI_DEPARTMENT_ID"));
  if (!Number.isInteger(terminalNumber) || terminalNumber <= 0 || !apiName) {
    throw new Error("cardcom_not_configured");
  }
  return {
    terminalNumber,
    apiName,
    departmentId: Number.isInteger(department) && department > 0 ? department : undefined,
  };
}

export async function cardcomPost<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_ROOT}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(`cardcom_invalid_response_${response.status}`);
  }
  if (!response.ok) {
    const description = String((payload as Record<string, unknown>)?.Description ?? "request_failed");
    throw new Error(`cardcom_${response.status}_${description.slice(0, 120)}`);
  }
  return payload as T;
}

export function safeCardcomCheckoutUrl(value: unknown): string {
  try {
    const url = new URL(String(value ?? ""));
    return url.protocol === "https:" && url.hostname === "secure.cardcom.solutions" ? url.href : "";
  } catch {
    return "";
  }
}

export function uuid(value: unknown): string {
  const candidate = String(value ?? "");
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(candidate)
    ? candidate
    : "";
}
