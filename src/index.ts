import cron from "node-cron";
import { config } from "./config.js";
import { initDb, isAlreadyPosted, markPosted, addChangelogEntry, getRecentChangelog, getMonthlyPostCount, upsertReport } from "./db.js";
import { fetchLatestReleases, fetchRecentMergedPRs, fetchPRDetails, extractPRNumber } from "./github.js";
import { analyzeUpdate, generateThread, generateWebReport, generateWeeklyRecap } from "./llm.js";
import { updateFeatureFromPR } from "./features.js";
import { buildFallbackThread, buildWeeklyRecapThread } from "./formatter.js";
import { initTwitter, postThread } from "./twitter.js";
import type { GitHubItem } from "./types.js";

/**
 * Build code context string from PR details for LLM analysis.
 */
function buildCodeContext(details: Awaited<ReturnType<typeof fetchPRDetails>>): string {
  if (details.files.length === 0) return "";

  const lines: string[] = [];
  lines.push(`Files changed: ${details.files.length} | Commits: ${details.commits}`);
  lines.push("");

  for (const file of details.files) {
    lines.push(`--- ${file.filename} (${file.status}, +${file.additions}/-${file.deletions})`);
    if (file.patch) {
      lines.push(file.patch);
      lines.push("");
    }
  }

  return lines.join("\n").slice(0, 8000);
}

async function processItem(item: GitHubItem): Promise<void> {
  const itemId = item.id.toString();
  if (isAlreadyPosted(itemId)) return;

  console.log(`\nAnalyzing: ${item.title || item.tag_name}`);

  // Fetch PR diff for deeper analysis
  let codeContext = "";
  const prNumber = extractPRNumber(item.html_url);
  if (prNumber) {
    const details = await fetchPRDetails(prNumber);
    codeContext = buildCodeContext(details);
    if (details.body && !item.body) {
      item.body = details.body;
    }
  }

  // Analyze with LLM (now with code context)
  const analysis = await analyzeUpdate(item, codeContext);
  console.log(`  Category: ${analysis.category} | Importance: ${analysis.importance}/10`);

  // Track feature connections
  const featureUpdates = updateFeatureFromPR(item);
  if (featureUpdates.length > 0) {
    console.log(`  Related features: ${featureUpdates.map((u) => u.feature.name).join(", ")}`);
  }

  // Store in changelog
  addChangelogEntry({
    githubId: itemId,
    date: item.merged_at || item.created_at || new Date().toISOString(),
    category: analysis.category,
    summary: analysis.summary,
    importance: analysis.importance,
    relatedFeatures: analysis.relatedFeatures,
    sourceUrl: item.html_url,
  });

  // Generate web report (Advanced + ELI5) with code context
  try {
    const webContent = await generateWebReport(item, analysis, codeContext);
    upsertReport({
      githubId: itemId,
      title: item.title || item.tag_name || "Unknown",
      author: item.user?.login || "unknown",
      date: item.merged_at || item.created_at || new Date().toISOString(),
      category: analysis.category,
      importance: analysis.importance,
      sourceUrl: item.html_url,
      advanced: webContent.advanced,
      eli5: webContent.eli5,
      relatedFeatures: analysis.relatedFeatures,
      labels: item.labels?.map((l) => l.name) || [],
    });
    console.log(`  Web report generated (Advanced + ELI5)`);
  } catch (err) {
    console.error(`  Web report generation failed:`, err);
  }

  // Decide whether to post
  const hasFeatureUpdate = featureUpdates.some((u) => u.statusChanged);
  const shouldPost = analysis.importance >= config.bot.importanceThreshold || hasFeatureUpdate;

  if (!shouldPost) {
    console.log(`  Skipping post (importance ${analysis.importance} < threshold ${config.bot.importanceThreshold})`);
    markPosted({ id: itemId, postedAt: new Date().toISOString(), threadLength: 0, importance: analysis.importance });
    return;
  }

  // Generate deep technical thread with code context
  let thread: string[];
  try {
    thread = await generateThread(item, analysis, codeContext);
    console.log(`  Generated ${thread.length}-tweet thread`);
  } catch {
    thread = buildFallbackThread(item, analysis);
    console.log(`  Using fallback thread`);
  }

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
  console.log(`Aptos Intelligence | ${timestamp}`);
  console.log(`Monthly posts: ${monthlyCount}/${config.bot.maxMonthlyPosts}`);
  console.log(`Dry run: ${config.bot.dryRun}`);
  console.log(`${"=".repeat(60)}`);

  if (monthlyCount >= config.bot.maxMonthlyPosts) {
    console.warn("Monthly post limit reached. Skipping this cycle.");
    return;
  }

  try {
    // Fetch latest releases
    console.log("\n--- Fetching releases ---");
    const releases = await fetchLatestReleases();
    console.log(`  Found ${releases.length} recent releases`);

    // Fetch recently merged PRs
    console.log("\n--- Fetching merged PRs ---");
    const prs = await fetchRecentMergedPRs();
    console.log(`  Found ${prs.length} recently merged PRs`);

    // Process all items
    for (const item of [...releases, ...prs]) {
      await processItem(item);
    }

    console.log(`\nCycle complete. Monthly posts: ${getMonthlyPostCount()}/${config.bot.maxMonthlyPosts}`);
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
  const thread = buildWeeklyRecapThread(recapText);
  const result = await postThread(thread);

  if (result.success) {
    console.log(`  Weekly recap posted (${thread.length} tweets)`);
  }
}

async function main(): Promise<void> {
  console.log("\nAptos Intelligence starting...");
  console.log(`Mode: ${config.bot.dryRun ? "DRY RUN" : "LIVE"}`);

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

  console.log("\nAptos Intelligence is LIVE — monitoring aptos-labs/aptos-core");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
