import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Calendar, 
  FileX, 
  Trash2,
  ArrowRight,
  AlertTriangle,
  History,
  Undo2,
  CheckCircle2
} from 'lucide-react';
import { collection, query, where, orderBy, getDocs, Timestamp, onSnapshot, doc, deleteDoc, increment, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { format, startOfDay, endOfDay, startOfMonth } from 'date-fns';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { handleFirestoreError, OperationType } from '../lib/error-handler';

interface CancelReturnProps {
  onBack: () => void;
}

export default function CancelReturn({ onBack }: CancelReturnProps) {
  const [returns, setReturns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfDay(new Date()), 'yyyy-MM-dd'));
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmModal, setConfirmModal] = useState<any | null>(null);

  useEffect(() => {
    const start = startOfDay(new Date(startDate));
    const end = endOfDay(new Date(endDate));

    const q = query(
      collection(db, 'sales_returns'),
      where('timestamp', '>=', Timestamp.fromDate(start)),
      where('timestamp', '<=', Timestamp.fromDate(end)),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setReturns(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'sales_returns');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [startDate, endDate]);

  const filteredReturns = returns.filter(r => 
    r.invoiceNumber?.toString().includes(search) ||
    (r.totalAmount || 0).toString().includes(search)
  );

  const handleCancelReturn = async (ret: any) => {
    setIsProcessing(true);
    const batch = writeBatch(db);

    try {
      // 1. Revert stock (decrease stock)
      for (const item of ret.items) {
        const productRef = doc(db, 'products', item.productId);
        batch.set(productRef, {
          stock: increment(-item.quantity)
        }, { merge: true });
      }

      // 2. Revert customer balance if the original sale was credit
      // We need to find the original sale to know if it was credit.
      // Or we can assume that if totalAmount was deducted from balance, we should add it back.
      // The SalesReturns.tsx logic: if (selectedSale.paymentType === 'credit') { balance: increment(-totalReturnAmount) }
      // So to cancel, we should increment(totalReturnAmount).
      // But we need the customerId. Let's check if SalesReturns stores it.
      // It doesn't seem to store customerId in sales_returns.
      // I should check if I can find the original sale.
      
      const saleRef = doc(db, 'sales', ret.originalSaleId);
      const saleSnap = await getDocs(query(collection(db, 'sales'), where('__name__', '==', ret.originalSaleId)));
      
      if (!saleSnap.empty) {
        const saleData = saleSnap.docs[0].data();
        if (saleData.paymentType === 'credit' && saleData.customerId) {
          const customerRef = doc(db, 'customers', saleData.customerId);
          batch.set(customerRef, {
            balance: increment(ret.totalAmount)
          }, { merge: true });
        }
      }

      // 3. Log the cancellation
      const logRef = doc(collection(db, 'logs'));
      batch.set(logRef, {
        type: 'return_cancellation',
        returnId: ret.id,
        invoiceNumber: ret.invoiceNumber,
        amount: ret.totalAmount,
        timestamp: Timestamp.now(),
        details: `إلغاء مرتجع مبيعات للفاتورة رقم ${ret.invoiceNumber}`
      });

      // 4. Delete the return record
      batch.delete(doc(db, 'sales_returns', ret.id));

      await batch.commit();
      toast.success('تم إلغاء المرتجع بنجاح وتعديل الكميات والأرصدة');
      setConfirmModal(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `sales_returns/${ret.id}`);
      toast.error('حدث خطأ أثناء إلغاء المرتجع');
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
            <div className="bg-orange-500 p-3 rounded-2xl text-white shadow-lg shadow-orange-200">
              <FileX className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-3xl font-black text-slate-800">إلغاء مرتجع مبيعات</h2>
              <p className="text-slate-500 font-bold">إلغاء عمليات الإرجاع واستعادة حالة المخزن</p>
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
            placeholder="بحث برقم الفاتورة أو المبلغ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pr-12 pl-4 py-4 bg-white border border-slate-200 rounded-2xl font-bold text-slate-700 focus:ring-2 focus:ring-orange-500 outline-none shadow-sm transition-all"
          />
        </div>
      </div>

      {/* Returns List */}
      <div className="flex-1 overflow-y-auto px-6 pb-6 custom-scrollbar">
        <div className="bg-white rounded-[40px] shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-right">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest">التاريخ</th>
                <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest">رقم الفاتورة الأصلية</th>
                <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest">المنتجات المرجعة</th>
                <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-left">إجمالي المرتجع</th>
                <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-20 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-12 h-12 border-4 border-orange-600 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-slate-500 font-black">جاري جلب المرتجعات...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredReturns.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-20 text-center text-slate-300 italic font-bold">
                    لا توجد عمليات إرجاع مطابقة للبحث
                  </td>
                </tr>
              ) : (
                filteredReturns.map((ret) => (
                  <tr key={ret.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="p-6">
                      <div className="text-sm font-bold text-slate-500">
                        {format(ret.timestamp.toDate(), 'yyyy-MM-dd')}
                      </div>
                      <div className="text-[10px] text-slate-400 font-bold">
                        {format(ret.timestamp.toDate(), 'HH:mm:ss')}
                      </div>
                    </td>
                    <td className="p-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                          <Undo2 className="w-5 h-5 text-slate-400" />
                        </div>
                        <span className="font-black text-slate-700">#{ret.invoiceNumber}</span>
                      </div>
                    </td>
                    <td className="p-6">
                      <div className="flex flex-wrap gap-2">
                        {ret.items.map((item: any, idx: number) => (
                          <span key={idx} className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold">
                            {item.name} ({item.quantity})
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-6 text-left">
                      <span className="font-black text-slate-800">{(ret.totalAmount || 0).toFixed(2)}</span>
                    </td>
                    <td className="p-6">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => setConfirmModal(ret)}
                          className="p-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-600 hover:text-white transition-all shadow-sm"
                          title="إلغاء المرتجع"
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
                    <h3 className="text-2xl font-black text-slate-800">تأكيد إلغاء المرتجع</h3>
                    <p className="text-slate-500 font-bold">هل أنت متأكد من إلغاء هذا المرتجع؟ سيتم خصم الكميات من المخزن وتعديل الرصيد.</p>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-3xl p-6 mb-8 space-y-4">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500 font-bold">رقم الفاتورة:</span>
                    <span className="text-slate-800 font-black">#{confirmModal.invoiceNumber}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500 font-bold">المبلغ:</span>
                    <span className="text-slate-800 font-black">{(confirmModal.totalAmount || 0).toFixed(2)}</span>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={() => handleCancelReturn(confirmModal)}
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
