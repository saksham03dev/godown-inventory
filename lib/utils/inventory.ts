import { BAGS_PER_BALE } from "@/lib/constants/inventory";

export function isSealedBale(remainingBags: number): boolean {
  return remainingBags === BAGS_PER_BALE;
}

export function isOpenBale(remainingBags: number): boolean {
  return remainingBags > 0 && remainingBags < BAGS_PER_BALE;
}

export function formatBagCount(count: number): string {
  return count.toLocaleString();
}

export function balesToBags(baleCount: number): number {
  return baleCount * BAGS_PER_BALE;
}
