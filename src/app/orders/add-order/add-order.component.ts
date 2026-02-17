// import { Component, OnInit } from '@angular/core';
// import { CommonModule } from '@angular/common';
// import { FormsModule } from '@angular/forms';
// import {
//   Firestore,
//   doc,
//   getDoc,
//   collection,
//   getDocs,
//   query,
//   where,
//   serverTimestamp,
//   writeBatch,
//   setDoc
// } from '@angular/fire/firestore';
// import { ActivatedRoute, Router } from '@angular/router';
// import { v4 as uuid } from 'uuid';
// import QRCode from 'qrcode';

// interface CartItem {
//   id?: string;
//   name: string;
//   price: number;
//   quantity: number;
//   subtotal: number;
//   status?: 'Pending' | 'In Progress' | 'Ready' | 'Served';
// }

// interface Order {
//   id?: string;
//   tableNumber: number;
//   customerName?: string;    // Added
//   customerMobile?: string;  // Added
//   items: CartItem[];
//   subtotal: number;
//   tax: number;
//   discount: number;
//   total: number;
//   status: 'Open' | 'In Progress' | 'Ready' | 'Paid' | 'Cancelled';
//   createdAt: any;
//   updatedAt?: any;
//   waiter?: string;
//   paymentMode?: 'CASH' | 'CARD';
//   paidAt?: any;
// }

// @Component({
//   selector: 'app-add-order',
//   standalone: true,
//   imports: [CommonModule, FormsModule],
//   templateUrl: './add-order.component.html',
//   styleUrls: ['./add-order.component.css'],
// })
// export class AddOrderComponent implements OnInit {
//   order: Order = {
//     tableNumber: 0,
//     customerName: '',
//     customerMobile: '',
//     items: [],
//     subtotal: 0,
//     tax: 5,
//     discount: 0,
//     total: 0,
//     status: 'Open',
//     createdAt: new Date(),
//   };

//   isEdit = false;
//   storeSlug: string | null | undefined = null;
//   storeInfo: any = {};
//   isOnline = navigator.onLine;

//   constructor(
//     private firestore: Firestore,
//     private route: ActivatedRoute,
//     private router: Router
//   ) {
//     window.addEventListener('online', () => this.isOnline = true);
//     window.addEventListener('offline', () => this.isOnline = false);
//   }

//   async ngOnInit() {
//     this.storeSlug = this.route.parent?.snapshot.paramMap.get('storeSlug');
//     const id = this.route.snapshot.paramMap.get('id');

//     if (this.storeSlug) {
//       await this.loadStoreInfo();
//     }

//     if (id && this.storeSlug) {
//       this.isEdit = true;
//       const ref = doc(this.firestore, `Stores/${this.storeSlug}/orders/${id}`);
//       const snap = await getDoc(ref);
//       if (snap.exists()) {
//         this.order = { id: snap.id, ...(snap.data() as Order) };
//       }
//     }
//   }

//   async loadStoreInfo() {
//     const ref = doc(this.firestore, `Stores/${this.storeSlug}`);
//     const snap = await getDoc(ref);
//     if (snap.exists()) {
//       this.storeInfo = snap.data();
//     }
//   }

//   // New method to fetch customer details by mobile
//   async loadCustomerByMobile(mobile?: string) {
//     if (!mobile || !this.storeSlug) return;
//     const ref = doc(this.firestore, `Stores/${this.storeSlug}/customers/${mobile}`);
//     const snap = await getDoc(ref);
//     if (snap.exists()) {
//       this.order.customerName = snap.data()['name'] || '';
//     }
//   }

//   addItem() {
//     this.order.items.push({
//       id: uuid(),
//       name: '',
//       price: 0,
//       quantity: 1,
//       subtotal: 0,
//       status: 'Pending',
//     });
//     this.recalculate();
//   }

//   removeItem(i: number) {
//     this.order.items.splice(i, 1);
//     this.recalculate();
//   }

//   recalculate() {
//     this.order.items.forEach((item) => {
//       item.subtotal = (item.price || 0) * (item.quantity || 0);
//     });
//     this.order.subtotal = this.order.items.reduce((a, b) => a + (b.subtotal || 0), 0);
//     const taxAmt = (this.order.subtotal * (this.order.tax || 0)) / 100;
//     this.order.total = this.order.subtotal + taxAmt - (this.order.discount || 0);
//   }

