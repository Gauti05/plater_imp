// import {
//   Component, Input, OnInit, Output, EventEmitter, OnChanges, SimpleChanges
// } from '@angular/core';
// import { CommonModule } from '@angular/common';
// import { FormsModule } from '@angular/forms';
// import { Router, RouterLink } from '@angular/router';

// @Component({
//   selector: 'app-dynamic-table',
//   standalone: true,
//   imports: [CommonModule, FormsModule, RouterLink],
//   templateUrl: './dynamic-table.component.html',
//   styleUrls: ['./dynamic-table.component.css']
// })
// export class DynamicTableComponent implements OnInit, OnChanges {
//   @Input() data: any[] = [];
//   @Input() columns: { field: string; label: string; sortable?: boolean; searchable?: boolean }[] = [];
//   @Input() filters: { field: string; label: string; type: 'text' | 'select' | 'dateRange' | 'multiselect'; options?: string[] }[] = [];
//   @Input() pageSize: number = 10;
//   @Input() hasActions: boolean = false;
//   @Input() buttonLabel: string = '';
//   @Input() buttonRoute: string = '';
//   @Input() rowRouteBase: string = '';
//   @Input() rowIdField: string = 'id';
//   @Input() initialState: any | null = null; // State restored from Firestore/Parent

//   @Input() serverMode: boolean = false;
//   @Input() totalItems: number = 0;
//   @Input() pageIndex: number = 0;

//   @Input() enableBulkStatusToggle: boolean = false;
//   @Input() actionViewUrlBuilder?: (row: any) => string;

//   @Output() rowClick = new EventEmitter<any>();
//   @Output() bulkDelete = new EventEmitter<any[]>();
//   @Output() filterChange = new EventEmitter<any>();
//   @Output() pageChange = new EventEmitter<{ pageIndex: number; pageSize: number }>();
//   @Output() sortChange = new EventEmitter<{ active: string; direction: 'asc'|'desc' }>();
//   @Output() queryChange = new EventEmitter<{ searchText: string; columnFilters: any; fromDate: string; toDate: string }>();
//   @Output() bulkSetActive = new EventEmitter<{ rows: any[]; active: boolean }>();
//   @Output() selectionChange = new EventEmitter<any[]>();
//   @Output() stateChange = new EventEmitter<any>(); // Emit the entire state object

//   searchText: string = '';
//   columnFilters: { [key: string]: any } = {};
//   fromDate: string = '';
//   toDate: string = '';

//   currentPage: number = 0;
//   sortField: string = '';
//   sortDirection: 'asc' | 'desc' = 'asc';
//   loading: boolean = false;
//   filteredData: any[] = [];
//   selectedRows: any[] = [];
//   allSelected = false;

//   visibleColumns: string[] = [];
//   defaultVisible: string[] = [];
//   allColumns: { field: string; label: string }[] = [];

//   private isInitialized = false; 
//   private hasDataLoaded = false; // NEW: Track when data is available

//   constructor(private router: Router) {}

//   ngOnInit(): void {
//     this.initializeFilters();
    
//     const initialVisible = this.columns.map(c => c.field).slice(0, 6);
//     this.visibleColumns = [...initialVisible];
//     this.defaultVisible = [...initialVisible];
//     this.allColumns = [...this.columns];
    
//     // 1. Initial State Load (Sync) if available
//     if (this.initialState) {
//         this.restoreState(this.initialState);
//     }

//     // Delaying the filter application until both state and data are ready
//     if (this.serverMode) this.emitQuery();

//     this.isInitialized = true; 
//   }

//   ngOnChanges(changes: SimpleChanges): void {
//     // 1. Handle asynchronous arrival of initialState (Auto Restoration)
//     if (changes['initialState'] && changes['initialState'].currentValue !== undefined) {
        
//         const currentState = changes['initialState'].currentValue;
        
//         // Ensure restoration runs if state data arrived after initial sync check
//         if (currentState && !changes['initialState'].firstChange) {
//             this.restoreState(currentState);
//             this.tryInitialFilter(); // Attempt to filter/apply state
//         }
//     }
    
