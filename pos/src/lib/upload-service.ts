import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';
import { toast } from 'sonner';

export const uploadImage = async (file: File, path: string): Promise<string | null> => {
  try {
    // Basic validation
    if (!file.type.startsWith('image/')) {
      toast.error('المرجو اختيار صورة صالحة');
      return null;
    }

    // Limit size to 5MB
    if (file.size > 5 * 1024 * 1024) {
      toast.error('حجم الصورة كبير جداً (الحد الأقصى 5MB)');
      return null;
    }

    const fileExtension = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExtension}`;
    const storageRef = ref(storage, `${path}/${fileName}`);

    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    return downloadURL;
  } catch (error) {
    console.error('Upload Error:', error);
    toast.error('فشل تحميل الصورة');
    return null;
  }
};
