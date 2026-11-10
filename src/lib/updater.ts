export interface GitHubRelease {
  tag_name: string;
  name: string;
  html_url: string;
  body: string | null;
  assets: { name: string; browser_download_url: string; size: number }[];
  published_at: string | null;
}

const repository = 'Tahershawki11/Atlas-Tools';
export const releaseRepository = repository;

export async function getLatestRelease(signal?: AbortSignal): Promise<GitHubRelease | null> {
  const response = await fetch(`https://api.github.com/repos/${repository}/releases/latest`, {
    headers: { Accept: 'application/vnd.github+json' }, signal,
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`GitHub Releases returned ${response.status}`);
  return response.json() as Promise<GitHubRelease>;
}

export function normalizeVersion(value: string) {
  return value.replace(/^v/i, '').split(/[+-]/)[0].split('.').map((part) => Number.parseInt(part, 10) || 0);
}

export function isNewerRelease(remote: string, local: string) {
  const a = normalizeVersion(remote), b = normalizeVersion(local);
  for (let i = 0; i < Math.max(a.length, b.length); i++) { if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0); }
  return false;
}

export function apkAsset(release: GitHubRelease) { return release.assets.find((asset) => asset.name.toLowerCase().endsWith('.apk')) ?? null; }
