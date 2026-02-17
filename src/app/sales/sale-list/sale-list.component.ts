import { Component, OnInit } from '@angular/core';
import { CommonModule, CurrencyPipe, TitleCasePipe } from '@angular/common';
import { DynamicTableComponent } from '../../store/dynamic-table/dynamic-table.component';
import { Firestore, collection, collectionData, orderBy, query } from '@angular/fire/firestore';
import { Router } from '@angular/router';
import { format } from 'date-fns';

// Data models
interface CartItem {
  id?: string;
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
}

interface Order {
  id?: string;
  tableNumber: number;
  items: CartItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  status: 'Open' | 'In Progress' | 'Ready' | 'Paid' | 'Cancelled';
  createdAt: any;
  waiter?: string;
  paymentMode?: 'CASH' | 'CARD';
  paidAt: any;
}

@Component({
  selector: 'app-sale-list',
  standalone: true,
  imports: [CommonModule, DynamicTableComponent],
  templateUrl: './sale-list.component.html',
  styleUrls: ['./sale-list.component.css'],
})
export class SaleListComponent implements OnInit {
  salesData: any[] = [];
  
  tableColumns = [
    { label: 'Invoice No.', field: 'id' },
    { label: 'Table No.', field: 'tableNumber' },
    { label: 'Date', field: 'dateStr' },
    { label: 'Total', field: 'totalStr' },
    { label: 'Discount', field: 'discountStr' },
    { label: 'GST', field: 'taxStr' },
    { label: 'Payment Mode', field: 'paymentMode' },
    { label: 'Waiter', field: 'waiter' },
  ];

  constructor(private firestore: Firestore, private router: Router) {}

  ngOnInit(): void {
    this.loadSalesData();
  }

  private loadSalesData() {
    const ordersCollection = collection(this.firestore, 'orders');
    const ordersQuery = query(ordersCollection, orderBy('createdAt', 'desc'));

    collectionData(ordersQuery, { idField: 'id' }).subscribe({
      next: (rows: any[]) => {
        const paidOrders = rows.filter(order => order.status === 'Paid');
        this.salesData = paidOrders.map((raw: Order) => this.mapSalesRow(raw));
      },
      error: (err) => console.error('Error fetching sales data:', err)
    });
  }

  private mapSalesRow(s: Order) {
    const created = this.toDate(s.paidAt);

    const dateStr = created 
      ? format(created, 'MMM do, yyyy h:mm a')
      : '—';
      
    const formatCurrency = (amount?: number) => amount != null ? `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';

    return {
      ...s,
      dateStr,
      totalStr: formatCurrency(s.total),
      discountStr: formatCurrency(s.discount),
      taxStr: formatCurrency(s.tax),
    };
  }
  
  private toDate(v: any): Date | null {
    if (v?.toDate) { try { return v.toDate(); } catch { return null; } }
    if (typeof v === 'string') { const d = new Date(v); return isNaN(+d) ? null : d; }
    if (v instanceof Date) return v;
    return null;
  }
  
  onRowClick(row: Order): void {
      this.router.navigate(['/sales/edit', row.id]);
  }
}