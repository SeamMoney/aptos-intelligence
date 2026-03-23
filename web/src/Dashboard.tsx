import { useState, useEffect, useCallback } from "react";
import type { WebReport, FeatureStatus } from "./api";
import { fetchReports, fetchFeatures } from "./api";

const CATEGORIES = ["All", "Release", "Feature Progress", "Security", "Performance", "Infrastructure"];

function badgeColor(cat: string): string {
  const map: Record<string, string> = {
    Release: "var(--color-info)",
    "Feature Progress": "var(--color-success)",
    Security: "var(--color-danger)",
    Performance: "var(--color-warning)",
    Infrastructure: "var(--color-text-faint)",
  };
  return map[cat] || "var(--color-text-faint)";
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
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = reports.filter((r) => {
    if (activeCategory !== "All" && r.category !== activeCategory) return false;
    if (searchQuery && !r.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "var(--color-bg)" }}>

      {/* ══════ SIDEBAR ══════ */}
      <div style={{
        width: 360, minWidth: 360, display: "flex", flexDirection: "column",
        background: "var(--color-background-alt)",
        borderRight: "1px solid var(--color-border)",
      }}>

        {/* Header */}
        <div style={{ padding: "20px", borderBottom: "1px solid var(--color-border)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <h1 style={{ fontFamily: "'Inter', system-ui", fontSize: 15, fontWeight: 800, color: "var(--color-accent)", letterSpacing: "0.08em", textTransform: "uppercase" as const, margin: 0 }}>
                Aptos Intelligence
              </h1>
              <p className="label-specimen-sm" style={{ color: "var(--color-text-faint)", marginTop: 6 }}>
                Real-time commit analysis · aptos-core
              </p>
            </div>
            <div className="clip-specimen-sm" style={{
              background: "color-mix(in srgb, var(--color-accent) 10%, transparent)",
              padding: "4px 8px",
              border: "1px solid color-mix(in srgb, var(--color-accent) 20%, transparent)",
            }}>
              <span className="label-specimen" style={{ color: "var(--color-accent)" }}>{reports.length}</span>
            </div>
          </div>
        </div>

        {/* Search + Filters */}
        <div style={{ padding: 16, borderBottom: "1px solid var(--color-border)" }}>
          <input
            type="text"
            placeholder="SEARCH REPORTS..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="label-specimen"
            style={{
              width: "100%", boxSizing: "border-box" as const,
              padding: "10px 12px",
              background: "var(--color-surface)", border: "1px solid var(--color-border)",
              color: "var(--color-text)", outline: "none",
              fontSize: 10,
            }}
          />
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" as const, marginTop: 12 }}>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className="label-specimen-sm"
                style={{
                  padding: "6px 10px", cursor: "pointer",
                  background: activeCategory === cat ? "color-mix(in srgb, var(--color-accent) 12%, transparent)" : "var(--color-surface)",
                  color: activeCategory === cat ? "var(--color-accent)" : "var(--color-text-faint)",
                  border: `1px solid ${activeCategory === cat ? "color-mix(in srgb, var(--color-accent) 30%, transparent)" : "var(--color-border-muted)"}`,
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Report list */}
        <div className="stagger-children" style={{ flex: 1, overflowY: "auto" as const, padding: 8 }}>
          {loading ? (
            <div style={{ padding: 32 }}>
              {[1,2,3,4,5].map((i) => (
                <div key={i} className="skeleton-mech" style={{ height: 12, marginBottom: 12, width: `${70 + (i % 3) * 10}%` }} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="tyvek-label" style={{ margin: 24, padding: 32, textAlign: "center" as const }}>
              <p className="label-specimen" style={{ color: "var(--color-text-faint)" }}>No reports match filter</p>
            </div>
          ) : (
            filtered.map((r) => {
              const isActive = activeReport?.id === r.id;
              return (
                <div
                  key={r.id}
                  onClick={() => { setActiveReport(r); setActiveTab("advanced"); }}
                  style={{
                    cursor: "pointer", padding: 14, marginBottom: 2,
                    background: isActive ? "var(--color-surface)" : "transparent",
                    borderLeft: isActive ? "2px solid var(--color-accent)" : "2px solid transparent",
                    transition: "all 0.12s ease",
                  }}
                  className={isActive ? "shadow-mech" : ""}
                  onMouseEnter={(e) => { if (!isActive) (e.currentTarget.style.background = "var(--color-surface)"); }}
                  onMouseLeave={(e) => { if (!isActive) (e.currentTarget.style.background = "transparent"); }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <span className="label-specimen-sm" style={{
                      padding: "3px 6px",
                      borderLeft: `2px solid ${badgeColor(r.category)}`,
                      color: badgeColor(r.category),
                    }}>
                      {r.category}
                    </span>
                    <span className="label-specimen" style={{
                      color: r.importance >= 8 ? "var(--color-danger)" : r.importance >= 6 ? "var(--color-warning)" : "var(--color-text-faint)",
                    }}>
                      {r.importance}/10
                    </span>
                  </div>
                  <p style={{
                    fontFamily: "'Inter', system-ui", fontSize: 13, fontWeight: 500,
                    color: "var(--color-text)", lineHeight: 1.4, margin: 0,
                    display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const, overflow: "hidden",
                  }}>
                    {r.title}
                  </p>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
                    <span className="label-specimen-sm" style={{ color: "var(--color-text-faint)" }}>{r.author}</span>
                    <span className="label-specimen-sm" style={{ color: "var(--color-text-faint)" }}>{formatDate(r.date)}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="bg-hazard-stripes" style={{
          padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between",
          borderTop: "1px solid var(--color-border)", background: "var(--color-surface)",
        }}>
          <span className="label-specimen-sm" style={{ color: "var(--color-text-faint)" }}>
            {reports.length} reports · {features.length} features
          </span>
          <span className="label-specimen-sm" style={{ color: "var(--color-accent)" }}>● LIVE</span>
        </div>
      </div>

      {/* ══════ MAIN CONTENT ══════ */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        <div style={{ flex: 1, overflowY: "auto" as const }}>
          {!activeReport ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", flexDirection: "column" as const, gap: 12 }}>
              <div className="corner-marks" style={{ padding: 32 }}>
                <p className="label-specimen" style={{ color: "var(--color-text-faint)" }}>SELECT A REPORT TO BEGIN ANALYSIS</p>
              </div>
            </div>
          ) : (
            <div className="animate-fade-in-up" key={activeReport.id} style={{ padding: 40, maxWidth: 800, margin: "0 auto" }}>

              {/* Meta bar */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                <span className="label-specimen-sm" style={{
                  padding: "4px 8px",
                  borderLeft: `2px solid ${badgeColor(activeReport.category)}`,
                  color: badgeColor(activeReport.category),
                }}>
                  {activeReport.category}
                </span>
                <span className="label-specimen" style={{
                  color: activeReport.importance >= 8 ? "var(--color-danger)" : activeReport.importance >= 6 ? "var(--color-warning)" : "var(--color-text-faint)",
                }}>
                  IMP {activeReport.importance}/10
                </span>
                <span className="label-specimen-sm" style={{ color: "var(--color-text-faint)" }}>{formatDate(activeReport.date)}</span>
              </div>

              {/* Title */}
              <h2 style={{
                fontFamily: "'Inter', system-ui", fontSize: 22, fontWeight: 800,
                color: "var(--color-text)", lineHeight: 1.3, margin: 0, letterSpacing: "-0.02em",
              }}>
                {activeReport.title}
              </h2>

              {/* Author line */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, marginBottom: 24 }}>
                <img
                  src={`https://github.com/${activeReport.author}.png`}
                  alt=""
                  style={{ width: 20, height: 20, clipPath: "polygon(3px 0, 100% 0, 100% calc(100% - 3px), calc(100% - 3px) 100%, 0 100%, 0 3px)" }}
                />
                <span className="label-specimen" style={{ color: "var(--color-text-muted)" }}>{activeReport.author}</span>
                <span style={{ color: "var(--color-border)", fontSize: 10 }}>│</span>
                <a
                  href={activeReport.sourceUrl}
                  target="_blank"
                  rel="noopener"
                  className="label-specimen"
                  style={{ color: "var(--color-accent)", textDecoration: "none" }}
                >
                  VIEW SOURCE →
                </a>
              </div>

              {/* Tabs */}
              <div style={{ display: "flex", borderBottom: "1px solid var(--color-border)", marginBottom: 0 }}>
                {(["advanced", "eli5"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className="label-specimen"
                    style={{
                      padding: "12px 20px", cursor: "pointer",
                      background: "transparent", border: "none",
                      color: activeTab === tab ? "var(--color-accent)" : "var(--color-text-faint)",
                      borderBottom: activeTab === tab ? "2px solid var(--color-accent)" : "2px solid transparent",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {tab === "advanced" ? "◆ ADVANCED" : "◇ ELI5"}
                  </button>
                ))}
              </div>

              {/* Content — clip-specimen + border-mech + corner-marks (AuraWallet's signature look) */}
              <div
                className="clip-specimen border-mech corner-marks"
                style={{ background: "var(--color-surface)", padding: 28, marginTop: -1 }}
                key={`${activeReport.id}-${activeTab}`}
              >
                <div className={activeTab === "advanced" ? "prose-mono" : "prose-eli5"}>
                  <div dangerouslySetInnerHTML={{ __html: activeTab === "advanced" ? activeReport.advanced : activeReport.eli5 }} />
                </div>
              </div>

              {/* Related features */}
              {activeReport.relatedFeatures.length > 0 && (
                <div style={{ marginTop: 20 }}>
                  <p className="label-specimen-sm" style={{ color: "var(--color-text-faint)", marginBottom: 8 }}>RELATED FEATURES</p>
                  <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 8 }}>
                    {activeReport.relatedFeatures.map((f) => (
                      <span
                        key={f}
                        className="clip-specimen-sm label-specimen-sm"
                        style={{
                          padding: "5px 12px",
                          background: "color-mix(in srgb, var(--color-accent) 8%, transparent)",
                          border: "1px solid color-mix(in srgb, var(--color-accent) 20%, transparent)",
                          color: "var(--color-accent)",
                        }}
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Barcode footer */}
              <div style={{
                display: "flex", alignItems: "center", gap: 12, marginTop: 28, paddingTop: 16,
                borderTop: "1px solid var(--color-border-muted)",
              }}>
                <span className="label-specimen-sm" style={{
                  fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.25em", color: "var(--color-border)",
                }}>
                  |||||||||||||||
                </span>
                <span className="label-specimen-sm" style={{ color: "var(--color-text-faint)" }}>
                  RPT-{String(activeReport.id).padStart(4, "0")} · {activeReport.category.toUpperCase()} · {activeReport.author.toUpperCase()}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
