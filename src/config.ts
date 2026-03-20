import dotenv from "dotenv";
import type { TrackedFeature } from "./types.js";

dotenv.config();

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

function optionalEnv(key: string, fallback: string): string {
  return process.env[key] || fallback;
}

const isWebOnly = process.env.WEB_ONLY === "true";

export const config = {
  github: {
    token: requireEnv("GITHUB_TOKEN"),
    owner: "aptos-labs",
    repo: "aptos-core",
    aipOwner: "aptos-foundation",
    aipRepo: "AIPs",
  },

  groq: {
    apiKey: requireEnv("GROQ_API_KEY"),
    model: "llama-3.3-70b-versatile",
  },

  twitter: {
    apiKey: isWebOnly ? "" : requireEnv("X_API_KEY"),
    apiSecret: isWebOnly ? "" : requireEnv("X_API_SECRET"),
    accessToken: isWebOnly ? "" : requireEnv("X_ACCESS_TOKEN"),
    accessSecret: isWebOnly ? "" : requireEnv("X_ACCESS_SECRET"),
  },

  bot: {
    cronSchedule: optionalEnv("CRON_SCHEDULE", "0 */6 * * *"),
    dryRun: process.env.DRY_RUN === "true",
    importanceThreshold: parseInt(optionalEnv("POST_IMPORTANCE_THRESHOLD", "6")),
    maxMonthlyPosts: parseInt(optionalEnv("MAX_MONTHLY_POSTS", "450")),
    maxReleasesToFetch: 5,
    maxPRsToFetch: 20,
    threadDelayMs: 1500,
    maxThreadParts: 6,
  },

  web: {
    port: parseInt(optionalEnv("WEB_PORT", "3000")),
  },

  db: {
    path: "aptos-intelligence.db",
  },
} as const;

export const TRACKED_FEATURES: TrackedFeature[] = [
  {
    key: "aip-125",
    name: "Scheduled / Event-Driven Transactions",
    aipNumber: "125",
    aipRepo: "aptos-foundation",
    aipPath: "aips/aip-125.md",
    keywords: ["scheduled_txn", "scheduled_transaction", "event-driven", "AIP-125", "aip-125", "event_driven"],
    description: "Native on-chain time-based and event-based transaction automation",
  },
  {
    key: "aip-143",
    name: "Confidential Assets (ACTs)",
    aipNumber: "143",
    aipRepo: "aptos-foundation",
    aipPath: "aips/aip-143.md",
    keywords: ["confidential_asset", "confidential_transaction", "AIP-143", "aip-143", "confidential_apt"],
    description: "Privacy-preserving fungible asset transfers using zero-knowledge proofs",
  },
  {
    key: "encrypted-mempool",
    name: "Encrypted Mempool",
    keywords: ["encrypted_mempool", "encrypted mempool", "mempool_encryption"],
    description: "Transaction privacy through encrypted mempool submissions",
  },
  {
    key: "baby-raptr",
    name: "Baby Raptr Consensus",
    keywords: ["baby_raptr", "baby raptr", "BabyRaptr"],
    description: "Next-gen consensus upgrade for faster block times",
  },
  {
    key: "block-stm-v2",
    name: "Block-STM v2",
    keywords: ["block_stm_v2", "block-stm v2", "BlockSTM v2", "block_stm"],
    description: "Parallel execution engine improvements for higher throughput",
  },
  {
    key: "storage-sharding",
    name: "Storage Sharding",
    keywords: ["storage_shard", "storage sharding", "AIP-97", "aip-97"],
    description: "Distributed storage for horizontal scalability",
  },
  {
    key: "keyless-accounts",
    name: "Keyless Accounts",
    keywords: ["keyless_account", "keyless account", "keyless_zk", "AIP-61", "aip-61"],
    description: "Social login-based blockchain accounts without private keys",
  },
  {
    key: "randomness-api",
    name: "On-chain Randomness",
    keywords: ["randomness_api", "on_chain_randomness", "AIP-41", "aip-41", "aptos_randomness"],
    description: "Native verifiable random number generation on-chain",
  },
];
