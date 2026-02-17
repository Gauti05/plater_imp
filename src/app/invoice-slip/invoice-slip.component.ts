import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';

@Component({
  selector: 'app-invoice-slip',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="order && storeInfo" class="invoice-container">
      <img *ngIf="storeInfo.logoUrl" [src]="storeInfo.logoUrl" class="logo" />
      <h2 class="center">{{ storeInfo.name }}</h2>
      <p class="center small">{{ storeInfo.address }}, {{ storeInfo.city }}</p>
      <hr />

      <h3 class="center">Invoice</h3>
      <p><b>Table:</b> {{ order.tableNumber }}</p>
      <p><b>Date:</b> {{ order.createdAt?.toDate() | date:'medium' }}</p>

      <table>
        <thead>
          <tr><th>Item</th><th>Qty</th><th>Amount</th></tr>
        </thead>
        <tbody>
          <tr *ngFor="let item of order.items">
            <td>{{ item.name }}</td>
            <td>{{ item.quantity }}</td>
            <td>₹{{ item.subtotal.toFixed(2) }}</td>
          </tr>
        </tbody>
      </table>

      <hr />
      <p>Subtotal: ₹{{ order.subtotal.toFixed(2) }}</p>
      <p>Tax ({{ order.tax }}%): ₹{{ (order.subtotal * order.tax / 100).toFixed(2) }}</p>
      <p>Discount: ₹{{ (order.discount || 0).toFixed(2) }}</p>
      <h3>Total: ₹{{ order.total.toFixed(2) }}</h3>
      <p class="center">Thank you! Visit again.</p>
    </div>
  `,
  styles: [`
    .invoice-container {
      width: 58mm;
      margin: 0 auto;
      font-family: 'Courier New', monospace;
      font-size: 12px;
    }
    .center { text-align: center; }
    .logo { display:block; margin:0 auto 6px; max-height:40px; }
    .small { font-size:10px; }
    table { width:100%; border-collapse:collapse; margin-top:8px; }
    th, td { padding:2px 0; text-align:left; }
  `]
})
export class InvoiceSlipComponent implements OnInit {
  storeSlug!: string;
  orderId!: string;
  order: any;
  storeInfo: any;

  constructor(private route: ActivatedRoute, private firestore: Firestore) {}

  async ngOnInit() {
    this.storeSlug = this.route.snapshot.paramMap.get('storeSlug')!;
    this.orderId = this.route.snapshot.paramMap.get('orderId')!;

    const orderRef = doc(this.firestore, `Stores/${this.storeSlug}/orders/${this.orderId}`);
    const storeRef = doc(this.firestore, `Stores/${this.storeSlug}`);

    const [orderSnap, storeSnap] = await Promise.all([getDoc(orderRef), getDoc(storeRef)]);
    if (orderSnap.exists()) this.order = orderSnap.data();
    if (storeSnap.exists()) this.storeInfo = storeSnap.data();
  }
}
