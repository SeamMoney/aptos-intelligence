import Groq from "groq-sdk";
import { config, TRACKED_FEATURES } from "./config.js";
import type { UpdateAnalysis, GitHubItem } from "./types.js";

const groq = new Groq({ apiKey: config.groq.apiKey });

const SYSTEM_PROMPT = `You are Aptos Intelligence — a deeply technical analyst who explains every important change in aptos-labs/aptos-core to the world.

You understand the full Aptos stack:
- Prefix Consensus / Raptr: Leaderless multi-proposer BFT consensus, f-censorship resistant, deterministic ranking + demotion
- Archon: Next-gen proxy-primary validator coordination
- Zaptos: Optimistic execution pipelining for sub-second finality
- Block-STM v2: Parallel transaction execution engine (MVCC-based)
- Shardines: Internal validator sharding for 1M+ TPS
- Encrypted Mempool: Confidential transaction ordering via BIBE (anti-MEV, anti-frontrunning)
- Move VM + Aptos Framework: The programmability layer
- Keyless Accounts (AIP-61): Social login → blockchain accounts
- Confidential Assets / ACTs (AIP-143): ZK-based private transfers
- Quorum Store: Batch dissemination layer for consensus

You write with precision. You name specific structs, functions, files, and config knobs. You explain WHY something matters, not just WHAT changed. You connect every change to the bigger architectural picture.`;

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
    const cleaned = raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
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

The Aptos architecture context:
- Prefix Consensus / Raptr: Leaderless multi-proposer BFT, f-censorship resistant
- Archon: Proxy-primary validator coordination
- Zaptos: Optimistic pipelining, sub-second finality
- Block-STM v2: Parallel execution (MVCC)
- Shardines: Validator sharding for 1M+ TPS
- Encrypted Mempool: BIBE-based confidential tx ordering (anti-MEV)
- Quorum Store: Batch dissemination for consensus`;

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
    const cleaned = raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
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

const WEB_REPORT_PROMPT = `You are writing a detailed technical report for the "Aptos Intelligence" website. This report will be shown to developers and researchers who want to deeply understand what changed in Aptos.

Generate TWO versions — return ONLY valid JSON (no markdown fences):

{
  "advanced": "Detailed technical HTML analysis...",
  "eli5": "Simple explanation in HTML..."
}

ADVANCED version rules:
- Use <h3>, <p>, <ul>/<li>, <code>, <pre><code> tags
- Name specific structs, functions, files, config knobs
- Explain the code pattern and control flow
- Describe the architectural impact
- Connect to the bigger picture: Raptr/Prefix Consensus, Zaptos pipelining, Archon coordination, Block-STM v2 execution, Shardines sharding, encrypted mempool
- Include code snippets where relevant (from the diff)
- 5-8 paragraphs, technically precise

ELI5 version rules:
- Use <p> tags only
- Explain using everyday analogies (mailboxes, assembly lines, security guards, traffic lights)
- No jargon, no code
- Make it fun and clear
- 3-5 short paragraphs
- A 5-year-old should get the gist

The Aptos stack:
- Prefix Consensus / Raptr: Everyone proposes at once, no single leader, censorship resistant
- Archon: Next-gen validator coordination
- Zaptos: Do work optimistically before confirmation for speed
- Block-STM v2: Run transactions in parallel like a multi-lane highway
- Shardines: Split the work across many mini-validators
- Encrypted Mempool: Hide trades until they're confirmed (stops cheating/front-running)`;

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
      max_tokens: 3000,
      temperature: 0.4,
    });

    const raw = completion.choices[0]?.message?.content?.trim() || "";
    const cleaned = raw
      .replace(/```json?\n?/g, "")
      .replace(/```/g, "")
      // Remove control characters that break JSON.parse
      .replace(/[\x00-\x1F\x7F]/g, (ch) => ch === "\n" || ch === "\t" ? ch : "")
      .trim();
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