//     // 2. Handle data arrival/changes
//     if (changes['data'] && this.isInitialized) {
//         if (!this.serverMode) {
//             this.hasDataLoaded = (changes['data'].currentValue?.length > 0);
//             this.tryInitialFilter(); // Attempt to filter/apply state
//         }
//     }
//   }
  
//   /**
//    * NEW: Attempts to run applyFilter only when data and state are both ready.
//    */
//   private tryInitialFilter(): void {
//       if (this.isInitialized && (this.serverMode || this.hasDataLoaded)) {
//           // If in server mode, only emit query. Otherwise, run client-side filter.
//           if (this.serverMode) this.emitQuery();
//           else this.applyFilter();
//       }
//   }

//   /**
//    * Dedicated method to apply the state object properties to the component.
//    */
//   private restoreState(s: any): void {
//     const initialVisible = this.columns.map(c => c.field).slice(0, 6);
    
//     // Restore visible columns
//     const restoredVisible = s.visibleColumns;
//     if (Array.isArray(restoredVisible) && restoredVisible.length > 0) {
//         this.visibleColumns = restoredVisible;
//     } else {
//         this.visibleColumns = initialVisible;
//     }
    
//     // ⭐ CRITICAL RESTORATION (Ensure page is set FIRST)
//     this.currentPage    = s.currentPage    ?? 0; 

//     // Restore all other state properties
//     this.searchText     = s.searchText     ?? '';
//     this.pageSize       = s.pageSize       ?? this.pageSize;
//     this.sortField      = s.sortField      ?? '';
//     this.sortDirection  = s.sortDirection  ?? 'asc';
//     this.fromDate       = s.fromDate       ?? '';
//     this.toDate         = s.toDate         ?? '';
    
//     // Crucial step for multiselect/complex filters: overwrite initial filters
//     this.initializeFilters(); 
//     if (s.columnFilters) {
//         this.columnFilters = { ...s.columnFilters }; 
//     }
//   }

//   initializeFilters() {
//     this.filters.forEach(f => {
//       this.columnFilters[f.field] = f.type === 'multiselect' ? [] : '';
//     });
//   }

//   exportCSV(): void {
//     const rows = (this.serverMode ? this.data : this.filteredData);
//     if (!rows || rows.length === 0) return;

//     const orderedCols = this.columns.filter(c => this.visibleColumns.includes(c.field));
//     const headers = orderedCols.map(c => c.label);

//     const escapeCSV = (val: any) => {
//       const s = this.getCSVString(val);
//       return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
//     };

//     const lines = [
//       headers.join(','),
//       ...rows.map(r => orderedCols.map(c => escapeCSV(r[c.field])).join(','))
//     ];

//     const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
//     const url = URL.createObjectURL(blob);
//     const a = document.createElement('a');
//     a.href = url;
//     a.download = `export_${new Date().toISOString().slice(0,19)}.csv`;
//     a.click();
//     URL.revokeObjectURL(url);
//   }

//   private getCSVString(val: any): string {
//     if (val?.toDate) return val.toDate().toISOString();
//     if (val instanceof Date) return val.toISOString();
//     if (Array.isArray(val)) return val.join('; ');
//     if (typeof val === 'object' && val !== null) {
//       return Object.values(val)
//         .filter(x => ['string','number','boolean'].includes(typeof x))
//         .join(' ');
//     }
//     return String(val ?? '');
//   }

//   onQueryChange(): void {
//     if (this.serverMode) {
//       this.emitQuery();
//     } else {
//       this.applyFilter();
//     }
//   }

//   applyDateFilter(): void {
//     this.onQueryChange();
//   }

//   resetFilters(): void {
//     this.searchText = '';
//     this.fromDate = '';
//     this.toDate = '';
//     Object.entries(this.columnFilters).forEach(([key, val]) => {
//       this.columnFilters[key] = Array.isArray(val) ? [] : '';
//     });
//     this.onQueryChange();
//   }

