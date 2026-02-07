import * as stylex from '@stylexjs/stylex';

export const colors = stylex.defineVars({
  bgPrimary: '#faf8f5',
  bgSecondary: '#f0ece6',
  bgCard: '#ffffff',
  bgCardHover: '#fdfcfa',
  bgInput: '#ffffff',
  bgOverlay: 'rgba(0,0,0,0.4)',

  textPrimary: '#1a1714',
  textSecondary: '#5c564e',
  textMuted: '#9b9389',
  textInverse: '#faf8f5',

  accent: '#c05830',
  accentHover: '#a74a27',
  accentLight: '#f8ede8',
  accentMuted: 'rgba(192,88,48,0.12)',

  border: '#e4dfd8',
  borderLight: '#eeebe6',
  borderHeavy: '#d0c9bf',

  tagBg: '#f0ece6',
  tagText: '#5c564e',

  success: '#3a7d44',
  error: '#c0392b',
  warning: '#d4a017',

  ruleColor: '#1a1714',
  ruleLight: '#e4dfd8',
});

export const darkTheme = stylex.createTheme(colors, {
  bgPrimary: '#141210',
  bgSecondary: '#1e1b18',
  bgCard: '#221f1b',
  bgCardHover: '#2a2622',
  bgInput: '#1e1b18',
  bgOverlay: 'rgba(0,0,0,0.6)',

  textPrimary: '#ede8e1',
  textSecondary: '#a89e93',
  textMuted: '#6e655b',
  textInverse: '#141210',

  accent: '#e07850',
  accentHover: '#f08a62',
  accentLight: '#2a1f1a',
  accentMuted: 'rgba(224,120,80,0.15)',

  border: '#302c27',
  borderLight: '#262320',
  borderHeavy: '#3d3832',

  tagBg: '#2a2622',
  tagText: '#a89e93',

  success: '#5aad64',
  error: '#e05545',
  warning: '#e0b020',

  ruleColor: '#ede8e1',
  ruleLight: '#302c27',
});

export const fonts = stylex.defineVars({
  display: "'Playfair Display', Georgia, serif",
  body: "'Source Serif 4', 'Georgia', serif",
  sans: "'DM Sans', -apple-system, sans-serif",
  mono: "'JetBrains Mono', monospace",
});

export const radii = stylex.defineVars({
  sm: '4px',
  md: '8px',
  lg: '16px',
});

export const shadows = stylex.defineVars({
  sm: '0 1px 2px rgba(0,0,0,0.06)',
  md: '0 4px 12px rgba(0,0,0,0.08)',
  lg: '0 12px 40px rgba(0,0,0,0.12)',
  xl: '0 24px 60px rgba(0,0,0,0.16)',
});

export const easings = stylex.defineVars({
  out: 'cubic-bezier(0.16, 1, 0.3, 1)',
  inOut: 'cubic-bezier(0.65, 0, 0.35, 1)',
});
