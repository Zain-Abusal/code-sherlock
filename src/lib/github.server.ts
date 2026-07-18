// Server-only helpers for reading a public GitHub repository.

export interface RepoMeta {
  full_name: string;
  description: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  default_branch: string;
  language: string | null;
  license: { spdx_id: string | null } | null;
  pushed_at: string;
  created_at: string;
  html_url: string;
  owner: { login: string; avatar_url: string };
  private?: boolean;
  visibility?: string;
}

export interface TreeEntry {
  path: string;
  type: "blob" | "tree";
  size?: number;
}

export function parseRepoUrl(url: string): { owner: string; repo: string } | null {
  try {
    const clean = url.trim().replace(/\.git$/, "");
    const m = clean.match(
      /(?:github\.com[/:])([^/\s]+)\/([^/\s?#]+)/i,
    );
    if (m) return { owner: m[1], repo: m[2] };
    const parts = clean.split("/").filter(Boolean);
    if (parts.length === 2) return { owner: parts[0], repo: parts[1] };
    return null;
  } catch {
    return null;
  }
}

function ghHeaders(token?: string): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "CodeSherlock",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

export async function fetchRepoMeta(
  owner: string,
  repo: string,
  token?: string,
): Promise<RepoMeta> {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: ghHeaders(token),
  });
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(
        token
          ? "Repository not found. If it's private, make sure your GitHub token has the `repo` scope and access to this repository."
          : "Repository not found or private. Add a GitHub Personal Access Token (top-right settings → GitHub token) with `repo` scope to analyze private repositories.",
      );
    }
    if (res.status === 401) {
      throw new Error("GitHub rejected the token (401). Generate a new PAT with `repo` scope.");
    }
    if (res.status === 403) {
      throw new Error(
        "GitHub 403 — token missing scope or rate-limited. For private repos ensure `repo` scope; for public retry in a minute.",
      );
    }
    throw new Error(`GitHub ${res.status}: could not fetch repository metadata.`);
  }
  return (await res.json()) as RepoMeta;
}

export async function fetchLanguages(
  owner: string,
  repo: string,
  token?: string,
): Promise<Record<string, number>> {
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/languages`,
    { headers: ghHeaders(token) },
  );
  if (!res.ok) return {};
  return (await res.json()) as Record<string, number>;
}

export async function fetchTree(
  owner: string,
  repo: string,
  branch: string,
  token?: string,
): Promise<{ tree: TreeEntry[]; truncated: boolean }> {
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
    { headers: ghHeaders(token) },
  );
  if (!res.ok) return { tree: [], truncated: false };
  const data = (await res.json()) as {
    tree: TreeEntry[];
    truncated: boolean;
  };
  return { tree: data.tree ?? [], truncated: !!data.truncated };
}

export async function fetchFileText(
  owner: string,
  repo: string,
  path: string,
  branch: string,
  token?: string,
  maxBytes = 20_000,
): Promise<string | null> {
  const res = await fetch(
    `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} },
  );
  if (!res.ok) return null;
  const text = await res.text();
  return text.length > maxBytes ? text.slice(0, maxBytes) : text;
}