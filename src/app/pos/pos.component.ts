import { Component, OnInit, OnDestroy, ViewEncapsulation, HostListener } from '@angular/core';
import { CommonModule, CurrencyPipe, TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  Firestore, collection, collectionData, query, orderBy, doc, serverTimestamp, updateDoc, deleteDoc, setDoc, getDoc, getDocs, where, writeBatch, increment
} from '@angular/fire/firestore';
import { ActivatedRoute, Router } from '@angular/router';
import { combineLatest, interval, Subscription, BehaviorSubject } from 'rxjs';

/* ------------------------
   Interfaces
   ------------------------ */
interface RawMaterial { id?: string; name: string; unit?: string; costPerUnit?: number; stock: number; lowStockThreshold?: number; isActive?: boolean; category?: string; }
interface ModifierOption { label: string; price: number; }
interface Modifier { id?: string; name: string; type: 'addon' | 'variation'; options: ModifierOption[]; isActive?: boolean; }
interface MenuItem { id?: string; name: string; category?: string; price: number; imageUrl?: string; recipe?: { rawMaterialId: string; name?: string; quantity: number; unit?: string }[]; modifiers?: string[]; trackInventory?: boolean; isActive?: boolean; totalServingsInInventory?: number | null; taxRate?: number; foodType?: string; isVeg?: boolean; }
interface CartModifierSelection { modifierId: string; modifierName?: string; optionLabel: string; optionPrice: number; type: 'addon' | 'variation'; }
interface CartItem { id?: string; name: string; basePrice: number; price: number; category?: string; quantity: number; subtotal: number; taxRate: number; taxAmount: number; recipe?: MenuItem['recipe']; modifiers?: CartModifierSelection[]; totalServingsInInventory?: number | null; status?: 'Pending' | 'In Progress' | 'Ready' | 'Served'; foodType?: string; isVeg?: boolean; }
interface Order { id?: string; orderType: 'Dine-in' | 'Takeaway'; tableNumber?: number | null; customerMobile?: string; customerName?: string; items: CartItem[]; subtotal: number; tax: number; discount: number; taxRate: number; discountType: 'percentage' | 'flat'; discountAmount: number; total: number; status: 'Draft' | 'Open' | 'In Progress' | 'Ready' | 'Paid' | 'Cancelled'; createdAt?: any; startTime?: number; waiter?: string | null; paymentMode?: 'CASH' | 'CARD' | 'UPI' | 'OTHER' | null; paymentModeOther?: string | null; paidAt?: any; loyaltyPointsEarned?: number; loyaltyPointsRedeemed?: number; }
interface Table { id?: string; number: number; capacity: number; isOccupied?: boolean; status?: 'Available' | 'Occupied' | 'Reserved'; orderId?: string | null; waiter?: string | null; }

interface LoyaltySettings { 
  isEnabled: boolean; earnSpendAmount: number; earnPoints: number; redeemPoints: number; redeemValue: number; minRedeemPoints: number; 
  maxEarnPerOrder?: number; maxRedeemPerOrder?: number; 
  welcomeBonusPoints?: number; milestoneVisitCount?: number; milestoneBonusPoints?: number; 
  isCrossStoreLoyaltyEnabled?: boolean;
  isHappyHourEnabled?: boolean; happyHourDay?: string; happyHourStart?: string; happyHourEnd?: string; happyHourMultiplier?: number; // ⭐ Added Happy Hour
  tiers: any[]; 
}
interface CustomerProfile { name: string; mobile: string; loyaltyPoints: number; lifetimeSpend: number; tier: string; visitCount?: number; }

