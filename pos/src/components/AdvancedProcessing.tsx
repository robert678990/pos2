import React, { useState } from 'react';
import { 
  FileEdit, 
  FileX, 
  Undo2, 
  ArrowLeftRight, 
  Trash2, 
  Search, 
  Settings2, 
  Percent,
  ChevronLeft,
  AlertTriangle,
  Receipt,
  History
} from 'lucide-react';
import { cn } from '../lib/utils';
import PriceCheck from './PriceCheck';
import DamagedProducts from './DamagedProducts';
import SalesReturns from './SalesReturns';
import CancelInvoice from './CancelInvoice';
import Transfer from './Transfer';
import CancelVoucher from './CancelVoucher';
import CancelCash from './CancelCash';
import CancelReturn from './CancelReturn';
import EditSale from './EditSale';
import EditPurchase from './EditPurchase';
import PurchaseReturns from './PurchaseReturns';
import AdvancedHistory from './AdvancedHistory';

type AdvancedTab = 'menu' | 'price_check' | 'damaged_products' | 'sales_returns' | 'cancel_invoice' | 'transfer' | 'cancel_voucher' | 'cancel_cash' | 'cancel_return' | 'edit_sale' | 'edit_purchase' | 'purchase_returns' | 'history';

export default function AdvancedProcessing() {
  const [activeSubTab, setActiveSubTab] = useState<AdvancedTab>('menu');

  const menuItems = [
    { id: 'edit_sale', label: 'تعديل فاتورة مبيعات', icon: FileEdit, color: 'text-blue-500', bg: 'bg-blue-50' },
    { id: 'edit_purchase', label: 'تعديل فاتورة مشتريات', icon: FileEdit, color: 'text-indigo-500', bg: 'bg-indigo-50' },
    { id: 'cancel_invoice', label: 'إلغاء فاتورة مبيعات/مشتريات', icon: FileX, color: 'text-red-500', bg: 'bg-red-50' },
    { id: 'cancel_cash', label: 'إلغاء مبلغ - صندوق/مصروفات', icon: Trash2, color: 'text-rose-500', bg: 'bg-rose-50' },
    { id: 'cancel_voucher', label: 'إلغاء سند - قبض/صرف', icon: Receipt, color: 'text-amber-500', bg: 'bg-amber-50' },
    { id: 'sales_returns', label: 'إرجاع فاتورة مبيعات', icon: Undo2, color: 'text-emerald-500', bg: 'bg-emerald-50' },
    { id: 'purchase_returns', label: 'إرجاع فاتورة مشتريات', icon: Undo2, color: 'text-cyan-500', bg: 'bg-cyan-50' },
    { id: 'cancel_return', label: 'إلغاء فاتورة مرتجع مبيعات', icon: FileX, color: 'text-orange-500', bg: 'bg-orange-50' },
    { id: 'transfer', label: 'التحويل بين العملاء والموردين', icon: ArrowLeftRight, color: 'text-purple-500', bg: 'bg-purple-50' },
    { id: 'damaged_products', label: 'معالجة المنتجات التالفة', icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-100' },
    { id: 'price_check', label: 'شاشة عرض الأسعار', icon: Search, color: 'text-slate-600', bg: 'bg-slate-100' },
    { id: 'history', label: 'سجل العمليات المتقدمة', icon: History, color: 'text-slate-700', bg: 'bg-slate-200' },
  ];

  if (activeSubTab === 'price_check') {
    return <PriceCheck onBack={() => setActiveSubTab('menu')} />;
  }

  if (activeSubTab === 'damaged_products') {
    return <DamagedProducts onBack={() => setActiveSubTab('menu')} />;
  }

  if (activeSubTab === 'sales_returns') {
    return <SalesReturns onBack={() => setActiveSubTab('menu')} />;
  }

  if (activeSubTab === 'cancel_invoice') {
    return <CancelInvoice onBack={() => setActiveSubTab('menu')} />;
  }

  if (activeSubTab === 'transfer') {
    return <Transfer onBack={() => setActiveSubTab('menu')} />;
  }

  if (activeSubTab === 'cancel_voucher') {
    return <CancelVoucher onBack={() => setActiveSubTab('menu')} />;
  }

  if (activeSubTab === 'cancel_cash') {
    return <CancelCash onBack={() => setActiveSubTab('menu')} />;
  }

  if (activeSubTab === 'cancel_return') {
    return <CancelReturn onBack={() => setActiveSubTab('menu')} />;
  }

  if (activeSubTab === 'edit_sale') {
    return <EditSale onBack={() => setActiveSubTab('menu')} />;
  }

  if (activeSubTab === 'edit_purchase') {
    return <EditPurchase onBack={() => setActiveSubTab('menu')} />;
  }

  if (activeSubTab === 'purchase_returns') {
    return <PurchaseReturns onBack={() => setActiveSubTab('menu')} />;
  }

  if (activeSubTab === 'history') {
    return <AdvancedHistory onBack={() => setActiveSubTab('menu')} />;
  }

  return (
    <div className="h-full flex flex-col bg-slate-50 overflow-hidden" dir="rtl">
      {/* Header */}
      <div className="bg-white px-8 py-6 border-b border-slate-200 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-600 p-3 rounded-2xl shadow-lg shadow-indigo-500/20">
            <Settings2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">المعالجات المتقدمة</h1>
            <p className="text-slate-500 font-bold text-sm">إدارة العمليات المعقدة والتعديلات</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                if (['price_check', 'damaged_products', 'sales_returns', 'cancel_invoice', 'transfer', 'cancel_voucher', 'cancel_cash', 'cancel_return', 'edit_sale', 'edit_purchase', 'purchase_returns', 'history'].includes(item.id)) {
                  setActiveSubTab(item.id as AdvancedTab);
                }
              }}
              className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-200 hover:shadow-xl hover:scale-[1.02] transition-all flex items-center gap-6 group text-right"
            >
              <div className={cn("p-4 rounded-2xl shadow-inner", item.bg)}>
                <item.icon className={cn("w-7 h-7", item.color)} />
              </div>
              <div className="flex-1">
                <span className="text-lg font-black text-slate-700 group-hover:text-indigo-600 block transition-colors">
                  {item.label}
                </span>
                <span className="text-xs text-slate-400 font-bold">انقر للبدء</span>
              </div>
              <ChevronLeft className="w-5 h-5 text-slate-300 group-hover:text-indigo-400 transition-colors" />
            </button>
          ))}
        </div>

        {/* Info Section */}
        <div className="max-w-5xl mx-auto mt-12 bg-indigo-900 rounded-[40px] p-10 text-white relative overflow-hidden shadow-2xl shadow-indigo-900/20">
          <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
            <div className="bg-white/10 p-6 rounded-[32px] backdrop-blur-xl border border-white/20">
              <History className="w-12 h-12 text-indigo-300" />
            </div>
            <div className="text-center md:text-right">
              <h2 className="text-3xl font-black mb-3">سجل العمليات المتقدمة</h2>
              <p className="text-indigo-200 font-bold text-lg max-w-xl">
                يتم تسجيل جميع العمليات المتقدمة (الإلغاء، التعديل، الإرجاع) في سجل النظام لضمان الشفافية والأمان.
              </p>
            </div>
          </div>
          {/* Decorative elements */}
          <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-indigo-500 rounded-full blur-[100px] opacity-20"></div>
          <div className="absolute bottom-[-20%] left-[-10%] w-64 h-64 bg-indigo-500 rounded-full blur-[100px] opacity-20"></div>
        </div>
      </div>
    </div>
  );
}
