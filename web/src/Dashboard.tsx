import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { ChevronRight, Layers } from "lucide-react";
import type { WebReport, FeatureStatus, Commit } from "./api";
import { fetchReports, fetchFeatures, fetchCommits } from "./api";

/* ── Helpers ── */
const CATEGORIES = ["All", "Release", "Feature Progress", "Security", "Performance", "Infrastructure"];
const DAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const DAY_HEADERS = ["S", "M", "T", "W", "T", "F", "S"];

function catColor(cat: string) {
  const m: Record<string, string> = { Release: "#0047ff", "Feature Progress": "#00c853", Security: "#ef4444", Performance: "#ff4d00", Infrastructure: "#6b7280" };
  return m[cat] || "#6b7280";
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function BarcodeStrip() {
  return <span className="absolute right-0 top-0 bottom-0 w-[6px] pointer-events-none opacity-25" style={{
    backgroundImage: "repeating-linear-gradient(to bottom, var(--color-surface,#fff) 0px, var(--color-surface,#fff) 2px, transparent 2px, transparent 3px, var(--color-surface,#fff) 3px, var(--color-surface,#fff) 4px, transparent 4px, transparent 7px)",
  }} />;
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

/* ── Group reports by date ── */
function groupByDate(reports: WebReport[]): Map<string, WebReport[]> {
  const map = new Map<string, WebReport[]>();
  for (const r of reports) {
    const key = r.date.slice(0, 10); // YYYY-MM-DD
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(r);
  }
  // Sort by date descending
  return new Map([...map.entries()].sort((a, b) => b[0].localeCompare(a[0])));
}

/* ── Build calendar grid for a month ── */
function buildCalendarDays(year: number, month: number, commitCounts: Map<string, number>, selectedDate: string | null) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();
  const today = new Date().toISOString().slice(0, 10);

  const days: Array<{ d: number; type: string; dateStr: string; count: number }> = [];

  // Previous month padding
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = daysInPrev - i;
    days.push({ d, type: "prev", dateStr: "", count: 0 });
  }

  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const isToday = dateStr === today;
    const isSelected = dateStr === selectedDate;
    const count = commitCounts.get(dateStr) || 0;

    let type = "none";
    if (isSelected) type = "active";
    else if (isToday && !selectedDate) type = "active";
    else if (isToday && selectedDate) type = "today-dim";
    else if (count > 0) type = "has-commits";

    days.push({ d, type, dateStr, count });
  }

  // Next month padding
  const remaining = 7 - (days.length % 7);
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      days.push({ d, type: "next", dateStr: "", count: 0 });
    }
  }

  return days;
}

/* ═════════════════════════════════════════════════
   MAIN DASHBOARD
   ═════════════════════════════════════════════════ */
