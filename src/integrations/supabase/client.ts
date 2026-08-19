// @ts-nocheck
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { DATABASE_CONFIG } from '@/config/databaseConfig';

export const DEFAULT_CLOUD_URL = DATABASE_CONFIG.cloud.url;
export const DEFAULT_CLOUD_KEY = DATABASE_CONFIG.cloud.anonKey;

export const DEFAULT_LOCAL_URL = DATABASE_CONFIG.local.url;
export const DEFAULT_LOCAL_KEY = DATABASE_CONFIG.local.anonKey;

export const isLocalOrDesktopEnv = (): boolean => {
  if (typeof window === 'undefined') return false;
  // 1. Electron / Desktop App
  if (!!(window as any).desktopAPI || window.location.protocol === 'file:') {
    return true;
  }
  // 2. Local development / Local host
  const hostname = window.location.hostname;
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname === '::1' ||
    hostname.endsWith('.local')
  );
};

const isEnvLocalOrDesktop = isLocalOrDesktopEnv();
const storedOfflineMode = isEnvLocalOrDesktop && typeof window !== 'undefined' && localStorage.getItem('adhub_offline_mode') === 'true';

// Auto-heal old stored cloud key in local settings
if (typeof window !== 'undefined' && isEnvLocalOrDesktop) {
  const storedLocalKey = localStorage.getItem('adhub_local_supabase_key');
  if (storedLocalKey && storedLocalKey.startsWith('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0cWphaWViaXh1em9tcmZ3aWx1')) {
    localStorage.setItem('adhub_local_supabase_key', DEFAULT_LOCAL_KEY);
  }
}

const activeUrl = storedOfflineMode
  ? (typeof window !== 'undefined' && localStorage.getItem('adhub_local_supabase_url')) || DEFAULT_LOCAL_URL
  : (typeof window !== 'undefined' && localStorage.getItem('adhub_cloud_supabase_url')) || DEFAULT_CLOUD_URL;

const activeKey = storedOfflineMode
  ? (typeof window !== 'undefined' && localStorage.getItem('adhub_local_supabase_key')) || DEFAULT_LOCAL_KEY
  : (typeof window !== 'undefined' && localStorage.getItem('adhub_cloud_supabase_key')) || DEFAULT_CLOUD_KEY;

export const isOfflineMode = storedOfflineMode;

export const supabase = createClient<Database>(activeUrl, activeKey, {
  auth: {
    storage: typeof window !== 'undefined' ? localStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
  }
});

export function getOfflineSettings() {
  if (typeof window === 'undefined') {
    return { isOffline: false, localUrl: DEFAULT_LOCAL_URL, localKey: DEFAULT_LOCAL_KEY, cloudUrl: DEFAULT_CLOUD_URL, cloudKey: DEFAULT_CLOUD_KEY };
  }
  return {
    isOffline: isOfflineMode,
    localUrl: localStorage.getItem('adhub_local_supabase_url') || DEFAULT_LOCAL_URL,
    localKey: localStorage.getItem('adhub_local_supabase_key') || DEFAULT_LOCAL_KEY,
    cloudUrl: localStorage.getItem('adhub_cloud_supabase_url') || DEFAULT_CLOUD_URL,
    cloudKey: localStorage.getItem('adhub_cloud_supabase_key') || DEFAULT_CLOUD_KEY,
    lastBackupInstalled: localStorage.getItem('adhub_installed_backup_name') || null,
    lastBackupInstalledAt: localStorage.getItem('adhub_installed_backup_time') || null,
  };
}

export function setOfflineMode(enabled: boolean, localUrl?: string, localKey?: string, backupName?: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('adhub_offline_mode', enabled ? 'true' : 'false');
  if (localUrl) localStorage.setItem('adhub_local_supabase_url', localUrl);
  if (localKey) localStorage.setItem('adhub_local_supabase_key', localKey);
  if (backupName) {
    localStorage.setItem('adhub_installed_backup_name', backupName);
    localStorage.setItem('adhub_installed_backup_time', new Date().toISOString());
  }
  window.location.reload();
}