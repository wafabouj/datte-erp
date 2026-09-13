export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface Currency {
  code: string;
  name: string;
  symbol: string;
  isBaseCurrency: boolean;
  exchangeRates?: { rateToBase: string; date: string }[];
}

export interface UnitOfMeasure {
  id: string;
  code: string;
  name: string;
}

export interface UomConversion {
  id: string;
  fromUomId: string;
  toUomId: string;
  factor: string;
  fromUom: UnitOfMeasure;
  toUom: UnitOfMeasure;
}

export interface Client {
  id: string;
  code: string;
  name: string;
  country: string;
  address?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  paymentTermsDays: number;
  currencyCode: string;
  currency?: Currency;
  defaultIncoterm?: string | null;
  isActive: boolean;
}

export interface Supplier {
  id: string;
  code: string;
  name: string;
  country: string;
  address?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  isActive: boolean;
}

export type ArticleType = "RAW_MATERIAL" | "PACKAGING" | "FINISHED_PRODUCT";
export type ArticleProcess = "WITH_PIT" | "PITTED";
export type ArticleTreatment = "BRANCH" | "STANDARD" | "PACKAGED";

export interface Article {
  id: string;
  code: string;
  name: string;
  type: ArticleType;
  variety?: string | null;
  process?: ArticleProcess | null;
  treatment?: ArticleTreatment | null;
  caliber?: string | null;
  packaging?: string | null;
  uomId: string;
  uom?: UnitOfMeasure;
  minStock: string;
  unitCost: string;
  unitPrice: string;
  currencyCode: string;
  isActive: boolean;
}

export interface Warehouse {
  id: string;
  code: string;
  name: string;
  address?: string | null;
  isDefault: boolean;
}

export type SalesOrderStatus =
  | "DRAFT"
  | "CONFIRMED"
  | "IN_PREPARATION"
  | "SHIPPED"
  | "DELIVERED"
  | "CLOSED"
  | "CANCELLED";

export interface SalesOrderLine {
  id: string;
  articleId: string;
  article?: Article;
  warehouseId?: string | null;
  warehouse?: Warehouse | null;
  quantity: string;
  unitPrice: string;
  lineTotal: string;
}

export interface SalesOrder {
  id: string;
  number: string;
  clientId: string;
  client?: Client;
  status: SalesOrderStatus;
  currencyCode: string;
  incoterm?: string | null;
  orderDate: string;
  requestedDeliveryDate?: string | null;
  shippedDate?: string | null;
  deliveredDate?: string | null;
  notes?: string | null;
  lines: SalesOrderLine[];
}

export type InvoiceType = "INVOICE" | "CREDIT_NOTE";
export type InvoiceStatus = "ISSUED" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "CANCELLED";

export interface Payment {
  id: string;
  amount: string;
  date: string;
  method?: string | null;
  reference?: string | null;
}

export interface InvoiceLine {
  id: string;
  articleId: string;
  article?: Article;
  description?: string | null;
  quantity: string;
  unitPrice: string;
  lineTotal: string;
}

export interface Invoice {
  id: string;
  number: string;
  type: InvoiceType;
  status: InvoiceStatus;
  effectiveStatus?: InvoiceStatus;
  clientId: string;
  client?: Client;
  salesOrderId?: string | null;
  currencyCode: string;
  issueDate: string;
  dueDate: string;
  totalAmount: string;
  notes?: string | null;
  lines?: InvoiceLine[];
  payments?: Payment[];
}

export interface Lot {
  id: string;
  code: string;
  articleId: string;
  article?: Article;
  supplierId?: string | null;
  supplier?: Supplier | null;
  harvestDate?: string | null;
  receptionDate?: string | null;
  productionOrderId?: string | null;
  expiryDate?: string | null;
  createdAt: string;
}

export interface StockLevel {
  id: string;
  articleId: string;
  article: Article;
  warehouseId: string;
  warehouse: Warehouse;
  lotId?: string | null;
  lot?: Lot | null;
  quantity: string;
}

export interface StockMovement {
  id: string;
  articleId: string;
  article: Article;
  warehouseId: string;
  warehouse: Warehouse;
  lotId?: string | null;
  lot?: Lot | null;
  quantity: string;
  type: string;
  referenceType?: string | null;
  referenceId?: string | null;
  date: string;
  notes?: string | null;
}

export interface BomComponent {
  id: string;
  articleId: string;
  article: Article;
  qtyPerUnit: string;
}

export interface BillOfMaterial {
  id: string;
  finishedArticleId: string;
  finishedArticle: Article;
  name: string;
  expectedYieldPct: string;
  isActive: boolean;
  components: BomComponent[];
}

export type ProductionOrderStatus = "DRAFT" | "PLANNED" | "IN_PROGRESS" | "DONE" | "CANCELLED";

export interface WorkCenter {
  id: string;
  code: string;
  name: string;
  capacityKgPerHourPerWorker: string;
  workingHoursPerDay: string;
  workingDays: number[];
  breakMinutesPerDay: number;
  isActive: boolean;
}

export interface Worker {
  id: string;
  name: string;
  defaultWorkCenterId?: string | null;
  defaultWorkCenter?: WorkCenter | null;
  yieldKgPerHour?: string | null;
  isActive: boolean;
}

export interface ProductionOrder {
  id: string;
  number: string;
  bomId: string;
  bom: BillOfMaterial;
  status: ProductionOrderStatus;
  quantityPlanned: string;
  quantityProduced: string;
  workCenterId?: string | null;
  workCenter?: WorkCenter | null;
  workerCount?: number | null;
  warehouseId?: string | null;
  warehouse?: Warehouse | null;
  plannedStartDate?: string | null;
  plannedEndDate?: string | null;
  actualStartDate?: string | null;
  actualEndDate?: string | null;
  notes?: string | null;
  workers: { workerId: string; worker: Worker }[];
}
