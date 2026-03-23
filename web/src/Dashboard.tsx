import { useState, useEffect, useCallback } from "react";
import type { WebReport, FeatureStatus } from "./api";
import { fetchReports, fetchFeatures } from "./api";

const CATEGORIES = ["All", "Release", "Feature Progress", "Security", "Performance", "Infrastructure"];

function badgeColor(cat: string) {
  const map: Record<string, string> = {
    Release: "border-blue-500/30 text-blue-400 bg-blue-500/8",
    "Feature Progress": "border-emerald-500/30 text-emerald-400 bg-emerald-500/8",
    Security: "border-red-500/30 text-red-400 bg-red-500/8",
    Performance: "border-amber-500/30 text-amber-400 bg-amber-500/8",
    Infrastructure: "border-zinc-500/30 text-zinc-400 bg-zinc-500/8",
  };
  return map[cat] || "border-zinc-500/30 text-zinc-400 bg-zinc-500/8";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function importanceColor(n: number) {
  if (n >= 8) return "text-red-400";
  if (n >= 6) return "text-amber-400";
  return "text-[var(--text-faint)]";
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
      console.error("Failed to load:", err);
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

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg)" }}>

      {/* ══════ SIDEBAR ══════ */}
      <div className="w-[360px] min-w-[360px] flex flex-col" style={{ background: "var(--bg-alt)", borderRight: "1px solid var(--border)" }}>

        {/* Header */}
        <div className="p-5" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold tracking-tight" style={{ color: "var(--voltage)" }}>
                APTOS INTELLIGENCE
              </h1>
              <p className="label-specimen mt-1">Real-time commit analysis</p>
            </div>
            <div className="clip-specimen-sm px-2 py-1" style={{ background: "rgba(0,255,159,0.08)" }}>
              <span className="label-specimen" style={{ color: "var(--voltage)" }}>{reports.length}</span>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="p-4 space-y-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <input
            type="text"
            placeholder="Search reports..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 text-xs outline-none transition-all"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              color: "var(--text)",
              fontFamily: "var(--font-mono)",
            }}
            onFocus={(e) => e.target.style.borderColor = "var(--voltage)"}
            onBlur={(e) => e.target.style.borderColor = "var(--border)"}
          />

          {/* Category filters */}
          <div className="flex gap-1 flex-wrap">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className="label-specimen-sm px-2.5 py-1.5 transition-all"
                style={{
                  background: activeCategory === cat ? "rgba(0,255,159,0.1)" : "var(--surface)",
                  color: activeCategory === cat ? "var(--voltage)" : "var(--text-faint)",
                  border: `1px solid ${activeCategory === cat ? "rgba(0,255,159,0.3)" : "var(--border-muted)"}`,
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Report list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 stagger-children">
          {loading ? (
            <div className="p-8 space-y-3">
              {[80, 60, 70, 50, 65].map((w, i) => (
                <div key={i} className="hazard-stripe animate-pulse" style={{ width: `${w}%`, height: 12, background: "var(--surface)" }} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <p className="label-specimen">No reports match filter</p>
            </div>
          ) : (
            filtered.map((r) => (
              <div
                key={r.id}
                onClick={() => { setActiveReport(r); setActiveTab("advanced"); }}
                className={`cursor-pointer p-3.5 transition-all ${
                  activeReport?.id === r.id ? "shadow-mech" : "hover:shadow-mech-active"
                }`}
                style={{
                  background: activeReport?.id === r.id ? "var(--surface)" : "transparent",
                  borderLeft: activeReport?.id === r.id ? "2px solid var(--voltage)" : "2px solid transparent",
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`label-specimen-sm px-1.5 py-0.5 border ${badgeColor(r.category)}`}>
                    {r.category}
                  </span>
                  <span className={`label-specimen ${importanceColor(r.importance)}`}>
                    {r.importance}/10
                  </span>
                </div>
                <p className="text-[13px] font-medium leading-snug line-clamp-2" style={{ color: "var(--text)" }}>
                  {r.title}
                </p>
                <div className="flex justify-between mt-2.5">
                  <span className="label-specimen-sm">{r.author}</span>
                  <span className="label-specimen-sm">{formatDate(r.date)}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 flex items-center justify-between" style={{ borderTop: "1px solid var(--border)", background: "var(--surface)" }}>
          <span className="label-specimen-sm">{reports.length} reports · {features.length} features tracked</span>
          <span className="label-specimen-sm" style={{ color: "var(--voltage)" }}>LIVE</span>
        </div>
      </div>

      {/* ══════ MAIN CONTENT ══════ */}
      <div className="flex-1 flex flex-col overflow-hidden dot-texture">

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {!activeReport ? (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <div className="corner-marks p-8">
                <p className="label-specimen text-center">SELECT A REPORT TO BEGIN ANALYSIS</p>
              </div>
            </div>
          ) : (
            <div className="p-8 max-w-4xl mx-auto animate-fade-in-up" key={activeReport.id}>

              {/* Report header */}
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-3">
                  <span className={`label-specimen px-2 py-1 border ${badgeColor(activeReport.category)}`}>
                    {activeReport.category}
                  </span>
                  <span className={`label-specimen ${importanceColor(activeReport.importance)}`}>
                    IMPORTANCE {activeReport.importance}/10
                  </span>
                </div>

                <h2 className="text-xl font-bold tracking-tight mb-3" style={{ color: "var(--text)" }}>
                  {activeReport.title}
                </h2>

                <div className="flex items-center gap-3">
                  <img
                    src={`https://github.com/${activeReport.author}.png`}
                    alt=""
                    className="w-5 h-5"
                    style={{ clipPath: "polygon(3px 0, 100% 0, 100% calc(100% - 3px), calc(100% - 3px) 100%, 0 100%, 0 3px)" }}
                  />
                  <span className="label-specimen">{activeReport.author}</span>
                  <span className="label-specimen-sm" style={{ color: "var(--border)" }}>│</span>
                  <span className="label-specimen">{formatDate(activeReport.date)}</span>
                  <span className="label-specimen-sm" style={{ color: "var(--border)" }}>│</span>
                  <a
                    href={activeReport.sourceUrl}
                    target="_blank"
                    rel="noopener"
                    className="label-specimen transition-colors hover:underline"
                    style={{ color: "var(--voltage)" }}
                  >
                    VIEW SOURCE →
                  </a>
                </div>
              </div>

              {/* Tab switcher */}
              <div className="flex mb-6" style={{ borderBottom: "1px solid var(--border)" }}>
                <button
                  onClick={() => setActiveTab("advanced")}
                  className="label-specimen px-4 py-3 transition-all relative"
                  style={{
                    color: activeTab === "advanced" ? "var(--voltage)" : "var(--text-faint)",
                    borderBottom: activeTab === "advanced" ? "2px solid var(--voltage)" : "2px solid transparent",
                  }}
                >
                  ◆ ADVANCED
                </button>
                <button
                  onClick={() => setActiveTab("eli5")}
                  className="label-specimen px-4 py-3 transition-all"
                  style={{
                    color: activeTab === "eli5" ? "var(--voltage)" : "var(--text-faint)",
                    borderBottom: activeTab === "eli5" ? "2px solid var(--voltage)" : "2px solid transparent",
                  }}
                >
                  ◇ ELI5
                </button>
              </div>

              {/* Content card */}
              <div
                className="clip-specimen shadow-mech corner-marks p-6 mb-6 animate-terminal-open"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                key={`${activeReport.id}-${activeTab}`}
              >
                <div className="prose-mechanical">
                  {activeTab === "advanced" ? (
                    <div dangerouslySetInnerHTML={{ __html: activeReport.advanced }} />
                  ) : (
                    <div style={{ fontSize: 16, lineHeight: 1.8 }} dangerouslySetInnerHTML={{ __html: activeReport.eli5 }} />
                  )}
                </div>
              </div>

              {/* Related features */}
              {activeReport.relatedFeatures.length > 0 && (
                <div className="mb-6">
                  <p className="label-specimen-sm mb-2">RELATED FEATURES</p>
                  <div className="flex flex-wrap gap-2">
                    {activeReport.relatedFeatures.map((f) => (
                      <span
                        key={f}
                        className="clip-specimen-sm label-specimen-sm px-3 py-1.5"
                        style={{ background: "rgba(0,255,159,0.06)", border: "1px solid rgba(0,255,159,0.15)", color: "var(--voltage)" }}
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Barcode decoration */}
              <div className="flex items-center gap-2 pt-4" style={{ borderTop: "1px solid var(--border-muted)" }}>
                <span className="label-specimen-sm" style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.3em" }}>
                  |||||||||||||||
                </span>
                <span className="label-specimen-sm">
                  RPT-{String(activeReport.id).padStart(4, "0")} · {activeReport.category.toUpperCase()} · IMP:{activeReport.importance}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