//   private emitQuery(): void {
//     const payload = {
//       searchText: this.searchText,
//       columnFilters: this.columnFilters,
//       fromDate: this.fromDate,
//       toDate: this.toDate
//     };
//     this.queryChange.emit(payload);
//     this.filterChange.emit(payload);
//     this.persistState();
//   }

//   applyFilter(): void {
//     // ⭐ FIX: Save the current page index before filtering runs
//     const historicalPage = this.currentPage; 

//     const globalSearch = this.searchText.toLowerCase().trim();
//     const stringify = (v: any): string => {
//       if (v?.toDate) return v.toDate().toISOString();
//       if (v instanceof Date) return v.toISOString();
//       if (Array.isArray(v)) return v.join(' ');
//       if (typeof v === 'object' && v !== null) {
//         return Object.values(v)
//           .filter(x => ['string','number','boolean'].includes(typeof x))
//           .join(' ');
//       }
//       return String(v ?? '');
//     };

//     this.filteredData = this.data.filter(row => {
//       const globalMatch = !globalSearch ? true :
//         Object.values(row).map(v => stringify(v).toLowerCase()).some(s => s.includes(globalSearch));

//       const columnMatch = Object.entries(this.columnFilters).every(([field, filterVal]) => {
//         const value = row[field];

//         if (!filterVal || filterVal === '' || (Array.isArray(filterVal) && filterVal.length === 0)) return true;

//         if (field === 'activeStatus') {
//           const boolVal = filterVal === 'Active';
//           return value === boolVal;
//         }

//         if (Array.isArray(filterVal)) {
//           return filterVal.some((tag: string) => (value || []).includes(tag));
//         }

//         return String(value ?? '').toLowerCase().includes(String(filterVal).toLowerCase());
//       });

//       const dateFilter = this.filters.find(f => f.type === 'dateRange');
//       if (dateFilter) {
//         const rowDate = row[dateFilter.field]?.toDate?.() || new Date(row[dateFilter.field]);
//         const from = this.fromDate ? new Date(this.fromDate) : null;
//         const to = this.toDate ? new Date(this.toDate) : null;

//         if (from && rowDate < from) return false;
//         if (to) {
//           const toEnd = new Date(to); toEnd.setHours(23,59,59,999);
//           if (rowDate > toEnd) return false;
//         }
//       }

//       return globalMatch && columnMatch;
//     });

//     this.sortData();
    
//     // --- CRITICAL FIX FOR PAGINATION RESET ---
//     const newTotalPages = this.totalPages;

//     // 1. If the historical page is valid in the new filtered set, keep it.
//     if (historicalPage < newTotalPages) {
//         this.currentPage = historicalPage;
//     } 
//     // 2. If the historical page is invalid, move to the last available page.
//     else if (newTotalPages > 0) {
//         this.currentPage = newTotalPages - 1;
//     } 
//     // 3. If there is no data, reset to 0.
//     else {
//         this.currentPage = 0;
//     }
    
//     this.persistState();
//   }

//   toggleSort(col: { field: string }): void {
//     if (this.sortField === col.field) {
//       this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
//     } else {
//       this.sortField = col.field;
//       this.sortDirection = 'asc';
//     }

//     if (this.serverMode) {
//       this.sortChange.emit({ active: this.sortField, direction: this.sortDirection });
//     } else {
//       this.sortData();
//     }
//     this.persistState();
//   }

//   sortData(): void {
//     if (!this.sortField) return;
//     const f = this.sortField;
//     const dir = this.sortDirection === 'asc' ? 1 : -1;

//     const normalize = (v: any) => {
//       if (v?.toDate) return v.toDate().getTime();
//       if (v instanceof Date) return v.getTime();
//       if (typeof v === 'number') return v;
//       const num = Number(v);
//       if (!isNaN(num) && v !== '' && v !== null && v !== undefined) return num;
//       return String(v ?? '').toLowerCase();
//     };

//     this.filteredData.sort((a, b) => {
//       const A = normalize(a[f]);
//       const B = normalize(b[f]);
//       if (A < B) return -1 * dir;
//       if (A > B) return  1 * dir;
//       return 0;
//     });
//   }

