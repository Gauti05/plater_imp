// import { Component, OnInit, ViewEncapsulation, inject, signal } from '@angular/core';
// import { CommonModule } from '@angular/common';
// import { FormsModule, NgForm } from '@angular/forms';
// import { ActivatedRoute, Router } from '@angular/router';
// import { Auth, createUserWithEmailAndPassword, signOut } from '@angular/fire/auth';
// import { Firestore, doc, getDoc, setDoc, collection, updateDoc } from '@angular/fire/firestore';

// interface User {
//   id?: string;
//   name: string;
//   designation: string;
//   email: string;
//   password?: string;
//   roles: string[];
//   isActive: boolean;
// }

// @Component({
//   selector: 'app-add-user',
//   standalone: true,
//   imports: [CommonModule, FormsModule],
//   templateUrl: './add-user.component.html',
//   styleUrls: ['./add-user.component.css'],
//   encapsulation: ViewEncapsulation.None,
// })
// export class AddUserComponent implements OnInit {
// private firestore = inject(Firestore);
//   private auth = inject(Auth);
//   private route = inject(ActivatedRoute);
//   private router = inject(Router);

//   user = signal<User>({
//     name: '',
//     designation: '',
//     email: '',
//     password: '',
//     roles: ['Sales'],
//     isActive: true,
//   });

//   availableRoles = ['HR', 'Sales', 'Inventory', 'CRM', 'Accounts', 'Admin'];

//   loading = signal(false);
//   error = signal<string | null>(null);
//   isEditMode = signal(false);
//   userId: string | null = null;

//   ngOnInit(): void {
//     this.route.paramMap.subscribe(params => {
//       this.userId = params.get('id');
//       if (this.userId) {
//         this.isEditMode.set(true);
//         this.loadUserData(this.userId);
//       } else {
//         this.isEditMode.set(false);
//         this.user.set({
//           name: '',
//           designation: '',
//           email: '',
//           password: '',
//           roles: ['Sales'],
//           isActive: true,
//         });
//       }
//     });
//   }

//   async loadUserData(id: string): Promise<void> {
//     this.loading.set(true);
//     this.error.set(null);
//     try {
//       const userDocRef = doc(this.firestore, `users`, id);
//       const userDoc = await getDoc(userDocRef);

//       if (userDoc.exists()) {
//         const userData = userDoc.data() as User;
//         this.user.set({ ...userData, id: userDoc.id, password: '' });
//       } else {
//         this.error.set('User not found.');
//         this.router.navigate(['/users']);
//       }
//     } catch (e: any) {
//       console.error("Error loading user data:", e);
//       this.error.set("Failed to load user data.");
//     } finally {
//       this.loading.set(false);
//     }
//   }

//   onRoleChange(role: string, event: Event): void {
//     const isChecked = (event.target as HTMLInputElement).checked;
//     this.user.update(currentUser => {
//       const updatedRoles = isChecked
//         ? [...currentUser.roles, role]
//         : currentUser.roles.filter(r => r !== role);
//       return { ...currentUser, roles: updatedRoles };
//     });
//   }

//   async onSubmit(form: NgForm): Promise<void> {
//     if (form.invalid || this.loading()) {
//       form.form.markAllAsTouched();
//       return;
//     }

//     this.loading.set(true);
//     this.error.set(null);

//     try {
//       const usersCollectionRef = collection(this.firestore, `users`);

//       if (this.isEditMode() && this.userId) {
//         const userDocRef = doc(this.firestore, `users`, this.userId);
//         const userDataToUpdate = {
//           name: this.user().name,
//           designation: this.user().designation,
//           email: this.user().email,
//           roles: this.user().roles,
//           isActive: this.user().isActive,
//         };
//         await updateDoc(userDocRef, userDataToUpdate);
//         console.log('User updated successfully!');
//       } else {
//         if (!this.user().password) {
//           this.error.set("Password is required for new users.");
//           this.loading.set(false);
//           return;
//         }

//         const userCredential = await createUserWithEmailAndPassword(this.auth, this.user().email, this.user().password!);
//         const newAuthUid = userCredential.user.uid;

//         await signOut(this.auth);

//         const newUserDoc: Omit<User, 'id' | 'password'> = {
//           name: this.user().name,
//           designation: this.user().designation,
//           email: this.user().email,
//           roles: this.user().roles,
//           isActive: this.user().isActive,
//         };
//         await setDoc(doc(usersCollectionRef, newAuthUid), newUserDoc);
//         console.log('User created successfully!');
//       }
//       this.router.navigate(['/users']);
//     } catch (e: any) {
//       console.error("Error saving user:", e);
//       if (e.code === 'auth/email-already-in-use') {
//         this.error.set('This email is already in use by another account.');
//       } else if (e.code === 'auth/weak-password') {
//         this.error.set('Password should be at least 6 characters.');
//       } else {
//         this.error.set(`Failed to ${this.isEditMode() ? 'update' : 'create'} user: ${e.message}`);
//       }
//     } finally {
//       this.loading.set(false);
//     }
//   }
// }




