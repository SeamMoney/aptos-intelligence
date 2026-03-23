import { useState, useEffect, useCallback } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { ArrowLeft, ChevronRight, Layers, Search, X } from "lucide-react";
import type { WebReport, FeatureStatus } from "./api";
import { fetchReports, fetchFeatures } from "./api";

const CATEGORIES = ["All", "Release", "Feature Progress", "Security", "Performance", "Infrastructure"];

function catColor(cat: string) {
  const m: Record<string, string> = { Release: "#0047ff", "Feature Progress": "#00c853", Security: "#ef4444", Performance: "#ff4d00", Infrastructure: "#6b7280" };
  return m[cat] || "#6b7280";
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function BarcodeStrip() {
  return (
    <span className="absolute right-0 top-0 bottom-0 w-[6px] pointer-events-none opacity-25" style={{
      backgroundImage: "repeating-linear-gradient(to bottom, var(--color-surface,#fff) 0px, var(--color-surface,#fff) 2px, transparent 2px, transparent 3px, var(--color-surface,#fff) 3px, var(--color-surface,#fff) 4px, transparent 4px, transparent 7px)",
    }} />
  );
}

function MechButton({ children, active, onClick, className = "" }: {
  children: React.ReactNode; active?: boolean; onClick?: () => void; className?: string;
}) {
  return (
    <button onClick={onClick} className={`relative clip-specimen-sm font-mono tracking-widest flex items-center justify-center transition-all
      ${active
        ? "bg-[var(--color-accent)] text-[var(--color-accent-foreground)] border border-[var(--color-accent)] shadow-mech-hover"
        : "bg-[var(--color-text)] text-[var(--color-surface)] border border-[var(--color-text)] shadow-mech hover:bg-[var(--color-accent)] hover:text-[var(--color-accent-foreground)] hover:border-[var(--color-accent)] hover:-translate-y-[1px] hover:-translate-x-[1px] active:translate-y-0 active:translate-x-0"
      } ${className}`}>
      <span className="relative z-[1]">{children}</span>
      <BarcodeStrip />
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN DASHBOARD — Timepage-style swipeable 3-panel layout
   ═══════════════════════════════════════════════════════════ */

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

  /* ── Swipe physics (Timepage pattern) ── */
  const x = useMotionValue(0);
  const DRAWER_W = 320;

  // Left drawer (report list) — revealed on swipe right
  const leftOpacity = useTransform(x, [0, 100, DRAWER_W], [0, 0.6, 1]);
  const leftScale = useTransform(x, [0, DRAWER_W], [0.92, 1]);

  // Right drawer (architecture/features) — revealed on swipe left
  const rightOpacity = useTransform(x, [-DRAWER_W, -100, 0], [1, 0.6, 0]);
  const rightScale = useTransform(x, [-DRAWER_W, 0], [1, 0.92]);

  const handleDragEnd = (_: any, { offset, velocity }: any) => {
    const thresh = 50, vThresh = 400;
    let target = 0;

    if (offset.x > thresh || velocity.x > vThresh) target = DRAWER_W;
    else if (offset.x < -thresh || velocity.x < -vThresh) target = -DRAWER_W;

    // Closing if already open
    if (x.get() > 100 && (offset.x < -thresh || velocity.x < -vThresh)) target = 0;
    if (x.get() < -100 && (offset.x > thresh || velocity.x > vThresh)) target = 0;

    animate(x, target, { type: "spring", stiffness: 250, damping: 28, mass: 0.8 });
  };

  const closeDrawer = () => animate(x, 0, { type: "spring", stiffness: 250, damping: 28 });
  const openLeft = () => animate(x, DRAWER_W, { type: "spring", stiffness: 250, damping: 28 });
  const openRight = () => animate(x, -DRAWER_W, { type: "spring", stiffness: 250, damping: 28 });

  function selectReport(r: WebReport) {
    setActive(r); setTab("advanced");
    closeDrawer();
  }

  /* ── Desktop static layout ── */
  const isDesktop = typeof window !== "undefined" && window.innerWidth >= 768;

  /* ═══════════════════════════════════════
     DESKTOP VIEW — sidebar + main (unchanged)
     ═══════════════════════════════════════ */
  if (isDesktop) return (
    <>
      <svg style={{ position: "absolute", width: 0, height: 0 }}>
        <filter id="tyvekFilter">
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
      </svg>

      <div className="hidden md:flex relative isolate h-screen w-full overflow-hidden bg-[var(--color-background)]">
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
          <div className="absolute inset-0 bg-grid-adaptive bg-[size:4rem_4rem] opacity-30" />
          <div className="tyvek-texture" style={{ opacity: 0.12 }} />
          <div className="absolute bottom-[5%] right-[5%] opacity-[0.02] select-none">
            <div className="text-[12vw] font-black leading-none text-[var(--color-text)] font-mono tracking-tighter text-right">APTOS</div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="h-full flex flex-col border-r border-[var(--color-border)] font-mono relative overflow-hidden shrink-0 z-10"
          style={{ width: 340, minWidth: 340, background: "var(--color-surface)", fontSize: "var(--font-size-sm)" }}>
          <div className="absolute inset-0 opacity-[0.02] pointer-events-none bg-[radial-gradient(var(--color-text,#000)_1px,transparent_1px)] bg-[size:4px_4px]" />

          <div className="relative z-10 flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
            <div className="leading-tight">
              <span className="text-[11px] font-bold tracking-tight lowercase text-[var(--color-text)]">aptos intelligence</span>
              <span className="label-specimen-sm text-[var(--color-text-faint)] block mt-0.5">real-time commit analysis</span>
            </div>
            <div className="clip-specimen-sm bg-[var(--color-accent)] text-[var(--color-accent-foreground)] label-specimen px-2 py-1">{reports.length}</div>
          </div>

          <div className="relative z-10 px-3 py-3 border-b border-[var(--color-border)]">
            <input type="text" placeholder="SEARCH..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="label-specimen w-full px-3 py-2.5 outline-none transition-all bg-[var(--color-background-alt)] border border-[var(--color-border)] text-[var(--color-text)] focus:border-[var(--color-border-focus)] focus:bg-[var(--color-surface)]"
              style={{ fontSize: 10 }} />
            <div className="flex gap-1 flex-wrap mt-2.5">
              {CATEGORIES.map((c) => (
                <button key={c} onClick={() => setCat(c)}
                  className={`label-specimen-sm px-2 py-1.5 font-mono tracking-widest transition-all ${cat === c
                    ? "bg-[color-mix(in_srgb,var(--color-accent)_12%,transparent)] text-[var(--color-accent)] border border-[color-mix(in_srgb,var(--color-accent)_30%,transparent)]"
                    : "bg-[var(--color-surface)] border border-[var(--color-border-muted)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"}`}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto relative z-10 stagger-children">
            {loading ? (
              <div className="p-4 space-y-3">{[1,2,3,4,5].map(i => <div key={i} className="skeleton-mech" style={{ height: 10, width: `${60+i*7}%` }} />)}</div>
            ) : filtered.map((r) => (
              <div key={r.id} onClick={() => { setActive(r); setTab("advanced"); }}
                className={`cursor-pointer px-4 py-3 transition-all border-l-2 ${active?.id === r.id ? "border-l-[var(--color-accent)] bg-[var(--color-surface-alt)] shadow-mech" : "border-l-transparent hover:bg-[var(--color-surface-alt)]"}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="label-specimen-sm" style={{ color: catColor(r.category), borderLeft: `2px solid ${catColor(r.category)}`, paddingLeft: 6 }}>{r.category}</span>
                  <span className={`label-specimen ${r.importance >= 8 ? "text-[var(--color-danger)]" : r.importance >= 6 ? "text-[var(--color-warning)]" : "text-[var(--color-text-faint)]"}`}>{r.importance}/10</span>
                </div>
                <p className="text-[12px] font-medium leading-snug text-[var(--color-text)] line-clamp-2 font-sans m-0">{r.title}</p>
                <div className="flex justify-between mt-2">
                  <span className="label-specimen-sm text-[var(--color-text-faint)]">{r.author}</span>
                  <span className="label-specimen-sm text-[var(--color-text-faint)]">{fmtDate(r.date)}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="relative z-10 border-t border-[var(--color-border)] bg-hazard-stripes px-4 py-2.5 flex items-center justify-between">
            <span className="label-specimen-sm text-[var(--color-text-faint)]">{reports.length} reports · {features.length} features</span>
            <span className="label-specimen-sm text-[var(--color-accent)]">● LIVE</span>
          </div>
        </div>

        {/* Main */}
        <div className="flex-1 overflow-y-auto relative z-10">
          {active && (
            <div className="animate-fade-in-up p-10 max-w-[820px] mx-auto" key={active.id}>
              <ReportView r={active} tab={tab} setTab={setTab} />
            </div>
          )}
        </div>
      </div>
    </>
  );

  /* ═══════════════════════════════════════
     MOBILE VIEW — Timepage swipeable panels
     ═══════════════════════════════════════ */
  return (
    <div className="relative w-full h-[100dvh] overflow-hidden bg-black select-none">

      {/* ── LEFT DRAWER (Report List) ── */}
      <motion.div
        className="absolute inset-0 bg-[var(--color-background)] px-5 pt-[env(safe-area-inset-top,20px)] overflow-hidden"
        style={{ opacity: leftOpacity, scale: leftScale }}
      >
        <div className="pt-4">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h1 className="text-[28px] font-bold tracking-tight text-[var(--color-accent)] leading-none" style={{ fontFamily: "var(--font-sans)" }}>
                REPORTS
              </h1>
              <p className="label-specimen-sm text-[var(--color-text-faint)] mt-1">{filtered.length} of {reports.length}</p>
            </div>
            <div className="clip-specimen-sm bg-[var(--color-accent)] text-[var(--color-accent-foreground)] label-specimen px-2.5 py-1.5">
              {reports.length}
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-faint)]" />
            <input type="text" placeholder="SEARCH..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="label-specimen w-full pl-9 pr-3 py-3 outline-none bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] focus:border-[var(--color-border-focus)]"
              style={{ fontSize: 10 }} />
          </div>

          {/* Filters — horizontal scroll */}
          <div className="flex gap-1.5 overflow-x-auto pb-3 no-scrollbar">
            {CATEGORIES.map((c) => (
              <button key={c} onClick={() => setCat(c)}
                className={`label-specimen-sm px-3 py-2 whitespace-nowrap shrink-0 font-mono tracking-widest transition-all ${cat === c
                  ? "bg-[var(--color-accent)] text-[var(--color-accent-foreground)]"
                  : "bg-[var(--color-surface)] text-[var(--color-text-faint)] border border-[var(--color-border-muted)]"}`}>
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Report list */}
        <div className="overflow-y-auto mt-2 pb-24 stagger-children" style={{ maxHeight: "calc(100dvh - 220px)" }}>
          {filtered.map((r) => (
            <div key={r.id} onClick={() => selectReport(r)}
              className="py-3.5 border-b border-[var(--color-border-muted)] cursor-pointer active:bg-[var(--color-surface-alt)] transition-colors">
              <div className="flex items-center justify-between mb-1">
                <span className="label-specimen-sm" style={{ color: catColor(r.category) }}>{r.category}</span>
                <span className={`label-specimen ${r.importance >= 8 ? "text-[var(--color-danger)]" : r.importance >= 6 ? "text-[var(--color-warning)]" : "text-[var(--color-text-faint)]"}`}>{r.importance}/10</span>
              </div>
              <p className="text-[14px] font-medium text-[var(--color-text)] leading-snug line-clamp-2 font-sans">{r.title}</p>
              <div className="flex items-center gap-2 mt-2">
                <img src={`https://github.com/${r.author}.png`} alt="" className="w-4 h-4 rounded-full" />
                <span className="label-specimen-sm text-[var(--color-text-faint)]">{r.author} · {fmtDate(r.date)}</span>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* ── RIGHT DRAWER (Architecture Overview) ── */}
      <motion.div
        className="absolute inset-0 bg-[var(--color-background)] px-6 pt-[env(safe-area-inset-top,20px)] overflow-y-auto"
        style={{ opacity: rightOpacity, scale: rightScale }}
      >
        <div className="pt-4 pb-24 max-w-[260px] ml-auto">
          <h1 className="label-specimen text-[var(--color-accent)] text-[14px] tracking-[0.2em] mb-8">ARCHITECTURE</h1>
          <div className="space-y-6">
            {[
              { name: "QUORUM STORE", desc: "Batch dissemination + proof collection", color: "#0047ff" },
              { name: "RAPTR / PREFIX", desc: "Leaderless multi-proposer BFT consensus", color: "#00c853" },
              { name: "BLOCK-STM", desc: "Parallel MVCC execution engine", color: "#ff4d00" },
              { name: "ZAPTOS", desc: "Optimistic pipelining before finality", color: "#ccff00" },
              { name: "ARCHON", desc: "Proxy-primary validator coordination", color: "#7c3aed" },
              { name: "SHARDINES", desc: "Internal validator sharding for >1M TPS", color: "#14b8a6" },
              { name: "ENCRYPTED MEMPOOL", desc: "BIBE confidential tx ordering (anti-MEV)", color: "#ef4444" },
              { name: "MOVE VM", desc: "Resource-oriented smart contract runtime", color: "#f59e0b" },
              { name: "JELLYFISH MERKLE", desc: "Sparse merkle tree state storage", color: "#8b5cf6" },
            ].map((sys) => (
              <div key={sys.name} className="flex items-start gap-3 cursor-pointer group">
                <div className="w-[6px] h-[20px] rounded-full mt-0.5 shrink-0" style={{ background: sys.color }} />
                <div>
                  <h3 className="label-specimen text-[var(--color-text)] group-hover:text-[var(--color-accent)] transition-colors">{sys.name}</h3>
                  <p className="text-[11px] text-[var(--color-text-faint)] mt-0.5 leading-snug font-sans">{sys.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Pipeline diagram */}
          <div className="mt-10 pt-6 border-t border-[var(--color-border-muted)]">
            <p className="label-specimen-sm text-[var(--color-text-faint)] mb-3">TX LIFECYCLE</p>
            <div className="space-y-1">
              {["Client", "Mempool", "Quorum Store", "Consensus (Raptr)", "Execution (Block-STM)", "Storage (JMT)"].map((stage, i) => (
                <div key={stage} className="flex items-center gap-2">
                  <span className="label-specimen-sm text-[var(--color-text-faint)] w-3 text-right">{i + 1}</span>
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)]" />
                  <span className="label-specimen-sm text-[var(--color-text)]">{stage}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── TOP LAYER (Main Report View) ── */}
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.35}
        onDragEnd={handleDragEnd}
        style={{ x }}
        className="absolute inset-0 bg-[var(--color-background)] shadow-[-10px_0_40px_rgba(0,0,0,0.6)] flex flex-col z-20 cursor-grab active:cursor-grabbing overflow-hidden"
      >
        {/* Background */}
        <div className="absolute inset-0 pointer-events-none z-0">
          <div className="absolute inset-0 bg-grid-adaptive bg-[size:3rem_3rem] opacity-15" />
          <div className="tyvek-texture" style={{ opacity: 0.06 }} />
        </div>

        {/* Top bar */}
        <div className="relative z-10 flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]" style={{ background: "var(--color-surface)" }}>
          <button onClick={openLeft} className="flex items-center gap-1.5 label-specimen text-[var(--color-text-muted)] active:text-[var(--color-accent)]">
            <Layers className="w-3.5 h-3.5" />
            REPORTS
          </button>
          <div className="leading-tight text-center">
            <span className="text-[10px] font-bold tracking-tight lowercase text-[var(--color-text)]">aptos intelligence</span>
          </div>
          <button onClick={openRight} className="flex items-center gap-1.5 label-specimen text-[var(--color-text-muted)] active:text-[var(--color-accent)]">
            ARCH
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Report content */}
        <div className="relative z-10 flex-1 overflow-y-auto px-5 py-5">
          {!active ? (
            <div className="flex items-center justify-center h-full">
              <div className="corner-marks p-8">
                <p className="label-specimen text-[var(--color-text-faint)] text-center">SWIPE RIGHT FOR REPORTS<br/>SWIPE LEFT FOR ARCHITECTURE</p>
              </div>
            </div>
          ) : (
            <div className="animate-fade-in-up pb-20" key={active.id}>
              <ReportView r={active} tab={tab} setTab={setTab} />
            </div>
          )}
        </div>

        {/* Invisible close overlay */}
        <motion.div
          className="absolute inset-0 z-30"
          style={{ display: useTransform(x, (val) => val === 0 ? "none" : "block") }}
          onClick={closeDrawer}
        />
      </motion.div>
    </div>
  );
}

/* ═══════════════════════════════════════
   Shared Report View Component
   ═══════════════════════════════════════ */
function ReportView({ r, tab, setTab }: { r: WebReport; tab: "advanced" | "eli5"; setTab: (t: "advanced" | "eli5") => void }) {
  return (
    <>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <span className="label-specimen-sm" style={{ color: catColor(r.category), borderLeft: `2px solid ${catColor(r.category)}`, paddingLeft: 6 }}>{r.category}</span>
        <span className={`label-specimen ${r.importance >= 8 ? "text-[var(--color-danger)]" : r.importance >= 6 ? "text-[var(--color-warning)]" : "text-[var(--color-text-faint)]"}`}>IMP {r.importance}/10</span>
        <span className="label-specimen-sm text-[var(--color-text-faint)]">{fmtDate(r.date)}</span>
      </div>

      <h2 className="text-[18px] md:text-[22px] font-extrabold text-[var(--color-text)] leading-[1.25] tracking-[-0.02em] font-sans m-0">{r.title}</h2>

      <div className="flex items-center gap-2.5 mt-3 mb-5 flex-wrap">
        <img src={`https://github.com/${r.author}.png`} alt="" className="w-5 h-5 clip-specimen-sm" />
        <span className="label-specimen text-[var(--color-text-muted)]">{r.author}</span>
        <a href={r.sourceUrl} target="_blank" rel="noopener" className="label-specimen text-[var(--color-accent)] no-underline hover:underline ml-auto">VIEW SOURCE →</a>
      </div>

      <div className="flex gap-2 mb-5">
        <MechButton active={tab === "advanced"} onClick={() => setTab("advanced")} className="h-[32px] px-3 text-[10px] uppercase">◆ Advanced</MechButton>
        <MechButton active={tab === "eli5"} onClick={() => setTab("eli5")} className="h-[32px] px-3 text-[10px] uppercase">◇ ELI5</MechButton>
      </div>

      <div className="clip-specimen border-mech corner-marks bg-[var(--color-surface)] p-5 md:p-7" key={`${r.id}-${tab}`}>
        <div className={tab === "advanced" ? "prose-mono" : "prose-eli5"}>
          <div dangerouslySetInnerHTML={{ __html: tab === "advanced" ? r.advanced : r.eli5 }} />
        </div>
      </div>

      {r.relatedFeatures.length > 0 && (
        <div className="mt-5">
          <p className="label-specimen-sm text-[var(--color-text-faint)] mb-2">RELATED FEATURES</p>
          <div className="flex flex-wrap gap-2">
            {r.relatedFeatures.map((f) => (
              <span key={f} className="clip-specimen-sm label-specimen-sm px-3 py-1.5 bg-[color-mix(in_srgb,var(--color-accent)_8%,transparent)] border border-[color-mix(in_srgb,var(--color-accent)_20%,transparent)] text-[var(--color-accent)]">{f}</span>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 mt-7 pt-4 border-t border-[var(--color-border-muted)]">
        <span className="label-specimen-sm font-mono tracking-[0.25em] text-[var(--color-border)]">|||||||||||||||</span>
        <span className="label-specimen-sm text-[var(--color-text-faint)]">RPT-{String(r.id).padStart(4, "0")} · {r.category.toUpperCase()}</span>
      </div>
    </>
  );
}
