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
  const existing = await readRepoFile(path);
  await gh.repos.createOrUpdateFileContents({
    owner: GITHUB_OWNER,
    repo: WEBSITE_REPO,
    path,
    message,
    content: Buffer.from(content, 'utf8').toString('base64'),
    sha: existing?.sha,
  });
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

  const ref = await gh.git.getRef({ owner, repo, ref: 'heads/main' });
  const baseCommit = ref.data.object.sha;

  const blob = await gh.git.createBlob({
    owner,
    repo,
    content: logoBytes.toString('base64'),
    encoding: 'base64',
  });

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
}
