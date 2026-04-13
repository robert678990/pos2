import React, { useState, useEffect } from 'react';
import { Search, ChevronRight, Package, Tag, Boxes, ArrowRight } from 'lucide-react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../firebase';
import { Product } from '../types';
import { handleFirestoreError, OperationType } from '../lib/error-handler';
import { cn } from '../lib/utils';

interface PriceCheckProps {
  onBack: () => void;
}

export default function PriceCheck({ onBack }: PriceCheckProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'products'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const productsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Product[];
      setProducts(productsData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'products');
    });
    return unsubscribe;
  }, []);

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.barcode?.includes(searchTerm)
  );

  return (
    <div className="h-full flex flex-col bg-slate-50 overflow-hidden" dir="rtl">
      {/* Header */}
      <div className="bg-white px-8 py-6 border-b border-slate-200 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-3 hover:bg-slate-100 rounded-2xl transition-colors group"
          >
            <ArrowRight className="w-6 h-6 text-slate-500 group-hover:text-indigo-600" />
          </button>
          <div className="bg-slate-100 p-3 rounded-2xl">
            <Search className="w-6 h-6 text-slate-600" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">شاشة عرض الأسعار</h1>
            <p className="text-slate-500 font-bold text-sm">البحث السريع عن أسعار المنتجات والمخزون</p>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="px-8 py-6 bg-white border-b border-slate-100">
        <div className="max-w-3xl mx-auto relative">
          <Search className="absolute right-6 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-400" />
          <input
            type="text"
            placeholder="ابحث باسم المنتج أو الباركود..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border-2 border-slate-100 rounded-[24px] py-5 pr-16 pl-8 text-xl font-bold focus:border-indigo-500 focus:bg-white transition-all outline-none shadow-inner"
            autoFocus
          />
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        <div className="max-w-3xl mx-auto space-y-4">
          {loading ? (
            <div className="text-center py-20">
              <div className="animate-spin w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-slate-500 font-bold">جاري تحميل المنتجات...</p>
            </div>
          ) : filteredProducts.length > 0 ? (
            filteredProducts.map((product) => (
              <div 
                key={product.id}
                className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm hover:shadow-md transition-all flex items-center gap-6"
              >
                <div className="bg-indigo-50 p-5 rounded-2xl">
                  <Package className="w-8 h-8 text-indigo-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-black text-slate-800 mb-1">{product.name}</h3>
                  <div className="flex items-center gap-4 text-slate-500 font-bold text-sm">
                    <span className="flex items-center gap-1.5">
                      <Tag className="w-4 h-4" />
                      {product.barcode || 'بدون باركود'}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Boxes className="w-4 h-4" />
                      المخزون: {product.stock} {product.unit}
                    </span>
                  </div>
                </div>
                <div className="text-left">
                  <div className="text-3xl font-black text-indigo-600">{(product.price || 0).toFixed(2)}</div>
                  <div className="text-xs font-black text-slate-400 uppercase tracking-widest">درهم مغربي</div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-20 bg-white rounded-[40px] border-2 border-dashed border-slate-200">
              <Search className="w-16 h-16 text-slate-200 mx-auto mb-4" />
              <p className="text-slate-400 font-bold text-lg">لا توجد نتائج للبحث</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
