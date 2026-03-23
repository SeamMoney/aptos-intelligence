export interface WebReport {
  id: number;
  githubId: string;
  title: string;
  author: string;
  date: string;
  category: string;
  importance: number;
  sourceUrl: string;
  advanced: string;
  eli5: string;
  relatedFeatures: string[];
  labels: string[];
}

export interface FeatureStatus {
  key: string;
  name: string;
  status: string;
  progress: number;
  lastUpdated: string;
  history: Array<{ date: string; status: string; source: string }>;
}

export async function fetchReports(category?: string): Promise<WebReport[]> {
  const res = await fetch("/data/reports.json");
  const reports: WebReport[] = await res.json();
  if (category) return reports.filter((r) => r.category === category);
  return reports;
}

export async function fetchReport(id: number): Promise<WebReport | undefined> {
  const reports = await fetchReports();
  return reports.find((r) => r.id === id);
}

export async function fetchFeatures(): Promise<FeatureStatus[]> {
  const res = await fetch("/data/features.json");
  return res.json();
}

export interface Commit {
  sha: string;
  title: string;
  author: string;
  date: string;
  url: string;
  category: string;
}

export async function fetchCommits(): Promise<Commit[]> {
  const res = await fetch("/data/commits.json");
  return res.json();
}
