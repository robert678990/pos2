import React, { useState, useEffect } from 'react';
import { 
  Settings as SettingsIcon, 
  Store, 
  Printer, 
  Database, 
  Shield, 
  Bell, 
  Smartphone, 
  Globe, 
  Save, 
  Image as ImageIcon,
  Camera,
  Trash2,
  Download,
  Upload,
  ChevronRight,
  LogOut,
  User,
  Mail,
  Phone,
  MapPin,
  Percent,
  Plus,
  Edit2,
  X,
  Eye,
  EyeOff,
  Palette,
  Layout
} from 'lucide-react';
import { doc, onSnapshot, setDoc, updateDoc, collection, getDocs, writeBatch, query, where, limit, Timestamp, addDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { cn, hashPassword } from '../lib/utils';
import { handleFirestoreError, OperationType } from '../lib/error-handler';
import { toast } from 'sonner';

import Receipt from './Receipt';
import { SaleItem, UserAccount, Product, Sale, Category, Customer, Supplier, Purchase } from '../types';
import { supabaseService } from '../services/supabaseService';
import { supabase, updateSupabaseClient } from '../supabase';
import { createClient } from '@supabase/supabase-js';
import { Loader2, ArrowRightLeft } from 'lucide-react';

export default function Settings() {
  const [activeSection, setActiveSection] = useState<'store' | 'printer' | 'backup' | 'account' | 'notifications' | 'database' | 'theme'>('store');
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [supabaseConfig, setSupabaseConfig] = useState({
    url: import.meta.env.VITE_SUPABASE_URL || '',
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
    isActive: false
  });
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [showUserPassword, setShowUserPassword] = useState(false);
  const [editingUser, setEditingUser] = useState<Partial<UserAccount> | null>(null);
  const [isSecurityUnlocked, setIsSecurityUnlocked] = useState(false);
  const [securityCode, setSecurityCode] = useState('');
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryPhone, setRecoveryPhone] = useState('');
  const [recoveredPass, setRecoveredPass] = useState<string | null>(null);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isTestingSupabase, setIsTestingSupabase] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [storeData, setStoreData] = useState({
    name: 'متجر العطور والتوابل',
    phone: '0612345678',
    address: 'شارع محمد الخامس، الدار البيضاء',
    email: 'contact@store.com',
    currency: 'MAD',
    logo: '',
    showLogo: true,
    thankYouMessage: 'شكرا لزيارتكم!',
    footerNote: 'نتمنى رؤيتكم قريبا'
  });
  const [themeData, setThemeData] = useState({
    primaryColor: '#4f46e5',
    borderRadius: '1rem',
    layoutDensity: 'comfortable'
  });
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );

  useEffect(() => {
    const unsubSettings = onSnapshot(doc(db, 'settings', 'store'), (doc) => {
      if (doc.exists()) {
        setStoreData(doc.data() as any);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/store');
    });

    const unsubTheme = onSnapshot(doc(db, 'settings', 'theme'), (doc) => {
      if (doc.exists()) {
        const data = doc.data() as any;
        setThemeData(data);
        // Apply theme immediately
        document.documentElement.style.setProperty('--primary', data.primaryColor);
        document.documentElement.style.setProperty('--radius', data.borderRadius);
      }
    }, (error) => {
      console.warn('Theme settings not found, using defaults.');
    });

    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserAccount)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    const unsubDatabase = onSnapshot(doc(db, 'settings', 'database'), (doc) => {
      if (doc.exists()) {
        const config = doc.data() as any;
        setSupabaseConfig(config);
        // Save to localStorage for sync service
        localStorage.setItem('supabase_config', JSON.stringify(config));
        // Update the global client with the saved config
        if (config.url && config.anonKey) {
          updateSupabaseClient(config.url, config.anonKey);
        }
      }
    }, (error) => {
      console.warn('Database settings not found, using defaults.');
    });

    return () => {
      unsubSettings();
      unsubUsers();
      unsubDatabase();
    };
  }, []);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const collections = [
        'products', 'customers', 'suppliers', 'sales', 'purchases', 
        'transactions', 'box_sessions', 'box_transactions', 'logs', 'settings',
        'sales_returns', 'purchase_returns', 'damaged_products_log', 
        'supplier_transactions', 'categories', 'users'
      ];
      
      const backupData: any = {};
      
      for (const colName of collections) {
        const querySnapshot = await getDocs(collection(db, colName));
        backupData[colName] = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
      }
      
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `backup_${new Date().toISOString().split('T')[0]}.dba`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success('تم تصدير البيانات بنجاح');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('حدث خطأ أثناء تصدير البيانات');
    } finally {
      setIsExporting(false);
    }
  };

  const confirmImportData = async () => {
    if (!pendingImportFile) return;
    setIsImporting(true);
    setShowImportConfirm(false);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const content = e.target?.result as string;
          const data = JSON.parse(content);
          
          for (const colName in data) {
            const docs = data[colName];
            if (!Array.isArray(docs)) continue;

            // Process in batches of 500
            for (let i = 0; i < docs.length; i += 500) {
              const batch = writeBatch(db);
              const chunk = docs.slice(i, i + 500);
              chunk.forEach((docData: any) => {
                const { id, ...rest } = docData;
                
                // Recursively convert objects with seconds/nanoseconds to Timestamps
                const convertTimestamps = (obj: any): any => {
                  if (obj && typeof obj === 'object') {
                    if (obj.seconds !== undefined && obj.nanoseconds !== undefined && Object.keys(obj).length === 2) {
                      return new Timestamp(obj.seconds, obj.nanoseconds);
                    }
                    for (const key in obj) {
                      obj[key] = convertTimestamps(obj[key]);
                    }
                  }
                  return obj;
                };

                if (id) {
                  const docRef = doc(db, colName, id);
                  batch.set(docRef, convertTimestamps(rest));
                }
              });
              await batch.commit();
            }
          }
          toast.success('تم استيراد البيانات بنجاح');
        } catch (err) {
          console.error('Import processing error:', err);
          toast.error('فشل معالجة ملف البيانات');
        } finally {
          setIsImporting(false);
          setPendingImportFile(null);
        }
      };
      reader.readAsText(pendingImportFile);
    } catch (error) {
      console.error('Import error:', error);
      toast.error('حدث خطأ أثناء استيراد البيانات');
      setIsImporting(false);
      setPendingImportFile(null);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setPendingImportFile(file);
    setShowImportConfirm(true);
    event.target.value = '';
    return;
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser?.username || !editingUser?.password || !editingUser?.name) {
      toast.error('يرجى ملء جميع الحقول');
      return;
    }

    try {
      const hashedPassword = await hashPassword(editingUser.password);
      const userToSave = { ...editingUser, password: hashedPassword };

      if (editingUser.id) {
        await setDoc(doc(db, 'users', editingUser.id), {
          ...userToSave,
          updatedAt: serverTimestamp()
        }, { merge: true });
        toast.success('تم تحديث المستخدم بنجاح');
      } else {
        await addDoc(collection(db, 'users'), {
          ...userToSave,
          role: editingUser.role || 'employee',
          createdAt: serverTimestamp()
        });
        toast.success('تم إضافة المستخدم بنجاح');
      }
      setIsUserModalOpen(false);
      setEditingUser(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'users');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      await deleteDoc(doc(db, 'users', userId));
      toast.success('تم حذف المستخدم بنجاح');
      setUserToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'users');
    }
  };

  const handleUnlockSecurity = async (e: React.FormEvent) => {
    e.preventDefault();
    // Find any admin user with this password
    const hashedPassword = await hashPassword(securityCode.trim());
    const q = query(collection(db, 'users'), where('role', '==', 'admin'), where('password', '==', hashedPassword));
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
      setIsSecurityUnlocked(true);
      toast.success('تم فتح القفل بنجاح');
    } else {
      toast.error('كلمة المرور غير صحيحة');
    }
  };

  const handleRecoverSecurity = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const q = query(collection(db, 'users'), where('role', '==', 'admin'), where('phone', '==', recoveryPhone.trim()));
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        toast.info('عافاك تواصل مع المسؤول باش يبدل ليك كلمة المرور');
      } else {
        toast.error('لم يتم العثور على مسؤول بهذا الرقم');
      }
    } catch (error) {
      toast.error('فشل استرجاع البيانات');
    }
  };

  const handleSaveStore = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await setDoc(doc(db, 'settings', 'store'), storeData);
      await setDoc(doc(db, 'settings', 'database'), supabaseConfig);
      await setDoc(doc(db, 'settings', 'theme'), themeData);
      // Save to localStorage for sync service
      localStorage.setItem('supabase_config', JSON.stringify(supabaseConfig));
      toast.success('تم حفظ الإعدادات بنجاح');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/store');
    }
  };

  const handleFullSync = async () => {
    if (!supabaseConfig.isActive) {
      toast.error('يرجى تفعيل Supabase أولاً');
      return;
    }

    setIsSyncing(true);
    setSyncProgress(0);
    try {
      // 1. Sync Categories
      const catSnap = await getDocs(collection(db, 'categories'));
      const categoriesData = catSnap.docs.map(d => ({ id: d.id, name: (d.data() as any).name || d.id }));
      for (let i = 0; i < categoriesData.length; i++) {
        await supabaseService.syncCategory(categoriesData[i]);
        setSyncProgress(Math.round(((i + 1) / categoriesData.length) * 12.5));
      }

      // 2. Sync Products
      const prodSnap = await getDocs(collection(db, 'products'));
      const products = prodSnap.docs.map(d => ({ id: d.id, ...d.data() } as Product));
      for (let i = 0; i < products.length; i++) {
        await supabaseService.syncProduct(products[i]);
        setSyncProgress(12 + Math.round(((i + 1) / products.length) * 12.5));
      }

      // 3. Sync Customers
      const custSnap = await getDocs(collection(db, 'customers'));
      const customers = custSnap.docs.map(d => ({ id: d.id, ...d.data() } as Customer));
      for (let i = 0; i < customers.length; i++) {
        await supabaseService.syncCustomer(customers[i]);
        setSyncProgress(25 + Math.round(((i + 1) / customers.length) * 12.5));
      }

      // 4. Sync Sales
      const salesSnap = await getDocs(collection(db, 'sales'));
      const sales = salesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Sale));
      for (let i = 0; i < sales.length; i++) {
        await supabaseService.syncSale(sales[i]);
        setSyncProgress(37 + Math.round(((i + 1) / sales.length) * 12.5));
      }

      // 5. Sync Expenses
      const expSnap = await getDocs(collection(db, 'expenses'));
      const expenses = expSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      for (let i = 0; i < expenses.length; i++) {
        await supabaseService.syncExpense(expenses[i]);
        setSyncProgress(50 + Math.round(((i + 1) / expenses.length) * 12.5));
      }

      // 6. Sync Suppliers
      const suppSnap = await getDocs(collection(db, 'suppliers'));
      const suppliers = suppSnap.docs.map(d => ({ id: d.id, ...d.data() } as Supplier));
      for (let i = 0; i < suppliers.length; i++) {
        await supabaseService.syncSupplier(suppliers[i]);
        setSyncProgress(62 + Math.round(((i + 1) / suppliers.length) * 12.5));
      }

      // 7. Sync Purchases
      const purSnap = await getDocs(collection(db, 'purchases'));
      const purchases = purSnap.docs.map(d => ({ id: d.id, ...d.data() } as Purchase));
      for (let i = 0; i < purchases.length; i++) {
        await supabaseService.syncPurchase(purchases[i]);
        setSyncProgress(75 + Math.round(((i + 1) / purchases.length) * 12.5));
      }

      // 8. Sync Sales Returns
      const retSnap = await getDocs(collection(db, 'sales_returns'));
      const returns = retSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      for (let i = 0; i < returns.length; i++) {
        const item = returns[i] as any;
        await supabaseService.syncSaleReturn({
          id: item.id,
          originalSaleId: item.originalSaleId,
          invoiceNumber: item.invoiceNumber,
          items: item.items,
          totalAmount: item.totalAmount,
          timestamp: item.timestamp
        });
        setSyncProgress(87 + Math.round(((i + 1) / returns.length) * 6));
      }

      // 9. Sync Box Sessions
      const boxSessionsSnap = await getDocs(collection(db, 'box_sessions'));
      const boxSessions = boxSessionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      for (let i = 0; i < boxSessions.length; i++) {
        await supabaseService.syncBoxSession(boxSessions[i]);
        setSyncProgress(93 + Math.round(((i + 1) / boxSessions.length) * 3));
      }

      // 10. Sync Box Transactions
      const boxTransSnap = await getDocs(collection(db, 'box_transactions'));
      const boxTrans = boxTransSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      for (let i = 0; i < boxTrans.length; i++) {
        await supabaseService.syncBoxTransaction(boxTrans[i]);
        setSyncProgress(96 + Math.round(((i + 1) / boxTrans.length) * 4));
      }

      toast.success('تمت المزامنة الكاملة بنجاح!');
    } catch (error) {
      console.error('Full Sync Error:', error);
      toast.error('حدث خطأ أثناء المزامنة');
    } finally {
      setIsSyncing(false);
      setSyncProgress(0);
    }
  };

  const handleTestSupabase = async () => {
    const url = supabaseConfig.url.trim();
    const key = supabaseConfig.anonKey.trim();

    if (!url || !key) {
      toast.error('يرجى إدخال الرابط والمفتاح أولاً');
      return;
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      toast.error('الرابط يجب أن يبدأ بـ http:// أو https://');
      return;
    }

    setIsTestingSupabase(true);
    try {
      // Create a temporary client to test the specific credentials entered in the UI
      const testClient = createClient(url, key);
      const { data, error } = await testClient.from('products').select('id').limit(1);
      if (error) throw error;
      toast.success('تم الاتصال بـ Supabase بنجاح!');
    } catch (error: any) {
      console.error('Supabase Connection Test Error:', error);
      toast.error(`فشل الاتصال: ${error.message || 'تأكد من صحة البيانات وإعدادات CORS'}`);
    } finally {
      setIsTestingSupabase(false);
    }
  };

  const requestPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
    }
  };

  const sections = [
    { id: 'store', label: 'معلومات المتجر', icon: Store },
    { id: 'taxes', label: 'الضرائب والرسوم', icon: Percent },
    { id: 'printer', label: 'إعدادات الطابعة', icon: Printer },
    { id: 'backup', label: 'النسخ الاحتياطي', icon: Database },
    { id: 'notifications', label: 'التنبيهات', icon: Bell },
    { id: 'theme', label: 'المظهر والألوان', icon: Palette },
    { id: 'database', label: 'قاعدة البيانات (Supabase)', icon: Database },
    { id: 'account', label: 'الحساب والأمان', icon: Shield },
  ];

  return (
    <div className="p-8 h-full flex flex-col gap-8 bg-slate-100 overflow-y-auto" dir="rtl">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-4xl font-black text-slate-800">الإعدادات</h2>
          <p className="text-slate-500 font-bold mt-1">تخصيص النظام وإدارة المتجر</p>
        </div>
      </div>

      <div className="flex gap-8 items-start">
        {/* Sidebar Navigation */}
        <div className="w-72 space-y-2">
          {sections.map(section => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id as any)}
              className={cn(
                "w-full p-4 rounded-2xl flex items-center gap-4 transition-all font-black text-sm",
                activeSection === section.id 
                  ? "bg-indigo-600 text-white shadow-xl shadow-indigo-200" 
                  : "bg-white text-slate-500 hover:bg-slate-50 border border-slate-200"
              )}
            >
              <section.icon className="w-5 h-5" />
              {section.label}
              <ChevronRight className={cn("w-4 h-4 mr-auto rotate-180", activeSection === section.id ? "opacity-100" : "opacity-0")} />
            </button>
          ))}
          <div className="pt-8">
            <button 
              onClick={() => auth.signOut()}
              className="w-full p-4 rounded-2xl flex items-center gap-4 transition-all font-black text-sm text-red-500 bg-red-50 hover:bg-red-100 border border-red-100"
            >
              <LogOut className="w-5 h-5" />
              تسجيل الخروج
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 bg-white rounded-[40px] shadow-sm border border-slate-200 overflow-hidden">
          {activeSection === 'store' && (
            <div className="p-12 animate-in fade-in slide-in-from-left-4 duration-300">
              <h3 className="text-2xl font-black text-slate-800 mb-8 flex items-center gap-3">
                <Store className="w-8 h-8 text-indigo-600" />
                معلومات المتجر الأساسية
              </h3>
              <form onSubmit={handleSaveStore} className="space-y-8">
                <div className="flex gap-12 items-center">
                  <div className="w-40 h-40 bg-slate-100 rounded-[40px] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-3 group cursor-pointer hover:bg-slate-50 transition-all">
                    <ImageIcon className="w-10 h-10 text-slate-300" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">شعار المتجر</span>
                  </div>
                  <div className="flex-1 grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest">اسم المتجر</label>
                      <div className="relative">
                        <Store className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 w-5 h-5" />
                        <input 
                          type="text" 
                          className="w-full pr-12 pl-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                          value={storeData.name}
                          onChange={e => setStoreData({...storeData, name: e.target.value})}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest">رقم الهاتف</label>
                      <div className="relative">
                        <Phone className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 w-5 h-5" />
                        <input 
                          type="tel" 
                          className="w-full pr-12 pl-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                          value={storeData.phone}
                          onChange={e => setStoreData({...storeData, phone: e.target.value})}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest">البريد الإلكتروني</label>
                    <div className="relative">
                      <Mail className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 w-5 h-5" />
                      <input 
                        type="email" 
                        className="w-full pr-12 pl-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                        value={storeData.email}
                        onChange={e => setStoreData({...storeData, email: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest">العملة</label>
                    <div className="relative">
                      <Globe className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 w-5 h-5" />
                      <select 
                        className="w-full pr-12 pl-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                        value={storeData.currency}
                        onChange={e => setStoreData({...storeData, currency: e.target.value})}
                      >
                        <option value="MAD">درهم مغربي (MAD)</option>
                        <option value="USD">دولار أمريكي (USD)</option>
                        <option value="EUR">يورو (EUR)</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest">العنوان</label>
                  <div className="relative">
                    <MapPin className="absolute right-4 top-4 text-slate-300 w-5 h-5" />
                    <textarea 
                      className="w-full pr-12 pl-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-indigo-500 h-32 resize-none"
                      value={storeData.address}
                      onChange={e => setStoreData({...storeData, address: e.target.value})}
                    />
                  </div>
                </div>

                <div className="pt-8">
                  <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white px-12 py-5 rounded-[32px] font-black flex items-center gap-3 shadow-2xl shadow-indigo-200 transition-all text-xl">
                    <Save className="w-6 h-6" />
                    حفظ التغييرات
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeSection === 'taxes' && (
            <div className="p-12 animate-in fade-in slide-in-from-left-4 duration-300">
              <h3 className="text-2xl font-black text-slate-800 mb-8 flex items-center gap-3">
                <Percent className="w-8 h-8 text-indigo-600" />
                إعدادات الضرائب والرسوم
              </h3>
              <div className="space-y-8">
                <div className="bg-slate-50 p-8 rounded-[40px] border border-slate-100">
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h4 className="font-black text-slate-800">الضريبة على القيمة المضافة (VAT)</h4>
                      <p className="text-slate-400 text-sm font-bold">تطبيق الضريبة تلقائياً على جميع المبيعات</p>
                    </div>
                    <div className="w-12 h-6 bg-slate-200 rounded-full relative cursor-pointer">
                      <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full"></div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest">نسبة الضريبة (%)</label>
                      <input 
                        type="number" 
                        defaultValue="20"
                        className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest">رقم التعريف الضريبي</label>
                      <input 
                        type="text" 
                        placeholder="IF / ICE"
                        className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-8 bg-white border border-slate-200 rounded-[40px] space-y-4">
                  <h4 className="font-black text-slate-800">خيارات إضافية</h4>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                      <span className="font-bold text-slate-600">الأسعار تشمل الضريبة</span>
                      <div className="w-12 h-6 bg-indigo-600 rounded-full relative">
                        <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full"></div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                      <span className="font-bold text-slate-600">إظهار تفاصيل الضريبة في الفاتورة</span>
                      <div className="w-12 h-6 bg-indigo-600 rounded-full relative">
                        <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'printer' && (
            <div className="p-12 animate-in fade-in slide-in-from-left-4 duration-300">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                  <Printer className="w-8 h-8 text-indigo-600" />
                  إعدادات الطابعة والفواتير
                </h3>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                {/* Customization Form */}
                <div className="space-y-8">
                  <div className="bg-slate-50 p-8 rounded-[32px] border border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                      <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-slate-400 shadow-sm">
                        <Smartphone className="w-8 h-8" />
                      </div>
                      <div>
                        <h4 className="font-black text-slate-800">طابعة حرارية (Thermal Printer)</h4>
                        <p className="text-slate-400 text-sm font-bold">توصيل الطابعة عبر البلوتوث أو USB</p>
                      </div>
                    </div>
                    <button className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-black text-sm">توصيل</button>
                  </div>

                  <div className="space-y-6">
                    <h4 className="font-black text-slate-800 border-b border-slate-100 pb-2">تخصيص ترويسة الفاتورة (Header)</h4>
                    
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest">اسم المتجر</label>
                        <input 
                          type="text" 
                          className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                          value={storeData.name}
                          onChange={e => setStoreData({...storeData, name: e.target.value})}
                          placeholder="اسم المتجر"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest">رقم الهاتف</label>
                        <input 
                          type="text" 
                          className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                          value={storeData.phone}
                          onChange={e => setStoreData({...storeData, phone: e.target.value})}
                          placeholder="رقم الهاتف"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest">رابط الشعار (Logo URL)</label>
                        <input 
                          type="text" 
                          className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                          value={storeData.logo}
                          onChange={e => setStoreData({...storeData, logo: e.target.value})}
                          placeholder="رابط الصورة (URL)"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest">العنوان</label>
                        <textarea 
                          className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-indigo-500 resize-none h-24"
                          value={storeData.address}
                          onChange={e => setStoreData({...storeData, address: e.target.value})}
                          placeholder="العنوان"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h4 className="font-black text-slate-800 border-b border-slate-100 pb-2">تخصيص تذييل الفاتورة (Footer)</h4>
                    
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest">رسالة الشكر</label>
                        <input 
                          type="text" 
                          className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                          value={storeData.thankYouMessage}
                          onChange={e => setStoreData({...storeData, thankYouMessage: e.target.value})}
                          placeholder="مثلاً: شكرا لزيارتكم!"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest">ملاحظة التذييل</label>
                        <input 
                          type="text" 
                          className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                          value={storeData.footerNote}
                          onChange={e => setStoreData({...storeData, footerNote: e.target.value})}
                          placeholder="مثلاً: نتمنى رؤيتكم قريبا"
                        />
                      </div>
                    </div>

                    <div className="pt-4">
                      <button 
                        onClick={handleSaveStore}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-black flex items-center justify-center gap-3 shadow-xl shadow-indigo-200 transition-all"
                      >
                        <Save className="w-5 h-5" />
                        حفظ جميع إعدادات الفاتورة
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-black text-slate-800">خيارات العرض</h4>
                    <div className="grid grid-cols-1 gap-4">
                      <div className="flex items-center justify-between p-6 bg-white border border-slate-200 rounded-2xl">
                        <span className="font-bold text-slate-600">عرض شعار المتجر</span>
                        <button 
                          onClick={() => setStoreData({...storeData, showLogo: !storeData.showLogo})}
                          className={cn(
                            "w-12 h-6 rounded-full relative transition-colors",
                            storeData.showLogo ? "bg-indigo-600" : "bg-slate-200"
                          )}
                        >
                          <div className={cn(
                            "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                            storeData.showLogo ? "left-1" : "right-1"
                          )}></div>
                        </button>
                      </div>
                      <div className="flex items-center justify-between p-6 bg-white border border-slate-200 rounded-2xl">
                        <span className="font-bold text-slate-600">طباعة QR Code</span>
                        <div className="w-12 h-6 bg-slate-200 rounded-full relative">
                          <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Live Preview */}
                <div className="space-y-4">
                  <h4 className="font-black text-slate-800 text-center">معاينة الفاتورة (80mm)</h4>
                  <div className="bg-slate-200 p-8 rounded-[40px] flex justify-center overflow-hidden">
                    <div className="bg-white shadow-2xl scale-90 origin-top">
                      <Receipt 
                        businessName={storeData.name}
                        businessAddress={storeData.address}
                        businessPhone={storeData.phone}
                        thankYouMessage={storeData.thankYouMessage}
                        footerNote={storeData.footerNote}
                        logoUrl={storeData.showLogo ? storeData.logo : undefined}
                        sale={{
                          invoiceNumber: 'PREVIEW-001',
                          timestamp: Timestamp.now(),
                          customerName: 'زبون تجريبي',
                          items: [
                            { productId: '1', name: 'منتج تجريبي 1', quantity: 2, price: 50, total: 100, discount: 0, discountType: 'amount', type: 'retail', profit: 10 },
                            { productId: '2', name: 'منتج تجريبي 2', quantity: 1, price: 30, total: 30, discount: 0, discountType: 'amount', type: 'retail', profit: 5 }
                          ] as SaleItem[],
                          total: 130,
                          paymentType: 'cash',
                          paid: 150,
                          change: 20
                        } as any}
                      />
                    </div>
                  </div>
                  <p className="text-center text-xs font-bold text-slate-400 italic">هذه المعاينة توضح كيف ستظهر الفاتورة عند الطباعة</p>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'theme' && (
            <div className="p-12 animate-in fade-in slide-in-from-left-4 duration-300">
              <h3 className="text-2xl font-black text-slate-800 mb-8 flex items-center gap-3">
                <Palette className="w-8 h-8 text-indigo-600" />
                تخصيص المظهر والألوان
              </h3>
              
              <div className="space-y-12">
                {/* Primary Color Selection */}
                <div className="space-y-6">
                  <h4 className="font-black text-slate-800 border-b border-slate-100 pb-2">اللون الأساسي للنظام</h4>
                  <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-4">
                    {[
                      { name: 'Indigo', color: '#4f46e5' },
                      { name: 'Blue', color: '#2563eb' },
                      { name: 'Sky', color: '#0ea5e9' },
                      { name: 'Emerald', color: '#10b981' },
                      { name: 'Green', color: '#22c55e' },
                      { name: 'Amber', color: '#f59e0b' },
                      { name: 'Orange', color: '#f97316' },
                      { name: 'Rose', color: '#f43f5e' },
                      { name: 'Pink', color: '#ec4899' },
                      { name: 'Purple', color: '#a855f7' },
                      { name: 'Violet', color: '#8b5cf6' },
                      { name: 'Slate', color: '#475569' },
                    ].map((theme) => (
                      <button
                        key={theme.color}
                        onClick={() => {
                          setThemeData({ ...themeData, primaryColor: theme.color });
                          document.documentElement.style.setProperty('--primary', theme.color);
                        }}
                        className={cn(
                          "w-full aspect-square rounded-2xl transition-all border-4 relative group",
                          themeData.primaryColor === theme.color ? "border-white ring-4 ring-indigo-500/20 scale-110" : "border-transparent hover:scale-105"
                        )}
                        style={{ backgroundColor: theme.color }}
                        title={theme.name}
                      >
                        {themeData.primaryColor === theme.color && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-2 h-2 bg-white rounded-full shadow-sm"></div>
                          </div>
                        )}
                      </button>
                    ))}
                    <div className="relative group">
                      <input 
                        type="color" 
                        value={themeData.primaryColor}
                        onChange={(e) => {
                          setThemeData({ ...themeData, primaryColor: e.target.value });
                          document.documentElement.style.setProperty('--primary', e.target.value);
                        }}
                        className="w-full aspect-square rounded-2xl cursor-pointer border-4 border-transparent hover:scale-105 transition-all"
                      />
                      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                        <Plus className="w-5 h-5 text-white mix-blend-difference" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Border Radius Selection */}
                <div className="space-y-6">
                  <h4 className="font-black text-slate-800 border-b border-slate-100 pb-2">نمط الحواف (Border Radius)</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    {[
                      { id: 'sharp', label: 'حواف حادة', value: '0px' },
                      { id: 'soft', label: 'حواف ناعمة', value: '0.75rem' },
                      { id: 'rounded', label: 'حواف دائرية', value: '1.5rem' },
                    ].map((radius) => (
                      <button
                        key={radius.id}
                        onClick={() => {
                          setThemeData({ ...themeData, borderRadius: radius.value });
                          document.documentElement.style.setProperty('--radius', radius.value);
                        }}
                        className={cn(
                          "p-6 border-2 transition-all text-right group",
                          themeData.borderRadius === radius.value 
                            ? "border-indigo-600 bg-indigo-50" 
                            : "border-slate-100 hover:border-slate-200"
                        )}
                        style={{ borderRadius: radius.value }}
                      >
                        <div className="font-black text-slate-800 mb-1">{radius.label}</div>
                        <div className="text-xs font-bold text-slate-400">{radius.value}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Layout Density */}
                <div className="space-y-6">
                  <h4 className="font-black text-slate-800 border-b border-slate-100 pb-2">كثافة العرض (Layout Density)</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {[
                      { id: 'compact', label: 'مضغوط (Compact)', desc: 'عرض المزيد من البيانات في مساحة أقل' },
                      { id: 'comfortable', label: 'مريح (Comfortable)', desc: 'مساحات واسعة لتجربة مستخدم أفضل' },
                    ].map((density) => (
                      <button
                        key={density.id}
                        onClick={() => setThemeData({ ...themeData, layoutDensity: density.id as any })}
                        className={cn(
                          "p-6 rounded-[24px] border-2 transition-all text-right flex items-center justify-between",
                          themeData.layoutDensity === density.id 
                            ? "border-indigo-600 bg-indigo-50" 
                            : "border-slate-100 hover:border-slate-200"
                        )}
                      >
                        <div>
                          <div className="font-black text-slate-800 mb-1">{density.label}</div>
                          <div className="text-xs font-bold text-slate-400">{density.desc}</div>
                        </div>
                        <Layout className={cn("w-6 h-6", themeData.layoutDensity === density.id ? "text-indigo-600" : "text-slate-300")} />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-8">
                  <button 
                    onClick={handleSaveStore}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-12 py-5 rounded-[32px] font-black flex items-center gap-3 shadow-2xl shadow-indigo-200 transition-all text-xl"
                  >
                    <Save className="w-6 h-6" />
                    حفظ إعدادات المظهر
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'backup' && (
            <div className="p-12 animate-in fade-in slide-in-from-left-4 duration-300">
              <h3 className="text-2xl font-black text-slate-800 mb-8 flex items-center gap-3">
                <Database className="w-8 h-8 text-indigo-600" />
                النسخ الاحتياطي والبيانات
              </h3>
              <div className="grid grid-cols-2 gap-8">
                <div className="p-8 bg-indigo-50 rounded-[40px] border border-indigo-100 space-y-4 text-center">
                  <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center text-indigo-600 mx-auto shadow-sm">
                    <Download className="w-10 h-10" />
                  </div>
                  <h4 className="text-xl font-black text-indigo-800">تصدير البيانات</h4>
                  <p className="text-indigo-600/60 text-sm font-bold">تحميل نسخة كاملة من قاعدة البيانات بصيغة DBA</p>
                  <button 
                    onClick={handleExport}
                    disabled={isExporting}
                    className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-lg shadow-indigo-200 disabled:opacity-50 transition-all active:scale-95"
                  >
                    {isExporting ? 'جاري التصدير...' : 'تصدير الآن'}
                  </button>
                </div>
                <div className="p-8 bg-emerald-50 rounded-[40px] border border-emerald-100 space-y-4 text-center">
                  <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center text-emerald-600 mx-auto shadow-sm">
                    <Upload className="w-10 h-10" />
                  </div>
                  <h4 className="text-xl font-black text-emerald-800">استيراد البيانات</h4>
                  <p className="text-emerald-600/60 text-sm font-bold">رفع نسخة احتياطية سابقة لاستعادتها</p>
                  <label className={cn(
                    "w-full bg-emerald-600 text-white py-4 rounded-2xl font-black shadow-lg shadow-emerald-200 cursor-pointer text-center block transition-all active:scale-95",
                    isImporting && "opacity-50 cursor-not-allowed"
                  )}>
                    {isImporting ? 'جاري الاستيراد...' : 'استيراد الآن'}
                    <input 
                      type="file" 
                      accept=".dba,.json" 
                      className="hidden" 
                      onChange={handleImport}
                      disabled={isImporting}
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'notifications' && (
            <div className="p-12 animate-in fade-in slide-in-from-left-4 duration-300">
              <h3 className="text-2xl font-black text-slate-800 mb-8 flex items-center gap-3">
                <Bell className="w-8 h-8 text-indigo-600" />
                إعدادات التنبيهات
              </h3>
              <div className="space-y-8">
                <div className="bg-slate-50 p-8 rounded-[40px] border border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <div className={cn(
                      "w-16 h-16 rounded-2xl flex items-center justify-center shadow-sm",
                      notificationPermission === 'granted' ? "bg-emerald-100 text-emerald-600" : "bg-white text-slate-400"
                    )}>
                      <Bell className="w-8 h-8" />
                    </div>
                    <div>
                      <h4 className="font-black text-slate-800">تنبيهات المتصفح (Push Notifications)</h4>
                      <p className="text-slate-400 text-sm font-bold">
                        {notificationPermission === 'granted' 
                          ? 'التنبيهات مفعلة بنجاح' 
                          : notificationPermission === 'denied' 
                            ? 'التنبيهات محظورة من قبل المتصفح' 
                            : 'تفعيل التنبيهات لتلقي إشعارات المخزون المنخفض'}
                      </p>
                    </div>
                  </div>
                  {notificationPermission !== 'granted' && (
                    <button 
                      onClick={requestPermission}
                      className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-black text-sm hover:bg-indigo-700 transition-all"
                    >
                      تفعيل الآن
                    </button>
                  )}
                </div>

                <div className="space-y-4">
                  <h4 className="font-black text-slate-800">تخصيص التنبيهات</h4>
                  <div className="grid grid-cols-1 gap-4">
                    <div className="flex items-center justify-between p-6 bg-white border border-slate-200 rounded-2xl">
                      <div className="space-y-1">
                        <span className="font-bold text-slate-800 block">تنبيهات المخزون المنخفض</span>
                        <span className="text-xs text-slate-400 font-bold">تلقي إشعار عندما يقل مخزون منتج عن الحد الأدنى</span>
                      </div>
                      <div className="w-12 h-6 bg-indigo-600 rounded-full relative">
                        <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'database' && (
            <div className="p-12 animate-in fade-in slide-in-from-left-4 duration-300">
              <h3 className="text-2xl font-black text-slate-800 mb-8 flex items-center gap-3">
                <Database className="w-8 h-8 text-indigo-600" />
                إعدادات Supabase
              </h3>
              
              <div className="space-y-8">
                <div className="bg-amber-50 border border-amber-200 p-6 rounded-3xl text-amber-800 text-sm font-bold">
                  تنبيه: تفعيل Supabase سيقوم بتحويل نظام تخزين البيانات من Firebase إلى Supabase. تأكد من إعداد الجداول المطلوبة في مشروعك على Supabase.
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Supabase Project URL</label>
                    <input 
                      type="text" 
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                      value={supabaseConfig.url}
                      onChange={e => setSupabaseConfig({...supabaseConfig, url: e.target.value})}
                      placeholder="https://your-project.supabase.co"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Supabase Anon Key</label>
                    <input 
                      type="password" 
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                      value={supabaseConfig.anonKey}
                      onChange={e => setSupabaseConfig({...supabaseConfig, anonKey: e.target.value})}
                      placeholder="your-anon-key"
                    />
                  </div>

                  <div className="flex items-center justify-between p-6 bg-white border border-slate-200 rounded-2xl">
                    <div className="space-y-1">
                      <span className="font-bold text-slate-800 block">تفعيل Supabase</span>
                      <span className="text-xs text-slate-400 font-bold">استخدام Supabase كقاعدة بيانات أساسية بدلاً من Firebase</span>
                    </div>
                    <button 
                      onClick={() => setSupabaseConfig({...supabaseConfig, isActive: !supabaseConfig.isActive})}
                      className={cn(
                        "w-12 h-6 rounded-full relative transition-colors",
                        supabaseConfig.isActive ? "bg-indigo-600" : "bg-slate-200"
                      )}
                    >
                      <div className={cn(
                        "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                        supabaseConfig.isActive ? "left-1" : "right-1"
                      )}></div>
                    </button>
                  </div>

                  <div className="flex flex-col gap-4 pt-4">
                    <button 
                      onClick={handleTestSupabase}
                      disabled={isTestingSupabase}
                      className="w-full bg-slate-800 hover:bg-slate-900 text-white py-5 rounded-3xl font-black flex items-center justify-center gap-3 shadow-xl shadow-slate-200 transition-all text-xl disabled:opacity-50"
                    >
                      {isTestingSupabase ? (
                        <>
                          <Loader2 className="w-6 h-6 animate-spin" />
                          جاري التحقق...
                        </>
                      ) : (
                        <>
                          <Globe className="w-6 h-6" />
                          اختبار الاتصال بـ Supabase
                        </>
                      )}
                    </button>

                    <button 
                      onClick={handleFullSync}
                      disabled={isSyncing || !supabaseConfig.isActive}
                      className="w-full bg-amber-500 hover:bg-amber-600 text-white py-5 rounded-3xl font-black flex items-center justify-center gap-3 shadow-xl shadow-amber-200 transition-all text-xl disabled:opacity-50"
                    >
                      {isSyncing ? (
                        <>
                          <Loader2 className="w-6 h-6 animate-spin" />
                          جاري المزامنة ({syncProgress}%)...
                        </>
                      ) : (
                        <>
                          <ArrowRightLeft className="w-6 h-6" />
                          مزامنة جميع البيانات الآن
                        </>
                      )}
                    </button>

                    <button 
                      onClick={async () => {
                        try {
                          await setDoc(doc(db, 'settings', 'database'), {
                            ...supabaseConfig,
                            updatedAt: serverTimestamp()
                          });
                          // Update the global client so other components use the new config
                          updateSupabaseClient(supabaseConfig.url, supabaseConfig.anonKey);
                          toast.success('تم حفظ إعدادات قاعدة البيانات بنجاح');
                        } catch (error) {
                          toast.error('فشل حفظ الإعدادات');
                        }
                      }}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-5 rounded-3xl font-black flex items-center justify-center gap-3 shadow-xl shadow-indigo-200 transition-all text-xl"
                    >
                      <Save className="w-6 h-6" />
                      حفظ الإعدادات
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'account' && (
            <div className="p-12 animate-in fade-in slide-in-from-left-4 duration-300">
              {!isSecurityUnlocked ? (
                <div className="max-w-md mx-auto bg-white p-10 rounded-[40px] shadow-xl border border-slate-100 text-center space-y-8">
                  <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center mx-auto">
                    <Shield className="w-10 h-10 text-indigo-600" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-2xl font-black text-slate-800">قسم محمي</h3>
                    <p className="text-slate-500 font-bold">يرجى إدخال كلمة مرور المسؤول للوصول إلى إعدادات الحماية</p>
                  </div>
                  <form onSubmit={handleUnlockSecurity} className="space-y-4">
                    <input 
                      type="password"
                      placeholder="كلمة مرور المسؤول"
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-indigo-500 text-center"
                      value={securityCode}
                      onChange={e => setSecurityCode(e.target.value)}
                      autoFocus
                    />
                    <button 
                      type="submit"
                      className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all"
                    >
                      فتح القسم
                    </button>
                  </form>
                  <button 
                    onClick={() => setShowRecovery(true)}
                    className="text-indigo-600 font-black text-sm hover:underline"
                  >
                    نسيت كلمة المرور؟ استرجاع عبر الهاتف
                  </button>
                </div>
              ) : (
                <>
                  <h3 className="text-2xl font-black text-slate-800 mb-8 flex items-center gap-3">
                    <Shield className="w-8 h-8 text-indigo-600" />
                    الحساب والأمان
                  </h3>
                  <div className="space-y-8">
                    <div className="flex items-center gap-6 p-8 bg-slate-50 rounded-[40px] border border-slate-100">
                      <div className="w-24 h-24 bg-white rounded-[32px] flex items-center justify-center text-slate-200 shadow-sm overflow-hidden">
                        {auth.currentUser?.photoURL ? (
                          <img src={auth.currentUser.photoURL} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <User className="w-12 h-12" />
                        )}
                      </div>
                      <div className="flex-1">
                        <h4 className="text-xl font-black text-slate-800">{auth.currentUser?.displayName || 'المسؤول'}</h4>
                        <p className="text-slate-400 font-bold">{auth.currentUser?.email}</p>
                        <div className="mt-2 inline-block px-3 py-1 bg-indigo-600 text-white text-[10px] font-black rounded-lg uppercase tracking-widest">Admin</div>
                      </div>
                      <button className="bg-white border border-slate-200 text-slate-600 px-6 py-2 rounded-xl font-black text-sm">تعديل الملف</button>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-black text-slate-800">إدارة المستخدمين</h4>
                        <button 
                          onClick={() => {
                            setEditingUser({ role: 'employee' });
                            setIsUserModalOpen(true);
                          }}
                          className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-black text-xs flex items-center gap-2"
                        >
                          <Plus className="w-4 h-4" />
                          إضافة مستخدم
                        </button>
                      </div>
                      <div className="bg-white border border-slate-200 rounded-[32px] overflow-hidden">
                        <div className="divide-y divide-slate-100">
                          {users.map((u) => (
                            <div key={u.id} className="p-6 flex justify-between items-center hover:bg-slate-50 transition-colors">
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400">
                                  <User className="w-5 h-5" />
                                </div>
                                <div>
                                  <div className="font-bold text-slate-800">{u.name}</div>
                                  <div className="text-[10px] text-slate-400 font-bold">اسم المستخدم: {u.username}</div>
                                  <div className="text-[10px] text-slate-300 font-black">كلمة المرور: ••••••••</div>
                                  {u.phone && <div className="text-[10px] text-emerald-600 font-black">الهاتف: {u.phone}</div>}
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className={cn(
                                  "px-3 py-1 text-[10px] font-black rounded-lg uppercase tracking-widest",
                                  u.role === 'admin' ? "bg-indigo-100 text-indigo-600" : "bg-slate-100 text-slate-500"
                                )}>
                                  {u.role === 'admin' ? 'مسؤول' : 'بائع'}
                                </span>
                                <button 
                                  onClick={() => {
                                    setEditingUser(u);
                                    setIsUserModalOpen(true);
                                  }}
                                  className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={() => setUserToDelete(u.id || null)}
                                  className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                          {users.length === 0 && (
                            <div className="p-12 text-center text-slate-400 font-bold">لا يوجد مستخدمين مضافين بعد</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Import Confirmation Modal */}
      {showImportConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-[40px] w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-8 text-center space-y-6">
              <div className="w-20 h-20 bg-amber-50 rounded-3xl flex items-center justify-center mx-auto">
                <Database className="w-10 h-10 text-amber-600" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-slate-800">استيراد البيانات؟</h3>
                <p className="text-slate-500 font-bold">هل أنت متأكد من استيراد البيانات؟ قد يؤدي ذلك إلى الكتابة فوق البيانات الحالية.</p>
              </div>
              <div className="flex gap-4">
                <button 
                  onClick={() => {
                    setShowImportConfirm(false);
                    setPendingImportFile(null);
                  }}
                  className="flex-1 px-6 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black hover:bg-slate-200 transition-all"
                >
                  إلغاء
                </button>
                <button 
                  onClick={confirmImportData}
                  className="flex-1 px-6 py-4 bg-amber-600 text-white rounded-2xl font-black shadow-xl shadow-amber-200 hover:bg-amber-700 transition-all"
                >
                  استيراد
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {userToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-[40px] w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-8 text-center space-y-6">
              <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center mx-auto">
                <Trash2 className="w-10 h-10 text-red-600" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-slate-800">حذف المستخدم؟</h3>
                <p className="text-slate-500 font-bold">هل أنت متأكد من حذف هذا المستخدم؟ لا يمكن التراجع عن هذا الإجراء.</p>
              </div>
              <div className="flex gap-4">
                <button 
                  onClick={() => setUserToDelete(null)}
                  className="flex-1 px-6 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black hover:bg-slate-200 transition-all"
                >
                  إلغاء
                </button>
                <button 
                  onClick={() => handleDeleteUser(userToDelete)}
                  className="flex-1 px-6 py-4 bg-red-600 text-white rounded-2xl font-black shadow-xl shadow-red-200 hover:bg-red-700 transition-all"
                >
                  حذف
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recovery Modal */}
      {showRecovery && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-[40px] w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-xl font-black text-slate-800">استرجاع كلمة المرور</h3>
              <button onClick={() => {
                setShowRecovery(false);
                setRecoveredPass(null);
                setRecoveryPhone('');
              }} className="p-2 hover:bg-white rounded-full transition-colors">
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>
            <div className="p-8 space-y-6">
              {!recoveredPass ? (
                <form onSubmit={handleRecoverSecurity} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest">رقم الهاتف المسجل</label>
                    <input 
                      type="tel"
                      required
                      placeholder="06XXXXXXXX"
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                      value={recoveryPhone}
                      onChange={e => setRecoveryPhone(e.target.value)}
                    />
                  </div>
                  <button 
                    type="submit"
                    className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all"
                  >
                    تحقق واسترجاع
                  </button>
                </form>
              ) : (
                <div className="text-center space-y-6">
                  <div className="w-20 h-20 bg-green-50 rounded-3xl flex items-center justify-center mx-auto">
                    <Shield className="w-10 h-10 text-green-600" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-slate-500 font-bold">كلمة المرور الخاصة بك هي:</p>
                    <div className="bg-slate-50 p-6 rounded-2xl border-2 border-dashed border-slate-200">
                      <span className="text-3xl font-black text-indigo-600 tracking-wider">{recoveredPass}</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      setShowRecovery(false);
                      setRecoveredPass(null);
                      setRecoveryPhone('');
                    }}
                    className="w-full bg-slate-800 text-white py-4 rounded-2xl font-black hover:bg-slate-900 transition-all"
                  >
                    فهمت، إغلاق
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* User Modal */}
      {isUserModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-[40px] w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-xl font-black text-slate-800">
                {editingUser?.id ? 'تعديل مستخدم' : 'إضافة مستخدم جديد'}
              </h3>
              <button onClick={() => setIsUserModalOpen(false)} className="p-2 hover:bg-white rounded-full transition-colors">
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleSaveUser} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">الاسم الكامل</label>
                <input 
                  type="text"
                  required
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                  value={editingUser?.name || ''}
                  onChange={e => setEditingUser({...editingUser, name: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">اسم المستخدم</label>
                <input 
                  type="text"
                  required
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                  value={editingUser?.username || ''}
                  onChange={e => setEditingUser({...editingUser, username: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">كلمة المرور</label>
                <div className="relative">
                  <input 
                    type={showUserPassword ? "text" : "password"}
                    required
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                    value={editingUser?.password || ''}
                    onChange={e => setEditingUser({...editingUser, password: e.target.value})}
                  />
                  <button
                    type="button"
                    onClick={() => setShowUserPassword(!showUserPassword)}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition-colors"
                  >
                    {showUserPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">رقم الهاتف (للاسترجاع)</label>
                <input 
                  type="tel"
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                  value={editingUser?.phone || ''}
                  onChange={e => setEditingUser({...editingUser, phone: e.target.value})}
                  placeholder="06XXXXXXXX"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">الدور</label>
                <select 
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                  value={editingUser?.role || 'employee'}
                  onChange={e => setEditingUser({...editingUser, role: e.target.value as any})}
                >
                  <option value="employee">بائع (Employee)</option>
                  <option value="admin">مسؤول (Admin)</option>
                </select>
              </div>
              <div className="pt-4">
                <button 
                  type="submit"
                  className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all"
                >
                  حفظ المستخدم
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
