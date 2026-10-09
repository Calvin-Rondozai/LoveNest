import { createAuthClient } from 'better-auth/react';
import { emailOTPClient, inferAdditionalFields } from 'better-auth/client/plugins';
import { expoClient } from '@better-auth/expo/client';
import * as SecureStore from 'expo-secure-store';
import { API_URL, APP_SCHEME } from '../config';

// Official Better Auth client for Expo. The session cookie is kept in the device keychain
// (SecureStore), never in AsyncStorage.
export const authClient = createAuthClient({
  baseURL: API_URL,
  fetchOptions: { timeout: 20000 },
  plugins: [
    expoClient({ scheme: APP_SCHEME, storagePrefix: 'lovenest', storage: SecureStore }),
    emailOTPClient(),
    inferAdditionalFields({
      user: {
        role: { type: 'string', required: false },
        mustChangePassword: { type: 'boolean', required: false },
        acceptedTermsVersion: { type: 'string', required: false },
        phone: { type: 'string', required: false },
      },
    }),
  ],
});
