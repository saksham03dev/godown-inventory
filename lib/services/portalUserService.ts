import { createServiceClient } from "@/lib/supabase/service";
import { syntheticEmail } from "@/lib/auth/portalEmail";
import type {
  PortalUser,
  PortalUserPublic,
  UserRole,
} from "@/lib/types/database";

export interface PortalUserInput {
  username: string;
  full_name: string;
  role: UserRole;
  password?: string;
  is_active?: boolean;
}

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export async function countProfiles(): Promise<number> {
  const supabase = createServiceClient({ requireServiceRole: true });
  const { count, error } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true });
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function listActiveUsersByRole(
  role: UserRole
): Promise<PortalUserPublic[]> {
  const supabase = createServiceClient({ requireServiceRole: true });
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, full_name, role")
    .eq("role", role)
    .eq("is_active", true)
    .order("full_name", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as PortalUserPublic[];
}

export async function listAllUsers(): Promise<PortalUser[]> {
  const supabase = createServiceClient({ requireServiceRole: true });
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, full_name, role, is_active, created_at, updated_at")
    .order("role", { ascending: true })
    .order("full_name", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as PortalUser[];
}

export async function getUserById(id: string): Promise<PortalUser | null> {
  const supabase = createServiceClient({ requireServiceRole: true });
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, full_name, role, is_active, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as PortalUser) ?? null;
}

export async function getUserByUsername(
  username: string
): Promise<PortalUser | null> {
  const supabase = createServiceClient({ requireServiceRole: true });
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, full_name, role, is_active, created_at, updated_at")
    .eq("username", normalizeUsername(username))
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as PortalUser) ?? null;
}

export async function createPortalUser(
  input: PortalUserInput & { password: string }
): Promise<PortalUser> {
  const username = normalizeUsername(input.username);
  const full_name = input.full_name.trim();
  const email = syntheticEmail(username);
  const supabase = createServiceClient({ requireServiceRole: true });

  const { data: authData, error: authError } =
    await supabase.auth.admin.createUser({
      email,
      password: input.password,
      email_confirm: true,
      user_metadata: {
        username,
        full_name,
        role: input.role,
      },
      app_metadata: {
        role: input.role,
      },
    });

  if (authError || !authData.user) {
    throw new Error(authError?.message ?? "Failed to create auth user.");
  }

  const authId = authData.user.id;

  // Trigger may have inserted profile; ensure fields match
  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: authId,
        email,
        username,
        full_name,
        role: input.role,
        is_active: input.is_active ?? true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    )
    .select("id, username, full_name, role, is_active, created_at, updated_at")
    .single();

  if (error) {
    await supabase.auth.admin.deleteUser(authId);
    throw new Error(error.message);
  }

  return data as PortalUser;
}

export async function updatePortalUser(
  id: string,
  input: Partial<PortalUserInput>
): Promise<PortalUser | null> {
  const existing = await getUserById(id);
  if (!existing) return null;

  const supabase = createServiceClient({ requireServiceRole: true });
  const username = normalizeUsername(input.username ?? existing.username);
  const full_name = (input.full_name ?? existing.full_name).trim();
  const role = input.role ?? existing.role;
  const is_active = input.is_active ?? existing.is_active;
  const email = syntheticEmail(username);

  const { error: authError } = await supabase.auth.admin.updateUserById(id, {
    email,
    email_confirm: true,
    ban_duration: is_active ? "none" : "876000h",
    user_metadata: { username, full_name, role },
    app_metadata: { role },
  });

  if (authError) throw new Error(authError.message);

  const { data, error } = await supabase
    .from("profiles")
    .update({
      email,
      username,
      full_name,
      role,
      is_active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id, username, full_name, role, is_active, created_at, updated_at")
    .single();

  if (error) throw new Error(error.message);
  return data as PortalUser;
}

export async function updatePortalUserPassword(
  id: string,
  password: string
): Promise<boolean> {
  const existing = await getUserById(id);
  if (!existing) return false;

  const supabase = createServiceClient({ requireServiceRole: true });
  const { error } = await supabase.auth.admin.updateUserById(id, { password });
  if (error) throw new Error(error.message);
  return true;
}

export async function deletePortalUser(id: string): Promise<boolean> {
  const supabase = createServiceClient({ requireServiceRole: true });
  const { error } = await supabase.auth.admin.deleteUser(id);
  if (error) throw new Error(error.message);
  // profiles cascade via FK ON DELETE CASCADE
  return true;
}
