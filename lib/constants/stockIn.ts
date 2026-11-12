export const STOCK_IN_QUEUE_STORAGE_KEY = "store-ims-stock-in-queue";
/** Pending bales uploaded together once the list reaches this size. */
export const STOCK_IN_UPLOAD_BATCH_SIZE = 4;
/** A smaller leftover list uploads on this interval so stock moves during the session. */
export const STOCK_IN_UPLOAD_INTERVAL_MS = 2000;
