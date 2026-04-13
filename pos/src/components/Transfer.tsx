import React, { useState, useEffect } from 'react';
import { 
  ArrowLeftRight, 
  Users, 
  Truck, 
  ArrowRight,
  AlertTriangle,
  History,
  CheckCircle2,
  ChevronDown,
  Search,
  Wallet
} from 'lucide-react';
import { collection, query, where, getDocs, Timestamp, doc, increment, writeBatch, onSnapshot, serverTimestamp, addDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Customer, Supplier } from '../types';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { handleFirestoreError, OperationType } from '../lib/error-handler';

interface TransferProps {
  onBack: () => void;
}

type TransferType = 'customer_to_customer' | 'supplier_to_supplier' | 'customer_to_supplier' | 'supplier_to_customer';

export default function Transfer({ onBack }: TransferProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [transferType, setTransferType] = useState<TransferType>('customer_to_customer');
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [note, setNote] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const unsubCustomers = onSnapshot(collection(db, 'customers'), (snapshot) => {
      setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
    });

    const unsubSuppliers = onSnapshot(collection(db, 'suppliers'), (snapshot) => {
      setSuppliers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier)));
      setLoading(false);
    });

    return () => {
      unsubCustomers();
      unsubSuppliers();
    };
  }, []);

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromId || !toId || amount <= 0) {
      toast.error('يرجى إكمال جميع البيانات المطلوبة');
      return;
    }

    if (fromId === toId && (transferType === 'customer_to_customer' || transferType === 'supplier_to_supplier')) {
      toast.error('لا يمكن التحويل لنفس الحساب');
      return;
    }

    setIsProcessing(true);
    const batch = writeBatch(db);

    try {
      // 1. Update balances based on transfer type
      if (transferType === 'customer_to_customer') {
        const fromRef = doc(db, 'customers', fromId);
        const toRef = doc(db, 'customers', toId);
        batch.set(fromRef, { balance: increment(-amount) }, { merge: true });
        batch.set(toRef, { balance: increment(amount) }, { merge: true });
      } else if (transferType === 'supplier_to_supplier') {
        const fromRef = doc(db, 'suppliers', fromId);
        const toRef = doc(db, 'suppliers', toId);
        batch.set(fromRef, { balance: increment(-amount) }, { merge: true });
        batch.set(toRef, { balance: increment(amount) }, { merge: true });
      } else if (transferType === 'customer_to_supplier') {
        const fromRef = doc(db, 'customers', fromId);
        const toRef = doc(db, 'suppliers', toId);
        batch.set(fromRef, { balance: increment(-amount) }, { merge: true });
        batch.set(toRef, { balance: increment(amount) }, { merge: true });
      } else if (transferType === 'supplier_to_customer') {
        const fromRef = doc(db, 'suppliers', fromId);
        const toRef = doc(db, 'customers', toId);
        batch.set(fromRef, { balance: increment(-amount) }, { merge: true });
        batch.set(toRef, { balance: increment(amount) }, { merge: true });
      }

      // 2. Log the transfer
      const fromName = transferType.startsWith('customer') 
        ? customers.find(c => c.id === fromId)?.name 
        : suppliers.find(s => s.id === fromId)?.name;
      const toName = transferType.endsWith('customer') 
        ? customers.find(c => c.id === toId)?.name 
        : suppliers.find(s => s.id === toId)?.name;

      const logRef = doc(collection(db, 'logs'));
      batch.set(logRef, {
        type: 'balance_transfer',
        transferType,
        fromId,
        toId,
        amount,
        note,
        timestamp: serverTimestamp(),
        userEmail: auth.currentUser?.email,
        details: `تحويل رصيد بقيمة ${amount} DH من ${fromName} إلى ${toName}${note ? ` (${note})` : ''}`
      });

      await batch.commit();
      toast.success('تمت عملية التحويل بنجاح');
      setAmount(0);
      setNote('');
      setFromId('');
      setToId('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'transfers');
      toast.error('حدث خطأ أثناء عملية التحويل');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 overflow-hidden" dir="rtl">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 p-6 shadow-sm z-10">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors"
          >
            <ArrowRight className="w-6 h-6" />
          </button>
          <div className="bg-purple-600 p-3 rounded-2xl text-white shadow-lg shadow-purple-200">
            <ArrowLeftRight className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-800">التحويل بين الحسابات</h2>
            <p className="text-slate-500 font-bold">نقل الأرصدة بين العملاء والموردين</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-[40px] shadow-xl border border-slate-200 overflow-hidden">
            <div className="p-10">
              <form onSubmit={handleTransfer} className="space-y-8">
                {/* Transfer Type Selection */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { id: 'customer_to_customer', label: 'من عميل لعميل', icon: Users },
                    { id: 'supplier_to_supplier', label: 'من مورد لمورد', icon: Truck },
                    { id: 'customer_to_supplier', label: 'من عميل لمورد', icon: ArrowLeftRight },
                    { id: 'supplier_to_customer', label: 'من مورد لعميل', icon: ArrowLeftRight },
                  ].map((type) => (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => {
                        setTransferType(type.id as TransferType);
                        setFromId('');
                        setToId('');
                      }}
                      className={cn(
                        "p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-3 text-center",
                        transferType === type.id 
                          ? "border-purple-600 bg-purple-50 text-purple-700 shadow-lg shadow-purple-100" 
                          : "border-slate-100 bg-slate-50 text-slate-400 hover:border-slate-200"
                      )}
                    >
                      <type.icon className={cn("w-6 h-6", transferType === type.id ? "text-purple-600" : "text-slate-400")} />
                      <span className="text-xs font-black">{type.label}</span>
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* From Account */}
                  <div className="space-y-3">
                    <label className="text-sm font-black text-slate-700 flex items-center gap-2">
                      <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                      الحساب المحول منه (المرسل)
                    </label>
                    <select
                      value={fromId}
                      onChange={(e) => setFromId(e.target.value)}
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                      required
                    >
                      <option value="">اختر الحساب...</option>
                      {(transferType.startsWith('customer') ? customers : suppliers).map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} (الرصيد: {(item.balance || 0).toFixed(2)})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* To Account */}
                  <div className="space-y-3">
                    <label className="text-sm font-black text-slate-700 flex items-center gap-2">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                      الحساب المحول إليه (المستلم)
                    </label>
                    <select
                      value={toId}
                      onChange={(e) => setToId(e.target.value)}
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                      required
                    >
                      <option value="">اختر الحساب...</option>
                      {(transferType.endsWith('customer') ? customers : suppliers).map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} (الرصيد: {(item.balance || 0).toFixed(2)})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Amount */}
                  <div className="space-y-3">
                    <label className="text-sm font-black text-slate-700 flex items-center gap-2">
                      <Wallet className="w-4 h-4 text-purple-600" />
                      المبلغ المراد تحويله
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={amount || ''}
                      onChange={(e) => setAmount(parseFloat(e.target.value))}
                      placeholder="0.00"
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-slate-700 outline-none focus:ring-2 focus:ring-purple-500 transition-all text-left"
                      required
                    />
                  </div>

                  {/* Note */}
                  <div className="space-y-3">
                    <label className="text-sm font-black text-slate-700 flex items-center gap-2">
                      <History className="w-4 h-4 text-purple-600" />
                      ملاحظات / سبب التحويل
                    </label>
                    <input
                      type="text"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="مثال: تسوية رصيد، تحويل دفعة..."
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                    />
                  </div>
                </div>

                <div className="pt-6">
                  <button
                    type="submit"
                    disabled={isProcessing || loading}
                    className="w-full bg-purple-600 text-white py-5 rounded-[24px] font-black text-xl hover:bg-purple-700 transition-all shadow-xl shadow-purple-200 disabled:opacity-50 flex items-center justify-center gap-4"
                  >
                    {isProcessing ? (
                      <div className="w-7 h-7 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <>
                        <ArrowLeftRight className="w-6 h-6" />
                        تنفيذ عملية التحويل
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Warning Section */}
          <div className="mt-8 bg-amber-50 border border-amber-200 rounded-[32px] p-6 flex items-start gap-4">
            <div className="bg-amber-100 p-3 rounded-2xl">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h4 className="text-amber-800 font-black mb-1">تنبيه هام</h4>
              <p className="text-amber-700 text-sm font-bold leading-relaxed">
                عملية التحويل تؤثر مباشرة على أرصدة الحسابات المختارة. يرجى التأكد من صحة المبالغ والحسابات قبل التنفيذ، حيث يتم تسجيل هذه العملية في سجل النظام للرقابة.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