import { Component, OnInit, ViewEncapsulation, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Auth } from '@angular/fire/auth';
import { Firestore, doc, getDoc, setDoc, updateDoc, serverTimestamp } from '@angular/fire/firestore';
import { StoreContextService } from '../../core/store-context.service';

import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword as createSecondaryUser, signOut as signOutOfSecondary } from 'firebase/auth';
import { environment } from '../../../environments/environment.development';

interface User {
  id?: string;
  name: string;
  designation: string;
  email: string;
  password?: string;
  roles: string[];
  userRole: string; // ⭐ Simplified
  isActive: boolean;
  storeId?: string;
}

@Component({
  selector: 'app-add-user',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './add-user.component.html',
  styleUrls: ['./add-user.component.css'],
  encapsulation: ViewEncapsulation.None,
})
export class AddUserComponent implements OnInit {
  private firestore = inject(Firestore);
  private auth = inject(Auth);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private storeContext = inject(StoreContextService);

  user = signal<User>({
    name: '',
    designation: '',
    email: '',
    password: '',
    roles: ['Sales'],
    userRole: 'Staff', // Default employee level
    isActive: true,
  });

  availableRoles = ['HR', 'Sales', 'Inventory', 'CRM', 'Accounts', 'Admin'];
  loading = signal(false);
  error = signal<string | null>(null);
  isEditMode = signal(false);
  userId: string | null = null;
  storeSlug: string | null | undefined = null;

  async ngOnInit() {
    this.storeSlug = this.route.snapshot.paramMap.get('storeSlug') || this.route.parent?.snapshot.paramMap.get('storeSlug');
    
    if (this.storeSlug) {
      if (!this.storeContext.currentStoreId || this.storeContext.currentSlug !== this.storeSlug) {
        await this.storeContext.initFromSlug(this.storeSlug);
      }
    }

    this.route.paramMap.subscribe(params => {
      this.userId = params.get('id');
      if (this.userId) {
        this.isEditMode.set(true);
        this.loadUserData(this.userId);
      }
    });
  }

  async loadUserData(id: string): Promise<void> {
    this.loading.set(true);
    const storeId = this.storeContext.currentStoreId;
    try {
      const userDocRef = doc(this.firestore, `Users`, id);
      const userDoc = await getDoc(userDocRef);
      if (userDoc.exists()) {
        const userData = userDoc.data() as User;
        this.user.set({ ...userData, id: userDoc.id, password: '' });
      }
    } catch (e) {
      this.error.set("Failed to load user.");
    } finally {
      this.loading.set(false);
    }
  }

  onRoleChange(role: string, event: Event): void {
    const isChecked = (event.target as HTMLInputElement).checked;
    this.user.update(currentUser => {
      const updatedRoles = isChecked
        ? [...currentUser.roles, role]
        : currentUser.roles.filter(r => r !== role);
      return { ...currentUser, roles: updatedRoles };
    });
  }

  async onSubmit(form: NgForm): Promise<void> {
    if (form.invalid || this.loading()) return;
    const storeId = this.storeContext.currentStoreId;
    if (!storeId) { this.error.set("Store context missing."); return; }

    this.loading.set(true);
    this.error.set(null);

    try {
      const usersColPath = `Users`;

      if (this.isEditMode() && this.userId) {
        const userDocRef = doc(this.firestore, usersColPath, this.userId);
        await updateDoc(userDocRef, {
          name: this.user().name,
          designation: this.user().designation,
          email: this.user().email,
          roles: this.user().roles,
          userRole: this.user().userRole, 
          isActive: this.user().isActive,
        });
        alert('User Updated Successfully!');
        this.router.navigate(['/', this.storeSlug, 'users']);
        
      } else {
        const secondaryApp = initializeApp(environment.firebaseConfig, 'SecondaryAppInstance');
        const secondaryAuth = getAuth(secondaryApp);

        try {
          const userCredential = await createSecondaryUser(secondaryAuth, this.user().email, this.user().password!);
          const newUid = userCredential.user.uid;

          await signOutOfSecondary(secondaryAuth);

          const userDocRef = doc(this.firestore, usersColPath, newUid);
          await setDoc(userDocRef, {
            name: this.user().name,
            designation: this.user().designation,
            email: this.user().email,
            roles: this.user().roles,
            userRole: this.user().userRole, 
            isActive: this.user().isActive,
            storeId: storeId,
            createdAt: serverTimestamp()
          });

          alert('User created successfully!');
          this.router.navigate(['/', this.storeSlug, 'users']);
          
        } finally {
          await deleteApp(secondaryApp);
        }
      }
    } catch (e: any) {
      console.error("Error saving user:", e);
      if (e.code === 'auth/email-already-in-use') {
        this.error.set('This email is already in use by another account.');
      } else if (e.code === 'auth/weak-password') {
        this.error.set('Password should be at least 6 characters.');
      } else {
        this.error.set(e.message);
      }
    } finally {
      this.loading.set(false);
    }
  }
}