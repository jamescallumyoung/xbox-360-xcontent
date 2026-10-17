// Is a folder a partition root? (docs/lib-design.md, P1; Loadout's X5)

import { healthFromError } from './folder-health.js';
import type { FolderHealth } from './types.js';

/** Why a folder isn't a partition root (P1.2-P1.5). */
export type PartitionRootProblem = 'is-partition' | 'empty' | 'contains-content' | 'not-root';

export type PartitionRootCheck =
  { valid: true; partitions: number } | { valid: false; reason: PartitionRootProblem; names: string[] };

const PARTITION = /^[0-9A-Fa-f]{16}$/;

/**
 * Lists a folder once and checks that it holds only partitions: directories named
 * with 16 hex digits. Hidden entries are ignored, as macOS adds them (P1.1). The
 * first rule that matches decides.
 */
export async function checkPartitionRoot(
  handle: FileSystemDirectoryHandle,
  options: { allowEmpty: boolean },
): Promise<[true, PartitionRootCheck] | [false, FolderHealth]> {
  const entries: { name: string; kind: FileSystemHandleKind }[] = [];
  try {
    for await (const [name, entry] of handle.entries()) {
      if (!name.startsWith('.')) entries.push({ name, kind: entry.kind });
    }
  } catch (error) {
    return [false, healthFromError(error)];
  }
  const invalid = (reason: PartitionRootProblem, names: string[] = []): [true, PartitionRootCheck] => [
    true,
    { valid: false, reason, names },
  ];

  if (PARTITION.test(handle.name)) return invalid('is-partition');
  if (entries.length === 0) return options.allowEmpty ? [true, { valid: true, partitions: 0 }] : invalid('empty');
  if (entries.some((e) => e.kind === 'directory' && e.name.toLowerCase() === 'content')) {
    return invalid('contains-content');
  }
  const others = entries.filter((e) => e.kind !== 'directory' || !PARTITION.test(e.name)).map((e) => e.name);
  if (others.length > 0) return invalid('not-root', others.sort());
  return [true, { valid: true, partitions: entries.length }];
}
