import React, { useState, useEffect } from 'react';
import { 
  Package, 
  Plus, 
  Search, 
  AlertTriangle, 
  Edit2, 
  Trash2, 
  X,
  Save,
  Filter,
  Barcode,
  Image as ImageIcon,
  Camera,
  Calendar,
  ChevronDown,
  FileSpreadsheet,
  ArrowRightLeft,
  Clock,
  Calculator,
  ArrowLeft,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Download,
  FileText
} from 'lucide-react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc, getDocs, query, where, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Product, Category, Unit, ProductBatch } from '../types';
import { cn } from '../lib/utils';
import { handleFirestoreError, OperationType } from '../lib/error-handler';
import { differenceInDays, parseISO, isBefore, addDays, format } from 'date-fns';
import { toast } from 'sonner';
import { exportToExcel, exportToPDF } from '../lib/export-utils';
import { supabaseService } from '../services/supabaseService';
import { uploadImage } from '../lib/upload-service';

const units: string[] = ['كرتون', 'باكيت', 'علبة', 'قطعة', 'حبة', 'دستة', 'شريط', 'كيس', 'شوال', 'طن', 'كيلو', 'رطل', 'غرام', 'لفة', 'متر', 'سم', 'طبق', 'صندوق', 'خدمة'];
const colors = [
  { name: 'اصفر', class: 'bg-yellow-400' },
  { name: 'احمر', class: 'bg-red-500' },
  { name: 'ازرق', class: 'bg-blue-500' },
  { name: 'اخضر', class: 'bg-green-500' },
  { name: 'ابيض', class: 'bg-white' }
];

