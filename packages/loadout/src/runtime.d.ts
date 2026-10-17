// What TypeScript's "dom" lib still lacks of the File System Access APIs Loadout's
// pages call (WICG drafts, Chromium only). Keep it small, as in xcontent-fs-web.

declare global {
  interface FileSystemHandle {
    /** @see https://wicg.github.io/file-system-access/#api-filesystemhandle-querypermission */
    queryPermission(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>;
    /** Needs a user gesture. @see https://wicg.github.io/file-system-access/#api-filesystemhandle-requestpermission */
    requestPermission(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>;
  }

  interface Window {
    /** @see https://wicg.github.io/file-system-access/#api-showdirectorypicker */
    showDirectoryPicker(options?: {
      id?: string;
      mode?: 'read' | 'readwrite';
      startIn?: FileSystemHandle;
    }): Promise<FileSystemDirectoryHandle>;
    /** @see https://wicg.github.io/file-system-access/#api-showsavefilepicker */
    showSaveFilePicker: import('./lib/report-files.js').SaveFilePicker;
  }
}

export {};