//   get paginatedData(): any[] {
//     const start = this.currentPage * this.pageSize;
//     return this.filteredData.slice(start, start + this.pageSize);
//   }

//   get totalPages(): number {
//     if (this.serverMode) {
//       return Math.max(1, Math.ceil(this.totalItems / this.pageSize));
//     }
//     return Math.max(1, Math.ceil(this.filteredData.length / this.pageSize));
//   }

//   onPageSizeChange(): void {
//     if (this.serverMode) {
//       this.pageChange.emit({ pageIndex: 0, pageSize: this.pageSize });
//     } else {
//       this.currentPage = 0;
//       this.applyFilter();
//     }
//     this.persistState();
//   }

//   prevPage(): void {
//     if (this.serverMode) {
//       if (this.pageIndex > 0) this.pageChange.emit({ pageIndex: this.pageIndex - 1, pageSize: this.pageSize });
//     } else if (this.currentPage > 0) {
//       this.currentPage--;
//       this.persistState();
//     }
//   }

//   nextPage(): void {
//     if (this.serverMode) {
//       if (this.pageIndex + 1 < this.totalPages) this.pageChange.emit({ pageIndex: this.pageIndex + 1, pageSize: this.pageSize });
//     } else if (this.currentPage + 1 < this.totalPages) {
//       this.currentPage++;
//       this.persistState();
//     }
//   }

//   toggleAll(): void {
//     const checked = this.allSelected;
//     this.selectedRows = [];
//     const source = this.serverMode ? this.data : this.paginatedData;

//     for (const row of source) {
//       row.selected = checked;
//       if (checked) this.selectedRows.push(row);
//     }
//     this.emitSelection();
//   }

//   updateSelected(row: any): void {
//     if (row.selected) {
//       this.selectedRows.push(row);
//     } else {
//       this.selectedRows = this.selectedRows.filter(r => r !== row);
//     }
//     const source = this.serverMode ? this.data : this.paginatedData;
//     this.allSelected = source.every(r => r.selected);
//     this.emitSelection();
//   }

//   isSelected(row: any): boolean {
//     return !!row.selected;
//   }

//   deleteSelected(): void {
//     this.bulkDelete.emit(this.selectedRows);
//     this.selectedRows = [];
//     this.allSelected = false;
//     this.emitSelection();
//   }

//   onRowClick(row: any): void {
//     if (this.rowRouteBase && this.rowIdField && row[this.rowIdField]) {
//       const path = this.rowRouteBase.startsWith('/') 
//         ? `${this.rowRouteBase}/${row[this.rowIdField]}` 
//         : `/${this.rowRouteBase}/${row[this.rowIdField]}`;
//       this.router.navigateByUrl(path);
//     } else {
//       this.rowClick.emit(row);
//     }
//   }

//   toggleColumn(field: string): void {
//     const index = this.visibleColumns.indexOf(field);
//     if (index > -1) {
//       this.visibleColumns.splice(index, 1);
//     } else {
//       this.visibleColumns.push(field);
//     }
//     this.persistState();
//   }

//   isFirstVisible(field: string): boolean {
//     const first = this.visibleColumns[0];
//     return first === field;
//   }

//   get allColumnKeys(): string[] {
//     return this.allColumns.map(c => c.field);
//   }

//   generateBadgeColor(value: string): string {
//     const palette = [
//       '#e0f7fa', '#fce4ec', '#e8f5e9', '#fff3e0', '#ede7f6',
//       '#f3e5f5', '#f9fbe7', '#e1f5fe', '#ffe0b2', '#c8e6c9'
//     ];
//     if (!value) return '#f0f0f0';
//     let hash = 0;
//     for (let i = 0; i < value.length; i++) {
//       hash = value.charCodeAt(i) + ((hash << 5) - hash);
//     }
//     const index = Math.abs(hash) % palette.length;
//     return palette[index];
//   }

//   onImageError(event: Event) {
//     const img = event.target as HTMLImageElement;
//     img.src = 'logo.png';
//   }

