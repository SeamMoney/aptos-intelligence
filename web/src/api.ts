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

const BASE = "/api";

export async function fetchReports(category?: string): Promise<WebReport[]> {
  const params = category ? `?category=${encodeURIComponent(category)}` : "";
  const res = await fetch(`${BASE}/reports${params}`);
  return res.json();
}

export async function fetchReport(id: number): Promise<WebReport> {
  const res = await fetch(`${BASE}/reports/${id}`);
  return res.json();
}

export async function fetchFeatures(): Promise<FeatureStatus[]> {
  const res = await fetch(`${BASE}/features`);
  return res.json();
}
