import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { Product } from '../types';
import { handleFirestoreError, OperationType } from '../lib/error-handler';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'warning' | 'error' | 'info' | 'success';
  timestamp: Date;
  read: boolean;
  link?: string;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const notifiedProductsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Request permission for browser notifications
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // Listen for low stock and expiring products
    const unsubProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      const allProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      
      const lowStockProducts = allProducts.filter(p => p.stock < p.minStock);
      
      const today = new Date();
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(today.getDate() + 30);
      
      const expiringProducts = allProducts.filter(p => {
        if (!p.expiryDate) return false;
        const expDate = new Date(p.expiryDate);
        return expDate <= thirtyDaysFromNow && expDate >= today;
      });

      const lowStockNotifs: Notification[] = lowStockProducts.map(p => {
        const id = `low-stock-${p.id}`;
        if (!notifiedProductsRef.current.has(id)) {
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('تنبيه مخزون منخفض', {
              body: `المنتج "${p.name}" وصل إلى مستوى منخفض (${p.stock} ${p.unit})`,
              icon: '/favicon.ico'
            });
          }
          notifiedProductsRef.current.add(id);
        }
        return {
          id,
          title: 'تنبيه مخزون منخفض',
          message: `المنتج "${p.name}" وصل إلى مستوى منخفض (${p.stock} ${p.unit})`,
          type: 'warning',
          timestamp: new Date(),
          read: false,
          link: 'inventory'
        };
      });

      const expiryNotifs: Notification[] = expiringProducts.map(p => {
        const id = `expiry-${p.id}`;
        if (!notifiedProductsRef.current.has(id)) {
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('تنبيه انتهاء الصلاحية', {
              body: `المنتج "${p.name}" غيسالي فـ ${p.expiryDate}`,
              icon: '/favicon.ico'
            });
          }
          notifiedProductsRef.current.add(id);
        }
        return {
          id,
          title: 'تنبيه انتهاء الصلاحية',
          message: `المنتج "${p.name}" غيسالي فـ ${p.expiryDate}`,
          type: 'error',
          timestamp: new Date(),
          read: false,
          link: 'inventory'
        };
      });

      setNotifications(prev => {
        const otherNotifs = prev.filter(n => !n.id.startsWith('low-stock-') && !n.id.startsWith('expiry-'));
        return [...lowStockNotifs, ...expiryNotifs, ...otherNotifs].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      });
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'products');
    });

    // Listen for new sales
    const unsubSales = onSnapshot(collection(db, 'sales'), (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const sale = change.doc.data();
          // Only notify for recent sales (last 5 minutes) to avoid spamming on initial load
          const saleTime = sale.timestamp?.toDate() || new Date();
          if (new Date().getTime() - saleTime.getTime() < 300000) {
            const id = `sale-${change.doc.id}`;
            
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('عملية بيع جديدة', {
                body: `تم تسجيل بيع بقيمة ${sale.total.toFixed(2)} درهم`,
                icon: '/favicon.ico'
              });
            }

            setNotifications(prev => {
              if (prev.some(n => n.id === id)) return prev;
              const newNotif: Notification = {
                id,
                title: 'عملية بيع جديدة',
                message: `تم تسجيل بيع بقيمة ${sale.total.toFixed(2)} درهم للفاتورة #${sale.invoiceNumber}`,
                type: 'success',
                timestamp: saleTime,
                read: false,
                link: 'sales'
              };
              return [newNotif, ...prev].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
            });
          }
        }
      });
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'sales');
    });

    return () => {
      unsubProducts();
      unsubSales();
    };
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markAsRead, markAllAsRead, clearNotifications }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
