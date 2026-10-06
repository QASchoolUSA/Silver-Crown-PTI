export type ColorTokens = {
  surface: string;
  surfaceDim: string;
  surfaceBright: string;
  surfaceContainerLowest: string;
  surfaceContainerLow: string;
  surfaceContainer: string;
  surfaceContainerHigh: string;
  surfaceContainerHighest: string;
  onSurface: string;
  onSurfaceVariant: string;
  inverseSurface: string;
  inverseOnSurface: string;
  outline: string;
  outlineVariant: string;
  surfaceTint: string;
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  inversePrimary: string;
  secondary: string;
  onSecondary: string;
  secondaryContainer: string;
  onSecondaryContainer: string;
  tertiary: string;
  onTertiary: string;
  tertiaryContainer: string;
  onTertiaryContainer: string;
  error: string;
  onError: string;
  errorContainer: string;
  onErrorContainer: string;
};

export const darkColors: ColorTokens = {
  surface: '#131317',
  surfaceDim: '#131317',
  surfaceBright: '#39393d',
  surfaceContainerLowest: '#0e0e12',
  surfaceContainerLow: '#1b1b1f',
  surfaceContainer: '#1f1f23',
  surfaceContainerHigh: '#2a292e',
  surfaceContainerHighest: '#353439',
  onSurface: '#e4e1e7',
  onSurfaceVariant: '#bdc8d2',
  inverseSurface: '#e4e1e7',
  inverseOnSurface: '#303034',
  outline: '#87929c',
  outlineVariant: '#3e4851',
  surfaceTint: '#89ceff',
  primary: '#89ceff',
  onPrimary: '#00344d',
  primaryContainer: '#00b4ff',
  onPrimaryContainer: '#004361',
  inversePrimary: '#006591',
  secondary: '#c6c6c6',
  onSecondary: '#2f3131',
  secondaryContainer: '#484949',
  onSecondaryContainer: '#b8b8b8',
  tertiary: '#c8c6c8',
  onTertiary: '#303032',
  tertiaryContainer: '#aba9ab',
  onTertiaryContainer: '#3e3e40',
  error: '#ffb4ab',
  onError: '#690005',
  errorContainer: '#93000a',
  onErrorContainer: '#ffdad6',
};

/** Cool daylight palette for cab/office readability (not warm cream). */
export const lightColors: ColorTokens = {
  surface: '#f5f7fa',
  surfaceDim: '#e8eef4',
  surfaceBright: '#ffffff',
  surfaceContainerLowest: '#ffffff',
  surfaceContainerLow: '#eef2f6',
  surfaceContainer: '#e4ebf2',
  surfaceContainerHigh: '#d8e2ec',
  surfaceContainerHighest: '#c9d6e3',
  onSurface: '#1a1c1e',
  onSurfaceVariant: '#3e4851',
  inverseSurface: '#2a292e',
  inverseOnSurface: '#e4e1e7',
  outline: '#6b7782',
  outlineVariant: '#b8c4cf',
  surfaceTint: '#0077b6',
  primary: '#006591',
  onPrimary: '#ffffff',
  primaryContainer: '#89ceff',
  onPrimaryContainer: '#00344d',
  inversePrimary: '#89ceff',
  secondary: '#4a5156',
  onSecondary: '#ffffff',
  secondaryContainer: '#d5dbe0',
  onSecondaryContainer: '#2f3131',
  tertiary: '#5a585c',
  onTertiary: '#ffffff',
  tertiaryContainer: '#e0dee0',
  onTertiaryContainer: '#303032',
  error: '#ba1a1a',
  onError: '#ffffff',
  errorContainer: '#ffdad6',
  onErrorContainer: '#410002',
};

export const colorSchemes = {
  dark: darkColors,
  light: lightColors,
} as const;

export type ColorSchemeName = keyof typeof colorSchemes;

/** Default / dark palette — kept for Expo mobile and existing imports. */
export const colors = darkColors;

export const typography = {
  bebas: 'Bebas Neue',
  montserrat: 'Montserrat',
  montserratSemiBold: 'Montserrat-SemiBold',
  montserratBold: 'Montserrat-Bold',
} as const;

export type AppearanceMode = 'system' | 'light' | 'dark';
