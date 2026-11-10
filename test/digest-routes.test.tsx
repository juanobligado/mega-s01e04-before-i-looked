import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/app.js';

const GOOD = '2026-10-28';
const EMPTY = '2026-01-01';
const BAD = '2026-01-02';
const MISSING = '2026-01-03';

let dir: string;
let app: ReturnType<typeof createApp>;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
  writeFileSync(join(dir, `${GOOD}.jsonl`), readFileSync(join('runs', `${GOOD}.jsonl`), 'utf8'));
  writeFileSync(join(dir, `${EMPTY}.jsonl`), '');
  writeFileSync(
    join(dir, `${BAD}.jsonl`),
    [
      '{"at":"2026-01-02T01:00:00+01:00","job":"a/one","status":"ok","owner":"rook"}',
      'this is not json',
      '{"at":"2026-01-02T02:00:00+01:00","job":"b/two","status":"fail","error":"boom"}',
      '',
    ].join('\n'),
  );
  app = createApp({ adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: dir });
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

const pageJobs = (html: string) =>
  [...html.matchAll(/<tr[^>]*>\s*<td>([^<]*)<\/td>/g)].map((m) => m[1]);

describe.each([
  ['page', '/digest/'],
  ['json', '/api/digest/'],
])('%s', (kind, prefix) => {
  it('200 for an existing night', async () => {
    expect((await app.request(prefix + GOOD)).status).toBe(200);
  });

  it('404 for a night with no file', async () => {
    expect((await app.request(prefix + MISSING)).status).toBe(404);
  });

  it('empty night', async () => {
    const res = await app.request(prefix + EMPTY);
    expect(res.status).toBe(200);
    if (kind === 'page') expect(await res.text()).toContain('nothing ran');
    else expect(((await res.json()) as { rows: unknown[] }).rows).toEqual([]);
  });

  it('bad line night still answers', async () => {
    const res = await app.request(prefix + BAD);
    expect(res.status).toBe(200);
    if (kind === 'page') expect(await res.text()).toContain('did not parse');
    else expect(((await res.json()) as { badLines: number }).badLines).toBe(1);
  });
});

it('page and JSON list the same jobs in the same order', async () => {
  const html = await (await app.request(`/digest/${GOOD}`)).text();
  const json = (await (await app.request(`/api/digest/${GOOD}`)).json()) as { rows: { job: string }[] };
  expect(json.rows.length).toBeGreaterThan(0);
  expect(pageJobs(html)).toEqual(json.rows.map((r) => r.job));
});
