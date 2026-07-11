import { createServiceClient } from "@/lib/supabase/service";
import { hashPassword } from "@/lib/auth/password";
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

export async function listActiveUsersByRole(
  role: UserRole
): Promise<PortalUserPublic[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("portal_users")
    .select("id, username, full_name, role")
    .eq("role", role)
    .eq("is_active", true)
    .order("full_name", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as PortalUserPublic[];
}

export async function listAllUsers(): Promise<PortalUser[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("portal_users")
    .select("id, username, full_name, role, is_active, created_at, updated_at")
    .order("role", { ascending: true })
    .order("full_name", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as PortalUser[];
}

export async function getUserById(id: string): Promise<PortalUser | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("portal_users")
    .select("id, username, full_name, role, is_active, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as PortalUser) ?? null;
}

export async function getUserWithPassword(id: string) {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("portal_users")
    .select("id, username, full_name, role, password_hash, is_active")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as {
    id: string;
    username: string;
    full_name: string;
    role: UserRole;
    password_hash: string;
    is_active: boolean;
  } | null;
}

export async function createPortalUser(
  input: PortalUserInput & { password: string }
): Promise<PortalUser> {
  const supabase = createServiceClient();
  const password_hash = await hashPassword(input.password);

  const { data, error } = await supabase
    .from("portal_users")
    .insert({
      username: input.username.trim().toLowerCase(),
      full_name: input.full_name.trim(),
      role: input.role,
      password_hash,
      is_active: input.is_active ?? true,
    })
    .select("id, username, full_name, role, is_active, created_at, updated_at")
    .single();

  if (error) throw new Error(error.message);
  return data as PortalUser;
}

export async function updatePortalUser(
  id: string,
  input: Partial<PortalUserInput>
): Promise<PortalUser | null> {
  const existing = await getUserById(id);
  if (!existing) return null;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("portal_users")
    .update({
      username: (input.username ?? existing.username).trim().toLowerCase(),
      full_name: (input.full_name ?? existing.full_name).trim(),
      role: input.role ?? existing.role,
      is_active: input.is_active ?? existing.is_active,
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
  const supabase = createServiceClient();
  const password_hash = await hashPassword(password);
  const { data, error } = await supabase
    .from("portal_users")
    .update({
      password_hash,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id");

  if (error) throw new Error(error.message);
  return (data?.length ?? 0) > 0;
}

export async function deletePortalUser(id: string): Promise<boolean> {
  const supabase = createServiceClient();
  const { error } = await supabase.from("portal_users").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return true;
}
