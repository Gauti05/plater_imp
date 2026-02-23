import { Component, OnInit } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Firestore, collection, getDocs, query, where, orderBy, addDoc, serverTimestamp } from '@angular/fire/firestore';

interface MenuItem { id?: string; name: string; category?: string; price: number; imageUrl?: string; isVeg?: boolean; description?: string; }
interface PromoCode { id?: string; code: string; type: 'Percentage' | 'Flat'; value: number; status: 'Active' | 'Expired'; }

// ⭐ NEW: Cart Item Interface
interface CartItem { id?: string; name: string; price: number; category?: string; quantity: number; subtotal: number; taxRate: number; taxAmount: number; status: string; }

@Component({
  selector: 'app-qr-menu',
  standalone: true,
  imports: [CommonModule, CurrencyPipe],
  templateUrl: './qr-menu.component.html',
  styleUrl: './qr-menu.component.css'
})
export class QrMenuComponent implements OnInit {
  storeSlug: string = '';
  storeId: string = '';
  storeName: string = 'Digital Menu';
  tableNumber: string | null = null;

  menuItems: MenuItem[] = [];
  filteredMenu: MenuItem[] = [];
  categories: string[] = ['All'];
  activeCategory: string = 'All';

  triggeredPromo: PromoCode | null = null;
  showOfferPopup: boolean = false;
  
  isLoading: boolean = true;
  errorMessage: string = '';

  // ⭐ NEW: Cart State
  cart: CartItem[] = [];
  isPlacingOrder: boolean = false;

  constructor(private route: ActivatedRoute, private firestore: Firestore) {}

  async ngOnInit() {
    this.storeSlug = this.route.snapshot.paramMap.get('storeSlug') || '';
    this.tableNumber = this.route.snapshot.queryParamMap.get('table');

    if (this.storeSlug) {
      await this.loadStoreAndMenu();
    } else {
      this.errorMessage = "No store slug provided in the URL.";
      this.isLoading = false;
    }
  }

  async loadStoreAndMenu() {
    try {
      // 1. Get Store ID
      const storeQuery = query(collection(this.firestore, 'Stores'), where('slug', '==', this.storeSlug));
      const storeSnap = await getDocs(storeQuery);
      
      if (storeSnap.empty) {
        this.errorMessage = `Could not find a store with the slug: "${this.storeSlug}". Please check your URL.`;
        this.isLoading = false;
        return;
      }
      
      this.storeId = storeSnap.docs[0].id;
      this.storeName = storeSnap.docs[0].data()['name'] || 'Our Restaurant';

      // 2. Fetch Menu Items
      const menuRef = collection(this.firestore, `Stores/${this.storeId}/menuItems`);
      const menuSnap = await getDocs(query(menuRef, orderBy('name')));
      
      if (menuSnap.empty) {
        this.errorMessage = "Store found, but no menu items are set up in the database.";
      } else {
        this.menuItems = menuSnap.docs.map(d => ({ id: d.id, ...d.data() } as MenuItem));
        this.filteredMenu = [...this.menuItems];
        
        const cats = Array.from(new Set(this.menuItems.map(m => m.category).filter(c => !!c) as string[]));
        this.categories = ['All', ...cats.sort()];
      }

      // 3. Fetch Active Promos
      await this.triggerWelcomeOffer();
      
    } catch (error: any) {
      console.error(error);
      this.errorMessage = "Error connecting to the database: " + error.message;
    } finally {
      this.isLoading = false;
    }
  }

  async triggerWelcomeOffer() {
    const promoRef = collection(this.firestore, `Stores/${this.storeId}/promos`);
    const promoSnap = await getDocs(query(promoRef, where('status', '==', 'Active')));
    
    if (!promoSnap.empty) {
      const docData = promoSnap.docs[0];
      this.triggeredPromo = { id: docData.id, ...docData.data() } as PromoCode;
      
      setTimeout(() => {
        this.showOfferPopup = true;
      }, 1500);
    }
  }

  filterCategory(cat: string) {
    this.activeCategory = cat;
    if (cat === 'All') {
      this.filteredMenu = [...this.menuItems];
    } else {
      this.filteredMenu = this.menuItems.filter(m => m.category === cat);
    }
  }

  closeOffer() {
    this.showOfferPopup = false;
  }

  getDietType(item: MenuItem): 'veg' | 'non-veg' {
    return item.isVeg === false ? 'non-veg' : 'veg';
  }

  // ⭐ NEW: Cart Logic Methods
  getItemQuantity(item: MenuItem): number {
    return this.cart.find(c => c.id === item.id)?.quantity || 0;
  }

  get cartTotal(): number {
    return this.cart.reduce((sum, i) => sum + i.subtotal, 0);
  }

  get cartItemCount(): number {
    return this.cart.reduce((sum, i) => sum + i.quantity, 0);
  }

  addToCart(item: MenuItem) {
    const existing = this.cart.find(c => c.id === item.id);
    if (existing) {
      existing.quantity++;
      existing.subtotal = existing.quantity * existing.price;
      existing.taxAmount = existing.subtotal * (existing.taxRate / 100);
    } else {
      this.cart.push({
        id: item.id,
        name: item.name,
        price: item.price,
        category: item.category,
        quantity: 1,
        subtotal: item.price,
        taxRate: 5, // Defaulting to 5% tax like POS
        taxAmount: item.price * 0.05,
        status: 'Open' // Important so kitchen sees it
      });
    }
  }

  removeFromCart(item: MenuItem) {
    const existing = this.cart.find(c => c.id === item.id);
    if (existing) {
      existing.quantity--;
      existing.subtotal = existing.quantity * existing.price;
      existing.taxAmount = existing.subtotal * (existing.taxRate / 100);
      
      if (existing.quantity === 0) {
        this.cart = this.cart.filter(c => c.id !== item.id);
      }
    }
  }

  // ⭐ NEW: Pushes Order to POS Screen
  async placeOrder() {
    if (this.cart.length === 0 || !this.storeId) return;
    this.isPlacingOrder = true;
    
    try {
      const subtotal = this.cartTotal;
      const taxAmount = this.cart.reduce((sum, item) => sum + item.taxAmount, 0);

      const orderPayload = {
        orderType: 'Dine-in',
        tableNumber: this.tableNumber ? Number(this.tableNumber) : null,
        items: this.cart,
        subtotal: subtotal,
        tax: taxAmount,
        discount: 0,
        discountAmount: 0,
        discountType: 'percentage',
        total: subtotal + taxAmount,
        status: 'Open',
        createdAt: serverTimestamp(),
        startTime: Date.now()
      };

      await addDoc(collection(this.firestore, `Stores/${this.storeId}/orders`), orderPayload);
      
      // Clear cart and show success
      this.cart = [];
      alert('Order sent to the kitchen! 👨‍🍳');
      
    } catch (error) {
      console.error("Failed to place order:", error);
      alert('Failed to place order. Please call a waiter.');
    } finally {
      this.isPlacingOrder = false;
    }
  }
}