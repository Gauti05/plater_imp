// import { Component, ViewEncapsulation } from '@angular/core';
// import { CommonModule } from '@angular/common';
// import { RouterLink, RouterOutlet, RouterLinkActive } from '@angular/router';

// @Component({
//   selector: 'app-inventory',
//   standalone: true,
//   imports: [CommonModule, RouterLink, RouterOutlet, RouterLinkActive],
//   templateUrl: './inventory.component.html',
//   styleUrls: ['./inventory.component.css'],
//   encapsulation: ViewEncapsulation.None
// })
// export class InventoryComponent { }


import { Component, ViewEncapsulation, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterOutlet, RouterLinkActive } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Firestore, collection, getDocs, query, where, doc, getDoc, documentId } from '@angular/fire/firestore';
import { Auth, authState } from '@angular/fire/auth'; 

interface GlobalStock {
  storeName: string;
  stock: number;
  unit: string;
  costPerUnit: number;
}

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterOutlet, RouterLinkActive, FormsModule],
  templateUrl: './inventory.component.html',
  styleUrls: ['./inventory.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class InventoryComponent implements OnInit {
  private firestore = inject(Firestore);
  private fireAuth = inject(Auth); 

  stores: { slug: string, name: string }[] = [];
  allMaterialsRaw: any[] = []; 
  uniqueMaterialNames: string[] = [];

  selectedMaterial = '';
  globalStockResults: GlobalStock[] = [];
  isLoadingGlobal = false;
  showGlobalSearch = false; 

  async ngOnInit() {
    authState(this.fireAuth).subscribe(async (user) => {
      if (user) {
        await this.loadMyStores(user.uid);
      }
    });
  }

  // ⭐ FIXED: Now fetches your Master branch AND all your newly created outlets
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
      // Run two queries to avoid index errors and get ALL your stores
      const qAssigned = getDocs(query(storesRef, where(documentId(), '==', assignedStoreId || '')));
      const qOwned = getDocs(query(storesRef, where('ownerId', '==', uid)));

      const [snapAssigned, snapOwned] = await Promise.all([qAssigned, qOwned]);
      
      const allDocs = [...snapAssigned.docs, ...snapOwned.docs];
      
      // Combine results and format them for the global search dropdown
      const uniqueData = Array.from(new Set(allDocs.map(d => d.id)))
        .map(id => {
          const d = allDocs.find(doc => doc.id === id);
          return { 
            slug: d?.data()['slug'] || id, 
            name: d?.data()['name'] || id 
          };
        });

      this.stores = uniqueData;
    }
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
    
    // ⭐ Now queries every single store found in the updated loadMyStores
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