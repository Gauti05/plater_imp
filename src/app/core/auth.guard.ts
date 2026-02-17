// src/app/core/auth.guard.ts
import { inject } from '@angular/core';
import { CanMatchFn, Router, UrlTree } from '@angular/router';
import { AuthService } from './auth.service';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { from, map, switchMap, take } from 'rxjs';

export const authGuard: CanMatchFn = (): boolean | UrlTree | import('rxjs').Observable<boolean | UrlTree> => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.user$.pipe(
    take(1),
    map(user => user ? true : router.createUrlTree(['/login']))
  );
};

export const loginBlockGuard: CanMatchFn = (): boolean | UrlTree | import('rxjs').Observable<boolean | UrlTree> => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const firestore = inject(Firestore);

  return auth.user$.pipe(
    take(1),
    switchMap(user => {
      if (!user) return from([true]); // allow login if not logged in

      // ✅ lookup user in Users collection
      const userRef = doc(firestore, `users/${user.uid}`);
      return from(getDoc(userRef)).pipe(
        switchMap(userSnap => {
          if (!userSnap.exists()) return from([router.createUrlTree(['/login'])]);
          const userData = userSnap.data() as any;

          if (userData.userRole === 'Superadmin') {
            return from([router.createUrlTree(['/superadmin/dashboard'])]);
          }

          if (userData.userRole === 'Storeadmin') {
            const storeId = userData.storeId;
            if (!storeId) return from([router.createUrlTree(['/login'])]);

            // ✅ fetch store slug as observable
            return from(getDoc(doc(firestore, `Stores/${storeId}`))).pipe(
              map(storeSnap => {
                if (!storeSnap.exists()) return router.createUrlTree(['/login']);
                const slug = (storeSnap.data() as any).slug;
                return router.createUrlTree([`/${slug}/dashboard`]);
              })
            );
          }

          return from([router.createUrlTree(['/login'])]);
        })
      );
    })
  );
};
