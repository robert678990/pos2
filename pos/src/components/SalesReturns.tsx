import React, { useState, useEffect } from 'react';
import { 
  Search, 
  ArrowRight, 
  Undo2, 
  FileText, 
  Package, 
  CheckCircle2, 
  Loader2,
  AlertTriangle,
  History,
  Trash2,
  ChevronLeft
} from 'lucide-react';
import { collection, query, where, getDocs, doc, updateDoc, increment, addDoc, serverTimestamp, Timestamp, writeBatch } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Sale, SaleItem } from '../types';
import { supabaseService } from '../services/supabaseService';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { handleFirestoreError, OperationType } from '../lib/error-handler';

interface SalesReturnsProps {
  onBack: () => void;
}

export default function SalesReturns({ onBack }: SalesReturnsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [sales, setSales] = useState<Sale[]>([]);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [returningItems, setReturningItems] = useState<{[key: string]: number}>({});
  const [submitting, setSubmitting] = useState(false);

  const searchSales = async () => {
    if (!searchTerm) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, 'sales'),
        where('invoiceNumber', '==', parseInt(searchTerm))
      );
      const snapshot = await getDocs(q);
      const salesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Sale[];
      setSales(salesData);
      if (salesData.length === 0) {
        toast.error('لم يتم العثور على فاتورة بهذا الرقم');
      }
    } catch (error) {
      console.error('Error searching sales:', error);
      toast.error('حدث خطأ أثناء البحث');
    } finally {
      setLoading(false);
    }
  };

  const handleReturn = async () => {
    if (!selectedSale) return;
    const itemsToReturn = Object.entries(returningItems).filter(([_, qty]) => (qty as number) > 0);
    if (itemsToReturn.length === 0) {
      toast.error('يرجى تحديد الكميات المراد إرجاعها');
      return;
    }

    setSubmitting(true);
    const batch = writeBatch(db);
    try {
      let totalReturnAmount = 0;
      
      // 1. Update stock and calculate total return amount
      for (const [productId, qty] of itemsToReturn) {
        const item = selectedSale.items.find(i => i.productId === productId);
        if (item) {
          const productRef = doc(db, 'products', productId);
          batch.set(productRef, {
            stock: increment(qty as number)
          }, { merge: true });
          totalReturnAmount += (item.price as number) * (qty as number);
        }
      }

      // 2. Update customer balance if credit
      if (selectedSale.paymentType === 'credit' && selectedSale.customerId) {
        const customerRef = doc(db, 'customers', selectedSale.customerId);
        batch.set(customerRef, {
          balance: increment(-totalReturnAmount)
        }, { merge: true });
      }

      // 3. Record the return
      const returnRef = doc(collection(db, 'sales_returns'));
      const returnData = {
        originalSaleId: selectedSale.id,
        invoiceNumber: selectedSale.invoiceNumber,
        items: itemsToReturn.map(([id, qty]) => {
          const item = selectedSale.items.find(i => i.productId === id);
          return {
            productId: id,
            name: item?.name,
            quantity: qty,
            price: item?.price
          };
        }),
        totalAmount: totalReturnAmount,
        timestamp: serverTimestamp(),
        userEmail: auth.currentUser?.email
      };
      batch.set(returnRef, returnData);

      // 4. Log the return
      const logRef = doc(collection(db, 'logs'));
      batch.set(logRef, {
        type: 'sale_return',
        invoiceId: selectedSale.id,
        invoiceNumber: selectedSale.invoiceNumber,
        amount: totalReturnAmount,
        timestamp: serverTimestamp(),
        userEmail: auth.currentUser?.email,
        details: `إرجاع سلع من فاتورة مبيعات رقم ${selectedSale.invoiceNumber}`
      });

      await batch.commit();
      
      // Sync to Supabase
      supabaseService.syncSaleReturn({ 
        id: returnRef.id, 
        originalSaleId: selectedSale.id!, 
        invoiceNumber: selectedSale.invoiceNumber, 
        items: returnData.items, 
        totalAmount: totalReturnAmount, 
        timestamp: new Date() 
      });

      toast.success('تمت عملية الإرجاع بنجاح');
      onBack();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'sales_returns');
      toast.error('حدث خطأ أثناء معالجة الإرجاع');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 overflow-hidden" dir="rtl">
      {/* Header */}
      <div className="bg-white px-8 py-6 border-b border-slate-200 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-3 hover:bg-slate-100 rounded-2xl transition-colors group"
          >
            <ArrowRight className="w-6 h-6 text-slate-500 group-hover:text-indigo-600" />
          </button>
          <div className="bg-emerald-100 p-3 rounded-2xl">
            <Undo2 className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">إرجاع فاتورة مبيعات</h1>
            <p className="text-slate-500 font-bold text-sm">استرجاع السلع وتعديل الحسابات المالية</p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Side: Search & Selection */}
        <div className="w-1/3 border-l border-slate-200 flex flex-col bg-white">
          <div className="p-6 border-b border-slate-100">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <FileText className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="number"
                  placeholder="رقم الفاتورة..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && searchSales()}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 pr-12 pl-4 text-lg font-bold focus:border-indigo-500 focus:bg-white transition-all outline-none"
                />
              </div>
              <button 
                onClick={searchSales}
                disabled={loading}
                className="bg-indigo-600 text-white p-4 rounded-2xl hover:bg-indigo-700 transition-all disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Search className="w-6 h-6" />}
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
            {sales.map((sale) => (
              <button
                key={sale.id}
                onClick={() => {
                  setSelectedSale(sale);
                  const initialReturns: {[key: string]: number} = {};
                  sale.items.forEach(item => initialReturns[item.productId] = 0);
                  setReturningItems(initialReturns);
                }}
                className={cn(
                  "w-full p-6 rounded-3xl border-2 transition-all text-right space-y-3",
                  selectedSale?.id === sale.id 
                    ? "border-indigo-600 bg-indigo-50 shadow-md" 
                    : "border-slate-100 hover:border-indigo-200 hover:bg-slate-50"
                )}
              >
                <div className="flex justify-between items-center">
                  <span className="font-black text-indigo-600 text-lg">#{sale.invoiceNumber}</span>
                  <span className="text-xs font-bold text-slate-400">
                    {sale.timestamp ? format(sale.timestamp.toDate(), 'yyyy-MM-dd') : ''}
                  </span>
                </div>
                <div className="font-bold text-slate-800">{sale.customerName || 'زبون عام'}</div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest">الإجمالي</span>
                  <span className="font-black text-slate-900">{(sale.total || 0).toFixed(2)} DH</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right Side: Return Details */}
        <div className="flex-1 p-10 overflow-y-auto custom-scrollbar">
          {selectedSale ? (
            <div className="max-w-4xl mx-auto space-y-8">
              <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-xl shadow-slate-200/50 space-y-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="bg-emerald-50 p-4 rounded-2xl">
                      <Undo2 className="w-8 h-8 text-emerald-600" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-slate-800">تفاصيل الإرجاع</h2>
                      <p className="text-slate-500 font-bold">حدد الكميات المراد إرجاعها من الفاتورة #{selectedSale.invoiceNumber}</p>
                    </div>
                  </div>
                  <div className="text-left">
                    <div className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">طريقة الدفع الأصلية</div>
                    <div className={cn(
                      "px-4 py-1.5 rounded-xl font-black text-sm inline-block",
                      selectedSale.paymentType === 'cash' ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                    )}>
                      {selectedSale.paymentType === 'cash' ? 'نقداً' : 'أجل'}
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-3xl border border-slate-100 overflow-hidden">
                  <table className="w-full text-right">
                    <thead className="bg-slate-100/50 border-b border-slate-200">
                      <tr>
                        <th className="p-5 text-xs font-black text-slate-400 uppercase tracking-widest">المنتج</th>
                        <th className="p-5 text-xs font-black text-slate-400 uppercase tracking-widest text-center">الكمية الأصلية</th>
                        <th className="p-5 text-xs font-black text-slate-400 uppercase tracking-widest text-center">الكمية المرجعة</th>
                        <th className="p-5 text-xs font-black text-slate-400 uppercase tracking-widest text-left">مبلغ الإرجاع</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {selectedSale.items.map((item) => (
                        <tr key={item.productId}>
                          <td className="p-5">
                            <div className="font-black text-slate-800">{item.name}</div>
                            <div className="text-xs font-bold text-slate-400">{(item.price || 0).toFixed(2)} DH لكل وحدة</div>
                          </td>
                          <td className="p-5 text-center font-black text-slate-600">{item.quantity}</td>
                          <td className="p-5">
                            <div className="flex items-center justify-center gap-3">
                              <button 
                                onClick={() => setReturningItems(prev => ({
                                  ...prev,
                                  [item.productId]: Math.max(0, (prev[item.productId] || 0) - 1)
                                }))}
                                className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center font-black hover:bg-slate-50 transition-colors"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                value={returningItems[item.productId] || 0}
                                onChange={(e) => setReturningItems(prev => ({
                                  ...prev,
                                  [item.productId]: Math.min(item.quantity, Math.max(0, parseInt(e.target.value) || 0))
                                }))}
                                className="w-16 h-10 bg-white border border-slate-200 rounded-xl text-center font-black focus:border-indigo-500 transition-all outline-none"
                              />
                              <button 
                                onClick={() => setReturningItems(prev => ({
                                  ...prev,
                                  [item.productId]: Math.min(item.quantity, (prev[item.productId] || 0) + 1)
                                }))}
                                className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center font-black hover:bg-slate-50 transition-colors"
                              >
                                +
                              </button>
                            </div>
                          </td>
                          <td className="p-5 text-left font-black text-emerald-600">
                            {((returningItems[item.productId] || 0) * (item.price || 0)).toFixed(2)} DH
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between p-8 bg-slate-900 rounded-[32px] text-white">
                  <div>
                    <div className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">إجمالي مبلغ الإرجاع</div>
                    <div className="text-4xl font-black text-emerald-400">
                      {(Object.entries(returningItems).reduce((sum, [id, qty]) => {
                        const item = selectedSale.items.find(i => i.productId === id);
                        return sum + (item?.price || 0) * (qty as number);
                      }, 0) || 0).toFixed(2)} <span className="text-sm">درهم</span>
                    </div>
                  </div>
                  <button
                    onClick={handleReturn}
                    disabled={submitting}
                    className="bg-emerald-500 text-white px-10 py-5 rounded-2xl font-black text-xl hover:bg-emerald-600 transition-all shadow-xl shadow-emerald-500/20 flex items-center gap-4 disabled:opacity-50"
                  >
                    {submitting ? <Loader2 className="w-6 h-6 animate-spin" /> : <CheckCircle2 className="w-6 h-6" />}
                    تأكيد الإرجاع
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-6">
              <div className="bg-slate-100 p-10 rounded-[40px]">
                <FileText className="w-20 h-20 text-slate-300" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-400">ابحث عن فاتورة للبدء</h3>
                <p className="text-slate-400 font-bold">قم بإدخال رقم الفاتورة في خانة البحث الجانبية</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
