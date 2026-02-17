import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Firestore, collection, collectionData, updateDoc, doc, deleteDoc } from '@angular/fire/firestore';
import { Router, ActivatedRoute } from '@angular/router';
import { DynamicTableComponent } from '../../../store/dynamic-table/dynamic-table.component';

interface Modifier {
  id?: string;
  name: string;
  type: 'addon' | 'variation';
  options: { label: string; price: number }[];
  associatedMenuItems: string[];
  isActive: boolean;
}

@Component({
  selector: 'app-modifier-list',
  standalone: true,
  imports: [CommonModule, DynamicTableComponent],
  templateUrl: './modifier-list.component.html',
  styleUrls: ['./modifier-list.component.css']
})
export class ModifierListComponent implements OnInit {
  private firestore = inject(Firestore);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  modifiers: any[] = [];
  storeSlug: string = '';

  columns = [
    { field: 'name', label: 'Name', sortable: true, searchable: true },
    { field: 'type', label: 'Type', sortable: true },
    { field: 'optionsFormatted', label: 'Options' },
    { field: 'associatedMenuFormatted', label: 'Associated Menu Items' },
    { field: 'statusFormatted', label: 'Status' }
  ];

  filters = [
    { field: 'name', label: 'Name', type: 'text' as const },
    { field: 'type', label: 'Type', type: 'select' as const, options: ['addon', 'variation'] },
    { field: 'statusFormatted', label: 'Status', type: 'select' as const, options: ['Active', 'Inactive'] }
  ];

  ngOnInit() {
    const root = this.route.snapshot.root;
    const slug = root.firstChild?.paramMap.get('storeSlug');
    this.storeSlug = slug || '';

    if (this.storeSlug) {
      this.loadModifiers();
    }
  }

  private loadModifiers() {
    const ref = collection(this.firestore, `Stores/${this.storeSlug}/modifiers`);
    collectionData(ref, { idField: 'id' }).subscribe((data: any[]) => {
      this.modifiers = data.map((m: Modifier) => ({
        ...m,
        optionsFormatted: m.options?.map(o => `${o.label} (₹${o.price})`).join(', ') || '—',
        associatedMenuFormatted: m.associatedMenuItems?.length
          ? `${m.associatedMenuItems.length} linked`
          : 'None',
        statusFormatted: m.isActive ? 'Active' : 'Inactive'
      }));
    });
  }

  /**
   * Handles deletion with a check for associated menu items
   */
  async handleDelete(items: any[]) {
    // 1. Check if any items are currently linked to menu items
    const linkedItems = items.filter(item => item.associatedMenuItems && item.associatedMenuItems.length > 0);
    
    if (linkedItems.length > 0) {
      const linkedNames = linkedItems.map(i => i.name).join(', ');
      alert(`Cannot delete: The following modifiers are still linked to menu items: ${linkedNames}. Please unlink them first.`);
      return;
    }

    // 2. If no items are linked, proceed with confirmation
    const message = items.length === 1 
      ? `Are you sure you want to delete the modifier "${items[0].name}"?` 
      : `Are you sure you want to delete ${items.length} modifiers?`;

    if (confirm(message)) {
      try {
        for (const item of items) {
          if (item.id) {
            const docRef = doc(this.firestore, `Stores/${this.storeSlug}/modifiers`, item.id);
            await deleteDoc(docRef);
          }
        }
      } catch (error) {
        console.error('Error deleting modifier:', error);
        alert('An unexpected error occurred while deleting.');
      }
    }
  }

  /**
   * Status Toggle (Can be called from the UI)
   */
  async toggleStatus(row: Modifier) {
    if (!row.id) return;
    try {
      const ref = doc(this.firestore, `Stores/${this.storeSlug}/modifiers/${row.id}`);
      await updateDoc(ref, { isActive: !row.isActive });
    } catch (error) {
      console.error('Error updating status:', error);
    }
  }

  onRowClick(row: Modifier) {
    if (row.id) {
      this.router.navigate([`/${this.storeSlug}/inventory/edit-modifier`, row.id]);
    }
  }
}