// // import { Component, OnInit, inject, ViewEncapsulation } from '@angular/core';
// // import { CommonModule } from '@angular/common';
// // import { Router } from '@angular/router';
// // import { Firestore, collection, collectionData, doc, updateDoc } from '@angular/fire/firestore';

// // export interface StoreDoc {
// //   id: string;
// //   name: string;
// //   slug: string;
// //   outletCode?: string;
// //   isActive: boolean;
// //   dineInEnabled: boolean;
// //   takeawayEnabled: boolean;
// //   orderingEnabled: boolean;
// //   address?: string;
// //   phone?: string;
// //   email?: string;
// // }

// // @Component({
// //   selector: 'app-store-selector',
// //   standalone: true,
// //   imports: [CommonModule],
// //   templateUrl: './store-selector.component.html',
// //   styleUrls: ['./store-selector.component.css'],
// //   encapsulation: ViewEncapsulation.None
// // })
// // export class StoreSelectorComponent implements OnInit {
// //   private firestore = inject(Firestore);
// //   private router = inject(Router);

// //   stores: StoreDoc[] = [];
// //   loading = true;

// //   ngOnInit() {
// //     this.loadStores();
// //   }

// //   loadStores() {
// //     this.loading = true;
// //     const storesRef = collection(this.firestore, 'Stores');
    
// //     collectionData(storesRef, { idField: 'id' }).subscribe({
// //       next: (data: any[]) => {
// //         this.stores = data.map(s => ({
// //           ...s,
// //           isActive: s.isActive ?? true,
// //           dineInEnabled: s.dineInEnabled ?? true,
// //           takeawayEnabled: s.takeawayEnabled ?? true,
// //           orderingEnabled: s.orderingEnabled ?? true
// //         })) as StoreDoc[];
// //         this.loading = false;
// //       },
// //       error: (err) => {
// //         console.error('Failed to load stores:', err);
// //         this.loading = false;
// //       }
// //     });
// //   }

// //   async toggleSetting(store: StoreDoc, field: keyof StoreDoc) {
// //     try {
// //       const docRef = doc(this.firestore, `Stores/${store.id}`);
// //       const newValue = !store[field];

// //       if (field === 'isActive' && newValue === false) {
// //         await updateDoc(docRef, {
// //           isActive: false,
// //           dineInEnabled: false,
// //           takeawayEnabled: false,
// //           orderingEnabled: false
// //         });
// //       } 
// //       else {
// //         // Cast as any to avoid strict indexing errors
// //         await updateDoc(docRef, { [field as string]: newValue });
// //       }
// //     } catch (e) {
// //       console.error('Update failed:', e);
// //     }
// //   }

// //   enterStore(store: StoreDoc) {
// //     if (!store.slug) return;
// //     this.router.navigate(['/', store.slug, 'dashboard']);
// //   }
// // }





// import { Component, OnInit, inject, ViewEncapsulation } from '@angular/core';
// import { CommonModule } from '@angular/common';
// import { Router } from '@angular/router';
// import { 
//   Firestore, 
//   collection, 
//   collectionData, 
//   doc, 
//   updateDoc, 
//   query, 
//   where, 
//   getDoc,
//   documentId // Import this to query by document ID
// } from '@angular/fire/firestore';
// import { AuthService } from '../core/auth.service'; // Adjust path if needed based on your folder structure

// export interface StoreDoc {
//   id: string;
//   name: string;
//   slug: string;
//   outletCode?: string;
//   isActive: boolean;
//   dineInEnabled: boolean;
//   takeawayEnabled: boolean;
//   orderingEnabled: boolean;
//   address?: string;
//   phone?: string;
//   email?: string;
// }

// @Component({
//   selector: 'app-store-selector',
//   standalone: true,
//   imports: [CommonModule],
//   templateUrl: './store-selector.component.html',
//   styleUrls: ['./store-selector.component.css'],
//   encapsulation: ViewEncapsulation.None
// })
// export class StoreSelectorComponent implements OnInit {
//   private firestore = inject(Firestore);
//   private router = inject(Router);
//   private auth = inject(AuthService); // Inject Auth Service

//   stores: StoreDoc[] = [];
//   loading = true;

//   ngOnInit() {
//     this.loadStores();
//   }

//   async loadStores() {
//     this.loading = true;
    
//     // 1. Get the currently logged-in user
//     const user = this.auth.user();
//     if (!user) {
//       // Safety check: if no user is logged in, redirect to login
//       this.router.navigate(['/login']);
//       return;
//     }

//     try {
//       // 2. Fetch the User's Profile to get their Role and StoreID
//       const userDocRef = doc(this.firestore, `Users/${user.uid}`);
//       const userSnap = await getDoc(userDocRef);
      
