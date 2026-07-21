/** Short, actionable scan messages for floor staff. */
const SCAN_ERROR_MAP: Record<string, string> = {
  "Invalid barcode scanned.": "Label not recognized.",
  "Invalid barcode.": "Label not recognized.",
  "Please select a godown before scanning.": "Pick a warehouse first.",
  "Please select a godown for returned stock.": "Pick a warehouse first.",
  "Select the destination godown.": "Pick destination warehouse.",
  "Select the source godown for dispatch.": "Pick source warehouse.",
  "Select both source and destination godowns.": "Pick both warehouses.",
  "Source and destination godowns must differ.": "Source and destination must differ.",
  "Use unit label barcodes (87…).": "Scan a bundle label (starts with 87).",
};

export function friendlyScanMessage(message: string): string {
  const trimmed = message.trim();
  return SCAN_ERROR_MAP[trimmed] ?? trimmed;
}
