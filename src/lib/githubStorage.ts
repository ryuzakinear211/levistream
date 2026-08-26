/**
 * GitHub REST API Client for Serverless / Vercel Live CMS operations.
 * Bypasses EROFS (Read-only filesystem) by committing directly to the GitHub repository.
 */

const DEFAULT_OWNER = process.env.GITHUB_OWNER || 'genstava789';
const DEFAULT_REPO = process.env.GITHUB_REPO || 'filmes';
const DEFAULT_BRANCH = process.env.GITHUB_BRANCH || 'main';

export interface GitHubOptions {
  owner?: string;
  repo?: string;
  branch?: string;
  token?: string | null;
}

export function getEffectiveToken(customToken?: string | null): string | null {
  return customToken || process.env.GITHUB_TOKEN || process.env.GH_TOKEN || null;
}

/**
 * Gets a file from GitHub repository
 */
export async function getGitHubFile(filePath: string, options: GitHubOptions = {}) {
  const token = getEffectiveToken(options.token);
  if (!token) throw new Error('GitHub token is required on Vercel to access files via API');

  const owner = options.owner || DEFAULT_OWNER;
  const repo = options.repo || DEFAULT_REPO;
  const branch = options.branch || DEFAULT_BRANCH;
  const cleanPath = filePath.replace(/^\/+/, '');

  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${cleanPath}?ref=${branch}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'LeviStream-CMS',
    },
    next: { revalidate: 3600, tags: ['github-content'] },
  });

  if (!res.ok) {
    if (res.status === 404) return null;
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `GitHub API error: ${res.status}`);
  }

  const data = await res.json();
  const content = Buffer.from(data.content, 'base64').toString('utf8');

  return {
    sha: data.sha,
    content,
    path: data.path,
  };
}

/**
 * Creates or updates a file in GitHub repository
 */
export async function saveGitHubFile(
  filePath: string,
  fileContent: string,
  commitMessage: string,
  options: GitHubOptions = {}
) {
  const token = getEffectiveToken(options.token);
  if (!token) throw new Error('GitHub token is required on Vercel to save content');

  const owner = options.owner || DEFAULT_OWNER;
  const repo = options.repo || DEFAULT_REPO;
  const branch = options.branch || DEFAULT_BRANCH;
  const cleanPath = filePath.replace(/^\/+/, '');

  // 1. Get existing file SHA if it exists
  let sha: string | undefined;
  try {
    const existing = await getGitHubFile(cleanPath, options);
    if (existing) {
      sha = existing.sha;
    }
  } catch {
    // If not found or error, sha remains undefined (new file)
  }

  // 2. Put file to GitHub API
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${cleanPath}`;
  const base64Content = Buffer.from(fileContent, 'utf8').toString('base64');

  const bodyPayload: any = {
    message: commitMessage || `cms: update ${cleanPath}`,
    content: base64Content,
    branch,
  };

  if (sha) {
    bodyPayload.sha = sha;
  }

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'User-Agent': 'LeviStream-CMS',
    },
    body: JSON.stringify(bodyPayload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const errMsg = err.message || `HTTP ${res.status}`;
    throw new Error(`Gagal menyimpan ke GitHub (${errMsg}). Pastikan token memiliki izin 'repo' dan akses tulis ke '${owner}/${repo}' branch '${branch}'.`);
  }

  return await res.json();
}

/**
 * Deletes a file in GitHub repository
 */
export async function deleteGitHubFile(
  filePath: string,
  commitMessage: string,
  options: GitHubOptions = {}
) {
  const token = getEffectiveToken(options.token);
  if (!token) throw new Error('GitHub token is required on Vercel to delete content');

  const owner = options.owner || DEFAULT_OWNER;
  const repo = options.repo || DEFAULT_REPO;
  const branch = options.branch || DEFAULT_BRANCH;
  const cleanPath = filePath.replace(/^\/+/, '');

  // 1. Get file SHA
  const existing = await getGitHubFile(cleanPath, options);
  if (!existing) {
    throw new Error(`File ${cleanPath} tidak ditemukan di repositori GitHub '${owner}/${repo}'`);
  }

  // 2. Delete file via GitHub API
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${cleanPath}`;

  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'User-Agent': 'LeviStream-CMS',
    },
    body: JSON.stringify({
      message: commitMessage || `cms: delete ${cleanPath}`,
      sha: existing.sha,
      branch,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const errMsg = err.message || `HTTP ${res.status}`;
    throw new Error(`Gagal menghapus di GitHub (${errMsg}). Pastikan token memiliki izin 'repo' dan akses tulis ke '${owner}/${repo}' branch '${branch}'.`);
  }

  return await res.json();
}