//       if (!userSnap.exists()) {
//         console.error('User profile not found');
//         this.loading = false;
//         return;
//       }

//       const userData = userSnap.data();
//       const userRole = userData['userRole']; // 'Superadmin' or 'Storeadmin'
//       const assignedStoreId = userData['storeId']; // The specific store ID for this admin

//       // 3. Construct the Query based on Role
//       const storesRef = collection(this.firestore, 'Stores');
//       let finalQuery;

//       if (userRole === 'Superadmin') {
//         // Superadmin sees ALL stores
//         finalQuery = storesRef; 
//       } else if (userRole === 'Storeadmin' && assignedStoreId) {
//         // Storeadmin sees ONLY their assigned store
//         // We use 'documentId()' to filter by the document's key (the store ID)
//         finalQuery = query(storesRef, where(documentId(), '==', assignedStoreId));
//       } else {
//         // Fallback: If role is unknown or storeId is missing, show nothing
//         this.stores = [];
//         this.loading = false;
//         return;
//       }

//       // 4. Subscribe to the query data
//       collectionData(finalQuery, { idField: 'id' }).subscribe({
//         next: (data: any[]) => {
//           this.stores = data.map(s => ({
//             ...s,
//             isActive: s.isActive ?? true,
//             dineInEnabled: s.dineInEnabled ?? true,
//             takeawayEnabled: s.takeawayEnabled ?? true,
//             orderingEnabled: s.orderingEnabled ?? true
//           })) as StoreDoc[];
//           this.loading = false;
//         },
//         error: (err) => {
//           console.error('Failed to load stores:', err);
//           this.loading = false;
//         }
//       });

//     } catch (error) {
//       console.error('Error fetching user profile:', error);
//       this.loading = false;
//     }
//   }

//   async toggleSetting(store: StoreDoc, field: keyof StoreDoc) {
//     try {
//       const docRef = doc(this.firestore, `Stores/${store.id}`);
//       const newValue = !store[field];

//       if (field === 'isActive' && newValue === false) {
//         await updateDoc(docRef, {
//           isActive: false,
//           dineInEnabled: false,
//           takeawayEnabled: false,
//           orderingEnabled: false
//         });
//       } 
//       else {
//         // Cast as any to avoid strict indexing errors
//         await updateDoc(docRef, { [field as string]: newValue });
//       }
//     } catch (e) {
//       console.error('Update failed:', e);
//     }
//   }

//   enterStore(store: StoreDoc) {
//     if (!store.slug) return;
//     this.router.navigate(['/', store.slug, 'dashboard']);
//   }
// }



