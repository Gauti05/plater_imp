import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  Firestore,
  collection,
  doc,
  setDoc,
  updateDoc,
  getDoc,
  getDocs,
  Timestamp,
  runTransaction,
  query,
  where,
  documentId
} from '@angular/fire/firestore';
import { ActivatedRoute, Router } from '@angular/router';
import { Auth, authState } from '@angular/fire/auth'; 

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
  poDate: string | any;
  expectedDate?: string | any;
  items: PurchaseOrderItem[];
  subtotal: number;
  gstTotal: number;
  grandTotal: number;
  notes?: string;
}

type ToastType = 'success' | 'error' | 'info';

@Component({
  selector: 'app-add-purchase-order',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './add-purchase-order.component.html',
  styleUrls: ['./add-purchase-order.component.css']
})
export class AddPurchaseOrderComponent implements OnInit {
  private firestore = inject(Firestore);
  private route = inject(ActivatedRoute);
  public router = inject(Router);
  private fireAuth = inject(Auth);

  suppliers: { id: string; name: string }[] = [];
  
  itemsCatalog: { id: string; name: string; unit?: string; type: string; defaultPrice: number }[] = [];

  public persistedPO: PurchaseOrder | null = null;

  purchaseOrder: PurchaseOrder = {
    supplierId: '',
    status: 'draft',
    poDate: this.toIsoDateString(new Date()),
    expectedDate: '',
    items: [],
    subtotal: 0,
    gstTotal: 0,
    grandTotal: 0,
    notes: ''
  };

  isEditMode = false;
  storeSlug: string = '';
  
  targetStoreSlug: string = '';
  availableStores: { slug: string, name: string }[] = [];

  public toastMessages: { id: number; text: string; type: ToastType }[] = [];
  private toastCounter = 0;
  private readonly TOAST_TIMEOUT = 4500;

  async ngOnInit() {
    const root = this.route.snapshot.root;
    this.storeSlug = root.firstChild?.paramMap.get('storeSlug') || '';
    this.targetStoreSlug = this.storeSlug;

    const id = this.route.snapshot.paramMap.get('id') || undefined;
    this.isEditMode = !!id;

    authState(this.fireAuth).subscribe(async (user) => {
      if (user) {
        const userDoc = await getDoc(doc(this.firestore, `Users/${user.uid}`));
        const userData = userDoc.data();
        if (userData) {
          await this.loadMyStores(user.uid, userData['storeId'], userData['userRole']); 
        }
      }
    });

    await this.loadStoreData(this.targetStoreSlug);

    if (id) {
      const docRef = doc(this.firestore, `Stores/${this.targetStoreSlug}/purchaseOrders/${id}`);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const raw = docSnap.data() as any;
        this.purchaseOrder = {
          id: docSnap.id,
          ...raw,
          poDate: raw.poDate?.toDate ? this.toIsoDateString(raw.poDate.toDate()) : raw.poDate,
          expectedDate: raw.expectedDate?.toDate ? this.toIsoDateString(raw.expectedDate.toDate()) : raw.expectedDate,
          items: (raw.items || []).map((it: any) => ({ ...it, receivedQty: it.receivedQty || 0 }))
        };
        this.persistedPO = JSON.parse(JSON.stringify(this.purchaseOrder));
      }
    } else {
      this.purchaseOrder.poNumber = 'PO-' + Date.now();
    }

