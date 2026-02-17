import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Firestore, collection, doc, setDoc, updateDoc, getDoc, getDocs } from '@angular/fire/firestore';
import { ActivatedRoute, Router } from '@angular/router';

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

  async ngOnInit() {
    const root = this.route.snapshot.root;
    this.storeSlug = root.firstChild?.paramMap.get('storeSlug') || '';

    const id = this.route.snapshot.paramMap.get('id');
    this.isEditMode = !!id;

    // Fetch all raw materials
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

    // Load supplier if editing
    if (id) {
      const docRef = doc(this.firestore, `Stores/${this.storeSlug}/suppliers/${id}`);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        this.supplier = { id: docSnap.id, ...(docSnap.data() as Supplier) };
      }
    }
    
    // 🎯 FIX: Initially show only associated items (if any).
    this.filterItems(true); 
  }

  async saveSupplier() {
    const colRef = collection(this.firestore, `Stores/${this.storeSlug}/suppliers`);
    let supplierId: string;

    try {
      if (this.isEditMode && this.supplier.id) {
        supplierId = this.supplier.id;
        await updateDoc(doc(colRef, supplierId), this.supplier as any);
      } else {
        const newDocRef = doc(colRef);
        supplierId = newDocRef.id;
        await setDoc(newDocRef, { ...this.supplier, id: supplierId });
      }

      // Sync supplier association inside items (CRITICAL)
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
          // If unassociated, explicitly remove the supplierId field.
          // Note: This only works if the item was associated with THIS supplier.
          // For simplicity, we remove supplierId if it's not in the array.
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
    // Update the displayed list immediately
    this.filterItems(); 
  }

  /**
   * Filters the item list. If no search term, it only shows selected items.
   * If there is a search term, it shows matching items from the full list.
   * @param initialLoad If true, just filters by selected items and clears search.
   */
  filterItems(initialLoad: boolean = false) {
    const term = this.searchTerm.toLowerCase().trim();

    if (!term) {
      // Logic: If no search term, only show items that are currently selected.
      this.filteredItems = this.items.filter(item =>
        this.supplier.associatedItems.includes(item.id!)
      );
    } else {
      // Logic: If searching, show any item that matches the search term.
      this.filteredItems = this.items.filter(item =>
        item.name.toLowerCase().includes(term) || item.type.toLowerCase().includes(term)
      );
    }
    
    if (initialLoad) {
        this.searchTerm = '';
    }
  }
}