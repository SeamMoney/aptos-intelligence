import type { UpdateAnalysis, GitHubItem } from "./types.js";

const MAX_TWEET_LENGTH = 280;

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + "...";
}

/**
 * Build a simple fallback thread when LLM-generated thread isn't available.
 * The primary thread generation is now done by llm.ts generateThread().
 */
export function buildFallbackThread(item: GitHubItem, analysis: UpdateAnalysis): string[] {
  const parts: string[] = [];
  const prNumber = item.html_url?.match(/\/pull\/(\d+)/)?.[1] || "";
  const author = item.user?.login || "unknown";

  // Hook
  parts.push(
    truncate(
      `Aptos Intelligence — @${author} just shipped ${prNumber ? `PR #${prNumber}` : item.tag_name || "an update"}: ${item.title || ""}`,
      MAX_TWEET_LENGTH
    )
  );

  // Summary
  parts.push(truncate(analysis.summary, MAX_TWEET_LENGTH));

  // Link
  parts.push(truncate(`${item.html_url}\n\n#Aptos`, MAX_TWEET_LENGTH));

  return parts;
}

export function buildWeeklyRecapThread(recapText: string): string[] {
  const parts: string[] = [];

  parts.push(
    truncate(
      `Aptos Intelligence — Weekly Recap\n\nHere's everything that shipped in aptos-core this week:`,
      MAX_TWEET_LENGTH
    )
  );

  // Split recap into tweet-sized chunks
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

  parts.push(truncate(`Follow for real-time technical analysis of every notable Aptos Core change.\n\n#Aptos`, MAX_TWEET_LENGTH));

  return parts.slice(0, 8);
}
