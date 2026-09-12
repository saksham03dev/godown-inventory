import type {
  ScanTransactionInput,
  ScanTransactionResult,
  TransactionType,
} from "@/lib/types/database";

async function postInventoryJson<T extends ScanTransactionResult>(
  url: string,
  body: Record<string, unknown>
): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as T;
  if (!res.ok && !data.message) {
    return {
      success: false,
      message: "Request failed. Check that you are signed in.",
    } as T;
  }
  return data;
}

/**
 * Client entry: stock in/out goes through authenticated API + atomic DB RPC.
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
    return await postInventoryJson("/api/inventory/scan", {
      barcodeId: barcodeId.trim(),
      godownId,
      transactionType,
      bagsQty: bagsQty ?? null,
    });
  } catch (err) {
    return {
      success: false,
      message:
        err instanceof Error ? err.message : "Transaction failed unexpectedly.",
    };
  }
}

export async function processTransferTransaction(input: {
  barcodeId: string;
  phase: "dispatch" | "receive";
  fromGodownId?: string;
  toGodownId: string;
}): Promise<ScanTransactionResult> {
  if (!input.barcodeId.trim()) {
    return { success: false, message: "Invalid barcode scanned." };
  }
  if (!input.toGodownId) {
    return {
      success: false,
      message: "Select the destination godown.",
    };
  }
  if (input.phase === "dispatch" && !input.fromGodownId) {
    return {
      success: false,
      message: "Select the source godown for dispatch.",
    };
  }

  try {
    return await postInventoryJson("/api/inventory/transfer", {
      barcodeId: input.barcodeId.trim(),
      phase: input.phase,
      fromGodownId: input.fromGodownId ?? "",
      toGodownId: input.toGodownId,
    });
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : "Transfer failed.",
    };
  }
}

export async function processReturnTransaction(input: {
  barcodeId: string;
  godownId: string;
  bagsQty?: number | null;
  reason?: string | null;
}): Promise<ScanTransactionResult> {
  if (!input.barcodeId.trim()) {
    return { success: false, message: "Invalid barcode scanned." };
  }
  if (!input.godownId) {
    return {
      success: false,
      message: "Please select a godown for returned stock.",
    };
  }

  try {
    return await postInventoryJson("/api/inventory/return", {
      barcodeId: input.barcodeId.trim(),
      godownId: input.godownId,
      bagsQty: input.bagsQty ?? null,
      reason: input.reason ?? null,
    });
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : "Return failed.",
    };
  }
}

export async function correctUnitGodown(input: {
  barcodeId: string;
  toGodownId: string;
  reason?: string | null;
}): Promise<ScanTransactionResult> {
  if (!input.barcodeId.trim()) {
    return { success: false, message: "Invalid barcode." };
  }
  if (!input.toGodownId) {
    return { success: false, message: "Select the correct godown." };
  }

  try {
    return await postInventoryJson("/api/inventory/correct-godown", {
      barcodeId: input.barcodeId.trim(),
      toGodownId: input.toGodownId,
      reason: input.reason ?? null,
    });
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : "Relocation failed.",
    };
  }
}

export type { TransactionType };