//   async save() {
//     if (!this.storeSlug) return;

//     const batch = writeBatch(this.firestore);
//     const storePath = `Stores/${this.storeSlug}`;
//     const ordersCol = collection(this.firestore, `${storePath}/orders`);
//     const tablesCol = collection(this.firestore, `${storePath}/tables`);
//     const customersCol = collection(this.firestore, `${storePath}/customers`);

//     try {
//       let finalOrderId = this.order.id;

//       // 1. Sync Customer Details to customers collection
//       if (this.order.customerMobile) {
//         const custRef = doc(this.firestore, `${storePath}/customers/${this.order.customerMobile}`);
//         batch.set(custRef, {
//           mobile: this.order.customerMobile,
//           name: this.order.customerName || '',
//           lastVisited: serverTimestamp()
//         }, { merge: true });
//       }

//       if (this.isEdit && this.order.id) {
//         const orderRef = doc(this.firestore, `${storePath}/orders/${this.order.id}`);
//         batch.update(orderRef, {
//           ...this.order,
//           updatedAt: serverTimestamp(),
//         });
//       } else {
//         const q = query(
//           ordersCol,
//           where('tableNumber', '==', this.order.tableNumber),
//           where('status', 'in', ['Open', 'In Progress', 'Ready'])
//         );
//         const openSnap = await getDocs(q);
        
//         if (!openSnap.empty) {
//           const existingDoc = openSnap.docs[0];
//           const existingData = existingDoc.data() as Order;
//           finalOrderId = existingDoc.id;

//           const mergedItems = [...(existingData.items || []), ...this.order.items];
//           const subtotal = mergedItems.reduce((a, b) => a + b.subtotal, 0);
//           const taxAmt = (subtotal * (this.order.tax || 0)) / 100;
//           const total = subtotal + taxAmt - (this.order.discount || 0);

//           batch.update(existingDoc.ref, {
//             items: mergedItems,
//             subtotal,
//             total,
//             customerName: this.order.customerName || existingData.customerName,
//             customerMobile: this.order.customerMobile || existingData.customerMobile,
//             discount: this.order.discount,
//             tax: this.order.tax,
//             waiter: this.order.waiter || existingData.waiter || null,
//             updatedAt: serverTimestamp(),
//           });
//         } else {
//           const newOrderRef = doc(ordersCol);
//           finalOrderId = newOrderRef.id;
//           this.order.id = finalOrderId;
          
//           batch.set(newOrderRef, {
//             ...this.order,
//             createdAt: serverTimestamp(),
//             updatedAt: serverTimestamp()
//           });
//         }
//       }

//       if (this.order.tableNumber) {
//         const tableQ = query(tablesCol, where('number', '==', this.order.tableNumber));
//         const tableSnap = await getDocs(tableQ);
//         if (!tableSnap.empty) {
//           batch.update(tableSnap.docs[0].ref, {
//             isOccupied: this.order.status !== 'Paid' && this.order.status !== 'Cancelled',
//             status: this.order.status === 'Paid' ? 'Available' : 'Occupied',
//             orderId: this.order.status === 'Paid' ? null : finalOrderId,
//             waiter: this.order.status === 'Paid' ? null : (this.order.waiter || null),
//           });
//         }
//       }

//       await batch.commit();
//       alert(this.isOnline ? '✅ Order saved successfully.' : '📦 Saved locally. Will sync when online.');
//       this.router.navigate([`/${this.storeSlug}/orders`]);

//     } catch (err) {
//       console.error('Error saving:', err);
//       alert('❌ Error saving order.');
//     }
//   }

//   async printInvoice() {
//     const order = this.order;
//     const store = this.storeInfo;
//     const cgst = ((order.subtotal * (order.tax / 2)) / 100).toFixed(2);
//     const sgst = ((order.subtotal * (order.tax / 2)) / 100).toFixed(2);
//     const total = (order.subtotal + parseFloat(cgst) + parseFloat(sgst) - (order.discount || 0)).toFixed(2);
//     const rounded = Math.round(Number(total));

//     const digitalReceiptUrl = `https://platter.bizzeazy.com/${this.storeSlug}/invoice-slip/${order.id}`;
//     const qrDataUrl = await QRCode.toDataURL(digitalReceiptUrl);

