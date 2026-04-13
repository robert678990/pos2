import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Calendar, 
  FileEdit, 
  Save,
  ArrowRight,
  AlertTriangle,
  History,
  ShoppingCart,
  Users,
  CreditCard,
  Banknote
} from 'lucide-react';
import { collection, query, where, orderBy, getDocs, Timestamp, onSnapshot, doc, updateDoc, writeBatch, increment, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Sale, Customer } from '../types';
import { format, startOfDay, endOfDay, startOfMonth } from 'date-fns';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { handleFirestoreError, OperationType } from '../lib/error-handler';

interface EditSaleProps {
  onBack: () => void;
}

export default function EditSale({ onBack }: EditSaleProps) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfDay(new Date()), 'yyyy-MM-dd'));
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Edit form state
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [paymentType, setPaymentType] = useState<'cash' | 'credit' | 'card'>('cash');

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
      setSales(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sale)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'sales');
      setLoading(false);
    });

    const unsubCustomers = onSnapshot(collection(db, 'customers'), (snapshot) => {
      setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'customers');
    });

    return () => {
      unsubscribe();
      unsubCustomers();
    };
  }, [startDate, endDate]);

  const filteredSales = sales.filter(sale => 
    sale.invoiceNumber?.toString().includes(search) ||
    sale.customerName?.toLowerCase().includes(search.toLowerCase())
  );

  const handleStartEdit = (sale: Sale) => {
    setEditingSale(sale);
    setSelectedCustomerId(sale.customerId || '');
    setPaymentType(sale.paymentType || 'cash');
  };

  const handleUpdateSale = async () => {
    if (!editingSale) return;
    setIsProcessing(true);
    const batch = writeBatch(db);

    try {
      const saleRef = doc(db, 'sales', editingSale.id!);
      const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

      // 1. Handle balance changes if payment type or customer changed
      if (editingSale.paymentType === 'credit' && editingSale.customerId) {
        // Revert old balance
        const remainingAmount = (editingSale.total || 0) - (editingSale.paidAmount || 0);
        const oldCustomerRef = doc(db, 'customers', editingSale.customerId);
        batch.set(oldCustomerRef, { balance: increment(-remainingAmount) }, { merge: true });
      }

      if (paymentType === 'credit' && selectedCustomerId) {
        // Apply new balance
        const remainingAmount = (editingSale.total || 0) - (editingSale.paidAmount || 0);
        const newCustomerRef = doc(db, 'customers', selectedCustomerId);
        batch.set(newCustomerRef, { balance: increment(remainingAmount) }, { merge: true });
      }

      // 2. Update sale document
      batch.update(saleRef, {
        customerId: selectedCustomerId || null,
        customerName: selectedCustomer?.name || 'زبون نقدي',
        paymentType: paymentType
      });

      // 3. Log the edit
      const logRef = doc(collection(db, 'logs'));
      batch.set(logRef, {
        type: 'invoice_edit',
        invoiceId: editingSale.id,
        invoiceNumber: editingSale.invoiceNumber,
        oldData: { customerId: editingSale.customerId, paymentType: editingSale.paymentType },
        newData: { customerId: selectedCustomerId, paymentType },
        timestamp: serverTimestamp(),
        userEmail: auth.currentUser?.email,
        details: `تعديل فاتورة مبيعات رقم ${editingSale.invoiceNumber}`
      });

      await batch.commit();
      toast.success('تم تحديث الفاتورة بنجاح');
      setEditingSale(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `sales/${editingSale.id}`);
      toast.error('حدث خطأ أثناء تحديث الفاتورة');
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
            <div className="bg-blue-600 p-3 rounded-2xl text-white shadow-lg shadow-blue-200">
              <FileEdit className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-3xl font-black text-slate-800">تعديل فاتورة مبيعات</h2>
              <p className="text-slate-500 font-bold">تعديل بيانات الفواتير الصادرة</p>
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
            className="w-full pr-12 pl-4 py-4 bg-white border border-slate-200 rounded-2xl font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm transition-all"
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
                      <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
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
                      <span className="font-black text-slate-700">#{sale.invoiceNumber}</span>
                    </td>
                    <td className="p-6 text-center">
                      <div className="text-sm font-bold text-slate-500">{format(sale.timestamp.toDate(), 'yyyy-MM-dd')}</div>
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
                          onClick={() => handleStartEdit(sale)}
                          className="p-3 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                          title="تعديل الفاتورة"
                        >
                          <FileEdit className="w-5 h-5" />
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

      {/* Edit Modal */}
      <AnimatePresence>
        {editingSale && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingSale(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white rounded-[40px] shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100"
            >
              <div className="p-8">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-16 h-16 bg-blue-100 rounded-[24px] flex items-center justify-center">
                    <FileEdit className="w-8 h-8 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-800">تعديل الفاتورة #{editingSale.invoiceNumber}</h3>
                    <p className="text-slate-500 font-bold">تعديل بيانات الزبون وطريقة الدفع</p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="space-y-3">
                    <label className="text-sm font-black text-slate-700 flex items-center gap-2">
                      <Users className="w-4 h-4 text-blue-600" />
                      الزبون
                    </label>
                    <select
                      value={selectedCustomerId}
                      onChange={(e) => setSelectedCustomerId(e.target.value)}
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    >
                      <option value="">زبون نقدي</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-3">
                    <label className="text-sm font-black text-slate-700 flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-blue-600" />
                      طريقة الدفع
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { id: 'cash', label: 'نقداً', icon: Banknote },
                        { id: 'credit', label: 'أجل', icon: History },
                        { id: 'card', label: 'بطاقة', icon: CreditCard },
                      ].map((type) => (
                        <button
                          key={type.id}
                          type="button"
                          onClick={() => setPaymentType(type.id as any)}
                          className={cn(
                            "p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2",
                            paymentType === type.id 
                              ? "border-blue-600 bg-blue-50 text-blue-700 shadow-lg shadow-blue-100" 
                              : "border-slate-100 bg-slate-50 text-slate-400 hover:border-slate-200"
                          )}
                        >
                          <type.icon className="w-5 h-5" />
                          <span className="text-[10px] font-black">{type.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 mt-10">
                  <button
                    onClick={handleUpdateSale}
                    disabled={isProcessing}
                    className="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-black text-lg hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 disabled:opacity-50 flex items-center justify-center gap-3"
                  >
                    {isProcessing ? (
                      <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <>
                        <Save className="w-5 h-5" />
                        حفظ التعديلات
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setEditingSale(null)}
                    disabled={isProcessing}
                    className="flex-1 bg-slate-100 text-slate-600 py-4 rounded-2xl font-black text-lg hover:bg-slate-200 transition-all disabled:opacity-50"
                  >
                    إلغاء
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
