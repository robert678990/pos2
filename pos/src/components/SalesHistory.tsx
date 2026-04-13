import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Calendar, 
  ChevronDown, 
  ChevronLeft, 
  FileText, 
  Printer,
  Filter,
  ArrowRight,
  ShoppingCart,
  Eye,
  Trash2,
  Download,
  X,
  CheckCircle2,
  AlertTriangle,
  Banknote,
  CreditCard,
  User
} from 'lucide-react';
import { collection, query, where, orderBy, getDocs, Timestamp, onSnapshot, doc, deleteDoc, limit, increment, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { Sale, SaleItem } from '../types';
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth, subDays } from 'date-fns';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import Receipt from './Receipt';
import { toast } from 'sonner';
import { handleFirestoreError, OperationType } from '../lib/error-handler';

export default function SalesHistory() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfDay(new Date()), 'yyyy-MM-dd'));
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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
    sale.total.toString().includes(search)
  );

  const handleDeleteSale = async (sale: Sale) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه الفاتورة؟ سيتم استرجاع السلع للمخزن وتعديل حساب الزبون.')) return;

    setIsDeleting(true);
    try {
      const batch = writeBatch(db);

      // 1. Revert stock
      for (const item of sale.items) {
        const productRef = doc(db, 'products', item.productId);
        batch.set(productRef, {
          stock: increment(item.quantity)
        }, { merge: true });
      }

      // 2. Revert customer balance if credit
      if (sale.paymentType === 'credit' && sale.customerId) {
        const remainingAmount = sale.total - (sale.paidAmount || 0);
        const customerRef = doc(db, 'customers', sale.customerId);
        batch.set(customerRef, {
          balance: increment(-remainingAmount)
        }, { merge: true });

        // 3. Delete the corresponding transaction
        const q = query(
          collection(db, 'transactions'),
          where('customerId', '==', sale.customerId),
          where('amount', '==', remainingAmount),
          where('type', '==', 'credit')
        );
        const transSnapshot = await getDocs(q);
        // We look for the one with the matching invoice number in the note
        const transDoc = transSnapshot.docs.find(d => d.data().note?.includes(`#${sale.invoiceNumber}`));
        if (transDoc) {
          batch.delete(doc(db, 'transactions', transDoc.id));
        }
      }

      // 4. Delete the sale document
      batch.delete(doc(db, 'sales', sale.id!));
      
      await batch.commit();

      toast.success('تم حذف الفاتورة واسترجاع السلع بنجاح');
      setShowDetails(false);
    } catch (error) {
      console.error('Error deleting sale:', error);
      toast.error('حدث خطأ أثناء حذف الفاتورة');
      handleFirestoreError(error, OperationType.DELETE, `sales/${sale.id}`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="p-8 pb-32 max-w-7xl mx-auto" dir="rtl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <h1 className="text-4xl font-black text-slate-900 mb-2 tracking-tight">تتبع المبيعات</h1>
          <p className="text-slate-500 font-bold">عرض وإدارة جميع عمليات البيع السابقة</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-1">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-4 py-2 text-sm font-bold text-slate-600 bg-transparent border-none focus:ring-0"
            />
            <div className="w-px h-4 bg-slate-200 mx-1" />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-4 py-2 text-sm font-bold text-slate-600 bg-transparent border-none focus:ring-0"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 mb-10">
        <div className="lg:col-span-3">
          <div className="bg-white rounded-[40px] shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
              <div className="relative">
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="البحث برقم الفاتورة أو اسم الزبون..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pr-12 pl-6 py-4 bg-white border-2 border-slate-100 rounded-2xl focus:border-indigo-500 focus:ring-0 transition-all font-bold text-slate-900"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest">الفاتورة</th>
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
                          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                          <p className="text-slate-500 font-bold">جاري تحميل المبيعات...</p>
                        </div>
                      </td>
                    </tr>
                  ) : filteredSales.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-20 text-center text-slate-300 italic font-bold">
                        لا توجد عمليات بيع في هذه الفترة
                      </td>
                    </tr>
                  ) : (
                    filteredSales.map((sale) => (
                      <tr key={sale.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="p-6 font-black text-indigo-600">#{sale.invoiceNumber}</td>
                        <td className="p-6 text-center font-bold text-slate-600">
                          {sale.timestamp ? format(sale.timestamp.toDate(), 'yyyy-MM-dd HH:mm') : '...'}
                        </td>
                        <td className="p-6">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                              <User className="w-4 h-4 text-slate-400" />
                            </div>
                            <span className="font-bold text-slate-800">{sale.customerName || 'زبون عام'}</span>
                          </div>
                        </td>
                        <td className="p-6 text-center">
                          <span className={cn(
                            "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1.5",
                            sale.paymentType === 'cash' ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                          )}>
                            {sale.paymentType === 'cash' ? <Banknote className="w-3 h-3" /> : <CreditCard className="w-3 h-3" />}
                            {sale.paymentType === 'cash' ? 'نقداً' : 'أجل'}
                          </span>
                        </td>
                        <td className="p-6 text-left font-black text-slate-900">{(sale.total || 0).toFixed(2)}</td>
                        <td className="p-6">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => {
                                setSelectedSale(sale);
                                setShowDetails(true);
                              }}
                              className="p-2 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 rounded-xl transition-all"
                              title="عرض التفاصيل"
                            >
                              <Eye className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedSale(sale);
                                setShowReceipt(true);
                              }}
                              className="p-2 hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 rounded-xl transition-all"
                              title="طباعة"
                            >
                              <Printer className="w-5 h-5" />
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
        </div>

        <div className="space-y-6">
          <div className="bg-indigo-600 rounded-[40px] p-8 text-white shadow-xl shadow-indigo-900/20">
            <div className="flex items-center gap-4 mb-6">
              <div className="bg-white/20 p-3 rounded-2xl">
                <ShoppingCart className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-black">ملخص الفترة</h3>
            </div>
            
            <div className="space-y-6">
              <div>
                <p className="text-indigo-200 text-xs font-black uppercase tracking-widest mb-1">إجمالي المبيعات</p>
                <p className="text-3xl font-black">
                  {(filteredSales.reduce((sum, s) => sum + (s.total || 0), 0)).toFixed(2)}
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-indigo-200 text-[10px] font-black uppercase tracking-widest mb-1">عدد الفواتير</p>
                  <p className="text-xl font-black">{filteredSales.length}</p>
                </div>
                <div>
                  <p className="text-indigo-200 text-[10px] font-black uppercase tracking-widest mb-1">إجمالي الربح</p>
                  <p className="text-xl font-black">
                    {filteredSales.reduce((sum, s) => sum + (s.profit || 0), 0).toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-[40px] p-8 border border-slate-200 shadow-sm">
            <h3 className="text-lg font-black text-slate-900 mb-6">إحصائيات الدفع</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-2xl">
                <div className="flex items-center gap-3">
                  <Banknote className="w-5 h-5 text-emerald-600" />
                  <span className="font-bold text-emerald-900">نقداً</span>
                </div>
                <span className="font-black text-emerald-600">
                  {(filteredSales.filter(s => s.paymentType === 'cash').reduce((sum, s) => sum + (s.total || 0), 0)).toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between p-4 bg-red-50 rounded-2xl">
                <div className="flex items-center gap-3">
                  <CreditCard className="w-5 h-5 text-red-600" />
                  <span className="font-bold text-red-900">أجل</span>
                </div>
                <span className="font-black text-red-600">
                  {(filteredSales.filter(s => s.paymentType === 'credit').reduce((sum, s) => sum + (s.total || 0), 0)).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Details Modal */}
      <AnimatePresence>
        {showDetails && selectedSale && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDetails(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-[40px] shadow-2xl w-full max-w-3xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-4">
                  <div className="bg-indigo-600 p-3 rounded-2xl shadow-lg shadow-indigo-200">
                    <FileText className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-slate-900">تفاصيل الفاتورة #{selectedSale.invoiceNumber}</h2>
                    <p className="text-slate-500 font-bold">
                      {selectedSale.timestamp ? format(selectedSale.timestamp.toDate(), 'yyyy-MM-dd HH:mm') : '...'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowDetails(false)}
                  className="p-3 hover:bg-white rounded-2xl text-slate-400 hover:text-slate-600 transition-all shadow-sm"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-2 gap-8 mb-8">
                  <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2">معلومات الزبون</p>
                    <p className="text-lg font-black text-slate-900">{selectedSale.customerName || 'زبون عام'}</p>
                    <p className="text-slate-500 font-bold text-sm mt-1">طريقة الدفع: {selectedSale.paymentType === 'cash' ? 'نقداً' : 'أجل'}</p>
                  </div>
                  <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2">ملخص مالي</p>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-slate-500 font-bold">الإجمالي:</span>
                      <span className="font-black text-slate-900">{(selectedSale.total || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-bold">المدفوع:</span>
                      <span className="font-black text-emerald-600">{(selectedSale.paidAmount || 0).toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden">
                  <table className="w-full text-right">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                        <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest">المنتج</th>
                        <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest text-center">الكمية</th>
                        <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest text-center">السعر</th>
                        <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest text-left">المجموع</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedSale.items.map((item, idx) => (
                        <tr key={idx}>
                          <td className="p-4 font-bold text-slate-800">{item.name}</td>
                          <td className="p-4 text-center font-black text-slate-600">{item.quantity}</td>
                          <td className="p-4 text-center font-bold text-slate-600">{(item.price || 0).toFixed(2)}</td>
                          <td className="p-4 text-left font-black text-slate-900">{((item.quantity || 0) * (item.price || 0)).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {selectedSale.note && (
                  <div className="mt-8 p-6 bg-amber-50 rounded-3xl border border-amber-100">
                    <p className="text-amber-800 font-bold text-sm italic">ملاحظة: {selectedSale.note}</p>
                  </div>
                )}
              </div>

              <div className="p-8 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                <button
                  onClick={() => handleDeleteSale(selectedSale)}
                  disabled={isDeleting}
                  className="flex items-center gap-2 px-6 py-3 bg-red-50 text-red-600 font-black rounded-2xl hover:bg-red-100 transition-all disabled:opacity-50"
                >
                  <Trash2 className="w-5 h-5" />
                  حذف الفاتورة
                </button>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setShowReceipt(true)}
                    className="flex items-center gap-2 px-8 py-3 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
                  >
                    <Printer className="w-5 h-5" />
                    طباعة الفاتورة
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Receipt Modal */}
      <AnimatePresence>
        {showReceipt && selectedSale && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowReceipt(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white rounded-[40px] shadow-2xl w-full max-w-lg overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xl font-black text-slate-900">معاينة الفاتورة</h3>
                <button onClick={() => setShowReceipt(false)} className="p-2 hover:bg-slate-100 rounded-xl">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-8 max-h-[70vh] overflow-y-auto custom-scrollbar bg-slate-50">
                <Receipt sale={selectedSale as any} />
              </div>
              <div className="p-6 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => {
                    window.print();
                    setShowReceipt(false);
                  }}
                  className="px-8 py-3 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center gap-2"
                >
                  <Printer className="w-5 h-5" />
                  تأكيد الطباعة
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
