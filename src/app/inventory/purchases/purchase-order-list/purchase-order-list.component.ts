import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
// 1. Added doc and deleteDoc to imports
import { Firestore, collection, collectionData, query, where, doc, deleteDoc } from '@angular/fire/firestore';
import { Router, ActivatedRoute } from '@angular/router';
import { DynamicTableComponent } from '../../../store/dynamic-table/dynamic-table.component';
import { PurchaseOrder } from '../purchase-order.model';

@Component({
  selector: 'app-purchase-order-list',
  standalone: true,
  imports: [CommonModule, DynamicTableComponent],
  templateUrl: './purchase-order-list.component.html',
  styleUrls: ['./purchase-order-list.component.css']
})
export class PurchaseOrderListComponent implements OnInit {
  private firestore = inject(Firestore);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  purchaseOrders: PurchaseOrder[] = [];
  storeSlug: string = '';
  
  currentStatusFilter: string = 'active'; 

  columns = [
    { field: 'supplierName', label: 'Supplier', sortable: true },
    { field: 'poDate', label: 'Date' }, 
    { 
      field: 'status', 
      label: 'Status', 
      render: (s: string) => {
        switch (s) {
          case 'draft': return '📝 Draft';
          case 'finalized': return '⏳ Finalized';
          case 'partially_received': return '🟠 Partial';
          case 'received': return '✅ Received';
          case 'cancelled': return '❌ Cancelled';
          default: return s;
        }
      } 
    },
    { field: 'subtotal', label: 'Subtotal (₹)' },
    { field: 'gstTotal', label: 'GST (₹)' },
    { field: 'grandTotal', label: 'Total (₹)' }
  ];

  filters = [
    { field: 'supplierName', label: 'Supplier', type: 'text' as const, defaultValue: '' },
    { 
      field: 'status', 
      label: 'Status', 
      type: 'select' as const, 
      defaultValue: 'active', 
      options: ['active', 'draft', 'finalized', 'partially_received', 'received', 'cancelled'] 
    }
  ];

  ngOnInit() {
    const root = this.route.snapshot.root;
    this.storeSlug = root.firstChild?.paramMap.get('storeSlug') || '';

    if (this.storeSlug) {
      this.loadPurchaseOrders();
    }
  }

  private loadPurchaseOrders() {
    const poCollection = collection(this.firestore, `Stores/${this.storeSlug}/purchaseOrders`);
    let poQuery: any;

    if (this.currentStatusFilter === 'active') {
        poQuery = query(poCollection, where('status', '!=', 'cancelled'));
    } else if (this.currentStatusFilter === '') {
        poQuery = query(poCollection);
    } else {
        poQuery = query(poCollection, where('status', '==', this.currentStatusFilter));
    }
    
    collectionData(poQuery, { idField: 'id' }).subscribe((data: any[]) => {
      this.purchaseOrders = data.map(po => {
        if (po.poDate && typeof po.poDate.toDate === 'function') {
          const date: Date = po.poDate.toDate(); 
          const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
          po.poDate = date.toLocaleDateString('en-US', options).replace(/, /g, ' ');
        } else if (!po.poDate) {
          po.poDate = '—';
        }
        return po as PurchaseOrder;
      });
    });
  }

  /**
   * Handles deletion of Purchase Orders with business logic safety
   */
  async handleDelete(items: any[]) {
    // 1. Filter for orders that shouldn't be deleted (Received or Finalized)
    const protectedOrders = items.filter(po => po.status === 'received' || po.status === 'finalized' || po.status === 'partially_received');

    if (protectedOrders.length > 0) {
      alert(`Safety Check: You cannot delete orders that are 'Received', 'Finalized', or 'Partial'. Please cancel them instead to maintain inventory audit logs.`);
      return;
    }

    // 2. Confirmation for Drafts/Cancelled
    const message = items.length === 1 
      ? `Are you sure you want to delete this ${items[0].status} purchase order?` 
      : `Are you sure you want to delete ${items.length} purchase orders?`;

    if (confirm(message)) {
      try {
        for (const item of items) {
          if (item.id) {
            const docRef = doc(this.firestore, `Stores/${this.storeSlug}/purchaseOrders`, item.id);
            await deleteDoc(docRef);
          }
        }
      } catch (error) {
        console.error('Error deleting Purchase Order:', error);
        alert('Failed to delete. Check your permissions.');
      }
    }
  }
  
  onFilterChange(filters: any) {
    const newStatusFilter = filters.status || 'active'; 
    if (newStatusFilter !== this.currentStatusFilter) {
      this.currentStatusFilter = newStatusFilter;
      this.loadPurchaseOrders();
    }
  }

  onRowClick(row: PurchaseOrder) {
    if (row.id) {
      this.router.navigate([`/${this.storeSlug}/inventory/edit-purchase-order`, row.id]);
    }
  }
}