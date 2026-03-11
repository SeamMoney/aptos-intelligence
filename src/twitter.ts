import { TwitterApi } from "twitter-api-v2";
import { config } from "./config.js";
import { getMonthlyPostCount, incrementMonthlyPostCount } from "./db.js";

let client: TwitterApi;

export function initTwitter(): void {
  client = new TwitterApi({
    appKey: config.twitter.apiKey,
    appSecret: config.twitter.apiSecret,
    accessToken: config.twitter.accessToken,
    accessSecret: config.twitter.accessSecret,
  });
}

export async function postThread(parts: string[]): Promise<{ success: boolean; tweetIds: string[]; error?: string }> {
  if (config.bot.dryRun) {
    console.log("\n=== DRY RUN: Thread would be posted ===");
    parts.forEach((p, i) => console.log(`[${i + 1}/${parts.length}]\n${p}\n`));
    return { success: true, tweetIds: [] };
  }

  const monthlyCount = getMonthlyPostCount();
  if (monthlyCount + parts.length > config.bot.maxMonthlyPosts) {
    const msg = `Monthly post limit reached (${monthlyCount}/${config.bot.maxMonthlyPosts}). Skipping.`;
    console.warn(msg);
    return { success: false, tweetIds: [], error: msg };
  }

  const tweetIds: string[] = [];
  let lastTweetId: string | undefined;

  try {
    for (let i = 0; i < parts.length; i++) {
      const text = parts[i];

      const tweetData: any = { text };
      if (lastTweetId) {
        tweetData.reply = { in_reply_to_tweet_id: lastTweetId };
      }

      const result = await client.v2.tweet(tweetData);
      lastTweetId = result.data.id;
      tweetIds.push(result.data.id);

      incrementMonthlyPostCount();

      // Delay between tweets to respect rate limits
      if (i < parts.length - 1) {
        await sleep(config.bot.threadDelayMs);
      }
    }

    console.log(`Posted thread with ${tweetIds.length} tweets. IDs: ${tweetIds.join(", ")}`);
    return { success: true, tweetIds };
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    console.error(`Twitter post failed at tweet ${tweetIds.length + 1}:`, errorMsg);

    if (errorMsg.includes("429") || errorMsg.includes("Too Many Requests")) {
      console.warn("Rate limited. Will retry on next cycle.");
    }

    return { success: false, tweetIds, error: errorMsg };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
