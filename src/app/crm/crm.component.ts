import { Component, OnInit } from '@angular/core';
import { 
  collection, 
  getDocs, 
  getFirestore 
} from '@angular/fire/firestore'; 
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DynamicTableComponent } from '../store/dynamic-table/dynamic-table.component';
import { AuthService } from '../core/auth.service';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-crm',
  standalone: true,
  imports: [FormsModule, CommonModule, DynamicTableComponent, RouterModule],
  templateUrl: './crm.component.html',
  styleUrl: './crm.component.css'
})
export class CrmComponent implements OnInit {
  storeId!: string;
  customers: any[] = [];
  filteredCustomers: any[] = []; 
  loading = true;
  
  activeSegment: string = 'All'; 
  customerFilters: any[] = [];

  tableColumns = [
    { field: 'name', label: 'Customer Name' },
    { field: 'mobile', label: 'Mobile Number' },
    { field: 'segmentDisplay', label: 'Segments' }, 
    { field: 'loyaltyPoints', label: 'Current Points' }, 
    { field: 'lifetimeSpend', label: 'Lifetime Spend (₹)' },
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
    this.loadCustomers();
  }

  async loadCustomers() {
    this.loading = true;
    try {
      const db = getFirestore();
      const customerCollectionRef = collection(db, 'Stores', this.storeId, 'customers');
      
      const snap = await getDocs(customerCollectionRef);
      
      const now = new Date();
      const thirtyDaysAgo = new Date().setDate(now.getDate() - 30);

      this.customers = snap.docs.map(doc => {
        const data: any = doc.data();
        const visitCount = data.visitCount || 0;
        const spend = data.lifetimeSpend || 0;
        const lastVisit = data.lastVisited?.toDate ? data.lastVisited.toDate() : data.lastVisited;
        const isRecent = lastVisit && new Date(lastVisit).getTime() >= thirtyDaysAgo;
        
        let tags: string[] = [];
        
        // 1. VIP Logic (Can overlap with Frequent)
        if (spend > 10000 || visitCount > 20) {
          tags.push('VIP');
        } 
        
        // 2. Frequent Logic
        if (visitCount >= 5) {
          tags.push('Frequent');
        }

        // 3. New vs Dormant Logic (Mutually Exclusive)
        if (!isRecent) {
          tags.push('Dormant'); // If they haven't been here in 30 days, they are Dormant
        } else if (visitCount <= 1) {
          tags.push('New'); // If they are recent AND only have 1 visit, they are New
        }

        return {
          ...data,
          id: doc.id,
          loyaltyPoints: data.loyaltyPoints || 0,
          lifetimeSpend: spend,
          visitCount: visitCount,
          segmentTags: tags,
          segmentDisplay: tags.join(', '),
          lastVisited: lastVisit
        };
      });

      this.filteredCustomers = [...this.customers]; 
      this.generateFilterOptions();
    } catch (err) {
      console.error('Failed to load customers:', err);
    } finally {
      this.loading = false;
    }
  }

  filterBySegment(segment: string) {
    this.activeSegment = segment;
    if (segment === 'All') {
      this.filteredCustomers = [...this.customers];
    } else {
      this.filteredCustomers = this.customers.filter(c => c.segmentTags.includes(segment));
    }
  }

  getSegmentCount(segment: string): number {
    if (segment === 'All') return this.customers.length;
    return this.customers.filter(c => c.segmentTags.includes(segment)).length;
  }

  generateFilterOptions() {
    this.customerFilters = [
      { field: 'name', label: 'Search Name', type: 'text' },
      { field: 'mobile', label: 'Search Mobile', type: 'text' },
      { field: 'segmentDisplay', label: 'Filter by Segment', type: 'text' }
    ];
  }
}