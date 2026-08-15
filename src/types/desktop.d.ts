export interface DesktopBackupProgress {
  stage: 'dumping' | 'uploading' | 'complete' | 'warning' | 'error';
  message: string;
  percent?: number;
  fileName?: string;
  localPath?: string;
  fileSizeKB?: number;
  fileSizeMB?: string;
  driveUrl?: string | null;
  driveError?: string | null;
  details?: string;
  timestamp?: string;
}

export interface DesktopAppInfo {
  version: string;
  name: string;
  isPackaged: boolean;
  backupDir: string;
  pgDumpFound: boolean;
  lastBackup: any;
}

export interface DesktopSavePdfOptions {
  title?: string;
  landscape?: boolean;
  pageSize?: 'A4' | 'A3' | 'Letter' | 'Legal';
}

export interface DesktopAPI {
  isDesktop: boolean;
  onBackupStatus: (callback: (progress: DesktopBackupProgress) => void) => () => void;
  triggerBackup: () => Promise<{ success: boolean; error?: string; [key: string]: any }>;
  openBackupsFolder: () => Promise<{ success: boolean; path: string }>;
  getAppInfo: () => Promise<DesktopAppInfo>;
  saveAsPDF: (options?: DesktopSavePdfOptions) => Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }>;
  printDocument: (options?: { silent?: boolean; printBackground?: boolean }) => Promise<{ success: boolean; error?: string }>;
}

declare global {
  interface Window {
    desktopAPI?: DesktopAPI;
  }
}
