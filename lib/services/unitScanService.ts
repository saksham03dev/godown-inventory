import type {
  ScanTransactionInput,
  ScanTransactionResult,
  TransactionType,
} from "@/lib/types/database";

/**
 * Client entry: stock in/out goes through authenticated API + atomic DB RPC.
 * Do not mutate stock_units / inventory_logs from the browser.
 */
export async function processScanTransaction(
  input: ScanTransactionInput
): Promise<ScanTransactionResult> {
  const { barcodeId, godownId, transactionType, bagsQty } = input;

  if (!barcodeId.trim()) {
    return { success: false, message: "Invalid barcode scanned." };
  }
  if (transactionType === "STOCK_IN" && !godownId) {
    return {
      success: false,
      message: "Please select a godown before scanning.",
    };
  }

  try {
    const res = await fetch("/api/inventory/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        barcodeId: barcodeId.trim(),
        godownId,
        transactionType,
        bagsQty: bagsQty ?? null,
      }),
    });

    const data = (await res.json()) as ScanTransactionResult;
    if (!res.ok && !data.message) {
      return {
        success: false,
        message: "Scan request failed. Check that you are signed in.",
      };
    }
    return data;
  } catch (err) {
    return {
      success: false,
      message:
        err instanceof Error ? err.message : "Transaction failed unexpectedly.",
    };
  }
}

export type { TransactionType };
