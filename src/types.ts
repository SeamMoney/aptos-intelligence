export interface TrackedFeature {
  key: string;
  name: string;
  aipNumber?: string;
  aipRepo?: string;
  aipPath?: string;
  keywords: string[];
  description: string;
}

export interface FeatureStatus {
  key: string;
  name: string;
  status: string;
  progress: number;
  lastUpdated: string;
  history: FeatureHistoryEntry[];
}

export interface FeatureHistoryEntry {
  date: string;
  status: string;
  source: string;
}

export interface UpdateAnalysis {
  summary: string;
  category: "Release" | "Feature Progress" | "Security" | "Performance" | "Infrastructure" | "Other";
  importance: number;
  relatedFeatures: string[];
  breakingChanges: boolean;
  nodeOperatorAction: boolean;
}

export interface GitHubItem {
  id: number;
  title?: string;
  tag_name?: string;
  body?: string;
  html_url: string;
  url: string;
  created_at?: string;
  merged_at?: string;
  user?: { login: string };
  labels?: Array<{ name: string }>;
}

export interface ThreadPart {
  text: string;
  priority: number;
}

export interface PostRecord {
  id: string;
  postedAt: string;
  threadLength: number;
  importance: number;
}

export interface MonthlyUsage {
  month: string;
  count: number;
}

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
