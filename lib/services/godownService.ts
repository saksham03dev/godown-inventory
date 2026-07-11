import { apiMutation } from "@/lib/api/clientMutation";
import type { Godown, GodownInput, MutationResult } from "@/lib/types/database";

export async function createGodown(
  input: GodownInput
): Promise<MutationResult<Godown>> {
  return apiMutation<Godown>("/api/godowns", { body: input });
}

export async function updateGodown(
  id: string,
  input: GodownInput
): Promise<MutationResult<Godown>> {
  return apiMutation<Godown>(`/api/godowns/${id}`, {
    method: "PATCH",
    body: input,
  });
}

export async function deleteGodown(id: string): Promise<MutationResult> {
  return apiMutation(`/api/godowns/${id}`, { method: "DELETE" });
}
