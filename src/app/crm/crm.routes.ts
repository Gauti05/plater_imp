// import { Routes } from '@angular/router';
// import { CrmComponent } from './crm.component';
// import { AddComponent } from './add/add.component';
// import { ViewComponent } from './view/view.component';


// export const crmRoutes: Routes = [
//   {
//     path: '',
//     component: CrmComponent,
//     data: {
//       title: 'CRM',
//       breadcrumb: [
//         { label: 'CRM', link: '' }
//       ]
//     }
//   },
//   {
//     path: 'add',
//     component: AddComponent,
//     data: {
//       title: 'Add Customer',
//       breadcrumb: [
//         { label: 'CRM', link: '/crm' },
//         { label: 'Add', link: '' }
//       ]
//     }
//   },
//   {
//     path: 'view/:id',
//     component: ViewComponent,
//     data: {
//       title: 'View',
//       breadcrumb: [
//         { label: 'CRM', link: '/crm' },
//         { label: 'View', link: '' }
//       ]
//     }
//   },
// ];



import { Routes } from '@angular/router';
import { CrmComponent } from './crm.component';
import { AddComponent } from './add/add.component';
import { ViewComponent } from './view/view.component';
// Assume you will create this file next
import { LoyaltySettingsComponent } from './loyalty-settings/loyalty-settings.component';

export const crmRoutes: Routes = [
  {
    path: '',
    component: CrmComponent,
    data: { title: 'CRM', breadcrumb: [{ label: 'CRM', link: '' }] }
  },
  {
    path: 'loyalty-settings', // ⭐ NEW ROUTE
    component: LoyaltySettingsComponent,
    data: { title: 'Loyalty Rules', breadcrumb: [{ label: 'CRM', link: '/crm' }, { label: 'Loyalty', link: '' }] }
  },
  {
    path: 'add',
    component: AddComponent,
    data: { title: 'Add Customer', breadcrumb: [{ label: 'CRM', link: '/crm' }, { label: 'Add', link: '' }] }
  },
  {
    path: 'view/:id',
    component: ViewComponent,
    data: { title: 'View', breadcrumb: [{ label: 'CRM', link: '/crm' }, { label: 'View', link: '' }] }
  },
];