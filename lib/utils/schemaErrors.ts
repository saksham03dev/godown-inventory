export function isMissingColumnError(
  message: string,
  column: string
): boolean {
  const lower = message.toLowerCase();
  const col = column.toLowerCase();
  return (
    lower.includes(col) &&
    (lower.includes("schema cache") ||
      lower.includes("column") ||
      lower.includes("does not exist"))
  );
}

export function withoutQualityFields(fields: string): string {
  return fields
    .split(",")
    .map((f) => f.trim())
    .filter((f) => f !== "quality")
    .join(", ");
}

export function formatSchemaError(message: string): string {
  if (
    message.includes("product_code") &&
    (message.includes("schema cache") || message.includes("column"))
  ) {
    return (
      "Database is missing the product_code column. Run supabase/migrations/002_product_godown_management.sql in the Supabase SQL Editor, then retry."
    );
  }
  if (isMissingColumnError(message, "quality")) {
    return (
      "Database is missing the quality column. Run `npm run db:push` to apply migration 024."
    );
  }
  if (message.includes("remaining_bags")) {
    return (
      "Database is missing bag-based inventory columns. Run `npm run db:push` to apply migration 011."
    );
  }
  return message;
}
