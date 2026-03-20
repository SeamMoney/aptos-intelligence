import Database from "better-sqlite3";
import { config } from "./config.js";
import type { FeatureStatus, FeatureHistoryEntry, PostRecord, MonthlyUsage, WebReport } from "./types.js";

let db: Database.Database;

export function initDb(): void {
  db = new Database(config.db.path);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS posted (
      id TEXT PRIMARY KEY,
      posted_at TEXT NOT NULL,
      thread_length INTEGER NOT NULL DEFAULT 1,
      importance INTEGER NOT NULL DEFAULT 0,
      category TEXT,
      title TEXT
    );

    CREATE TABLE IF NOT EXISTS features (
      key TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Unknown',
      progress INTEGER NOT NULL DEFAULT 0,
      last_updated TEXT NOT NULL,
      history TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS monthly_posts (
      month TEXT PRIMARY KEY,
      count INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS changelog (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      github_id TEXT NOT NULL,
      date TEXT NOT NULL,
      category TEXT NOT NULL,
      summary TEXT NOT NULL,
      importance INTEGER NOT NULL,
      related_features TEXT NOT NULL DEFAULT '[]',
      source_url TEXT
    );

    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      github_id TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      author TEXT NOT NULL DEFAULT 'unknown',
      date TEXT NOT NULL,
      category TEXT NOT NULL,
      importance INTEGER NOT NULL,
      source_url TEXT,
      advanced TEXT NOT NULL,
      eli5 TEXT NOT NULL,
      related_features TEXT NOT NULL DEFAULT '[]',
      labels TEXT NOT NULL DEFAULT '[]'
    );
  `);
}

export function isAlreadyPosted(id: string): boolean {
  const row = db.prepare("SELECT 1 FROM posted WHERE id = ?").get(id);
  return !!row;
}

export function markPosted(record: PostRecord): void {
  db.prepare(
    "INSERT OR IGNORE INTO posted (id, posted_at, thread_length, importance) VALUES (?, ?, ?, ?)"
  ).run(record.id, record.postedAt, record.threadLength, record.importance);
}

export function getFeatureStatus(key: string): FeatureStatus | undefined {
  const row = db.prepare("SELECT * FROM features WHERE key = ?").get(key) as any;
  if (!row) return undefined;
  return {
    key: row.key,
    name: row.name,
    status: row.status,
    progress: row.progress,
    lastUpdated: row.last_updated,
    history: JSON.parse(row.history),
  };
}

export function upsertFeatureStatus(feature: FeatureStatus): void {
  db.prepare(`
    INSERT OR REPLACE INTO features (key, name, status, progress, last_updated, history)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    feature.key,
    feature.name,
    feature.status,
    feature.progress,
    feature.lastUpdated,
    JSON.stringify(feature.history)
  );
}

export function getAllFeatureStatuses(): FeatureStatus[] {
  const rows = db.prepare("SELECT * FROM features ORDER BY key").all() as any[];
  return rows.map((row) => ({
    key: row.key,
    name: row.name,
    status: row.status,
    progress: row.progress,
    lastUpdated: row.last_updated,
    history: JSON.parse(row.history),
  }));
}

export function getMonthlyPostCount(): number {
  const month = new Date().toISOString().slice(0, 7);
  const row = db.prepare("SELECT count FROM monthly_posts WHERE month = ?").get(month) as any;
  return row?.count ?? 0;
}

export function incrementMonthlyPostCount(amount: number = 1): void {
  const month = new Date().toISOString().slice(0, 7);
  db.prepare(`
    INSERT INTO monthly_posts (month, count) VALUES (?, ?)
    ON CONFLICT(month) DO UPDATE SET count = count + ?
  `).run(month, amount, amount);
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
  db.prepare(`
    INSERT INTO changelog (github_id, date, category, summary, importance, related_features, source_url)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    entry.githubId,
    entry.date,
    entry.category,
    entry.summary,
    entry.importance,
    JSON.stringify(entry.relatedFeatures),
    entry.sourceUrl
  );
}

export function getRecentChangelog(limit: number = 20): any[] {
  return db.prepare("SELECT * FROM changelog ORDER BY date DESC LIMIT ?").all(limit);
}

export function upsertReport(report: Omit<WebReport, "id">): void {
  db.prepare(`
    INSERT INTO reports (github_id, title, author, date, category, importance, source_url, advanced, eli5, related_features, labels)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(github_id) DO UPDATE SET
      advanced = excluded.advanced,
      eli5 = excluded.eli5,
      importance = excluded.importance,
      category = excluded.category,
      related_features = excluded.related_features
  `).run(
    report.githubId,
    report.title,
    report.author,
    report.date,
    report.category,
    report.importance,
    report.sourceUrl,
    report.advanced,
    report.eli5,
    JSON.stringify(report.relatedFeatures),
    JSON.stringify(report.labels)
  );
}

export function getReports(limit: number = 50): WebReport[] {
  const rows = db.prepare("SELECT * FROM reports ORDER BY date DESC LIMIT ?").all(limit) as any[];
  return rows.map(rowToReport);
}

export function getReportById(id: number): WebReport | undefined {
  const row = db.prepare("SELECT * FROM reports WHERE id = ?").get(id) as any;
  return row ? rowToReport(row) : undefined;
}

export function getReportsByCategory(category: string): WebReport[] {
  const rows = db.prepare("SELECT * FROM reports WHERE category = ? ORDER BY date DESC").all(category) as any[];
  return rows.map(rowToReport);
}

function rowToReport(row: any): WebReport {
  return {
    id: row.id,
    githubId: row.github_id,
    title: row.title,
    author: row.author,
    date: row.date,
    category: row.category,
    importance: row.importance,
    sourceUrl: row.source_url,
    advanced: row.advanced,
    eli5: row.eli5,
    relatedFeatures: JSON.parse(row.related_features),
    labels: JSON.parse(row.labels),
  };
}

export function closeDb(): void {
  db.close();
}
