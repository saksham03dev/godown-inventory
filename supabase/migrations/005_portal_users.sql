-- Portal users (table-based login, managed by admin)
CREATE TABLE IF NOT EXISTS portal_users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username      TEXT NOT NULL UNIQUE,
  full_name     TEXT NOT NULL,
  role          user_role NOT NULL DEFAULT 'employee',
  password_hash TEXT NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portal_users_role ON portal_users (role);
CREATE INDEX IF NOT EXISTS idx_portal_users_active ON portal_users (is_active);

-- Default admin (username: admin, password: admin123 — change after first login)
INSERT INTO portal_users (username, full_name, role, password_hash)
VALUES (
  'admin',
  'System Administrator',
  'admin',
  '$2b$10$l7QofjDsSY2Bp7XoiozQluY9N8MTdaW/o3tY28W5OF7FCKzejAYBO'
)
ON CONFLICT (username) DO NOTHING;

NOTIFY pgrst, 'reload schema';
