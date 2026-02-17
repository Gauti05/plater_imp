import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { 
  Firestore, 
  collection, 
  collectionData, 
  doc, 
  getDoc, 
  setDoc, 
  deleteDoc, // Added deleteDoc
  DocumentData 
} from '@angular/fire/firestore'; 
import { DynamicTableComponent } from '../../store/dynamic-table/dynamic-table.component';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-raw-material-list',
  standalone: true,
  imports: [CommonModule, DynamicTableComponent],
  templateUrl: './raw-material-list.component.html',
  styleUrls: ['./raw-material-list.component.css']
})
export class RawMaterialListComponent implements OnInit {
  private firestore = inject(Firestore);
  private route = inject(ActivatedRoute);

  rawMaterials: any[] = [];
  storeSlug: string = '';
  
  private componentId: string = 'rawMaterialList';
  isLoadingState: boolean = true; 
  tableState: DocumentData | null = null; 

  columns = [
    { field: 'name', label: 'Name', sortable: true, searchable: true },
    { field: 'category', label: 'Category', sortable: true, searchable: true },
    { field: 'stock', label: 'Stock', sortable: true },
    { field: 'unit', label: 'Unit' },
    { field: 'lowStockThreshold', label: 'Threshold' },
    { field: 'costPerUnit', label: 'Cost/Unit (₹)', sortable: true },
    { field: 'inventoryValue', label: 'Inventory Value (₹)', sortable: true },
    { field: 'isActive', label: 'Status' }
  ];

  filters: { field: string; label: string; type: 'text' | 'select' | 'dateRange' | 'multiselect'; options?: string[] }[] = [
    { field: 'name', label: 'Name', type: 'text' },
    { field: 'category', label: 'Category', type: 'select', options: [] },
    { field: 'isActive', label: 'Status', type: 'select', options: ['Active', 'Inactive'] }
  ];

  async ngOnInit(): Promise<void> {
    const root = this.route.snapshot.root;
    const slug = root.firstChild?.paramMap.get('storeSlug');
    this.storeSlug = slug || '';
    
    if (this.storeSlug) {
      this.tableState = await this.loadTableState();
      this.isLoadingState = false; 
      this.loadRawMaterials();
    } else {
      this.isLoadingState = false;
    }
  }

  private loadRawMaterials() {
    const ref = collection(this.firestore, `Stores/${this.storeSlug}/rawMaterials`);
    collectionData(ref, { idField: 'id' }).subscribe(data => {
      this.rawMaterials = data;
      this.filters.find(f => f.field === 'category')!.options =
        Array.from(new Set(this.rawMaterials.map(r => r.category))).filter(Boolean);
    });
  }

  // --- DELETE LOGIC ---

  /**
   * Called when the delete button is clicked in the action menu
   */
  async deleteItem(item: any) {
    const confirmDelete = confirm(`Are you sure you want to delete "${item.name}"? This action cannot be undone.`);
    
    if (confirmDelete) {
      try {
        const docRef = doc(this.firestore, `Stores/${this.storeSlug}/rawMaterials`, item.id);
        await deleteDoc(docRef);
        console.log('Document successfully deleted!');
      } catch (error) {
        console.error('Error removing document: ', error);
        alert('Error deleting material. Please check your permissions.');
      }
    }
  }

  /**
   * Handles bulk delete emitted by the table component
   */
  async handleBulkDelete(items: any[]) {
    if (confirm(`Delete ${items.length} selected items?`)) {
      for (const item of items) {
        const docRef = doc(this.firestore, `Stores/${this.storeSlug}/rawMaterials`, item.id);
        await deleteDoc(docRef);
      }
    }
  }

  // --- FIRESTORE STATE FUNCTIONS ---

  async loadTableState(): Promise<DocumentData | null> {
    const docId = `${this.storeSlug}_${this.componentId}`; 
    const docRef = doc(this.firestore, 'userTableStates', docId);
    try {
      const docSnap = await getDoc(docRef);
      return docSnap.exists() ? docSnap.data() : null;
    } catch (error) {
      return null;
    }
  }

  saveTableState(state: any): void {
    const docId = `${this.storeSlug}_${this.componentId}`; 
    const docRef = doc(this.firestore, 'userTableStates', docId);
    setDoc(docRef, state, { merge: true }).catch(err => console.error(err));
  }
}