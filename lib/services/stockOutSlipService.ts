import { apiMutation } from "@/lib/api/clientMutation";
import type {
  MutationResult,
  StockOutSlipChannel,
  StockOutSlipConfirmItem,
  StockOutSlipWithDetails,
} from "@/lib/types/database";

export async function confirmStockOutSlip(input: {
  billerName: string;
  billNo: string;
  saleChannel: StockOutSlipChannel;
  items: StockOutSlipConfirmItem[];
}): Promise<MutationResult<StockOutSlipWithDetails>> {
  return apiMutation<StockOutSlipWithDetails>(
    "/api/inventory/stock-out-slip/confirm",
    { method: "POST", body: input }
  );
}

export async function fetchStockOutSlips(
  limit = 50
): Promise<StockOutSlipWithDetails[]> {
  const res = await fetch(
    `/api/inventory/stock-out-slip?limit=${encodeURIComponent(String(limit))}`
  );
  const data = (await res.json()) as MutationResult<StockOutSlipWithDetails[]>;
  if (!data.success || !data.data) {
    throw new Error(data.message || "Failed to load slips.");
  }
  return data.data;
}

export async function fetchStockOutSlip(
  id: string
): Promise<StockOutSlipWithDetails> {
  const res = await fetch(
    `/api/inventory/stock-out-slip?id=${encodeURIComponent(id)}`
  );
  const data = (await res.json()) as MutationResult<StockOutSlipWithDetails>;
  if (!data.success || !data.data) {
    throw new Error(data.message || "Slip not found.");
  }
  return data.data;
}

export async function updateStockOutSlip(input: {
  id: string;
  billerName: string;
  billNo: string;
  units?: { id: string; bagsMoved: number }[];
}): Promise<MutationResult<StockOutSlipWithDetails>> {
  return apiMutation<StockOutSlipWithDetails>("/api/inventory/stock-out-slip", {
    method: "PATCH",
    body: input,
  });
}
