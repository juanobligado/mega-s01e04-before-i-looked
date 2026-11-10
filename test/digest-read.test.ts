import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

describe('readNight', () => {
  it('reads 2026-10-28: 5 jobs, 1 bad line', () => {
    const night = readNight('runs', '2026-10-28');
    expect(night).not.toBeNull();
    if (!night) return;
    expect(night.rows).toHaveLength(5);
    expect(night.badLines).toBe(1);
    expect(night.rows.map((r) => r.job)).toEqual([...night.rows.map((r) => r.job)].sort());

    const byJob = (job: string) => night.rows.find((r) => r.job === job);
    expect(byJob('fixtures/refresh')).toMatchObject({
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: 'upstream 503',
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });
    expect(byJob('notes/backup')).toMatchObject({ lastStatus: 'fail', lastError: 'quota exceeded' });
    expect(byJob('digest/render')?.owner).toBeNull();
  });

  it('returns null for a missing night', () => {
    expect(readNight('runs', '1999-01-01')).toBeNull();
  });

  it('returns no rows for an empty file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
    writeFileSync(join(dir, '2026-01-01.jsonl'), '');
    expect(readNight(dir, '2026-01-01')).toEqual({ night: '2026-01-01', rows: [], badLines: 0 });
  });
});