/**
 * Reads a raw text/markdown file from GitHub directly with live cache busting.
 * Works seamlessly on Vercel runtime to load latest CMS edits immediately.
 */
export async function getGitHubRawFile(filePath: string, options: GitHubOptions = {}): Promise<string | null> {
  const cleanPath = filePath.replace(/^\/+/, '');
  const owner = options.owner || DEFAULT_OWNER;
  const repo = options.repo || DEFAULT_REPO;
  const branch = options.branch || DEFAULT_BRANCH;
  const token = getEffectiveToken(options.token);

  // 1. Primary: Use GitHub REST API with Accept: application/vnd.github.v3.raw (Bypasses Fastly CDN cache completely)
  try {
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${cleanPath}?ref=${branch}`;
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3.raw',
      'User-Agent': 'LeviStream-CMS',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(apiUrl, {
      headers,
      next: { revalidate: 3600, tags: ['github-content'] },
    });
    if (res.ok) {
      const text = await res.text();
      if (text && text.includes('---')) {
        return text;
      }
    }
  } catch {}

  // 2. Secondary Fallback: public GitHub raw URL with timestamp cache buster
  try {
    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${cleanPath}`;
    const res = await fetch(rawUrl, {
      next: { revalidate: 3600, tags: ['github-content'] },
    });
    if (res.ok) {
      const text = await res.text();
      if (text && text.includes('---')) {
        return text;
      }
    }
  } catch {}

  return null;
}

/**
 * Lists all files in a directory on GitHub repository
 */
export async function listGitHubDir(dirPath: string, options: GitHubOptions = {}): Promise<string[]> {
  const cleanPath = dirPath.replace(/^\/+/, '');
  const owner = options.owner || DEFAULT_OWNER;
  const repo = options.repo || DEFAULT_REPO;
  const branch = options.branch || DEFAULT_BRANCH;
  const token = getEffectiveToken(options.token);

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'LeviStream-CMS',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${cleanPath}?ref=${branch}`;
    const res = await fetch(url, { headers, next: { revalidate: 3600, tags: ['github-content'] } });
    if (res.ok) {
      const items = await res.json();
      if (Array.isArray(items)) {
        return items.map((item: any) => item.name);
      }
    }
  } catch {}

  return [];
}

export interface GitHubTreeItem {
  path: string;
  mode: string;
  type: 'blob' | 'tree';
  sha: string;
  size?: number;
  url: string;
}

/**
 * Gets full repository tree (all files and directories) recursively in a single fast API call.
 */
export async function getGitHubTree(options: GitHubOptions = {}): Promise<GitHubTreeItem[]> {
  const owner = options.owner || DEFAULT_OWNER;
  const repo = options.repo || DEFAULT_REPO;
  const branch = options.branch || DEFAULT_BRANCH;
  const token = getEffectiveToken(options.token);

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'LeviStream-CMS',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
    const res = await fetch(url, { headers, next: { revalidate: 3600, tags: ['github-content'] } });
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.tree)) {
        return data.tree as GitHubTreeItem[];
      }
    }
  } catch (err) {
    console.warn('getGitHubTree notice:', err);
  }

  return [];
}

/**
 * Reads a git blob by its SHA directly from GitHub API.
 */
export async function getGitHubBlob(sha: string, options: GitHubOptions = {}): Promise<string | null> {
  const owner = options.owner || DEFAULT_OWNER;
  const repo = options.repo || DEFAULT_REPO;
  const token = getEffectiveToken(options.token);

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3.raw',
    'User-Agent': 'LeviStream-CMS',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/git/blobs/${sha}`;
    const res = await fetch(url, { headers, next: { revalidate: 3600, tags: ['github-content'] } });
    if (res.ok) {
      return await res.text();
    }
  } catch {}

  return null;
}

