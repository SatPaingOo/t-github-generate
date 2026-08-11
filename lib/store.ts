/**
 * JSON/CSV file store (the "database").
 *
 *   data/codes.json         — valid single-use codes (owner maintains)
 *   data/generations.csv    — append-only generation log (notifier polls it)
 *
 * Files live in the repo and are committed so the notifier workflow can read
 * them from the same branch. Writes are synchronous + atomic (tmp + rename).
 */

import fs from 'node:fs';
import path from 'node:path';
import type { CodeRecord, GenerationRecord, GenerationStatus } from './types';

const DATA_DIR = path.join(process.cwd(), 'data');

function dataPath(name: string): string {
  const p = path.join(DATA_DIR, name);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  return p;
}

function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

function writeAtomic(file: string, content: string): void {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, content, 'utf8');
  fs.renameSync(tmp, file);
}

/* ---------------- codes ---------------- */

export function listCodes(): CodeRecord[] {
  return readJson<CodeRecord[]>(dataPath('codes.json'), []);
}

export function saveCodes(codes: CodeRecord[]): void {
  writeAtomic(dataPath('codes.json'), JSON.stringify(codes, null, 2) + '\n');
}

/**
 * Consume a code if it is valid (exists, has uses left). Returns the record,
 * or null when invalid/already used up.
 */
export function consumeCode(code: string): CodeRecord | null {
  const codes = listCodes();
  const rec = codes.find(c => c.code === code);
  if (!rec || rec.used >= rec.maxUses) return null;
  rec.used += 1;
  saveCodes(codes);
  return rec;
}

/* ---------------- generations.csv ---------------- */

const CSV_HEADER =
  'id,createdAt,email,appName,slug,platform,code,repoUrl,repoName,status,releaseUrl,updatedAt\n';

function escapeCsv(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function appendGeneration(rec: GenerationRecord): void {
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

  const file = dataPath('generations.csv');
  if (!fs.existsSync(file)) fs.writeFileSync(file, CSV_HEADER, 'utf8');
  fs.appendFileSync(file, line, 'utf8');
}

export function listGenerations(): GenerationRecord[] {
  const file = dataPath('generations.csv');
  if (!fs.existsSync(file)) return [];
  const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
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

export function updateGenerationStatus(id: string, status: GenerationStatus, releaseUrl?: string): void {
  const file = dataPath('generations.csv');
  if (!fs.existsSync(file)) return;
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const header = lines[0];
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].startsWith(`${id},`)) {
      const cells = lines[i].split(',');
      cells[9] = status;
      cells[10] = releaseUrl ?? '';
      cells[11] = new Date().toISOString();
      lines[i] = cells.join(',');
    }
  }
  writeAtomic(file, lines.join('\n'));
}

export function idGen(prefix = 'gen'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