//     const invoiceHTML = `
//       <html>
//         <head>
//           <title>Invoice - ${order.id}</title>
//           <style>
//             @page { size: 58mm auto; margin: 0; }
//             body { width: 58mm; margin: 0 auto; font-family: 'Courier New', monospace; font-size: 11px; }
//             .center { text-align: center; }
//             .bold { font-weight: bold; }
//             .line { border-top: 1px dashed #000; margin: 5px 0; }
//             table { width: 100%; border-collapse: collapse; }
//             .right { text-align: right; }
//           </style>
//         </head>
//         <body onload="window.print(); window.close();">
//           <div class="center bold">${store.name || 'Restaurant'}</div>
//           <div class="center" style="font-size:9px;">${store.address || ''}</div>
//           <div class="line"></div>
          
//           ${order.customerName ? `<div>Cust: ${order.customerName}</div>` : ''}
//           ${order.customerMobile ? `<div>Mob: ${order.customerMobile}</div>` : ''}
          
//           <div>Table: ${order.tableNumber} | Order: ${order.id?.substr(0,8)}</div>
//           <div class="line"></div>
//           <table>
//             ${order.items.map(i => `<tr><td>${i.name} x${i.quantity}</td><td class="right">${i.subtotal.toFixed(2)}</td></tr>`).join('')}
//           </table>
//           <div class="line"></div>
//           <div class="right">Subtotal: ₹${order.subtotal.toFixed(2)}</div>
//           <div class="right">Tax (${order.tax}%): ₹${(parseFloat(cgst) + parseFloat(sgst)).toFixed(2)}</div>
//           <div class="right bold">Total: ₹${rounded}</div>
//           <div class="line"></div>
//           <div class="center">
//             <img src="${qrDataUrl}" style="width:60px;">
//             <div style="font-size:8px;">Scan for Digital Bill</div>
//           </div>
//         </body>
//       </html>
//     `;

//     const printWindow = window.open('', '', 'height=600,width=400');
//     printWindow?.document.write(invoiceHTML);
//     printWindow?.document.close();
//   }
// }



import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  Firestore,
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  where,
  serverTimestamp,
  writeBatch,
  setDoc
} from '@angular/fire/firestore';
import { ActivatedRoute, Router } from '@angular/router';
import { v4 as uuid } from 'uuid';
import QRCode from 'qrcode';

// ⭐ INJECT YOUR SERVICE
import { StoreContextService } from '../../core/store-context.service';

interface CartItem {
  id?: string;
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
  status?: 'Pending' | 'In Progress' | 'Ready' | 'Served';
}

interface Order {
  id?: string;
  tableNumber: number;
  customerName?: string;
  customerMobile?: string;
  items: CartItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  status: 'Open' | 'In Progress' | 'Ready' | 'Paid' | 'Cancelled';
  createdAt: any;
  updatedAt?: any;
  waiter?: string;
  paymentMode?: 'CASH' | 'CARD';
  paidAt?: any;
}

@Component({
  selector: 'app-add-order',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './add-order.component.html',
  styleUrls: ['./add-order.component.css'],
})
export class AddOrderComponent implements OnInit {
  order: Order = {
    tableNumber: 0,
    customerName: '',
    customerMobile: '',
    items: [],
    subtotal: 0,
    tax: 5,
    discount: 0,
    total: 0,
    status: 'Open',
    createdAt: new Date(),
  };

  isEdit = false;
  storeSlug: string | null | undefined = null;
  storeInfo: any = {};
  isOnline = navigator.onLine;

  // Holds fetched products for autocomplete
  inventoryItems: any[] = [];

  constructor(
    private firestore: Firestore,
    private route: ActivatedRoute,
    private router: Router,
    private storeContext: StoreContextService // Service Injected
  ) {
    window.addEventListener('online', () => this.isOnline = true);
    window.addEventListener('offline', () => this.isOnline = false);
  }

  async ngOnInit() {
    this.storeSlug = this.route.snapshot.paramMap.get('storeSlug') || this.route.parent?.snapshot.paramMap.get('storeSlug');
    const id = this.route.snapshot.paramMap.get('id');

    if (this.storeSlug) {
      if (!this.storeContext.currentStoreId || this.storeContext.currentSlug !== this.storeSlug) {
        await this.storeContext.initFromSlug(this.storeSlug);
      }
      await this.loadStoreInfo();
      await this.loadInventory(); // Fetch items
    }

    const targetStoreId = this.storeContext.currentStoreId || this.storeSlug;
    if (id && targetStoreId) {
      this.isEdit = true;
      const ref = doc(this.firestore, `Stores/${targetStoreId}/orders/${id}`);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        this.order = { id: snap.id, ...(snap.data() as Order) };
      }
    }
  }

  async loadStoreInfo() {
    const targetStoreId = this.storeContext.currentStoreId || this.storeSlug;
    if (!targetStoreId) return;
    const ref = doc(this.firestore, `Stores/${targetStoreId}`);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      this.storeInfo = snap.data();
    }
  }

  // ⭐ FOOLPROOF INVENTORY FETCH
