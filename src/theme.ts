export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 40 } as const;

export const radii = { sm: 8, md: 14, lg: 20, pill: 999 } as const;

export const font = {
  sans: 'Poppins_400Regular',
  sansMedium: 'Poppins_500Medium',
  sansSemi: 'Poppins_600SemiBold',
  sansBold: 'Poppins_700Bold',
  script: 'Pacifico_400Regular',
  size: { xs: 12, sm: 14, md: 16, lg: 20, xl: 26, xxl: 34 },
} as const;

export type Palette = {
  bg: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  textMuted: string;
  /** Fainter than textMuted; used for empty-field hints. */
  placeholder: string;
  border: string;
  primary: string;
  primaryDark: string;
  onPrimary: string;
};

export const primary = '#E2233F';
export const primaryDark = '#7A0E1F';
export const onPrimary = '#FFFFFF';
export const danger = '#E07B39';
export const success = '#22B573';
export const whatsappGreen = '#25D366';

export const palettes: Record<'light' | 'dark', Palette> = {
  light: {
    bg: '#FFF7F7',
    surface: '#FFFFFF',
    surfaceAlt: '#FBE6E9',
    text: '#1A1416',
    textMuted: '#8C8386',
    placeholder: '#C9B8BB',
    border: '#F0DCDE',
    primary,
    primaryDark,
    onPrimary,
  },
  dark: {
    bg: '#0F0A0C',
    surface: '#1C1417',
    surfaceAlt: '#2A171B',
    text: '#FFFFFF',
    textMuted: '#BBA9AC',
    placeholder: '#6E5C60',
    border: '#33272A',
    primary,
    primaryDark,
    onPrimary,
  },
};
