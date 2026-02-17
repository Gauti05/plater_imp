export interface PurchaseOrderItem {
  itemId: string;
  itemName: string;
  type: 'raw-material' | 'menu-item';
  quantity: number;
  receivedQuantity: number;
  unit: string;
  price: number;
  discount?: number;
  gstPercent: number;
  total: number;
}

export interface PurchaseOrder {
  id?: string;
  poNumber: string;
  supplierId: string;
  supplierName?: string;
  supplierContact?: string;
  status: 'draft' | 'finalized' | 'received' | 'cancelled';
  poDate: any; // Firestore Timestamp
  expectedDate?: any;
  paymentTerms?: string;
  items: PurchaseOrderItem[];
  subtotal: number;
  discountTotal: number;
  gstTotal: number;
  shippingCharges?: number;
  otherCharges?: number;
  grandTotal: number;
  notes?: string;
}
