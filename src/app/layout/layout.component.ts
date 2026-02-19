import { Component, computed, inject, signal, ViewEncapsulation, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet, ActivatedRoute, NavigationEnd } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { filter, map } from 'rxjs/operators';
import { ThemeService } from '../core/theme.service';
import { Auth, authState } from '@angular/fire/auth'; // ⭐ Added
import { Firestore, doc, getDoc } from '@angular/fire/firestore'; // ⭐ Added

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class LayoutComponent implements OnInit {
  auth = inject(AuthService);
  themeService = inject(ThemeService);
  private router = inject(Router);
  private activatedRoute = inject(ActivatedRoute);
  
  private fireAuth = inject(Auth);
  private firestore = inject(Firestore);

  sidebarOpen = signal(localStorage.getItem('sidebarOpen') !== 'false');
  loading = signal(false);
  title = signal('Dashboard');
  userMenuOpen = signal(false);
  fullscreenMode = signal(false);
  storeSlug = signal<string>('');
  settingsOpen = signal(false);

  // ⭐ Store User Role to drive UI
  userRole = signal<string>('Staff');

  readonly initial = computed(() => {
    const u = this.auth.user();
    return u?.email?.[0]?.toUpperCase() ?? '?';
  });

  constructor() {
    const initialSlug = this.activatedRoute.snapshot.paramMap.get('storeSlug');
    if (initialSlug) this.storeSlug.set(initialSlug);

    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      map(() => {
        let route = this.activatedRoute;
        while (route.firstChild) route = route.firstChild;
        return route;
      })
    ).subscribe(route => {
      const data = route.snapshot.data;
      this.title.set(data['title'] || 'Dashboard');
      this.fullscreenMode.set(!!data['fullscreen']);
      const slug = route.snapshot.paramMap.get('storeSlug');
      if (slug) this.storeSlug.set(slug);
    });
  }

  // ⭐ Fetch real role on load
  ngOnInit() {
    authState(this.fireAuth).subscribe(async (user) => {
      if (user) {
        const snap = await getDoc(doc(this.firestore, `Users/${user.uid}`));
        if (snap.exists()) {
          this.userRole.set(snap.data()['userRole'] || 'Staff');
        }
      }
    });
  }

  toggleSidebar() {
    this.sidebarOpen.update(v => {
      localStorage.setItem('sidebarOpen', String(!v));
      return !v;
    });
  }

  toggleUserMenu() {
    this.userMenuOpen.update(v => !v);
  }

  async logout() {
    this.loading.set(true);
    try {
      await this.auth.logout();
      this.router.navigateByUrl('/login');
    } finally {
      this.loading.set(false);
    }
  }

  toggleSettingsOpen() {
    this.settingsOpen.update(v => !v);
  }
}