export default function Inventory({ onBack }: { onBack?: () => void }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const url = await uploadImage(file, 'products');
    if (url) {
      setFormData({ ...formData, imageUrl: url });
      toast.success('تم تحميل الصورة بنجاح');
    }
    setIsUploading(false);
  };
  const [categories, setCategories] = useState<string[]>(['حبوب', 'قطاني', 'عطارية', 'مكسرات']);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | 'الكل' | 'نقص'>('الكل');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    type: 'danger' | 'warning' | 'info';
  } | null>(null);
  const [currentMobileView, setCurrentMobileView] = useState<'menu' | 'list' | 'add' | 'category'>('menu');
  const [supabaseActive, setSupabaseActive] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);

  // Form state
  const [formData, setFormData] = useState<Partial<Product>>({
    barcode: '',
    name: '',
    description: '',
    category: 'حبوب',
    priceRetail: 0,
    priceWholesale: 0,
    price3: 0,
    unit: 'كيلو',
    unitCapacity: 0,
    higherUnit: '',
    displayColor: 'اصفر',
    stock: 0,
    minStock: 5,
    costPrice: 0,
    expiryDate: '',
    tax: 0,
    imageUrl: ''
  });

  useEffect(() => {
    const unsubProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'products');
    });

    const seedCategories = async () => {
      const snapshot = await getDocs(collection(db, 'categories'));
      if (snapshot.empty) {
        const defaults = ['حبوب', 'قطاني', 'عطارية', 'مكسرات'];
        for (const name of defaults) {
          // Double check if it was added by another client in the meantime
          const checkQ = query(collection(db, 'categories'), where('name', '==', name));
          const checkSnapshot = await getDocs(checkQ);
          if (checkSnapshot.empty) {
            await addDoc(collection(db, 'categories'), { name });
          }
        }
      }
    };
    seedCategories();

    const unsubCategories = onSnapshot(collection(db, 'categories'), (snapshot) => {
      const names = snapshot.docs.map(doc => doc.data().name);
      setCategories([...new Set(names)]);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'categories');
    });

    const unsubDatabase = onSnapshot(doc(db, 'settings', 'database'), (doc) => {
      if (doc.exists()) {
        setSupabaseActive(doc.data().isActive);
      }
    });

    return () => {
      unsubProducts();
      unsubCategories();
    };
  }, []);

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.barcode?.includes(search);
    const matchesCategory = selectedCategory === 'الكل' || 
                           (selectedCategory === 'نقص' ? p.stock < p.minStock : p.category === selectedCategory);
    return matchesSearch && matchesCategory;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const productData = {
        barcode: formData.barcode || '',
        name: formData.name || '',
        description: formData.description || '',
        category: formData.category || 'حبوب',
        priceRetail: formData.priceRetail || 0,
        priceWholesale: formData.priceWholesale || 0,
        price3: formData.price3 || 0,
        unit: formData.unit || 'كيلو',
        unitCapacity: formData.unitCapacity || 0,
        higherUnit: formData.higherUnit || '',
        displayColor: formData.displayColor || 'اصفر',
        stock: formData.stock || 0,
        minStock: formData.minStock || 0,
        costPrice: formData.costPrice || 0,
        expiryDate: formData.expiryDate || '',
        tax: formData.tax || 0,
        imageUrl: formData.imageUrl || ''
      };

      if (editingProduct) {
        const oldStock = editingProduct.stock || 0;
        const newStock = formData.stock || 0;
        let updatedBatches = [...(editingProduct.batches || [])];

        if (newStock > oldStock) {
          // Stock increased, add a new batch for the difference
          const diff = newStock - oldStock;
          updatedBatches.push({
            id: `batch-${Date.now()}`,
            quantity: diff,
            costPrice: formData.costPrice || 0,
            receivedDate: new Date(),
            expiryDate: formData.expiryDate || undefined
          });
        } else if (newStock < oldStock) {
          // Stock decreased, deduct from batches (FIFO)
          let remainingToDeduct = oldStock - newStock;
          
          // Sort batches by receivedDate
          updatedBatches.sort((a, b) => {
            const dateA = a.receivedDate?.seconds || (a.receivedDate instanceof Date ? a.receivedDate.getTime() / 1000 : 0);
            const dateB = b.receivedDate?.seconds || (b.receivedDate instanceof Date ? b.receivedDate.getTime() / 1000 : 0);
            return dateA - dateB;
          });

          const nextBatches: ProductBatch[] = [];
          for (const batch of updatedBatches) {
            if (remainingToDeduct <= 0) {
              nextBatches.push(batch);
              continue;
            }

            if (batch.quantity <= remainingToDeduct) {
              remainingToDeduct -= batch.quantity;
            } else {
              nextBatches.push({
                ...batch,
                quantity: batch.quantity - remainingToDeduct
              });
              remainingToDeduct = 0;
            }
          }
          updatedBatches = nextBatches;
        }

        const finalProductData = {
          ...productData,
          batches: updatedBatches
        };

        await updateDoc(doc(db, 'products', editingProduct.id!), finalProductData);
        if (supabaseActive) {
          supabaseService.syncProduct({ ...finalProductData, id: editingProduct.id } as any);
        }
        toast.success('تم تحديث المنتج بنجاح');
      } else {
        // New product, create initial batch
        const initialBatch: ProductBatch = {
          id: `batch-${Date.now()}`,
          quantity: formData.stock || 0,
          costPrice: formData.costPrice || 0,
          receivedDate: new Date(),
          expiryDate: formData.expiryDate || undefined
        };

        const finalProductData = {
          ...productData,
          batches: [initialBatch]
        };

        const docRef = await addDoc(collection(db, 'products'), finalProductData);
        if (supabaseActive) {
          supabaseService.syncProduct({ ...finalProductData, id: docRef.id } as any);
        }
        toast.success('تم إضافة المنتج بنجاح');
      }
      setIsModalOpen(false);
      setEditingProduct(null);
      resetForm();
      setCurrentMobileView('menu');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'products');
    }
  };

  const handleExportInventory = () => {
    const data = products.map(p => ({
      'الباركود': p.barcode,
      'الاسم': p.name,
      'التصنيف': p.category,
      'سعر التجزئة': p.priceRetail.toFixed(2),
      'سعر الجملة': p.priceWholesale.toFixed(2),
      'سعر التكلفة': p.costPrice.toFixed(2),
      'المخزون': p.stock.toFixed(2),
      'الوحدة': p.unit
    }));
    exportToExcel(data, `جرد_المخزن_${format(new Date(), 'yyyy-MM-dd')}`);
  };

  const handleExportInventoryPDF = () => {
    const data = products.map(p => ({
      'الباركود': p.barcode,
      'الاسم': p.name,
      'التصنيف': p.category,
      'سعر التجزئة': p.priceRetail.toFixed(2),
      'المخزون': p.stock.toFixed(2),
      'الوحدة': p.unit
    }));
    exportToPDF(data, `جرد_المخزن_${format(new Date(), 'yyyy-MM-dd')}`, 'جرد المخزن');
  };

  const resetForm = () => {
    setFormData({
      barcode: '',
      name: '',
      description: '',
      category: categories[0] || 'حبوب',
      priceRetail: 0,
      priceWholesale: 0,
      price3: 0,
      unit: 'كيلو',
      unitCapacity: 0,
      higherUnit: '',
      displayColor: 'اصفر',
      stock: 0,
      minStock: 5,
      costPrice: 0,
      expiryDate: '',
      tax: 0,
      imageUrl: ''
    });
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    try {
      const docRef = await addDoc(collection(db, 'categories'), { name: newCategoryName.trim() });
      if (supabaseActive) {
        supabaseService.syncCategory({ id: docRef.id, name: newCategoryName.trim() });
      }
      setNewCategoryName('');
      toast.success('تم إضافة التصنيف بنجاح');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'categories');
    }
  };

  const handleDeleteCategory = async (name: string) => {
    setConfirmModal({
      title: 'حذف التصنيف',
      message: `هل أنت متأكد من حذف تصنيف "${name}"؟ سيتم حذف التصنيف فقط ولن تتأثر المنتجات المرتبطة به.`,
      type: 'danger',
      onConfirm: async () => {
        try {
          const q = query(collection(db, 'categories'), where('name', '==', name));
          const snapshot = await getDocs(q);
          const deletePromises = snapshot.docs.map(d => deleteDoc(doc(db, 'categories', d.id)));
          await Promise.all(deletePromises);
          toast.success('تم حذف التصنيف بنجاح');
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, 'categories');
        }
      }
    });
  };

  const handleDelete = async (id: string) => {
    setConfirmModal({
      title: 'حذف المنتج',
      message: 'هل أنت متأكد من حذف هذا المنتج نهائياً؟ لا يمكن التراجع عن هذه العملية.',
      type: 'danger',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'products', id));
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `products/${id}`);
        }
      }
    });
  };

  const openEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData(product);
    setIsModalOpen(true);
  };

  const getExpiryStatus = (expiryDate?: string) => {
    if (!expiryDate) return null;
    const date = parseISO(expiryDate);
    const today = new Date();
    const thirtyDaysFromNow = addDays(today, 30);

    if (isBefore(date, today)) return 'expired';
    if (isBefore(date, thirtyDaysFromNow)) return 'near';
    return 'safe';
  };

  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden" dir="rtl">
      {/* Desktop View */}
      <div className="hidden lg:flex flex-col gap-1.5 p-2 h-full">
        <div className="flex justify-between items-center bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="bg-indigo-50 p-1.5 rounded-lg">
                <Package className="w-4 h-4 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-sm font-black text-slate-800 leading-tight">المخزن</h2>
                <p className="text-[8px] text-slate-400 font-bold leading-tight">إدارة المنتجات</p>
              </div>
            </div>
            
            <div className="h-6 w-px bg-slate-100 mx-1"></div>
            
            <div className="flex items-center gap-1.5">
              <div className="flex items-center gap-1 px-1.5 py-0.5 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-[9px] font-black text-slate-400 uppercase">المنتجات</span>
                <span className="text-[10px] font-black text-slate-800">{products.length}</span>
              </div>
              <div className="flex items-center gap-1 px-1.5 py-0.5 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-[9px] font-black text-slate-400 uppercase">القيمة</span>
                <span className="text-[10px] font-black text-slate-800">
                  {products.reduce((acc, p) => acc + (p.stock * p.costPrice), 0).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center gap-1 px-1.5 py-0.5 bg-red-50 rounded-lg border border-red-100">
                <AlertTriangle className="w-3 h-3 text-red-500" />
                <span className="text-[10px] font-black text-red-600">
                  {products.filter(p => p.stock < p.minStock).length}
                </span>
              </div>
              <div className="flex items-center gap-1 px-1.5 py-0.5 bg-amber-50 rounded-lg border border-amber-100">
                <Clock className="w-3 h-3 text-amber-500" />
                <span className="text-[10px] font-black text-amber-600">
                  {products.filter(p => getExpiryStatus(p.expiryDate) === 'expired').length}
                </span>
              </div>
            </div>

            <div className="h-6 w-px bg-slate-100 mx-1"></div>

            <div className="relative w-48">
              <Search className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 w-3 h-3" />
              <input
                type="text"
                placeholder="بحث سريع..."
                className="w-full pr-7 pl-2 py-1 bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 transition-all outline-none text-[10px] font-bold"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-1.5">
            <div className="flex bg-indigo-50 rounded-lg border border-indigo-100 p-0.5 shadow-sm">
              <button 
                onClick={() => setZoomLevel(prev => Math.max(0.5, prev - 0.1))}
                className="text-indigo-600 px-1.5 py-0.5 rounded-md hover:bg-white hover:shadow-sm transition-all active:scale-90"
                title="تصغير"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <div className="px-1.5 flex items-center justify-center min-w-[40px] border-x border-indigo-100/50">
                <span className="text-[10px] font-black text-indigo-700">{Math.round(zoomLevel * 100)}%</span>
              </div>
              <button 
                onClick={() => setZoomLevel(prev => Math.min(1.5, prev + 0.1))}
                className="text-indigo-600 px-1.5 py-0.5 rounded-md hover:bg-white hover:shadow-sm transition-all active:scale-90"
                title="تكبير"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={() => setZoomLevel(1)}
                className="text-indigo-600 px-1.5 py-0.5 rounded-md hover:bg-white hover:shadow-sm transition-all active:scale-90"
                title="إعادة الضبط"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <button 
              onClick={() => setIsCategoryModalOpen(true)}
              className="bg-slate-50 text-slate-600 px-2 py-1 rounded-lg text-[9px] font-black flex items-center gap-1 border border-slate-200 hover:bg-slate-100 transition-all"
            >
              <Plus className="w-3 h-3 text-emerald-600" />
              تصنيف
            </button>
            <div className="flex bg-slate-50 rounded-lg border border-slate-200 p-0.5">
              <button 
                onClick={handleExportInventory}
                className="text-slate-600 px-1.5 py-0.5 rounded-md hover:bg-white hover:shadow-sm transition-all"
                title="تصدير Excel"
              >
                <Download className="w-3 h-3 text-emerald-600" />
              </button>
              <button 
                onClick={handleExportInventoryPDF}
                className="text-slate-600 px-1.5 py-0.5 rounded-md hover:bg-white hover:shadow-sm transition-all"
                title="تصدير PDF"
              >
                <FileText className="w-3 h-3 text-red-600" />
              </button>
            </div>
            <button className="bg-slate-50 text-slate-600 px-2 py-1 rounded-lg text-[9px] font-black flex items-center gap-1 border border-slate-200 hover:bg-slate-100 transition-all">
              <ArrowRightLeft className="w-3 h-3 text-indigo-600" />
              الأسعار
            </button>
            <button 
              onClick={() => {
                setEditingProduct(null);
                resetForm();
                setIsModalOpen(true);
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded-lg text-[9px] font-black flex items-center gap-1 shadow-sm transition-all"
            >
              <Plus className="w-3 h-3" />
              إضافة منتج
            </button>
          </div>
        </div>
        
        <div 
          className="flex-1 flex flex-col gap-2 overflow-hidden"
          style={{ 
            transform: `scale(${zoomLevel})`, 
            transformOrigin: 'top right',
            width: `${100 / zoomLevel}%`,
            height: `${100 / zoomLevel}%`
          }}
        >
          <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl shadow-sm border border-slate-200 overflow-x-auto no-scrollbar">
          <button 
            onClick={() => setSelectedCategory('الكل')}
            className={cn(
              "px-2.5 py-1 rounded-lg text-[9px] font-black whitespace-nowrap transition-all",
              selectedCategory === 'الكل' ? "bg-indigo-600 text-white shadow-sm" : "bg-slate-50 text-slate-500 hover:bg-slate-100"
            )}
          >
            الكل
          </button>
          <button 
            onClick={() => setSelectedCategory('نقص')}
            className={cn(
              "px-2.5 py-1 rounded-lg text-[9px] font-black whitespace-nowrap transition-all flex items-center gap-1",
              selectedCategory === 'نقص' ? "bg-red-600 text-white shadow-sm" : "bg-red-50 text-red-600 hover:bg-red-100"
            )}
          >
            <AlertTriangle className="w-2.5 h-2.5" />
            نقص
          </button>
          <div className="h-4 w-px bg-slate-100 mx-0.5"></div>
          {categories.map(cat => (
            <button 
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                "px-2.5 py-1 rounded-lg text-[9px] font-black whitespace-nowrap transition-all",
                selectedCategory === cat ? "bg-indigo-600 text-white shadow-sm" : "bg-slate-50 text-slate-500 hover:bg-slate-100"
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-hidden bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col">
          <div className="overflow-auto flex-1">
            <table className="w-full text-right border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-1.5 font-black text-slate-500 text-[8px] uppercase tracking-wider">المنتج</th>
                  <th className="px-3 py-1.5 font-black text-slate-500 text-[8px] uppercase tracking-wider">الصنف</th>
                  <th className="px-3 py-1.5 font-black text-slate-500 text-[8px] uppercase tracking-wider">الوصف</th>
                  <th className="px-3 py-1.5 font-black text-slate-500 text-[8px] uppercase tracking-wider">سعر الشراء</th>
                  <th className="px-3 py-1.5 font-black text-slate-500 text-[8px] uppercase tracking-wider text-center">الأسعار (1/2/3)</th>
                  <th className="px-3 py-1.5 font-black text-slate-500 text-[8px] uppercase tracking-wider">الضريبة</th>
                  <th className="px-3 py-1.5 font-black text-slate-500 text-[8px] uppercase tracking-wider">المخزن / الحد</th>
                  <th className="px-3 py-1.5 font-black text-slate-500 text-[8px] uppercase tracking-wider">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map(product => (
                  <tr key={product.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-3 py-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-slate-100 rounded-lg flex items-center justify-center border border-slate-200 overflow-hidden shrink-0">
                          {product.imageUrl ? (
                            <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <Package className="w-3.5 h-3.5 text-slate-400" />
                          )}
                        </div>
                        <div>
                          <div className="font-black text-slate-800 text-[11px] flex items-center gap-1 leading-none whitespace-nowrap">
                            {product.name}
                            <div className={cn("w-1.5 h-1.5 rounded-full border border-slate-200 shadow-sm", colors.find(c => c.name === product.displayColor)?.class || 'bg-white')}></div>
                          </div>
                          <div className="flex flex-wrap gap-1.5 mt-0.5">
                            <div className="text-[8px] font-bold text-slate-400 flex items-center gap-1">
                              <Barcode className="w-2 h-2" /> {product.barcode || 'بدون باركود'}
                            </div>
                            {product.expiryDate && (
                              <div className={cn(
                                "text-[7px] font-black flex items-center gap-1 px-1 py-0.25 rounded-md",
                                getExpiryStatus(product.expiryDate) === 'expired' 
                                  ? "bg-red-100 text-red-600" 
                                  : getExpiryStatus(product.expiryDate) === 'near'
                                    ? "bg-amber-100 text-amber-600"
                                    : "bg-slate-100 text-slate-500"
                              )}>
                                <Clock className="w-2 h-2" />
                                {product.expiryDate}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-1.5">
                      <span className="px-1.5 py-0.25 bg-indigo-50 text-indigo-600 rounded-md text-[8px] font-black">
                        {product.category}
                      </span>
                    </td>
                    <td className="px-3 py-1.5">
                      <div className="text-[8px] font-bold text-slate-500 max-w-[80px] truncate" title={product.description}>
                        {product.description || '-'}
                      </div>
                    </td>
                    <td className="px-3 py-1.5">
                      <div className="font-black text-slate-700 text-[10px]">{product.costPrice}</div>
                    </td>
                    <td className="px-3 py-1.5">
                      <div className="flex gap-1.5 justify-center">
                        <div className="text-center">
                          <div className="text-[7px] text-slate-400 font-bold">تقسيط</div>
                          <div className="font-black text-emerald-600 text-[10px]">{product.priceRetail}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-[7px] text-slate-400 font-bold">جملة</div>
                          <div className="font-black text-indigo-600 text-[10px]">{product.priceWholesale}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-[7px] text-slate-400 font-bold">خاص</div>
                          <div className="font-black text-indigo-600 text-[10px]">{product.price3 || 0}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-1.5">
                      <div className="font-black text-slate-700 text-[10px]">{product.tax || 0}%</div>
                    </td>
                    <td className="px-3 py-1.5">
                      <div className="flex items-center gap-1">
                        <div className={cn(
                          "px-1.5 py-0.25 rounded-md font-black text-[10px]",
                          product.stock < product.minStock ? "bg-red-50 text-red-600 border border-red-100" : "bg-slate-50 text-slate-700 border border-slate-100"
                        )}>
                          {product.stock} <span className="text-[8px] font-bold">/ {product.minStock} {product.unit}</span>
                        </div>
                        {product.stock < product.minStock && (
                          <div className="bg-red-500 text-white p-0.25 rounded-full animate-pulse">
                            <AlertTriangle className="w-2 h-2" />
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-1.5">
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="p-1 bg-slate-50 text-slate-600 rounded-md hover:bg-slate-100 transition-all" title="طباعة الباركود">
                          <Barcode className="w-3 h-3" />
                        </button>
                        <button onClick={() => openEdit(product)} className="p-1 bg-indigo-50 text-indigo-600 rounded-md hover:bg-indigo-100 transition-all">
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button onClick={() => handleDelete(product.id!)} className="p-1 bg-red-50 text-red-600 rounded-md hover:bg-red-100 transition-all">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

      {/* Mobile View */}
      <div className="lg:hidden flex flex-col h-full bg-white overflow-hidden">
        {/* Mobile Header */}
        <div className="bg-white border-b border-slate-200 p-4 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => {
                if (currentMobileView !== 'menu') {
                  setCurrentMobileView('menu');
                } else if (onBack) {
                  onBack();
                }
              }}
              className="p-2 hover:bg-slate-100 rounded-xl text-slate-600"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h2 className="text-xl font-black text-slate-800">المخزن</h2>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-indigo-50 rounded-lg border border-indigo-100 p-1">
              <button 
                onClick={() => setZoomLevel(prev => Math.max(0.5, prev - 0.1))}
                className="text-indigo-600 p-1 active:scale-90 transition-transform"
              >
                <ZoomOut className="w-5 h-5" />
              </button>
              <button 
                onClick={() => setZoomLevel(prev => Math.min(1.5, prev + 0.1))}
                className="text-indigo-600 p-1 active:scale-90 transition-transform"
              >
                <ZoomIn className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-amber-100 p-2 rounded-xl">
              <Package className="w-6 h-6 text-amber-600" />
            </div>
          </div>
        </div>

        <div 
          className="flex-1 flex flex-col gap-2 overflow-hidden"
          style={{ 
            transform: `scale(${zoomLevel})`, 
            transformOrigin: 'top right',
            width: `${100 / zoomLevel}%`,
            height: `${100 / zoomLevel}%`
          }}
        >
          <div className="flex-1 overflow-y-auto p-4">
          {currentMobileView === 'menu' && (
            <div className="space-y-2">
              <button 
                onClick={() => {
                  setEditingProduct(null);
                  resetForm();
                  setCurrentMobileView('add');
                }}
                className="w-full bg-white border border-slate-200 p-3 rounded-xl flex items-center justify-between group active:scale-95 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-emerald-50 p-2 rounded-lg text-emerald-600">
                    <Plus className="w-5 h-5" />
                  </div>
                  <span className="font-black text-slate-700 text-sm">إضافة منتج جديد</span>
                </div>
                <ChevronDown className="w-5 h-5 text-slate-300 -rotate-90" />
              </button>

              <button 
                onClick={() => setCurrentMobileView('list')}
                className="w-full bg-white border border-slate-200 p-3 rounded-xl flex items-center justify-between group active:scale-95 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-indigo-50 p-2 rounded-lg text-indigo-600">
                    <Search className="w-5 h-5" />
                  </div>
                  <span className="font-black text-slate-700 text-sm">عرض المنتجات</span>
                </div>
                <ChevronDown className="w-5 h-5 text-slate-300 -rotate-90" />
              </button>

              <button 
                onClick={() => setCurrentMobileView('category')}
                className="w-full bg-white border border-slate-200 p-3 rounded-xl flex items-center justify-between group active:scale-95 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-amber-50 p-2 rounded-lg text-amber-600">
                    <Plus className="w-5 h-5" />
                  </div>
                  <span className="font-black text-slate-700 text-sm">إضافة تصنيف جديد</span>
                </div>
                <ChevronDown className="w-5 h-5 text-slate-300 -rotate-90" />
              </button>

              <button className="w-full bg-white border border-slate-200 p-3 rounded-xl flex items-center justify-between group active:scale-95 transition-all">
                <div className="flex items-center gap-3">
                  <div className="bg-slate-50 p-2 rounded-lg text-slate-600">
                    <ArrowRightLeft className="w-5 h-5" />
                  </div>
                  <span className="font-black text-slate-700 text-sm">تعديل أسعار المنتجات</span>
                </div>
                <ChevronDown className="w-5 h-5 text-slate-300 -rotate-90" />
              </button>

              <button className="w-full bg-white border border-slate-200 p-3 rounded-xl flex items-center justify-between group active:scale-95 transition-all">
                <div className="flex items-center gap-3">
                  <div className="bg-emerald-50 p-2 rounded-lg text-emerald-600">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <span className="font-black text-slate-700 text-sm">استيراد بيانات المنتجات من ملف اكسل</span>
                </div>
                <ChevronDown className="w-5 h-5 text-slate-300 -rotate-90" />
              </button>
            </div>
          )}

          {currentMobileView === 'list' && (
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="بحث..."
                  className="w-full pr-10 pl-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                <button 
                  onClick={() => setSelectedCategory('الكل')}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all",
                    selectedCategory === 'الكل' ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"
                  )}
                >
                  الكل
                </button>
                {categories.map(cat => (
                  <button 
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={cn(
                      "px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all",
                      selectedCategory === cat ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
                <table className="w-full text-right">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="p-2 text-[10px] font-black text-slate-400 uppercase">المنتج</th>
                      <th className="p-2 text-[10px] font-black text-slate-400 uppercase">السعر</th>
                      <th className="p-2 text-[10px] font-black text-slate-400 uppercase">الكمية</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredProducts.map(product => (
                      <tr 
                        key={product.id} 
                        onClick={() => {
                          setEditingProduct(product);
                          setFormData(product);
                          setCurrentMobileView('add');
                        }}
                        className="active:bg-slate-50"
                      >
                        <td className="p-2">
                          <div className="font-black text-slate-800 text-sm whitespace-nowrap">{product.name}</div>
                          <div className="text-[10px] text-slate-400">{product.barcode}</div>
                        </td>
                        <td className="p-2">
                          <div className="font-black text-emerald-600 text-sm">{product.priceRetail}</div>
                        </td>
                        <td className="p-2">
                          <div className={cn(
                            "font-black text-sm",
                            product.stock < product.minStock ? "text-red-600" : "text-slate-600"
                          )}>
                            {product.stock}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {currentMobileView === 'add' && (
            <form onSubmit={handleSubmit} className="space-y-6 pb-20">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase">رقم المنتج (Barcode)</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl font-black outline-none focus:ring-2 focus:ring-indigo-500"
                      value={formData.barcode}
                      onChange={e => setFormData({...formData, barcode: e.target.value})}
                    />
                    <button type="button" className="bg-indigo-50 text-indigo-600 p-3 rounded-xl">
                      <Barcode className="w-6 h-6" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase">اسم المنتج</label>
                  <input 
                    required
                    type="text" 
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-black outline-none focus:ring-2 focus:ring-indigo-500"
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase">الوصف</label>
                  <textarea 
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-black outline-none focus:ring-2 focus:ring-indigo-500 h-20"
                    value={formData.description || ''}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase">سعر البيع</label>
                    <input 
                      required
                      type="number" step="any"
                      className="w-full p-3 bg-emerald-50 border border-emerald-100 rounded-xl font-black text-emerald-700 outline-none"
                      value={formData.priceRetail || ''}
                      onChange={e => setFormData({...formData, priceRetail: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase">سعر البيع 2</label>
                    <input 
                      type="number" step="any"
                      className="w-full p-3 bg-blue-50 border border-blue-100 rounded-xl font-black text-blue-700 outline-none"
                      value={formData.priceWholesale || ''}
                      onChange={e => setFormData({...formData, priceWholesale: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase">سعر البيع 3</label>
                    <input 
                      type="number" step="any"
                      className="w-full p-3 bg-indigo-50 border border-indigo-100 rounded-xl font-black text-indigo-700 outline-none"
                      value={formData.price3 || ''}
                      onChange={e => setFormData({...formData, price3: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase">سعر الشراء/التكلفة</label>
                  <input 
                    required
                    type="number" step="any"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-black outline-none"
                    value={formData.costPrice || ''}
                    onChange={e => setFormData({...formData, costPrice: parseFloat(e.target.value) || 0})}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase">الكمية</label>
                    <input 
                      required
                      type="number" step="any"
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-black outline-none"
                      value={formData.stock || ''}
                      onChange={e => setFormData({...formData, stock: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase">حد الطلب</label>
                    <input 
                      required
                      type="number" step="any"
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-black outline-none"
                      value={formData.minStock || ''}
                      onChange={e => setFormData({...formData, minStock: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase">تاريخ الانتهاء</label>
                  <input 
                    type="date" 
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-black outline-none"
                    value={formData.expiryDate}
                    onChange={e => setFormData({...formData, expiryDate: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase">الضريبة TAX</label>
                  <select 
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-black outline-none"
                    value={formData.tax || 0}
                    onChange={e => setFormData({...formData, tax: parseFloat(e.target.value) || 0})}
                  >
                    <option value={0}>---</option>
                    <option value={5}>5%</option>
                    <option value={10}>10%</option>
                    <option value={20}>20%</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase">التصنيف</label>
                  <select 
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-black outline-none"
                    value={formData.category}
                    onChange={e => setFormData({...formData, category: e.target.value})}
                  >
                    <option value="">---</option>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase">الوحدة</label>
                  <div className="flex gap-2">
                    <select 
                      className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl font-black outline-none"
                      value={formData.unit}
                      onChange={e => setFormData({...formData, unit: e.target.value})}
                    >
                      <option value="">---</option>
                      {units.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                    <button type="button" className="bg-emerald-50 text-emerald-600 p-3 rounded-xl">
                      <Plus className="w-6 h-6" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase">عبوة الوحدة</label>
                  <input 
                    type="number" 
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-black outline-none"
                    value={formData.unitCapacity || 0}
                    onChange={e => setFormData({...formData, unitCapacity: parseFloat(e.target.value) || 0})}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase">العبوة الأعلى</label>
                  <input 
                    type="text" 
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-black outline-none"
                    value={formData.higherUnit || ''}
                    onChange={e => setFormData({...formData, higherUnit: e.target.value})}
                  />
                </div>

                <div className="space-y-4">
                  <label className="text-xs font-black text-slate-400 uppercase">صورة المنتج</label>
                  <div className="aspect-video bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-2 overflow-hidden relative">
                    {formData.imageUrl ? (
                      <img src={formData.imageUrl} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <ImageIcon className="w-10 h-10 text-slate-300" />
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button type="button" className="flex-1 bg-slate-100 p-3 rounded-xl text-xs font-black text-slate-600">من الاستوديو</button>
                    <button type="button" className="flex-1 bg-slate-100 p-3 rounded-xl text-xs font-black text-slate-600">من الكاميرا</button>
                  </div>
                </div>
              </div>

              <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 flex gap-3 z-30">
                <button 
                  type="submit"
                  className="flex-1 bg-indigo-600 text-white font-black py-4 rounded-xl shadow-lg active:scale-95 transition-all"
                >
                  حفظ البيانات
                </button>
                <button 
                  type="button"
                  onClick={() => setCurrentMobileView('menu')}
                  className="px-6 bg-slate-100 text-slate-600 font-black py-4 rounded-xl active:scale-95 transition-all"
                >
                  إلغاء
                </button>
              </div>
            </form>
          )}

          {currentMobileView === 'category' && (
            <div className="space-y-6">
              <form onSubmit={handleAddCategory} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase">اسم التصنيف</label>
                  <input 
                    required
                    type="text" 
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-black outline-none focus:ring-2 focus:ring-indigo-500"
                    value={newCategoryName}
                    onChange={e => setNewCategoryName(e.target.value)}
                    placeholder="مثلاً: مشروبات"
                  />
                </div>
                <button 
                  type="submit"
                  className="w-full bg-indigo-600 text-white font-black py-4 rounded-xl shadow-lg active:scale-95 transition-all"
                >
                  إضافة التصنيف
                </button>
              </form>

              <div className="space-y-3">
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">التصنيفات الحالية</h3>
                <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100">
                  {categories.map(cat => (
                    <div key={cat} className="p-4 flex items-center justify-between">
                      <span className="font-black text-slate-700">{cat}</span>
                      <button 
                        onClick={() => handleDeleteCategory(cat)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>

      {/* Detailed Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-4xl rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in duration-300 my-8">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-4">
                <div className="bg-indigo-600 p-3 rounded-2xl text-white">
                  <Package className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-800">
                    {editingProduct ? 'تعديل بيانات المنتج' : 'إضافة منتج جديد'}
                  </h3>
                  <p className="text-slate-400 text-sm font-bold">أدخل تفاصيل المنتج بدقة</p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Left Column: Image & Barcode */}
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest">صورة المنتج (URL)</label>
                    <div className="aspect-square bg-slate-100 rounded-[32px] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-4 group cursor-pointer hover:bg-slate-50 transition-all overflow-hidden relative">
                      {isUploading ? (
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                          <span className="text-[10px] font-black text-slate-400">جاري التحميل...</span>
                        </div>
                      ) : formData.imageUrl ? (
                        <img src={formData.imageUrl} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <>
                          <div className="bg-white p-4 rounded-2xl shadow-sm group-hover:scale-110 transition-transform">
                            <ImageIcon className="w-10 h-10 text-slate-300" />
                          </div>
                          <div className="text-[10px] font-black text-slate-400">أدخل رابط الصورة أو اختر من الجهاز</div>
                        </>
                      )}
                    </div>
                    <input 
                      type="text" 
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs outline-none focus:ring-2 focus:ring-blue-500"
                      value={formData.imageUrl || ''}
                      onChange={e => setFormData({...formData, imageUrl: e.target.value})}
                      placeholder="https://example.com/image.jpg"
                    />
                    <div className="flex gap-2">
                      <input 
                        type="file" 
                        id="product-image-upload" 
                        className="hidden" 
                        accept="image/*"
                        onChange={handleFileUpload}
                      />
                      <button 
                        type="button" 
                        onClick={() => document.getElementById('product-image-upload')?.click()}
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

                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest">رقم المنتج (Barcode)</label>
                    <div className="relative">
                      <input 
                        type="text" 
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black outline-none focus:ring-2 focus:ring-blue-500"
                        value={formData.barcode}
                        onChange={e => setFormData({...formData, barcode: e.target.value})}
                        placeholder="260319491444"
                      />
                      <button type="button" className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-600 bg-blue-50 p-2 rounded-xl">
                        <Barcode className="w-5 h-5" />
                      </button>
                    </div>
                    <button type="button" className="text-[10px] font-black text-slate-400 hover:text-blue-600 transition-colors">اتركه فارغاً للإضافة آلياً</button>
                  </div>
                </div>

                {/* Middle & Right Columns: Details */}
                <div className="md:col-span-2 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest">اسم المنتج</label>
                      <input 
                        required
                        type="text" 
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black outline-none focus:ring-2 focus:ring-blue-500"
                        value={formData.name}
                        onChange={e => setFormData({...formData, name: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest">الوصف</label>
                      <input 
                        type="text" 
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black outline-none focus:ring-2 focus:ring-blue-500"
                        value={formData.description || ''}
                        onChange={e => setFormData({...formData, description: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">سعر البيع 1</label>
                      <input 
                        required
                        type="number" step="any"
                        className="w-full p-4 bg-emerald-50 border border-emerald-100 rounded-2xl font-black text-emerald-700 outline-none focus:ring-2 focus:ring-emerald-500"
                        value={formData.priceRetail || ''}
                        onChange={e => setFormData({...formData, priceRetail: parseFloat(e.target.value) || 0})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">سعر البيع 2</label>
                      <input 
                        type="number" step="any"
                        className="w-full p-4 bg-blue-50 border border-blue-100 rounded-2xl font-black text-blue-700 outline-none focus:ring-2 focus:ring-blue-500"
                        value={formData.priceWholesale || ''}
                        onChange={e => setFormData({...formData, priceWholesale: parseFloat(e.target.value) || 0})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">سعر البيع 3</label>
                      <input 
                        type="number" step="any"
                        className="w-full p-4 bg-indigo-50 border border-indigo-100 rounded-2xl font-black text-indigo-700 outline-none focus:ring-2 focus:ring-indigo-500"
                        value={formData.price3 || ''}
                        onChange={e => setFormData({...formData, price3: parseFloat(e.target.value) || 0})}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">سعر الشراء</label>
                      <input 
                        required
                        type="number" step="any"
                        className="w-full p-4 bg-slate-100 border border-slate-200 rounded-2xl font-black outline-none focus:ring-2 focus:ring-blue-500"
                        value={formData.costPrice || ''}
                        onChange={e => setFormData({...formData, costPrice: parseFloat(e.target.value) || 0})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">الكمية</label>
                      <input 
                        required
                        type="number" step="any"
                        className="w-full p-4 bg-slate-100 border border-slate-200 rounded-2xl font-black outline-none focus:ring-2 focus:ring-blue-500"
                        value={formData.stock || ''}
                        onChange={e => setFormData({...formData, stock: parseFloat(e.target.value) || 0})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">حد الطلب</label>
                      <input 
                        required
                        type="number" step="any"
                        className="w-full p-4 bg-slate-100 border border-slate-200 rounded-2xl font-black outline-none focus:ring-2 focus:ring-blue-500"
                        value={formData.minStock || ''}
                        onChange={e => setFormData({...formData, minStock: parseFloat(e.target.value) || 0})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">تاريخ الانتهاء</label>
                      <div className="relative">
                        <input 
                          type="date" 
                          className="w-full p-4 bg-slate-100 border border-slate-200 rounded-2xl font-black outline-none focus:ring-2 focus:ring-blue-500 text-xs"
                          value={formData.expiryDate}
                          onChange={e => setFormData({...formData, expiryDate: e.target.value})}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">الضريبة TAX</label>
                      <input 
                        type="number" 
                        className="w-full p-4 bg-slate-100 border border-slate-200 rounded-2xl font-black outline-none focus:ring-2 focus:ring-blue-500"
                        value={formData.tax || 0}
                        onChange={e => setFormData({...formData, tax: parseFloat(e.target.value) || 0})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">التصنيف</label>
                      <select 
                        className="w-full p-4 bg-slate-100 border border-slate-200 rounded-2xl font-black outline-none focus:ring-2 focus:ring-blue-500"
                        value={formData.category}
                        onChange={e => setFormData({...formData, category: e.target.value})}
                      >
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">الوحدة</label>
                      <select 
                        className="w-full p-4 bg-slate-100 border border-slate-200 rounded-2xl font-black outline-none focus:ring-2 focus:ring-blue-500"
                        value={formData.unit}
                        onChange={e => setFormData({...formData, unit: e.target.value})}
                      >
                        {units.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">عبوة الوحدة</label>
                      <input 
                        type="number" 
                        className="w-full p-4 bg-slate-100 border border-slate-200 rounded-2xl font-black outline-none focus:ring-2 focus:ring-blue-500"
                        value={formData.unitCapacity || 0}
                        onChange={e => setFormData({...formData, unitCapacity: parseFloat(e.target.value) || 0})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">العبوة الأعلى</label>
                      <input 
                        type="text" 
                        className="w-full p-4 bg-slate-100 border border-slate-200 rounded-2xl font-black outline-none focus:ring-2 focus:ring-blue-500"
                        value={formData.higherUnit || ''}
                        onChange={e => setFormData({...formData, higherUnit: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">لون المربع</label>
                      <select 
                        className="w-full p-4 bg-slate-100 border border-slate-200 rounded-2xl font-black outline-none focus:ring-2 focus:ring-blue-500"
                        value={formData.displayColor}
                        onChange={e => setFormData({...formData, displayColor: e.target.value})}
                      >
                        {colors.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-4 mt-12">
                <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-black py-5 rounded-[32px] shadow-2xl shadow-blue-200 transition-all flex items-center justify-center gap-3 text-xl">
                  <Save className="w-6 h-6" />
                  حفظ البيانات
                </button>
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-12 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black py-5 rounded-[32px] transition-all text-xl">
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Category Modal */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-[60] p-4">
          <div className="bg-white w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-xl font-black text-slate-800">إضافة تصنيف جديد</h3>
              <button onClick={() => setIsCategoryModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleAddCategory} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">اسم التصنيف</label>
                <div className="flex gap-2">
                  <input 
                    autoFocus
                    required
                    type="text" 
                    className="flex-1 p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black outline-none focus:ring-2 focus:ring-blue-500"
                    value={newCategoryName}
                    onChange={e => setNewCategoryName(e.target.value)}
                    placeholder="مثال: مشروبات"
                  />
                  <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white p-4 rounded-2xl shadow-lg shadow-indigo-200 transition-all">
                    <Plus className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">التصنيفات الحالية</label>
                <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto p-1">
                  {categories.map(cat => (
                    <div key={cat} className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex justify-between items-center group">
                      <span className="font-bold text-slate-700">{cat}</span>
                      <button 
                        type="button"
                        onClick={() => handleDeleteCategory(cat)}
                        className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
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
                 <Package className="w-10 h-10" />}
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
