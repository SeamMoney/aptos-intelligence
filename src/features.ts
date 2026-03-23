import { TRACKED_FEATURES } from "./config.js";
import { fetchAIPContent, parseAIPStatus, detectRelatedFeatures } from "./github.js";
import { getFeatureStatus, upsertFeatureStatus } from "./db.js";
import type { FeatureStatus, FeatureHistoryEntry, GitHubItem, TrackedFeature } from "./types.js";

const STATUS_PROGRESS: Record<string, number> = {
  "Unknown": 5,
  "Draft": 20,
  "Review": 35,
  "Last Call": 45,
  "Accepted": 55,
  "Ready for Implementation": 60,
  "Implemented": 75,
  "Testnet": 80,
  "Devnet": 70,
  "Deployed": 95,
  "Mainnet": 100,
  "Final": 100,
  "Living": 100,
  "Withdrawn": 0,
  "Rejected": 0,
  "Stagnant": 15,
};

function inferProgressFromStatus(status: string): number {
  const lower = status.toLowerCase();
  for (const [key, value] of Object.entries(STATUS_PROGRESS)) {
    if (lower.includes(key.toLowerCase())) return value;
  }
  return 30;
}

export async function refreshAIPStatuses(): Promise<Map<string, { oldStatus: string | null; newStatus: string; changed: boolean }>> {
  const results = new Map<string, { oldStatus: string | null; newStatus: string; changed: boolean }>();

  for (const feature of TRACKED_FEATURES) {
    if (!feature.aipPath) continue;

    const content = await fetchAIPContent(feature.aipPath, feature.aipRepo);
    if (!content) continue;

    const { status: newStatus } = parseAIPStatus(content);
    const existing = getFeatureStatus(feature.key);
    const oldStatus = existing?.status || null;
    const changed = oldStatus !== null && oldStatus !== newStatus;

    const progress = inferProgressFromStatus(newStatus);
    const history: FeatureHistoryEntry[] = existing?.history || [];

    if (changed || !existing) {
      history.push({
        date: new Date().toISOString().slice(0, 10),
        status: newStatus,
        source: `AIP-${feature.aipNumber}`,
      });
    }

    upsertFeatureStatus({
      key: feature.key,
      name: feature.name,
      status: newStatus,
      progress,
      lastUpdated: new Date().toISOString(),
      history,
    });

    results.set(feature.key, { oldStatus, newStatus, changed });
  }

  return results;
}

export function updateFeatureFromPR(item: GitHubItem): Array<{ feature: TrackedFeature; statusChanged: boolean; newStatus: string }> {
  const text = `${item.title || ""} ${item.body || ""}`;
  const related = detectRelatedFeatures(text);
  const updates: Array<{ feature: TrackedFeature; statusChanged: boolean; newStatus: string }> = [];

  for (const feature of related) {
    const existing = getFeatureStatus(feature.key);
    const lowerText = text.toLowerCase();

    let inferredStatus = existing?.status || "In Progress";
    if (lowerText.includes("mainnet") || lowerText.includes("deployed")) inferredStatus = "Deployed";
    else if (lowerText.includes("testnet")) inferredStatus = "Testnet";
    else if (lowerText.includes("devnet")) inferredStatus = "Devnet";
    else if (item.merged_at) inferredStatus = "In Progress (code merged)";

    const changed = existing?.status !== inferredStatus;
    const history: FeatureHistoryEntry[] = existing?.history || [];

    if (changed) {
      history.push({
        date: new Date().toISOString().slice(0, 10),
        status: inferredStatus,
        source: item.html_url,
      });
    }

    upsertFeatureStatus({
      key: feature.key,
      name: feature.name,
      status: inferredStatus,
      progress: inferProgressFromStatus(inferredStatus),
      lastUpdated: new Date().toISOString(),
      history,
    });

    updates.push({ feature, statusChanged: changed, newStatus: inferredStatus });
  }

  return updates;
}
