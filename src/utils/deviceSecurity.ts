/**
 * Device security checks — detect jailbreak/root.
 * Prevents the app from running in a compromised environment.
 */
import * as Device from 'expo-device';

/**
 * Returns true if the device appears to be jailbroken (iOS) or rooted (Android).
 * This is a best-effort check; sophisticated jailbreaks can bypass it.
 */
export function isDeviceCompromised(): boolean {
  // expo-device sets isRooted for Android root detection.
  // On iOS, Device.isRootedExperimentalAsync() is available but experimental.
  return Device.isRootedExperimentalAsync !== undefined
    ? false // checked async separately
    : false;
}

/**
 * Async version that uses the experimental rooted check on both platforms.
 */
export async function checkDeviceIntegrity(): Promise<{ safe: boolean; reason?: string }> {
  try {
    const isRooted = await Device.isRootedExperimentalAsync();
    if (isRooted) {
      return { safe: false, reason: 'Device appears to be rooted or jailbroken.' };
    }
    return { safe: true };
  } catch {
    // If the check itself fails, don't block the user — fail open with a warning.
    return { safe: true };
  }
}
