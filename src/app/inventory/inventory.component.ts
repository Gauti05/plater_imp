import { Component, ViewEncapsulation, OnInit, inject, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterOutlet, RouterLinkActive } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Firestore, collection, getDocs, query, where, doc, getDoc, documentId, onSnapshot } from '@angular/fire/firestore';
import { Auth, authState } from '@angular/fire/auth'; 

interface GlobalStock {
  storeName: string;
  stock: number;
  unit: string;
  costPerUnit: number;
}

// ⭐ NEW: Item Group Architecture
export interface ItemGroup {
  id?: string;
  name: string;
  type: 'Basic' | 'Smart' | 'Time-Based' | 'Diet' | 'Fixed-Combo' | 'BYO-Combo' | 'Conditional' | 'QR-Driven';
  itemIds: string[];
  isActive: boolean;
  config?: {
    startTime?: string; // For Time-Based
    endTime?: string;
    dietType?: 'Veg' | 'Non-Veg' | 'Vegan'; // For Diet Groups
    minItems?: number; // For BYO Combos
    comboPrice?: number;
  };
}

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterOutlet, RouterLinkActive, FormsModule],
  templateUrl: './inventory.component.html',
  styleUrls: ['./inventory.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class InventoryComponent implements OnInit, OnDestroy {
  private firestore = inject(Firestore);
  private fireAuth = inject(Auth); 
  private cdr = inject(ChangeDetectorRef);

  stores: { slug: string, name: string }[] = [];
  allMaterialsRaw: any[] = []; 
  uniqueMaterialNames: string[] = [];
  itemGroups: ItemGroup[] = []; // ⭐ NEW

  selectedMaterial = '';
  globalStockResults: GlobalStock[] = [];
  isLoadingGlobal = false;
  showGlobalSearch = false; 
  private groupSub: any;

  async ngOnInit() {
    authState(this.fireAuth).subscribe(async (user) => {
      if (user) {
        await this.loadMyStores(user.uid);
      }
    });
  }

  ngOnDestroy() {
    if (this.groupSub) this.groupSub();
  }

  async loadMyStores(uid: string) {
    const userDocSnap = await getDoc(doc(this.firestore, `Users/${uid}`));
    if (!userDocSnap.exists()) return;

    const userData = userDocSnap.data();
    const role = userData['userRole'];
    const assignedStoreId = userData['storeId'];
    const storesRef = collection(this.firestore, 'Stores');

    if (role === 'Superadmin') {
      const snap = await getDocs(query(storesRef));
      this.stores = snap.docs.map(d => ({ 
        slug: d.data()['slug'] || d.id, 
        name: d.data()['name'] || d.id 
      }));
    } else {
      const qAssigned = getDocs(query(storesRef, where(documentId(), '==', assignedStoreId || '')));
      const qOwned = getDocs(query(storesRef, where('ownerId', '==', uid)));
      const [snapAssigned, snapOwned] = await Promise.all([qAssigned, qOwned]);
      const allDocs = [...snapAssigned.docs, ...snapOwned.docs];
      const uniqueData = Array.from(new Set(allDocs.map(d => d.id)))
        .map(id => {
          const d = allDocs.find(doc => doc.id === id);
          return { slug: d?.data()['slug'] || id, name: d?.data()['name'] || id };
        });
      this.stores = uniqueData;
    }
    
    // ⭐ Start listening to Item Groups for the first store
    if (this.stores.length > 0) {
      this.loadItemGroups(this.stores[0].slug);
    }
  }

  // ⭐ NEW: Real-time Item Group Listener
  loadItemGroups(storeSlug: string) {
    const groupRef = collection(this.firestore, `Stores/${storeSlug}/itemGroups`);
    this.groupSub = onSnapshot(groupRef, (snap) => {
      this.itemGroups = snap.docs.map(d => ({ id: d.id, ...d.data() } as ItemGroup));
      this.cdr.detectChanges();
    });
  }

  async toggleGlobalSearch() {
    this.showGlobalSearch = !this.showGlobalSearch;
    if (this.showGlobalSearch && this.uniqueMaterialNames.length === 0) {
      await this.fetchAllMaterials();
    }
  }

  private async fetchAllMaterials() {
    this.isLoadingGlobal = true;
    this.allMaterialsRaw = [];
    const promises = this.stores.map(async store => {
      const snap = await getDocs(collection(this.firestore, `Stores/${store.slug}/rawMaterials`));
      snap.docs.forEach(d => {
        this.allMaterialsRaw.push({
          storeName: store.name,
          name: d.data()['name'],
          stock: d.data()['stock'] || 0,
          unit: d.data()['unit'] || '-',
          cost: d.data()['costPerUnit'] || 0
        });
      });
    });
    await Promise.all(promises);
    const names = this.allMaterialsRaw.map(m => m.name);
    this.uniqueMaterialNames = Array.from(new Set(names)).sort();
    this.isLoadingGlobal = false;
  }

  onMaterialSelect() {
    if (!this.selectedMaterial) {
      this.globalStockResults = [];
      return;
    }
    this.globalStockResults = this.stores.map(store => {
      const match = this.allMaterialsRaw.find(m => m.storeName === store.name && m.name === this.selectedMaterial);
      return match 
        ? { storeName: store.name, stock: match.stock, unit: match.unit, costPerUnit: match.cost }
        : { storeName: store.name, stock: 0, unit: '-', costPerUnit: 0 };
    });
  }
}