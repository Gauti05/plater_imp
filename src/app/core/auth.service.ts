// import { Injectable, computed, inject } from '@angular/core';
// import { Auth, authState, signInWithEmailAndPassword, signOut, GoogleAuthProvider, signInWithPopup, User } from '@angular/fire/auth';
// import { toSignal } from '@angular/core/rxjs-interop';
// import { Observable } from 'rxjs';

// @Injectable({ providedIn: 'root' })
// export class AuthService {
//   private auth = inject(Auth);

//   /** Observable auth stream (guards will wait on this) */
//   readonly user$: Observable<User | null> = authState(this.auth);

//   /** Signal for components */
//   readonly user = toSignal<User | null>(this.user$, { initialValue: null });
//   readonly isLoggedIn = computed(() => !!this.user());

//   async loginEmail(email: string, password: string) {
//     try {
//       return await signInWithEmailAndPassword(this.auth, email, password);
//     } catch (error: any) {
//       throw new Error(this.getFriendlyErrorMessage(error.code));
//     }
//   }

//   async loginWithGoogle() {
//     const provider = new GoogleAuthProvider();
//     try {
//       return await signInWithPopup(this.auth, provider);
//     } catch (error: any) {
//       throw new Error(this.getFriendlyErrorMessage(error.code));
//     }
//   }

//   async logout() {
//     try {
//       return await signOut(this.auth);
//     } catch (error: any) {
//       throw new Error(this.getFriendlyErrorMessage(error.code));
//     }
//   }

//   private getFriendlyErrorMessage(code: string): string {
//     switch (code) {
//       case 'auth/invalid-email': return 'Invalid email address.';
//       case 'auth/wrong-password': return 'Incorrect password.';
//       case 'auth/user-not-found': return 'No user found with this email.';
//       case 'auth/user-disabled': return 'This account has been disabled.';
//       case 'auth/invalid-credential': return 'Invalid login credentials.';
//       case 'auth/popup-closed-by-user': return 'Google login was cancelled.';
//       default: return 'An error occurred. Please try again.';
//     }
//   }
// }




import { Injectable, computed, inject } from '@angular/core';
import { Auth, authState, signInWithEmailAndPassword, signOut, GoogleAuthProvider, signInWithPopup, User } from '@angular/fire/auth';
import { toSignal } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';

// ⭐ IMPORT SECONDARY AUTH FUNCTIONS AND YOUR ENVIRONMENT
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword as createSecondaryUserWithEmail, signOut as signOutOfSecondary } from 'firebase/auth';
import { environment } from '../../environments/environment.development';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private auth = inject(Auth);

  /** Observable auth stream (guards will wait on this) */
  readonly user$: Observable<User | null> = authState(this.auth);

  /** Signal for components */
  readonly user = toSignal<User | null>(this.user$, { initialValue: null });
  readonly isLoggedIn = computed(() => !!this.user());

  async loginEmail(email: string, password: string) {
    try {
      return await signInWithEmailAndPassword(this.auth, email, password);
    } catch (error: any) {
      throw new Error(this.getFriendlyErrorMessage(error.code));
    }
  }

  async loginWithGoogle() {
    const provider = new GoogleAuthProvider();
    try {
      return await signInWithPopup(this.auth, provider);
    } catch (error: any) {
      throw new Error(this.getFriendlyErrorMessage(error.code));
    }
  }

  async logout() {
    try {
      return await signOut(this.auth);
    } catch (error: any) {
      throw new Error(this.getFriendlyErrorMessage(error.code));
    }
  }

  // ⭐ NEW DOUBLE-AUTH FUNCTION
  /** Creates a user without logging out the current Admin */
  async createSecondaryUser(email: string, password: string): Promise<string> {
    // 1. Create a completely separate, temporary connection to Firebase
    // ⭐ FIXED: Changed environment.firebase to environment.firebaseConfig
    const secondaryApp = initializeApp(environment.firebaseConfig, 'SecondaryAppInstance');
    const secondaryAuth = getAuth(secondaryApp);

    try {
      // 2. Create the user on the secondary connection
      const userCredential = await createSecondaryUserWithEmail(secondaryAuth, email, password);
      
      // 3. Immediately sign out the new user from the secondary connection
      await signOutOfSecondary(secondaryAuth);
      
      // 4. Return the new User ID so Firestore can save their profile
      return userCredential.user.uid;
      
    } catch (error: any) {
      throw new Error(this.getFriendlyErrorMessage(error.code));
    } finally {
      // 5. CRITICAL: Delete the temporary app to prevent memory leaks
      await deleteApp(secondaryApp);
    }
  }

  private getFriendlyErrorMessage(code: string): string {
    switch (code) {
      case 'auth/invalid-email': return 'Invalid email address.';
      case 'auth/wrong-password': return 'Incorrect password.';
      case 'auth/user-not-found': return 'No user found with this email.';
      case 'auth/user-disabled': return 'This account has been disabled.';
      case 'auth/invalid-credential': return 'Invalid login credentials.';
      case 'auth/popup-closed-by-user': return 'Google login was cancelled.';
      case 'auth/email-already-in-use': return 'This email is already in use by another account.';
      case 'auth/weak-password': return 'Password should be at least 6 characters.';
      default: return 'An error occurred. Please try again.';
    }
  }
}