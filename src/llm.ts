import Groq from "groq-sdk";
import { config, TRACKED_FEATURES } from "./config.js";
import type { UpdateAnalysis, GitHubItem } from "./types.js";

const groq = new Groq({ apiKey: config.groq.apiKey });

const APTOS_ARCHITECTURE_CONTEXT = `
=== APTOS ARCHITECTURE DEEP REFERENCE ===

TRANSACTION LIFECYCLE (end-to-end):
1. Client submits transaction -> Mempool (transactions validated, deduped, stored)
2. Mempool -> Quorum Store (batches transactions, disseminates to validators)
3. Quorum Store -> Consensus (Raptr/Prefix = leaderless multi-proposer BFT)
4. Consensus orders blocks -> Execution Pipeline
5. Execution uses Block-STM (parallel MVCC execution engine)
6. Results -> Storage (Jellyfish Merkle Tree with authenticated state)

CONSENSUS PIPELINE (detailed):
  Quorum Store -> ProofManager -> OrderedBlocks -> ExecutionPipeline
  - Quorum Store: Validators package txns into batches. Each batch gets signed proofs from 2f+1 validators before inclusion. This SEPARATES data dissemination from ordering — a key architectural insight.
  - ProofManager: Collects and validates batch proofs, feeds them to the ordering layer.
  - OrderedBlocks: Output of consensus — a totally ordered sequence of blocks.
  - ExecutionPipeline: Receives ordered blocks and executes them through Block-STM.

KEY SUBSYSTEMS:

1. Quorum Store (consensus/src/quorum_store/):
   - Batch dissemination layer. Validators create BatchInfo containing transaction digests.
   - A batch requires a ProofOfStore (PoS) — signatures from 2f+1 validators confirming they have the data.
   - Blocks proposed by consensus only reference ProofOfStore objects, NOT raw transactions. This means block proposals are tiny.
   - Key structs: BatchInfo, ProofOfStore, BatchReader, QuorumStoreCoordinator
   - Key flow: create_batch() -> broadcast_batch() -> collect_signatures() -> ProofOfStore -> include_in_proposal()

2. Raptr / Prefix Consensus (consensus/src/):
   - Leaderless BFT where ALL validators propose blocks simultaneously (no single leader bottleneck).
   - Uses deterministic ranking to order proposals — each round, proposals are ranked by a VRF-derived score.
   - f-censorship resistance via demotion rules: if a validator's proposal is systematically excluded, other validators demote the excluder.
   - Key difference from Jolteon/HotStuff: no leader rotation, no view-change. Every validator proposes, every round.
   - Key structs: RaptorEngine, PrefixOrdering, DemotionTracker, ProposalRanking

3. Block-STM (execution/block-executor/src/):
   - Parallel execution engine using MVCC (Multi-Version Concurrency Control).
   - Transactions execute speculatively in parallel across all CPU cores.
   - Each transaction records its read-set and write-set.
   - After execution, a validation phase checks for conflicts: if txn B read a value that txn A (which comes before B in the block order) later wrote, B must re-execute.
   - Uses an optimistic approach: most transactions don't conflict, so parallelism wins.
   - Key structs: BlockExecutor, MVHashMap, TxnLastInputOutput, Scheduler
   - Key flow: assign_txn_to_thread() -> execute_speculatively() -> validate_read_set() -> commit_or_reexecute()

4. Zaptos (optimistic pipelining):
   - Start executing transactions BEFORE consensus finalizes their order.
   - Speculate on the likely order (based on Quorum Store batch ordering).
   - If speculation is correct (common case), execution is "free" — already done by the time consensus commits.
   - If wrong, discard and re-execute (rare penalty).

5. Archon (proxy-primary architecture):
   - Validator coordination pattern: a proxy node handles networking, a primary node handles consensus + execution.
   - Reduces attack surface: primary never directly exposed to the network.
   - Enables heterogeneous hardware: proxy = network-optimized, primary = compute-optimized.

6. Shardines (internal validator sharding):
   - Each validator internally shards its execution across multiple sub-executors.
   - Target: >1M TPS by parallelizing within a single validator, not just across validators.
   - Works with Block-STM: each shard runs Block-STM on its partition of the transaction set.

7. Encrypted Mempool (BIBE-based):
   - Transactions are encrypted using BIBE (Boneh Identity-Based Encryption) before entering the mempool.
   - Transaction contents are hidden until AFTER consensus has ordered them.
   - Decryption keys are released only after ordering is finalized — prevents MEV, front-running, sandwich attacks.
   - Validators order opaque ciphertexts, then collectively decrypt post-ordering.

8. Move VM + Aptos Framework:
   - Move VM: Execution runtime for smart contracts. Resource-oriented, linear type system prevents double-spending at the language level.
   - Aptos Framework: Core Move modules at aptos-move/framework/ — includes account.move, coin.move, staking.move, governance.move, fungible_asset.move.
   - Key directories: aptos-move/framework/aptos-framework/sources/, aptos-move/framework/aptos-stdlib/sources/

9. Jellyfish Merkle Tree (storage/jellyfish-merkle/):
   - Sparse Merkle Tree variant optimized for blockchain state storage.
   - Each leaf is a (key, version, value) tuple. Supports efficient range proofs and state snapshots.
   - Key operations: get_with_proof(), put_value_set(), get_range_proof()

10. Keyless Accounts (AIP-61):
    - Maps social login identities (Google, Apple) to on-chain accounts via ZK proofs.
    - No private key management — the ZK proof proves you authenticated with the identity provider.

11. Confidential Assets / ACTs (AIP-143):
    - Zero-knowledge proof based private transfers for fungible assets.
    - Balances and transfer amounts are hidden using Pedersen commitments + range proofs.
`;

