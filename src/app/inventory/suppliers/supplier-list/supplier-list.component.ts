import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
// 1. Added deleteDoc to imports
import { Firestore, collection, collectionData, updateDoc, doc, deleteDoc } from '@angular/fire/firestore';
import { Router, ActivatedRoute } from '@angular/router';
import { DynamicTableComponent } from '../../../store/dynamic-table/dynamic-table.component';

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
  selector: 'app-supplier-list',
  standalone: true,
  imports: [CommonModule, DynamicTableComponent],
  templateUrl: './supplier-list.component.html',
  styleUrls: ['./supplier-list.component.css']
})
export class SupplierListComponent implements OnInit {
  private firestore = inject(Firestore);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  suppliers: any[] = [];
  storeSlug: string = '';

  columns = [
    { field: 'name', label: 'Name', sortable: true, searchable: true },
    { field: 'contactName', label: 'Contact Person' },
    { field: 'phone', label: 'Phone' },
    { field: 'email', label: 'Email' },
    { field: 'associatedItemsFormatted', label: 'Associated Items' },
    { field: 'statusFormatted', label: 'Status' }
  ];

  filters = [
    { field: 'name', label: 'Name', type: 'text' as const },
    { field: 'statusFormatted', label: 'Status', type: 'select' as const, options: ['Active', 'Inactive'] }
  ];

  ngOnInit() {
    const root = this.route.snapshot.root;
    this.storeSlug = root.firstChild?.paramMap.get('storeSlug') || '';

    if (this.storeSlug) {
      this.loadSuppliers();
    }
  }

  private loadSuppliers() {
    const ref = collection(this.firestore, `Stores/${this.storeSlug}/suppliers`);
    collectionData(ref, { idField: 'id' }).subscribe((data: any[]) => {
      this.suppliers = data.map((s: Supplier) => ({
        ...s,
        associatedItemsFormatted: s.associatedItems?.length ? `${s.associatedItems.length} linked` : 'None',
        statusFormatted: s.isActive ? 'Active' : 'Inactive'
      }));
    });
  }

  /**
   * Handles deletion of one or multiple suppliers
   * Includes a check to prevent deleting suppliers linked to inventory items
   */
  async handleDelete(items: any[]) {
    // 1. Safety Check: Prevent deletion if supplier has linked items
    const linkedSuppliers = items.filter(s => s.associatedItems && s.associatedItems.length > 0);
    
    if (linkedSuppliers.length > 0) {
      const linkedNames = linkedSuppliers.map(s => s.name).join(', ');
      alert(`Action Denied: The following suppliers are still linked to inventory items: ${linkedNames}. Please unlink them before deleting.`);
      return;
    }

    // 2. Confirmation
    const message = items.length === 1 
      ? `Are you sure you want to delete supplier "${items[0].name}"?` 
      : `Are you sure you want to delete ${items.length} suppliers?`;

    if (confirm(message)) {
      try {
        for (const item of items) {
          if (item.id) {
            const docRef = doc(this.firestore, `Stores/${this.storeSlug}/suppliers`, item.id);
            await deleteDoc(docRef);
          }
        }
      } catch (error) {
        console.error('Error deleting supplier:', error);
        alert('An error occurred while trying to delete. Please try again.');
      }
    }
  }

  onRowClick(row: Supplier) {
    if (row.id) {
      this.router.navigate([`/${this.storeSlug}/inventory/edit-supplier`, row.id]);
    }
  }

  async toggleStatus(row: Supplier) {
    if (!row.id) return;
    try {
      const ref = doc(this.firestore, `Stores/${this.storeSlug}/suppliers/${row.id}`);
      await updateDoc(ref, { isActive: !row.isActive });
    } catch (error) {
      console.error('Error toggling status:', error);
    }
  }
}