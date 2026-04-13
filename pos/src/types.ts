export type Category = string;
export type Unit = string;
export type SaleType = 'retail' | 'wholesale' | 'price3';
export type PaymentType = 'cash' | 'credit';
export type TransactionType = 'payment' | 'credit';

export interface ProductBatch {
  id: string;
  quantity: number;
  costPrice: number;
  expiryDate?: string;
  receivedDate: any; // Firestore Timestamp
  supplierId?: string;
  supplierName?: string;
}

export interface Product {
  id?: string;
  barcode?: string;
  name: string;
  description?: string;
  category: string;
  priceRetail: number;
  priceWholesale: number;
  price3?: number;
  unit: string;
  unitCapacity?: number;
  higherUnit?: string;
  displayColor?: string;
  stock: number;
  minStock: number;
  costPrice: number; // Average cost price or last cost price for display
  expiryDate?: string; // Earliest expiry date among batches
  tax?: number;
  imageUrl?: string;
  batches?: ProductBatch[];
  createdAt?: any;
}

export interface Customer {
  id?: string;
  customerNumber?: string;
  barcode?: string;
  name: string;
  address?: string;
  taxNumber?: string;
  commercialRegister?: string;
  phone: string;
  email?: string;
  city?: string;
  streetName?: string;
  buildingNumber?: string;
  postalCode?: string;
  cardType?: string;
  cardNumber?: string;
  notes?: string;
  sellingPriceType?: 'retail' | 'wholesale' | 'price3';
  balance: number;
  creditLimit: number;
  maxCreditInvoices?: number;
  creditPeriodDays?: number;
  alertOnDelay?: boolean;
  loyaltyPoints?: number;
  loyaltyDiscount?: number; // Percentage discount for this customer
  imageUrl?: string;
}

export interface SaleItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
  type: SaleType;
  profit: number;
  imageUrl?: string;
  discount?: number;
  discountType?: 'amount' | 'percentage';
  note?: string;
  total?: number;
}

export interface Sale {
  id?: string;
  invoiceNumber?: number;
  timestamp: any; // Firestore Timestamp
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  items: SaleItem[];
  total: number;
  paidAmount: number;
  remainingAmount: number;
  paymentType: PaymentType;
  profit: number;
  note?: string;
  dueDate?: any;
  discountValue?: number;
}

export interface Transaction {
  id?: string;
  timestamp: any;
  customerId: string;
  amount: number;
  type: TransactionType;
  note?: string;
}

export interface SupplierTransaction {
  id?: string;
  timestamp: any;
  supplierId: string;
  amount: number;
  type: 'payment' | 'credit';
  note?: string;
}

export interface Supplier {
  id?: string;
  name: string;
  phone: string;
  balance: number;
  category?: string;
  imageUrl?: string;
}

export interface PurchaseItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
  total: number;
}

export interface Purchase {
  id?: string;
  invoiceNumber?: number;
  timestamp: any; // Firestore Timestamp
  supplierId: string;
  supplierName: string;
  items: PurchaseItem[];
  total: number;
  paidAmount: number;
  remainingAmount: number;
  paymentType: PaymentType;
  note?: string;
}

export interface Expense {
  id?: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  paymentType: PaymentType;
}

export interface UserAccount {
  id?: string;
  uid?: string; // Firebase Auth UID
  username: string;
  name: string;
  role: 'admin' | 'employee';
  phone?: string;
  createdAt: any;
}

export interface Log {
  id?: string;
  type: 'invoice_cancellation' | 'invoice_edit' | 'purchase_edit' | 'purchase_return' | 'sale_return' | 'balance_transfer' | 'damaged_product';
  timestamp: any;
  userEmail?: string;
  details: string;
  amount?: number;
  invoiceNumber?: number;
  [key: string]: any;
}
