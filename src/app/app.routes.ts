// import { Routes } from '@angular/router';
// import { authGuard, loginBlockGuard } from './core/auth.guard';
// import { LoginComponent } from './login/login.component';
// import { LayoutComponent } from './layout/layout.component';
// import { DashboardComponent } from './dashboard/dashboard.component';
// import { UserListComponent } from './users/user-list/user-list.component';
// import { AddUserComponent } from './users/add-user/add-user.component';
// import { ReportComponent } from './report/report.component';
// import { AiStudioComponent } from './ai-studio/ai-studio.component';
// import { InventoryComponent } from './inventory/inventory.component';
// import { AddRawMaterialComponent } from './inventory/add-raw-material/add-raw-material.component';
// import { AddMenuComponent } from './inventory/add-menu/add-menu.component';
// import { PosComponent } from './pos/pos.component';
// import { OrdersComponent } from './orders/orders.component';
// import { AddOrderComponent } from './orders/add-order/add-order.component';
// import { ProfileComponent } from './setting/profile/profile.component';
// import { CustomisationComponent } from './setting/customisation/customisation.component';
// import { TableManagementComponent } from './setting/table-management/table-management.component';
// import { InvoiceSlipComponent } from './invoice-slip/invoice-slip.component';
// import { BulkUploadMenuComponent } from './inventory/bulk-upload-menu/bulk-upload-menu.component';
// import { MailerComponent } from './mailer/mailer.component';
// import { CrmComponent } from './crm/crm.component';
// import { AddComponent } from './crm/add/add.component';
// import { ViewComponent } from './crm/view/view.component';
// import { PayComponent } from './manage/pay/pay.component';
// import { MarketingComponent } from './marketing/marketing.component';


// // app.routes.ts

// export const routes: Routes = [
//   {
//     path: 'login',
//     canMatch: [loginBlockGuard],
//     component: LoginComponent,
//     data: { title: 'Login' }
//   },

//   {
//     path: ':storeSlug',
//     canMatch: [authGuard],
//     component: LayoutComponent,
//     children: [
//       { path: 'dashboard', component: DashboardComponent, data: { title: 'Dashboard' } },
//       { path: 'users', component: UserListComponent, data: { title: 'Users' } },
//       { path: 'users/add', component: AddUserComponent, data: { title: 'Add User' } },
//       { path: 'users/edit/:id', component: AddUserComponent, data: { title: 'Edit User' } },
//       { path: 'orders', component: OrdersComponent, data: { title: 'Orders' } },
//       { path: 'orders/add', component: AddOrderComponent, data: { title: 'Add Order' } },
//       { path: 'orders/edit/:id', component: AddOrderComponent, data: { title: 'Edit Order' } },
//       { path: 'reports', component: ReportComponent, data: { title: 'Reports' } },
//       { path: 'mailer', component: MailerComponent, data: { title: 'Mailer' } },
//       { path: 'profile', component: ProfileComponent, data: { title: 'Profile' } },
//       { path: 'customise', component: CustomisationComponent, data: { title: 'Customise' } },
//       { path: 'table', component: TableManagementComponent, data: { title: 'Table Management' } },
//       { path: 'marketing', component: MarketingComponent, data: { title: 'Marketing' } },
//       { path: 'discount', component: TableManagementComponent, data: { title: 'Discount' } },
//       { path: 'ai-studio', component: AiStudioComponent, data: { title: 'Ai Studio' } },
//       { path: 'crm', component: CrmComponent, data: { title: 'CRM' } },
//       { path: 'crm/add', component: AddComponent, data: { title: 'CRM' } },
//       { path: 'crm/view/:id', component: ViewComponent, data: { title: 'CRM' } },
//        { path: 'pay', component: PayComponent, data: { title: 'Payroll' } },
//       {
//         path: 'inventory',
//         loadChildren: () => import('./inventory/inventory.routes').then(m => m.INVENTORY_ROUTES)
//       },
//       { path: '', pathMatch: 'full', redirectTo: 'dashboard' }
//     ]
//   },

//   // ✅ POS route OUTSIDE Layout for full screen
//   {
//     path: ':storeSlug/pos',
//     canMatch: [authGuard],
//     component: PosComponent,
//     data: { fullscreen: true, title: 'Point of Sale' }
//   },

//   // Invoice (still outside layout)
//   {
//     path: ':storeSlug/invoice-slip/:orderId',
//     component: InvoiceSlipComponent
//   },

