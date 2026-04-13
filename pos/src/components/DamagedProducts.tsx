import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  ArrowRight, 
  Search, 
  Package, 
  Boxes, 
  Trash2, 
  CheckCircle2, 
  Loader2,
  MinusCircle
} from 'lucide-react';
import { collection, onSnapshot, query, doc, updateDoc, addDoc, serverTimestamp, writeBatch, increment } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Product } from '../types';
import { supabaseService } from '../services/supabaseService';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import { handleFirestoreError, OperationType } from '../lib/error-handler';

interface DamagedProductsProps {
  onBack: () => void;
}

export default function DamagedProducts({ onBack }: DamagedProductsProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

  const handleSubmit = async () => {
    if (!selectedProduct || quantity <= 0) return;
    if (quantity > selectedProduct.stock) {
      toast.error('الكمية التالفة أكبر من المخزون المتوفر');
      return;
    }

    setSubmitting(true);
    const batch = writeBatch(db);
    try {
      // 1. Update product stock
      const productRef = doc(db, 'products', selectedProduct.id);
      batch.update(productRef, {
        stock: increment(-quantity)
      });

      // 2. Record the damage
      const damageRef = doc(collection(db, 'damaged_products_log'));
      batch.set(damageRef, {
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        quantity,
        reason,
        timestamp: serverTimestamp(),
        userEmail: auth.currentUser?.email,
        userName: auth.currentUser?.displayName
      });

      // 3. Log the damage
      const logRef = doc(collection(db, 'logs'));
      batch.set(logRef, {
        type: 'damaged_product',
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        quantity,
        reason,
        timestamp: serverTimestamp(),
        userEmail: auth.currentUser?.email,
        details: `تسجيل منتج تالف: ${selectedProduct.name} (الكمية: ${quantity})`
      });

      await batch.commit();

      // Sync to Supabase
      supabaseService.syncDamagedProduct({
        id: damageRef.id,
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        quantity,
        reason,
        costPrice: selectedProduct.costPrice || 0,
        totalLoss: (selectedProduct.costPrice || 0) * quantity,
        timestamp: new Date()
      });

      toast.success('تم تسجيل المنتج التالف بنجاح');
      setSelectedProduct(null);
      setQuantity(1);
      setReason('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'damaged_products');
      toast.error('حدث خطأ أثناء تسجيل العملية');
    } finally {
      setSubmitting(false);
    }
  };

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
          <div className="bg-red-100 p-3 rounded-2xl">
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">معالجة المنتجات التالفة</h1>
            <p className="text-slate-500 font-bold text-sm">تسجيل وإتلاف المنتجات غير الصالحة للبيع</p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Side: Product Selection */}
        <div className="w-1/2 border-l border-slate-200 flex flex-col bg-white">
          <div className="p-6 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="ابحث باسم المنتج أو الباركود..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 pr-12 pl-4 text-lg font-bold focus:border-indigo-500 focus:bg-white transition-all outline-none"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar">
            {loading ? (
              <div className="text-center py-10">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-2" />
                <p className="text-slate-500 font-bold">جاري التحميل...</p>
              </div>
            ) : filteredProducts.map((product) => (
              <button
                key={product.id}
                onClick={() => setSelectedProduct(product)}
                className={cn(
                  "w-full p-4 rounded-2xl border-2 transition-all flex items-center gap-4 text-right",
                  selectedProduct?.id === product.id 
                    ? "border-indigo-600 bg-indigo-50 shadow-md" 
                    : "border-slate-100 hover:border-indigo-200 hover:bg-slate-50"
                )}
              >
                <div className={cn(
                  "p-3 rounded-xl",
                  selectedProduct?.id === product.id ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"
                )}>
                  <Package className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div className="font-black text-slate-800">{product.name}</div>
                  <div className="text-xs font-bold text-slate-500">المخزون: {product.stock} {product.unit}</div>
                </div>
                {selectedProduct?.id === product.id && <CheckCircle2 className="w-5 h-5 text-indigo-600" />}
              </button>
            ))}
          </div>
        </div>

        {/* Right Side: Damage Details */}
        <div className="w-1/2 p-10 overflow-y-auto custom-scrollbar">
          {selectedProduct ? (
            <div className="max-w-md mx-auto space-y-8">
              <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-xl shadow-slate-200/50 space-y-6">
                <div className="text-center space-y-2">
                  <div className="bg-red-50 w-20 h-20 rounded-[32px] flex items-center justify-center mx-auto mb-4">
                    <MinusCircle className="w-10 h-10 text-red-600" />
                  </div>
                  <h2 className="text-2xl font-black text-slate-800">{selectedProduct.name}</h2>
                  <p className="text-slate-500 font-bold">تسجيل كمية تالفة من المخزون</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-black text-slate-500 mb-2 mr-2 uppercase tracking-widest">الكمية التالفة</label>
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-2xl font-black hover:bg-slate-200 transition-colors"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        value={quantity}
                        onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 0))}
                        className="flex-1 h-14 bg-slate-50 border-2 border-slate-100 rounded-2xl text-center text-2xl font-black focus:border-indigo-500 transition-all outline-none"
                      />
                      <button 
                        onClick={() => setQuantity(Math.min(selectedProduct.stock, quantity + 1))}
                        className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-2xl font-black hover:bg-slate-200 transition-colors"
                      >
                        +
                      </button>
                    </div>
                    <p className="text-xs text-slate-400 font-bold mt-2 text-center">الحد الأقصى المتاح: {selectedProduct.stock}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-black text-slate-500 mb-2 mr-2 uppercase tracking-widest">سبب التلف</label>
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="مثال: انتهاء الصلاحية، كسر، عيب مصنعي..."
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-lg font-bold focus:border-indigo-500 transition-all outline-none h-32 resize-none"
                    />
                  </div>
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={submitting || quantity <= 0}
                  className="w-full bg-red-600 text-white font-black py-5 rounded-3xl shadow-xl shadow-red-600/20 hover:bg-red-700 transition-all flex items-center justify-center gap-4 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <>
                      <Trash2 className="w-6 h-6" />
                      تأكيد الإتلاف
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-6">
              <div className="bg-slate-100 p-10 rounded-[40px]">
                <Package className="w-20 h-20 text-slate-300" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-400">اختر منتجاً للبدء</h3>
                <p className="text-slate-400 font-bold">قم باختيار المنتج من القائمة الجانبية لتسجيل الكمية التالفة</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