//   getTooltipValue(value: any): string {
//     if (Array.isArray(value)) return value.join(', ');
//     if (typeof value === 'object' && value !== null) return JSON.stringify(value);
//     return String(value ?? '');
//   }

//   private persistState(): void {
//     // Emit the entire current state object for the parent to save to Firestore
//     this.stateChange.emit({
//       visibleColumns: this.visibleColumns,
//       searchText: this.searchText,
//       columnFilters: this.columnFilters,
//       fromDate: this.fromDate,
//       toDate: this.toDate,
//       pageSize: this.pageSize,
//       currentPage: this.currentPage,
//       sortField: this.sortField,
//       sortDirection: this.sortDirection
//     });
//   }

//   onTagToggle(field: string, value: string, checked: boolean): void {
//     const list: string[] = this.columnFilters[field] || [];
//     this.columnFilters[field] = checked
//       ? Array.from(new Set([...list, value]))
//       : list.filter(v => v !== value);
//     this.onQueryChange();
//   }

//   getCheckedValue(event: Event): boolean {
//     return (event.target as HTMLInputElement)?.checked ?? false;
//   }

//   isArray(value: any): boolean {
//     return Array.isArray(value);
//   }

//   hasInventoryColumn(): boolean {
//     return this.columns.some(c => c.field === 'totalInventory' || c.field.toLowerCase().includes('inventory'));
//   }

//   bulkActivate(): void {
//     if (this.selectedRows.length) {
//       this.bulkSetActive.emit({ rows: this.selectedRows, active: true });
//     }
//   }

//   bulkDeactivate(): void {
//     if (this.selectedRows.length) {
//       this.bulkSetActive.emit({ rows: this.selectedRows, active: false });
//     }
//   }

//   private emitSelection(): void {
//     this.selectionChange.emit(this.selectedRows);
//   }
// }




import {
  Component, Input, OnInit, Output, EventEmitter, OnChanges, SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-dynamic-table',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './dynamic-table.component.html',
  styleUrls: ['./dynamic-table.component.css']
})
export class DynamicTableComponent implements OnInit, OnChanges {
  @Input() data: any[] = [];
  @Input() columns: { field: string; label: string; sortable?: boolean; searchable?: boolean }[] = [];
  @Input() filters: { field: string; label: string; type: 'text' | 'select' | 'dateRange' | 'multiselect'; options?: string[] }[] = [];
  @Input() pageSize: number = 10;
  @Input() hasActions: boolean = false;
  @Input() buttonLabel: string = '';
  @Input() buttonRoute: string = '';
  @Input() rowRouteBase: string = '';
  @Input() rowIdField: string = 'id';
  @Input() initialState: any | null = null; 

  @Input() serverMode: boolean = false;
  @Input() totalItems: number = 0;
  @Input() pageIndex: number = 0;

  @Input() enableBulkStatusToggle: boolean = false;
  @Input() actionViewUrlBuilder?: (row: any) => string;
  @Input() showPagination: boolean = true; 

  @Output() rowClick = new EventEmitter<any>();
  @Output() bulkDelete = new EventEmitter<any[]>();
  @Output() filterChange = new EventEmitter<any>();
  @Output() pageChange = new EventEmitter<{ pageIndex: number; pageSize: number }>();
  @Output() sortChange = new EventEmitter<{ active: string; direction: 'asc'|'desc' }>();
  @Output() queryChange = new EventEmitter<{ searchText: string; columnFilters: any; fromDate: string; toDate: string }>();
  @Output() bulkSetActive = new EventEmitter<{ rows: any[]; active: boolean }>();
  @Output() selectionChange = new EventEmitter<any[]>();
  @Output() stateChange = new EventEmitter<any>(); 

  searchText: string = '';
  columnFilters: { [key: string]: any } = {};
  fromDate: string = '';
  toDate: string = '';

  currentPage: number = 0;
  sortField: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';
  loading: boolean = false;
  filteredData: any[] = [];
  selectedRows: any[] = [];
  allSelected = false;

