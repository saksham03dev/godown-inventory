import { query } from "@/lib/db/pg";
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
  const { rows } = await query<PortalUserPublic>(
    `SELECT id, username, full_name, role
     FROM portal_users
     WHERE role = $1 AND is_active = true
     ORDER BY full_name ASC`,
    [role]
  );
  return rows;
}

export async function listAllUsers(): Promise<PortalUser[]> {
  const { rows } = await query<PortalUser>(
    `SELECT id, username, full_name, role, is_active, created_at, updated_at
     FROM portal_users
     ORDER BY role ASC, full_name ASC`
  );
  return rows;
}

export async function getUserById(id: string): Promise<PortalUser | null> {
  const { rows } = await query<PortalUser>(
    `SELECT id, username, full_name, role, is_active, created_at, updated_at
     FROM portal_users WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function getUserWithPassword(id: string) {
  const { rows } = await query<{
    id: string;
    username: string;
    full_name: string;
    role: UserRole;
    password_hash: string;
    is_active: boolean;
  }>(
    `SELECT id, username, full_name, role, password_hash, is_active
     FROM portal_users WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function createPortalUser(
  input: PortalUserInput & { password: string }
): Promise<PortalUser> {
  const password_hash = await hashPassword(input.password);
  const { rows } = await query<PortalUser>(
    `INSERT INTO portal_users (username, full_name, role, password_hash, is_active)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, username, full_name, role, is_active, created_at, updated_at`,
    [
      input.username.trim().toLowerCase(),
      input.full_name.trim(),
      input.role,
      password_hash,
      input.is_active ?? true,
    ]
  );
  return rows[0];
}

export async function updatePortalUser(
  id: string,
  input: Partial<PortalUserInput>
): Promise<PortalUser | null> {
  const existing = await getUserById(id);
  if (!existing) return null;

  const { rows } = await query<PortalUser>(
    `UPDATE portal_users
     SET username = $2,
         full_name = $3,
         role = $4,
         is_active = $5,
         updated_at = NOW()
     WHERE id = $1
     RETURNING id, username, full_name, role, is_active, created_at, updated_at`,
    [
      id,
      (input.username ?? existing.username).trim().toLowerCase(),
      (input.full_name ?? existing.full_name).trim(),
      input.role ?? existing.role,
      input.is_active ?? existing.is_active,
    ]
  );
  return rows[0] ?? null;
}

export async function updatePortalUserPassword(
  id: string,
  password: string
): Promise<boolean> {
  const password_hash = await hashPassword(password);
  const { rowCount } = await query(
    `UPDATE portal_users SET password_hash = $2, updated_at = NOW() WHERE id = $1`,
    [id, password_hash]
  );
  return (rowCount ?? 0) > 0;
}

export async function deletePortalUser(id: string): Promise<boolean> {
  const { rowCount } = await query(`DELETE FROM portal_users WHERE id = $1`, [
    id,
  ]);
  return (rowCount ?? 0) > 0;
}
