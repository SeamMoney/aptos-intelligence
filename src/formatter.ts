import type { UpdateAnalysis, GitHubItem, TrackedFeature } from "./types.js";
import { formatFeatureUpdate } from "./features.js";
import { getMonthlyPostCount } from "./db.js";
import { config } from "./config.js";

const MAX_TWEET_LENGTH = 280;
const HASHTAGS = "#Aptos #AptosCore #Web3";

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + "...";
}

function formatDate(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function categoryEmoji(category: string): string {
  const map: Record<string, string> = {
    "Release": "\uD83D\uDCE6",
    "Feature Progress": "\u2699\uFE0F",
    "Security": "\uD83D\uDD12",
    "Performance": "\u26A1",
    "Infrastructure": "\uD83D\uDEE0\uFE0F",
    "Other": "\uD83D\uDCCB",
  };
  return map[category] || "\uD83D\uDCCB";
}

export function buildThread(
  item: GitHubItem,
  analysis: UpdateAnalysis,
  featureUpdates: Array<{ feature: TrackedFeature; statusChanged: boolean; newStatus: string }>
): string[] {
  const parts: string[] = [];
  const monthlyCount = getMonthlyPostCount();
  const remaining = config.bot.maxMonthlyPosts - monthlyCount;

  // Part 1: Header
  const isRelease = !!item.tag_name;
  const emoji = categoryEmoji(analysis.category);
  const header = [
    `\uD83E\uDDE0 Aptos Intelligence \u2014 ${formatDate()}`,
    "",
    `${emoji} ${analysis.category}${isRelease ? ` | ${item.tag_name}` : ""}`,
    analysis.breakingChanges ? "\u26A0\uFE0F BREAKING CHANGES" : "",
    analysis.nodeOperatorAction ? "\uD83D\uDEA8 Node operators: action may be required" : "",
  ]
    .filter(Boolean)
    .join("\n");

  parts.push(truncate(header, MAX_TWEET_LENGTH));

  // Part 2: Summary
  const summaryText = truncate(analysis.summary, MAX_TWEET_LENGTH - 10);
  parts.push(summaryText);

  // Part 3: Feature updates (if any)
  if (featureUpdates.length > 0) {
    const featureLines = featureUpdates
      .map(({ feature, statusChanged, newStatus }) =>
        formatFeatureUpdate(feature, statusChanged, newStatus)
      )
      .join("\n\n");

    const featureTweet = truncate(`Feature Tracker:\n\n${featureLines}`, MAX_TWEET_LENGTH);
    parts.push(featureTweet);
  }

  // Part 4: Link + hashtags
  const sourceUrl = item.html_url || item.url;
  const footer = [
    `\uD83D\uDD17 ${sourceUrl}`,
    "",
    `\uD83D\uDCCA Posts this month: ${monthlyCount}/${config.bot.maxMonthlyPosts}`,
    "",
    HASHTAGS,
  ].join("\n");
  parts.push(truncate(footer, MAX_TWEET_LENGTH));

  // Trim to max thread length
  return parts.slice(0, config.bot.maxThreadParts);
}

export function buildWeeklyRecapThread(
  recapText: string,
  featureDashboard: string[]
): string[] {
  const parts: string[] = [];

  // Header
  parts.push(
    truncate(
      `\uD83E\uDDE0 Aptos Intelligence \u2014 Weekly Recap\n${formatDate()}\n\nHere's everything that happened in Aptos Core this week \uD83E\uDDF5`,
      MAX_TWEET_LENGTH
    )
  );

  // Recap (split into tweet-sized chunks)
  const sentences = recapText.split(/(?<=[.!])\s+/);
  let currentChunk = "";
  for (const sentence of sentences) {
    if ((currentChunk + " " + sentence).length > MAX_TWEET_LENGTH - 20) {
      if (currentChunk) parts.push(truncate(currentChunk.trim(), MAX_TWEET_LENGTH));
      currentChunk = sentence;
    } else {
      currentChunk += " " + sentence;
    }
  }
  if (currentChunk.trim()) parts.push(truncate(currentChunk.trim(), MAX_TWEET_LENGTH));

  // Feature dashboard
  if (featureDashboard.length > 0) {
    const dashText = `Feature Progress Dashboard:\n\n${featureDashboard.slice(0, 4).join("\n\n")}`;
    parts.push(truncate(dashText, MAX_TWEET_LENGTH));
  }

  // Footer
  parts.push(
    truncate(
      `Follow @AptosIntelligence for real-time, AI-powered updates on every Aptos Core change.\n\n${HASHTAGS}`,
      MAX_TWEET_LENGTH
    )
  );

  return parts.slice(0, config.bot.maxThreadParts);
}

export function buildStatusCheckThread(featureDashboard: string[]): string[] {
  if (featureDashboard.length === 0) return [];

  const parts: string[] = [];

  parts.push(
    truncate(
      `\uD83E\uDDE0 Aptos Intelligence \u2014 Feature Status Report\n${formatDate()}\n\nCurrent progress on major Aptos features:`,
      MAX_TWEET_LENGTH
    )
  );

  // Split features across tweets (2 per tweet)
  for (let i = 0; i < featureDashboard.length; i += 2) {
    const chunk = featureDashboard.slice(i, i + 2).join("\n\n");
    parts.push(truncate(chunk, MAX_TWEET_LENGTH));
  }

  parts.push(truncate(`Data sourced from GitHub & AIP repos.\n\n${HASHTAGS}`, MAX_TWEET_LENGTH));

  return parts.slice(0, config.bot.maxThreadParts);
}
