import cron from "node-cron";
import { config } from "./config.js";
import { initDb, isAlreadyPosted, markPosted, addChangelogEntry, getRecentChangelog, getMonthlyPostCount } from "./db.js";
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

  // Analyze with LLM
  const analysis = await analyzeUpdate(item);
  console.log(`  Category: ${analysis.category} | Importance: ${analysis.importance}/10`);

  // Check feature connections
  const featureUpdates = updateFeatureFromPR(item);
  if (featureUpdates.length > 0) {
    console.log(`  Related features: ${featureUpdates.map((u) => u.feature.name).join(", ")}`);
  }

  // Store in changelog regardless of posting
  addChangelogEntry({
    githubId: itemId,
    date: new Date().toISOString(),
    category: analysis.category,
    summary: analysis.summary,
    importance: analysis.importance,
    relatedFeatures: analysis.relatedFeatures,
    sourceUrl: item.html_url,
  });

  // Decide whether to post based on importance + feature relevance
  const hasFeatureUpdate = featureUpdates.some((u) => u.statusChanged);
  const shouldPost = analysis.importance >= config.bot.importanceThreshold || hasFeatureUpdate;

  if (!shouldPost) {
    console.log(`  Skipping post (importance ${analysis.importance} < threshold ${config.bot.importanceThreshold})`);
    markPosted({ id: itemId, postedAt: new Date().toISOString(), threadLength: 0, importance: analysis.importance });
    return;
  }

  // Build and post thread
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

async function runUpdate(): Promise<void> {
  const timestamp = new Date().toISOString();
  const monthlyCount = getMonthlyPostCount();
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Aptos Intelligence Bot | ${timestamp}`);
  console.log(`Monthly posts: ${monthlyCount}/${config.bot.maxMonthlyPosts}`);
  console.log(`Dry run: ${config.bot.dryRun}`);
  console.log(`${"=".repeat(60)}`);

  if (monthlyCount >= config.bot.maxMonthlyPosts) {
    console.warn("Monthly post limit reached. Skipping this cycle.");
    return;
  }

  try {
    // Step 1: Refresh AIP statuses from GitHub
    console.log("\n--- Refreshing AIP statuses ---");
    const aipChanges = await refreshAIPStatuses();
    for (const [key, change] of aipChanges) {
      if (change.changed) {
        console.log(`  AIP status change: ${key} | ${change.oldStatus} -> ${change.newStatus}`);
      }
    }

    // Step 2: Fetch latest releases
    console.log("\n--- Fetching releases ---");
    const releases = await fetchLatestReleases();
    console.log(`  Found ${releases.length} recent releases`);

    // Step 3: Fetch recently merged PRs
    console.log("\n--- Fetching merged PRs ---");
    const prs = await fetchRecentMergedPRs();
    console.log(`  Found ${prs.length} recently merged PRs`);

    // Step 4: Process all items (releases first, then PRs by importance)
    const allItems = [...releases, ...prs];
    for (const item of allItems) {
      await processItem(item);
    }

    console.log(`\nCycle complete. Monthly posts used: ${getMonthlyPostCount()}/${config.bot.maxMonthlyPosts}`);
  } catch (err) {
    console.error("Update cycle failed:", err);
  }
}

async function runWeeklyRecap(): Promise<void> {
  console.log("\n--- Generating weekly recap ---");
  const recent = getRecentChangelog(20);
  if (recent.length === 0) {
    console.log("  No recent entries for recap.");
    return;
  }

  const entries = recent.map((r: any) => ({
    category: r.category,
    summary: r.summary,
    importance: r.importance,
  }));

  const recapText = await generateWeeklyRecap(entries);
  const dashboard = getFeatureDashboard();
  const thread = buildWeeklyRecapThread(recapText, dashboard);
  const result = await postThread(thread);

  if (result.success) {
    console.log(`  Weekly recap posted (${thread.length} tweets)`);
  }
}

async function main(): Promise<void> {
  console.log("\nAptos Intelligence Bot starting...");
  console.log(`Mode: ${config.bot.dryRun ? "DRY RUN" : "LIVE"}`);

  // Initialize
  initDb();
  initTwitter();

  // Run immediately
  await runUpdate();

  // Schedule regular updates
  cron.schedule(config.bot.cronSchedule, () => {
    runUpdate().catch(console.error);
  });
  console.log(`\nScheduled: Updates every ${config.bot.cronSchedule}`);

  // Schedule weekly recap (Sundays at 18:00 UTC)
  cron.schedule("0 18 * * 0", () => {
    runWeeklyRecap().catch(console.error);
  });
  console.log("Scheduled: Weekly recap every Sunday 18:00 UTC");

  // Schedule feature status report (Wednesdays at 15:00 UTC)
  cron.schedule("0 15 * * 3", async () => {
    console.log("\n--- Feature status report ---");
    const dashboard = getFeatureDashboard();
    if (dashboard.length > 0) {
      const thread = buildStatusCheckThread(dashboard);
      await postThread(thread);
    }
  });
  console.log("Scheduled: Feature status report every Wednesday 15:00 UTC");

  console.log("\nAptos Intelligence Bot is LIVE and monitoring aptos-labs/aptos-core");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
