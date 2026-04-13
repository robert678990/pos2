import React from 'react';
import { Sale, SaleItem } from '../types';
import { format } from 'date-fns';
import { cn } from '../lib/utils';

interface ReceiptProps {
  sale: Partial<Sale> & { items: SaleItem[] };
  businessName?: string;
  businessAddress?: string;
  businessPhone?: string;
  thankYouMessage?: string;
  footerNote?: string;
  logoUrl?: string;
}

export default function Receipt({ 
  sale, 
  businessName = "متجر العطور والتوابل", 
  businessAddress = "شارع محمد الخامس، الدار البيضاء",
  businessPhone = "0612345678",
  thankYouMessage = "شكراً لكم على زيارتكم!",
  footerNote = "يرجى زيارتنا مرة أخرى",
  logoUrl,
  width = '80mm'
}: ReceiptProps & { width?: '80mm' | '58mm' }) {
  const subtotal = sale.items.reduce((sum, item) => {
    const discountVal = item.discountType === 'amount' 
      ? (item.discount || 0) 
      : (item.price * (item.discount || 0) / 100);
    return sum + ((item.price - discountVal) * item.quantity);
  }, 0);

  const total = sale.total || subtotal;

  return (
    <div 
      className={cn(
        "receipt-container p-2 bg-white text-black font-mono text-[12px] mx-auto leading-tight print:p-0",
        width === '80mm' ? "w-[80mm]" : "w-[58mm]"
      )} 
      dir="rtl"
    >
      {/* Header */}
      <div className="text-center mb-4 border-b-2 border-black pb-2">
        {logoUrl && (
          <div className="flex justify-center mb-2">
            <img src={logoUrl} alt="Logo" className="w-16 h-16 object-contain grayscale" referrerPolicy="no-referrer" />
          </div>
        )}
        <h2 className="text-xl font-black uppercase mb-1">{businessName}</h2>
        <div className="space-y-0.5 text-[10px] font-bold">
          <p>{businessAddress}</p>
          <p className="text-[11px] font-black">الهاتف: {businessPhone}</p>
        </div>
      </div>

      {/* Sale Info */}
      <div className="space-y-1 mb-4 text-[11px] border-b border-dashed border-black pb-2">
        <div className="flex justify-between">
          <span>رقم الفاتورة:</span>
          <span className="font-black">#{sale.invoiceNumber}</span>
        </div>
        <div className="flex justify-between">
          <span>التاريخ:</span>
          <span className="font-black">
            {sale.timestamp ? format(sale.timestamp.toDate ? sale.timestamp.toDate() : new Date(), 'yyyy-MM-dd HH:mm') : format(new Date(), 'yyyy-MM-dd HH:mm')}
          </span>
        </div>
        <div className="flex justify-between">
          <span>الزبون:</span>
          <span className="font-black">{sale.customerName || 'زبون نقدي'}</span>
        </div>
        {sale.customerPhone && (
          <div className="flex justify-between">
            <span>الهاتف:</span>
            <span className="font-black">{sale.customerPhone}</span>
          </div>
        )}
      </div>

      {/* Items Table */}
      <div className="mb-4">
        <div className="grid grid-cols-12 border-b border-black pb-1 mb-1 font-black text-[10px] uppercase">
          <div className="col-span-6 text-right">المنتج</div>
          <div className="col-span-2 text-center">كم</div>
          <div className="col-span-4 text-left">المجموع</div>
        </div>
        <div className="space-y-1.5">
          {sale.items.map((item, index) => (
            <div key={index} className="grid grid-cols-12 text-[11px] items-start border-b border-slate-50 pb-1 last:border-0">
              <div className="col-span-6">
                <div className="font-black leading-tight">{item.name}</div>
                <div className="text-[9px] opacity-70">{item.price.toFixed(2)} DH</div>
              </div>
              <div className="col-span-2 text-center font-black">{item.quantity}</div>
              <div className="col-span-4 text-left font-black">
                {((item.price || 0) * (item.quantity || 0)).toFixed(2)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Totals */}
      <div className="border-t border-black pt-2 space-y-1">
        <div className="flex justify-between text-[11px] font-bold">
          <span>المجموع:</span>
          <span>{(subtotal || 0).toFixed(2)} DH</span>
        </div>
        {sale.discountValue && sale.discountValue > 0 && (
          <div className="flex justify-between text-[11px] font-bold">
            <span>الخصم:</span>
            <span>-{(sale.discountValue || 0).toFixed(2)} DH</span>
          </div>
        )}
        <div className="flex justify-between font-black text-lg border-t border-black mt-1 pt-1">
          <span>الإجمالي:</span>
          <span>{(total || 0).toFixed(2)} DH</span>
        </div>
        
        {/* Payment Info */}
        <div className="mt-4 space-y-1 border-t border-dashed border-black pt-2">
          <div className="flex justify-between text-[11px]">
            <span>طريقة الدفع:</span>
            <span className="font-black">{sale.paymentType === 'cash' ? 'نقدا' : (sale.paymentType === 'credit' ? 'كريدي' : 'بطاقة')}</span>
          </div>
          {sale.paymentType === 'cash' && (
            <>
              <div className="flex justify-between text-[11px]">
                <span>المدفوع:</span>
                <span className="font-black">{(sale as any).paid?.toFixed(2) || '0.00'} DH</span>
              </div>
              <div className="flex justify-between text-[11px] font-black bg-slate-50 p-0.5">
                <span>الباقي:</span>
                <span>{(sale as any).change?.toFixed(2) || '0.00'} DH</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="text-center mt-6 pt-4 border-t-2 border-black">
        <p className="text-[14px] font-black uppercase mb-1">{thankYouMessage}</p>
        <p className="text-[11px] font-black italic">{footerNote}</p>
        
        <div className="mt-4 flex justify-center">
          <div className="border border-black px-2 py-0.5 text-[10px] font-black">
            {sale.invoiceNumber}
          </div>
        </div>
        
        <div className="mt-4 space-y-0.5">
          <p className="text-[9px] opacity-60">تاريخ الطباعة: {format(new Date(), 'yyyy-MM-dd HH:mm:ss')}</p>
          <p className="text-[9px] opacity-40 italic">نظام تسيير المبيعات v1.0</p>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            margin: 0;
            size: ${width} auto;
          }
          body * {
            visibility: hidden;
          }
          .receipt-container, .receipt-container * {
            visibility: visible;
          }
          .receipt-container {
            position: absolute;
            left: 0;
            top: 0;
            width: ${width};
            padding: 2mm;
            margin: 0;
            box-shadow: none;
          }
          ::-webkit-scrollbar {
            display: none;
          }
        }
      `}} />
    </div>
  );
}
