import { Octokit } from "@octokit/rest";
import { config, TRACKED_FEATURES } from "./config.js";
import type { GitHubItem, TrackedFeature } from "./types.js";

const octokit = new Octokit({ auth: config.github.token });

export async function fetchLatestReleases(): Promise<GitHubItem[]> {
  const { data } = await octokit.repos.listReleases({
    owner: config.github.owner,
    repo: config.github.repo,
    per_page: config.bot.maxReleasesToFetch,
  });
  return data.map(normalizeRelease);
}

export async function fetchRecentMergedPRs(): Promise<GitHubItem[]> {
  const { data } = await octokit.pulls.list({
    owner: config.github.owner,
    repo: config.github.repo,
    state: "closed",
    sort: "updated",
    direction: "desc",
    per_page: config.bot.maxPRsToFetch,
  });
  return data.filter((pr) => pr.merged_at).map(normalizePR);
}

export async function fetchAIPContent(aipPath: string, owner?: string): Promise<string | null> {
  try {
    const { data } = await octokit.repos.getContent({
      owner: owner || config.github.aipOwner,
      repo: config.github.aipRepo,
      path: aipPath,
    });
    if ("content" in data) {
      return Buffer.from(data.content, "base64").toString("utf-8");
    }
    return null;
  } catch {
    return null;
  }
}

export function parseAIPStatus(content: string): { status: string; title: string } {
  const statusMatch = content.match(/[Ss]tatus:\s*(.+)/);
  const titleMatch = content.match(/[Tt]itle:\s*(.+)/);
  return {
    status: statusMatch?.[1]?.trim() || "Unknown",
    title: titleMatch?.[1]?.trim() || "Unknown",
  };
}

export async function fetchPRDetails(prNumber: number): Promise<{
  files: string[];
  reviewers: string[];
  commits: number;
}> {
  try {
    const [filesRes, prRes] = await Promise.all([
      octokit.pulls.listFiles({
        owner: config.github.owner,
        repo: config.github.repo,
        pull_number: prNumber,
        per_page: 30,
      }),
      octokit.pulls.get({
        owner: config.github.owner,
        repo: config.github.repo,
        pull_number: prNumber,
      }),
    ]);

    return {
      files: filesRes.data.map((f) => f.filename),
      reviewers: prRes.data.requested_reviewers?.map((r: any) => r.login) || [],
      commits: prRes.data.commits,
    };
  } catch {
    return { files: [], reviewers: [], commits: 0 };
  }
}

export async function searchRepoForFeature(feature: TrackedFeature): Promise<GitHubItem[]> {
  try {
    const query = `repo:${config.github.owner}/${config.github.repo} ${feature.keywords[0]} is:pr is:merged`;
    const { data } = await octokit.search.issuesAndPullRequests({
      q: query,
      sort: "updated",
      order: "desc",
      per_page: 5,
    });
    return data.items.map((item) => ({
      id: item.id,
      title: item.title,
      body: item.body || "",
      html_url: item.html_url,
      url: item.url,
      created_at: item.created_at,
      user: item.user ? { login: item.user.login } : undefined,
      labels: item.labels?.map((l: any) => ({ name: typeof l === "string" ? l : l.name })),
    }));
  } catch {
    return [];
  }
}

export function detectRelatedFeatures(text: string): TrackedFeature[] {
  const lowerText = text.toLowerCase();
  return TRACKED_FEATURES.filter((f) =>
    f.keywords.some((kw) => lowerText.includes(kw.toLowerCase()))
  );
}

function normalizeRelease(release: any): GitHubItem {
  return {
    id: release.id,
    tag_name: release.tag_name,
    title: release.name || release.tag_name,
    body: release.body || "",
    html_url: release.html_url,
    url: release.url,
    created_at: release.created_at,
    user: release.author ? { login: release.author.login } : undefined,
  };
}

function normalizePR(pr: any): GitHubItem {
  return {
    id: pr.id,
    title: pr.title,
    body: pr.body || "",
    html_url: pr.html_url,
    url: pr.url,
    created_at: pr.created_at,
    merged_at: pr.merged_at,
    user: pr.user ? { login: pr.user.login } : undefined,
    labels: pr.labels?.map((l: any) => ({ name: l.name })),
  };
}