//   { path: '**', redirectTo: '/login' }
// ];








import { Routes } from '@angular/router';
import { authGuard, loginBlockGuard } from './core/auth.guard';
import { LoginComponent } from './login/login.component';
import { LayoutComponent } from './layout/layout.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { UserListComponent } from './users/user-list/user-list.component';
import { AddUserComponent } from './users/add-user/add-user.component';
import { ReportComponent } from './report/report.component';
import { AiStudioComponent } from './ai-studio/ai-studio.component';
import { InventoryComponent } from './inventory/inventory.component';
import { AddRawMaterialComponent } from './inventory/add-raw-material/add-raw-material.component';
import { AddMenuComponent } from './inventory/add-menu/add-menu.component';
import { PosComponent } from './pos/pos.component';
import { OrdersComponent } from './orders/orders.component';
import { AddOrderComponent } from './orders/add-order/add-order.component';
import { ProfileComponent } from './setting/profile/profile.component';
import { CustomisationComponent } from './setting/customisation/customisation.component';
import { TableManagementComponent } from './setting/table-management/table-management.component';
import { InvoiceSlipComponent } from './invoice-slip/invoice-slip.component';
import { BulkUploadMenuComponent } from './inventory/bulk-upload-menu/bulk-upload-menu.component';
import { MailerComponent } from './mailer/mailer.component';
import { CrmComponent } from './crm/crm.component';
import { AddComponent } from './crm/add/add.component';
import { ViewComponent } from './crm/view/view.component';
import { PayComponent } from './manage/pay/pay.component';
import { MarketingComponent } from './marketing/marketing.component';
// ⭐ Import the new component
import { StoreSelectorComponent } from './store-selector/store-selector.component';

export const routes: Routes = [
  {
    path: 'login',
    canMatch: [loginBlockGuard],
    component: LoginComponent,
    data: { title: 'Login' }
  },

  // ⭐ NEW: Store Selector Route (Post-Login / Pre-Dashboard)
  {
    path: 'outlets',
    canMatch: [authGuard],
    component: StoreSelectorComponent,
    data: { title: 'Select Outlet' }
  },

  {
    path: ':storeSlug',
    canMatch: [authGuard],
    component: LayoutComponent,
    children: [
      { path: 'dashboard', component: DashboardComponent, data: { title: 'Dashboard' } },
      { path: 'users', component: UserListComponent, data: { title: 'Users' } },
      { path: 'users/add', component: AddUserComponent, data: { title: 'Add User' } },
      { path: 'users/edit/:id', component: AddUserComponent, data: { title: 'Edit User' } },
      { path: 'orders', component: OrdersComponent, data: { title: 'Orders' } },
      { path: 'orders/add', component: AddOrderComponent, data: { title: 'Add Order' } },
      { path: 'orders/edit/:id', component: AddOrderComponent, data: { title: 'Edit Order' } },
      { path: 'reports', component: ReportComponent, data: { title: 'Reports' } },
      { path: 'mailer', component: MailerComponent, data: { title: 'Mailer' } },
      { path: 'profile', component: ProfileComponent, data: { title: 'Profile' } },
      { path: 'customise', component: CustomisationComponent, data: { title: 'Customise' } },
      { path: 'table', component: TableManagementComponent, data: { title: 'Table Management' } },
      { path: 'marketing', component: MarketingComponent, data: { title: 'Marketing' } },
      { path: 'discount', component: TableManagementComponent, data: { title: 'Discount' } },
      { path: 'ai-studio', component: AiStudioComponent, data: { title: 'Ai Studio' } },
      { path: 'crm', component: CrmComponent, data: { title: 'CRM' } },
      { path: 'crm/add', component: AddComponent, data: { title: 'CRM' } },
      { path: 'crm/view/:id', component: ViewComponent, data: { title: 'CRM' } },
      { path: 'pay', component: PayComponent, data: { title: 'Payroll' } },
      {
        path: 'inventory',
        loadChildren: () => import('./inventory/inventory.routes').then(m => m.INVENTORY_ROUTES)
      },
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' }
    ]
  },

  {
    path: ':storeSlug/pos',
    canMatch: [authGuard],
    component: PosComponent,
    data: { fullscreen: true, title: 'Point of Sale' }
  },

  {
    path: ':storeSlug/invoice-slip/:orderId',
    component: InvoiceSlipComponent
  },

  { path: '**', redirectTo: '/login' }
];