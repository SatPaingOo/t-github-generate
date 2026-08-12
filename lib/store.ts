/**
 * GitHub-backed file store (the "database").
 *
 *   data/codes.json         — valid single-use codes (owner maintains)
 *   data/generations.csv    — append-only generation log
 *
 * Files live IN the repo (t-github-generate) and are read/written through the
 * GitHub Contents API — so it works on Vercel serverless (no writable
 * filesystem) and is persistent across instances. All writes are commits.
 *
 * NOTE: read-modify-write has no atomic locking — fine for a demo scale.
 */

import type { CodeRecord, GenerationRecord, GenerationStatus } from './types';
import { readRepoFile, writeRepoFile } from './github';

const CODES_PATH = 'data/codes.json';
const CSV_PATH = 'data/generations.csv';

const CSV_HEADER =
  'id,createdAt,email,appName,slug,platform,code,repoUrl,repoName,status,releaseUrl,updatedAt\n';

function escapeCsv(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function parseCsv(text: string): GenerationRecord[] {
  const lines = text.split('\n').filter(Boolean);
  if (lines.length <= 1) return [];
  return lines.slice(1).map(line => {
    const cells = line.split(',');
    return {
      id: cells[0],
      createdAt: cells[1],
      email: cells[2],
      appName: cells[3],
      slug: cells[4],
      platform: cells[5] as GenerationRecord['platform'],
      code: cells[6],
      repoUrl: cells[7],
      repoName: cells[8],
      status: cells[9] as GenerationStatus,
      releaseUrl: cells[10] || undefined,
      updatedAt: cells[11],
    };
  });
}

/* ---------------- codes ---------------- */

export async function listCodes(): Promise<CodeRecord[]> {
  const file = await readRepoFile(CODES_PATH);
  if (!file) return [];
  try {
    return JSON.parse(file.content) as CodeRecord[];
  } catch {
    return [];
  }
}

export async function saveCodes(codes: CodeRecord[]): Promise<void> {
  await writeRepoFile(
    CODES_PATH,
    JSON.stringify(codes, null, 2) + '\n',
    'chore: update codes.json [skip ci]',
  );
}

/**
 * Consume a code if it is valid (exists, has uses left). Returns the record,
 * or null when invalid/already used up.
 */
export async function consumeCode(code: string): Promise<CodeRecord | null> {
  const codes = await listCodes();
  const rec = codes.find(c => c.code === code);
  if (!rec || rec.used >= rec.maxUses) return null;
  rec.used += 1;
  await saveCodes(codes);
  return rec;
}

/* ---------------- generations.csv ---------------- */

export async function appendGeneration(rec: GenerationRecord): Promise<void> {
  const line = [
    rec.id,
    rec.createdAt,
    rec.email,
    rec.appName,
    rec.slug,
    rec.platform,
    rec.code,
    rec.repoUrl,
    rec.repoName,
    rec.status,
    rec.releaseUrl ?? '',
    rec.updatedAt,
  ]
    .map(escapeCsv)
    .join(',') + '\n';

  const existing = await readRepoFile(CSV_PATH);
  const content = existing ? existing.content + line : CSV_HEADER + line;
  await writeRepoFile(CSV_PATH, content, 'chore: log generation [skip ci]');
}

export async function listGenerations(): Promise<GenerationRecord[]> {
  const file = await readRepoFile(CSV_PATH);
  if (!file) return [];
  return parseCsv(file.content);
}

export async function updateGenerationStatus(
  id: string,
  status: GenerationStatus,
  releaseUrl?: string,
): Promise<void> {
  const file = await readRepoFile(CSV_PATH);
  if (!file) return;
  const lines = file.content.split('\n');
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].startsWith(`${id},`)) {
      const cells = lines[i].split(',');
      cells[9] = status;
      cells[10] = releaseUrl ?? '';
      cells[11] = new Date().toISOString();
      lines[i] = cells.join(',');
    }
  }
  await writeRepoFile(CSV_PATH, lines.join('\n'), 'chore: update generation status [skip ci]');
}

export function idGen(prefix = 'gen'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
