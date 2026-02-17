import { Component, OnInit, inject, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BaseChartDirective } from 'ng2-charts';
import { ChartOptions, ChartData } from 'chart.js';
import {
  Firestore, collection, query, orderBy, onSnapshot, DocumentData, QuerySnapshot,
  where, getDocs, Timestamp, setDoc, doc
} from '@angular/fire/firestore';
import { AiService } from '../../services/ai.service';
import { ActivatedRoute } from '@angular/router';

/* ---------------------------- Interfaces ---------------------------- */
interface Batch { id: string; qty: number; expiryDate: string; }
interface SupplierDoc { id?: string; name: string; leadTimes?: number[]; fillRates?: number[]; costHistory?: number[]; associatedItems?: string[]; }
interface Adjustment { id?: string; category: string; cost: number; date?: string; }
interface Purchase { id?: string; createdAt?: any; total?: number; supplierId?: string; items?: any[]; }
interface Order { id?: string; paidAt?: any; total?: number; paymentMode?: string; items?: any[]; }

interface RawMaterial {
  id?: string;
  name: string;
  type: 'raw-material';
  category: string;
  stock?: number;
  unit?: string;
  costPerUnit?: number;
  isActive: boolean;
  lowStockThreshold?: number;
  supplierId?: string | null;
  supplierName?: string; 
  expiryDate?: string | null;
  batches?: Batch[];
}

interface MenuItem {
  id?: string;
  name: string;
  type: 'menu-item';
  category: string;
  price?: number;
  isActive: boolean;
  recipe?: { rawMaterialId: string; name: string; quantity: number; unit: string }[];
}

interface PurchaseOrderItem {
  itemId: string;
  itemName: string;
  type: string;
  quantity: number;
  receivedQty: number;
  unit: string;
  price: number;
  gstPercent: number;
  total: number;
}

interface PurchaseOrder {
  id?: string;
  poNumber?: string;
  supplierId: string;
  supplierName?: string;
  status: 'draft' | 'finalized' | 'partially_received' | 'received' | 'cancelled';
  poDate: any;
  expectedDate?: any;
  items: PurchaseOrderItem[];
  subtotal: number;
  gstTotal: number;
  grandTotal: number;
  notes?: string;
}

