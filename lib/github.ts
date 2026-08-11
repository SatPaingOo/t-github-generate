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

/** Template repo per platform. */
export const TEMPLATE_REPOS: Record<string, string> = {
  android: 't-github-gen-mobile-app',
  ios: 't-github-gen-mobile-app',
  windows: 't-github-gen-electron-app',
  macos: 't-github-gen-electron-app',
};

/**
 * Create a new repo from a template repo (POST /repos/{owner}/{template}/generate).
 * Returns the new repo's full_name (e.g. "SatPaingOo/app-my-app-abc1").
 */
export async function createRepoFromTemplate(
  templateRepo: string,
  newRepoName: string,
): Promise<string> {
  const gh = getOctokit();
  const res = await gh.repos.createUsingTemplate({
    owner: GITHUB_OWNER,
    template_owner: GITHUB_OWNER,
    template_repo: templateRepo,
    name: newRepoName,
    private: false, // public → free Actions minutes for the generated build
    include_all_branches: false,
  });
  return res.data.full_name ?? `${GITHUB_OWNER}/${newRepoName}`;
}

/** Wait until the new repo's main branch exists (template copy is async). */
async function waitForBranch(owner: string, repo: string, timeoutMs = 60_000): Promise<void> {
  const gh = getOctokit();
  const start = Date.now();
  for (;;) {
    try {
      const res = await gh.git.getRef({ owner, repo, ref: 'heads/main' });
      if (res.status === 200) return;
    } catch {
      // not ready yet
    }
    if (Date.now() - start > timeoutMs) throw new Error('Timed out waiting for the new repo to be ready.');
    await new Promise(r => setTimeout(r, 2000));
  }
}

/** Build the app.config.json pushed into the generated repo. */
export function buildAppConfig(input: {
  appName: string;
  slug: string;
  theme: string;
  primaryColor: string;
  supportEmail: string;
  platform: string;
  packageName: string;
  version: string;
  jsName: string;
}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    appName: input.appName,
    slug: input.slug,
    theme: input.theme,
    primaryColor: input.primaryColor,
    logoUrl: 'assets/logo.png',
    supportEmail: input.supportEmail,
    platforms: [input.platform],
    packageName: input.packageName,
    version: input.version,
    // internal (used by RN generate script for the component/Gradle project name)
    _jsName: input.jsName,
  };
}

/** Push app.config.json (+ logo) to the generated repo using the git tree API. */
export async function pushConfigAndLogo(params: {
  owner: string;
  repo: string;
  appConfig: Record<string, unknown>;
  logoBytes: Buffer | null;
}): Promise<void> {
  const gh = getOctokit();
  const { owner, repo, appConfig, logoBytes } = params;

  // resolve the current head commit
  const ref = await gh.git.getRef({ owner, repo, ref: 'heads/main' });
  const baseCommit = ref.data.object.sha;

  const treeItems: { path: string; mode: '100644'; type: 'blob'; content?: string; sha?: string }[] = [
    {
      path: 'app.config.json',
      mode: '100644',
      type: 'blob',
      content: JSON.stringify(appConfig, null, 2) + '\n',
    },
  ];

  if (logoBytes) {
    // create a blob for the logo bytes
    const blob = await gh.git.createBlob({ owner, repo, content: logoBytes.toString('base64'), encoding: 'base64' });
    treeItems.push({
      path: 'assets/logo.png',
      mode: '100644',
      type: 'blob',
      sha: blob.data.sha,
    });
  }

  const tree = await gh.git.createTree({
    owner,
    repo,
    base_tree: baseCommit,
    tree: treeItems,
  });

  const commit = await gh.git.createCommit({
    owner,
    repo,
    message: 'chore: apply app config from TGen website [skip ci]',
    tree: tree.data.sha,
    parents: [baseCommit],
  });

  await gh.git.updateRef({ owner, repo, ref: 'heads/main', sha: commit.data.sha });
}

export async function createGeneratedRepo(input: {
  repoName: string;
  templateRepo: string;
  appConfig: Record<string, unknown>;
  logoBytes: Buffer | null;
}): Promise<{ fullName: string; owner: string; repo: string }> {
  const fullName = await createRepoFromTemplate(input.templateRepo, input.repoName);
  const [owner, repo] = fullName.split('/');
  await waitForBranch(owner, repo);
  await pushConfigAndLogo({ owner, repo, appConfig: input.appConfig, logoBytes: input.logoBytes });
  return { fullName, owner, repo };
}
