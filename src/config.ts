import { Platform } from 'react-native';

// Values come from .env (EXPO_PUBLIC_*), see .env.example. They are bundled into the app,
// so never put secrets here.

const fallbackApi = Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';

export const API_URL = (process.env.EXPO_PUBLIC_API_URL || fallbackApi).replace(/\/$/, '');
export const APP_SCHEME = 'lovenest';
