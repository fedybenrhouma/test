import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject } from 'rxjs';

export type Theme = 
  | 'default' 
  | 'light' 
  | 'dark' 
  | 'mono' 
  | 'abyss' 
  | 'midnight' 
  | 'ocean' 
  | 'slate' 
  | 'charcoal' 
  | 'onyx' 
  | 'obsidian' 
  | 'forest';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private currentTheme = new BehaviorSubject<Theme>('default');
  currentTheme$ = this.currentTheme.asObservable();

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    if (isPlatformBrowser(this.platformId)) {
      const savedTheme = localStorage.getItem('theme') as Theme;
      if (savedTheme) {
        this.setTheme(savedTheme);
      }
    }
  }

  setTheme(theme: Theme): void {
    if (isPlatformBrowser(this.platformId)) {
      const root = document.documentElement;
      
      // Remove previous theme class
      root.classList.remove(`theme-${this.currentTheme.value}`);
      
      // Add new theme class
      if (theme !== 'default') {
        root.classList.add(`theme-${theme}`);
      }
      
      localStorage.setItem('theme', theme);
      this.currentTheme.next(theme);
    }
  }

  getTheme(): Theme {
    return this.currentTheme.value;
  }
}
