/**
 * NATIVE MODULE INTERFACE: GratitudeLock
 * 
 * This file defines the bridge between React Native (JS) and 
 * the Native System APIs (Swift/Kotlin).
 * 
 * iOS implementation should use: FamilyControls, ManagedSettings, DeviceActivity
 * Android implementation should use: AccessibilityService, UsageStatsManager
 */

export const GratitudeLockInterface = {
  /**
   * Requests the necessary system permissions from the user.
   * For iOS: Triggers FamilyControls authorization.
   * For Android: Redirects to Settings -> Accessibility.
   * @returns {Promise<boolean>} True if permission granted.
   */
  requestPermissions: async (): Promise<boolean> => {
    // Native call: NativeModules.GratitudeLock.requestPermissions()
  },

  /**
   * Sets the list of apps that should be restricted.
   * @param {string[]} appIds - List of bundle IDs (e.g., ['com.instagram.android', 'com.zhiliaoapp.musically'])
   * @returns {Promise<void>}
   */
  setBlockedApps: async (appIds: string[]): Promise<void> => {
    // Native call: NativeModules.GratitudeLock.setBlockedApps(appIds)
  },

  /**
   * Activates the system-level block (The "Lock").
   * iOS: Applies a ManagedSettingsStore shield.
   * Android: Starts the AccessibilityService monitoring loop.
   * @returns {Promise<void>}
   */
  activateLock: async (): Promise<void> => {
    // Native call: NativeModules.GratitudeLock.activateLock()
  },

  /**
   * Deactivates the system-level block (The "Unlock").
   * iOS: Removes the ManagedSettingsStore shield.
   * Android: Flips the block flag to false in the AccessibilityService.
   * @returns {Promise<void>}
   */
  deactivateLock: async (): Promise<void> => {
    // Native call: NativeModules.GratitudeLock.deactivateLock()
  },

  /**
   * Schedules the daily lock time.
   * @param {string} time - ISO 8601 time string (e.g., "07:00")
   * @returns {Promise<void>}
   */
  scheduleDailyLock: async (time: string): Promise<void> => {
    // Native call: NativeModules.GratitudeLock.scheduleDailyLock(time)
  },
};
