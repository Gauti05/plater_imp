import { Component, OnInit } from '@angular/core';
import { CommonModule, CurrencyPipe, TitleCasePipe } from '@angular/common';
import { Firestore, collection, collectionData, query, orderBy, doc, updateDoc, serverTimestamp } from '@angular/fire/firestore';
import { DynamicTableComponent } from '../store/dynamic-table/dynamic-table.component';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { format } from 'date-fns';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CommonModule, DynamicTableComponent, CurrencyPipe, TitleCasePipe, FormsModule, RouterModule],
  templateUrl: './orders.component.html',
  styleUrls: ['./orders.component.css']
})
export class OrdersComponent implements OnInit {
  rawOrders: any[] = [];
  filteredData: any[] = [];
  paginatedData: any[] = [];
  storeSlug: string | null | undefined = null;
  Math = Math;

  currentPage = 1;
  itemsPerPage = 10;
  totalPages = 1;
  visiblePages: number[] = [];

  tableColumns = [
    { label: 'Date', field: 'dateStr' },
    { label: 'Customer', field: 'customerName' }, // ⭐ ADDED CUSTOMER NAME COLUMN
    { label: 'Type', field: 'orderType' },
    { label: 'Status', field: 'status' },
    { label: 'Total', field: 'totalStr' },
    { label: 'Pay Mode', field: 'paymentMode' },
    { label: 'Waiter', field: 'waiter' },
    { label: 'Invoice', field: 'id' },
    { label: 'Actions', field: 'actions' },
    { label: 'Table', field: 'tableNumber' },
  ];

  constructor(private firestore: Firestore, private router: Router, private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.storeSlug = this.route.parent?.snapshot.paramMap.get('storeSlug');
    this.loadOrdersData();
  }

  private loadOrdersData() {
    if (!this.storeSlug) return;
    const ordersCollection = collection(this.firestore, `Stores/${this.storeSlug}/orders`);
    const ordersQuery = query(ordersCollection, orderBy('createdAt', 'desc'));

    collectionData(ordersQuery, { idField: 'id' }).subscribe({
      next: (rows: any[]) => {
        this.rawOrders = rows.map((raw: any) => this.mapOrderRow(raw));
        this.applyFilter();
      },
      error: (err) => console.error(err)
    });
  }

  applyFilter(event?: any) {
    const searchTerm = event ? (event.target.value || '').toLowerCase() : '';
    this.filteredData = searchTerm 
      ? this.rawOrders.filter(o => JSON.stringify(o).toLowerCase().includes(searchTerm))
      : [...this.rawOrders];
    this.currentPage = 1;
    this.updatePagination();
  }

  updatePagination() {
    this.totalPages = Math.ceil(this.filteredData.length / this.itemsPerPage) || 1;
    const start = (this.currentPage - 1) * this.itemsPerPage;
    this.paginatedData = this.filteredData.slice(start, start + this.itemsPerPage);
    this.updateVisiblePages();
  }

  updateVisiblePages() {
    this.visiblePages = [];
    let start = Math.max(1, this.currentPage - 2);
    let end = Math.min(this.totalPages, start + 4);
    if (end - start < 4) start = Math.max(1, end - 4);
    for (let i = start; i <= end; i++) this.visiblePages.push(i);
  }

  changePage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updatePagination();
    }
  }

  onPageSizeChange() { this.currentPage = 1; this.updatePagination(); }

  private mapOrderRow(o: any) {
    // ⭐ IMPROVED DATE PARSING
    const rawDate = o.createdAt || o.paidAt || o.startTime; 
    const date = this.toDate(rawDate);
    const dateStr = date ? format(date, 'MMM do, h:mm a') : '—';
    
    return { 
      ...o, 
      orderType: o.tableNumber ? 'Dine-in' : (o.orderType || 'Takeaway'), 
      customerName: o.customerName || 'Guest', // Ensure fallback
      dateStr, 
      totalStr: `₹${(o.total || 0).toLocaleString('en-IN')}`, 
      actions: 'actions' 
    };
  }

  private toDate(v: any) {
    if (!v) return null;
    if (v?.toDate) return v.toDate();
    if (typeof v === 'number') return new Date(v); // Handles timestamps like Date.now()
    if (typeof v === 'string') return new Date(v);
    return v instanceof Date ? v : null;
  }

  onRowClick(row: any) { if (this.storeSlug) this.router.navigate(['/', this.storeSlug, 'orders', 'edit', row.id]); }

  async markAsPaid(order: any) {
    if (!confirm(`Mark ${order.id} as Paid?`)) return;
    await updateDoc(doc(this.firestore, `Stores/${this.storeSlug}/orders/${order.id}`), { status: 'Paid', paidAt: serverTimestamp() });
  }

  async reopenOrder(order: any) {
    if (!confirm(`Reopen ${order.id}?`)) return;
    await updateDoc(doc(this.firestore, `Stores/${this.storeSlug}/orders/${order.id}`), { status: 'Open', paidAt: null });
  }
}
// import { Component, OnInit, Inject, PLATFORM_ID, ViewEncapsulation } from '@angular/core';
// import { CommonModule, CurrencyPipe, TitleCasePipe, isPlatformBrowser } from '@angular/common';
// import {
//   Firestore,
//   collection,
//   collectionData,
//   query,
//   orderBy,
//   doc,
//   updateDoc,
//   getDocs,
//   where,
//   serverTimestamp
// } from '@angular/fire/firestore';
// import { DynamicTableComponent } from '../store/dynamic-table/dynamic-table.component';
// import { ActivatedRoute, Router, RouterModule } from '@angular/router';
// import { format } from 'date-fns';
// import { FormsModule } from '@angular/forms';

