import type { MutationResult } from "@/lib/types/database";
import { refreshSessionCookies } from "@/lib/auth/ensureSession";

const SIGNED_IN_HINT =
  "Session expired. Confirm again — staged bales stay on this screen. If it still fails, log in (do not reset).";

const NETWORK_HINT =
  "Network or server timeout. Staged bales stay on this screen. Open Stock Out Slips to see which labels already registered — those will not be in this list.";

function isGatewayTimeout(status: number): boolean {
  return status === 502 || status === 503 || status === 504 || status === 520 || status === 522 || status === 524;
}

function isUnauthorizedPayload(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const record = data as { error?: unknown; message?: unknown; success?: unknown };
  if (record.error === "Unauthorized") return true;
  if (typeof record.message === "string" && /not logged in|signed in|unauthorized/i.test(record.message)) {
    return true;
  }
  return false;
}

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return {};
  }
}

async function postJson(url: string, options?: { method?: string; body?: unknown }) {
  return fetch(url, {
    method: options?.method ?? "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body:
      options?.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
}

export async function apiJson<T>(
  url: string,
  options?: {
    method?: string;
    body?: unknown;
  }
): Promise<T> {
  const res = await postJson(url, options);
  return (await readJson(res)) as T;
}

export async function apiMutation<T = void>(
  url: string,
  options?: {
    method?: string;
    body?: unknown;
  }
): Promise<MutationResult<T>> {
  try {
    let res = await postJson(url, options);
    let data = await readJson(res);

    if (res.status === 401 || isUnauthorizedPayload(data)) {
      const refreshed = await refreshSessionCookies();
      if (refreshed) {
        res = await postJson(url, options);
        data = await readJson(res);
      }
    }

    if (res.status === 401 || isUnauthorizedPayload(data)) {
      return { success: false, message: SIGNED_IN_HINT };
    }

    if (isGatewayTimeout(res.status) || res.status === 408) {
      return { success: false, message: NETWORK_HINT };
    }

    const result = data as MutationResult<T>;
    if (typeof result.success !== "boolean") {
      return {
        success: false,
        message: res.ok ? "Unexpected server response. Staged bales were not cleared." : NETWORK_HINT,
      };
    }
    if (!result.success && !result.message) {
      return { success: false, message: NETWORK_HINT };
    }
    return result;
  } catch (err) {
    const raw = err instanceof Error ? err.message : "Request failed.";
    const offline =
      typeof navigator !== "undefined" && navigator.onLine === false;
    return {
      success: false,
      message: offline
        ? "No network. Staged bales stay on this device until you confirm again."
        : /fail|network|fetch|timeout|abort/i.test(raw)
          ? NETWORK_HINT
          : raw,
    };
  }
}
