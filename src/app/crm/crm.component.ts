import { Component, OnInit } from '@angular/core';
import { 
  collection, 
  getDocs, 
  getFirestore, 
  query, 
  where 
} from '@angular/fire/firestore'; 
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DynamicTableComponent } from '../store/dynamic-table/dynamic-table.component';
import { AuthService } from '../core/auth.service';
import { ActivatedRoute, Router } from '@angular/router';



@Component({
  selector: 'app-crm',
  standalone: true,
  imports: [FormsModule, CommonModule, DynamicTableComponent],
  templateUrl: './crm.component.html',
  styleUrl: './crm.component.css'
})
export class CrmComponent implements OnInit {
  storeId!: string;
  customers: any[] = [];
  loading = true;
  
  // These will likely stay null unless you have a separate 'users' 
  // collection to link the 'mobile' or 'id' to a staff member
  userRole: string | null = null; 
  currentUserId: string | null = null; 

  customerFilters: any[] = [];

  // 1. Updated Table Columns to match ONLY your 4 database fields
  tableColumns = [
    { field: 'name', label: 'Customer Name' },
    { field: 'mobile', label: 'Mobile Number' },
    { field: 'id', label: 'ID' },
    { field: 'lastVisited', label: 'Last Visited', type: 'date' }
  ];

  constructor(
    private router: Router, 
    private route: ActivatedRoute,
    private authSvc: AuthService 
  ) {}

  async ngOnInit(): Promise<void> {
    this.storeId = this.route.parent?.snapshot.paramMap.get('storeSlug') ?? '';
    
    if (!this.storeId) {
      console.error('No storeSlug found in route');
      return;
    }

    // Load data
    this.loadCustomers();
  }

  async loadCustomers() {
    this.loading = true;
    try {
      const db = getFirestore();
      const customerCollectionRef = collection(db, 'Stores', this.storeId, 'customers');
      
      // Since your data doesn't have 'assignedToUserId', 
      // we fetch all documents for this store.
      const snap = await getDocs(customerCollectionRef);
      
      this.customers = snap.docs.map(doc => {
        const data: any = doc.data();
        return {
          ...data,
          docId: doc.id, // The Firestore document auto-ID
          // 2. Map the timestamp correctly for the template
          lastVisited: data.lastVisited?.toDate ? data.lastVisited.toDate() : data.lastVisited
        };
      });

      this.generateFilterOptions();
    } catch (err) {
      console.error('Failed to load customers:', err);
    } finally {
      this.loading = false;
    }
  }

  // 3. Simplified Filters based on your actual fields
  generateFilterOptions() {
    const getUnique = (field: string) =>
      [...new Set(this.customers.map(c => c[field]).filter(Boolean))];

    this.customerFilters = [
      {
        field: 'name',
        label: 'Search Name',
        type: 'text'
      },
      {
        field: 'mobile',
        label: 'Search Mobile',
        type: 'text'
      },
      {
        field: 'lastVisited',
        label: 'Visit Date',
        type: 'dateRange'
      }
    ];
  }
}