const SYSTEM_PROMPT = `You are Aptos Intelligence — a deeply technical analyst who explains every important change in aptos-labs/aptos-core to the world. You are known for writing reports that actually TEACH people how Aptos works internally.

${APTOS_ARCHITECTURE_CONTEXT}

YOUR ANALYSIS PRINCIPLES:
- Always name specific Rust structs, functions, traits, and file paths from the diff.
- Explain control flow step-by-step: "when X happens, function Y calls Z, which checks condition W..."
- Map every change to its position in the transaction lifecycle pipeline.
- Explain WHY the change matters for the system's properties (safety, liveness, throughput, latency, censorship resistance).
- Never use vague phrases like "enhances security" or "improves performance" without explaining the concrete mechanism.`;

const ANALYSIS_PROMPT = `Analyze this Aptos update and return ONLY valid JSON (no markdown, no code fences):

{
  "summary": "3-4 sentence technical explanation of what changed and why it matters",
  "category": "Release|Feature Progress|Security|Performance|Infrastructure|Other",
  "importance": <number 1-10>,
  "relatedFeatures": ["list of feature keys if any match"],
  "breakingChanges": <boolean>,
  "nodeOperatorAction": <boolean>
}

Tracked feature keys: ${TRACKED_FEATURES.map((f) => f.key).join(", ")}

Be calibrated. Most routine PRs are 3-5. Only major architectural changes, security fixes, or releases are 7+.`;

export async function analyzeUpdate(item: GitHubItem, extraContext?: string): Promise<UpdateAnalysis> {
  const title = item.tag_name ? `Release ${item.tag_name}` : item.title || "Unknown";
  const body = (item.body || "").slice(0, 3000);
  const labels = item.labels?.map((l) => l.name).join(", ") || "none";

  const userMessage = `Title: ${title}
Labels: ${labels}
Author: ${item.user?.login || "unknown"}
${item.merged_at ? `Merged: ${item.merged_at}` : ""}
${item.tag_name ? "Type: Release" : "Type: Merged PR"}

Description:
${body}

${extraContext ? `Code changes and additional context:\n${extraContext}` : ""}`;

  try {
    const completion = await groq.chat.completions.create({
      model: config.groq.model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "system", content: ANALYSIS_PROMPT },
        { role: "user", content: userMessage },
      ],
      max_tokens: 500,
      temperature: 0.3,
    });

    const raw = completion.choices[0]?.message?.content?.trim() || "";
    const cleaned = cleanLLMJson(raw);
    const parsed = JSON.parse(cleaned);

    return {
      summary: parsed.summary || "Update detected.",
      category: parsed.category || "Other",
      importance: Math.min(10, Math.max(1, parsed.importance || 5)),
      relatedFeatures: parsed.relatedFeatures || [],
      breakingChanges: parsed.breakingChanges || false,
      nodeOperatorAction: parsed.nodeOperatorAction || false,
    };
  } catch (err) {
    console.error("LLM analysis failed:", err);
    return {
      summary: `${item.tag_name ? "New release" : "PR merged"}: ${item.title || item.tag_name}`,
      category: item.tag_name ? "Release" : "Other",
      importance: item.tag_name ? 7 : 4,
      relatedFeatures: [],
      breakingChanges: false,
      nodeOperatorAction: !!item.tag_name,
    };
  }
}

