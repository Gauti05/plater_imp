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

import { Routes, CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';

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
import { StoreSelectorComponent } from './store-selector/store-selector.component';
import { LoyaltySettingsComponent } from './crm/loyalty-settings/loyalty-settings.component';
import { QrMenuComponent } from './qr-menu/qr-menu.component';
import { FeedbackComponent } from './feedback/feedback.component'; // ⭐ Kept your import


export const adminGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  const firestore = inject(Firestore);
  const router = inject(Router);

  return new Promise<boolean>((resolve) => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      unsubscribe();
      if (!user) {
        router.navigate(['/login']);
        resolve(false);
        return;
      }
      const snap = await getDoc(doc(firestore, `Users/${user.uid}`));
      const role = snap.data()?.['userRole'];
      
      if (role === 'Admin' || role === 'Storeadmin' || role === 'Superadmin') {
        resolve(true);
      } else {
        alert('Access Denied: You do not have permission to view this page.');
        resolve(false);
      }
    });
  });
};

export const routes: Routes = [
  {
    path: 'login',
    canMatch: [loginBlockGuard],
    component: LoginComponent,
    data: { title: 'Login' }
  },
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
      { path: 'users', canActivate: [adminGuard], component: UserListComponent, data: { title: 'Users' } },
      { path: 'users/add', canActivate: [adminGuard], component: AddUserComponent, data: { title: 'Add User' } },
      { path: 'users/edit/:id', canActivate: [adminGuard], component: AddUserComponent, data: { title: 'Edit User' } },
      { path: 'reports', canActivate: [adminGuard], component: ReportComponent, data: { title: 'Reports' } },
      { path: 'customise', canActivate: [adminGuard], component: CustomisationComponent, data: { title: 'Customise' } },
      { path: 'table', canActivate: [adminGuard], component: TableManagementComponent, data: { title: 'Table Management' } },
      { path: 'marketing', canActivate: [adminGuard], component: MarketingComponent, data: { title: 'Marketing' } },
      { path: 'discount', canActivate: [adminGuard], component: TableManagementComponent, data: { title: 'Discount' } },
      { path: 'ai-studio', canActivate: [adminGuard], component: AiStudioComponent, data: { title: 'Ai Studio' } },
      { path: 'pay', canActivate: [adminGuard], component: PayComponent, data: { title: 'Payroll' } },
      
      // ⭐ Moved to top level children and renamed to match sidebar link
      { path: 'loyalty-rules', canActivate: [adminGuard], component: LoyaltySettingsComponent, data: { title: 'Loyalty Rules' } },

      {
        path: 'inventory',
        canActivate: [adminGuard],
        loadChildren: () => import('./inventory/inventory.routes').then(m => m.INVENTORY_ROUTES)
      },
      { path: 'orders', component: OrdersComponent, data: { title: 'Orders' } },
      { path: 'orders/add', component: AddOrderComponent, data: { title: 'Add Order' } },
      { path: 'orders/edit/:id', component: AddOrderComponent, data: { title: 'Edit Order' } },
      { path: 'mailer', component: MailerComponent, data: { title: 'Mailer' } },
      { path: 'profile', component: ProfileComponent, data: { title: 'Profile' } },
      
      // CRM ROUTES
      { path: 'crm', component: CrmComponent, data: { title: 'CRM' } },
      { path: 'crm/add', component: AddComponent, data: { title: 'CRM' } },
      { path: 'crm/view/:id', component: ViewComponent, data: { title: 'CRM' } },
      
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
  {
    path: ':storeSlug/menu',
    component: QrMenuComponent,
    data: { title: 'Digital Menu' }
  },
  // ⭐ NEW: Customer-facing Feedback form route (No auth guard needed so customers can access it)
  {
    path: ':storeSlug/feedback',
    component: FeedbackComponent,
    data: { title: 'Customer Feedback' }
  },
  
  { path: '**', redirectTo: '/login' }
];