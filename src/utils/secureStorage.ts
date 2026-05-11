/**
 * Secure storage utility — wraps expo-secure-store (iOS Keychain / Android Keystore).
 * Never use AsyncStorage for sensitive data.
 */
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

/**
 * Save a value securely. For booleans/numbers, stringify first.
 */
export async function secureSet(key: string, value: string): Promise<void> {
  await SecureStore.setItemAsync(key, value, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

/**
 * Retrieve a secure value. Returns null if not found.
 */
export async function secureGet(key: string): Promise<string | null> {
  return SecureStore.getItemAsync(key);
}

/**
 * Delete a secure value.
 */
export async function secureDelete(key: string): Promise<void> {
  await SecureStore.deleteItemAsync(key);
}

/**
 * Generate or retrieve the database encryption key.
 * The key is 256-bit random bytes encoded as hex, stored in Keychain/Keystore.
 */
export async function getOrCreateDbEncryptionKey(storageKey: string): Promise<string> {
  const existing = await secureGet(storageKey);
  if (existing) return existing;

  // Generate a cryptographically secure 32-byte random key
  const randomBytes = await Crypto.getRandomBytesAsync(32);
  const hexKey = Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  await secureSet(storageKey, hexKey);
  return hexKey;
}
