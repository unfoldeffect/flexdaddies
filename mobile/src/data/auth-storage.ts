// Keeps the signed-in session on the phone. On iPhone and Android it goes in
// the phone's secure store (Keychain / Keystore); the browser preview has no
// such thing, so it falls back to ordinary storage there.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { isSession, type Session } from '../lib/auth-api';

const KEY = 'fd-session-v1';
const secure = Platform.OS !== 'web';

export async function loadSession(): Promise<Session | null> {
  try {
    const raw = secure ? await SecureStore.getItemAsync(KEY) : await AsyncStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return isSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function saveSession(session: Session): Promise<boolean> {
  try {
    const raw = JSON.stringify(session);
    if (secure) await SecureStore.setItemAsync(KEY, raw);
    else await AsyncStorage.setItem(KEY, raw);
    return true;
  } catch {
    return false;
  }
}

export async function clearSession(): Promise<void> {
  try {
    if (secure) await SecureStore.deleteItemAsync(KEY);
    else await AsyncStorage.removeItem(KEY);
  } catch {
    // Nothing else to do.
  }
}
