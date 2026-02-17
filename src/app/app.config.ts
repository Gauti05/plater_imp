import { ApplicationConfig, importProvidersFrom } from '@angular/core';
import { provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';

import { provideFirebaseApp, initializeApp, } from '@angular/fire/app';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { provideFirestore, getFirestore, enableIndexedDbPersistence } from '@angular/fire/firestore';
import { routes } from './app.routes';

import { provideAnimations } from '@angular/platform-browser/animations';
import { provideStorage, getStorage } from '@angular/fire/storage';

import 'chart.js/auto';
import { environment } from '../environments/environment.development';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withComponentInputBinding()),
    provideFirebaseApp(() => initializeApp(environment.firebaseConfig)),
    provideAuth(() => getAuth()),
    provideFirestore(() => {
  const firestore = getFirestore();
  enableIndexedDbPersistence(firestore).catch((err) => {
    if (err.code === 'failed-precondition') {
      
      console.warn('Persistence failed: Multiple tabs open');
    } else if (err.code === 'unimplemented') {
      // The browser doesn't support all of the features required to enable persistence
      console.warn('Persistence failed: Browser not supported');
    }
  });
  return firestore;
}),
    provideAnimations(),
    provideStorage(() => getStorage()),
  ]
};



