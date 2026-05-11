/**
 * Biometric authentication utility — Face ID, Touch ID, fingerprint.
 * Uses expo-local-authentication backed by the device secure enclave.
 */
import * as LocalAuthentication from 'expo-local-authentication';

export type BiometricType = 'fingerprint' | 'facial' | 'iris' | 'none';

/**
 * Check if the device supports and has biometrics enrolled.
 */
export async function isBiometricAvailable(): Promise<boolean> {
  const compatible = await LocalAuthentication.hasHardwareAsync();
  if (!compatible) return false;
  const enrolled = await LocalAuthentication.isEnrolledAsync();
  return enrolled;
}

/**
 * Returns which biometric type the device supports.
 */
export async function getBiometricType(): Promise<BiometricType> {
  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return 'facial';
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return 'fingerprint';
  if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) return 'iris';
  return 'none';
}

/**
 * Prompt the user for biometric authentication.
 * Returns true if the user authenticated successfully.
 */
export async function authenticateWithBiometrics(reason: string): Promise<boolean> {
  const available = await isBiometricAvailable();
  if (!available) return false;

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: reason,
    cancelLabel: 'Cancel',
    disableDeviceFallback: false, // allow PIN/password fallback
    fallbackLabel: 'Use Passcode',
  });

  return result.success;
}
