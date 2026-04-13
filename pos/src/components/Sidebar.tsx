import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronRight, 
  Package, 
  X, 
  Home, 
  LogOut 
} from 'lucide-react';
import { cn } from '../lib/utils';
import { auth } from '../firebase';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: any) => void;
  isOpen: boolean;
  onClose: () => void;
  menuItems: any[];
  onLogout: () => void;
}

export default function Sidebar({ activeTab, setActiveTab, isOpen, onClose, menuItems, onLogout }: SidebarProps) {
  const renderItem = (item: any) => (
    <motion.button
      key={item.id}
      whileHover={{ x: -4, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      onClick={() => {
        setActiveTab(item.id);
        onClose();
      }}
      className={cn(
        "w-full flex items-center gap-4 px-4 py-3.5 rounded-custom transition-all font-bold text-sm group relative overflow-hidden",
        activeTab === item.id 
          ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" 
          : "text-slate-400 hover:bg-slate-800 hover:text-white"
      )}
    >
      {activeTab === item.id && (
        <motion.div
          layoutId="activeTab"
          className="absolute inset-0 bg-primary"
          transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
        />
      )}
      <div className="relative z-10 flex items-center gap-4 w-full">
        <motion.div
          whileHover={{ rotate: [0, -10, 10, -10, 0] }}
          transition={{ duration: 0.5 }}
        >
          <item.icon className={cn(
            "w-5 h-5 transition-colors",
            activeTab === item.id ? "text-white" : "text-slate-500 group-hover:text-white"
          )} />
        </motion.div>
        <span className="flex-1 text-right">{item.label}</span>
        {activeTab === item.id && (
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <ChevronRight className="w-4 h-4 rotate-180" />
          </motion.div>
        )}
      </div>
    </motion.button>
  );

  const savedUser = localStorage.getItem('pos_user');
  const customUser = savedUser ? JSON.parse(savedUser) : null;
  const currentUser = auth.currentUser || customUser;

  return (
    <>
      {/* Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden"
            onClick={onClose}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={cn(
        "fixed lg:static inset-y-0 right-0 w-72 bg-slate-900 text-white z-50 transition-transform duration-300 transform flex flex-col",
        isOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"
      )} dir="rtl">
        <div className="p-8 flex items-center justify-between">
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3"
          >
            <motion.div 
              whileHover={{ scale: 1.1, rotate: 360 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              className="bg-primary p-2.5 rounded-custom shadow-lg shadow-primary/20"
            >
              <Package className="w-6 h-6" />
            </motion.div>
            <h1 className="text-2xl font-black tracking-tight">العروسي شوب</h1>
          </motion.div>
          <button onClick={onClose} className="lg:hidden p-2 hover:bg-slate-800 rounded-lg">
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-6 overflow-y-auto custom-scrollbar">
          <div className="space-y-1">
            {renderItem({ id: 'home', label: 'الرئيسية', icon: Home })}
            {menuItems.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                {renderItem(item)}
              </motion.div>
            ))}
          </div>
        </nav>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-6 border-t border-slate-800"
        >
          <motion.div 
            whileHover={{ scale: 1.02 }}
            className="bg-slate-800/50 p-4 rounded-custom flex items-center gap-4 mb-4"
          >
            <motion.div 
              whileHover={{ scale: 1.1 }}
              className="w-10 h-10 rounded-custom bg-primary flex items-center justify-center font-black"
            >
              {currentUser?.displayName?.charAt(0) || currentUser?.username?.charAt(0) || 'U'}
            </motion.div>
            <div className="flex-1 overflow-hidden">
              <div className="font-bold text-sm truncate">{currentUser?.displayName || currentUser?.username || 'مستخدم'}</div>
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{currentUser?.role || 'User'}</div>
            </div>
          </motion.div>
          <motion.button 
            whileHover={{ scale: 1.02, backgroundColor: "rgba(239, 68, 68, 0.1)" }}
            whileTap={{ scale: 0.98 }}
            onClick={onLogout}
            className="w-full flex items-center gap-4 px-4 py-3 rounded-xl text-red-400 transition-all font-bold text-xs"
          >
            <motion.div
              whileHover={{ rotate: -90 }}
            >
              <LogOut className="w-4 h-4" />
            </motion.div>
            تسجيل الخروج
          </motion.button>
        </motion.div>
      </aside>
    </>
  );
}
