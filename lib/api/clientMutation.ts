import type { MutationResult } from "@/lib/types/database";

export async function apiJson<T>(
  url: string,
  options?: {
    method?: string;
    body?: unknown;
  }
): Promise<T> {
  const res = await fetch(url, {
    method: options?.method ?? "POST",
    headers: { "Content-Type": "application/json" },
    body:
      options?.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const data = (await res.json()) as T;
  return data;
}

export async function apiMutation<T = void>(
  url: string,
  options?: {
    method?: string;
    body?: unknown;
  }
): Promise<MutationResult<T>> {
  try {
    const data = await apiJson<MutationResult<T>>(url, options);
    if (!data.message && !(data as { success?: boolean }).success) {
      return {
        success: false,
        message: "Request failed. Check that you are signed in.",
      };
    }
    return data;
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : "Request failed.",
    };
  }
}
