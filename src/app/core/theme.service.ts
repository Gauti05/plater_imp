// src/app/core/theme.service.ts
import { Injectable, signal, effect } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  // Check localStorage first, default to false (light mode)
  isDarkMode = signal<boolean>(localStorage.getItem('theme') === 'dark');

  constructor() {
    // This effect runs automatically whenever the signal changes
    effect(() => {
      const isDark = this.isDarkMode();
      if (isDark) {
        document.body.classList.add('dark-mode');
        localStorage.setItem('theme', 'dark');
      } else {
        document.body.classList.remove('dark-mode');
        localStorage.setItem('theme', 'light');
      }
    });
  }

  toggleTheme() {
    this.isDarkMode.update(v => !v);
  }
}