const THREAD_PROMPT = `You are writing an X (Twitter) thread as "Aptos Intelligence" — a technical account that explains every important code change in aptos-labs/aptos-core.

Generate a thread of 5-7 tweets. Each tweet MUST be under 280 characters. Return ONLY a valid JSON array of strings (no markdown fences, no explanation):

["tweet1", "tweet2", ...]

Thread structure:
1. HOOK: Who shipped what, PR number, one-line impact. Start with "Aptos Intelligence —" and the author's GitHub handle.
2. WHAT CHANGED: Name the specific files, structs, functions, config knobs that were added/modified. Be concrete.
3. WHY IT MATTERS: What problem does this solve? What attack/inefficiency/limitation did it fix?
4. HOW IT WORKS: Explain the actual code pattern. Name the struct fields, the function signatures, the control flow.
5. BIGGER PICTURE: How does this connect to Raptr, Zaptos, Archon, Block-STM v2, Shardines, encrypted mempool?
6. RESULT: What's the net effect for validators, builders, or users?
7. (Optional) SHOUTOUT + what's next.

Rules:
- Be specific. Name functions, structs, files. "PerBatchKindTxnLimits" not "new struct".
- No generic hype. Technical precision over marketing language.
- Each tweet must stand alone but flow as a narrative.
- Use code-style backticks sparingly (they render on X).
- End with #Aptos hashtag on the last tweet only.

${APTOS_ARCHITECTURE_CONTEXT}`;

export async function generateThread(
  item: GitHubItem,
  analysis: UpdateAnalysis,
  codeContext: string
): Promise<string[]> {
  const title = item.tag_name ? `Release ${item.tag_name}` : item.title || "Unknown";
  const body = (item.body || "").slice(0, 4000);
  const prNumber = item.html_url?.match(/\/pull\/(\d+)/)?.[1] || "unknown";

  const userMessage = `PR #${prNumber}: ${title}
Author: ${item.user?.login || "unknown"}
Category: ${analysis.category}
Importance: ${analysis.importance}/10
${item.merged_at ? `Merged: ${item.merged_at}` : ""}

PR Description:
${body}

Code changes (diffs and file list):
${codeContext.slice(0, 6000)}

Analysis summary: ${analysis.summary}`;

  try {
    const completion = await groq.chat.completions.create({
      model: config.groq.model,
      messages: [
        { role: "system", content: THREAD_PROMPT },
        { role: "user", content: userMessage },
      ],
      max_tokens: 2000,
      temperature: 0.5,
    });

    const raw = completion.choices[0]?.message?.content?.trim() || "";
    const cleaned = cleanLLMJson(raw);
    const tweets: string[] = JSON.parse(cleaned);

    // Validate each tweet is under 280 chars
    return tweets
      .filter((t) => typeof t === "string" && t.trim().length > 0)
      .map((t) => t.trim().slice(0, 280));
  } catch (err) {
    console.error("Thread generation failed:", err);
    // Fallback: simple 3-tweet thread
    return [
      `Aptos Intelligence — @${item.user?.login || "unknown"} just shipped PR #${prNumber}: ${(item.title || "").slice(0, 180)}`,
      analysis.summary.slice(0, 280),
      `${item.html_url}\n\n#Aptos`,
    ];
  }
}

