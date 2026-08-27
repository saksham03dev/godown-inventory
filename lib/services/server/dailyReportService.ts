import { createServiceClient } from "@/lib/supabase/service";
import type {
  Bill,
  DailyReport,
  InventoryLogWithRelations,
  StockOutSlip,
  StockOutSlipWithDetails,
} from "@/lib/types/database";
import {
  businessDayUtcRange,
  getTodayBusinessDate,
  isValidBusinessDate,
} from "@/lib/utils/businessDay";
import { clubStockInBatches } from "@/lib/utils/stockInBatching";

const LOG_PAGE = 1000;
const SLIP_PAGE = 200;

function db() {
  return createServiceClient({ requireServiceRole: true });
}

function mapSlipWithDetails(row: Record<string, unknown>): StockOutSlipWithDetails {
  const lines =
    (row.stock_out_slip_lines as StockOutSlipWithDetails["stock_out_slip_lines"]) ??
    [];
  const units =
    (row.stock_out_slip_units as StockOutSlipWithDetails["stock_out_slip_units"]) ??
    [];
  const total_bags = lines.reduce((sum, l) => sum + Number(l.bag_count), 0);
  const total_bales = lines.reduce((sum, l) => sum + Number(l.bale_count), 0);
  return {
    ...(row as unknown as StockOutSlip),
    stock_out_slip_lines: lines,
    stock_out_slip_units: units,
    total_bags,
    total_bales,
  };
}

async function fetchLogsInRange(
  startIso: string,
  endIso: string
): Promise<InventoryLogWithRelations[]> {
  const supabase = db();
  const all: InventoryLogWithRelations[] = [];
  let from = 0;

  for (;;) {
    const { data, error } = await supabase
      .from("inventory_logs")
      .select(
        `
        *,
        products ( id, name, barcode_id, product_code, size ),
        godowns!godown_id ( id, location_name ),
        stock_units ( id, unit_number )
      `
      )
      .gte("timestamp", startIso)
      .lt("timestamp", endIso)
      .order("timestamp", { ascending: true })
      .range(from, from + LOG_PAGE - 1);

    if (error) throw new Error(error.message);
    const rows = (data ?? []) as InventoryLogWithRelations[];
    all.push(...rows);
    if (rows.length < LOG_PAGE) break;
    from += LOG_PAGE;
  }

  return all;
}

async function fetchSlipsInRange(
  startIso: string,
  endIso: string
): Promise<StockOutSlipWithDetails[]> {
  const supabase = db();
  const all: StockOutSlipWithDetails[] = [];
  let from = 0;

  for (;;) {
    const { data, error } = await supabase
      .from("stock_out_slips")
      .select(
        `
        *,
        stock_out_slip_lines (
          *,
          products ( id, name, product_code, size )
        ),
        stock_out_slip_units ( * )
      `
      )
      .gte("confirmed_at", startIso)
      .lt("confirmed_at", endIso)
      .order("confirmed_at", { ascending: true })
      .range(from, from + SLIP_PAGE - 1);

    if (error) throw new Error(error.message);
    const rows = (data ?? []).map((row) =>
      mapSlipWithDetails(row as Record<string, unknown>)
    );
    all.push(...rows);
    if (rows.length < SLIP_PAGE) break;
    from += SLIP_PAGE;
  }

  return all;
}

async function fetchFinalizedBillsForDate(businessDate: string): Promise<Bill[]> {
  const { data, error } = await db()
    .from("bills")
    .select("*")
    .eq("status", "FINALIZED")
    .eq("business_date", businessDate)
    .order("finalized_at", { ascending: true })
    .limit(200);

  if (error) throw new Error(error.message);
  return (data ?? []) as Bill[];
}

export async function fetchDailyReportServer(
  businessDate: string
): Promise<DailyReport> {
  if (!isValidBusinessDate(businessDate)) {
    throw new Error("Invalid date.");
  }

  const today = getTodayBusinessDate();
  if (businessDate > today) {
    throw new Error("Cannot load a future business day.");
  }

  const { startIso, endIso } = businessDayUtcRange(businessDate);

  const [logs, slips, bills] = await Promise.all([
    fetchLogsInRange(startIso, endIso),
    fetchSlipsInRange(startIso, endIso),
    fetchFinalizedBillsForDate(businessDate),
  ]);

  const stockInBatches = clubStockInBatches(logs);
  const bags_in = stockInBatches.reduce((sum, b) => sum + b.bag_count, 0);
  const bags_out = Math.round(
    logs
      .filter((l) => l.transaction_type === "STOCK_OUT")
      .reduce((sum, l) => sum + Number(l.quantity), 0)
  );
  const bill_total = bills.reduce((sum, b) => sum + Number(b.total), 0);

  return {
    date: businessDate,
    summary: {
      bags_in,
      bags_out,
      stock_in_batch_count: stockInBatches.length,
      slip_count: slips.length,
      bill_count: bills.length,
      bill_total,
    },
    stockInBatches,
    slips,
    bills,
  };
}
