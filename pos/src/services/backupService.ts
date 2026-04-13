import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { supabase } from '../supabase';

export const backupService = {
  async createBackup() {
    if (!supabase) {
      console.warn('Supabase not configured — backup skipped');
      return false;
    }
    try {
      const collections = [
        'products', 'customers', 'suppliers', 'sales', 'purchases',
        'transactions', 'box_sessions', 'box_transactions', 'logs', 'settings',
        'sales_returns', 'purchase_returns', 'damaged_products_log',
        'supplier_transactions', 'categories', 'expenses'
      ];
      const backupData: any = {};
      for (const colName of collections) {
        const querySnapshot = await getDocs(collection(db, colName));
        backupData[colName] = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
      }
      const backupJson = JSON.stringify(backupData);
      const backupDate = new Date().toISOString().split('T')[0];
      const { error } = await supabase
        .from('backups')
        .upsert({
          backup_date: backupDate,
          data: backupJson,
          size: backupJson.length,
          created_at: new Date().toISOString()
        }, { onConflict: 'backup_date' });
      if (error) {
        console.error('Supabase backup error:', error);
        return false;
      }
      localStorage.setItem('last_backup_date', new Date().toISOString());
      return true;
    } catch (error) {
      console.error('Backup creation failed:', error);
      return false;
    }
  },

  shouldPerformAutoBackup(): boolean {
    const lastBackup = localStorage.getItem('last_backup_date');
    if (!lastBackup) return true;
    const lastDate = new Date(lastBackup);
    const now = new Date();
    const diffDays = (now.getTime() - lastDate.getTime()) / (1000 * 3600 * 24);
    return diffDays >= 7;
  }
};
