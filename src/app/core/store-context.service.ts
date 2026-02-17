// src/app/core/store-context.service.ts
import { Injectable, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Firestore, collection, query, where, getDocs } from '@angular/fire/firestore';

@Injectable({ providedIn: 'root' })
export class StoreContextService {
  private firestore = inject(Firestore);
  private router = inject(Router);

  public currentStoreId: string | null = null;
  public currentSlug: string | null = null;

  async initFromSlug(slug: string) {
    const storesRef = collection(this.firestore, 'Stores');
    const q = query(storesRef, where('slug', '==', slug));
    const snap = await getDocs(q);
    if (snap.empty) {
      this.router.navigate(['/login']);
      return;
    }
    const doc = snap.docs[0];
    this.currentStoreId = doc.id;
    this.currentSlug = slug;
  }
}
