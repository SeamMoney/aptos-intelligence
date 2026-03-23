import { useState, useEffect, useCallback } from "react";
import type { WebReport, FeatureStatus } from "./api";
import { fetchReports, fetchFeatures } from "./api";

import GridLoader from "@/components/smoothui/grid-loader";
import InfiniteSlider from "@/components/smoothui/infinite-slider";
import RevealText from "@/components/smoothui/reveal-text";
import ScrambleHover from "@/components/smoothui/scramble-hover";
import Skeleton from "@/components/smoothui/skeleton";

const CATEGORIES = ["All", "Release", "Feature Progress", "Security", "Performance", "Infrastructure"];

function badgeColor(cat: string) {
  const map: Record<string, string> = {
    Release: "text-blue-400 bg-blue-400/10 border-blue-400/20",
    "Feature Progress": "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
    Security: "text-red-400 bg-red-400/10 border-red-400/20",
    Performance: "text-amber-400 bg-amber-400/10 border-amber-400/20",
    Infrastructure: "text-slate-400 bg-slate-400/10 border-slate-400/20",
  };
  return map[cat] || "text-slate-400 bg-slate-400/10 border-slate-400/20";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function Dashboard() {
  const [reports, setReports] = useState<WebReport[]>([]);
  const [features, setFeatures] = useState<FeatureStatus[]>([]);
  const [activeReport, setActiveReport] = useState<WebReport | null>(null);
  const [activeCategory, setActiveCategory] = useState("All");
  const [activeTab, setActiveTab] = useState<"advanced" | "eli5">("advanced");
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [reps, feats] = await Promise.all([fetchReports(), fetchFeatures()]);
      setReports(reps);
      setFeatures(feats);
      if (reps.length > 0 && !activeReport) setActiveReport(reps[0]);
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = reports.filter((r) => {
    if (activeCategory !== "All" && r.category !== activeCategory) return false;
    if (searchQuery && !r.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const totalImportance = reports.reduce((sum, r) => sum + r.importance, 0);
  const avgImportance = reports.length ? Math.round(totalImportance / reports.length * 10) / 10 : 0;

  return (
    <div className="flex h-screen overflow-hidden bg-[#0a0a0f]">

      {/* ── SIDEBAR ── */}
      <div className="w-[380px] min-w-[380px] border-r border-white/5 flex flex-col">

        {/* Header */}
        <div className="p-5 border-b border-white/5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-emerald-400 leading-tight">Aptos Intelligence</h1>
              <p className="text-xs text-white/40 mt-1">Every commit that matters — explained</p>
            </div>
            <span className="text-xs font-mono bg-emerald-400/10 text-emerald-400 px-2 py-1 rounded-full">{reports.length}</span>
          </div>
        </div>

        {/* Search + Filters */}
        <div className="p-4 border-b border-white/5 space-y-3">
          <input
            type="text"
            placeholder="Search reports..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-emerald-400/40 transition-colors"
          />
          <div className="flex gap-1.5 flex-wrap">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`text-xs px-3 py-1.5 rounded-md transition-colors ${
                  activeCategory === cat
                    ? "bg-emerald-400/20 text-emerald-400"
                    : "bg-white/5 text-white/40 hover:text-white/60 hover:bg-white/10"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Report list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loading ? (
            <div className="p-8 flex flex-col items-center gap-4">
              <GridLoader pattern="plus-hollow" mode="pulse" />
              <Skeleton width="80%" height={16} />
              <Skeleton width="60%" height={16} />
              <Skeleton width="70%" height={16} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-white/30 text-sm">
              <p className="text-lg">No reports found</p>
              <p className="mt-2">Adjust filters or wait for the bot to analyze new commits.</p>
            </div>
          ) : (
            filtered.map((r) => (
              <div
                key={r.id}
                onClick={() => { setActiveReport(r); setActiveTab("advanced"); }}
                className={`cursor-pointer rounded-lg p-4 transition-all border ${
                  activeReport?.id === r.id
                    ? "border-emerald-400/30 bg-emerald-400/5"
                    : "border-transparent hover:bg-white/[0.04]"
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded-md border font-mono ${badgeColor(r.category)}`}>
                    {r.category}
                  </span>
                  <span className={`text-[10px] font-mono ${r.importance >= 8 ? "text-red-400" : r.importance >= 6 ? "text-amber-400" : "text-white/30"}`}>
                    {r.importance}/10
                  </span>
                </div>
                <ScrambleHover duration={400} className="text-sm font-medium text-white/90 leading-snug line-clamp-2 block">
                  {r.title}
                </ScrambleHover>
                <div className="flex justify-between mt-3 text-[11px] text-white/30">
                  <span>{r.author}</span>
                  <span>{formatDate(r.date)}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer stats */}
        <div className="p-4 border-t border-white/5 flex items-center gap-6 text-xs text-white/40">
          <span><span className="text-white/70 font-medium">{reports.length}</span> reports</span>
          <span>avg <span className="text-white/70 font-medium">{avgImportance}</span>/10</span>
          <span><span className="text-white/70 font-medium">{features.length}</span> features</span>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Ticker */}
        {reports.length > 0 && (
          <div className="border-b border-white/5 px-6 py-2.5">
            <InfiniteSlider gap={32} speed={40}>
              {reports.slice(0, 20).map((r) => (
                <span
                  key={r.id}
                  className="whitespace-nowrap text-xs text-white/30 hover:text-emerald-400 cursor-pointer transition-colors"
                  onClick={() => setActiveReport(r)}
                >
                  <span className={`inline-block w-1.5 h-1.5 rounded-full mr-2 ${r.importance >= 7 ? "bg-red-400" : r.importance >= 5 ? "bg-amber-400" : "bg-white/20"}`} />
                  {r.title}
                </span>
              ))}
            </InfiniteSlider>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {!activeReport ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-white/20">
              <RevealText direction="up" className="text-2xl font-light">Select a report to begin</RevealText>
              <p className="text-sm max-w-md text-center">
                Each update has Advanced and ELI5 explanations powered by AI analysis of Aptos-core commits.
              </p>
            </div>
          ) : (
            <div className="p-8 max-w-4xl mx-auto space-y-6">

              {/* Report header */}
              <div>
                <RevealText direction="up">
                  <h2 className="text-2xl font-semibold text-white leading-tight">
                    {activeReport.title}
                  </h2>
                </RevealText>
                <div className="flex items-center flex-wrap gap-3 mt-3 text-sm text-white/40">
                  <img
                    src={`https://github.com/${activeReport.author}.png`}
                    alt={activeReport.author}
                    className="w-6 h-6 rounded-full"
                  />
                  <span>{activeReport.author}</span>
                  <span className="text-white/20">·</span>
                  <span>{formatDate(activeReport.date)}</span>
                  <span className={`px-2 py-0.5 rounded border text-xs font-mono ${badgeColor(activeReport.category)}`}>
                    {activeReport.category}
                  </span>
                  <span className={`text-xs font-mono ${activeReport.importance >= 8 ? "text-red-400" : activeReport.importance >= 6 ? "text-amber-400" : "text-white/40"}`}>
                    {activeReport.importance}/10
                  </span>
                  <a
                    href={activeReport.sourceUrl}
                    target="_blank"
                    rel="noopener"
                    className="text-emerald-400 hover:underline text-xs ml-auto"
                  >
                    View on GitHub →
                  </a>
                </div>
              </div>

              {/* Tab switcher */}
              <div className="flex gap-1 bg-white/5 rounded-lg p-1 w-fit">
                <button
                  onClick={() => setActiveTab("advanced")}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeTab === "advanced"
                      ? "bg-emerald-400/20 text-emerald-400"
                      : "text-white/40 hover:text-white/60"
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                  Advanced
                </button>
                <button
                  onClick={() => setActiveTab("eli5")}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeTab === "eli5"
                      ? "bg-emerald-400/20 text-emerald-400"
                      : "text-white/40 hover:text-white/60"
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  ELI5
                </button>
              </div>

              {/* Report content */}
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
                <div className="prose prose-invert max-w-none prose-headings:text-white/90 prose-p:text-white/70 prose-li:text-white/70 prose-code:text-emerald-400 prose-pre:bg-black/40 prose-pre:border prose-pre:border-white/10 prose-a:text-emerald-400">
                  {activeTab === "advanced" ? (
                    <div dangerouslySetInnerHTML={{ __html: activeReport.advanced }} />
                  ) : (
                    <div className="text-lg leading-relaxed" dangerouslySetInnerHTML={{ __html: activeReport.eli5 }} />
                  )}
                </div>
              </div>

              {/* Related features */}
              {activeReport.relatedFeatures.length > 0 && (
                <div className="border-t border-white/5 pt-4">
                  <div className="text-[10px] uppercase tracking-widest text-white/30 mb-3">Related Features</div>
                  <div className="flex flex-wrap gap-2">
                    {activeReport.relatedFeatures.map((f) => (
                      <span key={f} className="px-3 py-1 rounded-lg text-xs bg-emerald-400/10 text-emerald-400 border border-emerald-400/20">
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
