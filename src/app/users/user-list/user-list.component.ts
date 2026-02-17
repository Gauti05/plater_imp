// import { Component, OnInit, ViewEncapsulation } from '@angular/core';
// import { ActivatedRoute } from '@angular/router';
// import { Firestore, collection, collectionData } from '@angular/fire/firestore';
// import { CommonModule } from '@angular/common';
// import { DynamicTableComponent } from '../../store/dynamic-table/dynamic-table.component';

// type UserDoc = {
//   id?: string;
//   name: string;
//   designation?: string;
//   email: string;
//   phone?: string;
//   isActive: boolean;
//   roles: string[];
//   createdAt?: any;
// };

// @Component({
//   selector: 'app-user-list',
//   standalone: true,
//   imports: [CommonModule, DynamicTableComponent],
//   templateUrl: './user-list.component.html',
//   styleUrls: ['./user-list.component.css'],
//   encapsulation: ViewEncapsulation.None
// })
// export class UserListComponent implements OnInit {
//   storeId = '';
//   users: any[] = [];

//   tableColumns = [
//     { label: 'Name', field: 'name' },
//     { label: 'Email', field: 'email' },
//     { label: 'Designation', field: 'designation' },
//     { label: 'Roles', field: 'roles' },
//     { label: 'Status', field: 'status' },
//     { label: 'Created', field: 'createdAtStr' },
//   ];

//   constructor(
//     private route: ActivatedRoute,
//     private firestore: Firestore,
//   ) {}

//   ngOnInit(): void {
//     this.route.paramMap.subscribe(params => {
//       this.storeId = params.get('storeId') || '';
//       console.log(this.storeId)
//       this.loadUsers();
//     });
//   }

//   private loadUsers() {
//     const ref = collection(this.firestore, `users`);
//     collectionData(ref, { idField: 'id' }).subscribe({
//       next: (rows: any[]) => {
//         this.users = rows.map((raw: UserDoc) => this.mapRow(raw));
//       },
//       error: (err) => console.error('Error fetching users:', err)
//     });
//   }

//   private mapRow(u: UserDoc) {
//     const created = this.toDate(u.createdAt);
//     const createdAtStr = created
//       ? created.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
//       : '—';
//     const status = u.isActive ? 'Active' : 'Inactive';
//     const rolesStr = u.roles?.length ? u.roles.join(', ') : '—';
    
//     return {
//       ...u,
//       roles: rolesStr,
//       status,
//       createdAtStr
//     };
//   }

//   private toDate(v: any): Date | null {
//     if (v?.toDate) { try { return v.toDate(); } catch { return null; } }
//     if (typeof v === 'string') { const d = new Date(v); return isNaN(+d) ? null : d; }
//     if (v instanceof Date) return v;
//     return null;
//   }
// }


import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Firestore, collection, collectionData, query, where } from '@angular/fire/firestore';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; 
import { DynamicTableComponent } from '../../store/dynamic-table/dynamic-table.component';
import { StoreContextService } from '../../core/store-context.service';

type UserDoc = {
  id?: string;
  name: string;
  designation?: string;
  email: string;
  phone?: string;
  isActive: boolean;
  roles: string[];
  storeId?: string; 
  createdAt?: any;
};

@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [CommonModule, DynamicTableComponent, FormsModule],
  templateUrl: './user-list.component.html',
  styleUrls: ['./user-list.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class UserListComponent implements OnInit {
  storeSlug = '';
  users: any[] = [];
  
  // Pagination State
  filteredData: any[] = [];
  paginatedData: any[] = [];
  Math = Math;
  currentPage = 1;
  itemsPerPage = 10;
  totalPages = 1;
  visiblePages: number[] = [];

  tableColumns = [
    { label: 'Name', field: 'name' },
    { label: 'Email', field: 'email' },
    { label: 'Designation', field: 'designation' },
    { label: 'Roles', field: 'roles' },
    { label: 'Status', field: 'status' },
    { label: 'Created', field: 'createdAtStr' },
  ];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private firestore: Firestore,
    private storeContext: StoreContextService
  ) {}

  async ngOnInit() {
    this.storeSlug = this.route.snapshot.paramMap.get('storeSlug') || this.route.parent?.snapshot.paramMap.get('storeSlug') || '';
    
    if (this.storeSlug) {
      if (!this.storeContext.currentStoreId || this.storeContext.currentSlug !== this.storeSlug) {
        await this.storeContext.initFromSlug(this.storeSlug);
      }
      this.loadRestaurantUsers();
    }
  }

  private loadRestaurantUsers() {
    const storeId = this.storeContext.currentStoreId;
    if (!storeId) return;

    // ⭐ FIXED: Fetching from the root 'users' collection
    const usersRef = collection(this.firestore, `users`);
    const q = query(usersRef, where('storeId', '==', storeId));

    collectionData(q, { idField: 'id' }).subscribe({
      next: (rows: any[]) => {
        this.users = rows.map((raw: UserDoc) => this.mapRow(raw));
        this.applyFilter(); 
      },
      error: (err) => {
        console.error('Error fetching restaurant users:', err);
      }
    });
  }

  applyFilter() {
    this.filteredData = [...this.users];
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

  onPageSizeChange() { 
    this.currentPage = 1; 
    this.updatePagination(); 
  }

  private mapRow(u: UserDoc) {
    const created = this.toDate(u.createdAt);
    const createdAtStr = created
      ? created.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      : '—';
    const status = u.isActive ? 'Active' : 'Inactive';
    
    const rolesStr = (u.roles && u.roles.length > 0) ? u.roles.join(', ') : 'No Role Assigned';
    
    return {
      ...u,
      roles: rolesStr, 
      status,
      createdAtStr
    };
  }

  private toDate(v: any): Date | null {
    if (v?.toDate) { try { return v.toDate(); } catch { return null; } }
    if (typeof v === 'string') { const d = new Date(v); return isNaN(+d) ? null : d; }
    if (v instanceof Date) return v;
    return null;
  }
}