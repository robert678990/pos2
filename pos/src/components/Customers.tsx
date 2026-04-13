import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Plus, 
  Search, 
  Phone, 
  CreditCard, 
  History, 
  ArrowUpRight, 
  ArrowDownLeft,
  X,
  Save,
  UserPlus,
  MoreVertical,
  Filter,
  Download,
  Printer,
  Calendar,
  DollarSign,
  User,
  ChevronLeft,
  Barcode,
  MapPin,
  Building2,
  AlertCircle,
  ClipboardList,
  SearchCheck,
  FileSearch,
  Mail,
  Info,
  ChevronRight,
  FileText,
  Wallet,
  Camera,
  Image as ImageIcon
} from 'lucide-react';
import { collection, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, increment, query, where, orderBy, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { Customer, Transaction } from '../types';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { handleFirestoreError, OperationType } from '../lib/error-handler';
import { supabaseService } from '../services/supabaseService';
import { uploadImage } from '../lib/upload-service';
import { exportToExcel, exportToPDF } from '../lib/export-utils';

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [view, setView] = useState<'menu' | 'list' | 'debts' | 'unpaid_invoices'>('menu');
  const [isUploading, setIsUploading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const url = await uploadImage(file, 'customers');
    if (url) {
      setNewCustomer({ ...newCustomer, imageUrl: url });
      toast.success('تم تحميل الصورة بنجاح');
    }
    setIsUploading(false);
  };
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [unpaidInvoices, setUnpaidInvoices] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentAmountInput, setPaymentAmountInput] = useState('');
  const [paymentNote, setPaymentNote] = useState('');

  const [newCustomer, setNewCustomer] = useState<Partial<Customer>>({
    name: '',
    phone: '',
    balance: 0,
    creditLimit: 0,
    customerNumber: '',
    barcode: '',
    address: '',
    taxNumber: '',
    commercialRegister: '',
    city: '',
    streetName: '',
    buildingNumber: '',
    postalCode: '',
    cardType: '',
    cardNumber: '',
    notes: '',
    imageUrl: '',
    sellingPriceType: 'retail',
    maxCreditInvoices: 0,
    creditPeriodDays: 0,
    alertOnDelay: false,
    loyaltyPoints: 0,
    loyaltyDiscount: 0
  });

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'customers'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
      setCustomers(data);
      if (selectedCustomer) {
        const updated = data.find(c => c.id === selectedCustomer.id);
        if (updated) setSelectedCustomer(updated);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'customers');
    });
    return unsub;
  }, [selectedCustomer?.id]);

  useEffect(() => {
    if (selectedCustomer) {
      const q = query(
        collection(db, 'transactions'),
        where('customerId', '==', selectedCustomer.id),
        orderBy('timestamp', 'desc')
      );
      const unsub = onSnapshot(q, (snapshot) => {
        setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'transactions');
      });
      return unsub;
    }
  }, [selectedCustomer]);

  useEffect(() => {
    if (selectedCustomer && view === 'unpaid_invoices') {
      const q = query(
        collection(db, 'sales'),
        where('customerId', '==', selectedCustomer.id),
        where('remainingAmount', '>', 0),
        orderBy('timestamp', 'desc')
      );
      const unsub = onSnapshot(q, (snapshot) => {
        setUnpaidInvoices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'sales');
      });
      return unsub;
    }
  }, [selectedCustomer, view]);

  const filteredCustomers = customers.filter(c => {
    const searchLower = search.toLowerCase();
    const matchesSearch = 
      c.name.toLowerCase().includes(searchLower) || 
      c.phone.includes(search) ||
      (c.customerNumber && c.customerNumber.toLowerCase().includes(searchLower)) ||
      (c.barcode && c.barcode.toLowerCase().includes(searchLower));
    
    if (view === 'debts') return matchesSearch && c.balance > 0;
    return matchesSearch;
  });

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const customerData = {
        name: newCustomer.name || '',
        phone: newCustomer.phone || '',
        balance: Number(newCustomer.balance) || 0,
        creditLimit: Number(newCustomer.creditLimit) || 0,
        customerNumber: newCustomer.customerNumber || '',
        barcode: newCustomer.barcode || '',
        address: newCustomer.address || '',
        taxNumber: newCustomer.taxNumber || '',
        commercialRegister: newCustomer.commercialRegister || '',
        city: newCustomer.city || '',
        streetName: newCustomer.streetName || '',
        buildingNumber: newCustomer.buildingNumber || '',
        postalCode: newCustomer.postalCode || '',
        cardType: newCustomer.cardType || '',
        cardNumber: newCustomer.cardNumber || '',
        notes: newCustomer.notes || '',
        imageUrl: newCustomer.imageUrl || '',
        sellingPriceType: newCustomer.sellingPriceType || 'retail',
        maxCreditInvoices: Number(newCustomer.maxCreditInvoices) || 0,
        creditPeriodDays: Number(newCustomer.creditPeriodDays) || 0,
        alertOnDelay: !!newCustomer.alertOnDelay,
        loyaltyPoints: Number(newCustomer.loyaltyPoints) || 0,
        loyaltyDiscount: Number(newCustomer.loyaltyDiscount) || 0,
        updatedAt: serverTimestamp()
      };

      if (isEditMode && selectedCustomer?.id) {
        await updateDoc(doc(db, 'customers', selectedCustomer.id), customerData);
        supabaseService.syncCustomer({ ...customerData, id: selectedCustomer.id } as any);
        alert('تم تحديث بيانات الزبون بنجاح');
      } else {
        const docRef = await addDoc(collection(db, 'customers'), {
          ...customerData,
          createdAt: serverTimestamp()
        });
        
        // Sync to Supabase
        supabaseService.syncCustomer({ ...customerData, id: docRef.id } as any);
        
        alert('تم إضافة الزبون بنجاح');
      }

      setIsAddModalOpen(false);
      setIsEditMode(false);
      setNewCustomer({
        name: '', phone: '', balance: 0, creditLimit: 0, customerNumber: '',
        barcode: '', address: '', taxNumber: '', commercialRegister: '',
        city: '', streetName: '', buildingNumber: '', postalCode: '',
        cardType: '', cardNumber: '', notes: '', imageUrl: '', sellingPriceType: 'retail',
        maxCreditInvoices: 0, creditPeriodDays: 0, alertOnDelay: false
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'customers');
    }
  };

  const openEditModal = () => {
    if (!selectedCustomer) return;
    setNewCustomer({ ...selectedCustomer });
    setIsEditMode(true);
    setIsAddModalOpen(true);
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer || paymentAmount <= 0) return;

    try {
      const batch = writeBatch(db);
      
      const customerRef = doc(db, 'customers', selectedCustomer.id!);
      batch.set(customerRef, {
        balance: increment(-paymentAmount)
      }, { merge: true });

      const transactionRef = doc(collection(db, 'transactions'));
      batch.set(transactionRef, {
        customerId: selectedCustomer.id || '',
        amount: Number(paymentAmount) || 0,
        type: 'payment',
        timestamp: serverTimestamp(),
        note: paymentNote || 'دفعة مالية'
      });

      await batch.commit();

      setIsPaymentModalOpen(false);
      setPaymentAmount(0);
      setPaymentAmountInput('');
      setPaymentNote('');
      toast.success('تم تسجيل الدفعة بنجاح');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'customers/transactions');
    }
  };

  const handleExportCustomers = () => {
    const data = customers.map(c => ({
      'الاسم': c.name,
      'الهاتف': c.phone,
      'البريد الإلكتروني': c.email || '',
      'العنوان': c.address || '',
      'الرصيد': (c.balance || 0).toFixed(2),
      'ملاحظات': c.notes || ''
    }));
    exportToExcel(data, `قائمة_العملاء_${format(new Date(), 'yyyy-MM-dd')}`);
  };

  const handleExportCustomersPDF = () => {
    const data = customers.map(c => ({
      'الاسم': c.name,
      'الهاتف': c.phone,
      'الرصيد': (c.balance || 0).toFixed(2),
      'العنوان': c.address || ''
    }));
    exportToPDF(data, `قائمة_العملاء_${format(new Date(), 'yyyy-MM-dd')}`, 'قائمة العملاء');
  };

  const handleExportTransactions = () => {
    if (!selectedCustomer) return;
    const data = transactions.map(t => ({
      'التاريخ': t.timestamp ? format(t.timestamp.toDate(), 'yyyy-MM-dd HH:mm') : '',
      'البيان': t.note,
      'النوع': t.type === 'sale' ? 'مبيعات' : 'دفعة',
      'المبلغ': (t.amount || 0).toFixed(2)
    }));
    exportToExcel(data, `سجل_معاملات_${selectedCustomer.name}_${format(new Date(), 'yyyy-MM-dd')}`);
  };

  const handleExportTransactionsPDF = () => {
    if (!selectedCustomer) return;
    const data = transactions.map(t => ({
      'التاريخ': t.timestamp ? format(t.timestamp.toDate(), 'yyyy-MM-dd HH:mm') : '',
      'البيان': t.note,
      'النوع': t.type === 'sale' ? 'مبيعات' : 'دفعة',
      'المبلغ': (t.amount || 0).toFixed(2)
    }));
    exportToPDF(data, `سجل_معاملات_${selectedCustomer.name}_${format(new Date(), 'yyyy-MM-dd')}`, `سجل معاملات: ${selectedCustomer.name}`);
  };

  const handleExportDebtsPDF = () => {
    const debtors = customers.filter(c => c.balance > 0);
    const data = debtors.map(c => ({
      'الاسم': c.name,
      'الهاتف': c.phone,
      'الرصيد المتبقي': (c.balance || 0).toFixed(2),
      'سقف الكريدي': (c.creditLimit || 0).toFixed(2)
    }));
    exportToPDF(data, `تقرير_الديون_${format(new Date(), 'yyyy-MM-dd')}`, 'تقرير ديون الزبناء');
  };

  const handleExportUnpaidInvoicesPDF = () => {
    if (!selectedCustomer) return;
    const data = unpaidInvoices.map(invoice => ({
      'رقم الفاتورة': invoice.invoiceNumber,
      'التاريخ': invoice.timestamp ? format(invoice.timestamp.toDate(), 'yyyy-MM-dd HH:mm') : '',
      'تاريخ الاستحقاق': invoice.dueDate ? format(invoice.dueDate.toDate(), 'yyyy-MM-dd') : '---',
      'المجموع': (invoice.total || 0).toFixed(2),
      'المدفوع': (invoice.paidAmount || 0).toFixed(2),
      'المتبقي': (invoice.remainingAmount || 0).toFixed(2)
    }));
    exportToPDF(data, `فواتير_غير_مؤداة_${selectedCustomer.name}_${format(new Date(), 'yyyy-MM-dd')}`, `فواتير غير مؤداة: ${selectedCustomer.name}`);
  };

  const handleExportAllUnpaidInvoicesPDF = async () => {
    try {
      const q = query(
        collection(db, 'sales'),
        where('remainingAmount', '>', 0),
        orderBy('timestamp', 'desc')
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => {
        const invoice = doc.data();
        return {
          'الزبون': invoice.customerName,
          'رقم الفاتورة': invoice.invoiceNumber,
          'التاريخ': invoice.timestamp ? format(invoice.timestamp.toDate(), 'yyyy-MM-dd HH:mm') : '',
          'المجموع': (invoice.total || 0).toFixed(2),
          'المتبقي': (invoice.remainingAmount || 0).toFixed(2)
        };
      });
      exportToPDF(data, `تقرير_الفواتير_غير_المؤداة_${format(new Date(), 'yyyy-MM-dd')}`, 'تقرير الفواتير غير المؤداة (الكل)');
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'sales');
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden" dir="rtl">
      {view === 'menu' ? (
        <div className="flex-1 p-8 overflow-y-auto">
          <div className="max-w-6xl mx-auto space-y-8">
            <div className="flex justify-between items-center">
              <h2 className="text-4xl font-black text-slate-800">إدارة الزبناء</h2>
              <div className="flex gap-3">
                <button 
                  onClick={handleExportCustomers}
                  className="bg-white text-slate-600 px-4 py-2 rounded-xl font-bold flex items-center gap-2 border border-slate-200 hover:bg-slate-50 transition-all shadow-sm"
                  title="تصدير Excel"
                >
                  <Download className="w-5 h-5 text-emerald-600" />
                  Excel
                </button>
                <button 
                  onClick={handleExportCustomersPDF}
                  className="bg-white text-slate-600 px-4 py-2 rounded-xl font-bold flex items-center gap-2 border border-slate-200 hover:bg-slate-50 transition-all shadow-sm"
                  title="تصدير PDF"
                >
                  <FileText className="w-5 h-5 text-red-600" />
                  PDF
                </button>
                <button 
                  onClick={() => {
                    setIsEditMode(false);
                    setNewCustomer({
                      name: '', phone: '', balance: 0, creditLimit: 0, customerNumber: '',
                      barcode: '', address: '', taxNumber: '', commercialRegister: '',
                      city: '', streetName: '', buildingNumber: '', postalCode: '',
                      cardType: '', cardNumber: '', notes: '', sellingPriceType: 'retail',
                      maxCreditInvoices: 0, creditPeriodDays: 0, alertOnDelay: false
                    });
                    setIsAddModalOpen(true);
                  }}
                  className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black flex items-center gap-2 shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all"
                >
                  <Plus className="w-6 h-6" />
                  زبون جديد
                </button>
              </div>
            </div>

            <div className="relative max-w-2xl mx-auto">
              <Search className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 w-6 h-6" />
              <input
                type="text"
                placeholder="بحث سريع عن زبون (الاسم، الهاتف، الرقم...)"
                className="w-full pr-16 pl-8 py-6 bg-white border-2 border-transparent rounded-[32px] font-black text-xl shadow-xl shadow-slate-200/50 focus:border-indigo-600 transition-all outline-none"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  if (e.target.value) setView('list');
                }}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <button 
                onClick={() => setView('list')}
                className="bg-white p-8 rounded-[40px] border-2 border-transparent hover:border-indigo-600 transition-all group text-right shadow-sm"
              >
                <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-6 group-hover:scale-110 transition-transform">
                  <Users className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-black text-slate-800 mb-2">قائمة الزبناء</h3>
                <p className="text-slate-400 font-bold">عرض وتعديل بيانات جميع الزبناء المسجلين</p>
              </button>

              <div className="relative group">
                <button 
                  onClick={() => setView('debts')}
                  className="w-full bg-white p-8 rounded-[40px] border-2 border-transparent hover:border-red-600 transition-all text-right shadow-sm"
                >
                  <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center text-red-600 mb-6 group-hover:scale-110 transition-transform">
                    <ArrowUpRight className="w-8 h-8" />
                  </div>
                  <h3 className="text-2xl font-black text-slate-800 mb-2">الديون (الكريدي)</h3>
                  <p className="text-slate-400 font-bold">متابعة الزبناء الذين لديهم مبالغ غير مؤداة</p>
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleExportDebtsPDF();
                  }}
                  className="absolute top-8 left-8 p-3 bg-red-50 text-red-600 rounded-xl opacity-0 group-hover:opacity-100 transition-all hover:bg-red-100"
                  title="تصدير تقرير الديون PDF"
                >
                  <FileText className="w-6 h-6" />
                </button>
              </div>

              <div className="relative group">
                <button 
                  onClick={() => setView('unpaid_invoices')}
                  className="w-full bg-white p-8 rounded-[40px] border-2 border-transparent hover:border-emerald-600 transition-all text-right shadow-sm"
                >
                  <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 mb-6 group-hover:scale-110 transition-transform">
                    <FileText className="w-8 h-8" />
                  </div>
                  <h3 className="text-2xl font-black text-slate-800 mb-2">فواتير غير مؤداة</h3>
                  <p className="text-slate-400 font-bold">عرض الفواتير التي لم يتم تسويتها بالكامل</p>
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleExportAllUnpaidInvoicesPDF();
                  }}
                  className="absolute top-8 left-8 p-3 bg-emerald-50 text-emerald-600 rounded-xl opacity-0 group-hover:opacity-100 transition-all hover:bg-emerald-100"
                  title="تصدير تقرير الفواتير غير المؤداة PDF"
                >
                  <FileText className="w-6 h-6" />
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* Left Sidebar: Customer List */}
          <div className="w-96 bg-white border-l border-slate-200 flex flex-col shadow-sm">
            <div className="p-6 border-b border-slate-100 space-y-4">
              <div className="flex justify-between items-center">
                <button 
                  onClick={() => {
                    setView('menu');
                    setSelectedCustomer(null);
                  }}
                  className="p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-400"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-black text-slate-800">
                    {view === 'list' ? 'قائمة الزبناء' : view === 'debts' ? 'الديون' : 'فواتير غير مؤداة'}
                  </h2>
                  {view === 'debts' && (
                    <button 
                      onClick={handleExportDebtsPDF}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                      title="تصدير تقرير الديون PDF"
                    >
                      <FileText className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <button 
                  onClick={() => {
                    setIsEditMode(false);
                    setNewCustomer({
                      name: '', phone: '', balance: 0, creditLimit: 0, customerNumber: '',
                      barcode: '', address: '', taxNumber: '', commercialRegister: '',
                      city: '', streetName: '', buildingNumber: '', postalCode: '',
                      cardType: '', cardNumber: '', notes: '', sellingPriceType: 'retail',
                      maxCreditInvoices: 0, creditPeriodDays: 0, alertOnDelay: false
                    });
                    setIsAddModalOpen(true);
                  }}
                  className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
                >
                  <UserPlus className="w-5 h-5" />
                </button>
              </div>
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="بحث عن زبون..."
                  className="w-full pr-10 pl-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all outline-none text-sm font-bold"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {filteredCustomers.map(customer => (
                <button
                  key={customer.id}
                  onClick={() => setSelectedCustomer(customer)}
                  className={cn(
                    "w-full p-4 rounded-2xl flex items-center gap-4 transition-all group border-2",
                    selectedCustomer?.id === customer.id 
                      ? "bg-indigo-50 border-indigo-600 shadow-lg shadow-indigo-100" 
                      : "bg-white border-transparent hover:bg-slate-50 hover:border-slate-100"
                  )}
                >
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg overflow-hidden shrink-0",
                    selectedCustomer?.id === customer.id ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-400"
                  )}>
                    {customer.imageUrl ? (
                      <img src={customer.imageUrl} alt={customer.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      customer.name.charAt(0)
                    )}
                  </div>
                  <div className="flex-1 text-right">
                    <div className="font-black text-slate-800 text-sm">{customer.name}</div>
                    <div className="text-[10px] font-bold text-slate-400">{customer.phone}</div>
                  </div>
                  <div className="text-left">
                    <div className={cn(
                      "font-black text-sm",
                      customer.balance > 0 ? "text-red-500" : "text-emerald-500"
                    )}>
                      {(customer.balance || 0).toFixed(2)}
                    </div>
                    <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">درهم</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Main Content: Customer Details & History */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {selectedCustomer ? (
              <>
                {/* Header */}
                <div className="bg-white p-8 border-b border-slate-200 flex justify-between items-start shadow-sm">
                  <div className="flex gap-6">
                    <div className="w-24 h-24 bg-slate-100 rounded-[32px] flex items-center justify-center text-4xl font-black text-slate-300 border-2 border-slate-50 overflow-hidden shrink-0">
                      {selectedCustomer.imageUrl ? (
                        <img src={selectedCustomer.imageUrl} alt={selectedCustomer.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        selectedCustomer.name.charAt(0)
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <h3 className="text-4xl font-black text-slate-800">{selectedCustomer.name}</h3>
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
                          <span>{selectedCustomer.phone}</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-500 font-bold bg-slate-50 px-3 py-1 rounded-lg">
                          <CreditCard className="w-4 h-4" />
                          <span>سقف الكريدي: {selectedCustomer.creditLimit} درهم</span>
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
                      تسجيل دفعة (خلاص)
                    </button>
                    <button className="p-4 bg-white border border-slate-200 text-slate-400 rounded-2xl hover:bg-slate-50 transition-all">
                      <Printer className="w-6 h-6" />
                    </button>
                    <button className="p-4 bg-white border border-slate-200 text-slate-400 rounded-2xl hover:bg-slate-50 transition-all">
                      <MoreVertical className="w-6 h-6" />
                    </button>
                  </div>
                </div>

                {view === 'unpaid_invoices' ? (
                  <div className="flex-1 p-8 overflow-y-auto">
                    <div className="bg-white rounded-[40px] shadow-sm border border-slate-200 overflow-hidden">
                      <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                        <h4 className="text-xl font-black text-slate-800 flex items-center gap-2">
                          <FileText className="w-5 h-5 text-emerald-600" />
                          فواتير غير مؤداة
                        </h4>
                        {unpaidInvoices.length > 0 && (
                          <button 
                            onClick={handleExportUnpaidInvoicesPDF}
                            className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-red-600 flex items-center gap-2 hover:bg-red-50 transition-colors"
                            title="تصدير PDF"
                          >
                            <FileText className="w-4 h-4" />
                            تصدير PDF
                          </button>
                        )}
                      </div>
                      <table className="w-full text-right">
                        <thead className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest sticky top-0">
                          <tr>
                            <th className="p-6">رقم الفاتورة</th>
                            <th className="p-6">التاريخ</th>
                            <th className="p-6">تاريخ الاستحقاق</th>
                            <th className="p-6">المجموع</th>
                            <th className="p-6">المدفوع</th>
                            <th className="p-6 text-left">المتبقي</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {unpaidInvoices.map(invoice => (
                            <tr key={invoice.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="p-6 font-black text-slate-700">#{invoice.invoiceNumber}</td>
                              <td className="p-6 font-bold text-slate-600">
                                {invoice.timestamp ? format(invoice.timestamp.toDate(), 'yyyy-MM-dd HH:mm') : '...'}
                              </td>
                              <td className="p-6">
                                {invoice.dueDate ? (
                                  <div className={cn(
                                    "font-black",
                                    invoice.dueDate.toDate() < new Date() ? "text-red-600" : "text-amber-600"
                                  )}>
                                    {format(invoice.dueDate.toDate(), 'yyyy-MM-dd')}
                                    {invoice.dueDate.toDate() < new Date() && (
                                      <span className="mr-2 text-[8px] bg-red-100 text-red-600 px-1 py-0.5 rounded uppercase">متأخر</span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-slate-300 italic">---</span>
                                )}
                              </td>
                              <td className="p-6 font-black text-slate-700">{(invoice.total || 0).toFixed(2)}</td>
                              <td className="p-6 font-bold text-emerald-600">{(invoice.paidAmount || 0).toFixed(2)}</td>
                              <td className="p-6 text-left font-black text-red-500">{(invoice.remainingAmount || 0).toFixed(2)}</td>
                            </tr>
                          ))}
                          {unpaidInvoices.length === 0 && (
                            <tr>
                              <td colSpan={6} className="p-20 text-center text-slate-300 italic font-bold">
                                لا توجد فواتير غير مؤداة لهذا الزبون
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Stats Cards */}
                    <div className="p-8 grid grid-cols-3 gap-6">
                      <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex items-center gap-6">
                        <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center text-red-600">
                          <ArrowUpRight className="w-8 h-8" />
                        </div>
                        <div>
                          <div className="text-xs font-black text-slate-400 uppercase tracking-widest">إجمالي الكريدي</div>
                          <div className="text-3xl font-black text-red-600">{(selectedCustomer.balance || 0).toFixed(2)}</div>
                        </div>
                      </div>
                      <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex items-center gap-6">
                        <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
                          <ArrowDownLeft className="w-8 h-8" />
                        </div>
                        <div>
                          <div className="text-xs font-black text-slate-400 uppercase tracking-widest">إجمالي المدفوعات</div>
                          <div className="text-3xl font-black text-emerald-600">
                            {(transactions.filter(t => t.type === 'payment').reduce((s, t) => s + t.amount, 0) || 0).toFixed(2)}
                          </div>
                        </div>
                      </div>
                      <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex items-center gap-6">
                        <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600">
                          <Users className="w-8 h-8" />
                        </div>
                        <div>
                          <div className="text-xs font-black text-slate-400 uppercase tracking-widest">نقاط الوفاء</div>
                          <div className="text-3xl font-black text-amber-600">{(selectedCustomer.loyaltyPoints || 0)}</div>
                        </div>
                      </div>
                    </div>

                    {/* Transaction History */}
                    <div className="flex-1 px-8 pb-8 overflow-hidden">
                      <div className="bg-white h-full rounded-[40px] shadow-sm border border-slate-200 flex flex-col overflow-hidden">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                          <h4 className="text-xl font-black text-slate-800 flex items-center gap-2">
                            <History className="w-5 h-5 text-indigo-600" />
                            سجل المعاملات
                          </h4>
                          <div className="flex gap-2">
                            <button className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-500 flex items-center gap-2">
                              <Calendar className="w-4 h-4" />
                              آخر 30 يوم
                            </button>
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
                                <th className="p-6">التاريخ</th>
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
                                      t.type === 'credit' ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"
                                    )}>
                                      {t.type === 'credit' ? 'كريدي' : 'خلاص'}
                                    </span>
                                  </td>
                                  <td className={cn(
                                    "p-6 text-left font-black text-lg",
                                    t.type === 'credit' ? "text-red-500" : "text-emerald-500"
                                  )}>
                                    {t.type === 'credit' ? '+' : '-'}{(t.amount || 0).toFixed(2)}
                                  </td>
                                </tr>
                              ))}
                              {transactions.length === 0 && (
                                <tr>
                                  <td colSpan={4} className="p-20 text-center text-slate-300 italic font-bold">
                                    لا توجد معاملات مسجلة لهذا الزبون
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="flex-1 flex flex-col bg-white rounded-[40px] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
                <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-black text-slate-800">قائمة الزبناء</h3>
                    <p className="text-slate-500 font-bold">عرض جميع الزبناء المسجلين في النظام</p>
                  </div>
                  <div className="bg-indigo-600 px-6 py-2 rounded-2xl text-white font-black shadow-lg shadow-indigo-200">
                    {filteredCustomers.length} زبون
                  </div>
                </div>
                
                <div className="flex-1 overflow-auto">
                  <table className="w-full text-right border-collapse">
                    <thead className="sticky top-0 bg-white z-10 shadow-sm">
                      <tr className="border-b border-slate-100">
                        <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest">الاسم</th>
                        <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-center">الهاتف</th>
                        <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-center">الرصيد</th>
                        <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-left">الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCustomers.map((customer) => (
                        <tr 
                          key={customer.id} 
                          className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors cursor-pointer"
                          onClick={() => setSelectedCustomer(customer)}
                        >
                          <td className="p-6">
                            <div className="font-black text-slate-800">{customer.name}</div>
                            <div className="text-[10px] font-bold text-slate-400">#{customer.customerNumber || '---'}</div>
                          </td>
                          <td className="p-6 text-center font-bold text-slate-600">{customer.phone}</td>
                          <td className="p-6 text-center">
                            <span className={cn(
                              "font-black px-3 py-1 rounded-lg",
                              customer.balance > 0 ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"
                            )}>
                              {customer.balance.toFixed(2)}
                            </span>
                          </td>
                          <td className="p-6 text-left">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCustomer(customer);
                              }}
                              className="text-indigo-600 font-black text-sm hover:underline"
                            >
                              عرض التفاصيل
                            </button>
                          </td>
                        </tr>
                      ))}
                      {filteredCustomers.length === 0 && (
                        <tr>
                          <td colSpan={4} className="p-20 text-center text-slate-400 font-bold">
                            لا يوجد زبناء يطابقون البحث
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add/Edit Customer Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl max-h-[90vh] flex flex-col rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
              <h3 className="text-2xl font-black text-slate-800">
                {isEditMode ? 'تعديل بيانات الزبون' : 'إضافة زبون جديد'}
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-8">
              <form onSubmit={handleAddCustomer} className="space-y-8">
                {/* Image & Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="space-y-4">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest">صورة الزبون (URL)</label>
                    <div className="aspect-square bg-slate-100 rounded-[32px] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-4 group cursor-pointer hover:bg-slate-50 transition-all overflow-hidden relative">
                      {isUploading ? (
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                          <span className="text-[10px] font-black text-slate-400">جاري التحميل...</span>
                        </div>
                      ) : newCustomer.imageUrl ? (
                        <img src={newCustomer.imageUrl} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <>
                          <div className="bg-white p-4 rounded-2xl shadow-sm group-hover:scale-110 transition-transform">
                            <User className="w-10 h-10 text-slate-300" />
                          </div>
                          <div className="text-[10px] font-black text-slate-400">أدخل رابط الصورة أو اختر من الجهاز</div>
                        </>
                      )}
                    </div>
                    <input 
                      type="text" 
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                      value={newCustomer.imageUrl || ''}
                      onChange={e => setNewCustomer({...newCustomer, imageUrl: e.target.value})}
                      placeholder="https://example.com/image.jpg"
                    />
                    <div className="flex gap-2">
                      <input 
                        type="file" 
                        id="customer-image-upload" 
                        className="hidden" 
                        accept="image/*"
                        onChange={handleFileUpload}
                      />
                      <button 
                        type="button" 
                        onClick={() => document.getElementById('customer-image-upload')?.click()}
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
                          input.capture = 'user';
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

                  <div className="md:col-span-2 space-y-6">
                    <div className="space-y-4">
                      <h4 className="text-lg font-black text-indigo-600 flex items-center gap-2">
                        <User className="w-5 h-5" />
                        المعلومات الأساسية
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-xs font-black text-slate-400 uppercase tracking-widest">الاسم الكامل</label>
                          <input 
                            required
                            type="text" 
                            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black outline-none focus:ring-2 focus:ring-indigo-500"
                            value={newCustomer.name}
                            onChange={e => setNewCustomer({...newCustomer, name: e.target.value})}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-black text-slate-400 uppercase tracking-widest">رقم الهاتف</label>
                          <input 
                            required
                            type="tel" 
                            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black outline-none focus:ring-2 focus:ring-indigo-500"
                            value={newCustomer.phone}
                            onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-xs font-black text-slate-400 uppercase tracking-widest">رقم الزبون</label>
                          <input 
                            type="text" 
                            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black outline-none focus:ring-2 focus:ring-indigo-500"
                            value={newCustomer.customerNumber}
                            onChange={e => setNewCustomer({...newCustomer, customerNumber: e.target.value})}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-black text-slate-400 uppercase tracking-widest">الباركود</label>
                          <div className="relative">
                            <Barcode className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                            <input 
                              type="text" 
                              className="w-full pr-10 pl-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-black outline-none focus:ring-2 focus:ring-indigo-500"
                              value={newCustomer.barcode}
                              onChange={e => setNewCustomer({...newCustomer, barcode: e.target.value})}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Address & Location */}
                <div className="space-y-4">
                  <h4 className="text-lg font-black text-indigo-600 flex items-center gap-2">
                    <MapPin className="w-5 h-5" />
                    العنوان والموقع
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest">العنوان الكامل</label>
                      <input 
                        type="text" 
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black outline-none focus:ring-2 focus:ring-indigo-500"
                        value={newCustomer.address}
                        onChange={e => setNewCustomer({...newCustomer, address: e.target.value})}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest">المدينة</label>
                        <input 
                          type="text" 
                          className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black outline-none focus:ring-2 focus:ring-indigo-500"
                          value={newCustomer.city}
                          onChange={e => setNewCustomer({...newCustomer, city: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest">الرمز البريدي</label>
                        <input 
                          type="text" 
                          className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black outline-none focus:ring-2 focus:ring-indigo-500"
                          value={newCustomer.postalCode}
                          onChange={e => setNewCustomer({...newCustomer, postalCode: e.target.value})}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest">اسم الشارع</label>
                      <input 
                        type="text" 
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black outline-none focus:ring-2 focus:ring-indigo-500"
                        value={newCustomer.streetName}
                        onChange={e => setNewCustomer({...newCustomer, streetName: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest">رقم البناية</label>
                      <input 
                        type="text" 
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black outline-none focus:ring-2 focus:ring-indigo-500"
                        value={newCustomer.buildingNumber}
                        onChange={e => setNewCustomer({...newCustomer, buildingNumber: e.target.value})}
                      />
                    </div>
                  </div>
                </div>

              {/* Financial & Legal */}
              <div className="space-y-4">
                <h4 className="text-lg font-black text-indigo-600 flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  المعلومات المالية والقانونية
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest">سقف الكريدي (درهم)</label>
                    <input 
                      type="number" step="any"
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black outline-none focus:ring-2 focus:ring-indigo-500"
                      value={newCustomer.creditLimit}
                      onChange={e => setNewCustomer({...newCustomer, creditLimit: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest">نوع السعر المفضل</label>
                    <select 
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black outline-none focus:ring-2 focus:ring-indigo-500"
                      value={newCustomer.sellingPriceType}
                      onChange={e => setNewCustomer({...newCustomer, sellingPriceType: e.target.value as any})}
                    >
                      <option value="retail">تقسيط</option>
                      <option value="wholesale">جملة</option>
                      <option value="price3">نصف جملة</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest">الرصيد الافتتاحي</label>
                    <input 
                      type="number" step="any"
                      disabled={isEditMode}
                      className="w-full p-4 bg-slate-100 border border-slate-200 rounded-2xl font-black outline-none cursor-not-allowed"
                      value={newCustomer.balance}
                      onChange={e => setNewCustomer({...newCustomer, balance: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest">الرقم الضريبي</label>
                    <input 
                      type="text" 
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black outline-none focus:ring-2 focus:ring-indigo-500"
                      value={newCustomer.taxNumber}
                      onChange={e => setNewCustomer({...newCustomer, taxNumber: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest">السجل التجاري</label>
                    <input 
                      type="text" 
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black outline-none focus:ring-2 focus:ring-indigo-500"
                      value={newCustomer.commercialRegister}
                      onChange={e => setNewCustomer({...newCustomer, commercialRegister: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              {/* Credit Terms */}
              <div className="space-y-4">
                <h4 className="text-lg font-black text-indigo-600 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  شروط الائتمان (الكريدي)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest">أقصى عدد فواتير كريدي</label>
                    <input 
                      type="number" 
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black outline-none focus:ring-2 focus:ring-indigo-500"
                      value={newCustomer.maxCreditInvoices}
                      onChange={e => setNewCustomer({...newCustomer, maxCreditInvoices: parseInt(e.target.value) || 0})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest">مدة الائتمان (أيام)</label>
                    <input 
                      type="number" 
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black outline-none focus:ring-2 focus:ring-indigo-500"
                      value={newCustomer.creditPeriodDays}
                      onChange={e => setNewCustomer({...newCustomer, creditPeriodDays: parseInt(e.target.value) || 0})}
                    />
                  </div>
                  <div className="flex items-center gap-3 pt-8">
                    <input 
                      type="checkbox" 
                      id="alertOnDelay"
                      className="w-6 h-6 rounded-lg text-indigo-600 focus:ring-indigo-500 border-slate-300"
                      checked={newCustomer.alertOnDelay}
                      onChange={e => setNewCustomer({...newCustomer, alertOnDelay: e.target.checked})}
                    />
                    <label htmlFor="alertOnDelay" className="text-sm font-black text-slate-700">تنبيه عند التأخير</label>
                  </div>
                </div>
              </div>

              {/* Loyalty Program */}
              <div className="space-y-4">
                <h4 className="text-lg font-black text-amber-600 flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  برنامج الوفاء (Loyalty)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest">نقاط الوفاء الحالية</label>
                    <input 
                      type="number" 
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black outline-none focus:ring-2 focus:ring-amber-500"
                      value={newCustomer.loyaltyPoints}
                      onChange={e => setNewCustomer({...newCustomer, loyaltyPoints: parseInt(e.target.value) || 0})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest">نسبة الخصم الخاصة (%)</label>
                    <input 
                      type="number" step="any"
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black outline-none focus:ring-2 focus:ring-amber-500"
                      value={newCustomer.loyaltyDiscount}
                      onChange={e => setNewCustomer({...newCustomer, loyaltyDiscount: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                </div>
              </div>

              {/* Card Info & Notes */}
              <div className="space-y-4">
                <h4 className="text-lg font-black text-indigo-600 flex items-center gap-2">
                  <ClipboardList className="w-5 h-5" />
                  معلومات إضافية
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest">نوع البطاقة</label>
                      <input 
                        type="text" 
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black outline-none focus:ring-2 focus:ring-indigo-500"
                        value={newCustomer.cardType}
                        onChange={e => setNewCustomer({...newCustomer, cardType: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest">رقم البطاقة</label>
                      <input 
                        type="text" 
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black outline-none focus:ring-2 focus:ring-indigo-500"
                        value={newCustomer.cardNumber}
                        onChange={e => setNewCustomer({...newCustomer, cardNumber: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest">ملاحظات</label>
                    <textarea 
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black outline-none focus:ring-2 focus:ring-indigo-500 h-20 resize-none"
                      value={newCustomer.notes}
                      onChange={e => setNewCustomer({...newCustomer, notes: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black py-5 rounded-[32px] transition-all text-xl"
                >
                  إلغاء
                </button>
                <button type="submit" className="flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white font-black py-5 rounded-[32px] shadow-2xl shadow-indigo-200 transition-all flex items-center justify-center gap-3 text-xl">
                  <Save className="w-6 h-6" />
                  {isEditMode ? 'تحديث البيانات' : 'حفظ الزبون'}
                </button>
              </div>
            </form>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-2xl font-black text-slate-800">تسجيل دفعة</h3>
              <button onClick={() => setIsPaymentModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handlePayment} className="p-8 space-y-6">
              <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100 text-center">
                <div className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-1">الكريدي الحالي</div>
                <div className="text-4xl font-black text-indigo-700">{selectedCustomer?.balance.toFixed(2)}</div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">المبلغ المدفوع</label>
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
                  placeholder="مثال: دفعة نقداً"
                  value={paymentNote}
                  onChange={e => setPaymentNote(e.target.value)}
                />
              </div>
              <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-5 rounded-[32px] shadow-2xl shadow-emerald-200 transition-all flex items-center justify-center gap-3 text-xl">
                <DollarSign className="w-6 h-6" />
                تأكيد الدفع
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