// @Component({
//   selector: 'app-orders',
//   standalone: true,
//   imports: [CommonModule, DynamicTableComponent, CurrencyPipe, TitleCasePipe, FormsModule, RouterModule],
//   templateUrl: './orders.component.html',
//   styleUrls: ['./orders.component.css'],
//   encapsulation: ViewEncapsulation.None // ✅ Required to override internal table card styles
// })
// export class OrdersComponent implements OnInit {
//   ordersData: any[] = [];
//   storeSlug: string | null | undefined = null;
//   isDarkMode = false;

//   tableColumns = [
//     { label: 'Date', field: 'dateStr' },
//     { label: 'Order Type', field: 'orderType' },
//     { label: 'Status', field: 'statusBadge' },
//     { label: 'Total', field: 'totalStr' },
//     { label: 'Discount', field: 'discountStr' },
//     { label: 'Payment Mode', field: 'paymentMode' },
//     { label: 'Waiter', field: 'waiter' },
//     { label: 'Invoice No.', field: 'id' },
//     { label: 'Actions', field: 'actions' },
//     { label: 'Table No.', field: 'tableNumber' },
//   ];

//   constructor(
//     private firestore: Firestore, 
//     private router: Router, 
//     private route: ActivatedRoute,
//     @Inject(PLATFORM_ID) private platformId: Object
//   ) {}

//   ngOnInit(): void {
//     this.storeSlug = this.route.parent?.snapshot.paramMap.get('storeSlug');
    
//     if (isPlatformBrowser(this.platformId)) {
//       const savedTheme = localStorage.getItem('theme');
//       if (savedTheme === 'dark') {
//         this.isDarkMode = true;
//         document.body.classList.add('dark-mode');
//       }
//     }
//     this.loadOrdersData();
//   }

//   toggleDarkMode() {
//     this.isDarkMode = !this.isDarkMode;
//     if (isPlatformBrowser(this.platformId)) {
//       if (this.isDarkMode) {
//         document.body.classList.add('dark-mode');
//         localStorage.setItem('theme', 'dark');
//       } else {
//         document.body.classList.remove('dark-mode');
//         localStorage.setItem('theme', 'light');
//       }
//     }
//   }

//   private loadOrdersData() {
//     if (!this.storeSlug) return;
//     const ordersCollection = collection(this.firestore, `Stores/${this.storeSlug}/orders`);
//     const ordersQuery = query(ordersCollection, orderBy('createdAt', 'desc'));

//     collectionData(ordersQuery, { idField: 'id' }).subscribe({
//       next: (rows: any[]) => {
//         this.ordersData = rows.map((raw: any) => this.mapOrderRow(raw));
//       },
//       error: (err) => console.error('Error fetching orders data:', err)
//     });
//   }

//   private mapOrderRow(o: any) {
//     const date = this.toDate(o.paidAt || o.createdAt);
//     const dateStr = date ? format(date, 'MMM do, yyyy h:mm a') : '—';
//     const formatCurrency = (amount?: number) => amount != null ? `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—';
//     const statusColors: Record<string, string> = { Open: '🟢 Open', 'In Progress': '🟡 In Progress', Ready: '🔵 Ready', Paid: '🟣 Paid', Cancelled: '🔴 Cancelled' };

//     return {
//       ...o,
//       orderType: o.tableNumber ? 'Dine-in' : (o.orderType || 'Takeaway'),
//       dateStr,
//       totalStr: formatCurrency(o.total),
//       discountStr: formatCurrency(o.discount),
//       statusBadge: statusColors[o.status] || o.status,
//       actions: 'actions'
//     };
//   }

//   private toDate(v: any): Date | null {
//     if (v?.toDate) return v.toDate();
//     if (typeof v === 'string') { const d = new Date(v); return isNaN(+d) ? null : d; }
//     return v instanceof Date ? v : null;
//   }

//   onRowClick(row: any): void {
//     if (this.storeSlug) this.router.navigate(['/', this.storeSlug, 'orders', 'edit', row.id]);
//   }

//   async markAsPaid(order: any) {
//     if (!this.storeSlug || !order?.id || !confirm(`Mark order ${order.id} as Paid?`)) return;
//     try {
//       await updateDoc(doc(this.firestore, `Stores/${this.storeSlug}/orders/${order.id}`), { status: 'Paid', paidAt: serverTimestamp() });
//     } catch (err) { console.error(err); }
//   }

//   async reopenOrder(order: any) {
//     if (!this.storeSlug || !order?.id || !confirm(`Reopen order ${order.id}?`)) return;
//     try {
//       await updateDoc(doc(this.firestore, `Stores/${this.storeSlug}/orders/${order.id}`), { status: 'Open', paidAt: null });
//     } catch (err) { console.error(err); }
//   }
// }