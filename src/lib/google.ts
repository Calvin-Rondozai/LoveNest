import { GOOGLE_WEB_CLIENT_ID } from '../config';

// Native Google sign-in (account picker, no browser). The library needs native code, so it is
// loaded lazily: in Expo Go it is missing and we show a clear message instead of crashing.

type GoogleModule = typeof import('@react-native-google-signin/google-signin');

let google: GoogleModule | null | undefined;
function load(): GoogleModule | null {
  if (google !== undefined) return google;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    google = require('@react-native-google-signin/google-signin') as GoogleModule;
    google.GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
  } catch {
    google = null;
  }
  return google;
}

export class GoogleSignInError extends Error {
  constructor(public reason: 'unavailable' | 'cancelled' | 'not_configured' | 'failed', message: string) {
    super(message);
  }
}

/** Shows the Google account picker and returns an ID token for the server to verify. */
export async function getGoogleIdToken(): Promise<string> {
  if (!GOOGLE_WEB_CLIENT_ID) throw new GoogleSignInError('not_configured', 'Google sign-in is not set up yet. Please use email and password.');
  const lib = load();
  if (!lib) throw new GoogleSignInError('unavailable', 'Google sign-in works in the installed LoveNest app, not in Expo Go.');

  const { GoogleSignin, isErrorWithCode, statusCodes } = lib;
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const res = await GoogleSignin.signIn();
    if (res.type !== 'success') throw new GoogleSignInError('cancelled', 'Google sign-in was cancelled.');
    if (!res.data.idToken) throw new GoogleSignInError('failed', 'Google did not return a sign-in token. Please try again.');
    return res.data.idToken;
  } catch (e) {
    if (e instanceof GoogleSignInError) throw e;
    if (isErrorWithCode(e)) {
      if (e.code === statusCodes.SIGN_IN_CANCELLED) throw new GoogleSignInError('cancelled', 'Google sign-in was cancelled.');
      if (e.code === statusCodes.IN_PROGRESS) throw new GoogleSignInError('failed', 'Google sign-in is already in progress.');
      if (e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) throw new GoogleSignInError('failed', 'Google Play Services is not available on this device.');
    }
    throw new GoogleSignInError('failed', 'Google sign-in failed. Please try again.');
  }
}

/** Clears the Google account choice so the picker shows next time. */
export async function signOutGoogle() {
  const lib = load();
  try {
    await lib?.GoogleSignin.signOut();
  } catch {
    // Not signed in with Google: nothing to do.
  }
}