interface ReorderSuggestion { id?: string; name: string; suggestQty: number; reason: string }

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, BaseChartDirective],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class DashboardComponent implements OnInit {
  private firestore = inject(Firestore);
  private ai = inject(AiService);
  private route = inject(ActivatedRoute);

  storeSlug: string = '';

  // Data State
  rawMaterials: RawMaterial[] = [];
  menuItems: MenuItem[] = [];
  purchases: Purchase[] = [];
  orders: Order[] = [];
  adjustments: Adjustment[] = [];
  suppliers: SupplierDoc[] = [];

  // Derived State
  lowStockItems: RawMaterial[] = [];
  topCategories: { name: string; value: number }[] = [];
  expiryAlerts: Batch[] = [];
  supplierPerformance: { name: string; avgLead: string; avgFill: string; lastCost: number }[] = [];
  wastageStats: { category: string; cost: number }[] = [];
  aiReorderSuggestions: ReorderSuggestion[] = [];

  /* ------------------------------- KPIs ------------------------------- */
  get inventoryValue(): number {
    return Math.round(this.rawMaterials.reduce((s, i) => s + ((i.costPerUnit || 0) * (i.stock || 0)), 0));
  }
  get lowStockCount(): number {
    return this.rawMaterials.filter(i => (i.stock || 0) < (i.lowStockThreshold ?? 10)).length;
  }
  get activeRawMaterialsCount(): number {
    return this.rawMaterials.filter(i => i.isActive).length;
  }
  get activeMenuItemsCount(): number {
    return this.menuItems.filter(i => i.isActive).length;
  }

  /* ---------------------- Chart Config ---------------------- */
  inventoryDoughnut: ChartData<'doughnut'> = { labels: [], datasets: [] };
  inventoryLine: ChartData<'line'> = { labels: [], datasets: [] };
  purchaseBar: ChartData<'bar'> = { labels: [], datasets: [] };
  kpiSparklines: Record<string, ChartData<'line'>> = {
    inventoryValue: { labels: [], datasets: [] },
    lowStock: { labels: [], datasets: [] },
    rawMaterials: { labels: [], datasets: [] },
    menuItems: { labels: [], datasets: [] }
  };

  chartOptions: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' } }
  };

  sparklineOptions: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    scales: { x: { display: false }, y: { display: false } }
  };

  async ngOnInit() {
    const root = this.route.snapshot.root;
    this.storeSlug = root.firstChild?.paramMap.get('storeSlug') || '';

    if (this.storeSlug) {
      // 1. Setup real-time listeners
      this.initListeners();
      
      // 2. Run Auto-PO Logic (Consolidated check)
      await this.autoCreateLowStockPOs();
      
      // 3. AI suggestions
      this.ai.getReorderSuggestions().then(s => this.aiReorderSuggestions = s);
    }
  }

  private initListeners() {
    this.listenRawMaterials();
    this.listenMenuItems();
    this.listenPurchases();
    this.listenOrders();
    this.listenAdjustments();
    this.listenSuppliers();
  }

  /**
   * ⭐ UPDATED: Auto-create Draft POs.
   * Logic: Consolidates low stock items by supplier. Checks if a draft already exists 
   * to avoid cluttering the system on every dashboard refresh.
   */
  async autoCreateLowStockPOs(): Promise<void> {
    if (!this.storeSlug) return;

    try {
      // Fetch current snapshots for logic check
      const [rawSnap, poSnap, supSnap] = await Promise.all([
        getDocs(collection(this.firestore, `Stores/${this.storeSlug}/rawMaterials`)),
        getDocs(query(collection(this.firestore, `Stores/${this.storeSlug}/purchaseOrders`), 
                where('status', 'in', ['draft', 'finalized', 'partially_received']))),
        getDocs(collection(this.firestore, `Stores/${this.storeSlug}/suppliers`))
      ]);

      const allRaw = rawSnap.docs.map(d => ({ id: d.id, ...(d.data() as RawMaterial) }));
      const allSuppliers = supSnap.docs.map(d => ({ id: d.id, ...(d.data() as SupplierDoc) }));
      
      // Map items already in active POs
      const itemsInProcess = new Set<string>();
      const existingDraftsBySupplier = new Set<string>(); // Keep track of suppliers that already have a draft

      poSnap.docs.forEach(doc => {
        const po = doc.data() as PurchaseOrder;
        po.items.forEach(item => itemsInProcess.add(item.itemId));
        if (po.status === 'draft') {
          existingDraftsBySupplier.add(po.supplierId || 'NO_SUPPLIER');
        }
      });

      // Filter for items that are low stock AND not currently being ordered
      const toOrder = allRaw.filter(i => 
        i.isActive && (i.stock || 0) < (i.lowStockThreshold ?? 10) && !itemsInProcess.has(i.id!)
      );

      if (toOrder.length === 0) return;

      // Group items by Supplier
      const supplierGroups: Record<string, PurchaseOrderItem[]> = {};
      for (const item of toOrder) {
        const sKey = item.supplierId || 'NO_SUPPLIER';
        
        // Prevent creating multiple draft POs for the same supplier
        if (existingDraftsBySupplier.has(sKey)) continue;

        const qty = (item.lowStockThreshold ?? 10) + 10 - (item.stock || 0);
        const poItem: PurchaseOrderItem = {
          itemId: item.id!,
          itemName: item.name,
          type: 'Raw Material',
          quantity: qty,
          receivedQty: 0,
          unit: item.unit || 'unit',
          price: item.costPerUnit || 0,
          gstPercent: 0,
          total: qty * (item.costPerUnit || 0)
        };

        if (!supplierGroups[sKey]) supplierGroups[sKey] = [];
        supplierGroups[sKey].push(poItem);
      }

      // Create documents
      for (const [supId, items] of Object.entries(supplierGroups)) {
        const supplier = allSuppliers.find(s => s.id === supId);
        const total = items.reduce((sum, i) => sum + i.total, 0);

        const newPo: PurchaseOrder = {
          poNumber: 'AUTO-' + Math.random().toString(36).substring(7).toUpperCase(),
          supplierId: supId === 'NO_SUPPLIER' ? '' : supId,
          supplierName: supplier?.name || 'Unassigned Supplier',
          status: 'draft',
          poDate: Timestamp.now(),
          items: items,
          subtotal: total,
          gstTotal: 0,
          grandTotal: total,
          notes: 'System generated draft for low stock items.'
        };

        const poRef = doc(collection(this.firestore, `Stores/${this.storeSlug}/purchaseOrders`));
        await setDoc(poRef, { ...newPo, id: poRef.id });
      }
    } catch (e) {
      console.error("Auto-PO failed", e);
    }
  }

  /* ---------------------- Firestore Listeners ---------------------- */
  private listenRawMaterials() {
    const q = query(collection(this.firestore, `Stores/${this.storeSlug}/rawMaterials`), orderBy('name', 'asc'));
    onSnapshot(q, (snap) => {
      const supplierMap = new Map(this.suppliers.map(s => [s.id, s.name]));
      this.rawMaterials = snap.docs.map(d => {
        const data = d.data() as RawMaterial;
        return { ...data, id: d.id, supplierName: data.supplierId ? supplierMap.get(data.supplierId) || 'Unassigned' : '—' };
      });
      this.recomputeAllDerived();
    });
  }

  private listenMenuItems() {
    onSnapshot(collection(this.firestore, `Stores/${this.storeSlug}/menuItems`), (snap) => {
      this.menuItems = snap.docs.map(d => ({ id: d.id, ...(d.data() as MenuItem) }));
      this.recomputeAllDerived();
    });
  }

  private listenPurchases() {
    onSnapshot(collection(this.firestore, `Stores/${this.storeSlug}/purchases`), (snap) => {
      this.purchases = snap.docs.map(d => ({ id: d.id, ...(d.data() as Purchase) }));
      this.recomputeAllDerived();
    });
  }

  private listenOrders() {
    onSnapshot(collection(this.firestore, `Stores/${this.storeSlug}/orders`), (snap) => {
      this.orders = snap.docs.map(d => ({ id: d.id, ...(d.data() as Order) }));
      this.recomputeAllDerived();
    });
  }

  private listenAdjustments() {
    onSnapshot(collection(this.firestore, `Stores/${this.storeSlug}/adjustments`), (snap) => {
      this.adjustments = snap.docs.map(d => ({ id: d.id, ...(d.data() as Adjustment) }));
      this.recomputeAllDerived();
    });
  }

  private listenSuppliers() {
    onSnapshot(collection(this.firestore, `Stores/${this.storeSlug}/suppliers`), (snap) => {
      this.suppliers = snap.docs.map(d => ({ id: d.id, ...(d.data() as SupplierDoc) }));
      this.recomputeAllDerived();
    });
  }

  /* ---------------------- Data Processing ---------------------- */
  private recomputeAllDerived() {
    this.buildLowStock();
    this.buildCharts();
    this.buildSparklines();
    this.buildExpiryAlerts();
    this.buildSupplierPerformance();
    this.buildWastageStats();
  }

  private buildLowStock() {
    this.lowStockItems = this.rawMaterials
      .filter(i => (i.stock || 0) < (i.lowStockThreshold ?? 10))
      .sort((a, b) => (a.stock || 0) - (b.stock || 0))
      .slice(0, 10);
      
    const byCat: Record<string, number> = {};
    this.rawMaterials.forEach(i => {
      const val = (i.costPerUnit || 0) * (i.stock || 0);
      byCat[i.category || 'Other'] = (byCat[i.category || 'Other'] || 0) + val;
    });
    this.topCategories = Object.entries(byCat).map(([name, value]) => ({ name, value }))
      .sort((a,b) => b.value - a.value).slice(0,5);
  }

  private buildCharts() {
    this.inventoryDoughnut = {
      labels: this.topCategories.map(t => t.name),
      datasets: [{
        data: this.topCategories.map(t => t.value),
        backgroundColor: ['#0f2540', '#10B981', '#f59e0b', '#2563eb', '#ef4444']
      }]
    };

    const days = this.buildDateLabels(14);
    this.inventoryLine = {
      labels: days,
      datasets: [{
        label: 'Value',
        data: days.map(() => Math.round(this.inventoryValue * (0.9 + Math.random() * 0.2))),
        borderColor: '#0f2540',
        fill: true,
        backgroundColor: 'rgba(15, 37, 64, 0.05)'
      }]
    };
  }

  private buildSparklines() {
    const empty = Array(12).fill(0);
    const generateData = (base: number) => empty.map(() => base + (Math.random() * 10));
    
    this.kpiSparklines['inventoryValue'] = { labels: empty, datasets: [{ data: generateData(this.inventoryValue), borderColor: '#0f2540' }] };
    this.kpiSparklines['lowStock'] = { labels: empty, datasets: [{ data: generateData(this.lowStockCount), borderColor: '#f59e0b' }] };
    this.kpiSparklines['rawMaterials'] = { labels: empty, datasets: [{ data: generateData(this.activeRawMaterialsCount), borderColor: '#10B981' }] };
    this.kpiSparklines['menuItems'] = { labels: empty, datasets: [{ data: generateData(this.activeMenuItemsCount), borderColor: '#2563eb' }] };
  }

  private buildExpiryAlerts() {
    const soon = new Date(); soon.setDate(soon.getDate() + 7);
    this.expiryAlerts = this.rawMaterials.flatMap(i => (i.batches || [])).filter(b => new Date(b.expiryDate) <= soon);
  }

  private buildSupplierPerformance() {
    this.supplierPerformance = this.suppliers.map(s => ({
      name: s.name,
      avgLead: s.leadTimes?.length ? (s.leadTimes.reduce((a,b)=>a+b,0)/s.leadTimes.length).toFixed(1) : '—',
      avgFill: s.fillRates?.length ? Math.round((s.fillRates.reduce((a,b)=>a+b,0)/s.fillRates.length)*100)+'%' : '—',
      lastCost: s.costHistory?.length ? s.costHistory[s.costHistory.length-1] : 0
    }));
  }

  private buildWastageStats() {
    const byCat: Record<string, number> = {};
    this.adjustments.forEach(a => byCat[a.category] = (byCat[a.category] || 0) + a.cost);
    this.wastageStats = Object.entries(byCat).map(([category, cost]) => ({ category, cost }));
  }

  async generateAiReorder() {
    this.aiReorderSuggestions = [];
    const lowItems = this.rawMaterials.filter(i => (i.stock || 0) <= (i.lowStockThreshold || 10));
    for (const item of lowItems) {
      const qty = Math.max(10, (item.lowStockThreshold || 10) * 2);
      await this.ai.saveReorderSuggestion({ name: item.name, suggestQty: qty, reason: 'Low stock detected by AI.' });
    }
    this.aiReorderSuggestions = await this.ai.getReorderSuggestions();
  }

  getItemNameByBatch(batchId: string): string {
    return this.rawMaterials.find(i => i.batches?.some(b => b.id === batchId))?.name || 'Item';
  }

  private buildDateLabels(days: number) {
    return Array.from({length: days}, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (days - 1 - i));
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    });
  }
}