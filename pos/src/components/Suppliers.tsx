import React, { useState, useEffect } from 'react';
import { 
  Truck, 
  Plus, 
  Search, 
  Phone, 
  History, 
  X,
  Save,
  UserPlus,
  MoreVertical,
  Download,
  Printer,
  Calendar,
  DollarSign,
  ChevronLeft,
  Package,
  ArrowUpRight,
  ArrowDownLeft,
  FileText,
  FileBarChart,
  FileSearch,
  ShieldCheck,
  Users,
  Database,
  LayoutGrid,
  ArrowRight,
  Camera,
  Image as ImageIcon
} from 'lucide-react';
import { collection, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, increment, query, where, orderBy, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { handleFirestoreError, OperationType } from '../lib/error-handler';
import { supabaseService } from '../services/supabaseService';
import { uploadImage } from '../lib/upload-service';
import { motion, AnimatePresence } from 'motion/react';
import { exportToExcel, exportToPDF } from '../lib/export-utils';

interface Supplier {
  id?: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  balance: number;
  notes?: string;
  imageUrl?: string;
  createdAt?: any;
}

interface SupplierTransaction {
  id?: string;
  supplierId: string;
  amount: number;
  type: 'purchase' | 'payment';
  timestamp: any;
  note: string;
}

type ViewType = 'menu' | 'add' | 'balances' | 'credit_invoices' | 'report_remaining' | 'report_balances' | 'check_balances' | 'list';

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [activeView, setActiveView] = useState<ViewType>('menu');
  const [isUploading, setIsUploading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const url = await uploadImage(file, 'suppliers');
    if (url) {
      setNewSupplier({ ...newSupplier, imageUrl: url });
      toast.success('تم تحميل الصورة بنجاح');
    }
    setIsUploading(false);
  };
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [transactions, setTransactions] = useState<SupplierTransaction[]>([]);
  const [search, setSearch] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentAmountInput, setPaymentAmountInput] = useState('');
  const [paymentNote, setPaymentNote] = useState('');

  const [newSupplier, setNewSupplier] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    balance: 0,
    notes: '',
    imageUrl: ''
  });

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'suppliers'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier));
      setSuppliers(data);
      if (selectedSupplier) {
        const updated = data.find(s => s.id === selectedSupplier.id);
        if (updated) setSelectedSupplier(updated);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'suppliers');
    });
    return unsub;
  }, [selectedSupplier?.id]);

  useEffect(() => {
    if (selectedSupplier && activeView === 'list') {
      const q = query(
        collection(db, 'supplier_transactions'),
        where('supplierId', '==', selectedSupplier.id),
        orderBy('timestamp', 'desc')
      );
      const unsub = onSnapshot(q, (snapshot) => {
        setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SupplierTransaction)));
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'supplier_transactions');
      });
      return unsub;
    }
  }, [selectedSupplier, activeView]);

  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const supplierData = {
        name: newSupplier.name || '',
        phone: newSupplier.phone || '',
        email: newSupplier.email || '',
        address: newSupplier.address || '',
        balance: Number(newSupplier.balance) || 0,
        notes: newSupplier.notes || '',
        imageUrl: newSupplier.imageUrl || '',
        updatedAt: serverTimestamp()
      };

      if (isEditMode && selectedSupplier?.id) {
        await updateDoc(doc(db, 'suppliers', selectedSupplier.id), supplierData);
        supabaseService.syncSupplier({ ...supplierData, id: selectedSupplier.id } as any);
        toast.success('تم تحديث بيانات المورد بنجاح');
      } else {
        const docRef = await addDoc(collection(db, 'suppliers'), {
          ...supplierData,
          createdAt: serverTimestamp()
        });
        supabaseService.syncSupplier({ ...supplierData, id: docRef.id } as any);
        toast.success('تم إضافة المورد بنجاح');
      }
      
      setIsAddModalOpen(false);
      setIsEditMode(false);
      if (activeView === 'add') setActiveView('menu');
      setNewSupplier({ name: '', phone: '', email: '', address: '', balance: 0, notes: '', imageUrl: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'suppliers');
    }
  };

  const openEditModal = () => {
    if (!selectedSupplier) return;
    setNewSupplier({
      name: selectedSupplier.name,
      phone: selectedSupplier.phone,
      email: selectedSupplier.email || '',
      address: selectedSupplier.address || '',
      balance: selectedSupplier.balance,
      notes: selectedSupplier.notes || '',
      imageUrl: selectedSupplier.imageUrl || ''
    });
    setIsEditMode(true);
    setIsAddModalOpen(true);
  };

  const handleUpdateNotes = async (notes: string) => {
    if (!selectedSupplier?.id) return;
    try {
      await updateDoc(doc(db, 'suppliers', selectedSupplier.id), { notes });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'suppliers');
    }
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplier || paymentAmount <= 0) return;

    try {
      const batch = writeBatch(db);
      
      const supplierRef = doc(db, 'suppliers', selectedSupplier.id!);
      batch.set(supplierRef, {
        balance: increment(-paymentAmount)
      }, { merge: true });

      const transactionRef = doc(collection(db, 'supplier_transactions'));
      batch.set(transactionRef, {
        supplierId: selectedSupplier.id || '',
        amount: Number(paymentAmount) || 0,
        type: 'payment',
        timestamp: serverTimestamp(),
        note: paymentNote || 'دفعة للمورد'
      });

      await batch.commit();

      setIsPaymentModalOpen(false);
      setPaymentAmount(0);
      setPaymentAmountInput('');
      setPaymentNote('');
      toast.success('الخلاص تقيد بنجاح');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'suppliers/supplier_transactions');
    }
  };

  const handleExportSuppliers = () => {
    const data = suppliers.map(s => ({
      'الاسم': s.name,
      'الهاتف': s.phone,
      'البريد الإلكتروني': s.email || '',
      'العنوان': s.address || '',
      'الرصيد': (s.balance || 0).toFixed(2),
      'ملاحظات': s.notes || ''
    }));
    exportToExcel(data, `ليستة_الفورنيسورات_${format(new Date(), 'yyyy-MM-dd')}`);
  };

  const handleExportSuppliersPDF = () => {
    const data = suppliers.map(s => ({
      'الاسم': s.name,
      'الهاتف': s.phone,
      'الرصيد': (s.balance || 0).toFixed(2),
      'العنوان': s.address || ''
    }));
    exportToPDF(data, `ليستة_الفورنيسورات_${format(new Date(), 'yyyy-MM-dd')}`, 'ليستة الفورنيسورات');
  };

  const handleExportTransactions = () => {
    if (!selectedSupplier) return;
    const data = transactions.map(t => ({
      'التاريخ': t.timestamp ? format(t.timestamp.toDate(), 'yyyy-MM-dd HH:mm') : '',
      'البيان': t.note,
      'النوع': t.type === 'purchase' ? 'سلعة داخلة' : 'خلاص',
      'المبلغ': (t.amount || 0).toFixed(2)
    }));
    exportToExcel(data, `سجل_معاملات_الفورنيسور_${selectedSupplier.name}_${format(new Date(), 'yyyy-MM-dd')}`);
  };

  const handleExportTransactionsPDF = () => {
    if (!selectedSupplier) return;
    const data = transactions.map(t => ({
      'التاريخ': t.timestamp ? format(t.timestamp.toDate(), 'yyyy-MM-dd HH:mm') : '',
      'البيان': t.note,
      'النوع': t.type === 'purchase' ? 'سلعة داخلة' : 'خلاص',
      'المبلغ': (t.amount || 0).toFixed(2)
    }));
    exportToPDF(data, `سجل_معاملات_الفورنيسور_${selectedSupplier.name}_${format(new Date(), 'yyyy-MM-dd')}`, `سجل معاملات الفورنيسور: ${selectedSupplier.name}`);
  };

  const menuOptions = [
    { id: 'add', label: 'زيد فورنيسور جديد', icon: Plus, color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
    { id: 'balances', label: 'الصولد البدية والفلوس ديال الفورنيسورات', icon: Database, color: 'text-blue-600', bgColor: 'bg-blue-50' },
    { id: 'credit_invoices', label: 'الفلوس اللي سالونا الفورنيسورات فالفاتورات ديال الكريدي', icon: FileText, color: 'text-amber-600', bgColor: 'bg-amber-50' },
    { id: 'report_remaining', label: 'تقرير ديال الفلوس اللي سالونا الفورنيسورات', icon: FileBarChart, color: 'text-indigo-600', bgColor: 'bg-indigo-50' },
    { id: 'report_balances', label: 'تقرير ديال الفورنيسورات اللي باقين كيسالونا', icon: FileSearch, color: 'text-purple-600', bgColor: 'bg-purple-50' },
    { id: 'check_balances', label: 'قلب على صولد الفورنيسورات', icon: ShieldCheck, color: 'text-rose-600', bgColor: 'bg-rose-50' },
    { id: 'list', label: 'شوف الفورنيسورات', icon: Users, color: 'text-slate-600', bgColor: 'bg-slate-50' },
  ];

  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) || 
    s.phone.includes(search)
  );

  const renderMenuView = () => (
    <div className="flex-1 p-8 overflow-y-auto bg-white">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-4xl font-black text-slate-800">الفورنيسورات</h2>
          <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center">
            <Truck className="w-12 h-12 text-slate-400" />
          </div>
        </div>
        
        <div className="grid gap-4">
          {menuOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => {
                if (option.id === 'add') setIsAddModalOpen(true);
                else setActiveView(option.id as ViewType);
              }}
              className="w-full p-6 bg-white border-2 border-slate-100 rounded-[32px] flex items-center justify-between group hover:border-indigo-600 hover:shadow-xl hover:shadow-indigo-100 transition-all"
            >
              <div className="flex items-center gap-6">
                <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm", option.bgColor, option.color)}>
                  <option.icon className="w-7 h-7" />
                </div>
                <span className="text-xl font-black text-slate-700">{option.label}</span>
              </div>
              <ChevronLeft className="w-6 h-6 text-slate-300 group-hover:text-indigo-600 transition-colors" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const renderListView = () => (
    <div className="h-full flex overflow-hidden">
      {/* Left Sidebar: Supplier List */}
      <div className="w-96 bg-white border-l border-slate-200 flex flex-col shadow-sm">
        <div className="p-6 border-b border-slate-100 space-y-4">
          <div className="flex justify-between items-center">
            <button onClick={() => setActiveView('menu')} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
              <ArrowRight className="w-6 h-6 text-slate-400" />
            </button>
            <h2 className="text-2xl font-black text-slate-800">ليستة ديال الفورنيسورات</h2>
            <div className="flex gap-2">
              <button 
                onClick={handleExportSuppliers}
                className="p-2 bg-white border border-slate-200 text-emerald-600 rounded-xl hover:bg-emerald-50 transition-all shadow-sm"
                title="تصدير Excel"
              >
                <Download className="w-5 h-5" />
              </button>
              <button 
                onClick={handleExportSuppliersPDF}
                className="p-2 bg-white border border-slate-200 text-red-600 rounded-xl hover:bg-red-50 transition-all shadow-sm"
                title="تصدير PDF"
              >
                <FileText className="w-5 h-5" />
              </button>
              <button 
                onClick={() => setIsAddModalOpen(true)}
                className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
              >
                <UserPlus className="w-6 h-6" />
              </button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              placeholder="قلب على فورنيسور..."
              className="w-full pr-10 pl-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all outline-none text-sm font-bold"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filteredSuppliers.map(supplier => (
            <button
              key={supplier.id}
              onClick={() => setSelectedSupplier(supplier)}
              className={cn(
                "w-full p-4 rounded-2xl flex items-center gap-4 transition-all group border-2",
                selectedSupplier?.id === supplier.id 
                  ? "bg-indigo-50 border-indigo-600 shadow-lg shadow-indigo-100" 
                  : "bg-white border-transparent hover:bg-slate-50 hover:border-slate-100"
              )}
            >
              <div className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg overflow-hidden shrink-0",
                selectedSupplier?.id === supplier.id ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-400"
              )}>
                {supplier.imageUrl ? (
                  <img src={supplier.imageUrl} alt={supplier.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <Truck className="w-6 h-6" />
                )}
              </div>
              <div className="flex-1 text-right">
                <div className="font-black text-slate-800 text-sm">{supplier.name}</div>
                <div className="text-[10px] font-bold text-slate-400">{supplier.phone}</div>
              </div>
              <div className="text-left">
                <div className={cn(
                  "font-black text-sm",
                  supplier.balance > 0 ? "text-red-500" : "text-emerald-500"
                )}>
                  {(supplier.balance || 0).toFixed(2)}
                </div>
                <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">درهم</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content: Supplier Details & History */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedSupplier ? (
          <>
            {/* Header */}
            <div className="bg-white p-8 border-b border-slate-200 flex justify-between items-start shadow-sm">
              <div className="flex gap-6">
                <div className="w-24 h-24 bg-slate-100 rounded-[32px] flex items-center justify-center text-4xl font-black text-slate-300 border-2 border-slate-50 overflow-hidden shrink-0">
                  {selectedSupplier.imageUrl ? (
                    <img src={selectedSupplier.imageUrl} alt={selectedSupplier.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <Truck className="w-12 h-12" />
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <h3 className="text-4xl font-black text-slate-800">{selectedSupplier.name}</h3>
                    <button 
                      onClick={openEditModal}
                      className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                    >
                      <FileText className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex items-center gap-2 text-slate-500 font-bold bg-slate-50 px-3 py-1 rounded-lg">
                      <Phone className="w-4 h-4" />
                      <span>{selectedSupplier.phone}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setIsPaymentModalOpen(true)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 rounded-2xl font-black flex items-center gap-2 shadow-xl shadow-emerald-200 transition-all"
                >
                  <DollarSign className="w-5 h-5" />
                  قيد خلاص للفورنيسور
                </button>
                <button className="p-4 bg-white border border-slate-200 text-slate-400 rounded-2xl hover:bg-slate-50 transition-all">
                  <Printer className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="p-8 grid grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex items-center gap-6">
                <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center text-red-600">
                  <ArrowUpRight className="w-8 h-8" />
                </div>
                <div>
                  <div className="text-xs font-black text-slate-400 uppercase tracking-widest">اللي كيسالنا الفورنيسور</div>
                  <div className="text-3xl font-black text-red-600">{(selectedSupplier.balance || 0).toFixed(2)}</div>
                </div>
              </div>
              <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex items-center gap-6">
                <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
                  <ArrowDownLeft className="w-8 h-8" />
                </div>
                <div>
                  <div className="text-xs font-black text-slate-400 uppercase tracking-widest">مجموع داكشي اللي خلصنا</div>
                  <div className="text-3xl font-black text-emerald-600">
                    {(transactions.filter(t => t.type === 'payment').reduce((s, t) => s + t.amount, 0) || 0).toFixed(2)}
                  </div>
                </div>
              </div>
              <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex items-center gap-6">
                <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                  <Package className="w-8 h-8" />
                </div>
                <div>
                  <div className="text-xs font-black text-slate-400 uppercase tracking-widest">عدد السلعة اللي جات</div>
                  <div className="text-3xl font-black text-indigo-600">
                    {transactions.filter(t => t.type === 'purchase').length}
                  </div>
                </div>
              </div>
            </div>

            {/* Notes Section */}
            <div className="px-8 pb-8">
              <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">ملاحظات على الفورنيسور</label>
                <textarea
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-indigo-500 h-24 resize-none"
                  placeholder="زيد ملاحظات هنا..."
                  value={selectedSupplier.notes || ''}
                  onChange={(e) => handleUpdateNotes(e.target.value)}
                />
              </div>
            </div>

            {/* Transaction History */}
            <div className="flex-1 px-8 pb-8 overflow-hidden">
              <div className="bg-white h-full rounded-[40px] shadow-sm border border-slate-200 flex flex-col overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                  <h4 className="text-xl font-black text-slate-800 flex items-center gap-2">
                    <History className="w-5 h-5 text-indigo-600" />
                    تاريخ المعاملات مع الفورنيسور
                  </h4>
                  <div className="flex gap-2">
                    <button 
                      onClick={handleExportTransactions}
                      className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-emerald-600 flex items-center gap-2 hover:bg-emerald-50 transition-colors"
                      title="تصدير Excel"
                    >
                      <Download className="w-4 h-4" />
                      Excel
                    </button>
                    <button 
                      onClick={handleExportTransactionsPDF}
                      className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-red-600 flex items-center gap-2 hover:bg-red-50 transition-colors"
                      title="تصدير PDF"
                    >
                      <FileText className="w-4 h-4" />
                      PDF
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                  <table className="w-full text-right">
                    <thead className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest sticky top-0">
                      <tr>
                        <th className="p-6">لادات</th>
                        <th className="p-6">البيان</th>
                        <th className="p-6 text-center">النوع</th>
                        <th className="p-6 text-left">المبلغ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {transactions.map(t => (
                        <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-6">
                            <div className="font-bold text-slate-700">{t.timestamp ? format(t.timestamp.toDate(), 'yyyy-MM-dd') : '...'}</div>
                            <div className="text-[10px] text-slate-400">{t.timestamp ? format(t.timestamp.toDate(), 'HH:mm') : ''}</div>
                          </td>
                          <td className="p-6">
                            <div className="font-bold text-slate-600">{t.note}</div>
                          </td>
                          <td className="p-6 text-center">
                            <span className={cn(
                              "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider",
                              t.type === 'purchase' ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"
                            )}>
                              {t.type === 'purchase' ? 'سلعة داخلة' : 'خلاص'}
                            </span>
                          </td>
                          <td className={cn(
                            "p-6 text-left font-black text-lg",
                            t.type === 'purchase' ? "text-red-500" : "text-emerald-500"
                          )}>
                            {t.type === 'purchase' ? '+' : '-'}{(t.amount || 0).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                      {transactions.length === 0 && (
                        <tr>
                          <td colSpan={4} className="p-20 text-center text-slate-300 italic font-bold">
                            ماكاين حتى معاملة مقيدة لهاد الفورنيسور
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-300 p-20">
            <div className="bg-white p-12 rounded-[60px] shadow-xl shadow-slate-200/50 border border-slate-100 mb-8">
              <Truck className="w-32 h-32 opacity-20" />
            </div>
            <h3 className="text-3xl font-black text-slate-400">ختار شي فورنيسور باش تشوف التفاصيل</h3>
          </div>
        )}
      </div>
    </div>
  );

  const renderBalancesView = () => (
    <div className="flex-1 p-8 overflow-y-auto">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => setActiveView('menu')} className="p-2 hover:bg-slate-200 rounded-xl transition-all">
            <ArrowRight className="w-8 h-8 text-slate-400" />
          </button>
          <h2 className="text-3xl font-black text-slate-800">الصولد البدية والفلوس ديال الفورنيسورات</h2>
        </div>

        <div className="bg-white rounded-[40px] shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-right">
            <thead className="bg-slate-50 text-slate-400 text-xs font-black uppercase tracking-widest">
              <tr>
                <th className="p-6">الفورنيسور</th>
                <th className="p-6">نمرة التيليفون</th>
                <th className="p-6 text-left">الصولد دابا</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {suppliers.map(s => (
                <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-6 font-black text-slate-700">{s.name}</td>
                  <td className="p-6 font-bold text-slate-400">{s.phone}</td>
                  <td className={cn(
                    "p-6 text-left font-black text-xl",
                    s.balance > 0 ? "text-red-500" : "text-emerald-500"
                  )}>
                    {(s.balance || 0).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderReportView = (title: string, filterFn: (s: Supplier) => boolean) => (
    <div className="flex-1 p-8 overflow-y-auto">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button onClick={() => setActiveView('menu')} className="p-2 hover:bg-slate-200 rounded-xl transition-all">
              <ArrowRight className="w-8 h-8 text-slate-400" />
            </button>
            <h2 className="text-3xl font-black text-slate-800">{title}</h2>
          </div>
          <button className="p-4 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200">
            <Printer className="w-6 h-6" />
          </button>
        </div>

        <div className="bg-white rounded-[40px] shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-right">
            <thead className="bg-slate-50 text-slate-400 text-xs font-black uppercase tracking-widest">
              <tr>
                <th className="p-6">الفورنيسور</th>
                <th className="p-6">نمرة التيليفون</th>
                <th className="p-6 text-left">شحال باقي كيسالنا</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {suppliers.filter(filterFn).map(s => (
                <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-6 font-black text-slate-700">{s.name}</td>
                  <td className="p-6 font-bold text-slate-400">{s.phone}</td>
                  <td className="p-6 text-left font-black text-xl text-red-500">
                    {(s.balance || 0).toFixed(2)}
                  </td>
                </tr>
              ))}
              {suppliers.filter(filterFn).length === 0 && (
                <tr>
                  <td colSpan={3} className="p-20 text-center text-slate-300 italic font-bold">
                    ماكاين والو ما يتشاف
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot className="bg-slate-50 border-t border-slate-200">
              <tr>
                <td colSpan={2} className="p-6 font-black text-slate-800 text-xl">الإجمالي</td>
                <td className="p-6 text-left font-black text-2xl text-red-600">
                  {suppliers.filter(filterFn).reduce((sum, s) => sum + (s.balance || 0), 0).toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );

  const renderCheckBalancesView = () => (
    <div className="flex-1 p-8 overflow-y-auto">
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => setActiveView('menu')} className="p-2 hover:bg-slate-200 rounded-xl transition-all">
            <ArrowRight className="w-8 h-8 text-slate-400" />
          </button>
          <h2 className="text-3xl font-black text-slate-800">قلب على صولد الفورنيسورات</h2>
        </div>

        <div className="relative">
          <Search className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 w-6 h-6" />
          <input
            type="text"
            placeholder="قلب على فورنيسور باش تفحص الصولد..."
            className="w-full pr-16 pl-6 py-6 bg-white border-2 border-slate-100 rounded-[32px] shadow-sm focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-600 transition-all outline-none text-xl font-black"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="space-y-4">
          {filteredSuppliers.map(s => (
            <div key={s.id} className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm flex items-center justify-between group hover:border-indigo-600 transition-all">
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                  <Truck className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="text-2xl font-black text-slate-800">{s.name}</h4>
                  <p className="text-slate-400 font-bold">{s.phone}</p>
                </div>
              </div>
              <div className="text-left">
                <div className={cn(
                  "text-3xl font-black",
                  s.balance > 0 ? "text-red-500" : "text-emerald-500"
                )}>
                  {(s.balance || 0).toFixed(2)}
                </div>
                <div className="text-xs font-black text-slate-400 uppercase tracking-widest">درهم</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-full flex bg-slate-100 overflow-hidden" dir="rtl">
      <AnimatePresence mode="wait">
        <motion.div 
          key={activeView}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="flex-1 flex overflow-hidden"
        >
          {activeView === 'menu' && renderMenuView()}
          {activeView === 'list' && renderListView()}
          {activeView === 'balances' && renderBalancesView()}
          {activeView === 'credit_invoices' && renderReportView('الفلوس اللي سالونا من الفاتورات ديال الكريدي', s => s.balance > 0)}
          {activeView === 'report_remaining' && renderReportView('تقرير ديال الفلوس اللي سالونا الفورنيسورات', s => s.balance > 0)}
          {activeView === 'report_balances' && renderReportView('تقرير ديال الفورنيسورات اللي باقين كيسالونا', s => s.balance > 0)}
          {activeView === 'check_balances' && renderCheckBalancesView()}
        </motion.div>
      </AnimatePresence>

      {/* Add Supplier Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-2xl font-black text-slate-800">
                {isEditMode ? 'تعديل بيانات المورد' : 'زيد فورنيسور جديد'}
              </h3>
              <button onClick={() => {
                setIsAddModalOpen(false);
                setIsEditMode(false);
              }} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleAddSupplier} className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Left Column: Image */}
                <div className="space-y-4">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest">صورة المورد (URL)</label>
                  <div className="aspect-square bg-slate-100 rounded-[32px] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-4 group cursor-pointer hover:bg-slate-50 transition-all overflow-hidden relative">
                    {isUploading ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-[10px] font-black text-slate-400">جاري التحميل...</span>
                      </div>
                    ) : newSupplier.imageUrl ? (
                      <img src={newSupplier.imageUrl} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <>
                        <div className="bg-white p-4 rounded-2xl shadow-sm group-hover:scale-110 transition-transform">
                          <Truck className="w-10 h-10 text-slate-300" />
                        </div>
                        <div className="text-[10px] font-black text-slate-400 text-center px-4">أدخل رابط الصورة أو اختر من الجهاز</div>
                      </>
                    )}
                  </div>
                  <input 
                    type="text" 
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                    value={newSupplier.imageUrl || ''}
                    onChange={e => setNewSupplier({...newSupplier, imageUrl: e.target.value})}
                    placeholder="https://example.com/image.jpg"
                  />
                  <div className="flex gap-2">
                    <input 
                      type="file" 
                      id="supplier-image-upload" 
                      className="hidden" 
                      accept="image/*"
                      onChange={handleFileUpload}
                    />
                    <button 
                      type="button" 
                      onClick={() => document.getElementById('supplier-image-upload')?.click()}
                      disabled={isUploading}
                      className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 p-2 rounded-xl text-[10px] font-black flex items-center justify-center gap-1 disabled:opacity-50"
                    >
                      <ImageIcon className="w-3 h-3" />
                      من الجهاز
                    </button>
                    <button 
                      type="button" 
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'image/*';
                        input.capture = 'environment';
                        input.onchange = (e: any) => handleFileUpload(e);
                        input.click();
                      }}
                      disabled={isUploading}
                      className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 p-2 rounded-xl text-[10px] font-black flex items-center justify-center gap-1 disabled:opacity-50"
                    >
                      <Camera className="w-3 h-3" />
                      من الكاميرا
                    </button>
                  </div>
                </div>

                {/* Right Column: Info */}
                <div className="md:col-span-2 space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest">سمية الفورنيسور / الشركة</label>
                      <input 
                        required
                        type="text" 
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black outline-none focus:ring-2 focus:ring-indigo-500"
                        value={newSupplier.name}
                        onChange={e => setNewSupplier({...newSupplier, name: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest">نمرة التيليفون</label>
                      <input 
                        required
                        type="tel" 
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black outline-none focus:ring-2 focus:ring-indigo-500"
                        value={newSupplier.phone}
                        onChange={e => setNewSupplier({...newSupplier, phone: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest">الصولد باش بديتي</label>
                      <input 
                        type="number" step="any"
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black outline-none focus:ring-2 focus:ring-indigo-500"
                        value={newSupplier.balance}
                        onChange={e => setNewSupplier({...newSupplier, balance: parseFloat(e.target.value) || 0})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest">الايميل</label>
                      <input 
                        type="email" 
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black outline-none focus:ring-2 focus:ring-indigo-500"
                        value={newSupplier.email}
                        onChange={e => setNewSupplier({...newSupplier, email: e.target.value})}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">ملاحظات</label>
                <input 
                  type="text" 
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="زيد ملاحظات هنا..."
                  value={newSupplier.notes}
                  onChange={e => setNewSupplier({...newSupplier, notes: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">العنوان</label>
                <textarea 
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black outline-none focus:ring-2 focus:ring-indigo-500 h-24 resize-none"
                  value={newSupplier.address}
                  onChange={e => setNewSupplier({...newSupplier, address: e.target.value})}
                />
              </div>
              <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-5 rounded-[32px] shadow-2xl shadow-indigo-200 transition-all flex items-center justify-center gap-3 text-xl">
                <Save className="w-6 h-6" />
                {isEditMode ? 'تحديث البيانات' : 'سجل الفورنيسور'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-2xl font-black text-slate-800">قيد خلاص للفورنيسور</h3>
              <button onClick={() => setIsPaymentModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handlePayment} className="p-8 space-y-6">
              <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100 text-center">
                <div className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-1">شحال كيسالنا دابا</div>
                <div className="text-4xl font-black text-indigo-700">{(selectedSupplier?.balance || 0).toFixed(2)}</div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">شحال خلصتي</label>
                <input 
                  required
                  type="number" step="any"
                  className="w-full p-6 bg-slate-50 border border-slate-200 rounded-[32px] text-4xl font-black text-emerald-600 text-center outline-none focus:ring-4 focus:ring-emerald-500/20"
                  value={paymentAmountInput}
                  onChange={e => {
                    setPaymentAmountInput(e.target.value);
                    setPaymentAmount(parseFloat(e.target.value) || 0);
                  }}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">ملاحظة</label>
                <input 
                  type="text" 
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="مثال: دفعة شيك رقم ..."
                  value={paymentNote}
                  onChange={e => setPaymentNote(e.target.value)}
                />
              </div>
              <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-5 rounded-[32px] shadow-2xl shadow-emerald-200 transition-all flex items-center justify-center gap-3 text-xl">
                <DollarSign className="w-6 h-6" />
                أكد الخلاص
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
