import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  TrendingUp, 
  DollarSign, 
  ShoppingBag, 
  Users, 
  Calendar, 
  Download, 
  Filter, 
  ArrowUpRight, 
  ArrowDownRight,
  PieChart as PieChartIcon,
  BarChart3,
  Clock,
  ChevronRight,
  Search,
  Printer,
  FileText,
  CreditCard,
  Banknote
} from 'lucide-react';
import { collection, query, where, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Sale } from '../types';
import { handleFirestoreError, OperationType } from '../lib/error-handler';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar
} from 'recharts';
import { format, startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { cn } from '../lib/utils';
import { exportToExcel, exportToPDF } from '../lib/export-utils';

export default function Reports() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month'>('today');
  const [activeTab, setActiveTab] = useState<'overview' | 'products'>('overview');
  const [loading, setLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState<{ key: keyof ProductStat; direction: 'asc' | 'desc' }>({ key: 'revenue', direction: 'desc' });
  const [productSearch, setProductSearch] = useState('');

  useEffect(() => {
    let start: Date;
    let end: Date;

    const now = new Date();
    if (dateRange === 'today') {
      start = startOfDay(now);
      end = endOfDay(now);
    } else if (dateRange === 'week') {
      start = startOfWeek(now);
      end = endOfWeek(now);
    } else {
      start = startOfMonth(now);
      end = endOfMonth(now);
    }

    const q = query(
      collection(db, 'sales'),
      where('timestamp', '>=', Timestamp.fromDate(start)),
      where('timestamp', '<=', Timestamp.fromDate(end)),
      orderBy('timestamp', 'desc')
    );

    const unsub = onSnapshot(q, (snapshot) => {
      setSales(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sale)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'sales');
    });

    return unsub;
  }, [dateRange]);

  const totalSales = sales.reduce((sum, s) => sum + s.total, 0);
  const totalProfit = sales.reduce((sum, s) => sum + (s.profit || 0), 0);
  const cashSales = sales.filter(s => s.paymentType === 'cash').reduce((sum, s) => sum + s.total, 0);
  const creditSales = sales.filter(s => s.paymentType === 'credit').reduce((sum, s) => sum + s.total, 0);

  // Chart Data: Sales by Hour
  const hourlyData = Array.from({ length: 24 }, (_, i) => {
    const hourSales = sales.filter(s => {
      if (!s.timestamp) return false;
      const date = s.timestamp.toDate();
      return date.getHours() === i;
    });
    return {
      name: `${i}:00`,
      sales: hourSales.reduce((sum, s) => sum + s.total, 0),
      profit: hourSales.reduce((sum, s) => sum + (s.profit || 0), 0)
    };
  }).filter(d => d.sales > 0 || (d.name >= '08:00' && d.name <= '22:00'));

  // Chart Data: Category Distribution
  const categoryData = [
    { name: 'نقداً', value: cashSales, color: '#10b981' },
    { name: 'كريدي', value: creditSales, color: '#ef4444' },
    { name: 'بطاقة', value: sales.filter(s => s.paymentType === 'card').reduce((sum, s) => sum + s.total, 0), color: '#6366f1' }
  ].filter(d => d.value > 0);

  // Aggregated Product Stats
  interface ProductStat {
    name: string;
    quantity: number;
    revenue: number;
    profit: number;
  }

  const productStats = sales.reduce((acc, sale) => {
    sale.items.forEach(item => {
      if (!acc[item.productId]) {
        acc[item.productId] = {
          name: item.name,
          quantity: 0,
          revenue: 0,
          profit: 0
        };
      }
      acc[item.productId].quantity += item.quantity;
      acc[item.productId].revenue += item.quantity * item.price;
      acc[item.productId].profit += item.profit;
    });
    return acc;
  }, {} as Record<string, ProductStat>);

  const handleSort = (key: keyof ProductStat) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const sortedProductStats: ProductStat[] = (Object.values(productStats) as ProductStat[])
    .filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()))
    .sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortConfig.direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortConfig.direction === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });

  const handleExportSales = () => {
    const data = sales.map(sale => ({
      'رقم الفاتورة': sale.invoiceNumber,
      'التاريخ': sale.timestamp ? format(sale.timestamp.toDate(), 'yyyy-MM-dd HH:mm') : '',
      'الزبون': sale.customerName,
      'طريقة الدفع': sale.paymentType === 'cash' ? 'نقداً' : sale.paymentType === 'credit' ? 'أجل' : 'بطاقة',
      'عدد المنتجات': sale.items.length,
      'الإجمالي': sale.total.toFixed(2)
    }));
    exportToExcel(data, `تقرير_المبيعات_${dateRange}_${format(new Date(), 'yyyy-MM-dd')}`);
  };

  const handleExportSalesPDF = () => {
    const data = sales.map(sale => ({
      'رقم الفاتورة': sale.invoiceNumber,
      'التاريخ': sale.timestamp ? format(sale.timestamp.toDate(), 'yyyy-MM-dd HH:mm') : '',
      'الزبون': sale.customerName,
      'طريقة الدفع': sale.paymentType === 'cash' ? 'نقداً' : sale.paymentType === 'credit' ? 'أجل' : 'بطاقة',
      'المجموع': sale.total.toFixed(2)
    }));
    exportToPDF(data, `تقرير_المبيعات_${dateRange}_${format(new Date(), 'yyyy-MM-dd')}`, 'تقرير المبيعات');
  };

  const handleExportProducts = () => {
    const data = sortedProductStats.map(stat => ({
      'المنتج': stat.name,
      'الكمية المباعة': stat.quantity.toFixed(2),
      'إجمالي المبيعات': stat.revenue.toFixed(2),
      'صافي الربح': stat.profit.toFixed(2)
    }));
    exportToExcel(data, `تقرير_المنتجات_${dateRange}_${format(new Date(), 'yyyy-MM-dd')}`);
  };

  const handleExportProductsPDF = () => {
    const data = sortedProductStats.map(stat => ({
      'المنتج': stat.name,
      'الكمية المباعة': stat.quantity.toFixed(2),
      'إجمالي المبيعات': stat.revenue.toFixed(2),
      'صافي الربح': stat.profit.toFixed(2)
    }));
    exportToPDF(data, `تقرير_المنتجات_${dateRange}_${format(new Date(), 'yyyy-MM-dd')}`, 'تقرير مبيعات المنتجات');
  };

  return (
    <div className="p-8 h-full flex flex-col gap-8 bg-slate-100 overflow-y-auto" dir="rtl">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-4xl font-black text-slate-800">التقارير والإحصائيات</h2>
          <div className="flex gap-4 mt-2">
            <button 
              onClick={() => setActiveTab('overview')}
              className={cn(
                "text-sm font-black transition-all pb-1 border-b-2",
                activeTab === 'overview' ? "text-indigo-600 border-indigo-600" : "text-slate-400 border-transparent hover:text-slate-600"
              )}
            >
              نظرة عامة
            </button>
            <button 
              onClick={() => setActiveTab('products')}
              className={cn(
                "text-sm font-black transition-all pb-1 border-b-2",
                activeTab === 'products' ? "text-indigo-600 border-indigo-600" : "text-slate-400 border-transparent hover:text-slate-600"
              )}
            >
              تقرير المنتجات
            </button>
          </div>
        </div>
        <div className="flex gap-3 bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200">
          {(['today', 'week', 'month'] as const).map(range => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={cn(
                "px-6 py-2.5 rounded-xl text-sm font-black transition-all",
                dateRange === range ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" : "text-slate-500 hover:bg-slate-50"
              )}
            >
              {range === 'today' ? 'اليوم' : range === 'week' ? 'هذا الأسبوع' : 'هذا الشهر'}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'overview' ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ y: -5, scale: 1.02 }}
              className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-200 relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-500"></div>
              <div className="relative z-10 space-y-4">
                <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                  <TrendingUp className="w-8 h-8" />
                </div>
                <div>
                  <div className="text-xs font-black text-slate-400 uppercase tracking-widest">إجمالي المبيعات</div>
                  <div className="text-3xl font-black text-slate-800">{(totalSales || 0).toFixed(2)} <span className="text-xs">درهم</span></div>
                </div>
                <div className="flex items-center gap-1 text-emerald-500 text-xs font-bold">
                  <ArrowUpRight className="w-4 h-4" />
                  <span>+12% عن أمس</span>
                </div>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              whileHover={{ y: -5, scale: 1.02 }}
              className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-200 relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-500"></div>
              <div className="relative z-10 space-y-4">
                <div className="w-14 h-14 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-200">
                  <DollarSign className="w-8 h-8" />
                </div>
                <div>
                  <div className="text-xs font-black text-slate-400 uppercase tracking-widest">صافي الربح</div>
                  <div className="text-3xl font-black text-slate-800">{(totalProfit || 0).toFixed(2)} <span className="text-xs">درهم</span></div>
                </div>
                <div className="flex items-center gap-1 text-emerald-500 text-xs font-bold">
                  <ArrowUpRight className="w-4 h-4" />
                  <span>+8% عن أمس</span>
                </div>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              whileHover={{ y: -5, scale: 1.02 }}
              className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-200 relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-50 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-500"></div>
              <div className="relative z-10 space-y-4">
                <div className="w-14 h-14 bg-amber-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-amber-200">
                  <Banknote className="w-8 h-8" />
                </div>
                <div>
                  <div className="text-xs font-black text-slate-400 uppercase tracking-widest">مبيعات الكاش</div>
                  <div className="text-3xl font-black text-slate-800">{(cashSales || 0).toFixed(2)} <span className="text-xs">درهم</span></div>
                </div>
                <div className="text-xs font-bold text-slate-400">
                  {((cashSales / totalSales) * 100 || 0).toFixed(1)}% من الإجمالي
                </div>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              whileHover={{ y: -5, scale: 1.02 }}
              className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-200 relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-red-50 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-500"></div>
              <div className="relative z-10 space-y-4">
                <div className="w-14 h-14 bg-red-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-red-200">
                  <CreditCard className="w-8 h-8" />
                </div>
                <div>
                  <div className="text-xs font-black text-slate-400 uppercase tracking-widest">مبيعات الكريدي</div>
                  <div className="text-3xl font-black text-slate-800">{(creditSales || 0).toFixed(2)} <span className="text-xs">درهم</span></div>
                </div>
                <div className="text-xs font-bold text-slate-400">
                  {((creditSales / totalSales) * 100 || 0).toFixed(1)}% من الإجمالي
                </div>
              </div>
            </motion.div>
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white p-8 rounded-[40px] shadow-sm border border-slate-200">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                  <BarChart3 className="w-6 h-6 text-indigo-600" />
                  أفضل 5 منتجات مبيعاً
                </h3>
              </div>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sortedProductStats.slice(0, 5)} layout="vertical" margin={{ right: 30, left: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                    <XAxis type="number" hide />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      axisLine={false} 
                      tickLine={false} 
                      width={100}
                      tick={{fontSize: 10, fontWeight: 'bold', fill: '#64748b'}} 
                    />
                    <Tooltip 
                      cursor={{fill: '#f8fafc'}}
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', direction: 'rtl' }}
                      itemStyle={{ fontWeight: 'bold', fontSize: '12px' }}
                    />
                    <Bar dataKey="revenue" fill="#4f46e5" radius={[0, 8, 8, 0]} barSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-200">
              <h3 className="text-xl font-black text-slate-800 mb-8 flex items-center gap-2">
                <PieChartIcon className="w-6 h-6 text-indigo-600" />
                توزيع طرق الدفع
              </h3>
              <div className="h-64 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={8}
                      dataKey="value"
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-xs font-bold text-slate-400">الإجمالي</span>
                  <span className="text-xl font-black text-slate-800">{(totalSales || 0).toFixed(0)}</span>
                </div>
              </div>
              <div className="space-y-4 mt-8">
                {categoryData.map((item, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                      <span className="text-sm font-bold text-slate-600">{item.name}</span>
                    </div>
                    <span className="text-sm font-black text-slate-800">{((item.value / totalSales) * 100 || 0).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white p-8 rounded-[40px] shadow-sm border border-slate-200">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                  <TrendingUp className="w-6 h-6 text-indigo-600" />
                  تحليل المبيعات والربح
                </h3>
                <div className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-indigo-600 rounded-full"></div>
                    <span className="text-xs font-bold text-slate-500">المبيعات</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
                    <span className="text-xs font-bold text-slate-500">الربح</span>
                  </div>
                </div>
              </div>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={hourlyData}>
                    <defs>
                      <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold', fill: '#94a3b8'}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold', fill: '#94a3b8'}} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', direction: 'rtl' }}
                      itemStyle={{ fontWeight: 'bold', fontSize: '12px' }}
                    />
                    <Area type="monotone" dataKey="sales" stroke="#4f46e5" strokeWidth={4} fillOpacity={1} fill="url(#colorSales)" />
                    <Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={4} fillOpacity={1} fill="url(#colorProfit)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Recent Sales Table */}
          <div className="bg-white rounded-[40px] shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                <Clock className="w-7 h-7 text-indigo-600" />
                آخر المبيعات
              </h3>
              <div className="flex gap-3">
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input 
                    type="text" 
                    placeholder="رقم الفاتورة..."
                    className="pr-10 pl-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <motion.button 
                  whileHover={{ scale: 1.1, color: "#4f46e5" }}
                  whileTap={{ scale: 0.9 }}
                  onClick={handleExportSales}
                  className="p-2 bg-white border border-slate-200 rounded-xl text-slate-400 transition-all"
                  title="تصدير Excel"
                >
                  <Download className="w-5 h-5" />
                </motion.button>
                <motion.button 
                  whileHover={{ scale: 1.1, color: "#ef4444" }}
                  whileTap={{ scale: 0.9 }}
                  onClick={handleExportSalesPDF}
                  className="p-2 bg-white border border-slate-200 rounded-xl text-slate-400 transition-all"
                  title="تصدير PDF"
                >
                  <FileText className="w-5 h-5" />
                </motion.button>
                <button className="p-2 bg-white border border-slate-200 rounded-xl text-slate-400 hover:bg-slate-50 transition-all">
                  <Printer className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                  <tr>
                    <th className="p-6">رقم الفاتورة</th>
                    <th className="p-6">الوقت</th>
                    <th className="p-6">الزبون</th>
                    <th className="p-6 text-center">طريقة الدفع</th>
                    <th className="p-6 text-center">المنتجات</th>
                    <th className="p-6 text-left">الإجمالي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sales.map(sale => (
                    <tr key={sale.id} className="hover:bg-slate-50/50 transition-colors group cursor-pointer">
                      <td className="p-6">
                        <div className="font-black text-indigo-600">#{sale.invoiceNumber}</div>
                      </td>
                      <td className="p-6">
                        <div className="font-bold text-slate-700">{sale.timestamp ? format(sale.timestamp.toDate(), 'HH:mm') : '...'}</div>
                        <div className="text-[10px] text-slate-400">{sale.timestamp ? format(sale.timestamp.toDate(), 'yyyy-MM-dd') : ''}</div>
                      </td>
                      <td className="p-6">
                        <div className="font-bold text-slate-800">{sale.customerName}</div>
                      </td>
                      <td className="p-6 text-center">
                        <span className={cn(
                          "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider",
                          sale.paymentType === 'cash' ? "bg-emerald-50 text-emerald-600" : 
                          sale.paymentType === 'credit' ? "bg-red-50 text-red-600" : "bg-indigo-50 text-indigo-600"
                        )}>
                          {sale.paymentType === 'cash' ? 'نقداً' : sale.paymentType === 'credit' ? 'أجل' : 'بطاقة'}
                        </span>
                      </td>
                      <td className="p-6 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <ShoppingBag className="w-4 h-4 text-slate-300" />
                          <span className="font-bold text-slate-600">{sale.items.length}</span>
                        </div>
                      </td>
                      <td className="p-6 text-left">
                        <div className="font-black text-slate-800 text-lg">{(sale.total || 0).toFixed(2)}</div>
                      </td>
                    </tr>
                  ))}
                  {sales.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-20 text-center text-slate-300 italic font-bold">
                        لا توجد مبيعات مسجلة لهذه الفترة
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-center">
              <button className="text-indigo-600 font-black text-sm flex items-center gap-2 hover:gap-3 transition-all">
                عرض جميع الفواتير
                <ChevronRight className="w-5 h-5 rotate-180" />
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white rounded-[40px] shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h3 className="text-2xl font-black text-slate-800 flex items-center gap-3">
              <ShoppingBag className="w-7 h-7 text-indigo-600" />
              تقرير مبيعات المنتجات
            </h3>
            <div className="flex gap-4">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input 
                  type="text" 
                  placeholder="ابحث عن منتج..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="pr-10 pl-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <button 
                onClick={handleExportProducts}
                className="p-2 bg-white border border-slate-200 rounded-xl text-slate-400 hover:bg-slate-50 transition-all"
                title="تصدير Excel"
              >
                <Download className="w-5 h-5" />
              </button>
              <button 
                onClick={handleExportProductsPDF}
                className="p-2 bg-white border border-slate-200 rounded-xl text-slate-400 hover:bg-slate-50 transition-all"
                title="تصدير PDF"
              >
                <FileText className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                <tr>
                  <th className="p-6 cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => handleSort('name')}>
                    المنتج {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="p-6 text-center cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => handleSort('quantity')}>
                    الكمية المباعة {sortConfig.key === 'quantity' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="p-6 text-center cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => handleSort('revenue')}>
                    إجمالي المبيعات {sortConfig.key === 'revenue' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="p-6 text-left cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => handleSort('profit')}>
                    صافي الربح {sortConfig.key === 'profit' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedProductStats.map((stat, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="p-6">
                      <div className="font-black text-slate-800">{stat.name}</div>
                    </td>
                    <td className="p-6 text-center">
                      <div className="font-bold text-slate-600">{(stat.quantity || 0).toFixed(2)}</div>
                    </td>
                    <td className="p-6 text-center">
                      <div className="font-black text-indigo-600">{(stat.revenue || 0).toFixed(2)}</div>
                    </td>
                    <td className="p-6 text-left">
                      <div className="font-black text-emerald-600">{(stat.profit || 0).toFixed(2)}</div>
                    </td>
                  </tr>
                ))}
                {sortedProductStats.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-20 text-center text-slate-300 italic font-bold">
                      لا توجد بيانات للمنتجات في هذه الفترة
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