import { Component, OnInit, inject, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { 
  Firestore, 
  collection, 
  collectionData, 
  doc, 
  updateDoc, 
  query, 
  where, 
  getDoc, 
  getDocs,
  setDoc,
  documentId,
  writeBatch,
  deleteDoc
} from '@angular/fire/firestore';
import { Auth, authState } from '@angular/fire/auth';

export interface StoreDoc {
  id: string; 
  name: string; 
  slug: string; 
  outletCode?: string;
  isActive: boolean; 
  dineInEnabled: boolean; 
  takeawayEnabled: boolean;
  orderingEnabled: boolean; 
  ownerId?: string;
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
  private fireAuth = inject(Auth);

  stores: StoreDoc[] = [];
  loading = true;
  currentUserId = '';
  
  // ⭐ SAAS FIX: We start this empty. It will be dynamically set to the user's master branch.
  primaryStoreId = ''; 

  ngOnInit() {
    authState(this.fireAuth).subscribe(user => {
      if (user) {
        this.currentUserId = user.uid;
        this.loadStores(user.uid);
      } else {
        this.router.navigate(['/login']);
      }
    });
  }

  async loadStores(uid: string) {
    this.loading = true;
    try {
      const userDocSnap = await getDoc(doc(this.firestore, `Users/${uid}`));
      if (!userDocSnap.exists()) {
        this.loading = false;
        return;
      }

      const userData = userDocSnap.data();
      const role = userData['userRole'];
      const assignedStoreId = userData['storeId']; 

      // ⭐ SAAS FIX: Dynamically assign the primary store ID based on the restaurant owner's profile
      this.primaryStoreId = assignedStoreId;

      const storesRef = collection(this.firestore, 'Stores');

      if (role === 'Superadmin') {
        collectionData(query(storesRef), { idField: 'id' }).subscribe(data => {
          this.processStoreData(data);
        });
      } else {
        const qAssigned = getDocs(query(storesRef, where(documentId(), '==', assignedStoreId)));
        const qOwned = getDocs(query(storesRef, where('ownerId', '==', uid)));

        const [snapAssigned, snapOwned] = await Promise.all([qAssigned, qOwned]);
        
        const allDocs = [...snapAssigned.docs, ...snapOwned.docs];
        const uniqueData = Array.from(new Set(allDocs.map(d => d.id)))
          .map(id => {
            const d = allDocs.find(doc => doc.id === id);
            return { id, ...d?.data() };
          });

        this.processStoreData(uniqueData);
      }
    } catch (e) {
      console.error('Load failed:', e);
      this.loading = false;
    }
  }

  private processStoreData(data: any[]) {
    this.stores = data.map(s => ({
      ...s,
      isActive: s['isActive'] ?? true,
      dineInEnabled: s['dineInEnabled'] ?? true,
      takeawayEnabled: s['takeawayEnabled'] ?? true,
      orderingEnabled: s['orderingEnabled'] ?? true
    })) as StoreDoc[];
    this.loading = false;
  }

  async addNewStore() {
    const storeName = prompt('Enter New Outlet Name:');
    if (!storeName || !storeName.trim()) return;

    const slug = storeName.toLowerCase().trim().replace(/\s+/g, '-');
    
    const newStoreData = {
      name: storeName.trim(),
      slug: slug,
      isActive: true,
      dineInEnabled: true,
      takeawayEnabled: true,
      orderingEnabled: true,
      outletCode: 'OC-' + Math.floor(1000 + Math.random() * 9000),
      ownerId: this.currentUserId 
    };

    try {
      this.loading = true;
      
      if (!this.primaryStoreId) {
        throw new Error('No master store assigned to this user. Cannot clone menu.');
      }

      const sourceSnap = await getDoc(doc(this.firestore, `Stores/${this.primaryStoreId}`));
      if (!sourceSnap.exists()) {
        throw new Error(`Master store not found in database.`);
      }

      await setDoc(doc(this.firestore, `Stores/${slug}`), newStoreData);
      await this.cloneStoreData(this.primaryStoreId, slug);
      
      alert(`Outlet "${storeName}" created! Menu synced with your main branch.`);
      await this.loadStores(this.currentUserId);
    } catch (e: any) {
      console.error('Creation failed:', e);
      alert(e.message || 'Error creating outlet.');
    } finally {
      this.loading = false;
    }
  }

  private async cloneStoreData(sourceSlug: string, targetSlug: string) {
    const batch = writeBatch(this.firestore);

    const catSnap = await getDocs(collection(this.firestore, `Stores/${sourceSlug}/menuCategories`));
    catSnap.forEach(itemDoc => {
      const newDocRef = doc(this.firestore, `Stores/${targetSlug}/menuCategories/${itemDoc.id}`);
      batch.set(newDocRef, itemDoc.data());
    });

    const menuSnap = await getDocs(collection(this.firestore, `Stores/${sourceSlug}/menuItems`));
    menuSnap.forEach(itemDoc => {
      const newDocRef = doc(this.firestore, `Stores/${targetSlug}/menuItems/${itemDoc.id}`);
      batch.set(newDocRef, itemDoc.data());
    });

    const rawMatSnap = await getDocs(collection(this.firestore, `Stores/${sourceSlug}/rawMaterials`));
    rawMatSnap.forEach(itemDoc => {
      const newDocRef = doc(this.firestore, `Stores/${targetSlug}/rawMaterials/${itemDoc.id}`);
      batch.set(newDocRef, itemDoc.data());
    });

    await batch.commit();
  }

  async removeStore(store: StoreDoc, event: Event) {
    event.stopPropagation(); 
    
    if (store.id === this.primaryStoreId) {
      alert("You cannot remove your master store.");
      return;
    }

    const confirmDelete = confirm(`Are you sure you want to remove "${store.name}"? All data for this outlet will be deleted.`);
    if (!confirmDelete) return;

    try {
      this.loading = true;
      const subCollections = ['menuCategories', 'menuItems', 'rawMaterials'];
      
      for (const sub of subCollections) {
        const snap = await getDocs(collection(this.firestore, `Stores/${store.id}/${sub}`));
        const batch = writeBatch(this.firestore);
        snap.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }

      await deleteDoc(doc(this.firestore, `Stores/${store.id}`));

      alert('Outlet removed successfully.');
      await this.loadStores(this.currentUserId);
    } catch (e) {
      console.error('Removal failed:', e);
      alert('Error removing outlet.');
    } finally {
      this.loading = false;
    }
  }

  async toggleSetting(store: StoreDoc, field: keyof StoreDoc) {
    try {
      const docRef = doc(this.firestore, `Stores/${store.id}`);
      const newValue = !store[field];
      await updateDoc(docRef, { [field as string]: newValue });
    } catch (e) {
      console.error('Toggle failed:', e);
    }
  }

  enterStore(store: StoreDoc) {
    if (store.slug) {
      this.router.navigate(['/', store.slug, 'dashboard']);
    }
  }
}