import React, { useState, useEffect } from 'react';
import { 
  Box as BoxIcon, 
  ArrowUpRight, 
  ArrowDownLeft, 
  History, 
  X,
  Save,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Lock,
  Unlock,
  RefreshCw,
  Calendar,
  Clock,
  Printer,
  FileText
} from 'lucide-react';
import { collection, onSnapshot, addDoc, updateDoc, doc, serverTimestamp, query, orderBy, limit, where, Timestamp, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { cn } from '../lib/utils';
import { format, startOfDay, endOfDay } from 'date-fns';
import { handleFirestoreError, OperationType } from '../lib/error-handler';
import { supabaseService } from '../services/supabaseService';

interface BoxSession {
  id?: string;
  startTime: any;
  endTime?: any;
  startBalance: number;
  endBalance?: number;
  totalSales: number;
  totalExpenses: number;
  totalManualIn: number;
  totalManualOut: number;
  totalSupplierPayments: number;
  totalCustomerPayments?: number;
  status: 'open' | 'closed';
  note?: string;
  autoAddSales: boolean;
  autoAddCustomerPayments?: boolean;
  autoDeductPurchases: boolean;
  autoDeductExpenses: boolean;
}

interface BoxTransaction {
  id?: string;
  sessionId: string;
  type: 'in' | 'out';
  amount: number;
  date: string;
  description: string;
  timestamp: any;
}

export default function Box() {
  const [currentSession, setCurrentSession] = useState<BoxSession | null>(null);
  const [sessions, setSessions] = useState<BoxSession[]>([]);
  const [isOpeningModalOpen, setIsOpeningModalOpen] = useState(false);
  const [isClosingModalOpen, setIsClosingModalOpen] = useState(false);
  const [startBalance, setStartBalance] = useState<number>(0);
  const [startBalanceInput, setStartBalanceInput] = useState<string>('0');
  const [endBalance, setEndBalance] = useState<number>(0);
  const [endBalanceInput, setEndBalanceInput] = useState<string>('0');
  const [note, setNote] = useState('');

  // Manual Transaction Form State
  const [transType, setTransType] = useState<'in' | 'out'>('in');
  const [transAmount, setTransAmount] = useState<string>('');
  const [transDate, setTransDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [transDescription, setTransDescription] = useState<string>('');
  const [isSubmittingTrans, setIsSubmittingTrans] = useState(false);

  const [currentTransactions, setCurrentTransactions] = useState<BoxTransaction[]>([]);

  useEffect(() => {
    if (!currentSession?.id) return;
    const q = query(
      collection(db, 'box_transactions'),
      where('sessionId', '==', currentSession.id)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BoxTransaction));
      // Sort by timestamp or date
      data.sort((a, b) => {
        const timeA = a.timestamp?.toMillis() || new Date(a.date).getTime();
        const timeB = b.timestamp?.toMillis() || new Date(b.date).getTime();
        return timeB - timeA;
      });
      setCurrentTransactions(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'box_transactions');
    });
    return unsub;
  }, [currentSession?.id]);

  useEffect(() => {
    // Get current open session
    const qOpen = query(collection(db, 'box_sessions'), where('status', '==', 'open'), limit(1));
    const unsubOpen = onSnapshot(qOpen, (snapshot) => {
      if (!snapshot.empty) {
        setCurrentSession({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as BoxSession);
      } else {
        setCurrentSession(null);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'box_sessions');
    });

    // Get past sessions
    const qHistory = query(collection(db, 'box_sessions'), orderBy('startTime', 'desc'), limit(10));
    const unsubHistory = onSnapshot(qHistory, (snapshot) => {
      setSessions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BoxSession)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'box_sessions');
    });

    return () => {
      unsubOpen();
      unsubHistory();
    };
  }, []);

  useEffect(() => {
    if (!currentSession || currentSession.status !== 'open') return;

    const startTime = currentSession.startTime;
    if (!startTime) return;

    // Listen for sales since session start
    const qSales = query(
      collection(db, 'sales'),
      where('timestamp', '>=', startTime),
      where('paymentType', '==', 'cash')
    );
    const unsubSales = onSnapshot(qSales, (snapshot) => {
      const total = snapshot.docs.reduce((sum, doc) => sum + (doc.data().total || 0), 0);
      updateDoc(doc(db, 'box_sessions', currentSession.id!), {
        totalSales: total
      });
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'sales');
    });

    // Listen for expenses since session start
    const qExpenses = query(
      collection(db, 'expenses'),
      where('timestamp', '>=', startTime)
    );
    const unsubExpenses = onSnapshot(qExpenses, (snapshot) => {
      const total = snapshot.docs.reduce((sum, doc) => sum + (doc.data().amount || 0), 0);
      updateDoc(doc(db, 'box_sessions', currentSession.id!), {
        totalExpenses: total
      });
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'expenses');
    });

    // Listen for supplier payments since session start
    const qSuppliers = query(
      collection(db, 'supplier_transactions'),
      where('timestamp', '>=', startTime),
      where('type', '==', 'payment')
    );
    const unsubSuppliers = onSnapshot(qSuppliers, (snapshot) => {
      const total = snapshot.docs.reduce((sum, doc) => sum + (doc.data().amount || 0), 0);
      updateDoc(doc(db, 'box_sessions', currentSession.id!), {
        totalSupplierPayments: total
      });
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'supplier_transactions');
    });

    // Listen for manual transactions since session start
    const qManual = query(
      collection(db, 'box_transactions'),
      where('sessionId', '==', currentSession.id)
    );
    const unsubManual = onSnapshot(qManual, (snapshot) => {
      const inTotal = snapshot.docs.filter(d => d.data().type === 'in').reduce((sum, doc) => sum + (doc.data().amount || 0), 0);
      const outTotal = snapshot.docs.filter(d => d.data().type === 'out').reduce((sum, doc) => sum + (doc.data().amount || 0), 0);
      updateDoc(doc(db, 'box_sessions', currentSession.id!), {
        totalManualIn: inTotal,
        totalManualOut: outTotal
      });
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'box_transactions');
    });

    // Listen for customer payments since session start
    const qCustomerPayments = query(
      collection(db, 'transactions'),
      where('timestamp', '>=', startTime),
      where('type', '==', 'payment')
    );
    const unsubCustomerPayments = onSnapshot(qCustomerPayments, (snapshot) => {
      const total = snapshot.docs.reduce((sum, doc) => sum + (doc.data().amount || 0), 0);
      updateDoc(doc(db, 'box_sessions', currentSession.id!), {
        totalCustomerPayments: total
      });
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'transactions');
    });

    return () => {
      unsubSales();
      unsubExpenses();
      unsubSuppliers();
      unsubManual();
      unsubCustomerPayments();
    };
  }, [currentSession?.id, currentSession?.status]);

  const handleOpenBox = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const sessionData = {
        startTime: serverTimestamp(),
        startBalance: startBalance || 0,
        totalSales: 0,
        totalExpenses: 0,
        totalManualIn: 0,
        totalManualOut: 0,
        totalSupplierPayments: 0,
        totalCustomerPayments: 0,
        status: 'open' as const,
        note: note || '',
        autoAddSales: true,
        autoAddCustomerPayments: true,
        autoDeductPurchases: true,
        autoDeductExpenses: true
      };
      const docRef = await addDoc(collection(db, 'box_sessions'), sessionData);
      
      // Sync to Supabase
      supabaseService.syncBoxSession({
        id: docRef.id,
        ...sessionData,
        startTime: new Date() // Use current date for immediate sync
      });

      setIsOpeningModalOpen(false);
      setStartBalance(0);
      setStartBalanceInput('0');
      setNote('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'box_sessions');
    }
  };

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSession || !transAmount || parseFloat(transAmount) <= 0) return;
    setIsSubmittingTrans(true);
    try {
      const txData = {
        sessionId: currentSession.id,
        type: transType,
        amount: parseFloat(transAmount),
        date: transDate,
        description: transDescription,
        timestamp: serverTimestamp()
      };
      const docRef = await addDoc(collection(db, 'box_transactions'), txData);
      
      // Sync to Supabase
      supabaseService.syncBoxTransaction({
        id: docRef.id,
        ...txData,
        timestamp: new Date() // Use current date for immediate sync
      });

      setTransAmount('');
      setTransDescription('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'box_transactions');
    } finally {
      setIsSubmittingTrans(false);
    }
  };

  const toggleSetting = async (setting: 'autoAddSales' | 'autoAddCustomerPayments' | 'autoDeductPurchases' | 'autoDeductExpenses') => {
    if (!currentSession?.id) return;
    try {
      await updateDoc(doc(db, 'box_sessions', currentSession.id), {
        [setting]: !currentSession[setting]
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `box_sessions/${currentSession.id}`);
    }
  };

  const calculateBalance = () => {
    if (!currentSession) return 0;
    let balance = currentSession.startBalance + (currentSession.totalManualIn || 0) - (currentSession.totalManualOut || 0);
    
    if (currentSession.autoAddSales) balance += (currentSession.totalSales || 0);
    if (currentSession.autoAddCustomerPayments) balance += (currentSession.totalCustomerPayments || 0);
    if (currentSession.autoDeductExpenses) balance -= (currentSession.totalExpenses || 0);
    if (currentSession.autoDeductPurchases) balance -= (currentSession.totalSupplierPayments || 0);
    
    return balance;
  };

  const handleCloseBox = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSession || !currentSession.id) return;
    try {
      const finalBalance = calculateBalance();
      const sessionRef = doc(db, 'box_sessions', currentSession.id);
      const updateData = {
        endTime: serverTimestamp(),
        endBalance: finalBalance,
        status: 'closed' as const,
        note: note || ''
      };
      await updateDoc(sessionRef, updateData);
      
      // Sync to Supabase
      supabaseService.syncBoxSession({
        ...currentSession,
        ...updateData,
        endTime: new Date() // Use current date for immediate sync
      });

      setIsClosingModalOpen(false);
      setEndBalance(0);
      setEndBalanceInput('0');
      setNote('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `box_sessions/${currentSession.id}`);
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'box_transactions', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `box_transactions/${id}`);
    }
  };

  return (
    <div className="p-8 h-full flex flex-col gap-8 bg-slate-100 overflow-y-auto" dir="rtl">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-4xl font-black text-slate-800">الصندوق</h2>
          <p className="text-slate-500 font-bold mt-1">مراقبة الفلوس وسدان النهار</p>
        </div>
        {currentSession ? (
          <button 
            onClick={() => setIsClosingModalOpen(true)}
            className="bg-red-600 hover:bg-red-700 text-white px-8 py-4 rounded-2xl font-black flex items-center gap-2 shadow-xl shadow-red-200 transition-all"
          >
            <Lock className="w-5 h-5" />
            سد الصندوق
          </button>
        ) : (
          <button 
            onClick={() => setIsOpeningModalOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 rounded-2xl font-black flex items-center gap-2 shadow-xl shadow-emerald-200 transition-all"
          >
            <Unlock className="w-5 h-5" />
            حل الصندوق
          </button>
        )}
      </div>

      {currentSession ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {/* Manual Entry Form - Matching User Image */}
            <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-200 space-y-8">
              <div className="flex justify-center gap-8">
                <button 
                  onClick={() => setTransType('in')}
                  className={cn(
                    "flex items-center gap-3 px-6 py-3 rounded-2xl font-black transition-all",
                    transType === 'in' ? "bg-emerald-50 text-emerald-600 ring-2 ring-emerald-500" : "text-slate-400 hover:bg-slate-50"
                  )}
                >
                  <div className={cn("w-4 h-4 rounded-full border-2 flex items-center justify-center", transType === 'in' ? "border-emerald-500" : "border-slate-300")}>
                    {transType === 'in' && <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>}
                  </div>
                  زيد للصندوق
                </button>
                <button 
                  onClick={() => setTransType('out')}
                  className={cn(
                    "flex items-center gap-3 px-6 py-3 rounded-2xl font-black transition-all",
                    transType === 'out' ? "bg-red-50 text-red-600 ring-2 ring-red-500" : "text-slate-400 hover:bg-slate-50"
                  )}
                >
                  <div className={cn("w-4 h-4 rounded-full border-2 flex items-center justify-center", transType === 'out' ? "border-red-500" : "border-slate-300")}>
                    {transType === 'out' && <div className="w-2 h-2 bg-red-500 rounded-full"></div>}
                  </div>
                  نقص من الصندوق
                </button>
              </div>

              <form onSubmit={handleAddTransaction} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest mr-2">دخل شحال ديال الفلوس</label>
                  <input 
                    type="number" step="any" required
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-2xl font-black text-center outline-none focus:ring-2 focus:ring-indigo-500"
                    value={transAmount}
                    onChange={e => setTransAmount(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest mr-2">لادات</label>
                    <div className="relative">
                      <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 pointer-events-none" />
                      <input 
                        type="date" required
                        className="w-full p-4 pr-12 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                        value={transDate}
                        onChange={e => setTransDate(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest mr-2">شنو هادشي</label>
                    <input 
                      type="text" 
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                      value={transDescription}
                      onChange={e => setTransDescription(e.target.value)}
                      placeholder="وصف العملية..."
                    />
                  </div>
                </div>

                <div className="space-y-4 pt-4">
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                    <span className="font-bold text-slate-700">زيد فلوس المبيعات للصندوق نيشان</span>
                    <button 
                      type="button"
                      onClick={() => toggleSetting('autoAddSales')}
                      className={cn(
                        "w-12 h-6 rounded-full transition-colors relative",
                        currentSession.autoAddSales ? "bg-pink-500" : "bg-slate-300"
                      )}
                    >
                      <div className={cn("absolute top-1 w-4 h-4 bg-white rounded-full transition-all", currentSession.autoAddSales ? "left-1" : "left-7")}></div>
                    </button>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                    <span className="font-bold text-slate-700">زيد خلاص الكليان للصندوق نيشان</span>
                    <button 
                      type="button"
                      onClick={() => toggleSetting('autoAddCustomerPayments')}
                      className={cn(
                        "w-12 h-6 rounded-full transition-colors relative",
                        currentSession.autoAddCustomerPayments ? "bg-pink-500" : "bg-slate-300"
                      )}
                    >
                      <div className={cn("absolute top-1 w-4 h-4 bg-white rounded-full transition-all", currentSession.autoAddCustomerPayments ? "left-1" : "left-7")}></div>
                    </button>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                    <span className="font-bold text-slate-700">نقص فلوس السلعة والفورنيسورات من الصندوق</span>
                    <button 
                      type="button"
                      onClick={() => toggleSetting('autoDeductPurchases')}
                      className={cn(
                        "w-12 h-6 rounded-full transition-colors relative",
                        currentSession.autoDeductPurchases ? "bg-pink-500" : "bg-slate-300"
                      )}
                    >
                      <div className={cn("absolute top-1 w-4 h-4 bg-white rounded-full transition-all", currentSession.autoDeductPurchases ? "left-1" : "left-7")}></div>
                    </button>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                    <span className="font-bold text-slate-700">نقص فلوس المصاريف من الصندوق</span>
                    <button 
                      type="button"
                      onClick={() => toggleSetting('autoDeductExpenses')}
                      className={cn(
                        "w-12 h-6 rounded-full transition-colors relative",
                        currentSession.autoDeductExpenses ? "bg-pink-500" : "bg-slate-300"
                      )}
                    >
                      <div className={cn("absolute top-1 w-4 h-4 bg-white rounded-full transition-all", currentSession.autoDeductExpenses ? "left-1" : "left-7")}></div>
                    </button>
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={isSubmittingTrans}
                  className={cn(
                    "w-full py-5 rounded-2xl font-black text-xl shadow-xl transition-all flex items-center justify-center gap-3",
                    transType === 'in' ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100" : "bg-red-600 hover:bg-red-700 shadow-red-100",
                    isSubmittingTrans && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {isSubmittingTrans ? <RefreshCw className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />}
                  {transType === 'in' ? 'زيد هاد البركة للصندوق' : 'نقص هاد البركة من الصندوق'}
                </button>
              </form>
            </div>

            {/* Transactions List */}
            <div className="bg-white rounded-[40px] shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h3 className="text-lg font-black text-slate-800">العمليات اللي كاينين دابا</h3>
                <div className="text-xs font-bold text-slate-400">
                  {currentTransactions.length} عملية
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-right">
                  <thead className="bg-slate-50 text-slate-400 text-xs font-black uppercase tracking-widest">
                    <tr>
                      <th className="px-6 py-4">لادات</th>
                      <th className="px-6 py-4">شنو هادشي</th>
                      <th className="px-6 py-4">النوع</th>
                      <th className="px-6 py-4">المبلغ</th>
                      <th className="px-6 py-4"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {currentTransactions.map((trans) => (
                      <tr key={trans.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-600">{trans.date}</td>
                        <td className="px-6 py-4 font-bold text-slate-800">{trans.description || '---'}</td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "px-3 py-1 rounded-full text-xs font-black",
                            trans.type === 'in' ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"
                          )}>
                            {trans.type === 'in' ? 'دخلات' : 'خرجات'}
                          </span>
                        </td>
                        <td className={cn("px-6 py-4 font-black", trans.type === 'in' ? "text-emerald-600" : "text-red-600")}>
                          {trans.type === 'in' ? '+' : '-'}{(trans.amount || 0).toFixed(2)}
                        </td>
                        <td className="px-6 py-4">
                          <button 
                            onClick={() => handleDeleteTransaction(trans.id!)}
                            className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {currentTransactions.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-bold">
                          ما كاين حتى عملية يدوية فهاد الحلة
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="space-y-8">
            <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-200 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-500"></div>
              <div className="relative z-10 space-y-4">
                <div className="w-14 h-14 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-200">
                  <TrendingUp className="w-8 h-8" />
                </div>
                <div>
                  <div className="text-xs font-black text-slate-400 uppercase tracking-widest">باش بدينا</div>
                  <div className="text-4xl font-black text-slate-800">{(currentSession.startBalance || 0).toFixed(2)} <span className="text-sm">درهم</span></div>
                </div>
              </div>
            </div>

            <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-200 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-500"></div>
              <div className="relative z-10 space-y-4">
                <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                  <DollarSign className="w-8 h-8" />
                </div>
                <div>
                  <div className="text-xs font-black text-slate-400 uppercase tracking-widest">المبيعات (كاش)</div>
                  <div className="text-4xl font-black text-slate-800">{(currentSession.totalSales || 0).toFixed(2)} <span className="text-sm text-emerald-500">+{currentSession.autoAddSales ? 'مفعل' : 'معطل'}</span></div>
                </div>
              </div>
            </div>

            <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-200 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-red-50 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-500"></div>
              <div className="relative z-10 space-y-4">
                <div className="w-14 h-14 bg-red-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-red-200">
                  <TrendingDown className="w-8 h-8" />
                </div>
                <div>
                  <div className="text-xs font-black text-slate-400 uppercase tracking-widest">المصاريف والسلعة</div>
                  <div className="text-4xl font-black text-slate-800">{((currentSession.totalExpenses || 0) + (currentSession.totalSupplierPayments || 0)).toFixed(2)} <span className="text-sm text-red-500">-{ (currentSession.autoDeductExpenses || currentSession.autoDeductPurchases) ? 'مفعل' : 'معطل'}</span></div>
                </div>
              </div>
            </div>

            {/* Final Balance Card - Matching User Image */}
            <div className="bg-white p-8 rounded-[40px] shadow-xl border-2 border-indigo-500 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full -mr-16 -mt-16"></div>
              <div className="relative z-10 flex justify-between items-center">
                <div className="text-2xl font-black text-slate-800">الصولد</div>
                <div className="bg-slate-50 border border-slate-200 px-8 py-4 rounded-2xl text-3xl font-black text-red-500 shadow-inner">
                  {calculateBalance().toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white p-20 rounded-[60px] shadow-sm border border-slate-200 text-center flex flex-col items-center gap-6">
          <div className="w-32 h-32 bg-slate-100 rounded-full flex items-center justify-center text-slate-300">
            <Lock className="w-16 h-16" />
          </div>
          <h3 className="text-3xl font-black text-slate-800">الصندوق مسدود دابا</h3>
          <p className="text-slate-500 font-bold max-w-md">عافاك حل الصندوق وحدد باش غتبدا باش تقدر تبيع اليوم</p>
          <button 
            onClick={() => setIsOpeningModalOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-12 py-4 rounded-2xl font-black flex items-center gap-3 shadow-xl shadow-emerald-200 transition-all text-xl"
          >
            <Unlock className="w-6 h-6" />
            حل الصندوق دابا
          </button>
        </div>
      )}

      {/* History Table */}
      <div className="bg-white rounded-[40px] shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 className="text-2xl font-black text-slate-800 flex items-center gap-3">
            <History className="w-7 h-7 text-indigo-600" />
            سجل سدان الصندوق
          </h3>
          <div className="flex gap-3">
            <button className="p-2 bg-white border border-slate-200 rounded-xl text-slate-400 hover:bg-slate-50 transition-all">
              <Printer className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest sticky top-0">
              <tr>
                <th className="p-6">لادات</th>
                <th className="p-6">وقت الحلان/السدان</th>
                <th className="p-6 text-center">باش بدينا</th>
                <th className="p-6 text-center">المبيعات</th>
                <th className="p-6 text-center">المصاريف</th>
                <th className="p-6 text-left">الصولد اللخر</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sessions.map(session => (
                <tr key={session.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-6">
                    <div className="font-bold text-slate-700">{session.startTime ? format(session.startTime.toDate(), 'yyyy-MM-dd') : '...'}</div>
                  </td>
                  <td className="p-6">
                    <div className="flex items-center gap-2 text-xs font-bold">
                      <span className="text-emerald-600">{session.startTime ? format(session.startTime.toDate(), 'HH:mm') : '...'}</span>
                      <span className="text-slate-300">→</span>
                      <span className="text-red-600">{session.endTime ? format(session.endTime.toDate(), 'HH:mm') : '-'}</span>
                    </div>
                  </td>
                  <td className="p-6 text-center font-bold text-slate-600">{(session.startBalance || 0).toFixed(2)}</td>
                  <td className="p-6 text-center font-bold text-emerald-600">{(session.totalSales || 0).toFixed(2)}</td>
                  <td className="p-6 text-center font-bold text-red-500">{(session.totalExpenses || 0).toFixed(2)}</td>
                  <td className="p-6 text-left font-black text-slate-800 text-lg">
                    {session.endBalance ? session.endBalance.toFixed(2) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Opening Modal */}
      {isOpeningModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-2xl font-black text-slate-800">حل الصندوق</h3>
              <button onClick={() => setIsOpeningModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleOpenBox} className="p-8 space-y-6">
              <div className="space-y-2 text-center">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">باش غتبدا (Fond de Caisse)</label>
                <input 
                  required
                  type="number" step="any"
                  className="w-full p-6 bg-slate-50 border border-slate-200 rounded-[32px] text-4xl font-black text-emerald-600 text-center outline-none focus:ring-4 focus:ring-emerald-500/20"
                  value={startBalanceInput}
                  onChange={e => {
                    const val = e.target.value;
                    setStartBalanceInput(val);
                    setStartBalance(parseFloat(val) || 0);
                  }}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">ملاحظة</label>
                <input 
                  type="text" 
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="مثال: بداية نهار جديد"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                />
              </div>
              <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-5 rounded-[32px] shadow-2xl shadow-emerald-200 transition-all flex items-center justify-center gap-3 text-xl">
                <Unlock className="w-6 h-6" />
                أكد الحلان
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Closing Modal */}
      {isClosingModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-2xl font-black text-slate-800">سد الصندوق</h3>
              <button onClick={() => setIsClosingModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleCloseBox} className="p-8 space-y-6">
              <div className="bg-slate-900 p-8 rounded-[32px] text-white space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-bold">باش بدينا</span>
                  <span className="font-black">{(currentSession?.startBalance || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-bold">المبيعات (+)</span>
                  <span className="font-black text-emerald-400">{(currentSession?.totalSales || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-bold">المصاريف (-)</span>
                  <span className="font-black text-red-400">{(currentSession?.totalExpenses || 0).toFixed(2)}</span>
                </div>
                <div className="h-px bg-white/10"></div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-bold">الصولد اللي خاصو يكون</span>
                  <span className="text-2xl font-black text-indigo-400">
                    {((currentSession?.startBalance || 0) + (currentSession?.totalSales || 0) - (currentSession?.totalExpenses || 0)).toFixed(2)}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">الصولد اللي كاين بصح (فالمجر)</label>
                <input 
                  required
                  type="number" step="any"
                  className="w-full p-6 bg-slate-50 border border-slate-200 rounded-[32px] text-4xl font-black text-indigo-600 text-center outline-none focus:ring-4 focus:ring-indigo-500/20"
                  value={endBalanceInput}
                  onChange={e => {
                    const val = e.target.value;
                    setEndBalanceInput(val);
                    setEndBalance(parseFloat(val) || 0);
                  }}
                  autoFocus
                />
              </div>
              <button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-5 rounded-[32px] shadow-2xl shadow-red-200 transition-all flex items-center justify-center gap-3 text-xl">
                <Lock className="w-6 h-6" />
                أكد السدان
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
