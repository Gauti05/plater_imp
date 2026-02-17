import { Component, OnInit, inject, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Firestore, collection, collectionData, doc, updateDoc } from '@angular/fire/firestore';

export interface StoreDoc {
  id: string;
  name: string;
  slug: string;
  outletCode?: string;
  isActive: boolean;
  dineInEnabled: boolean;
  takeawayEnabled: boolean;
  orderingEnabled: boolean;
  address?: string;
  phone?: string;
  email?: string;
}

@Component({
  selector: 'app-store-selector',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './store-selector.component.html',
  styleUrls: ['./store-selector.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class StoreSelectorComponent implements OnInit {
  private firestore = inject(Firestore);
  private router = inject(Router);

  stores: StoreDoc[] = [];
  loading = true;

  ngOnInit() {
    this.loadStores();
  }

  loadStores() {
    this.loading = true;
    const storesRef = collection(this.firestore, 'Stores');
    
    collectionData(storesRef, { idField: 'id' }).subscribe({
      next: (data: any[]) => {
        this.stores = data.map(s => ({
          ...s,
          isActive: s.isActive ?? true,
          dineInEnabled: s.dineInEnabled ?? true,
          takeawayEnabled: s.takeawayEnabled ?? true,
          orderingEnabled: s.orderingEnabled ?? true
        })) as StoreDoc[];
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load stores:', err);
        this.loading = false;
      }
    });
  }

  async toggleSetting(store: StoreDoc, field: keyof StoreDoc) {
    try {
      const docRef = doc(this.firestore, `Stores/${store.id}`);
      const newValue = !store[field];

      if (field === 'isActive' && newValue === false) {
        await updateDoc(docRef, {
          isActive: false,
          dineInEnabled: false,
          takeawayEnabled: false,
          orderingEnabled: false
        });
      } 
      else {
        // Cast as any to avoid strict indexing errors
        await updateDoc(docRef, { [field as string]: newValue });
      }
    } catch (e) {
      console.error('Update failed:', e);
    }
  }

  enterStore(store: StoreDoc) {
    if (!store.slug) return;
    this.router.navigate(['/', store.slug, 'dashboard']);
  }
}