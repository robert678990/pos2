import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Calendar, 
  Receipt, 
  Trash2,
  ArrowRight,
  AlertTriangle,
  History,
  Users,
  Truck,
  CheckCircle2
} from 'lucide-react';
import { collection, query, where, orderBy, getDocs, Timestamp, onSnapshot, doc, deleteDoc, increment, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { Transaction, SupplierTransaction } from '../types';
import { format, startOfDay, endOfDay, startOfMonth } from 'date-fns';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { handleFirestoreError, OperationType } from '../lib/error-handler';

interface CancelVoucherProps {
  onBack: () => void;
}

export default function CancelVoucher({ onBack }: CancelVoucherProps) {
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfDay(new Date()), 'yyyy-MM-dd'));
  const [voucherType, setVoucherType] = useState<'customer' | 'supplier'>('customer');
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmModal, setConfirmModal] = useState<any | null>(null);

  useEffect(() => {
    const start = startOfDay(new Date(startDate));
    const end = endOfDay(new Date(endDate));
    const collectionName = voucherType === 'customer' ? 'transactions' : 'supplier_transactions';

    const q = query(
      collection(db, collectionName),
      where('timestamp', '>=', Timestamp.fromDate(start)),
      where('timestamp', '<=', Timestamp.fromDate(end)),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setVouchers(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, collectionName);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [startDate, endDate, voucherType]);

  const filteredVouchers = vouchers.filter(v => 
    (v.customerName || v.supplierName || '').toLowerCase().includes(search.toLowerCase()) ||
    (v.amount || 0).toString().includes(search) ||
    (v.note || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleCancelVoucher = async (voucher: any) => {
    setIsProcessing(true);
    const batch = writeBatch(db);
    const collectionName = voucherType === 'customer' ? 'transactions' : 'supplier_transactions';
    const accountCollection = voucherType === 'customer' ? 'customers' : 'suppliers';
    const accountId = voucherType === 'customer' ? voucher.customerId : voucher.supplierId;

    try {
      // 1. Revert account balance
      // For customers: payment (credit) decreases balance, so cancellation increases it.
      // For suppliers: payment (payment) decreases balance, so cancellation increases it.
      // Wait, let's check the logic in Customers/Suppliers.
      // Customer: balance is what they owe us. Payment decreases balance.
      // Supplier: balance is what we owe them. Payment decreases balance.
      // So in both cases, cancelling a payment increases the balance.
      
      const accountRef = doc(db, accountCollection, accountId);
      batch.set(accountRef, {
        balance: increment(voucher.amount)
      }, { merge: true });

      // 2. Log the cancellation
      const logRef = doc(collection(db, 'logs'));
      batch.set(logRef, {
        type: 'voucher_cancellation',
        voucherId: voucher.id,
        voucherType,
        amount: voucher.amount,
        accountId,
        timestamp: Timestamp.now(),
        details: `إلغاء سند ${voucherType === 'customer' ? 'قبض' : 'صرف'} بمبلغ ${voucher.amount}`
      });

      // 3. Delete the voucher record
      batch.delete(doc(db, collectionName, voucher.id));

      await batch.commit();
      toast.success('تم إلغاء السند بنجاح وتعديل الرصيد');
      setConfirmModal(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${collectionName}/${voucher.id}`);
      toast.error('حدث خطأ أثناء إلغاء السند');
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
            <div className="bg-amber-500 p-3 rounded-2xl text-white shadow-lg shadow-amber-200">
              <Receipt className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-3xl font-black text-slate-800">إلغاء سند قبض/صرف</h2>
              <p className="text-slate-500 font-bold">إدارة وإلغاء سندات القبض والصرف</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
              <button
                onClick={() => setVoucherType('customer')}
                className={cn(
                  "px-6 py-2 rounded-xl text-sm font-black transition-all",
                  voucherType === 'customer' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                سندات العملاء
              </button>
              <button
                onClick={() => setVoucherType('supplier')}
                className={cn(
                  "px-6 py-2 rounded-xl text-sm font-black transition-all",
                  voucherType === 'supplier' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                سندات الموردين
              </button>
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
      </div>

      {/* Search Bar */}
      <div className="p-6">
        <div className="relative max-w-2xl">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            type="text"
            placeholder="بحث بالاسم أو المبلغ أو الملاحظات..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pr-12 pl-4 py-4 bg-white border border-slate-200 rounded-2xl font-bold text-slate-700 focus:ring-2 focus:ring-amber-500 outline-none shadow-sm transition-all"
          />
        </div>
      </div>

      {/* Vouchers List */}
      <div className="flex-1 overflow-y-auto px-6 pb-6 custom-scrollbar">
        <div className="bg-white rounded-[40px] shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-right">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest">التاريخ</th>
                <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest">{voucherType === 'customer' ? 'العميل' : 'المورد'}</th>
                <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-center">النوع</th>
                <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest">الملاحظات</th>
                <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-left">المبلغ</th>
                <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-20 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-12 h-12 border-4 border-amber-600 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-slate-500 font-black">جاري جلب السندات...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredVouchers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-20 text-center text-slate-300 italic font-bold">
                    لا توجد سندات مطابقة للبحث
                  </td>
                </tr>
              ) : (
                filteredVouchers.map((voucher) => (
                  <tr key={voucher.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="p-6">
                      <div className="text-sm font-bold text-slate-500">
                        {format(voucher.timestamp.toDate(), 'yyyy-MM-dd')}
                      </div>
                      <div className="text-[10px] text-slate-400 font-bold">
                        {format(voucher.timestamp.toDate(), 'HH:mm:ss')}
                      </div>
                    </td>
                    <td className="p-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                          {voucherType === 'customer' ? <Users className="w-5 h-5 text-indigo-400" /> : <Truck className="w-5 h-5 text-purple-400" />}
                        </div>
                        <span className="font-black text-slate-700">{voucher.customerName || voucher.supplierName || 'غير معروف'}</span>
                      </div>
                    </td>
                    <td className="p-6 text-center">
                      <span className={cn(
                        "px-4 py-1.5 rounded-xl text-[10px] font-black",
                        voucher.type === 'payment' || voucher.type === 'credit' ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                      )}>
                        {voucher.type === 'payment' || voucher.type === 'credit' ? 'قبض/خلاص' : 'صرف/توريد'}
                      </span>
                    </td>
                    <td className="p-6">
                      <span className="text-xs font-bold text-slate-500">{voucher.note || '-'}</span>
                    </td>
                    <td className="p-6 text-left">
                      <span className="font-black text-slate-800">{(voucher.amount || 0).toFixed(2)}</span>
                    </td>
                    <td className="p-6">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => setConfirmModal(voucher)}
                          className="p-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-600 hover:text-white transition-all shadow-sm"
                          title="إلغاء السند"
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
                    <h3 className="text-2xl font-black text-slate-800">تأكيد إلغاء السند</h3>
                    <p className="text-slate-500 font-bold">هل أنت متأكد من إلغاء هذا السند؟ سيتم تعديل رصيد الحساب.</p>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-3xl p-6 mb-8 space-y-4">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500 font-bold">{voucherType === 'customer' ? 'العميل' : 'المورد'}:</span>
                    <span className="text-slate-800 font-black">{confirmModal.customerName || confirmModal.supplierName}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500 font-bold">المبلغ:</span>
                    <span className="text-slate-800 font-black">{(confirmModal.amount || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500 font-bold">التاريخ:</span>
                    <span className="text-slate-800 font-black">{format(confirmModal.timestamp.toDate(), 'yyyy-MM-dd HH:mm')}</span>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={() => handleCancelVoucher(confirmModal)}
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
