import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  CreditCard, 
  Banknote,
  Calculator,
  Scale,
  ShoppingCart,
  ChevronLeft,
  ChevronDown,
  Filter,
  Barcode,
  Calendar,
  X,
  User,
  Hash,
  ArrowLeft,
  Loader2,
  FileText,
  Save,
  Printer,
  CheckCircle2,
  AlertTriangle,
  Camera,
  Gift
} from 'lucide-react';
import { collection, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, increment, query, orderBy, limit, getDocs, Timestamp, getDoc, runTransaction } from 'firebase/firestore';
import { db } from '../firebase';
import { Product, Customer, SaleItem, SaleType, PaymentType, Sale, ProductBatch } from '../types';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { handleFirestoreError, OperationType } from '../lib/error-handler';
import Receipt from './Receipt';
import { supabaseService } from '../services/supabaseService';

const colors = [
  { name: 'صفر', class: 'bg-yellow-400', border: 'border-yellow-400', light: 'bg-yellow-50/50' },
  { name: 'حمر', class: 'bg-red-500', border: 'border-red-500', light: 'bg-red-50/50' },
  { name: 'زرق', class: 'bg-blue-500', border: 'border-blue-500', light: 'bg-blue-50/50' },
  { name: 'خضر', class: 'bg-green-500', border: 'border-green-500', light: 'bg-green-50/50' },
  { name: 'بيض', class: 'bg-white', border: 'border-slate-100', light: 'bg-white' }
];

