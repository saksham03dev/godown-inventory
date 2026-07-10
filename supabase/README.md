# Database Push Automation

Push local SQL files to your cloud Supabase database without copy-pasting in the browser.

## Prerequisites

1. **Database password** (not the anon/publishable key — that cannot run DDL)

   Supabase Dashboard → **Project Settings** → **Database** → **Database password**

2. Add to `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_DB_PASSWORD=your-database-password
```

Or set a full connection string:

```env
DATABASE_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres
```

## Commands

| Command | What it does |
|---------|----------------|
| `npm run db:push` | Apply **pending** files in `supabase/migrations/` (tracks what's already applied) |
| `npm run db:push:schema` | Apply `supabase/schema.sql` (fresh project bootstrap) |
| `npm run db:push:all` | Apply `schema.sql` then all pending migrations |

## How it works

```
.env.local  →  scripts/db-push.mjs  →  PostgreSQL (direct connection)
                      ↓
              supabase/migrations/*.sql
              supabase/schema.sql
                      ↓
              NOTIFY pgrst, 'reload schema'
```

- Reads `NEXT_PUBLIC_SUPABASE_URL` to detect your project ref
- Builds `postgresql://postgres:***@db.<ref>.supabase.co:5432/postgres`
- Tracks applied migrations in `_schema_migrations` table
- Reloads PostgREST schema cache after each run

## Bash fallback

If you have `psql` installed:

```bash
chmod +x scripts/db-push.sh
./scripts/db-push.sh migrations   # or schema | all
```

## Adding new migrations

1. Create `supabase/migrations/003_your_change.sql`
2. Run `npm run db:push`
3. Only new files are applied automatically