@Component({
  selector: 'app-pos',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe, TitleCasePipe],
  templateUrl: './pos.component.html',
  styleUrls: ['./pos.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class PosComponent implements OnInit, OnDestroy {
  storeSlug: string | null = null;
  storeId: string | null = null;
  storeInfo: any = {}; 
  globalCustomisation: any = { taxPercentage: 5, taxName: 'GST' }; 

  loyaltySettings: LoyaltySettings | null = null;
  customerProfile: CustomerProfile | null = null;
  pointsToRedeem = 0;
  loyaltyDiscount = 0;

  rawMaterials: RawMaterial[] = [];
  menuItems: MenuItem[] = [];
  modifiers: Modifier[] = [];
  filteredMenuItems: MenuItem[] = [];
  categories: string[] = ['All'];
  activeCategory = 'All';
  activeTab: 'tables' | 'menu' | 'orders' = 'menu';

  tables: Table[] = [];
  openOrders: Order[] = [];
  activeTable: Table | null = null;
  currentOrder: Order | null = null;

  cart: CartItem[] = [];
  discountType: 'percentage' | 'flat' = 'percentage';
  discountAmount = 0;

  showAddItemPanel = false;
  modalMenuItem: MenuItem | null = null;
  modalQuantity = 1;
  modalSelectedModifiers: Record<string, CartModifierSelection[] | null> = {};

  showCheckoutPanel = false;
  checkoutCustomerName = '';
  checkoutCustomerMobile = '';
  checkoutWaiter = '';
  checkoutPayment: 'CASH' | 'CARD' | 'UPI' | 'OTHER' | null = null;
  checkoutPaymentOther: string = '';
  mobileError: string | null = null;

  showTableModal = false;
  editingTable: Table | null = null;
  newTable = { number: 0, capacity: 4 };

  showRunningOrdersPanel = false;
  orderType: 'Dine-in' | 'Takeaway' = 'Dine-in';
  isOnline = navigator.onLine;

  private subs: Subscription[] = [];
  private search$ = new BehaviorSubject<string>('');
  private timerSub?: Subscription;

  constructor(private firestore: Firestore, private route: ActivatedRoute, private router: Router) {
    window.addEventListener('online', () => this.isOnline = true);
    window.addEventListener('offline', () => this.isOnline = false);
  }

  private sanitizeData(data: any): any {
    if (data === undefined) return null;
    if (data === null || typeof data !== 'object') return data;
    if (Array.isArray(data)) return data.map(item => this.sanitizeData(item));
    const cleanObj: any = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        cleanObj[key] = this.sanitizeData(data[key]);
      }
    }
    return cleanObj;
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    if (this.showAddItemPanel || this.showTableModal) return;
    if (event.ctrlKey && event.key === 'Enter') {
      event.preventDefault();
      if (this.cart.length > 0 && !this.showCheckoutPanel) this.openCheckoutPanel();
    }
    if (event.shiftKey && event.key === 'Backspace') {
      event.preventDefault();
      if (this.cart.length > 0 && !this.showCheckoutPanel) {
        if(confirm('Are you sure you want to clear the cart?')) this.cart = [];
      }
    }
  }

  closeCheckoutPanel() { 
    this.showCheckoutPanel = false; 
    this.customerProfile = null; 
    this.loyaltyDiscount = 0; 
    this.pointsToRedeem = 0; 
  }
  closeAddItemPanel() { this.showAddItemPanel = false; }
  closeTableModal() { this.showTableModal = false; }

  async deleteTable(id?: string) {
    if (!id || !this.storeId) return;
    if (!confirm('Delete table?')) return;
    await deleteDoc(doc(this.firestore, this.tablesColPath(), id));
  }

  async saveTable() {
    if (!this.storeId) return;
    const col = collection(this.firestore, this.tablesColPath());
    const payload = this.sanitizeData({ ...this.newTable, isOccupied: false, status: 'Available' });
    if (this.editingTable?.id) await updateDoc(doc(col, this.editingTable.id), payload);
    else await setDoc(doc(col), payload);
    this.closeTableModal();
  }

  async placeOrderAndNotifyKitchen(markPaid = false) {
    if (!this.validateMobile(this.checkoutCustomerMobile) || !this.checkoutCustomerName) return;
    if (markPaid && !this.checkoutPayment) { alert('Select Payment Method'); return; }

    try {
      this.assertStore();
      const batch = writeBatch(this.firestore);
      const id = this.currentOrder?.id || this.activeTable?.orderId;
      const ref = id ? doc(this.firestore, this.ordersColPath(), id) : doc(collection(this.firestore, this.ordersColPath()));

      const baseEarned = this.getBaseEarnedPoints();
      const welcomeBonus = this.getWelcomeBonus();
      const milestoneBonus = this.getMilestoneBonus();
      const happyHourBonus = this.getHappyHourBonus(baseEarned); // ⭐ Calc Happy Hour
      const totalEarned = markPaid ? (baseEarned + welcomeBonus + milestoneBonus + happyHourBonus) : 0;
      const redeemed = markPaid ? this.pointsToRedeem : 0;

      const brandId = this.storeInfo?.ownerId || this.storeInfo?.adminUid;
      const isGlobal = this.loyaltySettings?.isCrossStoreLoyaltyEnabled && brandId;

      const orderPayload = this.sanitizeData({
        items: this.cart.map(i => ({ ...i, status: i.status === 'Pending' ? 'Open' : i.status })),
        subtotal: this.getCartSubtotal(),
        tax: this.getCartTax(),
        discount: this.getCartDiscount() + this.loyaltyDiscount,
        loyaltyPointsEarned: totalEarned,
        loyaltyPointsRedeemed: redeemed,
        total: this.getCartTotal(),
        customerMobile: this.checkoutCustomerMobile,
        customerName: this.checkoutCustomerName,
        discountType: this.discountType,
        discountAmount: this.discountAmount,
        orderType: this.orderType,
        status: markPaid ? 'Paid' : 'Open',
        updatedAt: serverTimestamp(),
        waiter: this.checkoutWaiter || null,
        paymentMode: markPaid ? (this.checkoutPayment || null) : null,
        paymentModeOther: this.checkoutPayment === 'OTHER' ? this.checkoutPaymentOther : null,
        paidAt: markPaid ? serverTimestamp() : null,
        tableNumber: this.orderType === 'Dine-in' ? (this.activeTable?.number || null) : null
      });

      if (!id) {
        orderPayload.createdAt = serverTimestamp();
        orderPayload.startTime = Date.now();
        batch.set(ref, orderPayload);
      } else {
        batch.update(ref, orderPayload);
      }

      if (markPaid) {
        let newTier = this.customerProfile?.tier || 'Standard';
        const newLifetimeSpend = (this.customerProfile?.lifetimeSpend || 0) + this.getCartTotal();

        if (this.loyaltySettings?.tiers) {
           const sortedTiers = [...this.loyaltySettings.tiers].sort((a, b) => b.minPoints - a.minPoints);
           for (const tier of sortedTiers) {
              if (newLifetimeSpend >= tier.minPoints) {
                newTier = tier.name;
                break;
              }
           }
        }

        const custPayload = {
          name: this.checkoutCustomerName,
          mobile: this.checkoutCustomerMobile,
          loyaltyPoints: increment(totalEarned - redeemed),
          lifetimeSpend: increment(this.getCartTotal()),
          visitCount: increment(1),
          tier: newTier, 
          lastVisited: serverTimestamp()
        };

        const localCustRef = doc(this.firestore, this.customersColPath(), this.checkoutCustomerMobile);
        batch.set(localCustRef, custPayload, { merge: true });

        if (baseEarned > 0) batch.set(doc(collection(this.firestore, `${this.customersColPath()}/${this.checkoutCustomerMobile}/pointsTransactions`)), { type: 'EARN', points: baseEarned, orderId: ref.id, createdAt: serverTimestamp(), reason: 'Purchase' });
        if (welcomeBonus > 0) batch.set(doc(collection(this.firestore, `${this.customersColPath()}/${this.checkoutCustomerMobile}/pointsTransactions`)), { type: 'EARN', points: welcomeBonus, orderId: ref.id, createdAt: serverTimestamp(), reason: 'Welcome Bonus' });
        if (milestoneBonus > 0) batch.set(doc(collection(this.firestore, `${this.customersColPath()}/${this.checkoutCustomerMobile}/pointsTransactions`)), { type: 'EARN', points: milestoneBonus, orderId: ref.id, createdAt: serverTimestamp(), reason: `Milestone Bonus (${(this.customerProfile?.visitCount || 0) + 1} Visits)` });
        if (happyHourBonus > 0) batch.set(doc(collection(this.firestore, `${this.customersColPath()}/${this.checkoutCustomerMobile}/pointsTransactions`)), { type: 'EARN', points: happyHourBonus, orderId: ref.id, createdAt: serverTimestamp(), reason: 'Happy Hour Bonus' }); // ⭐ Log HH
        if (redeemed > 0) batch.set(doc(collection(this.firestore, `${this.customersColPath()}/${this.checkoutCustomerMobile}/pointsTransactions`)), { type: 'REDEEM', points: redeemed, orderId: ref.id, createdAt: serverTimestamp(), reason: 'Discount' });

        if (isGlobal) {
          const globalPath = `BrandCustomers/${brandId}/customers`;
          const globalCustRef = doc(this.firestore, globalPath, this.checkoutCustomerMobile);
          batch.set(globalCustRef, custPayload, { merge: true });

          if (baseEarned > 0) batch.set(doc(collection(this.firestore, `${globalPath}/${this.checkoutCustomerMobile}/pointsTransactions`)), { type: 'EARN', points: baseEarned, orderId: ref.id, createdAt: serverTimestamp(), reason: 'Purchase' });
          if (welcomeBonus > 0) batch.set(doc(collection(this.firestore, `${globalPath}/${this.checkoutCustomerMobile}/pointsTransactions`)), { type: 'EARN', points: welcomeBonus, orderId: ref.id, createdAt: serverTimestamp(), reason: 'Welcome Bonus' });
          if (milestoneBonus > 0) batch.set(doc(collection(this.firestore, `${globalPath}/${this.checkoutCustomerMobile}/pointsTransactions`)), { type: 'EARN', points: milestoneBonus, orderId: ref.id, createdAt: serverTimestamp(), reason: `Milestone Bonus (${(this.customerProfile?.visitCount || 0) + 1} Visits)` });
          if (happyHourBonus > 0) batch.set(doc(collection(this.firestore, `${globalPath}/${this.checkoutCustomerMobile}/pointsTransactions`)), { type: 'EARN', points: happyHourBonus, orderId: ref.id, createdAt: serverTimestamp(), reason: 'Happy Hour Bonus' });
          if (redeemed > 0) batch.set(doc(collection(this.firestore, `${globalPath}/${this.checkoutCustomerMobile}/pointsTransactions`)), { type: 'REDEEM', points: redeemed, orderId: ref.id, createdAt: serverTimestamp(), reason: 'Discount' });
        }
      }

      if (this.orderType === 'Dine-in' && this.activeTable?.id) {
        batch.update(doc(this.firestore, this.tablesColPath(), this.activeTable.id), {
          isOccupied: !markPaid,
          status: markPaid ? 'Available' : 'Occupied',
          orderId: markPaid ? null : ref.id,
          waiter: markPaid ? null : (this.checkoutWaiter || null)
        });
      }

      await batch.commit();
      this.cart = []; this.currentOrder = null; this.activeTable = null; this.closeCheckoutPanel();
      alert(markPaid ? 'Paid Successfully' : 'Order Sent to Kitchen');
    } catch (e) { console.error('POS Error:', e); }
  }

  async saveDraft() {
    if (!this.validateMobile(this.checkoutCustomerMobile) || !this.checkoutCustomerName) return;
    try {
      this.assertStore();
      const batch = writeBatch(this.firestore);
      const id = this.currentOrder?.id || this.activeTable?.orderId;
      const ref = id ? doc(this.firestore, this.ordersColPath(), id) : doc(collection(this.firestore, this.ordersColPath()));

      const draftPayload = this.sanitizeData({
        items: this.cart,
        subtotal: this.getCartSubtotal(),
        tax: this.getCartTax(),
        discount: this.getCartDiscount(),
        total: this.getCartTotal(),
        status: 'Draft',
        customerMobile: this.checkoutCustomerMobile,
        customerName: this.checkoutCustomerName,
        waiter: this.checkoutWaiter || null,
        discountType: this.discountType,
        discountAmount: this.discountAmount,
        orderType: this.orderType,
        tableNumber: this.orderType === 'Dine-in' ? (this.activeTable?.number || null) : null,
        updatedAt: serverTimestamp()
      });

      if (id) batch.update(ref, draftPayload);
      else {
        draftPayload.createdAt = serverTimestamp();
        batch.set(ref, draftPayload);
        if (this.orderType === 'Dine-in' && this.activeTable?.id) {
          batch.update(doc(this.firestore, this.tablesColPath(), this.activeTable.id), { isOccupied: true, status: 'Occupied', orderId: ref.id, waiter: this.checkoutWaiter || null });
        }
      }
      await batch.commit(); alert('Draft Saved'); this.closeCheckoutPanel();
    } catch (e) { console.error('POS Error:', e); }
  }

  getBaseEarnedPoints(): number {
    if (!this.loyaltySettings?.isEnabled) return 0;
    const eligibleTotal = this.getCartSubtotal() - this.getCartDiscount();
    let basePoints = Math.floor(eligibleTotal / this.loyaltySettings.earnSpendAmount) * this.loyaltySettings.earnPoints;
    let multiplier = 1;
    if (this.customerProfile && this.loyaltySettings.tiers) {
        const userTier = this.loyaltySettings.tiers.find(t => t.name === this.customerProfile?.tier);
        if (userTier) multiplier = userTier.multiplier || 1;
    }
    let totalBase = basePoints * multiplier;
    if (this.loyaltySettings.maxEarnPerOrder && this.loyaltySettings.maxEarnPerOrder > 0) {
      if (totalBase > this.loyaltySettings.maxEarnPerOrder) {
        totalBase = this.loyaltySettings.maxEarnPerOrder;
      }
    }
    return totalBase;
  }

  getWelcomeBonus(): number {
    if (!this.loyaltySettings?.isEnabled) return 0;
    if (!this.customerProfile || (this.customerProfile.visitCount || 0) === 0) {
      return this.loyaltySettings.welcomeBonusPoints || 0;
    }
    return 0;
  }

  getMilestoneBonus(): number {
    if (!this.loyaltySettings?.isEnabled) return 0;
    const visits = this.customerProfile ? (this.customerProfile.visitCount || 0) : 0;
    const target = this.loyaltySettings.milestoneVisitCount;
    if (target && target > 0 && ((visits + 1) % target === 0)) {
      return this.loyaltySettings.milestoneBonusPoints || 0;
    }
    return 0;
  }

  // ⭐ NEW: Calculate Time-Based Happy Hour Bonus
  getHappyHourBonus(basePoints: number): number {
    if (!this.loyaltySettings?.isHappyHourEnabled || !this.loyaltySettings.happyHourMultiplier) return 0;
    
    const now = new Date();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const currentDay = days[now.getDay()];

    // Check Day
    if (this.loyaltySettings.happyHourDay !== 'Everyday' && this.loyaltySettings.happyHourDay !== currentDay) return 0;

    // Check Time
    const startTime = this.loyaltySettings.happyHourStart || '00:00';
    const endTime = this.loyaltySettings.happyHourEnd || '23:59';
    
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    
    const startTotal = (startH * 60) + startM;
    const endTotal = (endH * 60) + endM;
    const currentTotal = (now.getHours() * 60) + now.getMinutes();

    if (currentTotal >= startTotal && currentTotal <= endTotal) {
      // Bonus is (Multiplier - 1) * Base Points. 
      // e.g., If HH is 2x, bonus is 1x additional points.
      return Math.floor(basePoints * (this.loyaltySettings.happyHourMultiplier - 1));
    }

    return 0;
  }

  calculateEarnedPoints(): number {
    const base = this.getBaseEarnedPoints();
    return base + this.getWelcomeBonus() + this.getMilestoneBonus() + this.getHappyHourBonus(base);
  }

  applyLoyaltyRedemption() {
    if (!this.customerProfile || !this.loyaltySettings) return;
    
    let available = this.customerProfile.loyaltyPoints;
    
    if (available < this.loyaltySettings.minRedeemPoints) {
      alert(`Min. ${this.loyaltySettings.minRedeemPoints} pts required.`);
      return;
    }

    if (this.loyaltySettings.maxRedeemPerOrder && this.loyaltySettings.maxRedeemPerOrder > 0) {
      if (available > this.loyaltySettings.maxRedeemPerOrder) {
         available = this.loyaltySettings.maxRedeemPerOrder;
      }
    }

    const discountVal = (available / this.loyaltySettings.redeemPoints) * this.loyaltySettings.redeemValue;
    const cartMax = this.getCartSubtotal() - this.getCartDiscount();
    
    this.loyaltyDiscount = Math.min(discountVal, cartMax);
    this.pointsToRedeem = (this.loyaltyDiscount / this.loyaltySettings.redeemValue) * this.loyaltySettings.redeemPoints;
    
    if (available === this.loyaltySettings.maxRedeemPerOrder && available < this.customerProfile.loyaltyPoints) {
       alert(`Note: Redemption capped at ${this.loyaltySettings.maxRedeemPerOrder} points per order due to store policy.`);
    }
  }

  async loadLoyaltySettings() {
    try {
      const snap = await getDoc(doc(this.firestore, `Stores/${this.storeId}/settings/loyalty`));
      if (snap.exists()) this.loyaltySettings = snap.data() as LoyaltySettings;
    } catch (e) {}
  }

  async ngOnInit(): Promise<void> {
    this.storeSlug = this.route.snapshot.paramMap.get('storeSlug');
    if (!this.storeSlug) return;
    try {
      const snap = await getDocs(query(collection(this.firestore, 'Stores'), where('slug', '==', this.storeSlug)));
      if (snap.empty) return;
      this.storeId = snap.docs[0].id;
      await this.loadStoreInfo();
      await this.loadGlobalCustomisation();
      await this.loadLoyaltySettings();
    } catch (err) { return; }

    const raws$ = collectionData(query(collection(this.firestore, `Stores/${this.storeId}/rawMaterials`), orderBy('name')), { idField: 'id' });
    const menus$ = collectionData(query(collection(this.firestore, `Stores/${this.storeId}/menuItems`), orderBy('name')), { idField: 'id' });
    const mods$ = collectionData(query(collection(this.firestore, `Stores/${this.storeId}/modifiers`), orderBy('name')), { idField: 'id' });
    const orders$ = collectionData(query(collection(this.firestore, `Stores/${this.storeId}/orders`), orderBy('createdAt', 'desc')), { idField: 'id' });
    const tables$ = collectionData(query(collection(this.firestore, `Stores/${this.storeId}/tables`), orderBy('number')), { idField: 'id' });

    this.subs.push(combineLatest([raws$, menus$, mods$, orders$, tables$]).subscribe({
      next: ({ 0: raws, 1: menus, 2: mods, 3: orders, 4: tables }) => {
        this.rawMaterials = (raws as RawMaterial[]) || [];
        this.menuItems = (menus as MenuItem[]) || [];
        this.modifiers = (mods as Modifier[]) || [];
        this.openOrders = (orders as Order[]) || [];
        this.tables = (tables as Table[]) || [];
        this.computeMenuAvailability();
        const cats: string[] = Array.from(new Set(this.menuItems.map(m => m.category).filter((c): c is string => !!c)));
        this.categories = ['All', ...cats.sort()];
        this.tables = this.tables.map(t => {
          const order = this.openOrders.find(o => o.tableNumber === t.number && o.status !== 'Paid' && o.status !== 'Cancelled');
          return { ...t, isOccupied: !!order, orderId: order ? order.id! : null, status: order ? 'Occupied' : (t.status || 'Available') };
        });
        if (this.activeTable?.orderId) {
          const ord = this.openOrders.find(o => o.id === this.activeTable!.orderId);
          if (ord) {
            this.currentOrder = ord; this.cart = JSON.parse(JSON.stringify(ord.items || []));
            this.discountType = ord.discountType || 'percentage'; this.discountAmount = ord.discountAmount || 0;
            this.checkoutPayment = ord.paymentMode || null; this.checkoutPaymentOther = ord.paymentModeOther || '';
          }
        }
        this.applyFilterAndSearch();
      }
    }));
  }

  ngOnDestroy(): void { this.subs.forEach(s => s.unsubscribe()); this.timerSub?.unsubscribe(); }
  private assertStore() { if (!this.storeId) throw new Error('Store not initialized'); }
  private ordersColPath() { this.assertStore(); return `Stores/${this.storeId}/orders`; }
  private tablesColPath() { this.assertStore(); return `Stores/${this.storeId}/tables`; }
  private rawsColPath() { this.assertStore(); return `Stores/${this.storeId}/rawMaterials`; }
  private customersColPath() { this.assertStore(); return `Stores/${this.storeId}/customers`; }

  getDietType(item: any): 'veg' | 'non-veg' {
    const n = String(item?.name || '').toLowerCase();
    const k = ['chicken', 'mutton', 'meat', 'egg', 'fish', 'prawn', 'beef', 'pork'];
    return (item.isVeg === false || k.some(x => n.includes(x))) ? 'non-veg' : 'veg';
  }

  async loadGlobalCustomisation() {
    if (!this.storeId) return;
    try {
      const snap = await getDoc(doc(this.firestore, `Stores/${this.storeSlug}/settings/customisation`));
      if (snap.exists()) this.globalCustomisation = { ...this.globalCustomisation, ...snap.data() };
    } catch (e) {}
  }

  getEffectiveTaxRate(item: MenuItem): number {
    return (item.taxRate !== undefined && item.taxRate !== null) ? item.taxRate : (this.globalCustomisation.taxPercentage || 0);
  }

  async loadStoreInfo() {
    if (!this.storeId) return;
    try {
      const snap = await getDoc(doc(this.firestore, `Stores/${this.storeId}`));
      if (snap.exists()) this.storeInfo = snap.data();
    } catch (e) {}
  }

  private computeMenuAvailability() {
    this.menuItems = this.menuItems.map(mi => {
      const track = mi.trackInventory ?? true;
      if (!track) return { ...mi, totalServingsInInventory: null };
      if (!mi.recipe?.length) return { ...mi, totalServingsInInventory: 0 };
      let max = Number.POSITIVE_INFINITY;
      for (const ing of mi.recipe) {
        const raw = this.rawMaterials.find(r => r.id === ing.rawMaterialId);
        if (!raw || !ing.quantity) { max = 0; break; }
        const srv = Math.floor((raw.stock ?? 0) / ing.quantity);
        if (srv < max) max = srv;
      }
      return { ...mi, totalServingsInInventory: max === Number.POSITIVE_INFINITY ? null : max };
    });
  }

  applyFilterAndSearch(): void {
    const q = (this.search$.value || '').trim().toLowerCase();
    let items = [...this.menuItems];
    if (this.activeCategory && this.activeCategory !== 'All') items = items.filter(i => i.category === this.activeCategory);
    if (q) items = items.filter(i => (i.name || '').toLowerCase().includes(q) || (i.category || '').toLowerCase().includes(q));
    this.filteredMenuItems = items;
  }

  filterByCategory(cat: string) { this.activeCategory = cat; this.applyFilterAndSearch(); }
  onSearchChange(text: string) { this.search$.next(text); this.applyFilterAndSearch(); }
  addItemFromCard(item: MenuItem) { if (item.modifiers?.length) this.openAddItemPanel(item); else this.addDirectToCart(item); }

  addDirectToCart(item: MenuItem) {
    const tr = this.getEffectiveTaxRate(item);
    this.mergeItemToCart({
      id: item.id, name: item.name, basePrice: item.price, price: item.price, category: item.category,
      quantity: 1, subtotal: item.price, taxRate: tr, taxAmount: item.price * (tr / 100),
      recipe: item.recipe, modifiers: [], totalServingsInInventory: item.totalServingsInInventory ?? null,
      status: 'Pending', foodType: item.foodType, isVeg: item.isVeg
    });
  }

  mergeItemToCart(newItem: CartItem) {
    const idx = this.cart.findIndex(ci => ci.id === newItem.id && JSON.stringify(ci.modifiers || []) === JSON.stringify(newItem.modifiers || []));
    if (idx >= 0) {
      this.cart[idx].quantity += newItem.quantity;
      this.cart[idx].subtotal = this.cart[idx].quantity * this.cart[idx].price;
      this.cart[idx].taxAmount = this.cart[idx].subtotal * (this.cart[idx].taxRate / 100);
    } else { this.cart.push(newItem); }
  }

  openAddItemPanel(mi: MenuItem) {
    this.modalMenuItem = mi; this.modalQuantity = 1; this.modalSelectedModifiers = {};
    mi.modifiers?.forEach(id => {
      const mod = this.modifiers.find(m => m.id === id);
      if (mod?.type === 'variation') {
        const opt = mod.options?.[0];
        this.modalSelectedModifiers[id] = opt ? [{ modifierId: id, modifierName: mod.name, optionLabel: opt.label, optionPrice: opt.price, type: 'variation' }] : [];
      } else if (mod) { this.modalSelectedModifiers[id] = []; }
    });
    this.showAddItemPanel = true;
  }

  toggleAddon(mod: Modifier, opt: ModifierOption) {
    if (!mod.id) return;
    const arr = this.modalSelectedModifiers[mod.id] || [];
    const idx = arr.findIndex(s => s.optionLabel === opt.label);
    if (idx >= 0) arr.splice(idx, 1);
    else arr.push({ modifierId: mod.id!, modifierName: mod.name, optionLabel: opt.label, optionPrice: opt.price, type: 'addon' });
    this.modalSelectedModifiers[mod.id] = [...arr];
  }

  selectVariation(mod: Modifier, opt: ModifierOption) {
    if (mod.id) this.modalSelectedModifiers[mod.id] = [{ modifierId: mod.id, modifierName: mod.name, optionLabel: opt.label, optionPrice: opt.price, type: 'variation' }];
  }

  computeModalPrice(): number {
    if (!this.modalMenuItem) return 0;
    let p = this.modalMenuItem.price || 0;
    Object.values(this.modalSelectedModifiers).forEach(arr => arr?.forEach(sel => p += Number(sel.optionPrice || 0)));
    return p * (this.modalQuantity || 1);
  }

  confirmAddToCart() {
    if (!this.modalMenuItem) return;
    const qty = this.modalQuantity || 1;
    const price = (this.computeModalPrice() / qty);
    const tr = this.getEffectiveTaxRate(this.modalMenuItem);
    const mods: CartModifierSelection[] = [];
    Object.values(this.modalSelectedModifiers).forEach(arr => arr?.forEach(sel => mods.push({ ...sel })));
    this.mergeItemToCart({
      id: this.modalMenuItem.id, name: this.modalMenuItem.name, basePrice: this.modalMenuItem.price,
      price: price, category: this.modalMenuItem.category, quantity: qty, subtotal: price * qty,
      taxRate: tr, taxAmount: (price * qty) * (tr / 100), recipe: this.modalMenuItem.recipe,
      modifiers: mods.sort((a,b) => (a.modifierName || '').localeCompare(b.modifierName || '')),
      totalServingsInInventory: this.modalMenuItem.totalServingsInInventory ?? null, status: 'Pending',
      foodType: this.modalMenuItem.foodType, isVeg: this.modalMenuItem.isVeg 
    });
    this.closeAddItemPanel();
  }

  getCartSubtotal(): number { return this.cart.reduce((s, it) => s + (it.subtotal || 0), 0); }
  getCartDiscount(): number {
    const s = this.getCartSubtotal();
    return this.discountType === 'percentage' ? (s * (Math.min(100, this.discountAmount || 0) / 100)) : Math.min(this.discountAmount || 0, s);
  }
  getCartTax(): number { 
    const s = this.getCartSubtotal(); if (s === 0) return 0;
    return this.cart.reduce((sum, it) => sum + (it.taxAmount || 0), 0) * (1 - ((this.getCartDiscount() + this.loyaltyDiscount) / s));
  }
  getCartTotal(): number { return Math.max(0, this.getCartSubtotal() - this.getCartDiscount() - this.loyaltyDiscount + this.getCartTax()); }

  updateCartItemQuantity(it: CartItem, q: number) {
    if (q <= 0) { this.removeItemFromCart(it); return; }
    it.quantity = q; it.subtotal = q * it.price; it.taxAmount = it.subtotal * (it.taxRate / 100);
  }
  removeItemFromCart(it: CartItem) { this.cart = this.cart.filter(c => c !== it); }
  getCartItemModifierSummary(it: CartItem): string { return it.modifiers?.map(m => m.optionLabel).join(', ') || ''; }

  get suggestedItems(): MenuItem[] {
    const ids = this.cart.map(i => i.id);
    const cats = Array.from(new Set(this.cart.map(i => i.category).filter((c): c is string => !!c)));
    return this.menuItems.filter(i => i.isActive && i.id && !ids.includes(i.id) && (cats.includes(i.category || '') || i.category === 'Desserts')).slice(0, 6);
  }

  validateMobile(m?: string): boolean {
    const regex = /^\+?(\d[\s-]?){8,15}\d$/;
    this.mobileError = (m && regex.test(m)) ? null : 'Invalid Format';
    return !this.mobileError;
  }

  openCheckoutPanel() {
    if (!this.cart.length) return;
    if (this.currentOrder) {
      this.checkoutCustomerName = this.currentOrder.customerName || '';
      this.checkoutCustomerMobile = this.currentOrder.customerMobile || '';
      this.checkoutWaiter = this.currentOrder.waiter || '';
      this.checkoutPayment = this.currentOrder.paymentMode || null;
      this.checkoutPaymentOther = this.currentOrder.paymentModeOther || '';
    } else {
      this.checkoutCustomerName = ''; this.checkoutCustomerMobile = ''; this.checkoutWaiter = this.activeTable?.waiter || '';
      this.checkoutPayment = null; this.checkoutPaymentOther = '';
    }
    this.showCheckoutPanel = true;
  }

  async markAsPaid(order?: Order) {
    const target = order || this.currentOrder;
    if (!target?.id || !this.storeId) return;
    const batch = writeBatch(this.firestore);
    batch.update(doc(this.firestore, this.ordersColPath(), target.id), { status: 'Paid', paidAt: serverTimestamp() });
    const table = this.tables.find(t => t.orderId === target.id || t.number === target.tableNumber);
    if (table?.id) batch.update(doc(this.firestore, this.tablesColPath(), table.id), { isOccupied: false, status: 'Available', orderId: null, waiter: null });
    await batch.commit();
  }

  async loadCustomerByMobile(m?: string) {
    if (!this.validateMobile(m) || !this.storeId) return;

    let finalData: any = null;
    const brandId = this.storeInfo?.ownerId || this.storeInfo?.adminUid;
    const isGlobal = this.loyaltySettings?.isCrossStoreLoyaltyEnabled && brandId;

    try {
        const localSnap = await getDoc(doc(this.firestore, this.customersColPath(), m!));
        const localData = localSnap.exists() ? localSnap.data() : null;

        if (isGlobal) {
            const globalSnap = await getDoc(doc(this.firestore, `BrandCustomers/${brandId}/customers`, m!));
            if (globalSnap.exists()) {
                finalData = globalSnap.data();
            } else if (localData) {
                finalData = localData;
                setDoc(doc(this.firestore, `BrandCustomers/${brandId}/customers`, m!), localData, { merge: true });
            }
        } else {
            finalData = localData;
        }

        if (finalData) {
            this.checkoutCustomerName = finalData['name'] || '';
            this.customerProfile = {
                name: finalData['name'] || '',
                mobile: m!,
                loyaltyPoints: finalData['loyaltyPoints'] || 0,
                lifetimeSpend: finalData['lifetimeSpend'] || 0,
                visitCount: finalData['visitCount'] || 0,
                tier: finalData['tier'] || 'Standard'
            };
        } else {
            this.customerProfile = null;
        }
    } catch(e) {
        console.error(e);
    }
  }

  resumeDraft(ord: Order) {
    this.currentOrder = ord; this.cart = JSON.parse(JSON.stringify(ord.items || []));
    this.checkoutCustomerMobile = ord.customerMobile || ''; this.orderType = ord.orderType;
    this.activeTable = ord.tableNumber ? this.tables.find(t => t.number === ord.tableNumber) || null : null;
    this.activeTab = 'menu'; this.showRunningOrdersPanel = false;
  }

  selectOrCreateTable(table: Table) {
    this.activeTable = table; this.orderType = 'Dine-in';
    this.currentOrder = this.openOrders.find(o => o.tableNumber === table.number && o.status !== 'Paid' && o.status !== 'Cancelled') || null;
    this.cart = this.currentOrder ? JSON.parse(JSON.stringify(this.currentOrder.items)) : [];
    this.activeTab = 'menu';
  }

  startTakeaway() { this.orderType = 'Takeaway'; this.activeTable = null; this.currentOrder = null; this.cart = []; this.activeTab = 'menu'; }
  openTableModal(t?: Table) { this.editingTable = t || null; this.newTable = t ? { ...t } : { number: 0, capacity: 4 }; this.showTableModal = true; }
  exitToDashboard() { this.router.navigate(['/', this.storeSlug, 'dashboard']); }
  toggleRunningOrders() { this.showRunningOrdersPanel = !this.showRunningOrdersPanel; }
  get runningOrders() { return this.openOrders.filter(o => o.status !== 'Paid' && o.status !== 'Cancelled'); }
  get activeOrders() { return this.openOrders.filter(o => o.status !== 'Draft' && o.status !== 'Paid' && o.status !== 'Cancelled'); }
  getTimer(o: Order) { const d = Math.floor((Date.now() - (o.startTime || 0))/1000); return `${Math.floor(d/60)}:${(d%60)<10?'0':''}${d%60}`; }
  recalculateDiscount() { this.discountAmount = Math.max(0, this.discountType === 'percentage' ? Math.min(100, this.discountAmount) : this.discountAmount); } 
  getModifierById(id: string) { return this.modifiers.find(m => m.id === id); }
  isAddonSelected(mid: string, lbl: string) { return this.modalSelectedModifiers[mid]?.some(s => s.optionLabel === lbl) || false; }
  isVariationSelected(mid: string, lbl: string) { return this.modalSelectedModifiers[mid]?.[0]?.optionLabel === lbl; }

  async printCurrentInvoice(invoiceData?: any, orderToPrint?: Order) {
    const d = orderToPrint || invoiceData || { items: this.cart, subtotal: this.getCartSubtotal(), tax: this.getCartTax(), discount: this.getCartDiscount() + this.loyaltyDiscount, total: this.getCartTotal() };
    if (!d.items?.length) return;
    const html = `<html><body onload="window.print(); window.close();"><h3 style="text-align:center">${this.storeInfo?.name || 'POS'}</h3><hr/>${d.items.map((i:any)=>`<div>${i.name} x${i.quantity} <span style="float:right">${i.subtotal.toFixed(2)}</span></div>`).join('')}<hr/><div>Total: ₹${d.total.toFixed(2)}</div></body></html>`;
    window.open('', '', 'height=600,width=400')?.document.write(html);
  }
}