  visibleColumns: string[] = [];
  defaultVisible: string[] = [];
  allColumns: { field: string; label: string }[] = [];

  private isInitialized = false; 
  private hasDataLoaded = false; 

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.initializeFilters();
    const initialVisible = this.columns.map(c => c.field).slice(0, 6);
    this.visibleColumns = [...initialVisible];
    this.defaultVisible = [...initialVisible];
    this.allColumns = [...this.columns];
    if (this.initialState) {
        this.restoreState(this.initialState);
    }
    if (this.serverMode) this.emitQuery();
    this.isInitialized = true; 
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialState'] && changes['initialState'].currentValue !== undefined) {
        const currentState = changes['initialState'].currentValue;
        if (currentState && !changes['initialState'].firstChange) {
            this.restoreState(currentState);
            this.tryInitialFilter();
        }
    }
    if (changes['data'] && this.isInitialized) {
        if (!this.serverMode) {
            this.hasDataLoaded = (changes['data'].currentValue?.length > 0);
            this.tryInitialFilter();
        }
    }
  }
  
  private tryInitialFilter(): void {
      if (this.isInitialized && (this.serverMode || this.hasDataLoaded)) {
          if (this.serverMode) this.emitQuery();
          else this.applyFilter();
      }
  }

  private restoreState(s: any): void {
    const initialVisible = this.columns.map(c => c.field).slice(0, 6);
    const restoredVisible = s.visibleColumns;
    if (Array.isArray(restoredVisible) && restoredVisible.length > 0) {
        this.visibleColumns = restoredVisible;
    } else {
        this.visibleColumns = initialVisible;
    }
    this.currentPage    = s.currentPage    ?? 0; 
    this.searchText     = s.searchText     ?? '';
    this.pageSize       = s.pageSize       ?? this.pageSize;
    this.sortField      = s.sortField      ?? '';
    this.sortDirection  = s.sortDirection  ?? 'asc';
    this.fromDate       = s.fromDate       ?? '';
    this.toDate         = s.toDate         ?? '';
    this.initializeFilters(); 
    if (s.columnFilters) {
        this.columnFilters = { ...s.columnFilters }; 
    }
  }

  initializeFilters() {
    this.filters.forEach(f => {
      this.columnFilters[f.field] = f.type === 'multiselect' ? [] : '';
    });
  }

  exportCSV(): void {
    const rows = (this.serverMode ? this.data : this.filteredData);
    if (!rows || rows.length === 0) return;
    const orderedCols = this.columns.filter(c => this.visibleColumns.includes(c.field));
    const headers = orderedCols.map(c => c.label);
    const escapeCSV = (val: any) => {
      const s = this.getCSVString(val);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [
      headers.join(','),
      ...rows.map(r => orderedCols.map(c => escapeCSV(r[c.field])).join(','))
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `export_${new Date().toISOString().slice(0,19)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private getCSVString(val: any): string {
    if (val?.toDate) return val.toDate().toISOString();
    if (val instanceof Date) return val.toISOString();
    if (Array.isArray(val)) return val.join('; ');
    if (typeof val === 'object' && val !== null) {
      return Object.values(val).filter(x => ['string','number','boolean'].includes(typeof x)).join(' ');
    }
    return String(val ?? '');
  }

  onQueryChange(): void {
    if (this.serverMode) this.emitQuery();
    else this.applyFilter();
  }

  applyDateFilter(): void {
    this.onQueryChange();
  }

  resetFilters(): void {
    this.searchText = '';
    this.fromDate = '';
    this.toDate = '';
    Object.entries(this.columnFilters).forEach(([key, val]) => {
      this.columnFilters[key] = Array.isArray(val) ? [] : '';
    });
    this.onQueryChange();
  }

  private emitQuery(): void {
    const payload = {
      searchText: this.searchText,
      columnFilters: this.columnFilters,
      fromDate: this.fromDate,
      toDate: this.toDate
    };
    this.queryChange.emit(payload);
    this.filterChange.emit(payload);
    this.persistState();
  }

  applyFilter(): void {
    const historicalPage = this.currentPage; 
    const globalSearch = this.searchText.toLowerCase().trim();
    const stringify = (v: any): string => {
      if (v?.toDate) return v.toDate().toISOString();
      if (v instanceof Date) return v.toISOString();
      if (Array.isArray(v)) return v.join(' ');
      if (typeof v === 'object' && v !== null) {
        return Object.values(v).filter(x => ['string','number','boolean'].includes(typeof x)).join(' ');
      }
      return String(v ?? '');
    };

    this.filteredData = this.data.filter(row => {
      const globalMatch = !globalSearch ? true :
        Object.values(row).map(v => stringify(v).toLowerCase()).some(s => s.includes(globalSearch));
      const columnMatch = Object.entries(this.columnFilters).every(([field, filterVal]) => {
        const value = row[field];
        if (!filterVal || filterVal === '' || (Array.isArray(filterVal) && filterVal.length === 0)) return true;
        if (field === 'activeStatus') return value === (filterVal === 'Active');
        if (Array.isArray(filterVal)) return filterVal.some((tag: string) => (value || []).includes(tag));
        return String(value ?? '').toLowerCase().includes(String(filterVal).toLowerCase());
      });
      const dateFilter = this.filters.find(f => f.type === 'dateRange');
      if (dateFilter) {
        const rowDate = row[dateFilter.field]?.toDate?.() || new Date(row[dateFilter.field]);
        const from = this.fromDate ? new Date(this.fromDate) : null;
        const to = this.toDate ? new Date(this.toDate) : null;
        if (from && rowDate < from) return false;
        if (to) {
          const toEnd = new Date(to); toEnd.setHours(23,59,59,999);
          if (rowDate > toEnd) return false;
        }
      }
      return globalMatch && columnMatch;
    });

    this.sortData();
    const newTotalPages = this.totalPages;
    if (historicalPage < newTotalPages) this.currentPage = historicalPage;
    else if (newTotalPages > 0) this.currentPage = newTotalPages - 1;
    else this.currentPage = 0;
    this.persistState();
  }

  toggleSort(col: { field: string }): void {
    if (this.sortField === col.field) this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    else { this.sortField = col.field; this.sortDirection = 'asc'; }
    if (this.serverMode) this.sortChange.emit({ active: this.sortField, direction: this.sortDirection });
    else this.sortData();
    this.persistState();
  }

  sortData(): void {
    if (!this.sortField) return;
    const f = this.sortField;
    const dir = this.sortDirection === 'asc' ? 1 : -1;
    const normalize = (v: any) => {
      if (v?.toDate) return v.toDate().getTime();
      if (v instanceof Date) return v.getTime();
      if (typeof v === 'number') return v;
      const num = Number(v);
      if (!isNaN(num) && v !== '' && v !== null && v !== undefined) return num;
      return String(v ?? '').toLowerCase();
    };
    this.filteredData.sort((a, b) => {
      const A = normalize(a[f]); 
      const B = normalize(b[f]); 
      if (A < B) return -1 * dir;
      if (A > B) return  1 * dir;
      return 0;
    });
  }

  get paginatedData(): any[] {
    const start = this.currentPage * this.pageSize;
    return this.filteredData.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    if (this.serverMode) return Math.max(1, Math.ceil(this.totalItems / this.pageSize));
    return Math.max(1, Math.ceil(this.filteredData.length / this.pageSize));
  }

  onPageSizeChange(): void {
    if (this.serverMode) this.pageChange.emit({ pageIndex: 0, pageSize: this.pageSize });
    else { this.currentPage = 0; this.applyFilter(); }
    this.persistState();
  }

  prevPage(): void {
    if (this.serverMode && this.pageIndex > 0) this.pageChange.emit({ pageIndex: this.pageIndex - 1, pageSize: this.pageSize });
    else if (this.currentPage > 0) { this.currentPage--; this.persistState(); }
  }

  nextPage(): void {
    if (this.serverMode && (this.pageIndex + 1 < this.totalPages)) this.pageChange.emit({ pageIndex: this.pageIndex + 1, pageSize: this.pageSize });
    else if (this.currentPage + 1 < this.totalPages) { this.currentPage++; this.persistState(); }
  }

  toggleAll(): void {
    const checked = this.allSelected;
    this.selectedRows = [];
    const source = this.serverMode ? this.data : this.paginatedData;
    for (const row of source) {
      row.selected = checked;
      if (checked) this.selectedRows.push(row);
    }
    this.emitSelection();
  }

  updateSelected(row: any): void {
    if (row.selected) this.selectedRows.push(row);
    else this.selectedRows = this.selectedRows.filter(r => r !== row);
    const source = this.serverMode ? this.data : this.paginatedData;
    this.allSelected = source.every(r => r.selected);
    this.emitSelection();
  }

  isSelected(row: any): boolean { return !!row.selected; }

  deleteSelected(): void {
    this.bulkDelete.emit(this.selectedRows);
    this.selectedRows = []; this.allSelected = false; this.emitSelection();
  }

  // ⭐ FIXED: New explicit button click method for navigation
  onButtonClick(): void {
    if (this.buttonRoute) {
      this.router.navigateByUrl(this.buttonRoute);
    }
  }

  onRowClick(row: any): void {
    if (this.rowRouteBase && this.rowIdField && row[this.rowIdField]) {
      const path = this.rowRouteBase.startsWith('/') ? `${this.rowRouteBase}/${row[this.rowIdField]}` : `/${this.rowRouteBase}/${row[this.rowIdField]}`;
      this.router.navigateByUrl(path);
    } else { this.rowClick.emit(row); }
  }

  toggleColumn(field: string): void {
    const index = this.visibleColumns.indexOf(field);
    if (index > -1) this.visibleColumns.splice(index, 1);
    else this.visibleColumns.push(field);
    this.persistState();
  }

  isFirstVisible(field: string): boolean { return this.visibleColumns[0] === field; }

  get allColumnKeys(): string[] { return this.allColumns.map(c => c.field); }

  generateBadgeColor(value: string): string {
    const palette = ['#e0f7fa', '#fce4ec', '#e8f5e9', '#fff3e0', '#ede7f6', '#f3e5f5', '#f9fbe7', '#e1f5fe', '#ffe0b2', '#c8e6c9'];
    if (!value) return '#f0f0f0';
    let hash = 0;
    for (let i = 0; i < value.length; i++) hash = value.charCodeAt(i) + ((hash << 5) - hash);
    return palette[Math.abs(hash) % palette.length];
  }

  onImageError(event: Event) { (event.target as HTMLImageElement).src = 'logo.png'; }

  getTooltipValue(value: any): string {
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'object' && value !== null) return JSON.stringify(value);
    return String(value ?? '');
  }

  private persistState(): void {
    this.stateChange.emit({
      visibleColumns: this.visibleColumns, searchText: this.searchText, columnFilters: this.columnFilters,
      fromDate: this.fromDate, toDate: this.toDate, pageSize: this.pageSize,
      currentPage: this.currentPage, sortField: this.sortField, sortDirection: this.sortDirection
    });
  }

  onTagToggle(field: string, value: string, checked: boolean): void {
    const list: string[] = this.columnFilters[field] || [];
    this.columnFilters[field] = checked ? Array.from(new Set([...list, value])) : list.filter(v => v !== value);
    this.onQueryChange();
  }

  getCheckedValue(event: Event): boolean { return (event.target as HTMLInputElement)?.checked ?? false; }

  isArray(value: any): boolean { return Array.isArray(value); }

  hasInventoryColumn(): boolean { return this.columns.some(c => c.field === 'totalInventory' || c.field.toLowerCase().includes('inventory')); }

  bulkActivate(): void { if (this.selectedRows.length) this.bulkSetActive.emit({ rows: this.selectedRows, active: true }); }

  bulkDeactivate(): void { if (this.selectedRows.length) this.bulkSetActive.emit({ rows: this.selectedRows, active: false }); }

  private emitSelection(): void { this.selectionChange.emit(this.selectedRows); }
}