const WEB_REPORT_PROMPT = `You are writing a detailed technical report for the "Aptos Intelligence" website. Your readers are developers and researchers who want to deeply understand Aptos internals. Your reports should TEACH — after reading, someone should understand a new piece of how Aptos works.

Generate TWO versions — return ONLY valid JSON (no markdown fences, no extra text before or after the JSON):

{
  "advanced": "Detailed technical HTML analysis...",
  "eli5": "Simple explanation in HTML..."
}

=== ADVANCED VERSION RULES ===

Structure your report with these sections (use <h3> for each heading):

1. <h3>What Changed</h3>
   - 2-3 sentences summarizing the change. Name the specific PR, files modified, and the core structs/functions/traits touched.
   - Example: "This PR modifies <code>consensus/src/quorum_store/batch_coordinator.rs</code> to add a new <code>PerBatchKindTxnLimits</code> struct that enforces per-batch-type transaction limits."

2. <h3>Where This Fits in Aptos</h3>
   - Map the change to a specific stage in the transaction lifecycle pipeline:
     Client -> Mempool -> Quorum Store (batching) -> Consensus (Raptr/Prefix ordering) -> Execution (Block-STM parallel) -> Storage (Jellyfish Merkle Tree)
   - Show the pipeline in a simple text diagram using <pre><code> tags to make the position clear. Bold or mark where this change applies. Example:
     Client -> Mempool -> [QUORUM STORE **here**] -> Consensus -> Execution -> Storage
   - Explain which specific subsystem this touches and what role that subsystem plays.

3. <h3>How It Works (Step by Step)</h3>
   - Walk through the actual control flow. Be specific: "When a validator receives a new batch, it calls <code>BatchCoordinator::handle_batch()</code>, which now checks the <code>per_kind_limits</code> field..."
   - Reference actual function names, struct fields, trait implementations from the diff.
   - Include 1-2 short code snippets from the diff in <pre><code> blocks if available. Only include the most illuminating lines, not huge blocks.
   - Explain the before/after: what was the old behavior and what is the new behavior?

4. <h3>Why This Matters</h3>
   - What concrete problem does this solve? Name the specific failure mode, attack vector, performance bottleneck, or limitation.
   - Quantify impact if possible (e.g., "reduces batch validation latency by eliminating redundant signature checks" or "prevents a DoS vector where oversized batches could stall the Quorum Store pipeline").

5. <h3>Architectural Connections</h3>
   - How does this change interact with other Aptos subsystems?
   - Does it lay groundwork for upcoming features like Zaptos (optimistic pipelining), Shardines (validator sharding), Archon (proxy-primary), or encrypted mempool (BIBE)?
   - What would break or improve in adjacent subsystems as a result of this change?

HTML formatting rules:
- Use <h3>, <p>, <ul>/<li>, <code> (inline), <pre><code> (blocks), <strong> tags
- Be technically precise. Name every struct, function, file, and config parameter from the diff.
- Do NOT use generic filler phrases like "enhances security and stability" or "improves overall performance." Always explain the specific mechanism.
- Target length: 5-8 substantial paragraphs across all sections.

=== ELI5 VERSION RULES ===

Write as if explaining to a smart teenager who has never programmed but is curious about how blockchains work.

Structure:
1. <p><strong>The Big Picture:</strong> Start with a vivid analogy that captures what this part of Aptos does. Be creative and specific — not just "imagine a mailbox" but something that captures the actual mechanism. Examples:
   - For Quorum Store: "Imagine a school cafeteria where instead of every kid waiting in one long line, groups of friends collect all their orders into one tray, and 3 different lunch ladies check the tray is legit before sending it to the kitchen."
   - For Block-STM: "Imagine 100 artists painting different parts of a mural at the same time. Most of the time they're working on different sections. But if two artists accidentally paint the same spot, one has to redo their section — which is rare, so the mural gets done way faster than if they took turns."
   - For consensus: "Imagine 100 referees at a sports game. Instead of one head referee making all the calls, EVERY referee makes a call on EVERY play, and they use a voting system to agree on the final call. No single ref can cheat because 67 others would overrule them."

2. <p><strong>What Changed:</strong> Explain the specific change using your analogy. What was added, removed, or fixed? Keep the analogy consistent.

3. <p><strong>Why It Matters:</strong> What gets better for regular people? Faster? Safer? Cheaper? More fair? Connect it to something they care about.

4. <p><strong>What You Learned:</strong> End with a 1-2 sentence summary of the Aptos concept they just learned. Example: "You just learned about Quorum Store — the system that bundles transactions into batches so Aptos consensus doesn't have to process them one by one."

Rules:
- Use <p> tags for paragraphs, <strong> for emphasis. No code, no jargon.
- Be genuinely fun and engaging, not condescending.
- Each ELI5 should teach exactly ONE concept about how Aptos works.
- 4 paragraphs (one per section above).

${APTOS_ARCHITECTURE_CONTEXT}`;

