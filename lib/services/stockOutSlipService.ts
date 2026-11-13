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
  existingSlipId?: string | null;
  /** Stable for the staged session. A repeat Confirm sends the same id. */
  submissionId: string;
}): Promise<MutationResult<StockOutSlipWithDetails>> {
  return apiMutation<StockOutSlipWithDetails>(
    "/api/inventory/stock-out-slip/confirm",
    { method: "POST", body: input }
  );
}

export type StockOutSlipList = {
  today: StockOutSlipWithDetails[];
  recent: StockOutSlipWithDetails[];
};

export async function fetchStockOutSlips(): Promise<StockOutSlipList> {
  const res = await fetch("/api/inventory/stock-out-slip");
  const data = (await res.json()) as MutationResult<StockOutSlipList>;
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
  billerName?: string;
  billNo?: string;
  units?: { id: string; bagsMoved: number }[];
  removeProductId?: string;
  removeSlipUnitIds?: string[];
  addItems?: { barcode: string; bagsQty: number }[];
}): Promise<MutationResult<StockOutSlipWithDetails>> {
  return apiMutation<StockOutSlipWithDetails>("/api/inventory/stock-out-slip", {
    method: "PATCH",
    body: input,
  });
}
