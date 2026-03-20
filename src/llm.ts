import Groq from "groq-sdk";
import { config, TRACKED_FEATURES } from "./config.js";
import type { UpdateAnalysis, GitHubItem, WebReport } from "./types.js";

const groq = new Groq({ apiKey: config.groq.apiKey });

const SYSTEM_PROMPT = `You are an expert Aptos blockchain technical analyst working for the Aptos Intelligence Bot.
Your job is to analyze GitHub releases and merged PRs from the aptos-labs/aptos-core repository and produce structured analysis.

You deeply understand:
- Aptos Move VM, Block-STM parallel execution, and the Aptos framework
- AIPs (Aptos Improvement Proposals) and their lifecycle: Draft -> Review -> Accepted -> Implemented -> Deployed
- Key features being tracked: ${TRACKED_FEATURES.map((f) => `${f.key} (${f.name})`).join(", ")}
- Node operator concerns: version upgrades, breaking changes, config changes
- DeFi/developer impact: new APIs, framework changes, gas model updates

Always be accurate. If something is unclear, say so. Never speculate about deployment status.`;

const ANALYSIS_PROMPT = `Analyze this Aptos update and return ONLY valid JSON (no markdown, no code fences):

{
  "summary": "3-4 sentence human-readable explanation of what changed and why it matters. Use simple language. Explain technical terms briefly.",
  "category": "Release|Feature Progress|Security|Performance|Infrastructure|Other",
  "importance": <number 1-10, where 10=critical mainnet change, 7=significant feature, 5=routine, 3=minor fix>,
  "relatedFeatures": ["list of feature keys from tracked features if any match"],
  "breakingChanges": <true if node operators must act>,
  "nodeOperatorAction": <true if upgrade or config change needed>
}

Tracked feature keys: ${TRACKED_FEATURES.map((f) => f.key).join(", ")}

Be honest about importance. Most routine PRs are 3-5. Only releases and major feature PRs are 7+.`;

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

${extraContext ? `Additional context:\n${extraContext}` : ""}`;

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

const WEB_REPORT_PROMPT = `You are writing a detailed technical report about an Aptos blockchain code change for the "Aptos Intelligence" website.

Generate TWO versions of the analysis — return ONLY valid JSON (no markdown fences):

{
  "advanced": "A detailed technical analysis in HTML. Use <h3>, <p>, <ul>/<li>, <code>, and <pre> tags. Cover: (1) What exactly changed in the code (name specific structs, functions, files if mentioned), (2) How it works technically, (3) Why this matters for the Aptos network, (4) How it connects to the bigger picture (Raptr/Archon consensus, Zaptos pipelining, Block-STM execution, encrypted mempool, Shardines). Be specific about code patterns and architectural decisions. 4-6 paragraphs.",
  "eli5": "An ELI5 (Explain Like I'm 5) analysis in HTML. Use <p> tags and simple analogies. Explain what happened as if talking to someone who knows nothing about blockchain. Use everyday metaphors (mailboxes, traffic lights, assembly lines, etc). Make it fun and clear. 3-4 short paragraphs. No jargon."
}

The Aptos stack context:
- Prefix Consensus / Raptr: Leaderless multi-proposer BFT consensus (censorship resistant)
- Archon: Next-gen validator coordination with proxy-primary architecture
- Zaptos: Optimistic execution pipelining for low latency
- Block-STM v2: Parallel transaction execution engine
- Shardines: Internal validator sharding for 1M+ TPS
- Encrypted Mempool: Confidential transaction ordering (anti-MEV)

Be accurate. Don't speculate.`;

export async function generateWebReport(item: GitHubItem, analysis: UpdateAnalysis): Promise<{ advanced: string; eli5: string }> {
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
${body}`;

  try {
    const completion = await groq.chat.completions.create({
      model: config.groq.model,
      messages: [
        { role: "system", content: WEB_REPORT_PROMPT },
        { role: "user", content: userMessage },
      ],
      max_tokens: 2000,
      temperature: 0.4,
    });

    const raw = completion.choices[0]?.message?.content?.trim() || "";
    const cleaned = raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
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
          content: `Write a concise weekly recap thread (max 4 tweets worth of content) summarizing these Aptos Core updates from the past week. Group by theme, highlight the most important changes, and mention any feature progress. Keep it exciting but accurate.\n\nUpdates:\n${entriesSummary}`,
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
