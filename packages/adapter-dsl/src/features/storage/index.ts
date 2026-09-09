import { defineFeature } from '../types';

/**
 * T4 — Storage & Sandboxing (Domains 2 & 3).
 *
 * Plain vs secure storage are separate engine actions, so `setStorage` and a secure variant are
 * mapped distinctly rather than collapsed — silently promoting every write to the encrypted
 * enclave would change the performance profile of ordinary storage.
 *
 * The task's AES-256-GCM enclave, 50 MB quota and accountId isolation are native-side guarantees
 * of GoatStorageManager / GoatSecureStorageManager. This module routes to them; it does not
 * re-implement or verify them.
 */
export const storageFeature = defineFeature('storage', {
  setStorage: 'STORAGE_SET',
  getStorage: 'STORAGE_GET',
  removeStorage: 'STORAGE_REMOVE',
  clearStorage: 'STORAGE_CLEAR',
  // uni-app's *Sync variants are the same call; the DSL's synchronous contract cannot be honoured
  // across an async bridge, so they resolve as promises like everything else.
  setStorageSync: 'STORAGE_SET',
  getStorageSync: 'STORAGE_GET',
  removeStorageSync: 'STORAGE_REMOVE',
  clearStorageSync: 'STORAGE_CLEAR',
  setSecureStorage: 'SECURE_STORAGE_SET',
  getSecureStorage: 'SECURE_STORAGE_GET',
  removeSecureStorage: 'SECURE_STORAGE_REMOVE',
  clearSecureStorage: 'SECURE_STORAGE_CLEAR',
  // getFileSystemManager() surface
  readFile: 'FS_READ_FILE',
  writeFile: 'FS_WRITE_FILE',
  copyFile: 'FS_COPY_FILE',
  getStorageInfo: 'WEB_STORAGE_GET_QUOTA_USAGE',
});
export default storageFeature;
