// Plan morning-digest § 1. Reads runs/<night>.jsonl into one row per job.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, ReadNight, RunLine, RunStatus } from './types.js';

const STATUSES: readonly string[] = ['ok', 'retry', 'fail'] satisfies RunStatus[];

// A parsed line; owner is undefined when the line omits it.
type Parsed = Omit<RunLine, 'owner'> & { owner: string | null | undefined };

function parseLine(text: string): Parsed | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.at !== 'string' || typeof v.job !== 'string') return null;
  if (typeof v.status !== 'string' || !STATUSES.includes(v.status)) return null;
  const line: Parsed = {
    at: v.at,
    job: v.job,
    status: v.status as RunStatus,
    owner: typeof v.owner === 'string' || v.owner === null ? v.owner : undefined,
  };
  if (typeof v.error === 'string') line.error = v.error;
  return line;
}

export const readNight: ReadNight = (runsDir, night) => {
  const path = join(runsDir, `${night}.jsonl`);
  if (!existsSync(path)) return null;

  const byJob = new Map<string, DigestRow>();
  let badLines = 0;

  for (const raw of readFileSync(path, 'utf8').split('\n')) {
    if (raw.trim() === '') continue;
    const line = parseLine(raw);
    if (!line) {
      badLines++;
      continue;
    }
    const row = byJob.get(line.job);
    if (!row) {
      byJob.set(line.job, {
        job: line.job,
        owner: line.owner ?? null,
        runs: 1,
        retries: line.status === 'retry' ? 1 : 0,
        lastStatus: line.status,
        lastError: line.error ?? null,
        firstAt: line.at,
        lastAt: line.at,
      });
      continue;
    }
    row.runs++;
    if (line.status === 'retry') row.retries++;
    row.lastStatus = line.status;
    row.lastAt = line.at;
    if (line.error !== undefined) row.lastError = line.error;
    if (line.owner !== undefined) row.owner = line.owner;
  }

  const rows = [...byJob.values()].sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));
  return { night, rows, badLines };
};
