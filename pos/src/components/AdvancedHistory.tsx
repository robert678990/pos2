import React, { useState, useEffect } from 'react';
import { 
  History, 
  Search, 
  Calendar, 
  Filter,
  ArrowRight,
  User,
  Clock,
  FileText,
  AlertCircle,
  Undo2,
  FileEdit,
  ArrowLeftRight,
  Trash2
} from 'lucide-react';
import { collection, query, orderBy, limit, onSnapshot, Timestamp, where } from 'firebase/firestore';
import { db } from '../firebase';
import { Log } from '../types';
import { format, startOfDay, endOfDay } from 'date-fns';
import { cn } from '../lib/utils';
import { handleFirestoreError, OperationType } from '../lib/error-handler';

interface AdvancedHistoryProps {
  onBack: () => void;
}

export default function AdvancedHistory({ onBack }: AdvancedHistoryProps) {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [filterType, setFilterType] = useState<string>('all');

  useEffect(() => {
    const start = startOfDay(new Date(startDate));
    const end = endOfDay(new Date(endDate));

    let q = query(
      collection(db, 'logs'),
      where('timestamp', '>=', Timestamp.fromDate(start)),
      where('timestamp', '<=', Timestamp.fromDate(end)),
      orderBy('timestamp', 'desc'),
      limit(100)
    );

    if (filterType !== 'all') {
      q = query(
        collection(db, 'logs'),
        where('type', '==', filterType),
        where('timestamp', '>=', Timestamp.fromDate(start)),
        where('timestamp', '<=', Timestamp.fromDate(end)),
        orderBy('timestamp', 'desc'),
        limit(100)
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Log)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'logs');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [startDate, endDate, filterType]);

  const filteredLogs = logs.filter(log => 
    log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.userEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.invoiceNumber?.toString().includes(searchTerm)
  );

  const getLogIcon = (type: string) => {
    switch (type) {
      case 'invoice_cancellation': return <Trash2 className="w-5 h-5 text-red-600" />;
      case 'invoice_edit': return <FileEdit className="w-5 h-5 text-blue-600" />;
      case 'purchase_edit': return <FileEdit className="w-5 h-5 text-orange-600" />;
      case 'purchase_return': return <Undo2 className="w-5 h-5 text-orange-600" />;
      case 'sale_return': return <Undo2 className="w-5 h-5 text-emerald-600" />;
      case 'balance_transfer': return <ArrowLeftRight className="w-5 h-5 text-purple-600" />;
      case 'damaged_product': return <AlertCircle className="w-5 h-5 text-red-600" />;
      default: return <FileText className="w-5 h-5 text-slate-600" />;
    }
  };

  const getLogTypeLabel = (type: string) => {
    switch (type) {
      case 'invoice_cancellation': return 'إلغاء فاتورة مبيعات';
      case 'invoice_edit': return 'تعديل فاتورة مبيعات';
      case 'purchase_edit': return 'تعديل فاتورة مشتريات';
      case 'purchase_return': return 'إرجاع مشتريات';
      case 'sale_return': return 'إرجاع مبيعات';
      case 'balance_transfer': return 'تحويل رصيد';
      case 'damaged_product': return 'منتج تالف';
      default: return type;
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
            <div className="bg-slate-800 p-3 rounded-2xl text-white shadow-lg shadow-slate-200">
              <History className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-3xl font-black text-slate-800">سجل العمليات المتقدمة</h2>
              <p className="text-slate-500 font-bold">تتبع التعديلات، الإلغاءات، والتحويلات</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 bg-slate-100 p-2 rounded-2xl border border-slate-200">
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
            <div className="flex items-center gap-2 px-3 border-l border-slate-200">
              <span className="text-xs font-black text-slate-500">إلى:</span>
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent text-sm font-black text-slate-700 outline-none"
              />
            </div>
            <div className="flex items-center gap-2 px-3">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="bg-transparent text-sm font-black text-slate-700 outline-none cursor-pointer"
              >
                <option value="all">الكل</option>
                <option value="invoice_cancellation">إلغاء مبيعات</option>
                <option value="invoice_edit">تعديل مبيعات</option>
                <option value="purchase_edit">تعديل مشتريات</option>
                <option value="purchase_return">إرجاع مشتريات</option>
                <option value="sale_return">إرجاع مبيعات</option>
                <option value="balance_transfer">تحويل رصيد</option>
                <option value="damaged_product">منتج تالف</option>
              </select>
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
            placeholder="بحث في التفاصيل، المستخدم، أو رقم الفاتورة..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pr-12 pl-4 py-4 bg-white border border-slate-200 rounded-2xl font-bold text-slate-700 focus:ring-2 focus:ring-slate-500 outline-none shadow-sm transition-all"
          />
        </div>
      </div>

      {/* Logs List */}
      <div className="flex-1 overflow-y-auto px-6 pb-6 custom-scrollbar">
        <div className="bg-white rounded-[40px] shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-right">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest">النوع</th>
                <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest">التفاصيل</th>
                <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-center">المستخدم</th>
                <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-center">الوقت</th>
                <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-left">المبلغ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-20 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-12 h-12 border-4 border-slate-800 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-slate-500 font-black">جاري جلب السجل...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-20 text-center text-slate-300 italic font-bold">
                    لا توجد عمليات مسجلة في هذه الفترة
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="p-6">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-50 rounded-lg group-hover:bg-white transition-colors">
                          {getLogIcon(log.type)}
                        </div>
                        <span className="font-black text-slate-700 text-sm">{getLogTypeLabel(log.type)}</span>
                      </div>
                    </td>
                    <td className="p-6">
                      <p className="font-bold text-slate-600 text-sm max-w-md">{log.details}</p>
                    </td>
                    <td className="p-6 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <div className="flex items-center gap-2 text-slate-500">
                          <User className="w-3 h-3" />
                          <span className="text-xs font-bold">{log.userEmail?.split('@')[0] || 'نظام'}</span>
                        </div>
                      </div>
                    </td>
                    <td className="p-6 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <div className="flex items-center gap-2 text-slate-500">
                          <Clock className="w-3 h-3" />
                          <span className="text-xs font-bold">{log.timestamp ? format(log.timestamp.toDate(), 'HH:mm:ss') : '--:--'}</span>
                        </div>
                        <span className="text-[10px] font-black text-slate-400">{log.timestamp ? format(log.timestamp.toDate(), 'yyyy-MM-dd') : ''}</span>
                      </div>
                    </td>
                    <td className="p-6 text-left">
                      {log.amount !== undefined ? (
                        <span className="font-black text-slate-800">{log.amount.toFixed(2)} DH</span>
                      ) : (
                        <span className="text-slate-300 text-xs">---</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
