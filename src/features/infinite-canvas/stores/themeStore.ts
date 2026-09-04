import { create } from 'zustand';
import type { ThemeStore } from '../types';

const applyTheme = (isDark: boolean) => {
  if (isDark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
};

export const useThemeStore = create<ThemeStore>((set, get) => ({
  isDark: localStorage.getItem('theme') === 'dark',

  toggleTheme: () => {
    const newIsDark = !get().isDark;
    set({ isDark: newIsDark });
    applyTheme(newIsDark);
  },
}));

// Initialize theme
const savedTheme = localStorage.getItem('theme');
const initialIsDark = savedTheme ? savedTheme === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
applyTheme(initialIsDark);