    this.recalculateTotals();
  }

  async loadMyStores(uid: string, assignedStoreId: string, role: string) {
    const storesRef = collection(this.firestore, 'Stores');
    if (role === 'Superadmin') {
      const snap = await getDocs(query(storesRef));
      this.availableStores = snap.docs.map(d => ({ slug: d.data()['slug'] || d.id, name: d.data()['name'] || d.id }));
    } else {
      const qAssigned = getDocs(query(storesRef, where(documentId(), '==', assignedStoreId || '')));
      const qOwned = getDocs(query(storesRef, where('ownerId', '==', uid)));
      const [snapAssigned, snapOwned] = await Promise.all([qAssigned, qOwned]);
      const allDocs = [...snapAssigned.docs, ...snapOwned.docs];
      this.availableStores = Array.from(new Set(allDocs.map(d => d.id)))
        .map(id => {
          const d = allDocs.find(doc => doc.id === id);
          return { slug: d?.data()['slug'] || id, name: d?.data()['name'] || id };
        });
    }
  }

  async loadStoreData(slug: string) {
    const supCol = collection(this.firestore, `Stores/${slug}/suppliers`);
    const supSnap = await getDocs(supCol);
    this.suppliers = supSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));

    const rawCol = collection(this.firestore, `Stores/${slug}/rawMaterials`);
    const rawSnap = await getDocs(rawCol);

    this.itemsCatalog = rawSnap.docs.map(d => {
      const data = d.data() as any;
      return { id: d.id, ...data, type: 'Raw Material', defaultPrice: data.costPerUnit || 0 };
    });
  }

  async onTargetStoreChange() {
    this.purchaseOrder.items = [];
    this.purchaseOrder.supplierId = '';
    this.recalculateTotals();
    await this.loadStoreData(this.targetStoreSlug);
    this.showToast('Catalog updated for selected outlet', 'info');
  }

  addLineItem() {
    this.purchaseOrder.items.push({
      itemId: '', itemName: '', type: '', quantity: 1, receivedQty: 0,
      unit: '', price: 0, gstPercent: 0, total: 0
    });
  }

  removeLineItem(i: number) {
    this.purchaseOrder.items.splice(i, 1);
    this.recalculateTotals();
    this.showToast('Line removed', 'info');
  }

  onItemChange(line: PurchaseOrderItem) {
    const selected = this.itemsCatalog.find(i => i.id === line.itemId);
    if (selected) {
      line.itemName = selected.name;
      line.unit = selected.unit || '';
      line.type = selected.type;
      line.price = selected.defaultPrice || 0; 
    }
    this.recalculateTotals();
  }

  recalculateTotals() {
    let subtotal = 0, gstTotal = 0;
    for (const item of this.purchaseOrder.items) {
      const selected = this.itemsCatalog.find(i => i.id === item.itemId);
      if (selected) {
        item.itemName = selected.name; item.unit = selected.unit || ''; item.type = selected.type;
      }
      item.total = item.quantity * item.price;
      subtotal += item.total;
      gstTotal += (item.total * (item.gstPercent || 0)) / 100;
    }
    this.purchaseOrder.subtotal = subtotal;
    this.purchaseOrder.gstTotal = gstTotal;
    this.purchaseOrder.grandTotal = subtotal + gstTotal;
  }

  async savePurchaseOrder(finalize: boolean = false) {
    if (!this.purchaseOrder.id && !this.isEditMode) {
      this.showToast('Please add items and save as draft before finalizing.', 'info');
    }
    
    const colRef = collection(this.firestore, `Stores/${this.targetStoreSlug}/purchaseOrders`);
    
    if (finalize || this.purchaseOrder.status === 'draft' || this.purchaseOrder.status === 'finalized') {
        this.purchaseOrder.status = finalize ? 'finalized' : 'draft';
    }

    if (this.purchaseOrder.supplierId) {
      const supplier = this.suppliers.find(s => s.id === this.purchaseOrder.supplierId);
      this.purchaseOrder.supplierName = supplier?.name || '';
    }
    
    this.recalculateTotals();

    const toSave = {
      ...this.purchaseOrder,
      poDate: this.parseDateToTimestamp(this.purchaseOrder.poDate),
      expectedDate: this.purchaseOrder.expectedDate ? this.parseDateToTimestamp(this.purchaseOrder.expectedDate) : null
    };

    if (this.isEditMode && this.purchaseOrder.id) {
      await updateDoc(doc(colRef, this.purchaseOrder.id), toSave as any);
      this.showToast(`Updated for ${this.targetStoreSlug}`, 'success');
    } else {
      const newDocRef = doc(colRef);
      this.purchaseOrder.id = newDocRef.id;
      await setDoc(newDocRef, { ...toSave, id: newDocRef.id } as any);
      this.isEditMode = true;
      this.showToast(`Purchase Finalized & Dispatched to ${this.targetStoreSlug}`, 'success');
    }

    if (this.purchaseOrder.id) {
      const ref = await getDoc(doc(this.firestore, `Stores/${this.targetStoreSlug}/purchaseOrders/${this.purchaseOrder.id}`));
      if (ref.exists()) {
        this.persistedPO = { id: ref.id, ...(ref.data() as any) } as PurchaseOrder;
      }
    }

    // ⭐ NEW FIX: Navigate back to the list if user clicks Finalize
    if (finalize) {
      setTimeout(() => {
        this.router.navigate(['/', this.storeSlug, 'inventory', 'purchase-orders']);
      }, 1000); // 1-second delay so they can see the success toast
    }
  }
  
  async cancelPurchaseOrder() {
    if (!this.purchaseOrder.id) {
      this.showToast('Cannot cancel. Save the PO first.', 'error');
      return;
    }
    if (this.purchaseOrder.status === 'cancelled') {
        this.showToast('The purchase order is already cancelled.', 'info');
        return;
    }

    try {
      await updateDoc(doc(this.firestore, `Stores/${this.targetStoreSlug}/purchaseOrders/${this.purchaseOrder.id}`), {
        status: 'cancelled'
      });
      
      this.purchaseOrder.status = 'cancelled';
      this.showToast('Purchase Order cancelled successfully.', 'success');
      if (this.persistedPO) this.persistedPO.status = 'cancelled';
    } catch (e) {
      console.error('Cancellation failed:', e);
      this.showToast('Failed to cancel purchase order.', 'error');
    }
  }

  needsSave(line: PurchaseOrderItem): boolean {
    const persisted = this.getPersistedReceived(line.itemId);
    return persisted !== line.receivedQty;
  }

  async saveReceived(line: PurchaseOrderItem) {
    if (!this.purchaseOrder.id) {
      this.showToast('Save/finalize PO first', 'info');
      return;
    }
    if (this.purchaseOrder.status === 'cancelled') {
        this.showToast('Cannot update received quantity on a cancelled PO.', 'error');
        return;
    }

    const poRef = doc(this.firestore, `Stores/${this.targetStoreSlug}/purchaseOrders/${this.purchaseOrder.id}`);
    try {
      await runTransaction(this.firestore as any, async tx => {
        const poSnap = await tx.get(poRef);
        if (!poSnap.exists()) throw new Error('PO not found');
        const serverPO = poSnap.data() as PurchaseOrder;
        const persistedItem = serverPO.items.find(i => i.itemId === line.itemId);
        const prev = persistedItem ? (persistedItem.receivedQty || 0) : 0;
        const delta = line.receivedQty - prev;

        if (delta > 0) {
          const collectionName = line.type === 'Raw Material' ? 'rawMaterials' : 'menuItems';
          const itemRef = doc(this.firestore, `Stores/${this.targetStoreSlug}/${collectionName}/${line.itemId}`);
          const itemSnap = await tx.get(itemRef);
          if (itemSnap.exists()) {
            const stock = Number(itemSnap.data()['stock'] || 0);
            tx.update(itemRef, { stock: stock + delta });
          }
        }

        const items = [...serverPO.items];
        const idx = items.findIndex(i => i.itemId === line.itemId);
        if (idx >= 0) items[idx].receivedQty = line.receivedQty;
        else items.push({ ...line }); 

        tx.update(poRef, { items });
      });

      this.showToast('Stock updated successfully.', 'success');
      await this.syncStatusFromReceived();

      const snap = await getDoc(poRef);
      if (snap.exists()) {
        const raw = snap.data() as any;
        this.persistedPO = { 
            id: snap.id, ...raw,
            items: (raw.items || []).map((it: any) => ({ ...it, receivedQty: it.receivedQty || 0 }))
        } as PurchaseOrder;
      }
    } catch (e) {
      console.error(e);
      this.showToast('Failed saving received: ' + (e as any).message, 'error');
    }
  }

  private async syncStatusFromReceived() {
    if (!this.purchaseOrder.id) return;
    const snap = await getDoc(doc(this.firestore, `Stores/${this.targetStoreSlug}/purchaseOrders/${this.purchaseOrder.id}`));
    if (!snap.exists()) return;
    const po = snap.data() as PurchaseOrder;
    
    if (po.status === 'cancelled') return; 

    const all = po.items.every(i => (i.receivedQty || 0) >= (i.quantity || 0));
    const any = po.items.some(i => (i.receivedQty || 0) > 0);
    
    let newStatus: PurchaseOrder['status'] = po.status;
    if (all) newStatus = 'received';
    else if (any) newStatus = 'partially_received';
    else if (po.status === 'draft') newStatus = 'draft';
    else newStatus = 'finalized'; 

    if (newStatus !== po.status) {
      await updateDoc(doc(this.firestore, `Stores/${this.targetStoreSlug}/purchaseOrders/${this.purchaseOrder.id}`), { status: newStatus });
      this.purchaseOrder.status = newStatus;
    }
  }

  getPersistedReceived(itemId: string) {
    const found = this.persistedPO?.items.find(i => i.itemId === itemId);
    return found ? (found.receivedQty || 0) : 0;
  }
  showToast(text: string, type: ToastType = 'info') {
    const id = ++this.toastCounter;
    this.toastMessages.push({ id, text, type });
    setTimeout(() => this.dismissToast(id), this.TOAST_TIMEOUT);
  }
  dismissToast(id: number) { this.toastMessages = this.toastMessages.filter(t => t.id !== id); }
  private toIsoDateString(d: Date) { return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`; }
  private parseDateToTimestamp(val: any) {
    if (!val) return null;
    if (typeof val === 'string') {
      const parts = val.split('-').map(Number);
      return Timestamp.fromDate(new Date(parts[0], parts[1] - 1, parts[2]));
    }
    return Timestamp.now();
  }
}