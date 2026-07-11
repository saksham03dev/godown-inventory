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
  const {
    barcodeId,
    godownId,
    transactionType,
    quantity = 1,
  } = input;

  if (!barcodeId.trim()) {
    return { success: false, message: "Invalid barcode scanned." };
  }
  if (!godownId) {
    return {
      success: false,
      message: "Please select a godown before scanning.",
    };
  }

  if (quantity !== 1) {
    return {
      success: false,
      message:
        "Only unit label scans (quantity 1) are supported. Use printed unit barcodes.",
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
