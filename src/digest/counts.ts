import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export type Counts = { ok: number; retry: number; fail: number };

// Lines per status over runs/<night>.jsonl; unparsable lines are skipped.
export function countStatuses(runsDir: string, night: string): Counts {
  const counts: Counts = { ok: 0, retry: 0, fail: 0 };
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch {
    return counts;
  }
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try {
      const s = (JSON.parse(line) as { status?: unknown }).status;
      if (s === 'ok' || s === 'retry' || s === 'fail') counts[s]++;
    } catch {
      // bad line: skipped
    }
  }
  return counts;
}
