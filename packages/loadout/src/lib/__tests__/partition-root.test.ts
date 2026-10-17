import { describe, expect, it } from 'vitest';
import { checkPartitionRoot } from '../partition-root.js';
import { folder, pulled } from './helpers/drive.js';

const PUBLIC = '0000000000000000';
const PROFILE = 'E812CECF9EA2AF5F';

describe('checkPartitionRoot', () => {
  it('is valid with partitions and nothing else, counting them (P1.6)', async () => {
    const f = folder({ [`${PUBLIC}/`]: null, [`${PROFILE.toLowerCase()}/`]: null });
    expect(await checkPartitionRoot(f.handle, { allowEmpty: false })).toEqual([true, { valid: true, partitions: 2 }]);
  });

  it('ignores hidden entries (P1.1)', async () => {
    const f = folder({ [`${PUBLIC}/`]: null, [`._${PUBLIC}`]: 'x', '.DS_Store': 'x', '.Trashes/': null });
    expect(await checkPartitionRoot(f.handle, { allowEmpty: false })).toEqual([true, { valid: true, partitions: 1 }]);
  });

  it('rejects a partition chosen by mistake (P1.2)', async () => {
    const f = folder({ '4D5307E6/': null }, { name: PUBLIC });
    expect(await checkPartitionRoot(f.handle, { allowEmpty: true })).toEqual([
      true,
      { valid: false, reason: 'is-partition', names: [] },
    ]);
  });

  it('accepts an empty folder only with allowEmpty (P1.3)', async () => {
    const f = folder({ '.DS_Store': 'x' });
    expect(await checkPartitionRoot(f.handle, { allowEmpty: true })).toEqual([true, { valid: true, partitions: 0 }]);
    expect(await checkPartitionRoot(f.handle, { allowEmpty: false })).toEqual([
      true,
      { valid: false, reason: 'empty', names: [] },
    ]);
  });

  it('rejects the folder above a Content folder (P1.4)', async () => {
    const f = folder({ 'content/': null, 'Games/': null }, { name: 'USB' });
    expect(await checkPartitionRoot(f.handle, { allowEmpty: true })).toEqual([
      true,
      { valid: false, reason: 'contains-content', names: [] },
    ]);
  });

  it('rejects other entries, listing them sorted (P1.5)', async () => {
    const f = folder({ [`${PUBLIC}/`]: null, 'notes.txt': 'x', 'Games/': null, '0000/': null });
    expect(await checkPartitionRoot(f.handle, { allowEmpty: false })).toEqual([
      true,
      { valid: false, reason: 'not-root', names: ['0000', 'Games', 'notes.txt'] },
    ]);
  });

  it('rejects a file named like a partition (P1.5)', async () => {
    const f = folder({ [PUBLIC]: 'x' });
    expect(await checkPartitionRoot(f.handle, { allowEmpty: false })).toEqual([
      true,
      { valid: false, reason: 'not-root', names: [PUBLIC] },
    ]);
  });

  it('reports a folder it cannot read as its health (P1.7)', async () => {
    const [ok, health] = await checkPartitionRoot(pulled(folder().handle), { allowEmpty: true });
    expect(ok).toBe(false);
    expect(health).toMatchObject({ state: 'disconnected' });
  });
});
