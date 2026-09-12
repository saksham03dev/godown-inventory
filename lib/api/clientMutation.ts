import type { MutationResult } from "@/lib/types/database";
import { refreshSessionCookies } from "@/lib/auth/ensureSession";

const SIGNED_IN_HINT =
  "Session expired. Confirm again — if it still fails, log in and restage the bales.";

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

    const result = data as MutationResult<T>;
    if (!result.message && !result.success) {
      return { success: false, message: SIGNED_IN_HINT };
    }
    return result;
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : "Request failed.",
    };
  }
}
