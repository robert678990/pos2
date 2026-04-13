import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Calendar, 
  FileX, 
  Printer,
  ArrowRight,
  ShoppingCart,
  Trash2,
  AlertTriangle,
  History,
  X,
  CheckCircle2
} from 'lucide-react';
import { collection, query, where, orderBy, getDocs, Timestamp, onSnapshot, doc, deleteDoc, increment, updateDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Sale, Product } from '../types';
import { format, startOfDay, endOfDay, startOfMonth } from 'date-fns';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { handleFirestoreError, OperationType } from '../lib/error-handler';

interface CancelInvoiceProps {
  onBack: () => void;
}

export default function CancelInvoice({ onBack }: CancelInvoiceProps) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfDay(new Date()), 'yyyy-MM-dd'));
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmModal, setConfirmModal] = useState<Sale | null>(null);

  useEffect(() => {
    const start = startOfDay(new Date(startDate));
    const end = endOfDay(new Date(endDate));

    const q = query(
      collection(db, 'sales'),
      where('timestamp', '>=', Timestamp.fromDate(start)),
      where('timestamp', '<=', Timestamp.fromDate(end)),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const salesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Sale));
      setSales(salesData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'sales');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [startDate, endDate]);

  const filteredSales = sales.filter(sale => 
    sale.invoiceNumber?.toString().includes(search) ||
    sale.customerName?.toLowerCase().includes(search.toLowerCase()) ||
    (sale.total || 0).toString().includes(search)
  );

  const handleCancelInvoice = async (sale: Sale) => {
    setIsProcessing(true);
    const batch = writeBatch(db);

    try {
      // 1. Revert stock for each item
      for (const item of sale.items) {
        const productRef = doc(db, 'products', item.productId);
        batch.set(productRef, {
          stock: increment(item.quantity)
        }, { merge: true });
      }

      // 2. Revert customer balance if it was a credit sale
      if (sale.paymentType === 'credit' && sale.customerId) {
        const remainingAmount = (sale.total || 0) - (sale.paidAmount || 0);
        const customerRef = doc(db, 'customers', sale.customerId);
        batch.set(customerRef, {
          balance: increment(-remainingAmount)
        }, { merge: true });

        // Find and delete the corresponding transaction
        const transQ = query(
          collection(db, 'transactions'),
          where('customerId', '==', sale.customerId),
          where('amount', '==', remainingAmount),
          where('type', '==', 'credit')
        );
        const transSnap = await getDocs(transQ);
        transSnap.docs.forEach(d => {
          batch.delete(d.ref);
        });
      }

      // 3. Log the cancellation in a new 'logs' collection
      const logRef = doc(collection(db, 'logs'));
      batch.set(logRef, {
        type: 'invoice_cancellation',
        invoiceId: sale.id,
        invoiceNumber: sale.invoiceNumber,
        amount: sale.total,
        timestamp: serverTimestamp(),
        userEmail: auth.currentUser?.email,
        details: `إلغاء فاتورة مبيعات رقم ${sale.invoiceNumber} بقيمة ${sale.total} DH`
      });

      // 4. Delete the sale record
      batch.delete(doc(db, 'sales', sale.id!));

      await batch.commit();
      toast.success('تم إلغاء الفاتورة بنجاح واسترجاع الكميات للمخزن');
      setConfirmModal(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `sales/${sale.id}`);
      toast.error('حدث خطأ أثناء إلغاء الفاتورة');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 overflow-hidden" dir="rtl">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 p-6 shadow-sm z-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <button 
              onClick={onBack}
              className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors"
            >
              <ArrowRight className="w-6 h-6" />
            </button>
            <div className="bg-red-600 p-3 rounded-2xl text-white shadow-lg shadow-red-200">
              <FileX className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-3xl font-black text-slate-800">إلغاء فاتورة مبيعات</h2>
              <p className="text-slate-500 font-bold">إلغاء الفواتير واسترجاع الكميات للمخزن</p>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-slate-100 p-2 rounded-2xl border border-slate-200">
            <div className="flex items-center gap-2 px-3 border-l border-slate-200">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-black text-slate-500">من:</span>
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent text-sm font-black text-slate-700 outline-none"
              />
            </div>
            <div className="flex items-center gap-2 px-3">
              <span className="text-xs font-black text-slate-500">إلى:</span>
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent text-sm font-black text-slate-700 outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="p-6">
        <div className="relative max-w-2xl">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            type="text"
            placeholder="بحث برقم الفاتورة أو اسم الزبون..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pr-12 pl-4 py-4 bg-white border border-slate-200 rounded-2xl font-bold text-slate-700 focus:ring-2 focus:ring-red-500 outline-none shadow-sm transition-all"
          />
        </div>
      </div>

      {/* Sales List */}
      <div className="flex-1 overflow-y-auto px-6 pb-6 custom-scrollbar">
        <div className="bg-white rounded-[40px] shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-right">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest">رقم الفاتورة</th>
                <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-center">التاريخ</th>
                <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest">الزبون</th>
                <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-center">طريقة الدفع</th>
                <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-left">الإجمالي</th>
                <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-20 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-slate-500 font-black">جاري جلب الفواتير...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-20 text-center text-slate-300 italic font-bold">
                    لا توجد فواتير مطابقة للبحث
                  </td>
                </tr>
              ) : (
                filteredSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="p-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                          <ShoppingCart className="w-5 h-5 text-slate-400" />
                        </div>
                        <span className="font-black text-slate-700">#{sale.invoiceNumber}</span>
                      </div>
                    </td>
                    <td className="p-6 text-center">
                      <div className="text-sm font-bold text-slate-500">
                        {format(sale.timestamp.toDate(), 'yyyy-MM-dd')}
                      </div>
                      <div className="text-[10px] text-slate-400 font-bold">
                        {format(sale.timestamp.toDate(), 'HH:mm:ss')}
                      </div>
                    </td>
                    <td className="p-6">
                      <span className="font-bold text-slate-700">{sale.customerName || 'زبون نقدي'}</span>
                    </td>
                    <td className="p-6 text-center">
                      <span className={cn(
                        "px-4 py-1.5 rounded-xl text-[10px] font-black",
                        sale.paymentType === 'cash' ? "bg-emerald-50 text-emerald-600" :
                        sale.paymentType === 'credit' ? "bg-red-50 text-red-600" :
                        "bg-indigo-50 text-indigo-600"
                      )}>
                        {sale.paymentType === 'cash' ? 'نقداً' :
                         sale.paymentType === 'credit' ? 'أجل' : 'بطاقة'}
                      </span>
                    </td>
                    <td className="p-6 text-left">
                      <span className="font-black text-slate-800">{(sale.total || 0).toFixed(2)}</span>
                    </td>
                    <td className="p-6">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => setConfirmModal(sale)}
                          className="p-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-600 hover:text-white transition-all shadow-sm"
                          title="إلغاء الفاتورة"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmModal(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white rounded-[40px] shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100"
            >
              <div className="p-8">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 bg-red-100 rounded-[24px] flex items-center justify-center">
                    <AlertTriangle className="w-8 h-8 text-red-600" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-800">تأكيد إلغاء الفاتورة</h3>
                    <p className="text-slate-500 font-bold">هل أنت متأكد من إلغاء الفاتورة رقم #{confirmModal.invoiceNumber}؟</p>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-3xl p-6 mb-8 space-y-4">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500 font-bold">الزبون:</span>
                    <span className="text-slate-800 font-black">{confirmModal.customerName || 'زبون نقدي'}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500 font-bold">الإجمالي:</span>
                    <span className="text-slate-800 font-black">{(confirmModal.total || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500 font-bold">التاريخ:</span>
                    <span className="text-slate-800 font-black">{format(confirmModal.timestamp.toDate(), 'yyyy-MM-dd HH:mm')}</span>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={() => handleCancelInvoice(confirmModal)}
                    disabled={isProcessing}
                    className="flex-1 bg-red-600 text-white py-4 rounded-2xl font-black text-lg hover:bg-red-700 transition-all shadow-lg shadow-red-200 disabled:opacity-50 flex items-center justify-center gap-3"
                  >
                    {isProcessing ? (
                      <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <>
                        <Trash2 className="w-5 h-5" />
                        تأكيد الإلغاء
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setConfirmModal(null)}
                    disabled={isProcessing}
                    className="flex-1 bg-slate-100 text-slate-600 py-4 rounded-2xl font-black text-lg hover:bg-slate-200 transition-all disabled:opacity-50"
                  >
                    تراجع
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
