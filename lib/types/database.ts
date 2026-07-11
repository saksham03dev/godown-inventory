export type TransactionType = "STOCK_IN" | "STOCK_OUT";
export type UserRole = "admin" | "manager" | "employee";

export interface Product {
  id: string;
  name: string;
  product_code: string;
  barcode_id: string;
  total_stock: number;
  size: string | null;
  special_note: string | null;
  description: string | null;
  category: string | null;
  retail_selling_price: number;
  created_at?: string;
}

export interface ProductInput {
  name: string;
  product_code: string;
  total_stock?: number;
  size?: string | null;
  special_note?: string | null;
  category?: string | null;
  retail_selling_price?: number;
}

export interface UserProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  role: UserRole;
  created_at?: string;
}

export interface PortalUser {
  id: string;
  username: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PortalUserPublic {
  id: string;
  username: string;
  full_name: string;
  role: UserRole;
}

export interface Godown {
  id: string;
  location_name: string;
  capacity: number;
  address: string | null;
  notes: string | null;
  created_at?: string;
}

export interface GodownInput {
  location_name: string;
  capacity: number;
  address?: string | null;
  notes?: string | null;
}

export interface InventoryLog {
  id: string;
  product_id: string;
  godown_id: string;
  transaction_type: TransactionType;
  quantity: number;
  handled_by: string;
  timestamp: string;
}

export interface InventoryLogWithRelations extends InventoryLog {
  products: Pick<Product, "id" | "name" | "barcode_id" | "product_code"> | null;
  godowns: Pick<Godown, "id" | "location_name"> | null;
}

export interface GodownStockItem {
  product_id: string;
  product_name: string;
  product_code: string;
  barcode_id: string;
  category: string | null;
  quantity: number;
}

export interface GodownDistribution {
  godown_id: string;
  location_name: string;
  total_units: number;
  percentage: number;
}

export interface DashboardMetrics {
  totalActiveProducts: number;
  totalStockUnits: number;
  godownDistribution: GodownDistribution[];
  recentLogs: InventoryLogWithRelations[];
}

export interface ScanTransactionInput {
  barcodeId: string;
  godownId: string;
  transactionType: TransactionType;
  quantity?: number;
}

export interface ScanTransactionResult {
  success: boolean;
  message: string;
  product?: Product;
  newGodownStock?: number;
  stockUnit?: StockUnit;
  isUnitScan?: boolean;
}

export type StockUnitStatus = "LABELLED" | "STOCKED_IN" | "STOCKED_OUT";
export type BillStatus = "DRAFT" | "FINALIZED";
export type LabelSize = "small" | "medium" | "large";

export interface StockBatch {
  id: string;
  product_id: string;
  batch_code: string;
  source_name: string;
  quantity: number;
  notes: string | null;
  created_by: string;
  created_at: string;
  products?: Pick<Product, "id" | "name" | "product_code" | "size"> | null;
}

export interface StockUnit {
  id: string;
  batch_id: string;
  product_id: string;
  unit_barcode: string;
  unit_number: number;
  status: StockUnitStatus;
  godown_id: string | null;
  stocked_in_at: string | null;
  stocked_out_at: string | null;
  bill_id: string | null;
  created_at: string;
  products?: Pick<
    Product,
    "id" | "name" | "product_code" | "size" | "retail_selling_price"
  > | null;
  stock_batches?: Pick<
    StockBatch,
    "id" | "batch_code" | "source_name" | "quantity" | "notes"
  > | null;
  godowns?: Pick<Godown, "id" | "location_name"> | null;
}

export interface StockBatchWithUnits extends StockBatch {
  stock_units: StockUnit[];
}

export interface CreateBatchInput {
  product_id: string;
  source_name: string;
  quantity: number;
  notes?: string | null;
}

export interface UpdateBatchInput {
  source_name: string;
  notes?: string | null;
}

/** Units of a product currently stocked in a godown, grouped by batch/source. */
export interface ProductGodownBatchGroup {
  batch: StockBatch;
  in_godown_count: number;
  units: StockUnit[];
}

export interface ProductGodownBreakdown {
  product_id: string;
  godown_id: string;
  batches: ProductGodownBatchGroup[];
  total_units: number;
}

export interface Bill {
  id: string;
  bill_number: string;
  customer_name: string;
  customer_phone: string | null;
  customer_address: string | null;
  notes: string | null;
  subtotal: number;
  tax_percent: number;
  tax_amount: number;
  discount: number;
  total: number;
  status: BillStatus;
  created_at: string;
  finalized_at: string | null;
}

export interface BillItem {
  id: string;
  bill_id: string;
  stock_unit_id: string | null;
  product_id: string;
  product_name: string;
  product_code: string;
  unit_barcode: string;
  source_name: string | null;
  unit_number: number | null;
  batch_quantity: number | null;
  quantity: number;
  unit_price: number;
  line_total: number;
  created_at: string;
}

export interface BillWithItems extends Bill {
  bill_items: BillItem[];
}

export interface BillInput {
  customer_name: string;
  customer_phone?: string | null;
  customer_address?: string | null;
  notes?: string | null;
  tax_percent?: number;
  discount?: number;
}

export interface BillItemInput {
  unit_price: number;
  quantity?: number;
}

export interface MutationResult<T = void> {
  success: boolean;
  message: string;
  data?: T;
}

export interface AlertState {
  type: "success" | "error" | "info";
  message: string;
}

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}
