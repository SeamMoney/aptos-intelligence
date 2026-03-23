import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { config } from "./config.js";
import type { FeatureStatus, PostRecord, WebReport } from "./types.js";

interface DbData {
  posted: Record<string, PostRecord & { category?: string; title?: string }>;
  features: Record<string, FeatureStatus>;
  monthlyPosts: Record<string, number>;
  changelog: Array<{
    id: number;
    githubId: string;
    date: string;
    category: string;
    summary: string;
    importance: number;
    relatedFeatures: string[];
    sourceUrl: string;
  }>;
  reports: Array<Omit<WebReport, "id"> & { id: number }>;
  nextId: number;
}

const DB_PATH = config.db.path.replace(".db", ".json");

let db: DbData;

function load(): DbData {
  if (existsSync(DB_PATH)) {
    try {
      return JSON.parse(readFileSync(DB_PATH, "utf-8"));
    } catch {
      console.warn("Corrupt DB file, starting fresh");
    }
  }
  return {
    posted: {},
    features: {},
    monthlyPosts: {},
    changelog: [],
    reports: [],
    nextId: 1,
  };
}

function save(): void {
  writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

export function initDb(): void {
  db = load();
}

export function isAlreadyPosted(id: string): boolean {
  return id in db.posted;
}

export function markPosted(record: PostRecord): void {
  db.posted[record.id] = record;
  save();
}

export function getFeatureStatus(key: string): FeatureStatus | undefined {
  return db.features[key];
}

export function upsertFeatureStatus(feature: FeatureStatus): void {
  db.features[feature.key] = feature;
  save();
}

export function getAllFeatureStatuses(): FeatureStatus[] {
  return Object.values(db.features).sort((a, b) => a.key.localeCompare(b.key));
}

export function getMonthlyPostCount(): number {
  const month = new Date().toISOString().slice(0, 7);
  return db.monthlyPosts[month] ?? 0;
}

export function incrementMonthlyPostCount(amount: number = 1): void {
  const month = new Date().toISOString().slice(0, 7);
  db.monthlyPosts[month] = (db.monthlyPosts[month] ?? 0) + amount;
  save();
}

export function addChangelogEntry(entry: {
  githubId: string;
  date: string;
  category: string;
  summary: string;
  importance: number;
  relatedFeatures: string[];
  sourceUrl: string;
}): void {
  db.changelog.push({ ...entry, id: db.nextId++ });
  save();
}

export function getRecentChangelog(limit: number = 20): DbData["changelog"] {
  return db.changelog
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);
}

export function upsertReport(report: Omit<WebReport, "id">): void {
  const existing = db.reports.findIndex((r) => r.githubId === report.githubId);
  if (existing >= 0) {
    db.reports[existing] = { ...db.reports[existing], ...report };
  } else {
    db.reports.push({ ...report, id: db.nextId++ });
  }
  save();
}

export function getReports(limit: number = 50): WebReport[] {
  return db.reports
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);
}

export function getReportById(id: number): WebReport | undefined {
  return db.reports.find((r) => r.id === id);
}

export function getReportsByCategory(category: string): WebReport[] {
  return db.reports
    .filter((r) => r.category === category)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function closeDb(): void {
  save();
}
