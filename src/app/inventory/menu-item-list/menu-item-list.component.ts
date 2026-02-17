import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { 
  Firestore, 
  collection, 
  collectionData, 
  doc, 
  getDoc, 
  setDoc, 
  deleteDoc, // 1. Added deleteDoc
  DocumentData 
} from '@angular/fire/firestore'; 
import { Router, ActivatedRoute } from '@angular/router';
import { DynamicTableComponent } from '../../store/dynamic-table/dynamic-table.component';

@Component({
  selector: 'app-menu-item-list',
  standalone: true,
  imports: [CommonModule, DynamicTableComponent],
  templateUrl: './menu-item-list.component.html',
  styleUrls: ['./menu-item-list.component.css']
})
export class MenuItemListComponent implements OnInit {
  private firestore = inject(Firestore);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  storeSlug: string = '';
  menuItems: any[] = [];
  
  private componentId: string = 'menuItemsList'; 

  isLoadingState: boolean = true; 
  tableState: DocumentData | null = null; 

  columns = [
    { field: 'name', label: 'Name', sortable: true, searchable: true },
    { field: 'category', label: 'Category', sortable: true, searchable: true },
    { field: 'price', label: 'Price (₹)', sortable: true },
    { field: 'isActive', label: 'Status' },
    { field: 'trackInventory', label: 'Inventory Tracking' }
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
      this.loadMenuItems();
    } else {
      this.isLoadingState = false;
    }
  }

  private loadMenuItems() {
    const ref = collection(this.firestore, `Stores/${this.storeSlug}/menuItems`);
    collectionData(ref, { idField: 'id' }).subscribe(data => {
      this.menuItems = data;
      this.filters.find(f => f.field === 'category')!.options =
        Array.from(new Set(this.menuItems.map(m => m.category))).filter(Boolean);
    });
  }

  // 2. Added Delete Logic
  async handleDelete(items: any[]) {
    const message = items.length === 1 
      ? `Are you sure you want to delete "${items[0].name}"?` 
      : `Are you sure you want to delete ${items.length} items?`;

    if (confirm(message)) {
      try {
        for (const item of items) {
          const docRef = doc(this.firestore, `Stores/${this.storeSlug}/menuItems`, item.id);
          await deleteDoc(docRef);
        }
      } catch (error) {
        console.error('Error deleting menu item(s):', error);
        alert('Failed to delete items. Please check permissions.');
      }
    }
  }

  onRowClick(row: any) {
    this.router.navigate([`/${this.storeSlug}/inventory/edit-menu`, row.id]);
  }

  async loadTableState(): Promise<DocumentData | null> {
    const docId = `${this.storeSlug}_${this.componentId}`; 
    const docRef = doc(this.firestore, 'userTableStates', docId);
    try {
      const docSnap = await getDoc(docRef);
      return docSnap.exists() ? docSnap.data() : null;
    } catch (error) {
      console.error('Error loading table state:', error);
      return null;
    }
  }

  saveTableState(state: any): void {
    const docId = `${this.storeSlug}_${this.componentId}`; 
    const docRef = doc(this.firestore, 'userTableStates', docId);
    setDoc(docRef, state, { merge: true }).catch(err => console.error(err));
  }
}