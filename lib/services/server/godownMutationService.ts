import { createServiceClient } from "@/lib/supabase/service";
import type { Godown, GodownInput, MutationResult } from "@/lib/types/database";

function db() {
  return createServiceClient({ requireServiceRole: true });
}

export async function createGodownServer(
  input: GodownInput
): Promise<MutationResult<Godown>> {
  try {
    const location_name = input.location_name.trim();
    if (!location_name) {
      return { success: false, message: "Godown name is required." };
    }
    if (input.capacity < 0) {
      return { success: false, message: "Capacity cannot be negative." };
    }

    const { data, error } = await db()
      .from("godowns")
      .insert({
        location_name,
        capacity: input.capacity,
        address: input.address?.trim() || null,
        notes: input.notes?.trim() || null,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return {
          success: false,
          message: "A godown with this name already exists.",
        };
      }
      throw new Error(error.message);
    }

    return {
      success: true,
      message: `Godown "${location_name}" created.`,
      data,
    };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : "Failed to create godown.",
    };
  }
}

export async function updateGodownServer(
  id: string,
  input: GodownInput
): Promise<MutationResult<Godown>> {
  try {
    const location_name = input.location_name.trim();
    if (!location_name) {
      return { success: false, message: "Godown name is required." };
    }
    if (input.capacity < 0) {
      return { success: false, message: "Capacity cannot be negative." };
    }

    const { data, error } = await db()
      .from("godowns")
      .update({
        location_name,
        capacity: input.capacity,
        address: input.address?.trim() || null,
        notes: input.notes?.trim() || null,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return {
          success: false,
          message: "Another godown already uses this name.",
        };
      }
      throw new Error(error.message);
    }

    return {
      success: true,
      message: `Godown "${location_name}" updated.`,
      data,
    };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : "Failed to update godown.",
    };
  }
}

export async function deleteGodownServer(id: string): Promise<MutationResult> {
  try {
    const supabase = db();
    const { data: godown, error: fetchError } = await supabase
      .from("godowns")
      .select("location_name")
      .eq("id", id)
      .single();

    if (fetchError) throw new Error(fetchError.message);

    const { error } = await supabase.from("godowns").delete().eq("id", id);
    if (error) throw new Error(error.message);

    return {
      success: true,
      message: `Godown "${godown.location_name}" deleted.`,
    };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : "Failed to delete godown.",
    };
  }
}