export default function POS({ onBack }: { onBack?: () => void }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [saleType, setSaleType] = useState<SaleType>('retail');
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [walkInCustomerName, setWalkInCustomerName] = useState('');
  const [walkInCustomerPhone, setWalkInCustomerPhone] = useState('');
  const [paymentType, setPaymentType] = useState<PaymentType>('cash');
  const [isProcessing, setIsProcessing] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState(0);
  const [showCheckout, setShowCheckout] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    type: 'danger' | 'warning' | 'info';
  } | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [lastSale, setLastSale] = useState<Partial<Sale> & { items: SaleItem[] } | null>(null);
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [discount, setDiscount] = useState<number>(0);
  const [discountType, setDiscountType] = useState<'amount' | 'percentage'>('amount');
  const [note, setNote] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('الكل');
  const [categories, setCategories] = useState<string[]>(['الكل', 'حبوب', 'قطاني', 'عطارية', 'مكسرات']);
  const [paidAmountInput, setPaidAmountInput] = useState('');
  const [discountInput, setDiscountInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [editingItem, setEditingItem] = useState<SaleItem | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [activeMobileTab, setActiveMobileTab] = useState<'products' | 'cart'>('products');
  const [storeSettings, setStoreSettings] = useState<any>(null);
  const [supabaseActive, setSupabaseActive] = useState(false);
  const [searchMode, setSearchMode] = useState<'product' | 'customer'>('product');
  const [showScanner, setShowScanner] = useState(false);
  const [loyaltyApplied, setLoyaltyApplied] = useState(false);
  const [receiptWidth, setReceiptWidth] = useState<'80mm' | '58mm'>('80mm');

  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const discountInputRef = useRef<HTMLInputElement>(null);
  const paidAmountInputRef = useRef<HTMLInputElement>(null);


  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (selectedCustomer) {
      const customer = customers.find(c => c.id === selectedCustomer);
      if (customer?.loyaltyDiscount && !loyaltyApplied) {
        setDiscount(customer.loyaltyDiscount);
        setDiscountType('percentage');
        setLoyaltyApplied(true);
        toast.success(`تطبق خصم الوفاء: ${customer.loyaltyDiscount}%`);
      }
    } else {
      setLoyaltyApplied(false);
    }
  }, [selectedCustomer, customers]);

  useEffect(() => {
    if (showScanner) {
      const scanner = new Html5QrcodeScanner(
        "reader",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        /* verbose= */ false
      );
      scanner.render((decodedText) => {
        setSearch(decodedText);
        setShowScanner(false);
        scanner.clear();
        
        // Auto-add product if found
        const product = products.find(p => p.barcode === decodedText);
        if (product) {
          addToCart(product);
          toast.success(`تزاد: ${product.name}`);
        }
      }, (error) => {
        // console.warn(error);
      });

      return () => {
        scanner.clear();
      };
    }
  }, [showScanner, products]);
  useEffect(() => {
    const unsubProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      const productsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setProducts(productsData);
      localStorage.setItem('pos_products_cache', JSON.stringify(productsData));
    }, (error) => {
      const cached = localStorage.getItem('pos_products_cache');
      if (cached) {
        setProducts(JSON.parse(cached));
        toast.info('خدامين بالنسخة المخبية (Offline)');
      } else {
        handleFirestoreError(error, OperationType.LIST, 'products');
      }
    });

    const unsubCustomers = onSnapshot(collection(db, 'customers'), (snapshot) => {
      const customersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
      setCustomers(customersData);
      localStorage.setItem('pos_customers_cache', JSON.stringify(customersData));
    }, (error) => {
      const cached = localStorage.getItem('pos_customers_cache');
      if (cached) {
        setCustomers(JSON.parse(cached));
      } else {
        handleFirestoreError(error, OperationType.LIST, 'customers');
      }
    });

    const unsubCategories = onSnapshot(collection(db, 'categories'), (snapshot) => {
      if (!snapshot.empty) {
        const names = snapshot.docs.map(doc => doc.data().name);
        setCategories(['الكل', ...new Set(names)]);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'categories');
    });

    const unsubSettings = onSnapshot(doc(db, 'settings', 'store'), (doc) => {
      if (doc.exists()) {
        setStoreSettings(doc.data());
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/store');
    });

    const unsubDatabase = onSnapshot(doc(db, 'settings', 'database'), (doc) => {
      if (doc.exists()) {
        setSupabaseActive(doc.data().isActive);
      }
    });
    
    // Fetch last invoice number
    const fetchInvoiceNumber = async () => {
      try {
        const q = query(collection(db, 'sales'), orderBy('timestamp', 'desc'), limit(1));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const lastInvoice = snapshot.docs[0].data().invoiceNumber;
          setInvoiceNumber(Number(lastInvoice) + 1);
        } else {
          setInvoiceNumber(1001); // Start from 1001 if no sales
        }
      } catch (error) {
        console.error("Error fetching invoice number:", error);
        setInvoiceNumber(Math.floor(Math.random() * 10000)); // Fallback
      }
    };
    fetchInvoiceNumber();

    return () => {
      unsubProducts();
      unsubCustomers();
      unsubCategories();
      unsubSettings();
    };
  }, []);

  useEffect(() => {
    if (showCheckout) {
      if (paymentType === 'credit') {
        setPaidAmount(0);
        setPaidAmountInput('0');
      } else {
        setPaidAmount(total);
        setPaidAmountInput(total.toString());
      }
      setDiscountInput(discount.toString());
      setTimeout(() => {
        paidAmountInputRef.current?.focus();
        paidAmountInputRef.current?.select();
      }, 100);
    }
  }, [showCheckout]);

  useEffect(() => {
    if (!showCheckout) {
      setPaidAmountInput('');
      setDiscountInput('');
      // Refocus search input when closing checkout
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [showCheckout]);

  // Focus search input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Global key listener to focus search input if user starts typing
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Don't steal focus if we're in checkout, editing an item, or already in an input
      if (showCheckout || editingItem || confirmModal) return;
      
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || 
                      target.tagName === 'TEXTAREA' ||
                      target.isContentEditable;
      
      // Focus search input if user types alphanumeric keys and not in an input
      // This helps with barcode scanners that might start typing while focus is lost
      if (!isInput && /^[a-zA-Z0-9\u0600-\u06FF]$/.test(e.key)) {
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [showCheckout, editingItem, confirmModal]);

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === 'الكل' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const suggestions = search.trim() === '' ? [] : (
    searchMode === 'product' 
      ? products.filter(p => 
          (p.name.toLowerCase().includes(search.toLowerCase()) || p.barcode?.includes(search)) &&
          (selectedCategory === 'الكل' || p.category === selectedCategory)
        )
      : customers.filter(c => 
          c.name.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search)
        )
  );

  const updateItem = (index: number, updatedItem: SaleItem) => {
    const product = products.find(p => p.id === updatedItem.productId);
    const costPrice = product?.costPrice || 0;
    
    const discountVal = updatedItem.discountType === 'amount' 
      ? (updatedItem.discount || 0) 
      : (updatedItem.price * (updatedItem.discount || 0) / 100);
    const finalPrice = updatedItem.price - discountVal;
    
    const profitPerUnit = finalPrice - costPrice;
    
    const newCart = [...cart];
    newCart[index] = {
      ...updatedItem,
      profit: profitPerUnit * updatedItem.quantity
    };
    setCart(newCart);
  };

  const addToCart = (product: Product) => {
    const existing = cart.find(item => item.productId === product.id && item.type === saleType);
    const currentCartQty = existing ? existing.quantity : 0;
    
    if (product.stock <= currentCartQty) {
      toast.error(`الستوك ماسافيش! كاين غير ${product.stock} حبة فـ ${product.name}`);
      return;
    }

    let price = product.priceRetail;
    if (saleType === 'wholesale') price = product.priceWholesale;
    if (saleType === 'price3') price = product.price3 || product.priceWholesale;
    
    const costPrice = product.costPrice || 0;
    
    if (existing) {
      setCart(cart.map(item => 
        (item.productId === product.id && item.type === saleType)
          ? { ...item, quantity: item.quantity + 1, profit: (price - costPrice) * (item.quantity + 1) }
          : item
      ));
    } else {
      setCart([...cart, {
        productId: product.id!,
        name: product.name,
        quantity: 1,
        price: price,
        type: saleType,
        profit: price - costPrice,
        imageUrl: product.imageUrl || null,
        discount: 0,
        discountType: 'amount',
        note: ''
      }]);
    }
  };

  const updateQuantity = (productId: string, type: SaleType, delta: number) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    setCart(cart.map(item => {
      if (item.productId === productId && item.type === type) {
        const newQty = Math.max(0.1, item.quantity + delta);
        
        if (newQty > product.stock) {
          toast.error(`الستوك ماسافيش! كاين غير ${product.stock} حبة فـ ${product.name}`);
          return item;
        }

        const discountVal = item.discountType === 'amount' 
          ? (item.discount || 0) 
          : (item.price * (item.discount || 0) / 100);
        const finalPrice = item.price - discountVal;
        const profitPerUnit = finalPrice - (product?.costPrice || 0);
        return { ...item, quantity: newQty, profit: profitPerUnit * newQty };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const subtotal = cart.reduce((sum, item) => {
    const discountVal = item.discountType === 'amount' 
      ? (item.discount || 0) 
      : (item.price * (item.discount || 0) / 100);
    return sum + ((item.price - discountVal) * item.quantity);
  }, 0);
  const tax = subtotal * 0; // Assuming 0% tax for now as per video
  const discountValue = discountType === 'amount' ? discount : (subtotal * discount / 100);
  const total = subtotal + tax - discountValue;
  const totalProfit = cart.reduce((sum, item) => sum + item.profit, 0) - discountValue;

  // Refs for stable access in event listeners
  const stateRef = useRef({
    cart,
    showCheckout,
    confirmModal,
    editingItem,
    editingIndex,
    categories,
    saleType,
    paymentType,
    discount,
    paidAmount,
    selectedCustomer,
    invoiceNumber,
    subtotal,
    tax,
    discountValue,
    total,
    note,
    customers,
    showSuccess
  });

  useEffect(() => {
    if (!showCheckout) {
      setCustomerSearch('');
      setShowCustomerDropdown(false);
    }
  }, [showCheckout]);

  useEffect(() => {
    stateRef.current = {
      cart,
      showCheckout,
      confirmModal,
      editingItem,
      editingIndex,
      categories,
      saleType,
      paymentType,
      discount,
      paidAmount,
      selectedCustomer,
      invoiceNumber,
      subtotal,
      tax,
      discountValue,
      total,
      note,
      customers,
      showSuccess
    };
  }, [cart, showCheckout, confirmModal, editingItem, editingIndex, categories, saleType, paymentType, discount, paidAmount, selectedCustomer, invoiceNumber, subtotal, tax, discountValue, total, note, customers, showSuccess]);

  useEffect(() => {
    inputRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      const { 
        showCheckout, 
        showSuccess, 
        editingItem, 
        editingIndex, 
        cart, 
        categories, 
        saleType, 
        paymentType,
        confirmModal,
        total
      } = stateRef.current;

      // Handle modals first to prevent shortcuts from firing
      if (confirmModal) {
        if (e.key === 'Escape') {
          setConfirmModal(null);
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          confirmModal.onConfirm();
          setConfirmModal(null);
        }
        return;
      }

      if (showSuccess) {
        if (e.key === 'Escape' || e.key === 'Enter') {
          setShowSuccess(false);
        }
        return;
      }

      if (editingItem) {
        if (e.key === 'Escape') {
          setEditingItem(null);
          setEditingIndex(null);
        }
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          updateItem(editingIndex!, editingItem);
          setEditingItem(null);
          setEditingIndex(null);
        }
        return;
      }

      // Barcode Scanner Support: If not in a modal, ensure search input is focused
      if (!showCheckout) {
        if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
          inputRef.current?.focus();
        }
      }

      if (e.key === 'F2') {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === 'F4') {
        e.preventDefault();
        if (cart.length > 0) setShowCheckout(true);
      }
      if (e.key === 'F8') {
        e.preventDefault();
        if (cart.length > 0) {
          setConfirmModal({
            title: 'إلغاء البيعة',
            message: 'واش متأكد بغيتي تلغي هاد البيعة وتمسح السلة؟',
            type: 'danger',
            onConfirm: () => setCart([])
          });
        }
      }
      if (e.key === 'Escape') {
        setShowCheckout(false);
      }
      if (e.altKey && !isNaN(parseInt(e.key))) {
        const index = parseInt(e.key) - 1;
        if (index >= 0 && index < categories.length) {
          e.preventDefault();
          setSelectedCategory(categories[index]);
        }
      }
      if (e.altKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        setSaleType('retail');
      }
      if (e.altKey && e.key.toLowerCase() === 'w') {
        e.preventDefault();
        setSaleType('wholesale');
      }
      if (e.altKey && e.key === '3') {
        e.preventDefault();
        setSaleType('price3');
      }
      if (showCheckout) {
        if (e.altKey && e.key.toLowerCase() === 'c') {
          e.preventDefault();
          setPaymentType('cash');
          setPaidAmount(total);
          setPaidAmountInput(total.toString());
        }
        if (e.altKey && e.key.toLowerCase() === 'd') {
          e.preventDefault();
          setPaymentType('credit');
          setPaidAmount(0);
          setPaidAmountInput('0');
        }
        if (e.altKey && e.key.toLowerCase() === 'b') {
          e.preventDefault();
          setPaymentType('card');
          setPaidAmount(total);
          setPaidAmountInput(total.toString());
        }
        if (e.altKey && e.key.toLowerCase() === 's') {
          e.preventDefault();
          handleCheckout();
        }
        if (e.altKey && e.key.toLowerCase() === 'x') {
          e.preventDefault();
          discountInputRef.current?.focus();
        }
        if (e.altKey && e.key.toLowerCase() === 'p') {
          e.preventDefault();
          paidAmountInputRef.current?.focus();
        }
      }
    };
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA' ||
        document.activeElement?.tagName === 'SELECT'
      ) {
        return;
      }

      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        inputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, []);

  const handleCheckout = () => {
    if (cart.length === 0) return;

    // Check for items below cost price
    for (const item of cart) {
      const product = products.find(p => p.id === item.productId);
      const costPrice = product?.costPrice || 0;
      const discountVal = item.discountType === 'amount' 
        ? (item.discount || 0) 
        : (item.price * (item.discount || 0) / 100);
      const finalPrice = item.price - discountVal;

      if (finalPrice < costPrice) {
        toast.error(`السلعة "${item.name}" كتباع بقل من ثمن الشرا (${costPrice} DH). عافاك عدل الثمن.`);
        return;
      }
    }

    if (paymentType === 'credit' && !selectedCustomer) {
      alert('عافاك ختار الكليان باش دير الكريدي');
      return;
    }
    
    let message = `واش متأكد بغيتي تكمل هاد البيعة بـ ${total.toFixed(2)} DH؟`;
    if (selectedCustomer) {
      const customer = customers.find(c => c.id === selectedCustomer);
      if (customer) {
        message += `\n\nالكليان: ${customer.name}\nالكريدي القديم: ${customer.balance} DH`;
        if (paymentType === 'credit') {
          const newCredit = total - paidAmount;
          if (newCredit > 0) {
            message += `\nالكريدي الجديد غيولي: ${(customer.balance + newCredit).toFixed(2)} DH`;
          }
        }
      }
    }

    setConfirmModal({
      title: 'أكد البيعة',
      message,
      type: 'warning',
      onConfirm: processCheckout
    });
  };

  const processCheckout = async () => {
    if (isProcessing || cart.length === 0) return;
    if (paymentType === 'credit' && !selectedCustomer) {
      alert('عافاك ختار الكليان باش دير الكريدي');
      return;
    }

    setIsProcessing(true);
    setConfirmModal(null);
    try {
      const customer = customers.find(c => c.id === selectedCustomer);
      let dueDate = null;
      if (paymentType === 'credit' && customer?.creditPeriodDays) {
        const date = new Date();
        date.setDate(date.getDate() + customer.creditPeriodDays);
        dueDate = date;
      }

      const saleRef = doc(collection(db, 'sales'));
      
      const saleData = {
        invoiceNumber: invoiceNumber || 0,
        timestamp: serverTimestamp(),
        customerId: selectedCustomer || null,
        customerName: customer?.name || (walkInCustomerName || 'كليان كاش'),
        customerPhone: customer?.phone || walkInCustomerPhone || '',
        items: cart.map(item => ({
          productId: item.productId || '',
          name: item.name || '',
          quantity: item.quantity || 0,
          price: item.price || 0,
          type: item.type || 'retail',
          profit: item.profit || 0,
          imageUrl: item.imageUrl || null,
          discount: item.discount || 0,
          discountType: item.discountType || 'amount',
          note: item.note || ''
        })),
        subtotal: subtotal || 0,
        tax: tax || 0,
        discount: discountValue || 0,
        discountValue: discountValue || 0,
        discountRaw: discount || 0,
        discountType: discountType || 'amount',
        total: total || 0,
        paid: paidAmount || 0,
        change: Math.max(0, (paidAmount || 0) - (total || 0)),
        paymentType: paymentType || 'cash',
        profit: totalProfit || 0,
        note: note || '',
        dueDate: dueDate || null
      };

      await runTransaction(db, async (transaction) => {
        // 1. Read all product docs
        const productRefs = cart.map(item => doc(db, 'products', item.productId));
        const productDocs = await Promise.all(productRefs.map(ref => transaction.get(ref)));
        
        const updatedBatchesMap: { [productId: string]: ProductBatch[] } = {};
        const saleItemsWithProfit: any[] = [];

        // 2. Check stock availability and calculate FIFO profit
        for (let i = 0; i < cart.length; i++) {
          const item = cart[i];
          const productDoc = productDocs[i];
          if (!productDoc.exists()) {
            throw new Error(`المنتوج "${item.name}" ماكاينش فالسيرفور.`);
          }
          
          const productData = productDoc.data() as Product;
          const currentStock = productData.stock || 0;
          
          if (currentStock < item.quantity) {
            throw new Error(`الستوك ديال "${item.name}" ماسافيش. كاين غير ${currentStock} حبة.`);
          }

          // FIFO Logic
          let remainingToDeduct = item.quantity;
          let itemTotalCost = 0;
          
          // Get batches or create a default one if none exist (migration)
          let batches = [...(productData.batches || [])];
          if (batches.length === 0 && currentStock > 0) {
            batches.push({
              id: 'initial-batch',
              quantity: currentStock,
              costPrice: productData.costPrice || 0,
              receivedDate: (productData as any).createdAt || serverTimestamp(),
            });
          }

          // Sort batches by receivedDate (FIFO)
          batches.sort((a, b) => {
            const dateA = a.receivedDate?.seconds || 0;
            const dateB = b.receivedDate?.seconds || 0;
            return dateA - dateB;
          });

          const newBatches: ProductBatch[] = [];
          for (const batch of batches) {
            if (remainingToDeduct <= 0) {
              newBatches.push(batch);
              continue;
            }

            if (batch.quantity <= remainingToDeduct) {
              // Use entire batch
              itemTotalCost += batch.quantity * batch.costPrice;
              remainingToDeduct -= batch.quantity;
              // Batch is exhausted, don't add to newBatches
            } else {
              // Use part of batch
              itemTotalCost += remainingToDeduct * batch.costPrice;
              newBatches.push({
                ...batch,
                quantity: batch.quantity - remainingToDeduct
              });
              remainingToDeduct = 0;
            }
          }

          if (remainingToDeduct > 0) {
            // This shouldn't happen if currentStock >= item.quantity, 
            // but just in case batches are out of sync with total stock
            itemTotalCost += remainingToDeduct * (productData.costPrice || 0);
          }

          const discountVal = item.discountType === 'amount' 
            ? (item.discount || 0) 
            : (item.price * (item.discount || 0) / 100);
          const finalPrice = item.price - discountVal;
          const itemTotalRevenue = finalPrice * item.quantity;
          const itemProfit = itemTotalRevenue - itemTotalCost;

          saleItemsWithProfit.push({
            ...item,
            profit: itemProfit,
            costPrice: itemTotalCost / item.quantity // Average cost for this sale item
          });

          updatedBatchesMap[item.productId] = newBatches;
        }

        // 3. Perform writes
        const finalSaleData = {
          ...saleData,
          items: saleItemsWithProfit,
          profit: saleItemsWithProfit.reduce((sum, item) => sum + item.profit, 0)
        };

        transaction.set(saleRef, finalSaleData);

        for (let i = 0; i < cart.length; i++) {
          const productId = cart[i].productId;
          transaction.update(productRefs[i], {
            stock: increment(-cart[i].quantity),
            batches: updatedBatchesMap[productId] as any
          });
        }

        if (paymentType === 'credit' && selectedCustomer) {
          const customerRef = doc(db, 'customers', selectedCustomer);
          const remainingAmount = total - (paidAmount || 0);
          transaction.update(customerRef, {
            balance: increment(remainingAmount)
          });
          
          const transactionRef = doc(collection(db, 'transactions'));
          transaction.set(transactionRef, {
            timestamp: serverTimestamp(),
            customerId: selectedCustomer || null,
            amount: remainingAmount,
            type: 'credit',
            note: `فاتورة نمرة: ${invoiceNumber}${dueDate ? ` - غيخلص فـ: ${format(dueDate, 'yyyy-MM-dd')}` : ''}`
          });
        }
      });

      // Sync to Supabase if active
      if (supabaseActive) {
        supabaseService.syncSale({
          ...saleData,
          id: saleRef.id,
          timestamp: new Date()
        } as any);
      }

      // Set last sale for printing (convert serverTimestamp to current date for immediate display)
      setLastSale({
        ...saleData,
        id: saleRef.id,
        timestamp: Timestamp.now()
      });

      setCart([]);
      setSelectedCustomer(null);
      setShowCheckout(false);
      setShowSuccess(true);
      setPaidAmount(0);
      setDiscount(0);
      setNote('');
      setInvoiceNumber(prev => prev + 1);
    } catch (error) {
      if (error instanceof Error && error.message.includes('الستوك')) {
        toast.error(error.message);
      } else {
        handleFirestoreError(error, OperationType.WRITE, 'sales');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-100" dir="rtl">
      {/* Desktop Top Bar - Hidden on Mobile */}
      <div className="hidden lg:block bg-white border-b border-slate-200 shadow-sm z-20">
        <div className="px-6 py-3 flex items-center justify-between gap-4">
          {/* Invoice Info Row */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200">
              <span className="text-xs font-bold text-slate-500">نمرة الفاتورة</span>
              <span className="text-lg font-black text-slate-800">{invoiceNumber}</span>
            </div>
            <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200">
              <span className="text-xs font-bold text-slate-500">لادات ديال الفاتورة</span>
              <span className="text-sm font-black text-slate-800">{format(new Date(), 'yyyy-MM-dd')}</span>
            </div>
          </div>

          {/* Search Bar Row */}
          <div className="flex-1 flex items-center gap-2" ref={searchRef}>
            {/* Category Filter Dropdown */}
            <div className="relative shrink-0">
              <Filter className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="appearance-none bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-8 py-3 text-sm font-black text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all cursor-pointer min-w-[120px]"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
            </div>

            <div className="flex-1 relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                ref={inputRef}
                type="text"
                placeholder={searchMode === 'product' ? "قلب على شي سلعة..." : "قلب على كليان..."}
                className="w-full pr-10 pl-24 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all outline-none font-bold"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setShowSuggestions(true);
                  setSelectedIndex(-1);
                }}
                onFocus={() => setShowSuggestions(true)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setSelectedIndex(prev => Math.min(prev + 1, suggestions.slice(0, 10).length - 1));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setSelectedIndex(prev => Math.max(prev - 1, 0));
                  } else if (e.key === 'Enter') {
                    e.preventDefault();
                    const searchTerm = search.trim();
                    if (!searchTerm) return;

                    if (searchMode === 'product') {
                      const exactBarcodeMatch = products.find(p => p.barcode === searchTerm);
                      if (exactBarcodeMatch) {
                        addToCart(exactBarcodeMatch);
                        setSearch('');
                        setShowSuggestions(false);
                        setSelectedIndex(-1);
                        toast.success(`تزاد ${exactBarcodeMatch.name}`);
                      } else {
                        const product = selectedIndex >= 0 ? suggestions[selectedIndex] : (suggestions.length === 1 ? suggestions[0] : null);
                        if (product) {
                          addToCart(product);
                          setSearch('');
                          setShowSuggestions(false);
                          setSelectedIndex(-1);
                        } else {
                          toast.error('مالقينا حتى سلعة بهاد الباركود');
                        }
                      }
                    } else {
                      const customer = selectedIndex >= 0 ? suggestions[selectedIndex] : (suggestions.length === 1 ? suggestions[0] : null);
                      if (customer) {
                        setSelectedCustomer(customer.id);
                        if (customer.sellingPriceType) {
                          setSaleType(customer.sellingPriceType as SaleType);
                        }
                        setSearch('');
                        setShowSuggestions(false);
                        setSelectedIndex(-1);
                        toast.success(`تختار الكليان: ${customer.name}`);
                      } else {
                        toast.error('مالقينا حتى كليان بهاد السمية');
                      }
                    }
                    inputRef.current?.focus();
                  } else if (e.key === 'Escape') {
                    setShowSuggestions(false);
                  }
                }}
              />
              <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {search && (
                  <button 
                    onClick={() => {
                      setSearch('');
                      setShowSuggestions(false);
                    }}
                    className="text-slate-400 hover:text-slate-600 p-1 rounded-full transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                <button 
                  onClick={() => {
                    setSearchMode(prev => prev === 'product' ? 'customer' : 'product');
                    setSearch('');
                    setShowSuggestions(false);
                    inputRef.current?.focus();
                  }}
                  className={cn(
                    "p-1.5 rounded-lg transition-all",
                    searchMode === 'customer' ? "bg-primary text-primary-foreground shadow-lg" : "text-slate-400 hover:bg-slate-100"
                  )}
                  title={searchMode === 'product' ? "قلب على الكليان" : "قلب على السلعة"}
                >
                  <User className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => setShowScanner(true)}
                  className="text-primary hover:bg-primary/10 p-1 rounded-lg"
                  title="سكان بالكميرا"
                >
                  <Camera className="w-7 h-7" />
                </button>
              </div>
            </div>
          </div>

          {/* Customer Selection */}
          <div className="flex items-center gap-3">
            <button 
              onClick={() => {
                setSearchMode('customer');
                inputRef.current?.focus();
              }}
              className="bg-primary text-primary-foreground px-4 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all active:scale-95"
            >
              <User className="w-5 h-5" />
              <span>{selectedCustomer ? customers.find(c => c.id === selectedCustomer)?.name : 'كليان كاش'}</span>
            </button>
          </div>
        </div>

        {/* Suggestions Dropdown Desktop */}
        {showSuggestions && search.trim() !== '' && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-[100] animate-in fade-in slide-in-from-top-2 duration-200 mx-auto max-w-xl">
            <div className="max-h-80 overflow-y-auto">
              {suggestions.length > 0 ? (
                suggestions.slice(0, 10).map((item, index) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (searchMode === 'product') {
                        addToCart(item);
                      } else {
                        setSelectedCustomer(item.id);
                        if (item.sellingPriceType) {
                          setSaleType(item.sellingPriceType as SaleType);
                        }
                        toast.success(`تختار الكليان: ${item.name}`);
                      }
                      setSearch('');
                      setShowSuggestions(false);
                      setSelectedIndex(-1);
                    }}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={cn(
                      "w-full p-4 flex items-center justify-between transition-colors border-b border-slate-50 last:border-0 text-right",
                      selectedIndex === index ? "bg-indigo-50" : "hover:bg-slate-50"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400">
                        {searchMode === 'product' ? <ShoppingCart className="w-5 h-5" /> : <User className="w-5 h-5" />}
                      </div>
                      <div>
                        <div className="font-black text-slate-800 text-sm">{item.name}</div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase">
                          {searchMode === 'product' ? item.category : (item.phone || 'بلا نمرة')}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      {searchMode === 'product' ? (
                        <div className="text-indigo-600 font-black">
                          {saleType === 'retail' ? item.priceRetail : item.priceWholesale}
                          <span className="text-[10px] mr-1">DH</span>
                        </div>
                      ) : (
                        <div className="text-rose-600 font-black">
                          {item.balance}
                          <span className="text-[10px] mr-1">DH</span>
                        </div>
                      )}
                    </div>
                  </button>
                ))
              ) : (
                <div className="p-8 text-center text-slate-400 italic">
                  ما لقينا والو بـ "{search}"
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Mobile Header - Matches Video */}
      <div className="lg:hidden bg-white border-b border-slate-200 shadow-sm z-20">
        <div className="flex items-center justify-between p-3 border-b border-slate-100">
          <button 
            onClick={() => {
              if (activeMobileTab === 'cart') {
                setActiveMobileTab('products');
              } else if (onBack) {
                onBack();
              } else {
                window.history.back();
              }
            }}
            className="p-2 hover:bg-slate-100 rounded-xl text-slate-600"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-black text-slate-800">البيع</h1>
          <button className="p-2 hover:bg-slate-100 rounded-xl flex flex-col gap-1">
            <div className="w-5 h-0.5 bg-slate-600 rounded-full"></div>
            <div className="w-5 h-0.5 bg-slate-600 rounded-full"></div>
            <div className="w-5 h-0.5 bg-slate-600 rounded-full"></div>
          </button>
        </div>
        
        <div className="p-2 space-y-2">
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 px-1">
            <div className="flex items-center gap-1">
              <span>نمرة الفاتورة:</span>
              <span className="text-slate-800 font-black">{invoiceNumber}</span>
            </div>
            <div className="flex items-center gap-1">
              <span>لادات:</span>
              <span className="text-slate-800 font-black">{format(new Date(), 'yyyy-MM-dd')}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                type="text"
                placeholder={searchMode === 'product' ? "قلب على السلعة..." : "قلب على الكليان..."}
                className="w-full pr-9 pl-20 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setShowSuggestions(true);
                }}
              />
              <div className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <button 
                  onClick={() => {
                    setSearchMode(prev => prev === 'product' ? 'customer' : 'product');
                    setSearch('');
                  }}
                  className={cn(
                    "p-1 rounded-md transition-all",
                    searchMode === 'customer' ? "bg-primary text-primary-foreground shadow-lg" : "text-slate-400"
                  )}
                >
                  <User className="w-4 h-4" />
                </button>
              </div>
            </div>
            <button 
              onClick={() => setShowCheckout(true)}
              className="bg-primary text-primary-foreground p-2 rounded-lg shadow-sm flex items-center gap-1"
            >
              <User className="w-4 h-4" />
              <span className="text-[10px] font-black truncate max-w-[60px]">
                {selectedCustomer ? customers.find(c => c.id === selectedCustomer)?.name.split(' ')[0] : 'كاش'}
              </span>
            </button>
          </div>
        </div>

        {/* Mobile Suggestions Dropdown */}
        {showSuggestions && search.trim() !== '' && (
          <div className="lg:hidden absolute top-[140px] left-2 right-2 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-[100] animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="max-h-80 overflow-y-auto">
              {suggestions.length > 0 ? (
                suggestions.slice(0, 10).map((item, index) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (searchMode === 'product') {
                        addToCart(item);
                      } else {
                        setSelectedCustomer(item.id);
                        if (item.sellingPriceType) {
                          setSaleType(item.sellingPriceType as SaleType);
                        }
                        toast.success(`تختار الكليان: ${item.name}`);
                      }
                      setSearch('');
                      setShowSuggestions(false);
                      setSelectedIndex(-1);
                    }}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={cn(
                      "w-full p-4 flex items-center justify-between transition-colors border-b border-slate-50 last:border-0 text-right",
                      selectedIndex === index ? "bg-indigo-50" : "hover:bg-slate-50"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400">
                        {searchMode === 'product' ? <ShoppingCart className="w-5 h-5" /> : <User className="w-5 h-5" />}
                      </div>
                      <div>
                        <div className="font-black text-slate-800 text-sm">{item.name}</div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase">
                          {searchMode === 'product' ? item.category : (item.phone || 'بلا نمرة')}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      {searchMode === 'product' ? (
                        <div className="text-indigo-600 font-black">
                          {saleType === 'retail' ? item.priceRetail : item.priceWholesale}
                          <span className="text-[10px] mr-1">DH</span>
                        </div>
                      ) : (
                        <div className="text-rose-600 font-black">
                          {item.balance}
                          <span className="text-[10px] mr-1">DH</span>
                        </div>
                      )}
                    </div>
                  </button>
                ))
              ) : (
                <div className="p-8 text-center text-slate-400 italic">
                  ما لقينا والو بـ "{search}"
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Desktop Product Selection */}
        <div className="hidden lg:flex flex-1 flex-col border-l border-slate-200 bg-white min-w-0">
          {/* Categories & Sale Type */}
          <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-4 bg-slate-50/50">
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {categories.map((cat, index) => (
                <motion.button
                  key={cat}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectedCategory(cat)}
                  className={cn(
                    "px-5 py-2 rounded-xl text-sm font-black whitespace-nowrap transition-all border",
                    selectedCategory === cat 
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-200" 
                      : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                  )}
                >
                  {cat} <span className="text-[10px] opacity-50 ml-1">Alt+{index + 1}</span>
                </motion.button>
              ))}
            </div>
            
            <div className="flex bg-slate-200 p-1 rounded-xl shrink-0">
              <button
                onClick={() => setSaleType('retail')}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-xs font-black transition-all",
                  saleType === 'retail' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500"
                )}
              >
                ديطاي
              </button>
              <button
                onClick={() => setSaleType('wholesale')}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-xs font-black transition-all",
                  saleType === 'wholesale' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500"
                )}
              >
                جملة
              </button>
            </div>
          </div>

          {/* Product Grid */}
          <div className="flex-1 overflow-y-auto p-4">
            <motion.div 
              layout
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4"
            >
              {filteredProducts.map((product, index) => (
                <motion.button
                  key={product.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.01 }}
                  whileHover={{ y: -4, scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => addToCart(product)}
                  className={cn(
                    "bg-white p-3 rounded-3xl border-2 hover:border-indigo-500 hover:bg-indigo-50/30 transition-all text-right group relative flex flex-col justify-between h-48 shadow-sm overflow-hidden",
                    colors.find(c => c.name === product.displayColor)?.border || 'border-slate-100',
                    colors.find(c => c.name === product.displayColor)?.light
                  )}
                >
                  <div className="absolute inset-0 opacity-10 group-hover:opacity-20 transition-opacity">
                    {product.imageUrl ? (
                      <motion.img 
                        whileHover={{ scale: 1.1 }}
                        src={product.imageUrl} 
                        alt={product.name} 
                        className="w-full h-full object-cover" 
                        referrerPolicy="no-referrer" 
                      />
                    ) : (
                      <div className="w-full h-full bg-slate-200 flex items-center justify-center">
                        <ShoppingCart className="w-10 h-10 text-slate-400" />
                      </div>
                    )}
                  </div>
                  <div className="relative z-10">
                    <div className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1 bg-white/80 inline-block px-2 py-0.5 rounded-lg">{product.category}</div>
                    <div className="font-black text-slate-800 text-sm line-clamp-2 leading-tight drop-shadow-sm">{product.name}</div>
                  </div>
                  <div className="relative z-10 flex items-end justify-between mt-2">
                    <div className="text-indigo-600 font-black text-lg bg-white/80 px-2 py-1 rounded-xl">
                      {saleType === 'retail' ? product.priceRetail : product.priceWholesale}
                      <span className="text-[10px] mr-1">DH</span>
                    </div>
                    <motion.div 
                      whileHover={{ scale: 1.1, rotate: 90 }}
                      className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors shadow-sm"
                    >
                      <Plus className="w-5 h-5" />
                    </motion.div>
                  </div>
                </motion.button>
              ))}
            </motion.div>
          </div>
        </div>

        {/* Mobile View - Tabbed Layout */}
        <div className="lg:hidden flex-1 flex flex-col overflow-hidden bg-white">
          {activeMobileTab === 'cart' ? (
            <div className="flex-1 flex flex-col overflow-hidden animate-in slide-in-from-left duration-300">
              <div className="p-4 border-b border-slate-200 bg-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600">
                    <ShoppingCart className="w-5 h-5" />
                  </div>
                  <h3 className="font-black text-slate-800">السلة</h3>
                </div>
                {cart.length > 0 && (
                  <button 
                    onClick={() => setCart([])}
                    className="text-xs font-black text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                  >
                    <Trash2 className="w-4 h-4" />
                    خوي كولشي
                  </button>
                )}
              </div>

              {/* Mobile Cart Header */}
              <div className="flex items-center bg-slate-50/50 backdrop-blur-md border-b border-slate-100 text-[8px] font-black text-slate-400 py-3 px-3 uppercase tracking-widest">
                <span className="w-8"></span>
                <span className="w-24 text-center">الإجمالي</span>
                <span className="w-16 text-center">الكمية</span>
                <span className="w-16 text-center">السعر</span>
                <span className="flex-1 text-right pr-6">المنتج</span>
              </div>

              {/* Cart List - Premium Refined */}
              <div className="flex-1 overflow-y-auto bg-white/50 p-1 space-y-1">
                <AnimatePresence mode="popLayout">
                  {cart.map((item, index) => (
                    <motion.div 
                      key={`${item.productId}-${item.type}`} 
                      layout
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      whileHover={{ scale: 1.01 }}
                      className="flex items-center bg-white border border-slate-100 hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-500/5 rounded-xl py-1 px-1.5 transition-all duration-300 cursor-pointer group relative overflow-hidden"
                      onClick={() => {
                        setEditingItem(item);
                        setEditingIndex(index);
                      }}
                    >
                      {/* Delete Icon - Elegant */}
                      <motion.button 
                        whileHover={{ scale: 1.2, color: "#ef4444" }}
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setCart(cart.filter((_, i) => i !== index));
                        }}
                        className="w-6 flex justify-center text-slate-200 transition-colors duration-300"
                      >
                        <Trash2 className="w-3 h-3" />
                      </motion.button>

                      {/* Total Box - Premium Highlight */}
                      <div className="w-20 px-1">
                        <motion.div 
                          whileHover={{ scale: 1.05 }}
                          className="h-9 flex flex-col items-center justify-center bg-indigo-600 border border-indigo-600 rounded-xl font-black text-white text-[10px] shadow-lg shadow-indigo-200 group-hover:scale-105 transition-transform duration-300"
                        >
                          <span className="text-[7px] opacity-60 mb-0.5 uppercase tracking-tighter">المجموع</span>
                          {((item.price - (item.discount || 0)) * item.quantity).toFixed(1)}
                        </motion.div>
                      </div>

                      {/* Quantity Box - Elegant */}
                      <div className="w-14 px-0.5">
                        <div className="h-9 flex flex-col items-center justify-center bg-slate-50 border border-slate-100 rounded-xl font-black text-slate-800 text-[10px] group-hover:border-indigo-100 transition-colors">
                          <span className="text-[6px] text-slate-400 mb-0.5 uppercase">الكمية</span>
                          {item.quantity}
                        </div>
                      </div>

                      {/* Price Box - Elegant */}
                      <div className="w-14 px-0.5">
                        <div className="h-9 flex flex-col items-center justify-center bg-slate-50 border border-slate-100 rounded-xl font-black text-slate-800 text-[10px] group-hover:border-indigo-100 transition-colors">
                          <span className="text-[6px] text-slate-400 mb-0.5 uppercase">السعر</span>
                          {item.price.toFixed(1)}
                        </div>
                      </div>

                      {/* Product Info - Typography Focus */}
                      <div className="flex-1 pr-4 text-right min-w-0">
                        <div className="flex items-center justify-end gap-1 mb-0.5">
                          <span className="text-[7px] font-black text-indigo-400/60 tracking-widest uppercase">
                            {products.find(p => p.id === item.productId)?.barcode || 'NO-CODE'}
                          </span>
                          <span className="w-3 h-3 rounded-full bg-slate-100 flex items-center justify-center text-[7px] font-black text-slate-400">
                            {index + 1}
                          </span>
                        </div>
                        <div className="text-xs font-black text-slate-900 group-hover:text-indigo-600 transition-colors truncate leading-tight">
                          {item.name}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {cart.length === 0 && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="h-full flex flex-col items-center justify-center text-slate-300 py-20 space-y-4"
                  >
                    <motion.div 
                      animate={{ y: [0, -10, 0] }}
                      transition={{ repeat: Infinity, duration: 2 }}
                      className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center"
                    >
                      <ShoppingCart className="w-10 h-10" />
                    </motion.div>
                    <p className="font-bold italic">السلة خاوية</p>
                    <button 
                      onClick={() => setActiveMobileTab('products')}
                      className="text-indigo-600 font-black text-sm underline"
                    >
                      زيد شي سلعة
                    </button>
                  </motion.div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden animate-in fade-in duration-300">
              {/* Categories & Sale Type Bar */}
              <div className="flex flex-col gap-2 p-2 bg-slate-50 border-b border-slate-200">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex bg-slate-200 p-1 rounded-xl shrink-0">
                    <button
                      onClick={() => setSaleType('retail')}
                      className={cn(
                        "px-4 py-1.5 rounded-lg text-[10px] font-black transition-all",
                        saleType === 'retail' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500"
                      )}
                    >
                      ديطاي
                    </button>
                    <button
                      onClick={() => setSaleType('wholesale')}
                      className={cn(
                        "px-4 py-1.5 rounded-lg text-[10px] font-black transition-all",
                        saleType === 'wholesale' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500"
                      )}
                    >
                      جملة
                    </button>
                  </div>
                  <div className="flex-1 flex gap-2 overflow-x-auto no-scrollbar">
                    {categories.map(cat => (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={cn(
                          "px-4 py-1.5 rounded-xl text-[10px] font-black whitespace-nowrap border transition-all shadow-sm",
                          selectedCategory === cat 
                            ? "bg-indigo-600 text-white border-indigo-600" 
                            : "bg-white text-slate-500 border-slate-200"
                        )}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Product Grid */}
              <div className="flex-1 overflow-y-auto p-3 bg-white">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {filteredProducts.map(product => (
                    <button
                      key={product.id}
                      onClick={() => {
                        addToCart(product);
                        toast.success(`تزاد ${product.name}`, { duration: 1000 });
                      }}
                      className={cn(
                        "p-3 rounded-2xl border-2 text-right flex flex-col justify-between h-36 active:scale-95 transition-all shadow-sm relative overflow-hidden group",
                        colors.find(c => c.name === product.displayColor)?.border || 'border-slate-100',
                        colors.find(c => c.name === product.displayColor)?.light || 'bg-white'
                      )}
                    >
                      <div className="relative z-10">
                        <div className="text-[9px] font-black text-indigo-500 uppercase tracking-tighter mb-1">{product.category}</div>
                        <div className="text-xs font-black text-slate-800 line-clamp-2 leading-tight">{product.name}</div>
                      </div>
                      <div className="relative z-10 flex items-end justify-between">
                        <div className="flex flex-col">
                          <div className="text-indigo-600 font-black text-sm">
                            {saleType === 'retail' ? product.priceRetail : product.priceWholesale}
                            <span className="text-[10px] mr-0.5">DH</span>
                          </div>
                          <div className="text-[9px] font-black text-slate-400 mt-0.5">
                            السطوك: <span className={cn(product.stock <= 5 ? "text-red-500" : "text-emerald-500")}>{product.stock}</span>
                          </div>
                        </div>
                        <div className="w-8 h-8 bg-indigo-600 text-white rounded-lg flex items-center justify-center shadow-md">
                          <Plus className="w-5 h-5" />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
                {filteredProducts.length === 0 && (
                  <div className="py-20 text-center text-slate-400 italic">
                    ما كاين حتى سلعة فهاد الكاتيكوري
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Desktop Cart Sidebar */}
        <div className="hidden lg:flex w-[450px] flex-col bg-slate-50 border-r border-slate-200">
          <div className="p-4 border-b border-slate-200 bg-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <h3 className="font-black text-slate-800">السلة</h3>
            </div>
            {cart.length > 0 && (
              <button 
                onClick={() => setCart([])}
                className="text-xs font-black text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
              >
                <Trash2 className="w-4 h-4" />
                خوي كولشي
              </button>
            )}
          </div>

          {/* Desktop Cart Sidebar - Premium Refined */}
          <div className="flex items-center bg-slate-50/50 backdrop-blur-md border-b border-slate-100 text-[8px] font-black text-slate-400 py-2 px-3 uppercase tracking-[0.1em]">
            <span className="w-6"></span>
            <span className="w-20 text-center">الإجمالي</span>
            <span className="w-14 text-center">الكمية</span>
            <span className="w-14 text-center">السعر</span>
            <span className="flex-1 text-right pr-4">المنتج</span>
          </div>

          <div className="flex-1 overflow-y-auto bg-white/50 p-1.5 space-y-1">
            <AnimatePresence mode="popLayout">
              {cart.map((item, index) => (
                <motion.div 
                  key={`${item.productId}-${item.type}`} 
                  layout
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  whileHover={{ scale: 1.01 }}
                  onClick={() => {
                    setEditingItem(item);
                    setEditingIndex(index);
                  }}
                  className="flex items-center bg-white border border-slate-100 hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-500/5 rounded-xl py-1 px-1.5 transition-all duration-300 cursor-pointer group relative overflow-hidden"
                >
                  {/* Delete Icon - Elegant */}
                  <motion.button 
                    whileHover={{ scale: 1.2, color: "#ef4444" }}
                    whileTap={{ scale: 0.9 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setCart(cart.filter((_, i) => i !== index));
                    }}
                    className="w-6 flex justify-center text-slate-200 transition-colors duration-300"
                  >
                    <Trash2 className="w-3 h-3" />
                  </motion.button>

                  {/* Total Box - Premium Highlight */}
                  <div className="w-20 px-1">
                    <motion.div 
                      whileHover={{ scale: 1.05 }}
                      className="h-9 flex flex-col items-center justify-center bg-indigo-600 border border-indigo-600 rounded-xl font-black text-white text-[10px] shadow-lg shadow-indigo-200 group-hover:scale-105 transition-transform duration-300"
                    >
                      <span className="text-[7px] opacity-60 mb-0.5 uppercase tracking-tighter">المجموع</span>
                      {((item.price - (item.discount || 0)) * item.quantity).toFixed(1)}
                    </motion.div>
                  </div>

                  {/* Quantity Box - Elegant */}
                  <div className="w-14 px-0.5">
                    <div className="h-9 flex flex-col items-center justify-center bg-slate-50 border border-slate-100 rounded-xl font-black text-slate-800 text-[10px] group-hover:border-indigo-100 transition-colors">
                      <span className="text-[6px] text-slate-400 mb-0.5 uppercase">الكمية</span>
                      {item.quantity}
                    </div>
                  </div>

                  {/* Price Box - Elegant */}
                  <div className="w-14 px-0.5">
                    <div className="h-9 flex flex-col items-center justify-center bg-slate-50 border border-slate-100 rounded-xl font-black text-slate-800 text-[10px] group-hover:border-indigo-100 transition-colors">
                      <span className="text-[6px] text-slate-400 mb-0.5 uppercase">السعر</span>
                      {item.price.toFixed(1)}
                    </div>
                  </div>

                  {/* Product Info - Typography Focus */}
                  <div className="flex-1 pr-4 text-right min-w-0">
                    <div className="flex items-center justify-end gap-1 mb-0.5">
                      <span className="text-[7px] font-black text-indigo-400/60 tracking-widest uppercase">
                        {products.find(p => p.id === item.productId)?.barcode || 'NO-CODE'}
                      </span>
                      <span className="w-3 h-3 rounded-full bg-slate-100 flex items-center justify-center text-[7px] font-black text-slate-400">
                        {index + 1}
                      </span>
                    </div>
                    <div className="text-xs font-black text-slate-900 group-hover:text-indigo-600 transition-colors truncate leading-tight">
                      {item.name}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Footer Bar */}
      <div className="bg-white border-t border-slate-200 p-2 lg:p-4 shadow-2xl z-20">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Mobile Footer - Matches Video */}
          <div className="lg:hidden flex items-center justify-between w-full gap-2">
            <button 
              onClick={() => setActiveMobileTab(activeMobileTab === 'products' ? 'cart' : 'products')}
              className={cn(
                "p-3 rounded-2xl transition-all relative",
                activeMobileTab === 'cart' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" : "bg-slate-100 text-slate-600"
              )}
            >
              {activeMobileTab === 'products' ? (
                <div className="relative">
                  <ShoppingCart className="w-6 h-6" />
                  {cart.length > 0 && (
                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white">
                      {cart.length}
                    </span>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-0.5">
                  <div className="w-2 h-2 bg-current rounded-sm"></div>
                  <div className="w-2 h-2 bg-current rounded-sm"></div>
                  <div className="w-2 h-2 bg-current rounded-sm"></div>
                  <div className="w-2 h-2 bg-current rounded-sm"></div>
                </div>
              )}
            </button>
            
            <div className="flex-1 flex items-center justify-between bg-slate-900 px-4 py-3 rounded-2xl shadow-inner">
              <div className="flex flex-col">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">المجموع</span>
                <span className="text-lg font-black text-white">{(total || 0).toFixed(2)} <span className="text-[10px] text-slate-400">DH</span></span>
              </div>
              <div className="w-px h-6 bg-white/10 mx-2"></div>
              <div className="flex flex-col items-end">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">البياس</span>
                <span className="text-lg font-black text-emerald-400">{cart.length}</span>
              </div>
            </div>

            <button 
              disabled={cart.length === 0}
              onClick={() => setShowCheckout(true)}
              className="bg-indigo-600 disabled:bg-slate-300 text-white p-4 rounded-2xl shadow-lg active:scale-95 transition-all"
            >
              <CheckCircle2 className="w-6 h-6" />
            </button>
          </div>

          {/* Desktop Footer */}
          <div className="hidden lg:flex items-center gap-8">
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">المجموع + التاكس</span>
              <span className="text-3xl font-black text-indigo-600">{(total || 0).toFixed(2)} <span className="text-xs">درهم</span></span>
            </div>
            <div className="h-10 w-px bg-slate-200"></div>
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">شحال من بياسة</span>
              <span className="text-2xl font-black text-slate-800">{cart.length}</span>
            </div>
          </div>

          <div className="hidden lg:flex gap-3">
            <button onClick={() => setCart([])} className="px-6 py-4 bg-slate-100 hover:bg-slate-200 rounded-2xl font-black text-slate-600 transition-all">حبس (F8)</button>
            <button disabled={cart.length === 0} onClick={() => setShowCheckout(true)} className="px-12 py-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-300 rounded-2xl font-black text-xl text-white shadow-xl shadow-indigo-200 transition-all flex items-center gap-3">خلص (F4) <ChevronLeft className="w-6 h-6" /></button>
          </div>
        </div>
      </div>

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
                 <ShoppingCart className="w-10 h-10" />}
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-slate-800">{confirmModal.title}</h3>
                <p className="text-slate-500 font-bold whitespace-pre-line">{confirmModal.message}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setConfirmModal(null)}
                  className="py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black rounded-2xl transition-all"
                >
                  رجع
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
                  {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                  أكد (Enter)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Barcode Scanner Modal */}
      {showScanner && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-[40px] w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xl font-black text-slate-800">سكان الباركود</h3>
              <button onClick={() => setShowScanner(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              <div id="reader" className="w-full overflow-hidden rounded-2xl border-2 border-dashed border-slate-200"></div>
              <p className="text-center text-slate-500 font-bold mt-4">وجه الكاميرا للباركود باش تسكانيه</p>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccess && lastSale && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="p-8 text-center">
              <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-12 h-12" />
              </div>
              <h3 className="text-2xl font-black text-slate-800 mb-2">دازت البيعة بنجاح!</h3>
              <p className="text-slate-500 font-bold mb-4">تسجلات الفاتورة نمرة {lastSale.invoiceNumber} بنجاح.</p>
              
              <div className="flex justify-center gap-2 mb-8 bg-slate-50 p-1 rounded-xl border border-slate-200 w-fit mx-auto">
                <button 
                  onClick={() => setReceiptWidth('80mm')}
                  className={cn(
                    "px-4 py-2 rounded-lg text-xs font-black transition-all",
                    receiptWidth === '80mm' ? "bg-slate-900 text-white shadow-lg" : "text-slate-400 hover:bg-slate-100"
                  )}
                >
                  80mm
                </button>
                <button 
                  onClick={() => setReceiptWidth('58mm')}
                  className={cn(
                    "px-4 py-2 rounded-lg text-xs font-black transition-all",
                    receiptWidth === '58mm' ? "bg-slate-900 text-white shadow-lg" : "text-slate-400 hover:bg-slate-100"
                  )}
                >
                  58mm
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => {
                    window.print();
                  }}
                  className="flex items-center justify-center gap-2 bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-lg shadow-indigo-200 hover:bg-indigo-500 transition-all active:scale-95"
                >
                  <Printer className="w-5 h-5" />
                  خرج الفاتورة
                </button>
                <button 
                  onClick={() => setShowSuccess(false)}
                  className="bg-slate-100 text-slate-600 py-4 rounded-2xl font-black hover:bg-slate-200 transition-all active:scale-95"
                >
                  سد
                </button>
              </div>
            </div>
          </div>
          {/* Hidden Receipt for Printing */}
          <div className="hidden print:block">
            <Receipt 
              sale={lastSale} 
              businessName={storeSettings?.name}
              businessAddress={storeSettings?.address}
              businessPhone={storeSettings?.phone}
              thankYouMessage={storeSettings?.thankYouMessage}
              footerNote={storeSettings?.footerNote}
              logoUrl={storeSettings?.showLogo ? storeSettings?.logo : undefined}
              width={receiptWidth}
            />
          </div>
        </div>
      )}

      {/* Edit Item Modal */}
      {editingItem && editingIndex !== null && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in duration-200 my-auto">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div className="w-10"></div>
              <h3 className="text-lg font-black text-slate-800 text-center flex-1 truncate px-2">{editingItem.name}</h3>
              <button 
                onClick={() => {
                  setEditingItem(null);
                  setEditingIndex(null);
                }}
                className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-600 shadow-sm transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-5">
              {/* Price Selection */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-wider">سعر البيع</label>
                  <div className="flex bg-slate-100 p-1 rounded-xl">
                    {[1, 2, 3].map(num => {
                      const product = products.find(p => p.id === editingItem.productId);
                      const pPrice = num === 1 ? product?.priceRetail : (num === 2 ? product?.priceWholesale : product?.price3);
                      // Determine if this price is currently selected
                      const isSelected = editingItem.price === pPrice;
                      
                      return (
                        <button 
                          key={num}
                          onClick={() => setEditingItem({ ...editingItem, price: pPrice || 0 })}
                          className={cn(
                            "w-10 h-8 rounded-lg font-black text-xs transition-all flex items-center justify-center",
                            isSelected ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                          )}
                        >
                          {num}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="relative">
                  <input 
                    type="number" 
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-slate-800 text-center text-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    value={editingItem.price}
                    onChange={(e) => setEditingItem({ ...editingItem, price: parseFloat(e.target.value) || 0 })}
                  />
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">DH</div>
                </div>
              </div>

              {/* Quantity */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-wider">الكمية</label>
                  <div className="text-xs font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">
                    {(() => {
                      const discountVal = editingItem.discountType === 'amount' 
                        ? (editingItem.discount || 0) 
                        : (editingItem.price * (editingItem.discount || 0) / 100);
                      const finalPrice = editingItem.price - discountVal;
                      return (finalPrice * editingItem.quantity).toFixed(2);
                    })()} DH
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setEditingItem({ ...editingItem, quantity: Math.max(0.1, editingItem.quantity - 1) })}
                    className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center hover:bg-slate-200 transition-all active:scale-95"
                  >
                    <Minus className="w-6 h-6" />
                  </button>
                  <input 
                    type="number" 
                    className="flex-1 p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-slate-800 text-center text-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    value={editingItem.quantity}
                    onChange={(e) => setEditingItem({ ...editingItem, quantity: parseFloat(e.target.value) || 0 })}
                  />
                  <button 
                    onClick={() => setEditingItem({ ...editingItem, quantity: editingItem.quantity + 1 })}
                    className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center hover:bg-slate-200 transition-all active:scale-95"
                  >
                    <Plus className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Discount */}
              <div className="space-y-3">
                <label className="text-xs font-black text-slate-400 uppercase tracking-wider">الخصم</label>
                <div className="flex items-center gap-2">
                  <input 
                    type="number" 
                    className="flex-1 p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-slate-800 text-center text-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    value={editingItem.discount || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, discount: parseFloat(e.target.value) || 0 })}
                    placeholder="0.0"
                  />
                  <button 
                    onClick={() => setEditingItem({ ...editingItem, discountType: editingItem.discountType === 'amount' ? 'percentage' : 'amount' })}
                    className="w-20 h-14 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black transition-all active:scale-95"
                  >
                    {editingItem.discountType === 'amount' ? 'DH' : '%'}
                  </button>
                </div>
              </div>

              {/* Note / Barcode */}
              <div className="space-y-3">
                <label className="text-xs font-black text-slate-400 uppercase tracking-wider">ملاحظة للمنتج تظهر في الفاتورة</label>
                <div className="relative">
                  <div className="absolute right-4 top-4 text-slate-400">
                    <FileText className="w-5 h-5" />
                  </div>
                  <input 
                    type="text"
                    className="w-full p-4 pr-12 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 text-right outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="مثلا: اللون | الرقم التسلسلي..."
                    value={editingItem.note || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, note: e.target.value })}
                  />
                </div>
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-1 gap-2 pt-2">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="text-slate-500 font-black text-xs">الكمية المتوفرة</span>
                  <span className="font-black text-slate-800">{products.find(p => p.id === editingItem.productId)?.stock || 0}</span>
                </div>
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="text-slate-500 font-black text-xs">سعر التكلفة</span>
                  <span className="font-black text-slate-800">{products.find(p => p.id === editingItem.productId)?.costPrice || 0} DH</span>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-3 pt-4">
                <button 
                  onClick={() => {
                    const newCart = cart.filter((_, i) => i !== editingIndex);
                    setCart(newCart);
                    setEditingItem(null);
                    setEditingIndex(null);
                    toast.error('تم حذف المنتج من القائمة');
                  }}
                  className="w-full flex items-center justify-center gap-2 bg-red-50 text-red-600 font-black p-4 rounded-2xl transition-all hover:bg-red-100 active:scale-95 border border-red-200"
                >
                  <Trash2 className="w-5 h-5" />
                  إلغاء المنتج من القائمة
                </button>

                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => {
                      updateItem(editingIndex, editingItem);
                      setEditingItem(null);
                      setEditingIndex(null);
                      toast.success('تم التحديث بنجاح');
                    }}
                    className="bg-indigo-600 text-white p-4 rounded-2xl font-black text-lg shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95"
                  >
                    متابعة
                  </button>
                  <button 
                    onClick={() => {
                      setEditingItem(null);
                      setEditingIndex(null);
                    }}
                    className="bg-slate-100 text-slate-600 p-4 rounded-2xl font-black text-lg hover:bg-slate-200 transition-all active:scale-95"
                  >
                    تراجع
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {showCheckout && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in duration-300 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-600 p-2 rounded-xl text-white">
                  <CreditCard className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-black text-slate-800">كمل البيعة</h3>
              </div>
              <button onClick={() => setShowCheckout(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 lg:p-8 grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-12">
              {/* Left Side: Payment Details */}
              <div className="space-y-6 lg:space-y-8">
                <div className="space-y-3 lg:space-y-4">
                  <label className="text-[10px] lg:text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Banknote className="w-4 h-4" />
                    كيفاش غيخلص
                  </label>
                  <div className="grid grid-cols-3 gap-2 lg:gap-3">
                    {(['cash', 'credit', 'card'] as const).map(type => (
                      <button
                        key={type}
                        onClick={() => {
                          setPaymentType(type as any);
                          if (type === 'credit') {
                            setPaidAmount(0);
                            setPaidAmountInput('0');
                          } else {
                            setPaidAmount(total);
                            setPaidAmountInput(total.toString());
                          }
                        }}
                        className={cn(
                          "p-3 lg:p-5 rounded-2xl lg:rounded-3xl border-2 flex flex-col items-center gap-2 lg:gap-3 transition-all active:scale-95",
                          paymentType === type 
                            ? "border-indigo-600 bg-indigo-50 text-indigo-700 shadow-lg shadow-indigo-100" 
                            : "border-slate-100 text-slate-400 hover:border-slate-200 hover:bg-slate-50"
                        )}
                        title={type === 'cash' ? 'Alt + C' : type === 'credit' ? 'Alt + D' : 'Alt + B'}
                      >
                        {type === 'cash' && <Banknote className="w-5 h-5 lg:w-7 lg:h-7" />}
                        {type === 'credit' && <CreditCard className="w-5 h-5 lg:w-7 lg:h-7" />}
                        {type === 'card' && <Calculator className="w-5 h-5 lg:w-7 lg:h-7" />}
                        <span className="text-[10px] lg:text-sm font-black">
                          {type === 'cash' ? 'كاش (C)' : type === 'credit' ? 'كريدي (D)' : 'كارط (B)'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 lg:space-y-4">
                  <label className="text-[10px] lg:text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <User className="w-4 h-4" />
                    الكليان
                  </label>
                  
                  <div className="relative">
                    <div className="relative group">
                      <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                      <input 
                        type="text"
                        className="w-full p-4 lg:p-5 pr-12 bg-slate-50 border-2 border-slate-100 rounded-2xl lg:rounded-3xl font-black text-slate-700 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-sm lg:text-base"
                        placeholder="اكتب سمية الكليان أو نمرة التلفون..."
                        value={selectedCustomer ? (customers.find(c => c.id === selectedCustomer)?.name || '') : customerSearch}
                        onChange={(e) => {
                          if (selectedCustomer) setSelectedCustomer(null);
                          setCustomerSearch(e.target.value);
                          setShowCustomerDropdown(true);
                        }}
                        onFocus={() => setShowCustomerDropdown(true)}
                      />
                      {selectedCustomer && (
                        <button 
                          onClick={() => {
                            setSelectedCustomer(null);
                            setCustomerSearch('');
                          }}
                          className="absolute left-4 top-1/2 -translate-y-1/2 w-8 h-8 bg-slate-200 text-slate-500 rounded-full flex items-center justify-center hover:bg-red-100 hover:text-red-500 transition-all"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {showCustomerDropdown && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setShowCustomerDropdown(false)}></div>
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl z-20 max-h-64 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
                          <button
                            onClick={() => {
                              setSelectedCustomer(null);
                              setCustomerSearch('');
                              setShowCustomerDropdown(false);
                            }}
                            className="w-full p-4 text-right hover:bg-slate-50 border-b border-slate-50 flex items-center justify-between group"
                          >
                            <span className="font-black text-slate-800">كليان كاش (عادي)</span>
                            <div className="w-6 h-6 rounded-full border-2 border-slate-200 group-hover:border-indigo-500 transition-colors"></div>
                          </button>
                          
                          {customers
                            .filter(c => 
                              c.name.toLowerCase().includes(customerSearch.toLowerCase()) || 
                              (c.phone && c.phone.includes(customerSearch))
                            )
                            .map(c => (
                              <button
                                key={c.id}
                                onClick={() => {
                                  setSelectedCustomer(c.id!);
                                  if (c.sellingPriceType) {
                                    setSaleType(c.sellingPriceType as SaleType);
                                  }
                                  setShowCustomerDropdown(false);
                                  setCustomerSearch('');
                                }}
                                className="w-full p-4 text-right hover:bg-indigo-50 border-b border-slate-50 flex flex-col gap-1 transition-colors"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-black text-slate-800">{c.name}</span>
                                  {c.balance > 0 && <span className="text-[10px] font-black bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full">كريدي: {c.balance} DH</span>}
                                </div>
                                {c.phone && <div className="text-xs font-bold text-slate-400">{c.phone}</div>}
                              </button>
                            ))
                          }
                          
                          {customers.filter(c => 
                            c.name.toLowerCase().includes(customerSearch.toLowerCase()) || 
                            (c.phone && c.phone.includes(customerSearch))
                          ).length === 0 && customerSearch && (
                            <div className="p-8 text-center text-slate-400 italic font-bold">
                              ما كاين حتى كليان بهاد السمية
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  {!selectedCustomer && (
                    <div className="grid grid-cols-2 gap-3 animate-in slide-in-from-top-2">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">الاسم (اختياري)</label>
                        <input 
                          type="text"
                          className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all text-sm"
                          value={walkInCustomerName}
                          onChange={e => setWalkInCustomerName(e.target.value)}
                          placeholder="سمية الكليان"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">رقم الهاتف (اختياري)</label>
                        <input 
                          type="tel"
                          className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all text-sm"
                          value={walkInCustomerPhone}
                          onChange={e => setWalkInCustomerPhone(e.target.value)}
                          placeholder="06..."
                        />
                      </div>
                    </div>
                  )}

                  {selectedCustomer && (
                    <div className="p-3 lg:p-4 bg-rose-50 border border-rose-100 rounded-xl lg:rounded-2xl flex items-center justify-between animate-in slide-in-from-top-2">
                      <span className="text-xs lg:text-sm font-black text-rose-600">الكريدي القديم لي عليه:</span>
                      <span className="text-sm lg:text-base font-black text-rose-700">
                        {customers.find(c => c.id === selectedCustomer)?.balance || 0} DH
                      </span>
                    </div>
                  )}
                </div>

                {paymentType === 'credit' && selectedCustomer && (
                  <div className="space-y-3 lg:space-y-4 animate-in slide-in-from-top-2 duration-200">
                    <label className="text-[10px] lg:text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      فوقاش غيخلص (على حساب شنو تفهمتو)
                    </label>
                    <div className="p-4 lg:p-5 bg-amber-50 border-2 border-amber-100 rounded-2xl lg:rounded-3xl font-black text-amber-700 flex items-center justify-between text-sm lg:text-base">
                      <span>{customers.find(c => c.id === selectedCustomer)?.creditPeriodDays || 0} يوم</span>
                      <span className="text-base lg:text-lg">
                        {(() => {
                          const customer = customers.find(c => c.id === selectedCustomer);
                          if (customer?.creditPeriodDays) {
                            const date = new Date();
                            date.setDate(date.getDate() + customer.creditPeriodDays);
                            return format(date, 'yyyy-MM-dd');
                          }
                          return 'ما محددش';
                        })()}
                      </span>
                    </div>
                  </div>
                )}

                <div className="space-y-3 lg:space-y-4">
                  <label className="text-[10px] lg:text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    ملاحظة زايدة
                  </label>
                  <textarea 
                    className="w-full p-4 lg:p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl lg:rounded-3xl font-bold text-slate-700 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all h-24 lg:h-32 resize-none text-sm lg:text-base"
                    placeholder="زيد شي ملاحظات على هاد البيعة..."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </div>
              </div>

              {/* Right Side: Totals & Paid Amount */}
              <div className="bg-slate-900 rounded-3xl lg:rounded-[40px] p-6 lg:p-8 text-white flex flex-col">
                <div className="space-y-6 lg:space-y-8 flex-1">
                  <div className="flex justify-between items-end">
                    <div className="flex flex-col">
                      <span className="text-slate-400 font-bold text-xs">المجموع بلا رميز</span>
                      <span className="text-lg lg:text-xl font-black text-slate-300">{(subtotal || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-slate-400 font-bold text-xs">الرميز</span>
                        <div className="flex bg-white/10 p-1 rounded-xl">
                          <button 
                            onClick={() => setDiscountType('amount')}
                            className={cn(
                              "px-2 lg:px-3 py-1 rounded-lg text-[8px] lg:text-[10px] font-black transition-all",
                              discountType === 'amount' ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
                            )}
                          >
                            درهم
                          </button>
                          <button 
                            onClick={() => setDiscountType('percentage')}
                            className={cn(
                              "px-2 lg:px-3 py-1 rounded-lg text-[8px] lg:text-[10px] font-black transition-all",
                              discountType === 'percentage' ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
                            )}
                          >
                            %
                          </button>
                        </div>
                      </div>
                      <input 
                        ref={discountInputRef}
                        type="text" 
                        inputMode="decimal"
                        className="w-24 lg:w-32 bg-white/10 border-none rounded-xl text-right p-2 lg:p-3 font-black text-indigo-400 focus:ring-2 focus:ring-indigo-500 text-lg lg:text-xl transition-shadow duration-200"
                        value={discountInput}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '' || /^\d*\.?\d*$/.test(val)) {
                            setDiscountInput(val);
                            setDiscount(parseFloat(val) || 0);
                          }
                        }}
                        title="Alt + X"
                      />
                    </div>
                  </div>

                  <div className="h-px bg-white/10"></div>

                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-black text-base lg:text-lg">المجموع اللخر</span>
                    <span className="text-3xl lg:text-5xl font-black text-indigo-400">{(total || 0).toFixed(2)} <span className="text-xs lg:text-sm">DH</span></span>
                  </div>

                  <div className="space-y-3 lg:space-y-4">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-black text-slate-400">شحال عطاك (Alt + P)</label>
                      <div className="flex gap-1 lg:gap-2">
                        {[total, 50, 100, 200].map(val => (
                          <button 
                            key={val}
                            onClick={() => {
                              setPaidAmount(val);
                              setPaidAmountInput(val.toString());
                            }}
                            className="px-2 lg:px-3 py-1 lg:py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-[8px] lg:text-[10px] font-black transition-all"
                          >
                            {(val || 0).toFixed(0)}
                          </button>
                        ))}
                      </div>
                    </div>
                    <input 
                      ref={paidAmountInputRef}
                      type="text" 
                      inputMode="decimal"
                      className="w-full bg-white/10 border-none rounded-2xl lg:rounded-3xl p-4 lg:p-6 text-3xl lg:text-5xl font-black text-emerald-400 text-center focus:ring-4 focus:ring-emerald-500/50 transition-shadow duration-200"
                      value={paidAmountInput}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '' || /^\d*\.?\d*$/.test(val)) {
                          setPaidAmountInput(val);
                          setPaidAmount(parseFloat(val) || 0);
                        }
                      }}
                      placeholder="0.00"
                    />
                  </div>

                  <div className="flex justify-between items-center bg-white/5 p-4 lg:p-6 rounded-2xl lg:rounded-3xl">
                    <span className="text-slate-400 font-black text-base lg:text-lg">شحال غترد ليه</span>
                    <span className={cn(
                      "text-2xl lg:text-4xl font-black transition-all",
                      paidAmount >= total ? "text-amber-400" : "text-red-400"
                    )}>
                      {Math.max(0, (paidAmount || 0) - (total || 0)).toFixed(2)}
                    </span>
                  </div>
                </div>

                <motion.button
                  whileHover={{ scale: 1.02, backgroundColor: "#4f46e5" }}
                  whileTap={{ scale: 0.98 }}
                  disabled={isProcessing || (paymentType === 'cash' && paidAmount < total)}
                  onClick={handleCheckout}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 py-4 lg:py-6 rounded-2xl lg:rounded-3xl font-black text-xl lg:text-2xl shadow-2xl shadow-indigo-900/50 transition-all flex items-center justify-center gap-3 lg:gap-4 mt-6 lg:mt-8 active:scale-95"
                  title="Alt + S"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-6 h-6 lg:w-8 lg:h-8 animate-spin" />
                      <span>كنسجلوا...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-6 h-6 lg:w-8 lg:h-8" />
                      <span>أكد البيعة (S)</span>
                    </>
                  )}
                </motion.button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
