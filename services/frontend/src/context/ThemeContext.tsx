import React, { createContext, useState, useCallback, useEffect } from 'react';
import { darkTheme } from '../theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';

type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

export const ThemeContext = createContext<ThemeContextValue>(null!);

function getInitialTheme(): Theme {
  const saved = localStorage.getItem('blog_theme');
  if (saved === 'dark' || saved === 'light') return saved;
  return 'light';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('blog_theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <div {...stylex.props(theme === 'dark' && darkTheme)}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}
