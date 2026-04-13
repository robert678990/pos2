import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Calendar, 
  FileEdit, 
  Save,
  ArrowRight,
  Truck,
  History,
  CreditCard,
  Banknote
} from 'lucide-react';
import { collection, query, where, orderBy, Timestamp, onSnapshot, doc, writeBatch, increment, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Purchase, Supplier } from '../types';
import { format, startOfDay, endOfDay, startOfMonth } from 'date-fns';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { handleFirestoreError, OperationType } from '../lib/error-handler';

interface EditPurchaseProps {
  onBack: () => void;
}

export default function EditPurchase({ onBack }: EditPurchaseProps) {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfDay(new Date()), 'yyyy-MM-dd'));
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Edit form state
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [paymentType, setPaymentType] = useState<'cash' | 'credit'>('cash');

  useEffect(() => {
    const start = startOfDay(new Date(startDate));
    const end = endOfDay(new Date(endDate));

    const q = query(
      collection(db, 'purchases'),
      where('timestamp', '>=', Timestamp.fromDate(start)),
      where('timestamp', '<=', Timestamp.fromDate(end)),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPurchases(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Purchase)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'purchases');
      setLoading(false);
    });

    const unsubSuppliers = onSnapshot(collection(db, 'suppliers'), (snapshot) => {
      setSuppliers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'suppliers');
    });

    return () => {
      unsubscribe();
      unsubSuppliers();
    };
  }, [startDate, endDate]);

  const filteredPurchases = purchases.filter(p => 
    p.invoiceNumber?.toString().includes(search) ||
    p.supplierName?.toLowerCase().includes(search.toLowerCase())
  );

  const handleStartEdit = (purchase: Purchase) => {
    setEditingPurchase(purchase);
    setSelectedSupplierId(purchase.supplierId || '');
    setPaymentType(purchase.paymentType || 'cash');
  };

  const handleUpdatePurchase = async () => {
    if (!editingPurchase) return;
    setIsProcessing(true);
    const batch = writeBatch(db);

    try {
      const purchaseRef = doc(db, 'purchases', editingPurchase.id!);
      const selectedSupplier = suppliers.find(s => s.id === selectedSupplierId);

      // 1. Handle balance changes if payment type or supplier changed
      if (editingPurchase.paymentType === 'credit' && editingPurchase.supplierId) {
        // Revert old balance (subtract from supplier debt)
        const remainingAmount = (editingPurchase.total || 0) - (editingPurchase.paidAmount || 0);
        const oldSupplierRef = doc(db, 'suppliers', editingPurchase.supplierId);
        batch.set(oldSupplierRef, { balance: increment(-remainingAmount) }, { merge: true });
      }

      if (paymentType === 'credit' && selectedSupplierId) {
        // Apply new balance (add to supplier debt)
        const remainingAmount = (editingPurchase.total || 0) - (editingPurchase.paidAmount || 0);
        const newSupplierRef = doc(db, 'suppliers', selectedSupplierId);
        batch.set(newSupplierRef, { balance: increment(remainingAmount) }, { merge: true });
      }

      // 2. Update purchase document
      batch.update(purchaseRef, {
        supplierId: selectedSupplierId,
        supplierName: selectedSupplier?.name || 'مورد غير معروف',
        paymentType: paymentType
      });

      // 3. Log the edit
      const logRef = doc(collection(db, 'logs'));
      batch.set(logRef, {
        type: 'purchase_edit',
        purchaseId: editingPurchase.id,
        invoiceNumber: editingPurchase.invoiceNumber,
        oldData: { supplierId: editingPurchase.supplierId, paymentType: editingPurchase.paymentType },
        newData: { supplierId: selectedSupplierId, paymentType },
        timestamp: serverTimestamp(),
        userEmail: auth.currentUser?.email,
        details: `تعديل فاتورة مشتريات رقم ${editingPurchase.invoiceNumber}`
      });

      await batch.commit();
      toast.success('تم تحديث الفاتورة بنجاح');
      setEditingPurchase(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `purchases/${editingPurchase.id}`);
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
            <div className="bg-orange-600 p-3 rounded-2xl text-white shadow-lg shadow-orange-200">
              <FileEdit className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-3xl font-black text-slate-800">تعديل فاتورة مشتريات</h2>
              <p className="text-slate-500 font-bold">تعديل بيانات فواتير الشراء</p>
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
            placeholder="بحث برقم الفاتورة أو اسم المورد..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pr-12 pl-4 py-4 bg-white border border-slate-200 rounded-2xl font-bold text-slate-700 focus:ring-2 focus:ring-orange-500 outline-none shadow-sm transition-all"
          />
        </div>
      </div>

      {/* Purchases List */}
      <div className="flex-1 overflow-y-auto px-6 pb-6 custom-scrollbar">
        <div className="bg-white rounded-[40px] shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-right">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest">رقم الفاتورة</th>
                <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-center">التاريخ</th>
                <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest">المورد</th>
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
                      <div className="w-12 h-12 border-4 border-orange-600 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-slate-500 font-black">جاري جلب الفواتير...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredPurchases.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-20 text-center text-slate-300 italic font-bold">
                    لا توجد فواتير مطابقة للبحث
                  </td>
                </tr>
              ) : (
                filteredPurchases.map((purchase) => (
                  <tr key={purchase.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="p-6">
                      <span className="font-black text-slate-700">#{purchase.invoiceNumber}</span>
                    </td>
                    <td className="p-6 text-center">
                      <div className="text-sm font-bold text-slate-500">{format(purchase.timestamp.toDate(), 'yyyy-MM-dd')}</div>
                    </td>
                    <td className="p-6">
                      <span className="font-bold text-slate-700">{purchase.supplierName}</span>
                    </td>
                    <td className="p-6 text-center">
                      <span className={cn(
                        "px-4 py-1.5 rounded-xl text-[10px] font-black",
                        purchase.paymentType === 'cash' ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                      )}>
                        {purchase.paymentType === 'cash' ? 'نقداً' : 'أجل'}
                      </span>
                    </td>
                    <td className="p-6 text-left">
                      <span className="font-black text-slate-800">{(purchase.total || 0).toFixed(2)}</span>
                    </td>
                    <td className="p-6">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => handleStartEdit(purchase)}
                          className="p-3 bg-orange-50 text-orange-600 rounded-xl hover:bg-orange-600 hover:text-white transition-all shadow-sm"
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
        {editingPurchase && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingPurchase(null)}
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
                  <div className="w-16 h-16 bg-orange-100 rounded-[24px] flex items-center justify-center">
                    <FileEdit className="w-8 h-8 text-orange-600" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-800">تعديل الفاتورة #{editingPurchase.invoiceNumber}</h3>
                    <p className="text-slate-500 font-bold">تعديل بيانات المورد وطريقة الدفع</p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="space-y-3">
                    <label className="text-sm font-black text-slate-700 flex items-center gap-2">
                      <Truck className="w-4 h-4 text-orange-600" />
                      المورد
                    </label>
                    <select
                      value={selectedSupplierId}
                      onChange={(e) => setSelectedSupplierId(e.target.value)}
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                    >
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-3">
                    <label className="text-sm font-black text-slate-700 flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-orange-600" />
                      طريقة الدفع
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { id: 'cash', label: 'نقداً', icon: Banknote },
                        { id: 'credit', label: 'أجل', icon: History },
                      ].map((type) => (
                        <button
                          key={type.id}
                          type="button"
                          onClick={() => setPaymentType(type.id as any)}
                          className={cn(
                            "p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2",
                            paymentType === type.id 
                              ? "border-orange-600 bg-orange-50 text-orange-700 shadow-lg shadow-orange-100" 
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
                    onClick={handleUpdatePurchase}
                    disabled={isProcessing}
                    className="flex-1 bg-orange-600 text-white py-4 rounded-2xl font-black text-lg hover:bg-orange-700 transition-all shadow-lg shadow-orange-200 disabled:opacity-50 flex items-center justify-center gap-3"
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
                    onClick={() => setEditingPurchase(null)}
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
