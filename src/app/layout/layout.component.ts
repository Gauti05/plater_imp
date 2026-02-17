import { Component, computed, inject, signal, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet, ActivatedRoute, NavigationEnd } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { filter, map } from 'rxjs/operators';
import { ThemeService } from '../core/theme.service';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class LayoutComponent {
  auth = inject(AuthService);
  themeService = inject(ThemeService);
  private router = inject(Router);
  private activatedRoute = inject(ActivatedRoute);

  sidebarOpen = signal(localStorage.getItem('sidebarOpen') !== 'false');
  loading = signal(false);
  title = signal('Dashboard');
  userMenuOpen = signal(false);
  fullscreenMode = signal(false);
  storeSlug = signal<string>('');
  settingsOpen = signal(false);

  readonly initial = computed(() => {
    const u = this.auth.user();
    return u?.email?.[0]?.toUpperCase() ?? '?';
  });

  constructor() {
    // ✅ Set slug immediately from current route
    const initialSlug = this.activatedRoute.snapshot.paramMap.get('storeSlug');
    if (initialSlug) this.storeSlug.set(initialSlug);

    // ✅ Update slug + title + fullscreenMode on every navigation
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
