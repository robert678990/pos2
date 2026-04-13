import React, { useState, useRef, useEffect } from 'react';
import { Bell, BellRing, X, CheckCheck, Trash2, AlertTriangle, Info, CheckCircle2, AlertCircle } from 'lucide-react';
import { useNotifications } from '../contexts/NotificationContext';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';

export default function NotificationBell({ onNavigate }: { onNavigate: (tab: any) => void }) {
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearNotifications } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getIcon = (type: string) => {
    switch (type) {
      case 'warning': return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      case 'error': return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'success': return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
      default: return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "p-2.5 rounded-2xl transition-all relative group",
          isOpen ? "bg-white/20 text-white" : "hover:bg-white/10 text-white/70 hover:text-white"
        )}
      >
        {unreadCount > 0 ? (
          <BellRing className="w-6 h-6 animate-pulse" />
        ) : (
          <Bell className="w-6 h-6" />
        )}
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 bg-red-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-slate-900 shadow-lg">
            {unreadCount > 9 ? '+9' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute left-0 mt-4 w-80 sm:w-96 bg-white rounded-[32px] shadow-2xl border border-slate-200 z-50 overflow-hidden text-slate-800 origin-top-left"
          >
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-3">
                <h3 className="font-black text-lg">التنبيهات</h3>
                {unreadCount > 0 && (
                  <span className="bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-lg text-xs font-black">
                    {unreadCount} جديد
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => markAllAsRead()}
                  className="p-2 hover:bg-slate-200 rounded-xl transition-colors text-slate-400 hover:text-indigo-600"
                  title="تحديد الكل كمقروء"
                >
                  <CheckCheck className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => clearNotifications()}
                  className="p-2 hover:bg-red-50 rounded-xl transition-colors text-slate-400 hover:text-red-600"
                  title="مسح الكل"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
              {notifications.length === 0 ? (
                <div className="p-12 text-center flex flex-col items-center gap-4">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-300">
                    <Bell className="w-8 h-8" />
                  </div>
                  <p className="text-slate-400 font-bold">لا توجد تنبيهات حالياً</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {notifications.map((notif) => (
                    <div
                      key={notif.id}
                      onClick={() => {
                        markAsRead(notif.id);
                        if (notif.link) onNavigate(notif.link);
                        setIsOpen(false);
                      }}
                      className={cn(
                        "p-5 hover:bg-slate-50 transition-all cursor-pointer flex gap-4 group relative",
                        !notif.read && "bg-indigo-50/30"
                      )}
                    >
                      {!notif.read && (
                        <div className="absolute right-0 top-0 bottom-0 w-1 bg-indigo-500 rounded-l-full" />
                      )}
                      <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border border-slate-100 shadow-sm",
                        notif.type === 'warning' ? "bg-amber-50" : "bg-blue-50"
                      )}>
                        {getIcon(notif.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-1">
                          <h4 className="font-black text-slate-800 text-sm truncate">{notif.title}</h4>
                          <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap">
                            {formatDistanceToNow(notif.timestamp, { addSuffix: true, locale: ar })}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 font-bold leading-relaxed line-clamp-2">
                          {notif.message}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