export async function generateWebReport(
  item: GitHubItem,
  analysis: UpdateAnalysis,
  codeContext?: string
): Promise<{ advanced: string; eli5: string }> {
  const title = item.tag_name ? `Release ${item.tag_name}` : item.title || "Unknown";
  const body = (item.body || "").slice(0, 4000);
  const labels = item.labels?.map((l) => l.name).join(", ") || "none";

  const userMessage = `Title: ${title}
Author: ${item.user?.login || "unknown"}
Category: ${analysis.category}
Importance: ${analysis.importance}/10
Labels: ${labels}
Related features: ${analysis.relatedFeatures.join(", ") || "none"}
Summary: ${analysis.summary}
${item.merged_at ? `Merged: ${item.merged_at}` : ""}
${item.tag_name ? "Type: Release" : "Type: Merged PR"}

Full description:
${body}

${codeContext ? `Code changes:\n${codeContext.slice(0, 6000)}` : ""}`;

  try {
    const completion = await groq.chat.completions.create({
      model: config.groq.model,
      messages: [
        { role: "system", content: WEB_REPORT_PROMPT },
        { role: "user", content: userMessage },
      ],
      max_tokens: 4000,
      temperature: 0.4,
    });

    const raw = completion.choices[0]?.message?.content?.trim() || "";
    const cleaned = cleanLLMJson(raw);
    const parsed = JSON.parse(cleaned);

    return {
      advanced: parsed.advanced || `<p>${analysis.summary}</p>`,
      eli5: parsed.eli5 || `<p>${analysis.summary}</p>`,
    };
  } catch (err) {
    console.error("Web report generation failed:", err);
    return {
      advanced: `<h3>What changed</h3><p>${analysis.summary}</p>`,
      eli5: `<p>${analysis.summary}</p>`,
    };
  }
}

export async function generateWeeklyRecap(entries: Array<{ category: string; summary: string; importance: number }>): Promise<string> {
  const entriesSummary = entries
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 10)
    .map((e, i) => `${i + 1}. [${e.category}] (importance: ${e.importance}) ${e.summary}`)
    .join("\n");

  try {
    const completion = await groq.chat.completions.create({
      model: config.groq.model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Write a concise weekly recap thread (max 4 tweets worth of content) summarizing these Aptos Core updates from the past week. Group by theme, highlight the most important changes, and explain how they connect to the bigger architectural vision. Be technically precise.\n\nUpdates:\n${entriesSummary}`,
        },
      ],
      max_tokens: 600,
      temperature: 0.5,
    });

    return completion.choices[0]?.message?.content?.trim() || "Weekly recap unavailable.";
  } catch {
    return "Weekly recap generation failed.";
  }
}

/**
 * Robustly clean LLM output for JSON.parse().
 * Strips markdown fences, control characters (except \n and \t),
 * and handles common LLM output quirks.
 */
function cleanLLMJson(raw: string): string {
  let cleaned = raw
    // Remove markdown code fences (```json ... ``` or ``` ... ```)
    .replace(/```json?\s*\n?/g, "")
    .replace(/```\s*/g, "")
    // Remove any leading text before the first { or [
    .replace(/^[^[{]*(?=[\[{])/, "")
    // Remove any trailing text after the last } or ]
    .replace(/(?<=[\]}])[^}\]]*$/, "")
    // Strip ALL control characters except newline (\x0A) and tab (\x09)
    // This catches \x00-\x08, \x0B, \x0C, \x0D-\x1F, and \x7F
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    // Also handle \r\n -> \n and lone \r -> \n
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();

  // If JSON still fails to parse, try to extract the JSON object/array
  try {
    JSON.parse(cleaned);
    return cleaned;
  } catch {
    // Try to find JSON object or array boundaries
    const firstBrace = cleaned.indexOf("{");
    const firstBracket = cleaned.indexOf("[");
    const start = firstBrace >= 0 && (firstBracket < 0 || firstBrace < firstBracket) ? firstBrace : firstBracket;

    if (start < 0) return cleaned;

    const isObject = cleaned[start] === "{";
    const close = isObject ? "}" : "]";

    // Find matching closing brace/bracket from the end
    const lastClose = cleaned.lastIndexOf(close);
    if (lastClose <= start) return cleaned;

    const extracted = cleaned.slice(start, lastClose + 1);

    // Final cleanup: escape unescaped newlines inside string values
    // This handles cases where the LLM puts literal newlines inside JSON string values
    try {
      JSON.parse(extracted);
      return extracted;
    } catch {
      // Replace literal newlines inside strings with \\n
      const fixedNewlines = extracted.replace(
        /"(?:[^"\\]|\\.)*"/g,
        (match) => match.replace(/\n/g, "\\n").replace(/\t/g, "\\t")
      );
      return fixedNewlines;
    }
  }
}