// ⭐ FETCH MENU ITEMS FOR AUTOCOMPLETE
  async loadInventory() {
    if (!this.storeContext.currentStoreId) return;
    try {
      // Look specifically in the menuItems collection used by your POS
      const invRef = collection(this.firestore, `Stores/${this.storeContext.currentStoreId}/menuItems`);
      const snap = await getDocs(invRef);
      
      if (!snap.empty) {
        this.inventoryItems = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log(`✅ Loaded ${this.inventoryItems.length} menu items for autocomplete.`, this.inventoryItems);
      } else {
        console.warn("❌ menuItems collection is empty.");
      }
    } catch (err) {
      console.error("❌ Error loading menu items:", err);
    }
  }

  async loadCustomerByMobile(mobile?: string) {
    const targetStoreId = this.storeContext.currentStoreId || this.storeSlug;
    if (!mobile || !targetStoreId) return;
    const ref = doc(this.firestore, `Stores/${targetStoreId}/customers/${mobile}`);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      this.order.customerName = snap.data()['name'] || '';
    }
  }

  addItem() {
    this.order.items.push({
      id: uuid(),
      name: '',
      price: 0,
      quantity: 1,
      subtotal: 0,
      status: 'Pending',
    });
    this.recalculate();
  }

  // ⭐ AUTOCOMPLETE & PRICE FILL TRIGGER
  onItemNameChange(item: CartItem) {
    if (!item.name) return;
    const searchName = item.name.trim().toLowerCase();
    
    const matchedProduct = this.inventoryItems.find(
      inv => (inv.name || inv.title || inv.itemName || '').trim().toLowerCase() === searchName
    );

    if (matchedProduct) {
      const itemPrice = matchedProduct.price || matchedProduct.sellingPrice || matchedProduct.basePrice || matchedProduct.rate || 0;
      item.price = Number(itemPrice);
      if(item.quantity === 0) item.quantity = 1;
    }
    this.recalculate();
  }

  removeItem(i: number) {
    this.order.items.splice(i, 1);
    this.recalculate();
  }

  recalculate() {
    this.order.items.forEach((item) => {
      item.subtotal = (Number(item.price) || 0) * (Number(item.quantity) || 0);
    });
    this.order.subtotal = this.order.items.reduce((a, b) => a + (b.subtotal || 0), 0);
    const taxAmt = (this.order.subtotal * (Number(this.order.tax) || 0)) / 100;
    this.order.total = this.order.subtotal + taxAmt - (Number(this.order.discount) || 0);
  }

  async save() {
    const targetStoreId = this.storeContext.currentStoreId || this.storeSlug;
    if (!targetStoreId) return;

    const batch = writeBatch(this.firestore);
    const storePath = `Stores/${targetStoreId}`;
    const ordersCol = collection(this.firestore, `${storePath}/orders`);
    const tablesCol = collection(this.firestore, `${storePath}/tables`);

    try {
      let finalOrderId = this.order.id;

      if (this.order.customerMobile) {
        const custRef = doc(this.firestore, `${storePath}/customers/${this.order.customerMobile}`);
        batch.set(custRef, {
          mobile: this.order.customerMobile,
          name: this.order.customerName || '',
          lastVisited: serverTimestamp()
        }, { merge: true });
      }

      if (this.isEdit && this.order.id) {
        const orderRef = doc(this.firestore, `${storePath}/orders/${this.order.id}`);
        batch.update(orderRef, {
          ...this.order,
          updatedAt: serverTimestamp(),
        });
      } else {
        const q = query(
          ordersCol,
          where('tableNumber', '==', this.order.tableNumber),
          where('status', 'in', ['Open', 'In Progress', 'Ready'])
        );
        const openSnap = await getDocs(q);
        
        if (!openSnap.empty) {
          const existingDoc = openSnap.docs[0];
          const existingData = existingDoc.data() as Order;
          finalOrderId = existingDoc.id;

          const mergedItems = [...(existingData.items || []), ...this.order.items];
          const subtotal = mergedItems.reduce((a, b) => a + b.subtotal, 0);
          const taxAmt = (subtotal * (this.order.tax || 0)) / 100;
          const total = subtotal + taxAmt - (this.order.discount || 0);

          batch.update(existingDoc.ref, {
            items: mergedItems,
            subtotal,
            total,
            customerName: this.order.customerName || existingData.customerName,
            customerMobile: this.order.customerMobile || existingData.customerMobile,
            discount: this.order.discount,
            tax: this.order.tax,
            waiter: this.order.waiter || existingData.waiter || null,
            updatedAt: serverTimestamp(),
          });
        } else {
          const newOrderRef = doc(ordersCol);
          finalOrderId = newOrderRef.id;
          this.order.id = finalOrderId;
          
          batch.set(newOrderRef, {
            ...this.order,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        }
      }

      if (this.order.tableNumber) {
        const tableQ = query(tablesCol, where('number', '==', this.order.tableNumber));
        const tableSnap = await getDocs(tableQ);
        if (!tableSnap.empty) {
          batch.update(tableSnap.docs[0].ref, {
            isOccupied: this.order.status !== 'Paid' && this.order.status !== 'Cancelled',
            status: this.order.status === 'Paid' ? 'Available' : 'Occupied',
            orderId: this.order.status === 'Paid' ? null : finalOrderId,
            waiter: this.order.status === 'Paid' ? null : (this.order.waiter || null),
          });
        }
      }

      await batch.commit();
      alert(this.isOnline ? '✅ Order saved successfully.' : '📦 Saved locally. Will sync when online.');
      this.router.navigate([`/${this.storeSlug}/orders`]); 

    } catch (err) {
      console.error('Error saving:', err);
      alert('❌ Error saving order.');
    }
  }

  async printInvoice() {
    const order = this.order;
    const store = this.storeInfo;
    const cgst = ((order.subtotal * (order.tax / 2)) / 100).toFixed(2);
    const sgst = ((order.subtotal * (order.tax / 2)) / 100).toFixed(2);
    const total = (order.subtotal + parseFloat(cgst) + parseFloat(sgst) - (order.discount || 0)).toFixed(2);
    const rounded = Math.round(Number(total));

    const digitalReceiptUrl = `https://platter.bizzeazy.com/${this.storeSlug}/invoice-slip/${order.id}`;
    const qrDataUrl = await QRCode.toDataURL(digitalReceiptUrl);

    const invoiceHTML = `
      <html>
        <head>
          <title>Invoice - ${order.id}</title>
          <style>
            @page { size: 58mm auto; margin: 0; }
            body { width: 58mm; margin: 0 auto; font-family: 'Courier New', monospace; font-size: 11px; }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .line { border-top: 1px dashed #000; margin: 5px 0; }
            table { width: 100%; border-collapse: collapse; }
            .right { text-align: right; }
          </style>
        </head>
        <body onload="window.print(); window.close();">
          <div class="center bold">${store.name || 'Restaurant'}</div>
          <div class="center" style="font-size:9px;">${store.address || ''}</div>
          <div class="line"></div>
          
          ${order.customerName ? `<div>Cust: ${order.customerName}</div>` : ''}
          ${order.customerMobile ? `<div>Mob: ${order.customerMobile}</div>` : ''}
          
          <div>Table: ${order.tableNumber} | Order: ${order.id?.substr(0,8)}</div>
          <div class="line"></div>
          <table>
            ${order.items.map(i => `<tr><td>${i.name} x${i.quantity}</td><td class="right">${i.subtotal.toFixed(2)}</td></tr>`).join('')}
          </table>
          <div class="line"></div>
          <div class="right">Subtotal: ₹${order.subtotal.toFixed(2)}</div>
          <div class="right">Tax (${order.tax}%): ₹${(parseFloat(cgst) + parseFloat(sgst)).toFixed(2)}</div>
          <div class="right bold">Total: ₹${rounded}</div>
          <div class="line"></div>
          <div class="center">
            <img src="${qrDataUrl}" style="width:60px;">
            <div style="font-size:8px;">Scan for Digital Bill</div>
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open('', '', 'height=600,width=400');
    printWindow?.document.write(invoiceHTML);
    printWindow?.document.close();
  }
}