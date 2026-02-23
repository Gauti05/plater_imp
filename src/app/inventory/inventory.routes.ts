import { Routes } from '@angular/router';

// Inventory Shell
import { InventoryComponent } from './inventory.component';

// Dashboard
import { DashboardComponent } from './dashboard/dashboard.component';

// Raw Materials
import { RawMaterialListComponent } from './raw-material-list/raw-material-list.component';
import { AddRawMaterialComponent } from './add-raw-material/add-raw-material.component';

// Menu Items
import { MenuItemListComponent } from './menu-item-list/menu-item-list.component';
import { AddMenuComponent } from './add-menu/add-menu.component';

// Modifiers
import { ModifierListComponent } from './modifiers/modifier-list/modifier-list.component';
import { AddModifierComponent } from './modifiers/add-modifier/add-modifier.component';

// Suppliers
import { SupplierListComponent } from './suppliers/supplier-list/supplier-list.component';
import { AddSupplierComponent } from './suppliers/add-supplier/add-supplier.component';

// Purchases
import { PurchaseOrderListComponent } from './purchases/purchase-order-list/purchase-order-list.component';
import { AddPurchaseOrderComponent } from './purchases/add-purchase-order/add-purchase-order.component';

// Stock Adjustments
import { StockAdjustmentListComponent } from './stock-adjustments/stock-adjustment-list/stock-adjustment-list.component';
import { AddStockAdjustmentComponent } from './stock-adjustments/add-stock-adjustment/add-stock-adjustment.component';

// Reports
import { InventoryReportsComponent } from './reports/inventory-reports/inventory-reports.component';
import { BulkUploadMenuComponent } from './bulk-upload-menu/bulk-upload-menu.component';


import { ItemGroupListComponent } from './item-groups/item-group-list.component'; // ⭐ NEW
export const INVENTORY_ROUTES: Routes = [
  {
    path: '',
    component: InventoryComponent,
    children: [
      { path: '', component: DashboardComponent, data: { title: 'Inventory Dashboard' } },

      // Raw Materials
      { path: 'raw-materials', component: RawMaterialListComponent, data: { title: 'Raw Materials' } },
      { path: 'add-raw-material', component: AddRawMaterialComponent, data: { title: 'Add Raw Material' } },
      { path: 'edit-raw-material/:id', component: AddRawMaterialComponent, data: { title: 'Edit Raw Material' } },

      // Menu Items
      { path: 'menu-items', component: MenuItemListComponent, data: { title: 'Menu Items' } },
      { path: 'add-menu', component: AddMenuComponent, data: { title: 'Add Menu Item' } },
      { path: 'edit-menu/:id', component: AddMenuComponent, data: { title: 'Edit Menu Item' } },

      // Modifiers
      { path: 'modifiers', component: ModifierListComponent, data: { title: 'Modifiers' } },
      { path: 'add-modifier', component: AddModifierComponent, data: { title: 'Add Modifier' } },
      { path: 'edit-modifier/:id', component: AddModifierComponent, data: { title: 'Edit Modifier' } },

      // Suppliers
      { path: 'suppliers', component: SupplierListComponent, data: { title: 'Suppliers' } },
      { path: 'add-supplier', component: AddSupplierComponent, data: { title: 'Add Supplier' } },
      { path: 'edit-supplier/:id', component: AddSupplierComponent, data: { title: 'Edit Supplier' } },

      // Purchases
      { path: 'purchase-orders', component: PurchaseOrderListComponent, data: { title: 'Purchase Orders' } },
      { path: 'add-purchase-order', component: AddPurchaseOrderComponent, data: { title: 'Add Purchase Order' } },
      { path: 'edit-purchase-order/:id', component: AddPurchaseOrderComponent, data: { title: 'Edit Purchase Order' } },

      // Stock Adjustments
      { path: 'stock-adjustments', component: StockAdjustmentListComponent, data: { title: 'Stock Adjustments' } },
      { path: 'add-stock-adjustment', component: AddStockAdjustmentComponent, data: { title: 'Add Stock Adjustment' } },
      { path: 'edit-stock-adjustment/:id', component: AddStockAdjustmentComponent, data: { title: 'Edit Stock Adjustment' } },

      { path: 'bulk-upload-menu', component: BulkUploadMenuComponent, data: { title: 'Bulk Upload' } },
      // Reports
      { path: 'reports', component: InventoryReportsComponent, data: { title: 'Inventory Reports' } },
      { path: 'item-groups', component: ItemGroupListComponent }
    ]
  }
];
