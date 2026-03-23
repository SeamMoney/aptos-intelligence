import { useState, useEffect, useCallback } from "react";
import type { WebReport, FeatureStatus } from "./api";
import { fetchReports, fetchFeatures } from "./api";

const CATEGORIES = ["All", "Release", "Feature Progress", "Security", "Performance", "Infrastructure"];

function catColor(cat: string) {
  const m: Record<string, string> = { Release: "#0047ff", "Feature Progress": "#00c853", Security: "#ef4444", Performance: "#ff4d00", Infrastructure: "#6b7280" };
  return m[cat] || "#6b7280";
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/* ── Barcode strip (exact AuraWallet Button decoration) ── */
function BarcodeStrip() {
  return (
    <span
      className="absolute right-0 top-0 bottom-0 w-[6px] pointer-events-none opacity-25"
      style={{
        backgroundImage:
          "repeating-linear-gradient(to bottom, var(--color-surface,#ffffff) 0px, var(--color-surface,#ffffff) 2px, transparent 2px, transparent 3px, var(--color-surface,#ffffff) 3px, var(--color-surface,#ffffff) 4px, transparent 4px, transparent 7px)",
      }}
    />
  );
}

/* ── Primary Button (exact AuraWallet) ── */
function MechButton({ children, active, onClick, className = "" }: {
  children: React.ReactNode; active?: boolean; onClick?: () => void; className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative clip-specimen-sm font-mono tracking-widest flex items-center justify-center transition-all
        ${active
          ? "bg-[var(--color-accent,#ccff00)] text-[var(--color-accent-foreground,#0a0a0a)] border border-[var(--color-accent,#ccff00)] shadow-mech-hover"
          : "bg-[var(--color-text,#f5f5f5)] text-[var(--color-surface,#1a1a1a)] border border-[var(--color-text,#f5f5f5)] shadow-mech hover:bg-[var(--color-accent,#ccff00)] hover:text-[var(--color-accent-foreground,#0a0a0a)] hover:border-[var(--color-accent,#ccff00)] hover:-translate-y-[1px] hover:-translate-x-[1px] active:translate-y-0 active:translate-x-0"
        }
        ${className}`}
    >
      <span className="relative z-[1]">{children}</span>
      <BarcodeStrip />
    </button>
  );
}

/* ── Secondary Button ── */
function GhostButton({ children, active, onClick, className = "" }: {
  children: React.ReactNode; active?: boolean; onClick?: () => void; className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`font-mono tracking-widest transition-all
        ${active
          ? "bg-[color-mix(in_srgb,var(--color-accent)_12%,transparent)] text-[var(--color-accent)] border border-[color-mix(in_srgb,var(--color-accent)_30%,transparent)]"
          : "bg-[var(--color-surface)] border border-[var(--color-border-muted)] text-[var(--color-text-muted)] hover:border-[var(--color-text)] hover:text-[var(--color-text)] hover:bg-[var(--color-background-alt)]"
        }
        ${className}`}
    >
      {children}
    </button>
  );
}

export default function Dashboard() {
  const [reports, setReports] = useState<WebReport[]>([]);
  const [features, setFeatures] = useState<FeatureStatus[]>([]);
  const [active, setActive] = useState<WebReport | null>(null);
  const [cat, setCat] = useState("All");
  const [tab, setTab] = useState<"advanced" | "eli5">("advanced");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, f] = await Promise.all([fetchReports(), fetchFeatures()]);
      setReports(r); setFeatures(f);
      if (r.length > 0 && !active) setActive(r[0]);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = reports.filter((r) => {
    if (cat !== "All" && r.category !== cat) return false;
    if (search && !r.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <>
      {/* SVG Filters for Tyvek Effect (exact AuraWallet) */}
      <svg style={{ position: "absolute", width: 0, height: 0 }}>
        <filter id="tyvekFilter">
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
          <feComponentTransfer>
            <feFuncR type="linear" slope="0.3" />
            <feFuncG type="linear" slope="0.3" />
            <feFuncB type="linear" slope="0.3" />
          </feComponentTransfer>
        </filter>
      </svg>

      <div className="relative isolate h-screen w-full overflow-hidden flex bg-[var(--color-background)]">

        {/* ══════ Background layers (exact AuraWallet ViewShell) ══════ */}
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
          {/* Grid */}
          <div className="absolute inset-0 bg-grid-adaptive bg-[size:4rem_4rem] opacity-30" />
          {/* Tyvek texture */}
          <div className="tyvek-texture" style={{ opacity: 0.12, zIndex: 0, pointerEvents: "none" }} />
          {/* Ghost watermark */}
          <div className="absolute bottom-[5%] right-[5%] opacity-[0.02] select-none">
            <div className="text-[12vw] font-black leading-none text-[var(--color-text)] font-mono tracking-tighter text-right">
              APTOS
            </div>
          </div>
          {/* Registration marks */}
          <div className="absolute top-10 left-[360px] w-24 h-24 border-l-4 border-t-4 border-[var(--color-text)] opacity-10">
            <div className="absolute top-2 left-2 w-3 h-3 bg-[var(--color-text)]" />
          </div>
          <div className="absolute bottom-10 right-10 w-24 h-24 border-r-4 border-b-4 border-[var(--color-text)] opacity-10 flex items-end justify-end">
            <div className="absolute bottom-2 right-2 w-3 h-3 bg-[var(--color-text)]" />
          </div>
        </div>

        {/* ══════ SIDEBAR (exact AuraWallet ViewShell pattern) ══════ */}
        <div
          className="h-full flex flex-col border-r border-[var(--color-border)] font-mono relative overflow-hidden shrink-0 z-10"
          style={{ width: 340, minWidth: 340, background: "var(--color-surface)", fontSize: "var(--font-size-sm)" }}
        >
          {/* Dot texture overlay (exact AuraWallet) */}
          <div className="absolute inset-0 opacity-[0.02] pointer-events-none bg-[radial-gradient(var(--color-text,#000)_1px,transparent_1px)] bg-[size:4px_4px]" />

          {/* Branding */}
          <div className="relative z-10 flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
            <div className="leading-tight">
              <div className="flex items-baseline gap-1.5">
                <span className="text-[11px] font-bold tracking-tight lowercase text-[var(--color-text)]">
                  aptos intelligence
                </span>
                <span className="label-specimen-sm text-[var(--color-text-muted)]">v1</span>
              </div>
              <span className="label-specimen-sm text-[var(--color-text-faint)] block mt-0.5">
                real-time commit analysis
              </span>
            </div>
            <div className="clip-specimen-sm bg-[var(--color-accent)] text-[var(--color-accent-foreground)] label-specimen px-2 py-1">
              {reports.length}
            </div>
          </div>

          {/* Search */}
          <div className="relative z-10 px-3 py-3 border-b border-[var(--color-border)]">
            <input
              type="text"
              placeholder="SEARCH..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="label-specimen w-full px-3 py-2.5 outline-none transition-all bg-[var(--color-background-alt)] border border-[var(--color-border)] text-[var(--color-text)] focus:border-[var(--color-border-focus)] focus:bg-[var(--color-surface)]"
              style={{ fontSize: 10 }}
            />
            <div className="flex gap-1 flex-wrap mt-2.5">
              {CATEGORIES.map((c) => (
                <GhostButton
                  key={c}
                  active={cat === c}
                  onClick={() => setCat(c)}
                  className="label-specimen-sm px-2 py-1.5 h-auto"
                >
                  {c}
                </GhostButton>
              ))}
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto relative z-10 stagger-children">
            {loading ? (
              <div className="p-4 space-y-3">
                {[1,2,3,4,5].map(i => (
                  <div key={i} className="skeleton-mech" style={{ height: 10, width: `${60 + i * 7}%` }} />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="tyvek-label m-4 p-6 text-center">
                <span className="label-specimen text-[var(--color-text-faint)]">NO RESULTS</span>
              </div>
            ) : filtered.map((r) => {
              const sel = active?.id === r.id;
              return (
                <div
                  key={r.id}
                  onClick={() => { setActive(r); setTab("advanced"); }}
                  className={`cursor-pointer px-4 py-3 transition-all border-l-2 ${
                    sel ? "border-l-[var(--color-accent)] bg-[var(--color-surface-alt)] shadow-mech" : "border-l-transparent hover:bg-[var(--color-surface-alt)]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="label-specimen-sm" style={{ color: catColor(r.category), borderLeft: `2px solid ${catColor(r.category)}`, paddingLeft: 6 }}>
                      {r.category}
                    </span>
                    <span className={`label-specimen ${r.importance >= 8 ? "text-[var(--color-danger)]" : r.importance >= 6 ? "text-[var(--color-warning)]" : "text-[var(--color-text-faint)]"}`}>
                      {r.importance}/10
                    </span>
                  </div>
                  <p className="text-[12px] font-medium leading-snug text-[var(--color-text)] line-clamp-2 font-sans m-0">
                    {r.title}
                  </p>
                  <div className="flex justify-between mt-2">
                    <span className="label-specimen-sm text-[var(--color-text-faint)]">{r.author}</span>
                    <span className="label-specimen-sm text-[var(--color-text-faint)]">{fmtDate(r.date)}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="relative z-10 border-t border-[var(--color-border)] bg-hazard-stripes px-4 py-2.5 flex items-center justify-between">
            <span className="label-specimen-sm text-[var(--color-text-faint)]">{reports.length} reports · {features.length} features</span>
            <span className="label-specimen-sm text-[var(--color-accent)]">● LIVE</span>
          </div>
        </div>

        {/* ══════ MAIN CONTENT ══════ */}
        <div className="flex-1 overflow-y-auto relative z-10">
          {!active ? (
            <div className="flex items-center justify-center h-full">
              <div className="corner-marks p-10">
                <p className="label-specimen text-[var(--color-text-faint)]">SELECT A REPORT TO BEGIN ANALYSIS</p>
              </div>
            </div>
          ) : (
            <div className="animate-fade-in-up p-10 max-w-[820px] mx-auto" key={active.id}>

              {/* Meta */}
              <div className="flex items-center gap-3 mb-5">
                <span className="label-specimen-sm" style={{ color: catColor(active.category), borderLeft: `2px solid ${catColor(active.category)}`, paddingLeft: 6 }}>
                  {active.category}
                </span>
                <span className={`label-specimen ${active.importance >= 8 ? "text-[var(--color-danger)]" : active.importance >= 6 ? "text-[var(--color-warning)]" : "text-[var(--color-text-faint)]"}`}>
                  IMP {active.importance}/10
                </span>
                <span className="label-specimen-sm text-[var(--color-text-faint)]">{fmtDate(active.date)}</span>
              </div>

              {/* Title */}
              <h2 className="text-[22px] font-extrabold text-[var(--color-text)] leading-[1.25] tracking-[-0.02em] font-sans m-0">
                {active.title}
              </h2>

              {/* Author */}
              <div className="flex items-center gap-2.5 mt-3 mb-6">
                <img src={`https://github.com/${active.author}.png`} alt="" className="w-5 h-5 clip-specimen-sm" />
                <span className="label-specimen text-[var(--color-text-muted)]">{active.author}</span>
                <span className="text-[var(--color-border)] text-[10px]">│</span>
                <a href={active.sourceUrl} target="_blank" rel="noopener" className="label-specimen text-[var(--color-accent)] no-underline hover:underline">
                  VIEW SOURCE →
                </a>
              </div>

              {/* Tab buttons (exact AuraWallet primary button style) */}
              <div className="flex gap-2 mb-5">
                <MechButton active={tab === "advanced"} onClick={() => setTab("advanced")} className="h-[32px] px-3 text-[10px] uppercase">
                  ◆ Advanced
                </MechButton>
                <MechButton active={tab === "eli5"} onClick={() => setTab("eli5")} className="h-[32px] px-3 text-[10px] uppercase">
                  ◇ ELI5
                </MechButton>
              </div>

              {/* Content card (clip-specimen + border-mech + corner-marks) */}
              <div className="clip-specimen border-mech corner-marks bg-[var(--color-surface)] p-7" key={`${active.id}-${tab}`}>
                <div className={tab === "advanced" ? "prose-mono" : "prose-eli5"}>
                  <div dangerouslySetInnerHTML={{ __html: tab === "advanced" ? active.advanced : active.eli5 }} />
                </div>
              </div>

              {/* Related features */}
              {active.relatedFeatures.length > 0 && (
                <div className="mt-5">
                  <p className="label-specimen-sm text-[var(--color-text-faint)] mb-2">RELATED FEATURES</p>
                  <div className="flex flex-wrap gap-2">
                    {active.relatedFeatures.map((f) => (
                      <span key={f} className="clip-specimen-sm label-specimen-sm px-3 py-1.5 bg-[color-mix(in_srgb,var(--color-accent)_8%,transparent)] border border-[color-mix(in_srgb,var(--color-accent)_20%,transparent)] text-[var(--color-accent)]">
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Barcode footer */}
              <div className="flex items-center gap-3 mt-7 pt-4 border-t border-[var(--color-border-muted)]">
                <span className="label-specimen-sm font-mono tracking-[0.25em] text-[var(--color-border)]">|||||||||||||||</span>
                <span className="label-specimen-sm text-[var(--color-text-faint)]">
                  RPT-{String(active.id).padStart(4, "0")} · {active.category.toUpperCase()} · {active.author.toUpperCase()}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
