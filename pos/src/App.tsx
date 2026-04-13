import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, User, signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from './firebase';
import POS from './components/POS';
import Inventory from './components/Inventory';
import Customers from './components/Customers';
import Queries from './components/Queries';
import Suppliers from './components/Suppliers';
import Expenses from './components/Expenses';
import Box from './components/Box';
import SalesHistory from './components/SalesHistory';
import Settings from './components/Settings';
import AdvancedProcessing from './components/AdvancedProcessing';
import Sidebar from './components/Sidebar';
import { 
  LogIn, 
  Loader2, 
  Boxes, 
  Store, 
  Users2, 
  TrendingUp, 
  Truck, 
  Banknote, 
  Vault, 
  Settings2,
  Menu,
  X,
  Home as HomeIcon,
  Package,
  FileText,
  Wrench,
  ArrowRight,
  User as UserIcon,
  Lock,
  Phone,
  AlertCircle,
  Eye,
  EyeOff,
  Download
} from 'lucide-react';
import { cn, hashPassword } from './lib/utils';
import { NotificationProvider } from './contexts/NotificationContext';
import NotificationBell from './components/NotificationBell';
import { Toaster, toast } from 'sonner';
import { collection, query, where, getDocs, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { UserAccount } from './types';
import { backupService } from './services/backupService';

type Tab = 'home' | 'pos' | 'inventory' | 'customers' | 'reports' | 'suppliers' | 'expenses' | 'box' | 'sales_history' | 'settings' | 'advanced';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [loginMode, setLoginMode] = useState<'google' | 'custom'>('custom');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showForgotPass, setShowForgotPass] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [recoveryPhone, setRecoveryPhone] = useState('');
  const [recoveredPass, setRecoveredPass] = useState<string | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    }
  };

  useEffect(() => {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    });

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
          role: 'admin' // Google login is always admin for now
        });
      } else {
        const savedUser = localStorage.getItem('pos_user');
        if (savedUser) {
          setUser(JSON.parse(savedUser));
        } else {
          setUser(null);
        }
      }
      setLoading(false);
    });

    const unsubTheme = onSnapshot(doc(db, 'settings', 'theme'), (doc) => {
      if (doc.exists()) {
        const data = doc.data() as any;
        document.documentElement.style.setProperty('--primary', data.primaryColor);
        document.documentElement.style.setProperty('--radius', data.borderRadius);
      }
    });

    const performAutoBackup = async () => {
      try {
        const shouldBackup = await backupService.shouldPerformAutoBackup();
        if (shouldBackup) {
          console.log('Performing automatic backup...');
          await backupService.createBackup();
          console.log('Automatic backup completed.');
        }
      } catch (err) {
        console.error('Auto backup check failed:', err);
      }
    };
    
    if (user && user.role === 'admin') {
      performAutoBackup();
    }

    return () => {
      unsubscribe();
      unsubTheme();
    };
  }, []);

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed", error);
      toast.error('فشل تسجيل الدخول عبر جوجل');
    }
  };

  const handleCustomLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    const trimmedUsername = username.trim();
    const trimmedPassword = password.trim();
    
    try {
      const hashedPassword = await hashPassword(trimmedPassword);
      // Find user by username and password
      const q = query(
        collection(db, 'users'), 
        where('username', '==', trimmedUsername),
        where('password', '==', hashedPassword)
      );
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        const userData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as UserAccount;
        const email = `${trimmedUsername}@al-arousi.com`; // Internal mapping
        
        try {
          await signInWithEmailAndPassword(auth, email, hashedPassword);
          toast.success(`مرحباً بك ${userData.name}`);
        } catch (authError: any) {
          console.error("Auth failed", authError);
          if (authError.code === 'auth/user-not-found' || authError.code === 'auth/wrong-password' || authError.code === 'auth/invalid-credential') {
            toast.error('اسم المستخدم أو كلمة المرور غير صحيحة');
          } else {
            toast.error('حدث خطأ أثناء تسجيل الدخول');
          }
        }
      } else {
        toast.error('اسم المستخدم أو كلمة المرور غير صحيحة');
      }
    } catch (error) {
      console.error("Custom login failed", error);
      toast.error('حدث خطأ أثناء تسجيل الدخول');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleRecoverPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const q = query(collection(db, 'users'), where('role', '==', 'admin'), where('phone', '==', recoveryPhone.trim()));
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        setRecoveredPass('تم إرسال كلمة المرور لرقم هاتفك');
      } else {
        toast.error('لم يتم العثور على مسؤول بهذا الرقم');
      }
    } catch (error) {
      toast.error('فشل استرجاع البيانات');
    }
  };

  const handleLogout = () => {
    auth.signOut();
    localStorage.removeItem('pos_user');
    setUser(null);
    setActiveTab('home');
  };

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
          <p className="text-slate-500 font-bold">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-900 overflow-hidden relative" dir="rtl">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500 rounded-full blur-[120px]"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500 rounded-full blur-[120px]"></div>
        </div>

        <div className="bg-white/10 backdrop-blur-2xl p-10 rounded-[50px] border border-white/20 shadow-2xl w-full max-w-md text-center relative z-10 animate-in fade-in zoom-in duration-500">
          {deferredPrompt && (
            <button
              onClick={handleInstallApp}
              className="absolute top-4 left-4 bg-white/20 hover:bg-white/30 text-white p-2 rounded-xl transition-colors flex items-center gap-2 text-sm font-bold"
              title="تثبيت التطبيق"
            >
              <Download className="w-4 h-4" />
              تثبيت
            </button>
          )}
          <div className="bg-primary w-20 h-20 rounded-custom flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-primary/30 transform -rotate-6">
            <Package className="w-10 h-10 text-primary-foreground" />
          </div>
          <h1 className="text-4xl font-black text-white mb-2 tracking-tight">العروسي شوب</h1>
          <p className="text-primary/60 font-bold mb-8 text-sm">نظام تسيير المبيعات والمخزون</p>
          
          <div className="flex bg-white/5 p-1 rounded-2xl mb-8">
            <button 
              onClick={() => setLoginMode('custom')}
              className={cn(
                "flex-1 py-3 rounded-xl font-black text-sm transition-all",
                loginMode === 'custom' ? "bg-white text-slate-900 shadow-lg" : "text-white/60 hover:text-white"
              )}
            >
              اسم المستخدم
            </button>
            <button 
              onClick={() => setLoginMode('google')}
              className={cn(
                "flex-1 py-3 rounded-xl font-black text-sm transition-all",
                loginMode === 'google' ? "bg-white text-slate-900 shadow-lg" : "text-white/60 hover:text-white"
              )}
            >
              حساب جوجل
            </button>
          </div>

          {loginMode === 'custom' ? (
            <form onSubmit={handleCustomLogin} className="space-y-4">
              <div className="relative">
                <UserIcon className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input 
                  type="text"
                  placeholder="اسم المستخدم"
                  required
                  className="w-full bg-white/10 border border-white/10 rounded-custom py-4 pr-14 pl-6 text-white font-bold outline-none focus:ring-2 focus:ring-primary transition-all"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                />
              </div>
              <div className="relative">
                <Lock className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input 
                  type={showPassword ? "text" : "password"}
                  placeholder="كلمة المرور"
                  required
                  className="w-full bg-white/10 border border-white/10 rounded-custom py-4 pr-14 pl-14 text-white font-bold outline-none focus:ring-2 focus:ring-primary transition-all"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full bg-primary text-primary-foreground font-black py-4 rounded-custom shadow-xl hover:opacity-90 transition-all flex items-center justify-center gap-3 text-lg disabled:opacity-50"
              >
                {isLoggingIn ? <Loader2 className="w-6 h-6 animate-spin" /> : <LogIn className="w-6 h-6" />}
                دخول
              </button>
              <button 
                type="button"
                onClick={() => setShowForgotPass(true)}
                className="text-primary/80 text-xs font-bold hover:underline"
              >
                نسيت كلمة المرور؟ (للمسؤول فقط)
              </button>
            </form>
          ) : (
            <button
              onClick={handleGoogleLogin}
              className="w-full bg-white text-slate-900 font-black py-5 rounded-custom shadow-2xl hover:bg-primary/5 transition-all flex items-center justify-center gap-4 text-lg group active:scale-95"
            >
              <LogIn className="w-6 h-6 text-primary group-hover:scale-110 transition-transform" />
              تسجيل الدخول عبر جوجل
            </button>
          )}
        </div>

        {/* Forgot Password Modal */}
        {showForgotPass && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-custom w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="text-xl font-black text-slate-800">استرجاع كلمة المرور</h3>
                <button onClick={() => { setShowForgotPass(false); setRecoveredPass(null); }} className="p-2 hover:bg-white rounded-full transition-colors">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>
              <div className="p-8 space-y-6">
                {!recoveredPass ? (
                  <form onSubmit={handleRecoverPassword} className="space-y-4">
                    <p className="text-slate-500 text-sm font-bold">أدخل رقم الهاتف المسجل للمسؤول لاسترجاع كلمة المرور.</p>
                    <div className="relative">
                      <Phone className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input 
                        type="tel"
                        placeholder="رقم الهاتف"
                        required
                        className="w-full bg-slate-50 border border-slate-200 rounded-custom py-4 pr-14 pl-6 text-slate-900 font-bold outline-none focus:ring-2 focus:ring-primary transition-all"
                        value={recoveryPhone}
                        onChange={e => setRecoveryPhone(e.target.value)}
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full bg-primary text-primary-foreground font-black py-4 rounded-custom shadow-xl hover:opacity-90 transition-all"
                    >
                      تحقق من الرقم
                    </button>
                  </form>
                ) : (
                  <div className="text-center space-y-4">
                    <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                      <Lock className="w-8 h-8" />
                    </div>
                    <div>
                      <div className="text-xl font-black text-slate-800">{recoveredPass}</div>
                    </div>
                    <button
                      onClick={() => { setShowForgotPass(false); setRecoveredPass(null); }}
                      className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl"
                    >
                      فهمت، إغلاق
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const handleLogoutAction = () => {
    handleLogout();
  };

  const menuItems = [
    { id: 'pos', label: 'المبيعات', icon: Store, color: 'bg-indigo-500' },
    { id: 'inventory', label: 'المخزون', icon: Boxes, color: 'bg-orange-500' },
    { id: 'customers', label: 'العملاء', icon: Users2, color: 'bg-emerald-500' },
    { id: 'suppliers', label: 'الموردين', icon: Truck, color: 'bg-indigo-500' },
    { id: 'expenses', label: 'المصروفات', icon: Banknote, color: 'bg-amber-500' },
    { id: 'box', label: 'الصندوق', icon: Vault, color: 'bg-rose-500' },
    { id: 'sales_history', label: 'تتبع المبيعات', icon: FileText, color: 'bg-blue-500' },
    { id: 'advanced', label: 'معالجات متقدمة', icon: Wrench, color: 'bg-slate-800', adminOnly: true },
    { id: 'reports', label: 'الاستعلامات', icon: TrendingUp, color: 'bg-cyan-500', adminOnly: true },
    { id: 'settings', label: 'الإعدادات', icon: Settings2, color: 'bg-slate-500', adminOnly: true },
  ];

  const filteredMenuItems = menuItems.filter(item => !item.adminOnly || user.role === 'admin');

  return (
    <NotificationProvider>
      <Toaster position="top-center" richColors />
      <div className="flex h-screen bg-slate-100 overflow-hidden" dir="rtl">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
        menuItems={filteredMenuItems}
        onLogout={handleLogoutAction}
      />
      {/* Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-slate-900 text-white h-20 flex items-center justify-between px-10 shadow-2xl z-30 border-b border-slate-800">
          <div className="flex items-center gap-6">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-3 hover:bg-white/10 rounded-2xl lg:hidden"
            >
              <Menu className="w-7 h-7" />
            </button>
            {activeTab !== 'home' && (
              <button 
                onClick={() => setActiveTab('home')}
                className="p-3 bg-white/10 hover:bg-white/20 rounded-2xl flex items-center gap-2 transition-all active:scale-95 group"
              >
                <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                <span className="font-black text-lg">رجوع</span>
              </button>
            )}
            <div className="flex items-center gap-4">
              <div className="bg-primary p-2.5 rounded-custom shadow-lg shadow-primary/20">
                <Package className="w-7 h-7" />
              </div>
              <span className="text-2xl font-black tracking-tight">العروسي شوب</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {deferredPrompt && (
              <button
                onClick={handleInstallApp}
                className="hidden sm:flex items-center gap-2 bg-primary/20 text-primary hover:bg-primary/30 px-4 py-2 rounded-xl font-bold transition-colors"
                title="تثبيت التطبيق على الجهاز"
              >
                <Download className="w-5 h-5" />
                <span>تثبيت التطبيق</span>
              </button>
            )}
            <NotificationBell onNavigate={(tab) => setActiveTab(tab)} />
            {activeTab !== 'home' && (
              <button 
                onClick={() => setActiveTab('home')}
                className="p-2 hover:bg-white/10 rounded-lg flex items-center gap-2"
              >
                <HomeIcon className="w-5 h-5" />
                <span className="hidden sm:inline font-bold">الرئيسية</span>
              </button>
            )}
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center border border-white/30">
              <span className="font-bold">{user.displayName?.charAt(0)}</span>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden relative">
          {activeTab === 'home' && (
            <div className="h-full p-8 overflow-y-auto">
              <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {menuItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id as Tab)}
                    className="bg-white p-8 rounded-custom shadow-sm border border-slate-200 hover:shadow-xl hover:scale-105 transition-all flex flex-col items-center gap-4 group"
                  >
                    <div className={cn("p-4 rounded-custom text-white shadow-lg", item.color)}>
                      <item.icon className="w-8 h-8" />
                    </div>
                    <span className="text-lg font-black text-slate-700 group-hover:text-primary">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className={cn("h-full w-full", activeTab === 'home' ? "hidden" : "block")}>
            {activeTab === 'pos' && <POS onBack={() => setActiveTab('home')} />}
            {activeTab === 'inventory' && <Inventory onBack={() => setActiveTab('home')} />}
            {activeTab === 'customers' && <Customers />}
            {activeTab === 'reports' && <Queries />}
            {activeTab === 'suppliers' && <Suppliers />}
            {activeTab === 'expenses' && <Expenses />}
            {activeTab === 'box' && <Box />}
            {activeTab === 'sales_history' && <SalesHistory />}
            {activeTab === 'advanced' && <AdvancedProcessing />}
            {activeTab === 'settings' && <Settings />}
          </div>
        </div>
      </div>
    </div>
  </NotificationProvider>
  );
}
