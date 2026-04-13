import React, { useState, useEffect } from 'react';
import { 
  Wallet, 
  Plus, 
  Search, 
  X,
  Save,
  Trash2,
  Filter,
  Calendar,
  DollarSign,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  PieChart as PieChartIcon,
  Tag,
  FileText,
  AlertTriangle
} from 'lucide-react';
import { collection, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, query, orderBy, Timestamp, where } from 'firebase/firestore';
import { db } from '../firebase';
import { cn } from '../lib/utils';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { handleFirestoreError, OperationType } from '../lib/error-handler';
import { supabaseService } from '../services/supabaseService';
import { exportToExcel, exportToPDF } from '../lib/export-utils';
import { Download } from 'lucide-react';

interface Expense {
  id?: string;
  category: string;
  amount: number;
  note: string;
  timestamp: any;
}

const expenseCategories = ['كراء', 'كهرباء وماء', 'أجور', 'نقل', 'سلع', 'أخرى'];

export default function Expenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [amountInput, setAmountInput] = useState('');
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    type: 'danger' | 'warning' | 'info';
  } | null>(null);

  const [newExpense, setNewExpense] = useState({
    category: 'أخرى',
    amount: 0,
    note: ''
  });

  useEffect(() => {
    const q = query(collection(db, 'expenses'), orderBy('timestamp', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setExpenses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'expenses');
    });
    return unsub;
  }, []);

  const filteredExpenses = expenses.filter(e => 
    e.note.toLowerCase().includes(search.toLowerCase()) || 
    e.category.includes(search)
  );

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  
  // Current month expenses
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const currentMonthExpenses = expenses.filter(e => {
    if (!e.timestamp) return false;
    const date = e.timestamp.toDate();
    return date >= monthStart && date <= monthEnd;
  }).reduce((sum, e) => sum + e.amount, 0);

  // Chart Data
  const chartData = expenseCategories.map(cat => ({
    name: cat,
    value: expenses.filter(e => e.category === cat).reduce((sum, e) => sum + e.amount, 0)
  })).filter(d => d.value > 0);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b'];

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const expenseData = {
        category: newExpense.category || 'أخرى',
        amount: Number(newExpense.amount) || 0,
        note: newExpense.note || '',
        timestamp: serverTimestamp()
      };
      const docRef = await addDoc(collection(db, 'expenses'), expenseData);
      
      // Sync to Supabase
      supabaseService.syncExpense({ ...expenseData, id: docRef.id, timestamp: new Date() });
      
      setIsModalOpen(false);
      setNewExpense({ category: 'أخرى', amount: 0, note: '' });
      setAmountInput('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'expenses');
    }
  };

  const handleExportExpenses = () => {
    const data = expenses.map(e => ({
      'التاريخ': e.timestamp ? format(e.timestamp.toDate(), 'yyyy-MM-dd HH:mm') : '',
      'الفئة': e.category,
      'المبلغ': e.amount.toFixed(2),
      'ملاحظات': e.note
    }));
    exportToExcel(data, `تقرير_المصاريف_${format(new Date(), 'yyyy-MM-dd')}`);
  };

  const handleExportExpensesPDF = () => {
    const data = expenses.map(e => ({
      'التاريخ': e.timestamp ? format(e.timestamp.toDate(), 'yyyy-MM-dd HH:mm') : '',
      'الفئة': e.category,
      'المبلغ': e.amount.toFixed(2),
      'ملاحظات': e.note
    }));
    exportToPDF(data, `تقرير_المصاريف_${format(new Date(), 'yyyy-MM-dd')}`, 'تقرير المصاريف');
  };

  const handleDelete = async (id: string) => {
    setConfirmModal({
      title: 'حذف المصاريف',
      message: 'هل أنت متأكد من حذف هذه المصاريف؟ لا يمكن التراجع عن هذه العملية.',
      type: 'danger',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'expenses', id));
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `expenses/${id}`);
        }
      }
    });
  };

  return (
    <div className="p-8 h-full flex flex-col gap-8 bg-slate-100 overflow-y-auto" dir="rtl">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-4xl font-black text-slate-800">المصاريف</h2>
          <p className="text-slate-500 font-bold mt-1">تتبع مصاريف المتجر والتدفقات الخارجة</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleExportExpenses}
            className="bg-white text-slate-600 px-4 py-2 rounded-xl font-bold flex items-center gap-2 border border-slate-200 hover:bg-slate-50 transition-all shadow-sm"
            title="تصدير Excel"
          >
            <Download className="w-5 h-5 text-emerald-600" />
            Excel
          </button>
          <button 
            onClick={handleExportExpensesPDF}
            className="bg-white text-slate-600 px-4 py-2 rounded-xl font-bold flex items-center gap-2 border border-slate-200 hover:bg-slate-50 transition-all shadow-sm"
            title="تصدير PDF"
          >
            <FileText className="w-5 h-5 text-red-600" />
            PDF
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-red-600 hover:bg-red-700 text-white px-8 py-4 rounded-2xl font-black flex items-center gap-2 shadow-xl shadow-red-200 transition-all"
          >
            <Plus className="w-5 h-5" />
            إضافة مصاريف جديدة
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Stats & Chart */}
        <div className="space-y-8">
          <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-200 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-50 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-500"></div>
            <div className="relative z-10 space-y-4">
              <div className="w-14 h-14 bg-red-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-red-200">
                <TrendingDown className="w-8 h-8" />
              </div>
              <div>
                <div className="text-xs font-black text-slate-400 uppercase tracking-widest">مصاريف هذا الشهر</div>
                <div className="text-4xl font-black text-slate-800">{(currentMonthExpenses || 0).toFixed(2)} <span className="text-sm">درهم</span></div>
              </div>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-200">
            <h3 className="text-xl font-black text-slate-800 mb-8 flex items-center gap-2">
              <PieChartIcon className="w-6 h-6 text-red-600" />
              توزيع المصاريف
            </h3>
            <div className="h-64 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={8}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-4 mt-8">
              {chartData.map((item, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                    <span className="text-sm font-bold text-slate-600">{item.name}</span>
                  </div>
                  <span className="text-sm font-black text-slate-800">{(item.value || 0).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Expense List */}
        <div className="lg:col-span-2 bg-white rounded-[40px] shadow-sm border border-slate-200 flex flex-col overflow-hidden">
          <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h3 className="text-2xl font-black text-slate-800 flex items-center gap-3">
              <FileText className="w-7 h-7 text-red-600" />
              سجل المصاريف
            </h3>
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input 
                type="text" 
                placeholder="بحث..."
                className="pr-10 pl-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-right">
              <thead className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest sticky top-0">
                <tr>
                  <th className="p-6">التاريخ</th>
                  <th className="p-6">التصنيف</th>
                  <th className="p-6">البيان</th>
                  <th className="p-6 text-left">المبلغ</th>
                  <th className="p-6 w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredExpenses.map(expense => (
                  <tr key={expense.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="p-6">
                      <div className="font-bold text-slate-700">{expense.timestamp ? format(expense.timestamp.toDate(), 'yyyy-MM-dd') : '...'}</div>
                    </td>
                    <td className="p-6">
                      <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-black uppercase tracking-wider">
                        {expense.category}
                      </span>
                    </td>
                    <td className="p-6">
                      <div className="font-bold text-slate-600">{expense.note}</div>
                    </td>
                    <td className="p-6 text-left font-black text-red-500 text-lg">
                      {(expense.amount || 0).toFixed(2)}
                    </td>
                    <td className="p-6">
                      <button onClick={() => handleDelete(expense.id!)} className="p-2 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredExpenses.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-20 text-center text-slate-300 italic font-bold">
                      لا توجد مصاريف مسجلة
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add Expense Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-2xl font-black text-slate-800">إضافة مصاريف</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleAddExpense} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">التصنيف</label>
                <select 
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                  value={newExpense.category}
                  onChange={e => setNewExpense({...newExpense, category: e.target.value})}
                >
                  {expenseCategories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">المبلغ</label>
                <input 
                  required
                  type="number" step="any"
                  className="w-full p-6 bg-slate-50 border border-slate-200 rounded-[32px] text-4xl font-black text-red-600 text-center outline-none focus:ring-4 focus:ring-red-500/20"
                  value={amountInput}
                  onChange={e => {
                    setAmountInput(e.target.value);
                    setNewExpense({...newExpense, amount: parseFloat(e.target.value) || 0});
                  }}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">ملاحظة / البيان</label>
                <input 
                  type="text" 
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="مثال: فاتورة الكهرباء لشهر مارس"
                  value={newExpense.note}
                  onChange={e => setNewExpense({...newExpense, note: e.target.value})}
                />
              </div>
              <button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-5 rounded-[32px] shadow-2xl shadow-red-200 transition-all flex items-center justify-center gap-3 text-xl">
                <Save className="w-6 h-6" />
                حفظ المصاريف
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-[200] p-4">
          <div className="bg-white w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <div className="p-8 text-center space-y-6">
              <div className={cn(
                "w-20 h-20 rounded-full flex items-center justify-center mx-auto",
                confirmModal.type === 'danger' ? "bg-red-100 text-red-600" : 
                confirmModal.type === 'warning' ? "bg-amber-100 text-amber-600" : 
                "bg-indigo-100 text-indigo-600"
              )}>
                {confirmModal.type === 'danger' ? <Trash2 className="w-10 h-10" /> : 
                 confirmModal.type === 'warning' ? <AlertTriangle className="w-10 h-10" /> : 
                 <Wallet className="w-10 h-10" />}
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-slate-800">{confirmModal.title}</h3>
                <p className="text-slate-500 font-bold">{confirmModal.message}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setConfirmModal(null)}
                  className="py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black rounded-2xl transition-all"
                >
                  تراجع
                </button>
                <button 
                  onClick={() => {
                    confirmModal.onConfirm();
                    setConfirmModal(null);
                  }}
                  className={cn(
                    "py-4 text-white font-black rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2",
                    confirmModal.type === 'danger' ? "bg-red-600 hover:bg-red-700 shadow-red-200" : 
                    confirmModal.type === 'warning' ? "bg-amber-500 hover:bg-amber-600 shadow-amber-200" : 
                    "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200"
                  )}
                >
                  تأكيد
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
