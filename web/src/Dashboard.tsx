import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { ChevronRight, Layers, Plus } from "lucide-react";
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
function getLocalDateStr(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function buildCalendarDays(year: number, month: number, commitCounts: Map<string, number>, selectedDate: string | null) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();
  const today = getLocalDateStr();

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

  const todayStr = getLocalDateStr(now);

  // Commits for selected date (or today)
  const displayDate = selectedDate || todayStr;
  const displayCommits = commitsByDate.get(displayDate) || [];

  /* ── Swipe physics (exact Timepage values) ── */
  const x = useMotionValue(0);
  // Events bg starts at 80px (date column). We want ~80px of beige visible.
  // So offset = screenWidth - 80 (date col) - 80 (beige peek) = screenWidth - 160
  const CAL_DRAWER_OFFSET = typeof window !== "undefined" ? window.innerWidth - 160 : 270;
  const MENU_DRAWER_OFFSET = 250;

  const calOpacity = useTransform(x, [0, 150, CAL_DRAWER_OFFSET], [0, 0.5, 1]);
  const calScale = useTransform(x, [0, CAL_DRAWER_OFFSET], [0.95, 1]);
  const archOpacity = useTransform(x, [-MENU_DRAWER_OFFSET, -150, 0], [1, 0.5, 0]);
  const archScale = useTransform(x, [-MENU_DRAWER_OFFSET, 0], [1, 0.95]);
  const fabOpacity = useTransform(x, [-100, 0, 100], [0, 1, 0]);
  const fabScale = useTransform(x, [-100, 0, 100], [0.8, 1, 0.8]);
  // Date column fades fast (by 100px it's gone)
  const datesOpacity = useTransform(x, [0, 100], [1, 0]);

  const [drawerState, setDrawerState] = useState<"left" | "right" | "closed">("closed");

  const handleDragEnd = (_: any, { offset, velocity }: any) => {
    const t = 50, v = 400;
    const currentX = x.get();
    let target = 0;
    let newState: "left" | "right" | "closed" = "closed";

    // If already at a drawer, only allow closing (prevent swipe-through)
    if (currentX > 50) {
      // Currently at calendar — can only close
      if (offset.x < -t || velocity.x < -v) { target = 0; newState = "closed"; }
      else { target = CAL_DRAWER_OFFSET; newState = "left"; }
    } else if (currentX < -50) {
      // Currently at menu — can only close
      if (offset.x > t || velocity.x > v) { target = 0; newState = "closed"; }
      else { target = -MENU_DRAWER_OFFSET; newState = "right"; }
    } else {
      // At center — can open either drawer
      if (offset.x > t || velocity.x > v) { target = CAL_DRAWER_OFFSET; newState = "left"; }
      else if (offset.x < -t || velocity.x < -v) { target = -MENU_DRAWER_OFFSET; newState = "right"; }
    }

    setDrawerState(newState);
    animate(x, target, { type: "spring", stiffness: 300, damping: 30, mass: 0.8 });
  };

  const closeDrawer = () => {
    setDrawerState("closed");
    animate(x, 0, { type: "spring", stiffness: 300, damping: 30 });
  };

  function openReport(r: WebReport) {
    setActive(r); setTab("advanced"); setShowDetail(true);
  }

  function openCommit(c: Commit) {
    // Find existing report or create a lightweight one from commit data
    const report = reports.find(r => r.githubId === c.sha || r.title.toLowerCase().includes(c.title.slice(0, 25).toLowerCase()));
    if (report) {
      openReport(report);
    } else {
      openReport({
        id: 0, githubId: c.sha, title: c.title, author: c.author,
        date: c.date, category: c.category, importance: 5,
        sourceUrl: c.url, relatedFeatures: [], labels: [],
        advanced: `<h3>What Changed</h3><p>${c.title}</p><h3>Author</h3><p>${c.author}</p><h3>Source</h3><p><a href="${c.url}" target="_blank">${c.url}</a></p><p><em>Deep analysis is being generated — check back soon.</em></p>`,
        eli5: `<p><strong>What happened:</strong> ${c.title}</p><p><strong>Who did it:</strong> ${c.author}</p><p><em>A detailed explanation is being generated. Check back soon!</em></p>`,
      });
    }
  }

  /* ── If showing report detail ── */
  if (showDetail && active) {
    return (
      <div className="fixed inset-0 flex flex-col overflow-hidden" style={{ background: "var(--color-background)" }}>
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
    <div className="fixed inset-0 overflow-hidden bg-black select-none">

      {/* ═══ LEFT DRAWER — Calendar (exact Timepage colors) ═══ */}
      <motion.div
        className="absolute inset-0 bg-black text-white px-5 overflow-hidden"
        style={{ opacity: calOpacity, scale: calScale, pointerEvents: drawerState === "left" ? "auto" : "none", paddingTop: "max(env(safe-area-inset-top, 16px), 50px)" }}
      >
        <div className="flex flex-col h-full overflow-hidden">
          {/* Year + Month — exact Timepage #CBB696 */}
          <div className="text-left ml-1">
            <h2 className="text-[44px] font-light tracking-wide leading-[1.1] text-[#CBB696]">{yearStr}</h2>
            <h1 className="text-[44px] font-bold tracking-wide leading-[1.1] text-[#CBB696]">{monthName}</h1>
          </div>

          {/* Calendar grid */}
          <div className="mt-6 max-w-[300px]">
            <div className="grid grid-cols-7 mb-[18px] px-1">
              {DAY_HEADERS.map((d, i) => (
                <div key={i} className="text-center text-[11px] font-medium text-white/50">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-y-[13px] px-1">
              {calDays.map((day, i) => {
                let cls = "w-[33px] h-[33px] flex items-center justify-center text-[15px] font-medium rounded-full cursor-pointer transition-colors ";

                if (day.type === "prev" || day.type === "next") {
                  cls += "text-[#4B4B4B]";
                } else if (day.type === "active") {
                  // Exact Timepage: white bg, white ring, white glow
                  cls += "bg-white text-black font-bold ring-[1px] ring-white ring-offset-[2.5px] ring-offset-black shadow-[0_0_15px_rgba(255,255,255,0.4)]";
                } else if (day.type === "today-dim") {
                  // Outline ring when another date is selected
                  cls += "border-[1.5px] border-[#CBB696] text-[#F0F0F0]";
                } else if (day.type === "has-commits") {
                  // Exact Timepage: brown circle #474031
                  cls += "bg-[#474031] text-[#F0F0F0] hover:bg-[#5a5240]";
                } else {
                  cls += "text-[#F0F0F0] hover:bg-white/10";
                }

                return (
                  <div key={i} className="flex justify-center items-center">
                    <div className={cls}
                      onClick={() => day.dateStr && setSelectedDate(day.dateStr === selectedDate ? null : day.dateStr)}>
                      {day.d}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* TODAY label — exact Timepage */}
          <div className="mt-[36px] flex items-center justify-between px-1">
            <span className="text-[20px] font-bold tracking-wide text-white">
              {selectedDate ? fmtDate(selectedDate).toUpperCase() : "TODAY"}
            </span>
            <Plus className="w-[26px] h-[26px] text-white" strokeWidth={2.5} />
          </div>

          {/* Commits — exact Timepage orange markers */}
          <div className="mt-5 px-1 space-y-[18px] overflow-y-auto no-scrollbar flex-1">
            {displayCommits.length === 0 ? (
              <p className="text-[14px] text-white/40">No commits this day</p>
            ) : displayCommits.map((c) => {
              const report = reports.find(r => r.githubId === c.sha || r.title.toLowerCase().includes(c.title.slice(0, 25).toLowerCase()));
              return (
                <div key={c.sha} className="flex items-start gap-[14px] cursor-pointer"
                  onClick={() => { openCommit(c); closeDrawer(); }}>
                  {/* Exact Timepage orange marker */}
                  <div className="w-[6px] h-[19px] bg-[#F28140] rounded-full mt-[1px]" />
                  <div>
                    <div className="text-[16px] font-medium text-white leading-none">{c.title.slice(0, 45)}{c.title.length > 45 ? "..." : ""}</div>
                    <div className="text-[12px] font-medium text-white/70 mt-1.5 leading-none">{c.author}</div>
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
        style={{ opacity: archOpacity, scale: archScale, pointerEvents: drawerState === "right" ? "auto" : "none" }}
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

      {/* ═══ TOP LAYER — exact Timepage structure ═══ */}
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.4}
        dragDirectionLock
        onDragEnd={handleDragEnd}
        style={{ x, touchAction: "pan-y" }}
        className="absolute inset-0 flex overflow-hidden z-20 cursor-grab active:cursor-grabbing will-change-transform"
      >
        {/* Events area bg — clipped to viewport */}
        <div className="absolute left-[80px] right-0 top-0 bottom-0 bg-[#877C65] shadow-[0_0_50px_rgba(0,0,0,0.8)] z-0 pointer-events-none overflow-hidden" />

        {/* Black date column bg — fades */}
        <motion.div style={{ opacity: datesOpacity }} className="absolute left-0 top-0 bottom-0 w-[80px] bg-black z-0 pointer-events-none" />

        {/* Vertical text — EXACT Timepage #B3A48A color */}
        <motion.div style={{ opacity: datesOpacity }} className="absolute left-0 top-0 bottom-0 w-[32px] flex items-center justify-center z-10 pointer-events-none">
          <span className="-rotate-90 whitespace-nowrap text-[11px] tracking-[0.45em] font-semibold text-[#B3A48A] uppercase">
            {yearStr} {monthName}
          </span>
        </motion.div>

        {/* Scrollable timeline */}
        <div className="absolute inset-0 overflow-y-auto overflow-x-hidden no-scrollbar pb-40 z-20 scroll-smooth">
          <div className="pt-2" />
          {loading ? (
            <div className="p-8 ml-[80px]">
              {[1,2,3,4,5].map(i => <div key={i} className="skeleton-mech mb-3" style={{ height: 12, width: `${50+i*8}%` }} />)}
            </div>
          ) : [...commitsByDate.entries()].map(([dateStr, dayCommits], idx) => {
            const d = new Date(dateStr + "T12:00:00");
            const dayName = DAY_NAMES[d.getDay()];
            const dateNum = String(d.getDate());
            const isToday = dateStr === todayStr;

            return (
              <div key={dateStr} className="flex min-h-[105px] w-full overflow-hidden">
                {/* Date column — exact Timepage: 80px, 40x66 pill, rounded-[14px] */}
                <motion.div
                  style={{ opacity: datesOpacity }}
                  className="w-[80px] shrink-0 flex items-start justify-end pr-[10px] pt-[16px]"
                >
                  <motion.div
                    layout
                    initial={false}
                    animate={{ backgroundColor: isToday ? "#ffffff" : "transparent", scale: isToday ? 1 : 0.95 }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    className={`w-[40px] h-[66px] flex flex-col items-center justify-center rounded-[14px] ${isToday ? "shadow-md" : ""}`}
                  >
                    <span className={`text-[10px] tracking-widest mb-0.5 transition-colors duration-300 ${isToday ? "font-semibold text-black" : "font-medium text-white/50"}`}>
                      {dayName}
                    </span>
                    <span className={`text-[26px] font-bold leading-none tracking-tight transition-colors duration-300 ${isToday ? "text-black" : "text-white"}`}>
                      {dateNum}
                    </span>
                  </motion.div>
                </motion.div>

                {/* Events column — overflow hidden to prevent text bleeding off screen */}
                <div className={`flex-1 min-w-0 flex flex-col justify-center pt-[16px] pb-[18px] pl-[14px] pr-4 relative overflow-hidden ${idx % 2 === 0 ? "bg-black/[0.04]" : "bg-transparent"}`}>
                  {dayCommits.map((c) => {
                    const report = reports.find(r => r.githubId === c.sha || r.title.toLowerCase().includes(c.title.slice(0, 25).toLowerCase()));
                    return (
                      <motion.div
                        key={c.sha}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        whileHover={{ x: 4, backgroundColor: "rgba(255,255,255,0.06)" }}
                        whileTap={{ scale: 0.98, backgroundColor: "rgba(255,255,255,0.1)" }}
                        className="flex items-start gap-[14px] mb-[18px] last:mb-0 relative p-2 -ml-2 rounded-xl cursor-pointer transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          openCommit(c);
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                      >
                        <div className="mt-[2px] shrink-0">
                          <div className="w-[6px] h-[20px] rounded-full shadow-sm" style={{ background: catColor(c.category) }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-[15px] font-medium text-white leading-snug tracking-wide break-words">{c.title}</h3>
                          <div className="flex items-center gap-2 mt-[3px]">
                            <img src={`https://github.com/${c.author}.png`} alt="" className="w-3.5 h-3.5 rounded-full" />
                            <p className="text-[13px] text-white/70 font-medium leading-snug tracking-wide">{c.author}</p>
                            {report && <span className="text-[9px] font-bold tracking-widest uppercase text-[#F28140]">REPORT</span>}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* FAB — exact Timepage: #9F947F bg */}
        <motion.button
          style={{ opacity: fabOpacity, scale: fabScale }}
          className="absolute bottom-8 right-6 w-[58px] h-[58px] rounded-full bg-[#9F947F] flex items-center justify-center shadow-2xl border border-white/10 z-50"
          onClick={() => { setDrawerState("left"); animate(x, CAL_DRAWER_OFFSET, { type: "spring", stiffness: 300, damping: 30 }); }}
        >
          <Layers className="w-7 h-7 text-white" />
        </motion.button>

        {/* Close overlay */}
        <div className="absolute inset-0 z-40" style={{ display: drawerState !== "closed" ? "block" : "none" }} onClick={closeDrawer} />
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
