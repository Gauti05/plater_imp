// import { Component, inject, signal, OnInit, ViewEncapsulation, PLATFORM_ID } from '@angular/core';
// import { CommonModule, isPlatformBrowser } from '@angular/common';
// import { FormsModule, NgForm } from '@angular/forms';
// import { Router } from '@angular/router';
// import { AuthService } from '../core/auth.service';
// import { Firestore, doc, getDoc } from '@angular/fire/firestore';

// @Component({
//   selector: 'app-login',
//   standalone: true,
//   imports: [FormsModule, CommonModule],
//   templateUrl: './login.component.html',
//   styleUrls: ['./login.component.css'],
//   encapsulation: ViewEncapsulation.None
// })
// export class LoginComponent implements OnInit {
//   private auth = inject(AuthService);
//   private router = inject(Router);
//   private firestore = inject(Firestore);
//   private platformId = inject(PLATFORM_ID);

//   email = '';
//   password = '';
//   loading = signal(false);
//   error = signal<string | null>(null);
//   passwordVisible = signal(false);
//   rememberMe = false; 

//   ngOnInit() {
//     if (isPlatformBrowser(this.platformId)) {
//       const savedCreds = localStorage.getItem('rememberCreds');
//       if (savedCreds) {
//         const { email, password } = JSON.parse(savedCreds);
//         this.email = email;
//         this.password = password;
//         this.rememberMe = true;
//       }
//     }
//   }

//   togglePassword() {
//     this.passwordVisible.update(v => !v);
//   }

//   async onSubmit(form: NgForm) {
//     if (form.invalid || this.loading()) return;
    
//     this.loading.set(true);
//     this.error.set(null);

//     try {
//       const cred = await this.auth.loginEmail(this.email.trim(), this.password);
//       if (!cred.user) throw new Error('Login failed.');

//       const userRef = doc(this.firestore, `Users/${cred.user.uid}`);
//       const userSnap = await getDoc(userRef);

//       if (!userSnap.exists()) throw new Error('User profile not found.');

//       const userData = userSnap.data() as any;

//       if (isPlatformBrowser(this.platformId)) {
//         if (this.rememberMe) {
//           localStorage.setItem('rememberCreds', JSON.stringify({ email: this.email, password: this.password }));
//         } else {
//           localStorage.removeItem('rememberCreds');
//         }
//       }

//       if (userData.userRole === 'Superadmin') {
//         this.router.navigateByUrl('/superadmin/dashboard');
//       } else if (userData.userRole === 'Storeadmin') {
//         const storeId = userData.storeId;
//         if (!storeId) throw new Error('Store not linked.');
//         const storeSnap = await getDoc(doc(this.firestore, `Stores/${storeId}`));
//         if (!storeSnap.exists()) throw new Error('Store not found.');
//         const slug = (storeSnap.data() as any).slug;
//         this.router.navigateByUrl(`/${slug}/dashboard`);
//       } else {
//         throw new Error('Unauthorized role.');
//       }

//     } catch (e: any) {
//       console.error(e);
//       this.error.set(e.message || 'Login failed');
//     } finally {
//       this.loading.set(false);
//     }
//   }
// }



import { Component, inject, signal, OnInit, ViewEncapsulation, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class LoginComponent implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);
  private firestore = inject(Firestore);
  private platformId = inject(PLATFORM_ID);

  email = '';
  password = '';
  loading = signal(false);
  error = signal<string | null>(null);
  passwordVisible = signal(false);
  rememberMe = false; 

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      const savedCreds = localStorage.getItem('rememberCreds');
      if (savedCreds) {
        const { email, password } = JSON.parse(savedCreds);
        this.email = email;
        this.password = password;
        this.rememberMe = true;
      }
    }
  }

  togglePassword() {
    this.passwordVisible.update(v => !v);
  }

  async onSubmit(form: NgForm) {
    if (form.invalid || this.loading()) return;
    
    this.loading.set(true);
    this.error.set(null);

    try {
      const cred = await this.auth.loginEmail(this.email.trim(), this.password);
      if (!cred.user) throw new Error('Login failed.');

      const userRef = doc(this.firestore, `Users/${cred.user.uid}`);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) throw new Error('User profile not found.');

      const userData = userSnap.data() as any;

      if (isPlatformBrowser(this.platformId)) {
        if (this.rememberMe) {
          localStorage.setItem('rememberCreds', JSON.stringify({ email: this.email, password: this.password }));
        } else {
          localStorage.removeItem('rememberCreds');
        }
      }

      if (userData.userRole === 'Superadmin') {
        this.router.navigateByUrl('/superadmin/dashboard');
      } else if (userData.userRole === 'Storeadmin') {
        // ⭐ UPDATED LOGIC: Redirect to the Store Selector (Outlets) screen
        // instead of jumping directly into a single store.
        this.router.navigateByUrl('/outlets');
      } else {
        throw new Error('Unauthorized role.');
      }

    } catch (e: any) {
      console.error(e);
      this.error.set(e.message || 'Login failed');
    } finally {
      this.loading.set(false);
    }
  }
}