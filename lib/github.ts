/** GitHub API client (server-side only). Token lives in env, never in the browser. */

import { Octokit } from '@octokit/rest';

let octokit: Octokit | null = null;

export function getOctokit(): Octokit {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN is not configured on the server.');
  if (!octokit) octokit = new Octokit({ auth: token });
  return octokit;
}

export const GITHUB_OWNER = process.env.GITHUB_OWNER ?? 'SatPaingOo';

/** The repo that hosts the website AND the exported artifacts. */
export const WEBSITE_REPO = 't-github-generate';
export const EXPORT_WORKFLOW = 'build-export.yml';

/** Read a file from the website repo (data/*) via the Contents API. */
export async function readRepoFile(
  path: string,
): Promise<{ content: string; sha: string } | null> {
  const gh = getOctokit();
  try {
    const res = await gh.repos.getContent({
      owner: GITHUB_OWNER,
      repo: WEBSITE_REPO,
      path,
    });
    if ('content' in res.data && typeof res.data.content === 'string') {
      return {
        content: Buffer.from(res.data.content, 'base64').toString('utf8'),
        sha: res.data.sha,
      };
    }
    return null;
  } catch (err) {
    if ((err as { status?: number }).status === 404) return null;
    throw err;
  }
}

/** Write (create or update) a file in the website repo via the Contents API. */
export async function writeRepoFile(
  path: string,
  content: string,
  message: string,
): Promise<void> {
  const gh = getOctokit();
  // Contents API writes need the file's current sha — concurrent writers
  // (parallel generations updating otps/limits) can move the file between our
  // read and write, returning 409. Re-read and retry a few times instead of
  // failing the whole request.
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const existing = await readRepoFile(path);
      await gh.repos.createOrUpdateFileContents({
        owner: GITHUB_OWNER,
        repo: WEBSITE_REPO,
        path,
        message,
        content: Buffer.from(content, 'utf8').toString('base64'),
        sha: existing?.sha,
      });
      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isConflict = /409|is not up to date|does not match/i.test(msg);
      if (!isConflict || attempt === 4) throw err;
      await new Promise(r => setTimeout(r, 600 * attempt));
    }
  }
}

export function exportDirUrl(platform: string, slug: string): string {
  return `https://github.com/${GITHUB_OWNER}/${WEBSITE_REPO}/tree/main/public/exports/${platform}/${slug}`;
}

export function exportRawUrl(platform: string, slug: string, filename: string): string {
  return `https://raw.githubusercontent.com/${GITHUB_OWNER}/${WEBSITE_REPO}/main/public/exports/${platform}/${slug}/${filename}`;
}

/**
 * Trigger the build-export workflow on the website repo.
 * The workflow clones the template, builds the app and commits the artifact
 * into public/exports/{platform}/{slug}/ — no separate per-app repo.
 */
export async function triggerExportBuild(input: {
  platform: string;
  appName: string;
  slug: string;
  theme: string;
  primaryColor: string;
  secondaryColor: string;
  supportEmail: string;
  packageName: string;
  version: string;
}): Promise<void> {
  const gh = getOctokit();
  await gh.rest.actions.createWorkflowDispatch({
    owner: GITHUB_OWNER,
    repo: WEBSITE_REPO,
    workflow_id: EXPORT_WORKFLOW,
    ref: 'main',
    inputs: {
      platform: input.platform,
      appName: input.appName,
      slug: input.slug,
      theme: input.theme,
      primaryColor: input.primaryColor,
      secondaryColor: input.secondaryColor,
      supportEmail: input.supportEmail,
      packageName: input.packageName,
      version: input.version,
    },
  });
}

/** Push the uploaded logo into the repo so the export workflow can pick it up. */
export async function uploadExportLogo(slug: string, logoBytes: Buffer): Promise<void> {
  const gh = getOctokit();
  const { owner, repo } = { owner: GITHUB_OWNER, repo: WEBSITE_REPO };

  const blob = await gh.git.createBlob({
    owner,
    repo,
    content: logoBytes.toString('base64'),
    encoding: 'base64',
  });

  // The tree-based commit races with other writers: the export workflow
  // (artifact + status commits) and concurrent generations. If main moves
  // between our getRef and updateRef, GitHub rejects with "Update is not a
  // fast forward" — retry from the latest head instead of failing the build.
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const ref = await gh.git.getRef({ owner, repo, ref: 'heads/main' });
      const baseCommit = ref.data.object.sha;

      const tree = await gh.git.createTree({
        owner,
        repo,
        base_tree: baseCommit,
        tree: [{ path: `public/inputs/${slug}/logo.png`, mode: '100644', type: 'blob', sha: blob.data.sha }],
      });

      const commit = await gh.git.createCommit({
        owner,
        repo,
        message: 'chore: stage logo for export [skip ci]',
        tree: tree.data.sha,
        parents: [baseCommit],
      });

      await gh.git.updateRef({ owner, repo, ref: 'heads/main', sha: commit.data.sha });
      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isRace = /not a fast[- ]forward|409/i.test(msg);
      if (!isRace || attempt === 4) throw err;
      await new Promise(r => setTimeout(r, 800 * attempt)); // backoff then re-read head
    }
  }
}

/**
 * Real Actions minutes used by the OWNER's whole account (current billing
 * cycle) from GitHub's billing API. Free-tier accounts include 2000 min —
 * used only by PRIVATE repos (public repo runs are free, so builds here
 * don't normally consume it). Requires GITHUB_BILLING_TOKEN (a classic PAT
 * from the owner account — fine-grained repo tokens can't read billing).
 * Returns null when the token isn't configured or the call fails, so the
 * website falls back to its own build counter instead of blocking.
 */
export interface ActionsBilling {
  includedMinutes: number;
  usedMinutes: number;
  remainingMinutes: number;
}

export async function getActionsBilling(): Promise<ActionsBilling | null> {
  const token = process.env.GITHUB_BILLING_TOKEN;
  if (!token) return null;
  try {
    const res = await fetch(
      `https://api.github.com/users/${GITHUB_OWNER}/settings/billing/actions`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        cache: 'no-store',
      },
    );
    if (!res.ok) return null;
    const d = (await res.json()) as { included_minutes?: number; total_minutes_used?: number };
    const included = d.included_minutes ?? 0;
    const used = d.total_minutes_used ?? 0;
    return {
      includedMinutes: included,
      usedMinutes: used,
      remainingMinutes: Math.max(0, included - used),
    };
  } catch {
    return null; // fail open — the build counter still protects the budget
  }
}
