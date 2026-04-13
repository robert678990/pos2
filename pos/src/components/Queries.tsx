import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Calendar, 
  ChevronDown, 
  ChevronLeft, 
  FileText, 
  TrendingUp, 
  ShoppingBag, 
  Users, 
  Truck, 
  Package, 
  Wallet, 
  Box as BoxIcon,
  BarChart3,
  Download,
  Printer,
  Filter,
  ArrowRight,
  Home as HomeIcon,
  ShoppingCart,
  PieChart as PieChartIcon,
  BarChart as BarChartIcon,
  LineChart as LineChartIcon
} from 'lucide-react';
import { collection, query, where, orderBy, getDocs, Timestamp, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { Sale, Product, Customer, Supplier, Expense, Transaction, Purchase } from '../types';
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth, subDays, isBefore, addDays, startOfWeek, endOfWeek } from 'date-fns';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  PieChart, 
  Pie, 
  Cell,
  AreaChart,
  Area
} from 'recharts';

interface ReportCategory {
  id: string;
  title: string;
  icon: any;
  color: string;
  options: ReportOption[];
}

interface ReportOption {
  id: string;
  title: string;
  description?: string;
}

export default function Queries() {
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfDay(new Date()), 'yyyy-MM-dd'));
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<ReportOption | null>(null);
  const [reportData, setReportData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const categories: ReportCategory[] = [
    {
      id: 'analytics',
      title: 'تحليلات متقدمة',
      icon: BarChartIcon,
      color: 'text-blue-600 bg-blue-50',
      options: [
        { id: 'profit_chart', title: 'مخطط الأرباح والمبيعات' },
        { id: 'top_profitable_chart', title: 'المنتجات الأكثر ربحية (مخطط)' },
        { id: 'weekly_comparison', title: 'مقارنة الأداء الأسبوعي' },
        { id: 'monthly_comparison', title: 'مقارنة الأداء الشهري' },
      ]
    },
    {
      id: 'store',
      title: 'المتجر',
      icon: HomeIcon,
      color: 'text-indigo-600 bg-indigo-50',
      options: [
        { id: 'store_movement', title: 'عرض حركة المتجر' },
        { id: 'top_products', title: 'المنتجات الأكثر مبيعاً' },
        { id: 'sales_by_payment', title: 'المبيعات حسب طريقة الدفع' },
        { id: 'expenses_summary', title: 'المصروفات' },
      ]
    },
    {
      id: 'sales',
      title: 'المبيعات',
      icon: ShoppingCart,
      color: 'text-emerald-600 bg-emerald-50',
      options: [
        { id: 'sales_period', title: 'تقرير بالمبيعات لفترة' },
        { id: 'sales_by_item', title: 'تقرير بالمبيعات حسب الصنف' },
        { id: 'sales_by_category', title: 'تقرير بالمبيعات حسب التصنيف' },
        { id: 'sales_cash', title: 'تقرير بالمبيعات النقد' },
        { id: 'sales_credit', title: 'تقرير بالمبيعات الأجل' },
        { id: 'sales_card', title: 'تقرير بالمبيعات (بطاقة)' },
        { id: 'sales_all', title: 'تقرير بالمبيعات (الكل)' },
        { id: 'sales_by_customer', title: 'تقرير بالمبيعات حسب العميل' },
      ]
    },
    {
      id: 'profits',
      title: 'الأرباح',
      icon: TrendingUp,
      color: 'text-emerald-600 bg-emerald-50',
      options: [
        { id: 'most_profitable_top5', title: 'أفضل 5 منتجات ربحاً' },
        { id: 'most_profitable', title: 'المنتجات الأكثر ربحاً' },
        { id: 'sales_daily_summary', title: 'ملخص الأرباح اليومي' },
      ]
    },
    {
      id: 'customers',
      title: 'العملاء',
      icon: Users,
      color: 'text-indigo-600 bg-indigo-50',
      options: [
        { id: 'customer_debts', title: 'ذمم العملاء' },
        { id: 'customer_statement', title: 'كشف حساب عميل' },
        { id: 'customer_invoices', title: 'تقرير بالفواتير لعميل' },
      ]
    },
    {
      id: 'purchases',
      title: 'المشتريات',
      icon: ShoppingBag,
      color: 'text-orange-600 bg-orange-50',
      options: [
        { id: 'purchase_reports', title: 'تقارير المشتريات' },
        { id: 'purchase_by_item', title: 'تقرير بالمشتريات حسب الصنف' },
      ]
    },
    {
      id: 'suppliers',
      title: 'الموردين',
      icon: Truck,
      color: 'text-purple-600 bg-purple-50',
      options: [
        { id: 'supplier_statement', title: 'كشف حساب مورد' },
      ]
    },
    {
      id: 'inventory',
      title: 'المخازن',
      icon: BoxIcon,
      color: 'text-amber-600 bg-amber-50',
      options: [
        { id: 'inventory_count', title: 'جرد مخزني' },
        { id: 'inventory_expiry', title: 'تقرير بالمنتجات حسب تاريخ الانتهاء' },
        { id: 'inventory_expiry_near', title: 'منتجات قريبة الانتهاء (30 يوم)' },
        { id: 'product_movement', title: 'تقرير بحركة منتج' },
      ]
    },
    {
      id: 'box',
      title: 'الصندوق',
      icon: Package,
      color: 'text-rose-600 bg-rose-50',
      options: [
        { id: 'box_movement', title: 'تقرير بحركة الصندوق' },
        { id: 'zakat', title: 'حساب الزكاة' },
        { id: 'tax_report', title: 'تقرير بالإقرار الضريبي' },
      ]
    },
    {
      id: 'expenses',
      title: 'المصروفات',
      icon: Wallet,
      color: 'text-slate-600 bg-slate-50',
      options: [
        { id: 'expenses_report', title: 'تقرير بالمصروفات' },
      ]
    }
  ];

  const handleRunReport = async (option: ReportOption) => {
    setSelectedReport(option);
    setLoading(true);
    setReportData([]);

    const start = Timestamp.fromDate(new Date(startDate));
    const end = Timestamp.fromDate(endOfDay(new Date(endDate)));

    try {
      switch (option.id) {
        case 'profit_chart':
          const pcSalesQ = query(
            collection(db, 'sales'),
            where('timestamp', '>=', start),
            where('timestamp', '<=', end),
            orderBy('timestamp', 'asc')
          );
          const pcSalesSnap = await getDocs(pcSalesQ);
          const pcMap: Record<string, any> = {};
          pcSalesSnap.docs.forEach(doc => {
            const sale = doc.data() as Sale;
            const dateKey = format(sale.timestamp.toDate(), 'MM/dd');
            if (!pcMap[dateKey]) pcMap[dateKey] = { name: dateKey, sales: 0, profit: 0 };
            pcMap[dateKey].sales += sale.total;
            pcMap[dateKey].profit += (sale.profit || 0);
          });
          setReportData(Object.values(pcMap));
          break;

        case 'top_profitable_chart':
          const tpcSalesQ = query(
            collection(db, 'sales'),
            where('timestamp', '>=', start),
            where('timestamp', '<=', end)
          );
          const tpcSalesSnap = await getDocs(tpcSalesQ);
          const tpcMap: Record<string, any> = {};
          tpcSalesSnap.docs.forEach(doc => {
            const sale = doc.data() as Sale;
            sale.items.forEach(item => {
              if (!tpcMap[item.productId]) tpcMap[item.productId] = { name: item.name, profit: 0 };
              tpcMap[item.productId].profit += (item.profit || 0);
            });
          });
          setReportData(Object.values(tpcMap).sort((a, b) => b.profit - a.profit).slice(0, 10));
          break;

        case 'weekly_comparison':
          const currentWeekStart = Timestamp.fromDate(startOfWeek(new Date()));
          const lastWeekStart = Timestamp.fromDate(startOfWeek(subDays(new Date(), 7)));
          const lastWeekEnd = Timestamp.fromDate(endOfWeek(subDays(new Date(), 7)));

          const [currWeekSnap, lastWeekSnap] = await Promise.all([
            getDocs(query(collection(db, 'sales'), where('timestamp', '>=', currentWeekStart))),
            getDocs(query(collection(db, 'sales'), where('timestamp', '>=', lastWeekStart), where('timestamp', '<=', lastWeekEnd)))
          ]);

          const currWeekTotal = currWeekSnap.docs.reduce((sum, d) => sum + d.data().total, 0);
          const lastWeekTotal = lastWeekSnap.docs.reduce((sum, d) => sum + d.data().total, 0);

          setReportData([
            { name: 'الأسبوع الماضي', value: lastWeekTotal, color: '#94a3b8' },
            { name: 'الأسبوع الحالي', value: currWeekTotal, color: '#4f46e5' }
          ]);
          break;

        case 'monthly_comparison':
          const currentMonthStart = Timestamp.fromDate(startOfMonth(new Date()));
          const lastMonthStart = Timestamp.fromDate(startOfMonth(subDays(new Date(), 30)));
          const lastMonthEnd = Timestamp.fromDate(endOfMonth(subDays(new Date(), 30)));

          const [currMonthSnap, lastMonthSnap] = await Promise.all([
            getDocs(query(collection(db, 'sales'), where('timestamp', '>=', currentMonthStart))),
            getDocs(query(collection(db, 'sales'), where('timestamp', '>=', lastMonthStart), where('timestamp', '<=', lastMonthEnd)))
          ]);

          const currMonthTotal = currMonthSnap.docs.reduce((sum, d) => sum + d.data().total, 0);
          const lastMonthTotal = lastMonthSnap.docs.reduce((sum, d) => sum + d.data().total, 0);

          setReportData([
            { name: 'الشهر الماضي', value: lastMonthTotal, color: '#94a3b8' },
            { name: 'الشهر الحالي', value: currMonthTotal, color: '#10b981' }
          ]);
          break;

        case 'store_movement':
          const smSalesQ = query(
            collection(db, 'sales'),
            where('timestamp', '>=', start),
            where('timestamp', '<=', end)
          );
          const smExpQ = query(
            collection(db, 'expenses'),
            where('date', '>=', startDate),
            where('date', '<=', endDate)
          );
          const [smSalesSnap, smExpSnap] = await Promise.all([getDocs(smSalesQ), getDocs(smExpQ)]);
          
          const totalSmSales = smSalesSnap.docs.reduce((sum, d) => sum + (d.data() as Sale).total, 0);
          const totalSmProfit = smSalesSnap.docs.reduce((sum, d) => sum + ((d.data() as Sale).profit || 0), 0);
          const totalSmExp = smExpSnap.docs.reduce((sum, d) => sum + (d.data() as Expense).amount, 0);
          
          setReportData([
            { label: 'إجمالي المبيعات', value: totalSmSales, color: 'text-indigo-600' },
            { label: 'إجمالي الربح', value: totalSmProfit, color: 'text-emerald-600' },
            { label: 'إجمالي المصروفات', value: totalSmExp, color: 'text-red-600' },
            { label: 'صافي الدخل', value: totalSmProfit - totalSmExp, color: 'text-indigo-600' },
          ]);
          break;

        case 'sales_period':
        case 'sales_all':
          const salesQ = query(
            collection(db, 'sales'),
            where('timestamp', '>=', start),
            where('timestamp', '<=', end),
            orderBy('timestamp', 'desc')
          );
          const salesSnap = await getDocs(salesQ);
          setReportData(salesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
          break;

        case 'sales_daily_summary':
          const dailySalesQ = query(
            collection(db, 'sales'),
            where('timestamp', '>=', start),
            where('timestamp', '<=', end),
            orderBy('timestamp', 'asc')
          );
          const dailySalesSnap = await getDocs(dailySalesQ);
          const dailyMap: Record<string, any> = {};
          
          dailySalesSnap.docs.forEach(doc => {
            const sale = doc.data() as Sale;
            const dateKey = format(sale.timestamp.toDate(), 'yyyy-MM-dd');
            
            if (!dailyMap[dateKey]) {
              dailyMap[dateKey] = {
                date: dateKey,
                totalSales: 0,
                totalProfit: 0,
                transactionCount: 0
              };
            }
            
            dailyMap[dateKey].totalSales += sale.total;
            dailyMap[dateKey].totalProfit += (sale.profit || 0);
            dailyMap[dateKey].transactionCount += 1;
          });
          
          setReportData(Object.values(dailyMap).sort((a, b) => b.date.localeCompare(a.date)));
          break;

        case 'sales_by_payment':
          const paySalesQ = query(
            collection(db, 'sales'),
            where('timestamp', '>=', start),
            where('timestamp', '<=', end)
          );
          const paySalesSnap = await getDocs(paySalesQ);
          const payMap: Record<string, any> = {
            cash: { label: 'نقداً', value: 0, count: 0, color: 'text-emerald-600' },
            credit: { label: 'أجل', value: 0, count: 0, color: 'text-red-600' },
            card: { label: 'بطاقة', value: 0, count: 0, color: 'text-indigo-600' }
          };
          
          let payTotal = 0;
          paySalesSnap.docs.forEach(doc => {
            const sale = doc.data() as Sale;
            const type = sale.paymentType || 'cash';
            if (payMap[type]) {
              payMap[type].value += sale.total;
              payMap[type].count += 1;
              payTotal += sale.total;
            }
          });
          
          setReportData(Object.values(payMap).map(item => ({
            ...item,
            percentage: payTotal > 0 ? (item.value / payTotal) * 100 : 0
          })));
          break;

        case 'top_products':
          const topSalesQ = query(
            collection(db, 'sales'),
            where('timestamp', '>=', start),
            where('timestamp', '<=', end)
          );
          const topSalesSnap = await getDocs(topSalesQ);
          const productMap: Record<string, any> = {};
          topSalesSnap.docs.forEach(doc => {
            const sale = doc.data() as Sale;
            sale.items.forEach(item => {
              if (!productMap[item.productId]) {
                productMap[item.productId] = { name: item.name, quantity: 0, revenue: 0 };
              }
              productMap[item.productId].quantity += item.quantity;
              productMap[item.productId].revenue += item.quantity * item.price;
            });
          });
          setReportData(Object.values(productMap).sort((a, b) => b.revenue - a.revenue));
          break;

        case 'sales_by_item':
          const sbiSalesQ = query(
            collection(db, 'sales'),
            where('timestamp', '>=', start),
            where('timestamp', '<=', end)
          );
          const sbiSalesSnap = await getDocs(sbiSalesQ);
          const sbiMap: Record<string, any> = {};
          sbiSalesSnap.docs.forEach(doc => {
            const sale = doc.data() as Sale;
            sale.items.forEach(item => {
              if (!sbiMap[item.productId]) sbiMap[item.productId] = { name: item.name, quantity: 0, total: 0 };
              sbiMap[item.productId].quantity += item.quantity;
              sbiMap[item.productId].total += (item.quantity * item.price);
            });
          });
          setReportData(Object.values(sbiMap).sort((a, b) => b.total - a.total));
          break;

        case 'sales_by_category':
          const sbcSalesQ = query(
            collection(db, 'sales'),
            where('timestamp', '>=', start),
            where('timestamp', '<=', end)
          );
          const sbcSalesSnap = await getDocs(sbcSalesQ);
          const sbcMap: Record<string, any> = {};
          const sbcProdSnap = await getDocs(collection(db, 'products'));
          const prodCatMap: Record<string, string> = {};
          sbcProdSnap.docs.forEach(d => prodCatMap[d.id] = d.data().category);

          sbcSalesSnap.docs.forEach(doc => {
            const sale = doc.data() as Sale;
            sale.items.forEach(item => {
              const cat = prodCatMap[item.productId] || 'غير مصنف';
              if (!sbcMap[cat]) sbcMap[cat] = { category: cat, quantity: 0, total: 0 };
              sbcMap[cat].quantity += item.quantity;
              sbcMap[cat].total += (item.quantity * item.price);
            });
          });
          setReportData(Object.values(sbcMap).sort((a, b) => b.total - a.total));
          break;

        case 'sales_cash':
        case 'sales_credit':
        case 'sales_card':
          const payType = option.id === 'sales_cash' ? 'cash' : option.id === 'sales_credit' ? 'credit' : 'card';
          const stSalesQ = query(
            collection(db, 'sales'),
            where('timestamp', '>=', start),
            where('timestamp', '<=', end),
            where('paymentType', '==', payType),
            orderBy('timestamp', 'desc')
          );
          const stSalesSnap = await getDocs(stSalesQ);
          setReportData(stSalesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
          break;

        case 'sales_by_customer':
          const sbcustSalesQ = query(
            collection(db, 'sales'),
            where('timestamp', '>=', start),
            where('timestamp', '<=', end)
          );
          const sbcustSalesSnap = await getDocs(sbcustSalesQ);
          const sbcustMap: Record<string, any> = {};
          sbcustSalesSnap.docs.forEach(doc => {
            const sale = doc.data() as Sale;
            const custId = sale.customerId || 'walk-in';
            const custName = sale.customerName || 'زبون عام';
            if (!sbcustMap[custId]) sbcustMap[custId] = { name: custName, count: 0, total: 0 };
            sbcustMap[custId].count += 1;
            sbcustMap[custId].total += sale.total;
          });
          setReportData(Object.values(sbcustMap).sort((a, b) => b.total - a.total));
          break;

        case 'customer_invoices':
          const ciSalesQ = query(
            collection(db, 'sales'),
            where('timestamp', '>=', start),
            where('timestamp', '<=', end),
            orderBy('timestamp', 'desc')
          );
          const ciSalesSnap = await getDocs(ciSalesQ);
          setReportData(ciSalesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
          break;

        case 'purchase_reports':
          const purQ = query(
            collection(db, 'purchases'),
            where('timestamp', '>=', start),
            where('timestamp', '<=', end),
            orderBy('timestamp', 'desc')
          );
          const purSnap = await getDocs(purQ);
          setReportData(purSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
          break;

        case 'purchase_by_item':
          const pbiPurQ = query(
            collection(db, 'purchases'),
            where('timestamp', '>=', start),
            where('timestamp', '<=', end)
          );
          const pbiPurSnap = await getDocs(pbiPurQ);
          const pbiMap: Record<string, any> = {};
          pbiPurSnap.docs.forEach(doc => {
            const pur = doc.data() as Purchase;
            pur.items.forEach(item => {
              if (!pbiMap[item.productId]) pbiMap[item.productId] = { name: item.name, quantity: 0, total: 0 };
              pbiMap[item.productId].quantity += item.quantity;
              pbiMap[item.productId].total += (item.quantity * item.price);
            });
          });
          setReportData(Object.values(pbiMap).sort((a, b) => b.total - a.total));
          break;

        case 'supplier_statement':
          const ssPurQ = query(
            collection(db, 'purchases'),
            where('timestamp', '>=', start),
            where('timestamp', '<=', end),
            orderBy('timestamp', 'desc')
          );
          const ssTransQ = query(
            collection(db, 'supplier_transactions'),
            where('timestamp', '>=', start),
            where('timestamp', '<=', end),
            orderBy('timestamp', 'desc')
          );
          const [ssPurSnap, ssTransSnap] = await Promise.all([getDocs(ssPurQ), getDocs(ssTransQ)]);
          const ssData = [
            ...ssPurSnap.docs.map(doc => ({ ...doc.data(), type: 'purchase' })),
            ...ssTransSnap.docs.map(doc => ({ ...doc.data(), type: 'transaction' }))
          ].sort((a: any, b: any) => b.timestamp.toDate().getTime() - a.timestamp.toDate().getTime());
          setReportData(ssData);
          break;

        case 'inventory_expiry':
          const ieProdSnap = await getDocs(collection(db, 'products'));
          const ieData = ieProdSnap.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as Product))
            .filter(p => p.expiryDate)
            .sort((a, b) => new Date(a.expiryDate!).getTime() - new Date(b.expiryDate!).getTime());
          setReportData(ieData);
          break;

        case 'box_movement':
          const bmTransQ = query(
            collection(db, 'box_transactions'),
            where('timestamp', '>=', start),
            where('timestamp', '<=', end),
            orderBy('timestamp', 'desc')
          );
          const bmTransSnap = await getDocs(bmTransQ);
          setReportData(bmTransSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
          break;

        case 'zakat':
          const zProdSnap = await getDocs(collection(db, 'products'));
          const zInventoryValue = zProdSnap.docs.reduce((sum, d) => sum + (d.data().stock * d.data().costPrice), 0);
          setReportData([{
            inventoryValue: zInventoryValue,
            zakatAmount: zInventoryValue * 0.025
          }]);
          break;

        case 'tax_report':
          const trSalesQ = query(
            collection(db, 'sales'),
            where('timestamp', '>=', start),
            where('timestamp', '<=', end)
          );
          const trSalesSnap = await getDocs(trSalesQ);
          let trTotalSales = 0;
          let trTotalTax = 0;
          trSalesSnap.docs.forEach(doc => {
            const sale = doc.data() as Sale;
            trTotalSales += sale.total;
            const saleTax = sale.items.reduce((sum, item) => sum + 0, 0);
            trTotalTax += saleTax;
          });
          setReportData([{
            totalSales: trTotalSales,
            totalTax: trTotalTax
          }]);
          break;

        case 'most_profitable_top5':
          const profSalesQ = query(
            collection(db, 'sales'),
            where('timestamp', '>=', start),
            where('timestamp', '<=', end)
          );
          const profSalesSnap = await getDocs(profSalesQ);
          const profMap: Record<string, any> = {};
          profSalesSnap.docs.forEach(doc => {
            const sale = doc.data() as Sale;
            sale.items.forEach(item => {
              if (!profMap[item.productId]) {
                profMap[item.productId] = { name: item.name, quantity: 0, profit: 0 };
              }
              profMap[item.productId].quantity += item.quantity;
              profMap[item.productId].profit += (item.profit || 0);
            });
          });
          setReportData(Object.values(profMap).sort((a, b) => b.profit - a.profit).slice(0, 5));
          break;

        case 'most_profitable':
          const allProfSalesQ = query(
            collection(db, 'sales'),
            where('timestamp', '>=', start),
            where('timestamp', '<=', end)
          );
          const allProfSalesSnap = await getDocs(allProfSalesQ);
          const allProfMap: Record<string, any> = {};
          allProfSalesSnap.docs.forEach(doc => {
            const sale = doc.data() as Sale;
            sale.items.forEach(item => {
              if (!allProfMap[item.productId]) {
                allProfMap[item.productId] = { name: item.name, quantity: 0, profit: 0 };
              }
              allProfMap[item.productId].quantity += item.quantity;
              allProfMap[item.productId].profit += (item.profit || 0);
            });
          });
          setReportData(Object.values(allProfMap).sort((a, b) => b.profit - a.profit));
          break;

        case 'expenses_report':
          const expQ = query(
            collection(db, 'expenses'),
            where('date', '>=', startDate),
            where('date', '<=', endDate),
            orderBy('date', 'desc')
          );
          const expSnap = await getDocs(expQ);
          setReportData(expSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
          break;

        case 'inventory_count':
          const prodSnap = await getDocs(collection(db, 'products'));
          setReportData(prodSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
          break;

        case 'inventory_expiry_near':
          const expirySnap = await getDocs(collection(db, 'products'));
          const today = new Date();
          const thirtyDaysFromNow = new Date();
          thirtyDaysFromNow.setDate(today.getDate() + 30);
          
          const nearExpiryProducts = expirySnap.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as Product))
            .filter(product => {
              if (!product.expiryDate) return false;
              const expiryDate = new Date(product.expiryDate);
              // Check if it's already expired or expiring within 30 days
              return isBefore(expiryDate, thirtyDaysFromNow);
            })
            .sort((a, b) => {
              if (!a.expiryDate || !b.expiryDate) return 0;
              return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
            });
            
          setReportData(nearExpiryProducts);
          break;

        case 'customer_debts':
          const custSnap = await getDocs(collection(db, 'customers'));
          const debtors = custSnap.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as Customer))
            .filter(c => c.balance > 0)
            .sort((a, b) => b.balance - a.balance);
          setReportData(debtors);
          break;

        case 'product_movement':
          const pmSalesQ = query(
            collection(db, 'sales'),
            where('timestamp', '>=', start),
            where('timestamp', '<=', end)
          );
          const pmPurchasesQ = query(
            collection(db, 'purchases'),
            where('timestamp', '>=', start),
            where('timestamp', '<=', end)
          );
          const [pmSalesSnap, pmPurchasesSnap] = await Promise.all([getDocs(pmSalesQ), getDocs(pmPurchasesQ)]);
          
          const movementMap: Record<string, any> = {};
          
          pmSalesSnap.docs.forEach(doc => {
            const sale = doc.data() as Sale;
            sale.items.forEach(item => {
              if (!movementMap[item.productId]) movementMap[item.productId] = { name: item.name, in: 0, out: 0, balance: 0 };
              movementMap[item.productId].out += item.quantity;
            });
          });
          
          pmPurchasesSnap.docs.forEach(doc => {
            const purchase = doc.data() as any;
            purchase.items.forEach((item: any) => {
              if (!movementMap[item.productId]) movementMap[item.productId] = { name: item.name, in: 0, out: 0, balance: 0 };
              movementMap[item.productId].in += item.quantity;
            });
          });
          
          setReportData(Object.values(movementMap).map(item => ({
            ...item,
            balance: item.in - item.out
          })));
          break;

        case 'customer_statement':
          const csSalesQ = query(
            collection(db, 'sales'),
            where('timestamp', '>=', start),
            where('timestamp', '<=', end),
            orderBy('timestamp', 'desc')
          );
          const csTransQ = query(
            collection(db, 'transactions'),
            where('timestamp', '>=', start),
            where('timestamp', '<=', end),
            orderBy('timestamp', 'desc')
          );
          const [csSalesSnap, csTransSnap] = await Promise.all([getDocs(csSalesQ), getDocs(csTransQ)]);
          
          const statementData = [
            ...csSalesSnap.docs.map(doc => ({ ...doc.data(), type: 'sale' })),
            ...csTransSnap.docs.map(doc => ({ ...doc.data(), type: 'transaction' }))
          ].sort((a: any, b: any) => b.timestamp.toDate().getTime() - a.timestamp.toDate().getTime());
          
          setReportData(statementData);
          break;

        default:
          // Placeholder for other reports
          setReportData([]);
          break;
      }
    } catch (error) {
      console.error("Error running report:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 overflow-hidden" dir="rtl">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 p-6 shadow-sm z-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="bg-indigo-600 p-3 rounded-2xl text-white shadow-lg shadow-indigo-200">
              <BarChart3 className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-3xl font-black text-slate-800">الاستعلامات</h2>
              <p className="text-slate-500 font-bold">تقارير مفصلة وإحصائيات شاملة</p>
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

      <div className="flex-1 overflow-hidden flex">
        {/* Categories List */}
        <div className="w-80 bg-white border-l border-slate-200 overflow-y-auto p-4 space-y-2">
          {categories.map((cat) => (
            <div key={cat.id} className="space-y-1">
              <button
                onClick={() => setActiveCategory(activeCategory === cat.id ? null : cat.id)}
                className={cn(
                  "w-full flex items-center justify-between p-4 rounded-2xl transition-all group",
                  activeCategory === cat.id ? "bg-slate-900 text-white shadow-xl" : "hover:bg-slate-50 text-slate-700"
                )}
              >
                <div className="flex items-center gap-4">
                  <div className={cn("p-2 rounded-xl transition-colors", activeCategory === cat.id ? "bg-white/10" : cat.color)}>
                    <cat.icon className="w-5 h-5" />
                  </div>
                  <span className="font-black text-sm">{cat.title}</span>
                </div>
                <ChevronDown className={cn("w-4 h-4 transition-transform", activeCategory === cat.id ? "rotate-180" : "")} />
              </button>

              <AnimatePresence>
                {activeCategory === cat.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden pr-4 space-y-1"
                  >
                    {cat.options.map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => handleRunReport(opt)}
                        className={cn(
                          "w-full text-right p-3 rounded-xl text-xs font-bold transition-all flex items-center justify-between group",
                          selectedReport?.id === opt.id ? "bg-blue-50 text-blue-600" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                        )}
                      >
                        <span>{opt.title}</span>
                        <ChevronLeft className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>

        {/* Report Viewer */}
        <div className="flex-1 bg-slate-100 p-8 overflow-y-auto">
          {!selectedReport ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-6">
              <div className="w-32 h-32 bg-white rounded-[40px] flex items-center justify-center shadow-sm border border-slate-200">
                <FileText className="w-16 h-16 opacity-20" />
              </div>
              <div className="text-center">
                <h3 className="text-xl font-black text-slate-800 mb-2">اختر تقريراً لعرضه</h3>
                <p className="font-bold">حدد الفئة والتقرير من القائمة الجانبية للبدء</p>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <button 
                      onClick={() => setSelectedReport(null)}
                      className="p-2 hover:bg-white rounded-xl text-slate-400 transition-colors"
                    >
                      <ArrowRight className="w-5 h-5" />
                    </button>
                    <h3 className="text-2xl font-black text-slate-800">{selectedReport.title}</h3>
                  </div>
                  <p className="text-slate-500 font-bold text-sm">
                    للفترة من {startDate} إلى {endDate}
                  </p>
                </div>
                <div className="flex gap-3">
                  <button className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 rounded-2xl font-black text-sm text-slate-700 hover:bg-slate-50 transition-all shadow-sm">
                    <Printer className="w-4 h-4" />
                    طباعة
                  </button>
                  <button className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-sm hover:bg-blue-700 transition-all shadow-lg shadow-blue-200">
                    <Download className="w-4 h-4" />
                    تصدير Excel
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="h-96 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-slate-500 font-black">جاري جلب البيانات...</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Visual Charts for Analytics */}
                  {selectedReport.id.includes('chart') || selectedReport.id.includes('comparison') ? (
                    <div className="grid grid-cols-1 gap-6">
                      <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-200 h-[500px]">
                        <h4 className="text-xl font-black text-slate-800 mb-8 text-right">{selectedReport.title}</h4>
                        <ResponsiveContainer width="100%" height="100%">
                          {selectedReport.id === 'profit_chart' ? (
                            <AreaChart data={reportData}>
                              <defs>
                                <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                                  <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                                </linearGradient>
                                <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                              <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                              <Tooltip 
                                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                itemStyle={{ fontWeight: 'bold' }}
                              />
                              <Legend verticalAlign="top" align="right" height={36} iconType="circle" />
                              <Area type="monotone" dataKey="sales" name="المبيعات" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
                              <Area type="monotone" dataKey="profit" name="الأرباح" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorProfit)" />
                            </AreaChart>
                          ) : selectedReport.id === 'top_profitable_chart' ? (
                            <BarChart data={reportData} layout="vertical">
                              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                              <XAxis type="number" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                              <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fill: '#475569', fontSize: 12, fontWeight: 'bold'}} width={150} />
                              <Tooltip 
                                cursor={{fill: '#f8fafc'}}
                                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                              />
                              <Bar dataKey="profit" name="إجمالي الربح" fill="#10b981" radius={[0, 8, 8, 0]} barSize={30} />
                            </BarChart>
                          ) : (
                            <BarChart data={reportData}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#475569', fontSize: 12, fontWeight: 'bold'}} />
                              <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                              <Tooltip 
                                cursor={{fill: '#f8fafc'}}
                                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                              />
                              <Bar dataKey="value" name="الإجمالي" radius={[8, 8, 0, 0]} barSize={60}>
                                {reportData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Bar>
                            </BarChart>
                          )}
                        </ResponsiveContainer>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white rounded-[40px] shadow-sm border border-slate-200 overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-right">
                          <thead className="bg-slate-50 border-b border-slate-100">
                            <tr>
                              {renderTableHeaders(selectedReport.id)}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {reportData.map((item, idx) => (
                              <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                {renderTableRow(selectedReport.id, item)}
                              </tr>
                            ))}
                            {reportData.length === 0 && (
                              <tr>
                                <td colSpan={10} className="p-20 text-center text-slate-300 italic font-bold">
                                  لا توجد بيانات متاحة لهذا التقرير في الفترة المحددة
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function renderTableHeaders(reportId: string) {
  switch (reportId) {
    case 'sales_by_item':
    case 'purchase_by_item':
      return (
        <>
          <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest">الصنف</th>
          <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-center">الكمية</th>
          <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-left">الإجمالي</th>
        </>
      );
    case 'sales_by_category':
      return (
        <>
          <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest">التصنيف</th>
          <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-center">الكمية</th>
          <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-left">الإجمالي</th>
        </>
      );
    case 'sales_cash':
    case 'sales_credit':
    case 'sales_card':
    case 'customer_invoices':
      return (
        <>
          <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest">رقم الفاتورة</th>
          <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-center">التاريخ</th>
          <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest">الزبون</th>
          <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-left">الإجمالي</th>
        </>
      );
    case 'sales_by_customer':
      return (
        <>
          <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest">الزبون</th>
          <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-center">عدد الفواتير</th>
          <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-left">إجمالي المبيعات</th>
        </>
      );
    case 'purchase_reports':
      return (
        <>
          <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest">رقم الفاتورة</th>
          <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-center">التاريخ</th>
          <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest">المورد</th>
          <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-left">الإجمالي</th>
        </>
      );
    case 'customer_statement':
    case 'supplier_statement':
      return (
        <>
          <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-center">التاريخ</th>
          <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest">النوع</th>
          <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest">البيان</th>
          <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-left">المبلغ</th>
        </>
      );
    case 'inventory_expiry':
      return (
        <>
          <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest">المنتج</th>
          <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-center">تاريخ الانتهاء</th>
          <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-center">المخزون</th>
          <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-left">الحالة</th>
        </>
      );
    case 'product_movement':
      return (
        <>
          <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest">المنتج</th>
          <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-center">وارد</th>
          <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-center">صادر</th>
          <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-left">الرصيد</th>
        </>
      );
    case 'box_movement':
      return (
        <>
          <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-center">التاريخ</th>
          <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest">النوع</th>
          <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest">الوصف</th>
          <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-left">المبلغ</th>
        </>
      );
    case 'zakat':
      return (
        <>
          <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest">قيمة المخزون</th>
          <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-left">مقدار الزكاة (2.5%)</th>
        </>
      );
    case 'tax_report':
      return (
        <>
          <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest">إجمالي المبيعات</th>
          <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-left">إجمالي الضريبة</th>
        </>
      );
    case 'store_movement':
      return (
        <>
          <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest">البيان</th>
          <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-left">المبلغ</th>
        </>
      );
    case 'sales_period':
    case 'sales_all':
      return (
        <>
          <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest">رقم الفاتورة</th>
          <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-center">التاريخ</th>
          <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest">الزبون</th>
          <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest">الهاتف</th>
          <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-center">طريقة الدفع</th>
          <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-left">الإجمالي</th>
        </>
      );
    case 'sales_daily_summary':
      return (
        <>
          <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest">التاريخ</th>
          <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-center">عدد العمليات</th>
          <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-center">إجمالي المبيعات</th>
          <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-left">إجمالي الربح</th>
        </>
      );
    case 'sales_by_payment':
      return (
        <>
          <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest">طريقة الدفع</th>
          <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-center">عدد العمليات</th>
          <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-center">النسبة</th>
          <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-left">إجمالي المبيعات</th>
        </>
      );
    case 'top_products':
      return (
        <>
          <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest">المنتج</th>
          <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-center">الكمية المباعة</th>
          <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-left">إجمالي المبيعات</th>
        </>
      );
    case 'most_profitable_top5':
    case 'most_profitable':
      return (
        <>
          <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest">المنتج</th>
          <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-center">الكمية المباعة</th>
          <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-left">إجمالي الربح</th>
        </>
      );
    case 'expenses_report':
      return (
        <>
          <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest">التاريخ</th>
          <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest">الوصف</th>
          <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-center">الفئة</th>
          <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-left">المبلغ</th>
        </>
      );
    case 'inventory_count':
      return (
        <>
          <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest">المنتج</th>
          <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-center">التصنيف</th>
          <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-center">المخزون الحالي</th>
          <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-center">حد الطلب</th>
          <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-left">قيمة المخزون</th>
        </>
      );
    case 'inventory_expiry_near':
      return (
        <>
          <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest">المنتج</th>
          <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-center">تاريخ الانتهاء</th>
          <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-center">المخزون الحالي</th>
          <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-center">حد الطلب</th>
          <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-left">الحالة</th>
        </>
      );
    case 'customer_debts':
      return (
        <>
          <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest">اسم الزبون</th>
          <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-center">رقم الهاتف</th>
          <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-center">سقف الكريدي</th>
          <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-left">الرصيد المتبقي</th>
        </>
      );
    default:
      return <th className="p-6">بيانات</th>;
  }
}

function renderTableRow(reportId: string, item: any) {
  switch (reportId) {
    case 'sales_by_item':
    case 'purchase_by_item':
      return (
        <>
          <td className="p-6 font-black text-slate-800">{item.name}</td>
          <td className="p-6 text-center font-bold text-slate-600">{item.quantity}</td>
          <td className="p-6 text-left font-black text-indigo-600">{(item.total || 0).toFixed(2)}</td>
        </>
      );
    case 'sales_by_category':
      return (
        <>
          <td className="p-6 font-black text-slate-800">{item.category}</td>
          <td className="p-6 text-center font-bold text-slate-600">{item.quantity}</td>
          <td className="p-6 text-left font-black text-indigo-600">{(item.total || 0).toFixed(2)}</td>
        </>
      );
    case 'sales_cash':
    case 'sales_credit':
    case 'sales_card':
    case 'customer_invoices':
      return (
        <>
          <td className="p-6 font-black text-indigo-600">#{item.invoiceNumber}</td>
          <td className="p-6 text-center font-bold text-slate-600">
            {item.timestamp ? format(item.timestamp.toDate(), 'yyyy-MM-dd HH:mm') : '...'}
          </td>
          <td className="p-6 font-bold text-slate-800">{item.customerName || 'زبون عام'}</td>
          <td className="p-6 text-left font-black text-slate-800">{(item.total || 0).toFixed(2)}</td>
        </>
      );
    case 'sales_by_customer':
      return (
        <>
          <td className="p-6 font-black text-slate-800">{item.name}</td>
          <td className="p-6 text-center font-bold text-slate-600">{item.count}</td>
          <td className="p-6 text-left font-black text-indigo-600">{(item.total || 0).toFixed(2)}</td>
        </>
      );
    case 'purchase_reports':
      return (
        <>
          <td className="p-6 font-black text-indigo-600">#{item.invoiceNumber}</td>
          <td className="p-6 text-center font-bold text-slate-600">
            {item.timestamp ? format(item.timestamp.toDate(), 'yyyy-MM-dd HH:mm') : '...'}
          </td>
          <td className="p-6 font-bold text-slate-800">{item.supplierName}</td>
          <td className="p-6 text-left font-black text-slate-800">{(item.total || 0).toFixed(2)}</td>
        </>
      );
    case 'customer_statement':
    case 'supplier_statement':
      return (
        <>
          <td className="p-6 text-center font-bold text-slate-600">
            {item.timestamp ? format(item.timestamp.toDate(), 'yyyy-MM-dd HH:mm') : '...'}
          </td>
          <td className="p-6">
            <span className={cn(
              "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider",
              item.type === 'sale' || item.type === 'purchase' ? "bg-blue-50 text-blue-600" : "bg-emerald-50 text-emerald-600"
            )}>
              {item.type === 'sale' ? 'فاتورة مبيعات' : item.type === 'purchase' ? 'فاتورة مشتريات' : 'دفعة مالية'}
            </span>
          </td>
          <td className="p-6 font-bold text-slate-600">{item.note || (item.type === 'sale' || item.type === 'purchase' ? `فاتورة رقم ${item.invoiceNumber}` : 'دفعة')}</td>
          <td className={cn(
            "p-6 text-left font-black",
            item.type === 'sale' || item.type === 'purchase' ? "text-red-600" : "text-emerald-600"
          )}>
            {(item.total || item.amount || 0).toFixed(2)}
          </td>
        </>
      );
    case 'inventory_expiry':
      const isExpiredIE = item.expiryDate && isBefore(new Date(item.expiryDate), new Date());
      return (
        <>
          <td className="p-6 font-black text-slate-800">{item.name}</td>
          <td className="p-6 text-center font-bold text-slate-600">{item.expiryDate}</td>
          <td className="p-6 text-center font-bold text-slate-800">{item.stock} {item.unit}</td>
          <td className="p-6 text-left">
            <span className={cn(
              "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider",
              isExpiredIE ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"
            )}>
              {isExpiredIE ? 'منتهي الصلاحية' : 'صالح'}
            </span>
          </td>
        </>
      );
    case 'product_movement':
      return (
        <>
          <td className="p-6 font-black text-slate-800">{item.name}</td>
          <td className="p-6 text-center font-bold text-emerald-600">{(item.in || 0).toFixed(2)}</td>
          <td className="p-6 text-center font-bold text-red-600">{(item.out || 0).toFixed(2)}</td>
          <td className="p-6 text-left font-black text-indigo-600">{(item.balance || 0).toFixed(2)}</td>
        </>
      );
    case 'box_movement':
      return (
        <>
          <td className="p-6 text-center font-bold text-slate-600">
            {item.timestamp ? format(item.timestamp.toDate(), 'yyyy-MM-dd HH:mm') : '...'}
          </td>
          <td className="p-6">
            <span className={cn(
              "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider",
              item.type === 'in' ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
            )}>
              {item.type === 'in' ? 'دخل' : 'خرج'}
            </span>
          </td>
          <td className="p-6 font-bold text-slate-600">{item.description}</td>
          <td className={cn(
            "p-6 text-left font-black",
            item.type === 'in' ? "text-emerald-600" : "text-red-600"
          )}>
            {(item.amount || 0).toFixed(2)}
          </td>
        </>
      );
    case 'zakat':
      return (
        <>
          <td className="p-6 font-black text-slate-800">{(item.inventoryValue || 0).toFixed(2)}</td>
          <td className="p-6 text-left font-black text-emerald-600">{(item.zakatAmount || 0).toFixed(2)}</td>
        </>
      );
    case 'tax_report':
      return (
        <>
          <td className="p-6 font-black text-slate-800">{(item.totalSales || 0).toFixed(2)}</td>
          <td className="p-6 text-left font-black text-red-600">{(item.totalTax || 0).toFixed(2)}</td>
        </>
      );
    case 'store_movement':
      return (
        <>
          <td className="p-6 font-black text-slate-800">{item.label}</td>
          <td className={cn("p-6 text-left font-black", item.color)}>{(item.value || 0).toFixed(2)}</td>
        </>
      );
    case 'sales_period':
    case 'sales_all':
      return (
        <>
          <td className="p-6 font-black text-indigo-600">#{item.invoiceNumber}</td>
          <td className="p-6 text-center font-bold text-slate-600">
            {item.timestamp ? format(item.timestamp.toDate(), 'yyyy-MM-dd HH:mm') : '...'}
          </td>
          <td className="p-6 font-bold text-slate-800">{item.customerName || 'زبون عام'}</td>
          <td className="p-6 font-bold text-slate-500">{item.customerPhone || '---'}</td>
          <td className="p-6 text-center">
            <span className={cn(
              "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider",
              item.paymentType === 'cash' ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
            )}>
              {item.paymentType === 'cash' ? 'نقداً' : 'أجل'}
            </span>
          </td>
          <td className="p-6 text-left font-black text-slate-800">{(item.total || 0).toFixed(2)}</td>
        </>
      );
    case 'sales_daily_summary':
      return (
        <>
          <td className="p-6 font-black text-slate-800">{item.date}</td>
          <td className="p-6 text-center font-bold text-slate-600">{item.transactionCount}</td>
          <td className="p-6 text-center font-black text-indigo-600">{(item.totalSales || 0).toFixed(2)}</td>
          <td className="p-6 text-left font-black text-emerald-600">{(item.totalProfit || 0).toFixed(2)}</td>
        </>
      );
    case 'sales_by_payment':
      return (
        <>
          <td className="p-6 font-black text-slate-800">{item.label}</td>
          <td className="p-6 text-center font-bold text-slate-600">{item.count}</td>
          <td className="p-6 text-center font-black text-slate-400">{(item.percentage || 0).toFixed(1)}%</td>
          <td className={cn("p-6 text-left font-black", item.color)}>{(item.value || 0).toFixed(2)}</td>
        </>
      );
    case 'top_products':
      return (
        <>
          <td className="p-6 font-black text-slate-800">{item.name}</td>
          <td className="p-6 text-center font-bold text-slate-600">{(item.quantity || 0).toFixed(2)}</td>
          <td className="p-6 text-left font-black text-blue-600">{(item.revenue || 0).toFixed(2)}</td>
        </>
      );
    case 'most_profitable_top5':
    case 'most_profitable':
      return (
        <>
          <td className="p-6 font-black text-slate-800">{item.name}</td>
          <td className="p-6 text-center font-bold text-slate-600">{(item.quantity || 0).toFixed(2)}</td>
          <td className="p-6 text-left font-black text-emerald-600">{(item.profit || 0).toFixed(2)}</td>
        </>
      );
    case 'expenses_report':
      return (
        <>
          <td className="p-6 font-bold text-slate-600">{item.date}</td>
          <td className="p-6 font-bold text-slate-800">{item.description}</td>
          <td className="p-6 text-center">
            <span className="px-3 py-1 bg-slate-100 rounded-lg text-[10px] font-black text-slate-600">
              {item.category}
            </span>
          </td>
          <td className="p-6 text-left font-black text-red-600">{(item.amount || 0).toFixed(2)}</td>
        </>
      );
    case 'inventory_count':
      const isLowStockCount = item.stock <= item.minStock;
      return (
        <>
          <td className="p-6 font-black text-slate-800">{item.name}</td>
          <td className="p-6 text-center font-bold text-slate-500">{item.category}</td>
          <td className="p-6 text-center">
            <span className={cn(
              "font-black px-3 py-1 rounded-lg",
              isLowStockCount ? "bg-red-50 text-red-600" : "text-slate-800"
            )}>
              {item.stock} {item.unit}
            </span>
          </td>
          <td className="p-6 text-center font-bold text-slate-400">{item.minStock} {item.unit}</td>
          <td className="p-6 text-left font-black text-indigo-600">{((item.stock || 0) * (item.costPrice || 0)).toFixed(2)}</td>
        </>
      );
    case 'inventory_expiry_near':
      const isExpired = item.expiryDate && isBefore(new Date(item.expiryDate), new Date());
      const isLowStockNear = item.stock <= item.minStock;
      return (
        <>
          <td className="p-6 font-black text-slate-800">{item.name}</td>
          <td className="p-6 text-center font-bold text-slate-600">{item.expiryDate}</td>
          <td className="p-6 text-center">
            <span className={cn(
              "font-black px-3 py-1 rounded-lg",
              isLowStockNear ? "bg-red-50 text-red-600" : "text-slate-800"
            )}>
              {item.stock} {item.unit}
            </span>
          </td>
          <td className="p-6 text-center font-bold text-slate-400">{item.minStock} {item.unit}</td>
          <td className="p-6 text-left">
            <span className={cn(
              "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider",
              isExpired ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"
            )}>
              {isExpired ? 'منتهي الصلاحية' : 'قريب الانتهاء'}
            </span>
          </td>
        </>
      );
    case 'customer_debts':
      return (
        <>
          <td className="p-6 font-black text-slate-800">{item.name}</td>
          <td className="p-6 text-center font-bold text-slate-600">{item.phone}</td>
          <td className="p-6 text-center font-bold text-slate-400">{(item.creditLimit || 0).toFixed(2)}</td>
          <td className="p-6 text-left font-black text-red-600">{(item.balance || 0).toFixed(2)}</td>
        </>
      );
    default:
      return <td className="p-6">...</td>;
  }
}
