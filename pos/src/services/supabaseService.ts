import { supabase } from '../supabase';
import { Product, Sale, Category, Customer, Purchase, Supplier } from '../types';

function isSupabaseEnabled(): boolean {
  const config = localStorage.getItem('supabase_config');
  if (!config) return false;
  try {
    const parsed = JSON.parse(config);
    return !!(supabase && parsed?.isActive);
  } catch (e) {
    return false;
  }
}

export const supabaseService = {
  // Products
  async syncProduct(product: Product) {
    if (!isSupabaseEnabled()) return { data: null, error: new Error('Supabase client not initialized or inactive') };
    const { data, error } = await supabase!
      .from('products')
      .upsert({
        id: product.id,
        name: product.name,
        barcode: product.barcode,
        category: product.category,
        price_retail: product.priceRetail,
        price_wholesale: product.priceWholesale,
        cost_price: product.costPrice,
        stock: product.stock,
        min_stock: product.minStock,
        unit: product.unit,
        image: product.imageUrl
      });
    if (error) console.error('Supabase Product Sync Error:', error);
    return { data, error };
  },

  // Sales
  async syncSale(sale: Sale) {
    if (!isSupabaseEnabled()) return { data: null, error: new Error('Supabase client not initialized or inactive') };
    const { data, error } = await supabase!
      .from('sales')
      .upsert({
        id: sale.id,
        invoice_number: sale.invoiceNumber,
        total: sale.total,
        payment_type: sale.paymentType,
        customer_name: sale.customerName,
        paid: sale.paidAmount,
        change: sale.remainingAmount,
        profit: sale.profit,
        items: JSON.stringify(sale.items),
        created_at: sale.timestamp instanceof Date ? sale.timestamp.toISOString() : new Date().toISOString()
      });
    if (error) console.error('Supabase Sale Sync Error:', error);
    return { data, error };
  },

  // Categories
  async syncCategory(category: { id?: string, name: string }) {
    if (!isSupabaseEnabled()) return { data: null, error: new Error('Supabase client not initialized or inactive') };
    const { data, error } = await supabase!
      .from('categories')
      .upsert({
        id: category.id,
        name: category.name
      });
    if (error) console.error('Supabase Category Sync Error:', error);
    return { data, error };
  },

  // Customers
  async syncCustomer(customer: Customer) {
    if (!isSupabaseEnabled()) return { data: null, error: new Error('Supabase client not initialized or inactive') };
    const { data, error } = await supabase!
      .from('customers')
      .upsert({
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        address: customer.address,
        balance: customer.balance
      });
    if (error) console.error('Supabase Customer Sync Error:', error);
    return { data, error };
  },

  // Purchases
  async syncPurchase(purchase: Purchase) {
    if (!isSupabaseEnabled()) return { data: null, error: new Error('Supabase client not initialized or inactive') };
    const { data, error } = await supabase!
      .from('purchases')
      .upsert({
        id: purchase.id,
        invoice_number: purchase.invoiceNumber,
        supplier_name: purchase.supplierName,
        total: purchase.total,
        paid: purchase.paidAmount,
        payment_type: purchase.paymentType,
        items: JSON.stringify(purchase.items),
        created_at: purchase.timestamp instanceof Date ? purchase.timestamp.toISOString() : new Date().toISOString()
      });
    if (error) console.error('Supabase Purchase Sync Error:', error);
    return { data, error };
  },

  // Suppliers
  async syncSupplier(supplier: Supplier) {
    if (!isSupabaseEnabled()) return { data: null, error: new Error('Supabase client not initialized or inactive') };
    const { data, error } = await supabase!
      .from('suppliers')
      .upsert({
        id: supplier.id,
        name: supplier.name,
        phone: supplier.phone,
        balance: supplier.balance
      });
    if (error) console.error('Supabase Supplier Sync Error:', error);
    return { data, error };
  },

  // Sales Returns
  async syncSaleReturn(returnData: any) {
    if (!isSupabaseEnabled()) return { data: null, error: new Error('Supabase client not initialized or inactive') };
    const { data, error } = await supabase!
      .from('sales_returns')
      .upsert({
        id: returnData.id,
        original_sale_id: returnData.originalSaleId,
        invoice_number: returnData.invoiceNumber,
        items: JSON.stringify(returnData.items),
        total_amount: returnData.totalAmount,
        created_at: returnData.timestamp instanceof Date ? returnData.timestamp.toISOString() : new Date().toISOString()
      });
    if (error) console.error('Supabase Sale Return Sync Error:', error);
    return { data, error };
  },

  // Purchase Returns
  async syncPurchaseReturn(returnData: any) {
    if (!isSupabaseEnabled()) return { data: null, error: new Error('Supabase client not initialized or inactive') };
    const { data, error } = await supabase!
      .from('purchase_returns')
      .upsert({
        id: returnData.id,
        original_purchase_id: returnData.originalPurchaseId,
        invoice_number: returnData.invoiceNumber,
        items: JSON.stringify(returnData.items),
        total_amount: returnData.totalAmount,
        created_at: returnData.timestamp instanceof Date ? returnData.timestamp.toISOString() : new Date().toISOString()
      });
    if (error) console.error('Supabase Purchase Return Sync Error:', error);
    return { data, error };
  },

  // Damaged Products
  async syncDamagedProduct(damagedData: any) {
    if (!isSupabaseEnabled()) return { data: null, error: new Error('Supabase client not initialized or inactive') };
    const { data, error } = await supabase!
      .from('damaged_products')
      .upsert({
        id: damagedData.id,
        product_id: damagedData.productId,
        product_name: damagedData.productName,
        quantity: damagedData.quantity,
        reason: damagedData.reason,
        cost_price: damagedData.costPrice,
        total_loss: damagedData.totalLoss,
        created_at: damagedData.timestamp instanceof Date ? damagedData.timestamp.toISOString() : new Date().toISOString()
      });
    if (error) console.error('Supabase Damaged Product Sync Error:', error);
    return { data, error };
  },

  // Expenses
  async syncExpense(expense: any) {
    if (!isSupabaseEnabled()) return { data: null, error: new Error('Supabase client not initialized or inactive') };
    const { data, error } = await supabase!
      .from('expenses')
      .upsert({
        id: expense.id,
        category: expense.category,
        amount: expense.amount,
        description: expense.description,
        created_at: expense.timestamp instanceof Date ? expense.timestamp.toISOString() : new Date().toISOString()
      });
    if (error) console.error('Supabase Expense Sync Error:', error);
    return { data, error };
  },

  // Box Sessions
  async syncBoxSession(session: any) {
    if (!isSupabaseEnabled()) return { data: null, error: new Error('Supabase client not initialized or inactive') };
    const { data, error } = await supabase!
      .from('box_sessions')
      .upsert({
        id: session.id,
        opening_amount: session.openingAmount || session.startBalance,
        closing_amount: session.closingAmount || session.endBalance,
        status: session.status,
        opened_at: session.openedAt || session.startTime ? new Date((session.openedAt || session.startTime)?.toDate?.() ?? (session.openedAt || session.startTime)).toISOString() : null,
        closed_at: session.closedAt || session.endTime ? new Date((session.closedAt || session.endTime)?.toDate?.() ?? (session.closedAt || session.endTime)).toISOString() : null,
      });
    if (error) console.error('Supabase Box Session Sync Error:', error);
    return { data, error };
  },

  // Box Transactions
  async syncBoxTransaction(tx: any) {
    if (!isSupabaseEnabled()) return { data: null, error: new Error('Supabase client not initialized or inactive') };
    const { data, error } = await supabase!
      .from('box_transactions')
      .upsert({
        id: tx.id,
        session_id: tx.sessionId,
        type: tx.type,
        amount: tx.amount,
        note: tx.note || tx.description,
        timestamp: tx.timestamp ? new Date(tx.timestamp?.toDate?.() ?? tx.timestamp).toISOString() : null,
      });
    if (error) console.error('Supabase Box Transaction Sync Error:', error);
    return { data, error };
  }
};
