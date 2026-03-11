/**
 * Single-cycle runner for GitHub Actions / cron environments.
 * Runs one update cycle then exits (no long-lived process needed).
 */
import { config } from "./config.js";
import {
  initDb,
  isAlreadyPosted,
  markPosted,
  addChangelogEntry,
  getRecentChangelog,
  getMonthlyPostCount,
  closeDb,
} from "./db.js";
import { fetchLatestReleases, fetchRecentMergedPRs } from "./github.js";
import { analyzeUpdate, generateWeeklyRecap } from "./llm.js";
import { refreshAIPStatuses, updateFeatureFromPR, getFeatureDashboard } from "./features.js";
import { buildThread, buildWeeklyRecapThread, buildStatusCheckThread } from "./formatter.js";
import { initTwitter, postThread } from "./twitter.js";
import type { GitHubItem } from "./types.js";

async function processItem(item: GitHubItem): Promise<void> {
  const itemId = item.id.toString();
  if (isAlreadyPosted(itemId)) return;

  console.log(`\nAnalyzing: ${item.title || item.tag_name}`);

  const analysis = await analyzeUpdate(item);
  console.log(`  Category: ${analysis.category} | Importance: ${analysis.importance}/10`);

  const featureUpdates = updateFeatureFromPR(item);
  if (featureUpdates.length > 0) {
    console.log(`  Related features: ${featureUpdates.map((u) => u.feature.name).join(", ")}`);
  }

  addChangelogEntry({
    githubId: itemId,
    date: new Date().toISOString(),
    category: analysis.category,
    summary: analysis.summary,
    importance: analysis.importance,
    relatedFeatures: analysis.relatedFeatures,
    sourceUrl: item.html_url,
  });

  const hasFeatureUpdate = featureUpdates.some((u) => u.statusChanged);
  const shouldPost =
    analysis.importance >= config.bot.importanceThreshold || hasFeatureUpdate;

  if (!shouldPost) {
    console.log(
      `  Skipping post (importance ${analysis.importance} < threshold ${config.bot.importanceThreshold})`
    );
    markPosted({
      id: itemId,
      postedAt: new Date().toISOString(),
      threadLength: 0,
      importance: analysis.importance,
    });
    return;
  }

  const thread = buildThread(item, analysis, featureUpdates);
  const result = await postThread(thread);

  if (result.success) {
    markPosted({
      id: itemId,
      postedAt: new Date().toISOString(),
      threadLength: thread.length,
      importance: analysis.importance,
    });
    console.log(`  Posted thread (${thread.length} tweets)`);
  } else {
    console.error(`  Failed to post: ${result.error}`);
  }
}

async function main(): Promise<void> {
  const trigger = process.env.GITHUB_EVENT_NAME;
  const cronSchedule = process.env.GITHUB_EVENT_SCHEDULE;

  console.log(`Aptos Intelligence Bot — single cycle`);
  console.log(`Trigger: ${trigger || "manual"} | Schedule: ${cronSchedule || "N/A"}`);

  initDb();
  initTwitter();

  const monthlyCount = getMonthlyPostCount();
  console.log(`Monthly posts: ${monthlyCount}/${config.bot.maxMonthlyPosts}`);

  if (monthlyCount >= config.bot.maxMonthlyPosts) {
    console.warn("Monthly post limit reached. Exiting.");
    closeDb();
    return;
  }

  // Determine what to run based on the cron schedule that triggered us
  const isWeeklyRecap = cronSchedule === "0 18 * * 0";
  const isStatusReport = cronSchedule === "0 15 * * 3";

  // Always refresh AIP statuses
  console.log("\n--- Refreshing AIP statuses ---");
  const aipChanges = await refreshAIPStatuses();
  for (const [key, change] of aipChanges) {
    if (change.changed) {
      console.log(`  AIP status change: ${key} | ${change.oldStatus} -> ${change.newStatus}`);
    }
  }

  if (isWeeklyRecap) {
    // Sunday weekly recap
    console.log("\n--- Weekly recap ---");
    const recent = getRecentChangelog(20);
    if (recent.length > 0) {
      const entries = recent.map((r: any) => ({
        category: r.category,
        summary: r.summary,
        importance: r.importance,
      }));
      const recapText = await generateWeeklyRecap(entries);
      const dashboard = getFeatureDashboard();
      const thread = buildWeeklyRecapThread(recapText, dashboard);
      await postThread(thread);
    }
  } else if (isStatusReport) {
    // Wednesday feature status
    console.log("\n--- Feature status report ---");
    const dashboard = getFeatureDashboard();
    if (dashboard.length > 0) {
      const thread = buildStatusCheckThread(dashboard);
      await postThread(thread);
    }
  } else {
    // Regular update cycle (every 6 hours)
    console.log("\n--- Fetching releases ---");
    const releases = await fetchLatestReleases();
    console.log(`  Found ${releases.length} recent releases`);

    console.log("\n--- Fetching merged PRs ---");
    const prs = await fetchRecentMergedPRs();
    console.log(`  Found ${prs.length} recently merged PRs`);

    for (const item of [...releases, ...prs]) {
      await processItem(item);
    }
  }

  console.log(
    `\nDone. Monthly posts used: ${getMonthlyPostCount()}/${config.bot.maxMonthlyPosts}`
  );
  closeDb();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
