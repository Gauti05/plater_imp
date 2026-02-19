import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Firestore, collection, doc, setDoc, updateDoc, getDoc, getDocs, query, where, documentId } from '@angular/fire/firestore';
import { ActivatedRoute, Router } from '@angular/router';
import { Auth, authState } from '@angular/fire/auth'; 

interface Supplier {
  id?: string;
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
  isActive: boolean;
  associatedItems: string[];
}

@Component({
  selector: 'app-add-supplier',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './add-supplier.component.html',
  styleUrls: ['./add-supplier.component.css']
})
export class AddSupplierComponent implements OnInit {
  private firestore = inject(Firestore);
  private route = inject(ActivatedRoute);
  public router = inject(Router); 
  private fireAuth = inject(Auth); 

  supplier: Supplier = {
    name: '',
    isActive: true,
    associatedItems: []
  };

  items: { id: string; name: string; type: string }[] = [];
  filteredItems: { id: string; name: string; type: string }[] = [];
  searchTerm = '';
  isEditMode = false;

  storeSlug: string = '';
  
  publishToAll = false;
  allStoreSlugs: string[] = [];

  async ngOnInit() {
    const root = this.route.snapshot.root;
    this.storeSlug = root.firstChild?.paramMap.get('storeSlug') || '';

    const id = this.route.snapshot.paramMap.get('id');
    this.isEditMode = !!id;

    authState(this.fireAuth).subscribe(async (user) => {
      if (user) {
        const userDoc = await getDoc(doc(this.firestore, `Users/${user.uid}`));
        const userData = userDoc.data();
        if (userData) {
          await this.loadAllStores(user.uid, userData['storeId'], userData['userRole']); 
        }
      }
    });

    const rawCol = collection(this.firestore, `Stores/${this.storeSlug}/rawMaterials`);
    const rawSnap = await getDocs(rawCol);

    this.items = [
      ...rawSnap.docs.map(d => ({ 
        id: d.id, 
        name: d.data()['name'], 
        type: 'Raw Material',
        supplierId: d.data()['supplierId'] 
      })),
    ];

    if (id) {
      const docRef = doc(this.firestore, `Stores/${this.storeSlug}/suppliers/${id}`);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        this.supplier = { id: docSnap.id, ...(docSnap.data() as Supplier) };
      }
    }
    
    this.filterItems(true); 
  }

  async loadAllStores(uid: string, assignedStoreId: string, role: string) {
    const storesRef = collection(this.firestore, 'Stores');
    if (role === 'Superadmin') {
      const storesSnap = await getDocs(storesRef);
      this.allStoreSlugs = storesSnap.docs.map(d => d.data()['slug'] || d.id);
    } else {
      const qAssigned = getDocs(query(storesRef, where(documentId(), '==', assignedStoreId || '')));
      const qOwned = getDocs(query(storesRef, where('ownerId', '==', uid)));
      const [snapAssigned, snapOwned] = await Promise.all([qAssigned, qOwned]);
      const allDocs = [...snapAssigned.docs, ...snapOwned.docs];
      this.allStoreSlugs = Array.from(new Set(allDocs.map(d => d.data()['slug'] || d.id)));
    }
  }

  async saveSupplier() {
    try {
      let supplierId = this.supplier.id || doc(collection(this.firestore, 'temp')).id;
      this.supplier.id = supplierId;

      if (this.publishToAll && this.allStoreSlugs.length > 0) {
        const savePromises = this.allStoreSlugs.map(async (slug) => {
          const colRef = collection(this.firestore, `Stores/${slug}/suppliers`);
          return setDoc(doc(colRef, supplierId), this.supplier as any, { merge: true });
        });
        await Promise.all(savePromises);
      } else {
        const colRef = collection(this.firestore, `Stores/${this.storeSlug}/suppliers`);
        await setDoc(doc(colRef, supplierId), this.supplier as any, { merge: true });
      }

      await this.syncItems(supplierId);
      this.router.navigate([`/${this.storeSlug}/inventory/suppliers`]);
    } catch (e) {
      console.error('Error saving supplier:', e);
    }
  }

  private async syncItems(supplierId: string) {
    for (const item of this.items) {
      const colPath = item.type === 'Raw Material' ? 'rawMaterials' : 'menuItems';
      const itemRef = doc(this.firestore, `Stores/${this.storeSlug}/${colPath}/${item.id}`);
      const isAssociated = this.supplier.associatedItems.includes(item.id);
      
      if (isAssociated) {
          await updateDoc(itemRef, { supplierId: supplierId });
      } else {
          await updateDoc(itemRef, { supplierId: null });
      }
    }
  }

  toggleItem(itemId: string) {
    const index = this.supplier.associatedItems.indexOf(itemId);
    if (index > -1) {
      this.supplier.associatedItems.splice(index, 1);
    } else {
      this.supplier.associatedItems.push(itemId);
    }
    this.filterItems(); 
  }

  filterItems(initialLoad: boolean = false) {
    const term = this.searchTerm.toLowerCase().trim();
    if (!term) {
      this.filteredItems = this.items.filter(item => this.supplier.associatedItems.includes(item.id!));
    } else {
      this.filteredItems = this.items.filter(item => item.name.toLowerCase().includes(term) || item.type.toLowerCase().includes(term));
    }
    if (initialLoad) {
        this.searchTerm = '';
    }
  }
}