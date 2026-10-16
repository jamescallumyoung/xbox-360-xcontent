// What TypeScript's "dom" lib still lacks of the APIs this package uses.
//
// Keep this file small: the browser's own types come from the "dom" lib. Only
// add a declaration here when "dom" doesn't have it yet, and remove it once it
// does.

declare global {
  interface FileSystemHandle {
    /**
     * Says whether the page has permission to use this handle in the given mode.
     * Part of the WICG File System Access draft, which "dom" doesn't include yet.
     *
     * @see https://wicg.github.io/file-system-access/#api-filesystemhandle-querypermission
     */
    queryPermission(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>;
  }
}

export {};
