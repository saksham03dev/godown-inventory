# Store IMS — Inventory Management System

A production-grade, mobile-responsive **Inventory Management System** built with Next.js (App Router), Tailwind CSS, Supabase, and camera-based barcode/QR scanning.

## Features

- **Dashboard** — Live metrics, godown stock distribution, and recent activity feed
- **Godown Inventory** — Filter by warehouse location and view per-godown product allocation
- **Scan Station** — Mobile-optimized STOCK IN / STOCK OUT with `html5-qrcode` camera integration

## Tech Stack

| Layer      | Technology                          |
|------------|-------------------------------------|
| Framework  | Next.js 15 (App Router)             |
| Styling    | Tailwind CSS                        |
| Icons      | Lucide React                        |
| Database   | Supabase (PostgreSQL)               |
| Scanning   | html5-qrcode                        |
| Language   | TypeScript                          |

## Directory Layout

```
├── app/
│   ├── layout.tsx              # Root layout (dark theme)
│   ├── page.tsx                # Dashboard (/)
│   ├── globals.css
│   ├── godowns/page.tsx        # Godown inventory viewer
│   └── scan/page.tsx           # Scan station
├── components/
│   ├── layout/                 # Sidebar, Header, DashboardLayout
│   ├── dashboard/              # StatCard, GodownDistribution, ActivityFeed
│   ├── godowns/                # GodownFilter, InventoryTable
│   ├── scan/                   # ScannerWindow, ModeToggle, GodownSelector
│   └── ui/                     # Dropdown, AlertBanner, LoadingSpinner
├── hooks/
│   ├── useInventory.ts         # Data fetching & refresh
│   ├── useBarcodeScan.ts       # html5-qrcode camera hook
│   └── useScanTransaction.ts   # STOCK IN/OUT logic + alerts
├── lib/
│   ├── supabase/client.ts      # Supabase JS client
│   ├── services/inventoryService.ts  # Centralized DB operations
│   └── types/database.ts       # TypeScript interfaces
└── supabase/schema.sql         # Database schema + seed data
```

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Run `supabase/schema.sql` in the SQL Editor
3. Copy `.env.local.example` → `.env.local` and fill in your keys:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Database Schema

| Table            | Purpose                                              |
|------------------|------------------------------------------------------|
| `products`       | Product catalog with global `total_stock`            |
| `godowns`        | Physical warehouse locations                         |
| `inventory_logs` | Transactional ledger (STOCK_IN / STOCK_OUT per godown)|

Per-godown stock is computed from the `inventory_logs` ledger. Global `products.total_stock` is updated on each scan transaction.

## Scan Logic

1. Barcode scanned → lookup `products.barcode_id`
2. **STOCK IN** → increment godown allocation + global stock, log transaction
3. **STOCK OUT** → verify godown stock ≥ quantity; if insufficient, show *"Insufficient Stock in this Godown"* alert; otherwise decrement and log

## License

Private — internal use.
