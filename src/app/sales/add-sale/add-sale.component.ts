import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { CommonModule, CurrencyPipe, TitleCasePipe } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Firestore, collection, addDoc, serverTimestamp, doc, getDoc, updateDoc, query, where, getDocs, Timestamp } from '@angular/fire/firestore';
import { Router, ActivatedRoute } from '@angular/router';
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
  items: any[];
  total: number;
  status: 'Open' | 'In Progress' | 'Ready' | 'Paid' | 'Cancelled';
  paymentMode?: 'CASH' | 'CARD';
  paidAt?: any;
}
interface DailySales {
  id?: string;
  date: any;
  totalSales: number;
  totalOrders: number;
  onlineSales?: number;
  offlineSales?: number;
  notes?: string;
  createdAt: any;
}

@Component({
  selector: 'app-add-sales',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, CurrencyPipe, TitleCasePipe],
  templateUrl: './add-sale.component.html',
  styleUrls: ['./add-sale.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class AddSaleComponent implements OnInit {
  salesForm!: FormGroup;
  loading = false;
  submitted = false;
  isEditMode = false;
  salesId: string | null = null;
  orderToRecord: Order | null = null;

  constructor(
    private fb: FormBuilder,
    private firestore: Firestore,
    public router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.salesForm = this.fb.group({
      date: ['', Validators.required],
      totalSales: [null, [Validators.required, Validators.min(0)]],
      totalOrders: [null, [Validators.required, Validators.min(0)]],
      onlineSales: [null, Validators.min(0)],
      offlineSales: [null, Validators.min(0)],
      notes: ['']
    });

    this.route.paramMap.subscribe(params => {
      this.salesId = params.get('id');
      this.isEditMode = !!this.salesId;
      if (this.isEditMode) {
        this.loadOrderToRecord(this.salesId!);
      }
    });
  }

  async loadOrderToRecord(orderId: string) {
    this.loading = true;
    try {
      const orderDocRef = doc(this.firestore, `orders/${orderId}`);
      const orderDoc = await getDoc(orderDocRef);

      if (orderDoc.exists()) {
        const orderData = orderDoc.data() as Order;
        this.orderToRecord = { id: orderDoc.id, ...orderData };

        this.salesForm.patchValue({
          date: orderData.paidAt.toDate().toISOString().split('T')[0],
          totalSales: orderData.total,
          totalOrders: 1,
          notes: `Sales record for Order #${orderId} from Table ${orderData.tableNumber}. Payment Mode: ${orderData.paymentMode || '—'}.`
        });
      } else {
        console.error('Order not found!');
        this.router.navigate(['/sales']);
      }
    } catch (error) {
      console.error('Error fetching order data:', error);
    } finally {
      this.loading = false;
    }
  }

  async onSubmit() {
    this.submitted = true;
    if (this.salesForm.invalid) {
      this.salesForm.markAllAsTouched();
      return;
    }

    this.loading = true;
    const salesData = this.salesForm.value;

    try {
      if (this.isEditMode) {
        const salesDocRef = doc(this.firestore, `sales/${this.salesId}`);
        await updateDoc(salesDocRef, { ...salesData, date: Timestamp.fromDate(new Date(salesData.date)) });
        console.log('Sales data updated successfully!');
      } else {
        await addDoc(collection(this.firestore, 'sales'), {
          ...salesData,
          date: Timestamp.fromDate(new Date(salesData.date)),
          createdAt: serverTimestamp()
        });
        console.log('Sales data saved successfully!');
      }
      this.router.navigate(['/sales']);
    } catch (error) {
      console.error('Error saving/updating sales data:', error);
      alert('Error saving sales data. Please check the console.');
    } finally {
      this.loading = false;
    }
  }
}