export default function Dashboard() {
  const [reports, setReports] = useState<WebReport[]>([]);
  const [features, setFeatures] = useState<FeatureStatus[]>([]);
  const [commits, setCommits] = useState<Commit[]>([]);
  const [active, setActive] = useState<WebReport | null>(null);
  const [tab, setTab] = useState<"advanced" | "eli5">("advanced");
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, f, c] = await Promise.all([fetchReports(), fetchFeatures(), fetchCommits()]);
      setReports(r); setFeatures(f); setCommits(c);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Group commits by date for the calendar and timeline
  const commitsByDate = useMemo(() => {
    const map = new Map<string, Commit[]>();
    for (const c of commits) {
      const key = c.date.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return new Map([...map.entries()].sort((a, b) => b[0].localeCompare(a[0])));
  }, [commits]);

  // Count commits per date for calendar intensity
  const commitCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of commits) {
      const key = c.date.slice(0, 10);
      map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
  }, [commits]);

  // Current month for calendar
  const now = new Date();
  const calDays = useMemo(
    () => buildCalendarDays(now.getFullYear(), now.getMonth(), commitCounts, selectedDate),
    [commitCounts, selectedDate]
  );

  // Max commits in a single day (for intensity scaling)
  const maxCommits = useMemo(() => Math.max(1, ...Array.from(commitCounts.values())), [commitCounts]);

  const monthName = now.toLocaleDateString("en-US", { month: "long" }).toUpperCase();
  const yearStr = String(now.getFullYear());

  const todayStr = now.toISOString().slice(0, 10);

  // Commits for selected date (or today)
  const displayDate = selectedDate || todayStr;
  const displayCommits = commitsByDate.get(displayDate) || [];

  /* ── Swipe physics ── */
  const x = useMotionValue(0);
  const DRAWER_W = 315;

  const calOpacity = useTransform(x, [0, 150, DRAWER_W], [0, 0.5, 1]);
  const calScale = useTransform(x, [0, DRAWER_W], [0.9, 1]);
  const archOpacity = useTransform(x, [-DRAWER_W, -150, 0], [1, 0.5, 0]);
  const archScale = useTransform(x, [-DRAWER_W, 0], [1, 0.9]);
  const fabOpacity = useTransform(x, [-100, 0, 100], [0, 1, 0]);
  // Fade out the date column + vertical text when swiping right to calendar
  const dateColumnOpacity = useTransform(x, [0, 120, DRAWER_W], [1, 0.3, 0]);

  const [openDrawer, setOpenDrawer] = useState<"left" | "right" | null>(null);

  const handleDragEnd = (_: any, { offset, velocity }: any) => {
    const t = 50, v = 400;
    let target = 0;
    if (offset.x > t || velocity.x > v) target = DRAWER_W;
    else if (offset.x < -t || velocity.x < -v) target = -DRAWER_W;
    if (x.get() > 100 && (offset.x < -t || velocity.x < -v)) target = 0;
    if (x.get() < -100 && (offset.x > t || velocity.x > v)) target = 0;
    setOpenDrawer(target > 0 ? "left" : target < 0 ? "right" : null);
    animate(x, target, { type: "spring", stiffness: 250, damping: 28, mass: 0.8 });
  };

  const closeDrawer = () => {
    setOpenDrawer(null);
    animate(x, 0, { type: "spring", stiffness: 250, damping: 28 });
  };

  function openReport(r: WebReport) {
    setActive(r); setTab("advanced"); setShowDetail(true);
  }

  /* ── If showing report detail ── */
  if (showDetail && active) {
    return (
      <div className="h-[100dvh] w-full flex flex-col overflow-hidden" style={{ background: "var(--color-background)" }}>
        {/* Background layers */}
        <div className="absolute inset-0 pointer-events-none z-0">
          <div className="absolute inset-0 bg-grid-adaptive bg-[size:3rem_3rem] opacity-15" />
          <div className="tyvek-texture" style={{ opacity: 0.06 }} />
        </div>
        <div className="relative z-10 flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]" style={{ background: "var(--color-surface)" }}>
          <button onClick={() => setShowDetail(false)} className="label-specimen text-[var(--color-accent)] py-2 px-1">← BACK</button>
          <span className="label-specimen text-[var(--color-text-faint)]">RPT-{String(active.id).padStart(4, "0")}</span>
        </div>
        <div className="relative z-10 flex-1 overflow-y-auto px-5 py-5 pb-20">
          <ReportView r={active} tab={tab} setTab={setTab} />
        </div>
      </div>
    );
  }

  /* ── Main Timepage layout ── */
  return (
    <div className="relative w-full h-[100dvh] overflow-hidden bg-black select-none">

      {/* ═══ LEFT DRAWER — Calendar + Contributors ═══ */}
      <motion.div
        className="absolute inset-0 bg-black text-white px-6 pt-[env(safe-area-inset-top,16px)]"
        style={{ opacity: calOpacity, scale: calScale, pointerEvents: openDrawer === "left" ? "auto" : "none" }}
      >
        <div className="pt-6">
          {/* Year + Month header */}
          <div className="text-left ml-1">
            <h2 className="text-[40px] font-light tracking-wide leading-[1.1]" style={{ color: "var(--color-accent)" }}>{yearStr}</h2>
            <h1 className="text-[40px] font-bold tracking-wide leading-[1.1]" style={{ color: "var(--color-accent)" }}>{monthName}</h1>
          </div>

          {/* Calendar grid */}
          <div className="mt-7 w-[275px]">
            <div className="grid grid-cols-7 mb-4 px-1">
              {DAY_HEADERS.map((d, i) => (
                <div key={i} className="text-center text-[11px] font-medium text-white/50">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-y-3 px-1">
              {calDays.map((day, i) => {
                // Compute intensity: 0.15 (1 commit) to 1.0 (max commits)
                const intensity = day.count > 0 ? 0.15 + (day.count / maxCommits) * 0.85 : 0;

                let cls = "w-[33px] h-[33px] flex items-center justify-center text-[15px] font-medium rounded-full cursor-pointer transition-all ";
                let style: React.CSSProperties = {};

                if (day.type === "prev" || day.type === "next") {
                  cls += "text-[#4B4B4B]";
                } else if (day.type === "active") {
                  cls += "text-[var(--color-accent-foreground)] font-bold ring-[1px] ring-[var(--color-accent)] ring-offset-[2.5px] ring-offset-black";
                  style.background = "var(--color-accent)";
                } else if (day.type === "today-dim") {
                  cls += "border-[1.5px] border-[var(--color-accent)] text-[var(--color-text)]";
                } else if (day.type === "has-commits") {
                  cls += "text-[var(--color-text)]";
                  // Green tint scaled by commit count
                  style.background = `rgba(204, 255, 0, ${intensity * 0.35})`;
                } else {
                  cls += "text-[var(--color-text-faint)]";
                }

                return (
                  <div key={i} className="flex justify-center items-center">
                    <div className={cls} style={style}
                      onClick={() => day.dateStr && setSelectedDate(day.dateStr === selectedDate ? null : day.dateStr)}>
                      {day.d}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected date label */}
          <div className="mt-8 flex items-center justify-between px-1">
            <span className="text-[18px] font-bold tracking-wide text-white">
              {selectedDate ? fmtDate(selectedDate) : "TODAY"}
            </span>
            <div className="flex items-center gap-2">
              {displayCommits.length > 0 && (
                <div className="w-2 h-2 rounded-full" style={{ background: `rgba(204, 255, 0, ${Math.min(1, 0.3 + (displayCommits.length / maxCommits) * 0.7)})` }} />
              )}
              <span className="label-specimen text-[var(--color-text-faint)]">{displayCommits.length} commits</span>
            </div>
          </div>

          {/* Commits for selected date */}
          <div className="mt-5 px-1 space-y-4 overflow-y-auto" style={{ maxHeight: "calc(100dvh - 520px)" }}>
            {displayCommits.length === 0 ? (
              <p className="label-specimen-sm text-[var(--color-text-faint)]">NO COMMITS THIS DAY</p>
            ) : displayCommits.map((c) => {
              // Check if there's a detailed report for this commit
              const report = reports.find(r => r.title.toLowerCase().includes(c.title.slice(0, 25).toLowerCase()));
              return (
                <div key={c.sha} className="flex items-start gap-3 cursor-pointer"
                  onClick={() => {
                    if (report) { openReport(report); closeDrawer(); }
                    else { window.open(c.url, "_blank"); }
                  }}>
                  <div className="w-[6px] h-[19px] rounded-full mt-[1px] shrink-0" style={{ background: catColor(c.category) }} />
                  <div>
                    <div className="text-[14px] font-medium text-white leading-tight">{c.title.slice(0, 60)}{c.title.length > 60 ? "..." : ""}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <img src={`https://github.com/${c.author}.png`} alt="" className="w-4 h-4 rounded-full" />
                      <span className="text-[11px] font-medium text-white/60">{c.author}</span>
                      {report && <span className="label-specimen-sm text-[var(--color-accent)]">REPORT</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Nav pill */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 bg-[#161616] rounded-full">
            <div className="w-[5px] h-[5px] rounded-full bg-white/30" />
            <div className="w-[7px] h-[7px] rounded-full bg-white/90" />
            <div className="w-[5px] h-[5px] rounded-full bg-white/30" />
          </div>
        </div>
      </motion.div>

      {/* ═══ RIGHT DRAWER — Architecture ═══ */}
      <motion.div
        className="absolute inset-0 bg-black text-white p-6 pt-[env(safe-area-inset-top,24px)] overflow-y-auto"
        style={{ opacity: archOpacity, scale: archScale, pointerEvents: openDrawer === "right" ? "auto" : "none" }}
      >
        <div className="max-w-[220px] ml-auto pt-6">
          <h1 className="label-specimen text-[var(--color-accent)] text-[14px] tracking-[0.2em] mb-10">ARCHITECTURE</h1>
          <div className="space-y-5">
            {[
              { name: "QUORUM STORE", desc: "Batch dissemination + proof collection", color: "#0047ff" },
              { name: "RAPTR / PREFIX", desc: "Leaderless multi-proposer BFT consensus", color: "#00c853" },
              { name: "BLOCK-STM", desc: "Parallel MVCC execution engine", color: "#ff4d00" },
              { name: "ZAPTOS", desc: "Optimistic pipelining before finality", color: "#ccff00" },
              { name: "ARCHON", desc: "Proxy-primary validator coordination", color: "#7c3aed" },
              { name: "SHARDINES", desc: "Internal validator sharding >1M TPS", color: "#14b8a6" },
              { name: "ENCRYPTED MEMPOOL", desc: "BIBE confidential ordering (anti-MEV)", color: "#ef4444" },
              { name: "MOVE VM", desc: "Resource-oriented smart contract runtime", color: "#f59e0b" },
            ].map((s) => (
              <div key={s.name} className="flex items-start gap-3">
                <div className="w-[6px] h-[20px] rounded-full mt-0.5 shrink-0" style={{ background: s.color }} />
                <div>
                  <h3 className="label-specimen text-[var(--color-text)]">{s.name}</h3>
                  <p className="text-[11px] text-[var(--color-text-faint)] mt-0.5 leading-snug font-sans">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 pt-5 border-t border-[var(--color-border-muted)]">
            <p className="label-specimen-sm text-[var(--color-text-faint)] mb-3">TX LIFECYCLE</p>
            {["Client", "Mempool", "Quorum Store", "Consensus (Raptr)", "Execution (Block-STM)", "Storage (JMT)"].map((s, i) => (
              <div key={s} className="flex items-center gap-2 mb-1.5">
                <span className="label-specimen-sm text-[var(--color-text-faint)] w-3 text-right">{i + 1}</span>
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)]" />
                <span className="label-specimen-sm text-[var(--color-text)]">{s}</span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* ═══ TOP LAYER — Timepage Timeline ═══ */}
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.4}
        onDragEnd={handleDragEnd}
        style={{ x }}
        className="absolute inset-0 bg-[var(--color-surface-alt)] shadow-[-15px_0_50px_rgba(0,0,0,0.5)] flex overflow-hidden z-20 cursor-grab active:cursor-grabbing"
      >
        {/* Black left date column background — fades out when calendar drawer opens */}
        <motion.div className="absolute left-0 top-0 bottom-0 w-[90px] bg-black z-0" style={{ opacity: dateColumnOpacity }} />

        {/* Vertical rotated text — fades with date column */}
        <motion.div className="absolute left-0 top-0 bottom-0 w-[35px] flex items-center justify-center z-10 pointer-events-none" style={{ opacity: dateColumnOpacity }}>
          <span className="-rotate-90 whitespace-nowrap text-[11px] tracking-[0.4em] font-bold text-white/40 uppercase font-mono">
            {yearStr} {monthName}
          </span>
        </motion.div>

        {/* Scrollable timeline */}
        <div className="absolute inset-0 overflow-y-auto overflow-x-hidden pb-32 z-20 no-scrollbar">
          {loading ? (
            <div className="p-8 ml-[90px]">
              {[1,2,3,4,5].map(i => <div key={i} className="skeleton-mech mb-3" style={{ height: 12, width: `${50+i*8}%` }} />)}
            </div>
          ) : [...commitsByDate.entries()].map(([dateStr, dayCommits], idx) => {
            const d = new Date(dateStr + "T12:00:00");
            const dayName = DAY_NAMES[d.getDay()];
            const dateNum = String(d.getDate());
            const isToday = dateStr === todayStr;

            return (
              <div key={dateStr} className="flex min-h-[100px] w-full">
                {/* Date column — fades when calendar opens */}
                <motion.div className="w-[90px] shrink-0 flex items-start justify-end pr-3 pt-5" style={{ opacity: dateColumnOpacity }}>
                  <div className={`w-[50px] py-[6px] flex flex-col items-center justify-center rounded-[14px] ${isToday ? "bg-[var(--color-accent)] text-[var(--color-accent-foreground)]" : "text-white"}`}>
                    <span className={`text-[10px] font-bold tracking-widest mb-0.5 font-mono ${isToday ? "text-[var(--color-accent-foreground)]" : "text-white/70"}`}>
                      {dayName}
                    </span>
                    <span className={`text-[24px] font-bold leading-none ${isToday ? "text-[var(--color-accent-foreground)]" : "text-white"}`}>
                      {dateNum}
                    </span>
                  </div>
                </motion.div>

                {/* Events column */}
                <div className={`flex-1 flex flex-col justify-center py-4 pl-4 pr-5 ${idx % 2 === 0 ? "bg-black/[0.04]" : "bg-transparent"}`}>
                  {dayCommits.map((c) => {
                    const report = reports.find(r => r.title.toLowerCase().includes(c.title.slice(0, 25).toLowerCase()));
                    return (
                      <div key={c.sha} className="flex items-start gap-3 mb-4 last:mb-0 cursor-pointer active:opacity-70"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (report) openReport(report);
                          else window.open(c.url, "_blank");
                        }}
                        onPointerDown={(e) => e.stopPropagation()}>
                        <div className="mt-1 shrink-0">
                          <div className="w-[6px] h-[20px] rounded-full" style={{ background: catColor(c.category) }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-[15px] font-medium text-white leading-tight tracking-wide">{c.title}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <img src={`https://github.com/${c.author}.png`} alt="" className="w-3.5 h-3.5 rounded-full" />
                            <p className="text-[12px] text-white/60 font-medium leading-snug tracking-wide">{c.author}</p>
                            {report && <span className="label-specimen-sm text-[var(--color-accent)]">REPORT</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* FAB */}
        <motion.div style={{ opacity: fabOpacity }} className="absolute bottom-8 right-5 z-50">
          <button className="w-[52px] h-[52px] rounded-full bg-[var(--color-surface)] flex items-center justify-center shadow-lg border border-[var(--color-border)]"
            onClick={() => animate(x, DRAWER_W, { type: "spring", stiffness: 250, damping: 28 })}>
            <Layers className="w-5 h-5 text-[var(--color-accent)]" />
          </button>
        </motion.div>

        {/* Close overlay — only blocks touches when a drawer is open */}
        {openDrawer !== null && (
          <div
            className="absolute inset-0 z-30"
            onClick={closeDrawer}
            onTouchEnd={closeDrawer}
          />
        )}
      </motion.div>

      <style dangerouslySetInnerHTML={{ __html: `.no-scrollbar::-webkit-scrollbar{display:none}.no-scrollbar{-ms-overflow-style:none;scrollbar-width:none}` }} />
    </div>
  );
}

/* ═════════════════════════════════════════════════
   Report Detail View
   ═════════════════════════════════════════════════ */
function ReportView({ r, tab, setTab }: { r: WebReport; tab: "advanced" | "eli5"; setTab: (t: "advanced" | "eli5") => void }) {
  return (
    <div className="animate-fade-in-up" key={r.id}>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <span className="label-specimen-sm" style={{ color: catColor(r.category), borderLeft: `2px solid ${catColor(r.category)}`, paddingLeft: 6 }}>{r.category}</span>
        <span className={`label-specimen ${r.importance >= 8 ? "text-[var(--color-danger)]" : r.importance >= 6 ? "text-[var(--color-warning)]" : "text-[var(--color-text-faint)]"}`}>IMP {r.importance}/10</span>
        <span className="label-specimen-sm text-[var(--color-text-faint)]">{fmtDate(r.date)}</span>
      </div>

      <h2 className="text-[18px] font-extrabold text-[var(--color-text)] leading-[1.25] tracking-[-0.02em] font-sans m-0">{r.title}</h2>

      <div className="flex items-center gap-2.5 mt-3 mb-5 flex-wrap">
        <img src={`https://github.com/${r.author}.png`} alt="" className="w-5 h-5 clip-specimen-sm" />
        <span className="label-specimen text-[var(--color-text-muted)]">{r.author}</span>
        <a href={r.sourceUrl} target="_blank" rel="noopener" className="label-specimen text-[var(--color-accent)] no-underline hover:underline ml-auto">VIEW SOURCE →</a>
      </div>

      <div className="flex gap-2 mb-5">
        <MechButton active={tab === "advanced"} onClick={() => setTab("advanced")} className="h-[32px] px-3 text-[10px] uppercase">◆ Advanced</MechButton>
        <MechButton active={tab === "eli5"} onClick={() => setTab("eli5")} className="h-[32px] px-3 text-[10px] uppercase">◇ ELI5</MechButton>
      </div>

      <div className="clip-specimen border-mech corner-marks bg-[var(--color-surface)] p-5" key={`${r.id}-${tab}`}>
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
    </div>
  );
}
