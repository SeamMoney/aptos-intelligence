import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { ChevronRight, Layers, Plus, Search, ArrowLeft, ChevronUp, ChevronDown, ExternalLink } from "lucide-react";
import type { WebReport, FeatureStatus, Commit, FeatureProgress } from "./api";
import { fetchReports, fetchFeatures, fetchCommits, fetchFeatureProgress } from "./api";

/* ── Constants ── */
const DAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const DAY_HEADERS = ["S", "M", "T", "W", "T", "F", "S"];

const SUBSYSTEMS = [
  { key: "consensus", name: "Consensus", desc: "Quorum Store + Raptr ordering", color: "#0047ff" },
  { key: "storage", name: "Storage", desc: "AptosDB + Jellyfish Merkle Tree", color: "#ef4444" },
  { key: "vm", name: "Move VM", desc: "Execution runtime + Framework", color: "#f59e0b" },
  { key: "execution", name: "Execution", desc: "Block-STM parallel engine", color: "#ff4d00" },
  { key: "compiler", name: "Compiler", desc: "Move compiler v2 + linters", color: "#00c853" },
  { key: "network", name: "Network", desc: "Peer connections + sync", color: "#14b8a6" },
  { key: "crypto", name: "Crypto", desc: "DKG + encrypted mempool", color: "#7c3aed" },
  { key: "framework", name: "Framework", desc: "Core Move modules", color: "#ec4899" },
  { key: "types", name: "Types", desc: "Transaction types + auth", color: "#6b7280" },
  { key: "forge", name: "Testing", desc: "Forge test framework", color: "#78716c" },
];

function catColor(cat: string) {
  return ({ Release: "#0047ff", "Feature Progress": "#00c853", Security: "#ef4444", Performance: "#ff4d00", Infrastructure: "#6b7280" })[cat] || "#6b7280";
}

function fmtDate(iso: string) { return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }); }
function fmtDateFull(iso: string) { return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }

function getLocalDateStr(d: Date = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function detectSubsystem(title: string): string {
  const t = title.toLowerCase();
  const m = t.match(/^\[([^\]]+)\]/);
  if (m) {
    const tag = m[1];
    if (tag.includes("consensus") || tag.includes("qs")) return "consensus";
    if (tag.includes("storage")) return "storage";
    if (tag.includes("vm") || tag.includes("mono-move")) return "vm";
    if (tag.includes("compiler")) return "compiler";
    if (tag.includes("prover") || tag.includes("move")) return "vm";
    if (tag.includes("network") || tag.includes("state sync") || tag.includes("fullnode")) return "network";
    if (tag.includes("forge")) return "forge";
    if (tag.includes("framework")) return "framework";
    if (tag.includes("types") || tag.includes("api")) return "types";
    if (tag.includes("crypto") || tag.includes("dkg") || tag.includes("encrypted")) return "crypto";
    if (tag.includes("gas") || tag.includes("execution")) return "execution";
  }
  if (t.includes("release")) return "consensus";
  return "types";
}

/* ── Calendar ── */
function buildCalendarDays(year: number, month: number, counts: Map<string, number>, selected: string | null) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();
  const today = getLocalDateStr();
  const days: Array<{ d: number; type: string; dateStr: string; count: number }> = [];

  for (let i = firstDay - 1; i >= 0; i--) days.push({ d: daysInPrev - i, type: "prev", dateStr: "", count: 0 });

  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    const count = counts.get(ds) || 0;
    let type = "none";
    if (ds === selected) type = "active";
    else if (ds === today && !selected) type = "active";
    else if (ds === today) type = "today-dim";
    else if (count > 0) type = "has-commits";
    days.push({ d, type, dateStr: ds, count });
  }

  const rem = 7 - (days.length % 7);
  if (rem < 7) for (let d = 1; d <= rem; d++) days.push({ d, type: "next", dateStr: "", count: 0 });
  return days;
}

/* ── Components ── */
function BarcodeStrip() {
  return <span className="absolute right-0 top-0 bottom-0 w-[6px] pointer-events-none opacity-25" style={{
    backgroundImage: "repeating-linear-gradient(to bottom, var(--color-surface,#fff) 0px, var(--color-surface,#fff) 2px, transparent 2px, transparent 3px, var(--color-surface,#fff) 3px, var(--color-surface,#fff) 4px, transparent 4px, transparent 7px)",
  }} />;
}

function MechButton({ children, active, onClick, className = "" }: { children: React.ReactNode; active?: boolean; onClick?: () => void; className?: string }) {
  return (
    <button onClick={onClick} className={`relative clip-specimen-sm font-mono tracking-widest flex items-center justify-center transition-all
      ${active ? "bg-[var(--color-accent)] text-[var(--color-accent-foreground)] border border-[var(--color-accent)]"
        : "bg-[var(--color-text)] text-[var(--color-surface)] border border-[var(--color-text)] shadow-mech hover:bg-[var(--color-accent)] hover:text-[var(--color-accent-foreground)]"
      } ${className}`}>
      <span className="relative z-[1]">{children}</span>
      <BarcodeStrip />
    </button>
  );
}

/* ═══════════════════════════════════════
   MAIN DASHBOARD
   ═══════════════════════════════════════ */
export default function Dashboard() {
  const [reports, setReports] = useState<WebReport[]>([]);
  const [features, setFeatures] = useState<FeatureStatus[]>([]);
  const [commits, setCommits] = useState<Commit[]>([]);
  const [featureProgress, setFeatureProgress] = useState<FeatureProgress[]>([]);
  const [active, setActive] = useState<WebReport | null>(null);
  const [tab, setTab] = useState<"advanced" | "eli5">("advanced");
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [search, setSearch] = useState("");
  const [subFilter, setSubFilter] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, f, c, fp] = await Promise.all([fetchReports(), fetchFeatures(), fetchCommits(), fetchFeatureProgress()]);
      setReports(r); setFeatures(f); setCommits(c); setFeatureProgress(fp);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Pre-compute report lookup map (O(1) instead of O(n))
  const reportMap = useMemo(() => {
    const m = new Map<string, WebReport>();
    for (const r of reports) {
      m.set(r.githubId, r);
      const titleKey = r.title.toLowerCase().slice(0, 30);
      if (titleKey) m.set(titleKey, r);
    }
    return m;
  }, [reports]);

  function findReport(c: Commit): WebReport | null {
    return reportMap.get(c.sha) || reportMap.get(c.title.toLowerCase().slice(0, 30)) || null;
  }

  // Group commits by date
  const commitsByDate = useMemo(() => {
    const filtered = subFilter
      ? commits.filter(c => detectSubsystem(c.title) === subFilter)
      : search
        ? commits.filter(c => c.title.toLowerCase().includes(search.toLowerCase()) || c.author.toLowerCase().includes(search.toLowerCase()))
        : commits;
    const map = new Map<string, Commit[]>();
    for (const c of filtered) {
      const key = c.date.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return new Map([...map.entries()].sort((a, b) => b[0].localeCompare(a[0])));
  }, [commits, search, subFilter]);

  const commitCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of commits) { const k = c.date.slice(0, 10); map.set(k, (map.get(k)||0)+1); }
    return map;
  }, [commits]);

  const now = new Date();
  const calDays = useMemo(() => buildCalendarDays(now.getFullYear(), now.getMonth(), commitCounts, selectedDate), [commitCounts, selectedDate]);
  const maxCommits = useMemo(() => Math.max(1, ...Array.from(commitCounts.values())), [commitCounts]);
  const monthName = now.toLocaleDateString("en-US", { month: "long" }).toUpperCase();
  const yearStr = String(now.getFullYear());
  const todayStr = getLocalDateStr(now);
  const displayDate = selectedDate || todayStr;
  const allCommitsForDate = useMemo(() => {
    return commits.filter(c => c.date.slice(0, 10) === displayDate);
  }, [commits, displayDate]);

  // Subsystem stats for right drawer
  const subStats = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of commits) { const s = detectSubsystem(c.title); m.set(s, (m.get(s)||0)+1); }
    return m;
  }, [commits]);

  // Top contributors
  const topContributors = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of commits) m.set(c.author, (m.get(c.author)||0)+1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [commits]);

  function openCommit(c: Commit) {
    const report = findReport(c);
    if (report) {
      setActive(report); setTab("advanced"); setShowDetail(true);
    } else {
      setActive({
        id: 0, githubId: c.sha, title: c.title, author: c.author, date: c.date,
        category: c.category, importance: 5, sourceUrl: c.url, relatedFeatures: [], labels: [],
        advanced: `<h3>What Changed</h3><p>${c.title.replace(/</g,"&lt;")}</p><p>by <strong>${c.author}</strong> on ${fmtDateFull(c.date)}</p><h3>Source</h3><p><a href="${c.url}" target="_blank" rel="noopener">View on GitHub →</a></p><p><em>Deep analysis with knowledge base context is being generated.</em></p>`,
        eli5: `<p><strong>What happened:</strong> A developer named ${c.author} made a change to the Aptos blockchain code.</p><p><strong>The change:</strong> ${c.title.replace(/</g,"&lt;")}</p><p><em>A detailed plain-English explanation is being generated. Check back soon!</em></p>`,
      });
      setTab("advanced"); setShowDetail(true);
    }
  }

  // Navigation in detail view
  const allCommitsList = useMemo(() => [...commitsByDate.values()].flat(), [commitsByDate]);
  function navReport(dir: 1 | -1) {
    if (!active) return;
    const idx = allCommitsList.findIndex(c => c.sha === active.githubId);
    const next = allCommitsList[idx + dir];
    if (next) openCommit(next);
  }

  /* ── Swipe physics ── */
  const x = useMotionValue(0);
  const CAL_OFFSET = isMobile ? (typeof window !== "undefined" ? window.innerWidth - 160 : 270) : 0;
  const MENU_OFFSET = 250;
  const calOpacity = useTransform(x, [0, 150, CAL_OFFSET || 270], [0, 0.5, 1]);
  const calScale = useTransform(x, [0, CAL_OFFSET || 270], [0.95, 1]);
  const archOpacity = useTransform(x, [-MENU_OFFSET, -150, 0], [1, 0.5, 0]);
  const archScale = useTransform(x, [-MENU_OFFSET, 0], [1, 0.95]);
  const fabOpacity = useTransform(x, [-100, 0, 100], [0, 1, 0]);
  const fabScale = useTransform(x, [-100, 0, 100], [0.8, 1, 0.8]);
  const datesOpacity = useTransform(x, [0, 100], [1, 0]);
  const [drawerState, setDrawerState] = useState<"left"|"right"|"closed">("closed");

  const handleDragEnd = (_: any, { offset, velocity }: any) => {
    const t = 50, v = 400, cur = x.get();
    let target = 0, ns: typeof drawerState = "closed";
    if (cur > 50) { if (offset.x < -t || velocity.x < -v) { target=0; ns="closed"; } else { target=CAL_OFFSET; ns="left"; } }
    else if (cur < -50) { if (offset.x > t || velocity.x > v) { target=0; ns="closed"; } else { target=-MENU_OFFSET; ns="right"; } }
    else { if (offset.x > t || velocity.x > v) { target=CAL_OFFSET; ns="left"; } else if (offset.x < -t || velocity.x < -v) { target=-MENU_OFFSET; ns="right"; } }
    setDrawerState(ns);
    animate(x, target, { type: "spring", stiffness: 300, damping: 30, mass: 0.8 });
  };
  const closeDrawer = () => { setDrawerState("closed"); animate(x, 0, { type: "spring", stiffness: 300, damping: 30 }); };

  /* ═══ DETAIL VIEW (mobile only — desktop uses inline center panel) ═══ */
  if (showDetail && active && isMobile) {
    return (
      <div className="fixed inset-0 flex flex-col overflow-hidden" style={{ background: "var(--color-background)" }}>
        <div className="absolute inset-0 pointer-events-none z-0">
          <div className="absolute inset-0 bg-grid-adaptive bg-[size:3rem_3rem] opacity-15" />
        </div>
        <div className="relative z-10 flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)] shrink-0" style={{ background: "var(--color-surface)", paddingTop: isMobile ? "max(env(safe-area-inset-top, 12px), 12px)" : "12px" }}>
          <button onClick={() => setShowDetail(false)} className="label-specimen text-[var(--color-accent)] py-2 px-1 flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> BACK
          </button>
          <div className="flex items-center gap-2">
            <button onClick={() => navReport(-1)} className="p-1 text-[var(--color-text-faint)] hover:text-[var(--color-text)]"><ChevronUp className="w-4 h-4" /></button>
            <button onClick={() => navReport(1)} className="p-1 text-[var(--color-text-faint)] hover:text-[var(--color-text)]"><ChevronDown className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="relative z-10 flex-1 overflow-y-auto px-5 py-5 pb-20">
          <ReportView r={active} tab={tab} setTab={setTab} />
        </div>
      </div>
    );
  }

  /* ═══ DESKTOP ═══ */
  if (!isMobile) {
    return (
      <div className="fixed inset-0 flex flex-col overflow-hidden" style={{ background: "var(--color-background)" }}>
        <div className="absolute inset-0 pointer-events-none z-0">
          <div className="absolute inset-0 bg-grid-adaptive bg-[size:4rem_4rem] opacity-20" />
          <div className="absolute bottom-[5%] right-[5%] opacity-[0.015] select-none">
            <div className="text-[10vw] font-black leading-none text-[var(--color-text)] font-mono tracking-tighter text-right">APTOS</div>
          </div>
        </div>

        {/* 3-column layout */}
        <div className="flex flex-1 overflow-hidden relative z-10">

        {/* Left sidebar — commit list */}
        <div className="h-full flex flex-col border-r border-[var(--color-border)] relative overflow-hidden shrink-0 z-10" style={{ width: 360, background: "var(--color-surface)" }}>
          <div className="absolute inset-0 opacity-[0.015] pointer-events-none bg-[radial-gradient(var(--color-text)_1px,transparent_1px)] bg-[size:4px_4px]" />

          {/* Header */}
          <div className="relative z-10 flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
            <div>
              <span className="text-[12px] font-bold tracking-tight lowercase text-[var(--color-text)]">aptos intelligence</span>
              <span className="label-specimen-sm text-[var(--color-text-faint)] block mt-0.5">{commits.length} commits tracked</span>
            </div>
            <div className="clip-specimen-sm bg-[var(--color-accent)] text-[var(--color-accent-foreground)] label-specimen px-2 py-1">{commits.length}</div>
          </div>

          {/* Search */}
          <div className="relative z-10 px-3 py-3 border-b border-[var(--color-border)]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-faint)]" />
              <input type="text" placeholder="SEARCH COMMITS..." value={search} onChange={e => { setSearch(e.target.value); setSubFilter(null); }}
                className="label-specimen w-full pl-9 pr-3 py-2.5 outline-none bg-[var(--color-background-alt)] border border-[var(--color-border)] text-[var(--color-text)] focus:border-[var(--color-border-focus)]" style={{ fontSize: 10 }} />
            </div>
          </div>

          {/* Commit list */}
          <div className="flex-1 overflow-y-auto relative z-10 no-scrollbar">
            {[...commitsByDate.entries()].map(([dateStr, dayCommits]) => (
              <div key={dateStr}>
                <div className="sticky top-0 z-10 px-4 py-1.5 label-specimen-sm text-[var(--color-text-faint)]" style={{ background: "var(--color-surface)" }}>
                  {fmtDateFull(dateStr)} · {dayCommits.length} commits
                </div>
                {dayCommits.map(c => {
                  const hasReport = !!findReport(c);
                  return (
                    <div key={c.sha} onClick={() => openCommit(c)}
                      className="cursor-pointer px-4 py-3 transition-all border-l-2 border-l-transparent hover:bg-[var(--color-surface-alt)] hover:border-l-[var(--color-accent)]">
                      <p className="text-[12px] font-medium text-[var(--color-text)] leading-snug line-clamp-2">{c.title}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <img src={`https://github.com/${c.author}.png`} alt="" className="w-3.5 h-3.5 rounded-full" />
                        <span className="label-specimen-sm text-[var(--color-text-faint)]">{c.author}</span>
                        <div className="w-[5px] h-[5px] rounded-full" style={{ background: catColor(c.category) }} />
                        {hasReport && <span className="label-specimen-sm text-[var(--color-accent)]">REPORT</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

        </div>

        {/* Center — content */}
        <div className="flex-1 overflow-y-auto relative z-10 min-w-0">
          {active ? (
            <div className="p-10 max-w-[820px] mx-auto animate-fade-in-up" key={active.githubId}>
              <ReportView r={active} tab={tab} setTab={setTab} />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="corner-marks p-10 text-center">
                <p className="label-specimen text-[var(--color-text-faint)]">SELECT A COMMIT TO VIEW ANALYSIS</p>
                <p className="text-[11px] text-[var(--color-text-faint)] mt-2">{commits.length} commits from aptos-labs/aptos-core</p>
              </div>
            </div>
          )}
        </div>

        {/* Right — Feature Progress + Subsystems */}
        <div className="w-[280px] shrink-0 border-l border-[var(--color-border)] overflow-y-auto relative z-10 no-scrollbar" style={{ background: "var(--color-surface)" }}>

          {/* Feature Progress */}
          <div className="p-4 border-b border-[var(--color-border)]">
            <p className="label-specimen text-[var(--color-accent)] tracking-[0.15em]">FEATURE PROGRESS</p>
          </div>
          <div className="p-3 space-y-3">
            {featureProgress.map(fp => (
              <div key={fp.key} className="p-3 rounded-lg border border-[var(--color-border-muted)] hover:border-[var(--color-border)] transition-all cursor-pointer"
                onClick={() => {
                  setActive({
                    id: 0, githubId: fp.key, title: fp.name, author: fp.lead, date: new Date().toISOString(),
                    category: "Feature Progress", importance: fp.progress >= 80 ? 9 : fp.progress >= 50 ? 7 : 5,
                    sourceUrl: `https://github.com/aptos-labs/aptos-core`, relatedFeatures: fp.dependencies, labels: [],
                    advanced: `<h3>${fp.name}</h3><p><strong>Status:</strong> ${fp.status} (${fp.progress}%)</p><p>${fp.description}</p><h3>What's Being Done</h3><p>${fp.whatsBeingDone}</p><h3>What's Needed for Production</h3><p>${fp.whatsNeeded}</p><h3>Effects on the System</h3><p>${fp.effects}</p><h3>Dependencies</h3><ul>${fp.dependencies.map(d => `<li>${d}</li>`).join('')}</ul><h3>Milestones</h3><ul>${fp.milestones.map(m => `<li>${m.done ? '✅' : '⬜'} ${m.name}${m.date ? ` (${m.date})` : ''}</li>`).join('')}</ul><p><strong>Lead:</strong> ${fp.lead} · <strong>Recent commits:</strong> ${fp.recentCommits}</p>`,
                    eli5: `<p><strong>${fp.name}</strong> is ${fp.progress}% done (${fp.status}).</p><p>${fp.description}</p><p><strong>Why it matters:</strong> ${fp.effects}</p><p><strong>What's left:</strong> ${fp.whatsNeeded}</p>`,
                  });
                  setTab("advanced");
                }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="label-specimen-sm text-[var(--color-text)]">{fp.name}</span>
                  <span className="label-specimen-sm" style={{ color: fp.color }}>{fp.progress}%</span>
                </div>
                <div className="h-[3px] rounded-full overflow-hidden" style={{ background: "var(--color-border-muted)" }}>
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${fp.progress}%`, background: fp.color }} />
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="label-specimen-sm text-[var(--color-text-faint)]">{fp.status}</span>
                  <span className="label-specimen-sm text-[var(--color-text-faint)]">{fp.recentCommits} commits</span>
                </div>
                <div className="flex gap-[3px] mt-2">
                  {fp.milestones.map((m, i) => (
                    <div key={i} className="h-[4px] flex-1 rounded-full" style={{ background: m.done ? fp.color : "var(--color-border-muted)" }} title={m.name} />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Aptos Ecosystem */}
          <div className="p-4 border-t border-[var(--color-border)]">
            <p className="label-specimen text-[var(--color-accent)] tracking-[0.15em] mb-3">APTOS ECOSYSTEM</p>
            {[
              { group: "PROTOCOL", items: [
                { name: "Aptos Core", desc: "L1 blockchain node", url: "https://github.com/aptos-labs/aptos-core", color: "#00c853" },
                { name: "Move VM", desc: "Smart contract runtime", url: "https://github.com/aptos-labs/aptos-core/tree/main/third_party/move", color: "#f59e0b" },
                { name: "Aptos Framework", desc: "Core Move modules", url: "https://github.com/aptos-labs/aptos-core/tree/main/aptos-move/framework", color: "#0047ff" },
                { name: "Token Objects", desc: "NFT standard v2", url: "https://github.com/aptos-labs/aptos-core/tree/main/aptos-move/framework/aptos-token-objects", color: "#7c3aed" },
              ]},
              { group: "DEVELOPER TOOLS", items: [
                { name: "Aptos CLI", desc: "Command-line interface", url: "https://github.com/aptos-labs/aptos-core/tree/main/crates/aptos", color: "#14b8a6" },
                { name: "TypeScript SDK", desc: "JS/TS client library", url: "https://github.com/aptos-labs/aptos-ts-sdk", color: "#14b8a6" },
                { name: "Python SDK", desc: "Python client library", url: "https://github.com/aptos-labs/aptos-python-sdk", color: "#14b8a6" },
                { name: "Go SDK", desc: "Go client library", url: "https://github.com/aptos-labs/aptos-go-sdk", color: "#14b8a6" },
                { name: "Rust SDK", desc: "Rust client library", url: "https://github.com/aptos-labs/aptos-core/tree/main/sdk", color: "#14b8a6" },
                { name: "Create Aptos DApp", desc: "DApp scaffolding tool", url: "https://github.com/aptos-labs/create-aptos-dapp", color: "#14b8a6" },
                { name: "Move Prover", desc: "Formal verification", url: "https://github.com/aptos-labs/aptos-core/tree/main/third_party/move/move-prover", color: "#f59e0b" },
                { name: "Aptos Playground", desc: "Online Move editor", url: "https://playground.aptoslabs.com", color: "#14b8a6" },
              ]},
              { group: "INFRASTRUCTURE", items: [
                { name: "Indexer", desc: "Transaction indexing + API", url: "https://github.com/aptos-labs/aptos-indexer-processors", color: "#6b7280" },
                { name: "Node API", desc: "REST + gRPC node API", url: "https://api.mainnet.aptoslabs.com/v1/spec#/", color: "#6b7280" },
                { name: "Transaction Stream", desc: "gRPC streaming API", url: "https://github.com/aptos-labs/aptos-core/tree/main/ecosystem/indexer-grpc", color: "#6b7280" },
                { name: "Faucet", desc: "Testnet token faucet", url: "https://github.com/aptos-labs/aptos-core/tree/main/crates/aptos-faucet", color: "#6b7280" },
                { name: "Petra Wallet", desc: "Official browser wallet", url: "https://petra.app", color: "#ff4d00" },
                { name: "Wallet Adapter", desc: "Multi-wallet connector", url: "https://github.com/aptos-labs/aptos-wallet-adapter", color: "#ff4d00" },
              ]},
              { group: "PRODUCTS", items: [
                { name: "Aptos Names (ANS)", desc: ".apt domain names", url: "https://aptosnames.com", color: "#CBB696" },
                { name: "Keyless Accounts", desc: "Social login accounts", url: "https://aptoslabs.com/keyless", color: "#0047ff" },
                { name: "Confidential Assets", desc: "Private APT transfers", url: "https://confidential.aptoslabs.com", color: "#7c3aed" },
                { name: "Aptos Explorer", desc: "Block explorer", url: "https://explorer.aptoslabs.com", color: "#14b8a6" },
                { name: "Aptos Scan", desc: "Community explorer", url: "https://aptosscan.com", color: "#14b8a6" },
              ]},
              { group: "AGGREGATORS / TOKENS", items: [
                { name: "NFT Aggregator", desc: "Batch mint infrastructure", url: "https://github.com/aptos-labs/aptos-core/tree/main/aptos-move/framework/aptos-stdlib", color: "#ec4899" },
                { name: "Token v1", desc: "Original NFT standard", url: "https://github.com/aptos-labs/aptos-core/blob/main/aptos-move/framework/aptos-token/sources/token.move", color: "#ec4899" },
                { name: "Digital Assets", desc: "Token Objects (v2)", url: "https://github.com/aptos-labs/aptos-core/tree/main/aptos-move/framework/aptos-token-objects", color: "#ec4899" },
                { name: "Token Minter", desc: "NFT collection launcher", url: "https://github.com/aptos-labs/token-minter", color: "#ec4899" },
              ]},
            ].map(({ group, items }) => (
              <div key={group} className="mb-4">
                <p className="label-specimen-sm text-[var(--color-text-faint)] mb-1.5">{group}</p>
                {items.map(item => (
                  <a key={item.name} href={item.url} target="_blank" rel="noopener"
                    className="flex items-center gap-2 px-2 py-1.5 rounded transition-all hover:bg-[var(--color-surface-alt)] no-underline group">
                    <div className="w-[4px] h-[12px] rounded-full shrink-0" style={{ background: item.color }} />
                    <div className="flex-1 min-w-0">
                      <span className="label-specimen-sm text-[var(--color-text)] group-hover:text-[var(--color-accent)] transition-colors block">{item.name}</span>
                      <span className="text-[9px] text-[var(--color-text-faint)] block truncate">{item.desc}</span>
                    </div>
                    <ExternalLink className="w-2.5 h-2.5 text-[var(--color-text-faint)] opacity-0 group-hover:opacity-100 shrink-0" />
                  </a>
                ))}
              </div>
            ))}
          </div>

          {/* Subsystem filter */}
          <div className="p-4 border-t border-[var(--color-border)]">
            <p className="label-specimen text-[var(--color-accent)] tracking-[0.15em] mb-3">FILTER BY SUBSYSTEM</p>
            {SUBSYSTEMS.map(s => (
              <div key={s.key} onClick={() => setSubFilter(subFilter === s.key ? null : s.key)}
                className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-all ${subFilter === s.key ? "bg-[var(--color-surface-alt)]" : "hover:bg-[var(--color-surface-alt)]"}`}>
                <div className="w-[4px] h-[14px] rounded-full shrink-0" style={{ background: s.color }} />
                <span className="label-specimen-sm text-[var(--color-text)] flex-1">{s.name}</span>
                <span className="label-specimen-sm text-[var(--color-text-faint)]">{subStats.get(s.key) || 0}</span>
              </div>
            ))}
          </div>

          {/* Top contributors */}
          <div className="p-4 border-t border-[var(--color-border)]">
            <p className="label-specimen text-[var(--color-accent)] tracking-[0.15em] mb-3">TOP CONTRIBUTORS</p>
            {topContributors.map(([name, count]) => (
              <div key={name} className="flex items-center gap-2 py-1.5">
                <img src={`https://github.com/${name}.png`} alt="" className="w-5 h-5 rounded-full" />
                <span className="label-specimen-sm text-[var(--color-text)] flex-1 truncate">{name}</span>
                <span className="label-specimen-sm text-[var(--color-text-faint)]">{count}</span>
              </div>
            ))}
          </div>
        </div>

        </div>

        {/* Full-width status bar */}
        <div className="relative z-10 border-t border-[var(--color-border)] px-6 py-2.5 flex items-center justify-between shrink-0"
          style={{ background: "var(--color-surface)", backgroundImage: "repeating-linear-gradient(135deg, transparent, transparent 10px, rgba(204,255,0,0.04) 10px, rgba(204,255,0,0.04) 20px)" }}>
          <span className="label-specimen-sm text-[var(--color-text-faint)]">{commits.length} commits · {reports.length} reports · {featureProgress.length} features tracked</span>
          <div className="flex items-center gap-3">
            <span className="label-specimen-sm text-[var(--color-text-faint)]">aptos-labs/aptos-core</span>
            <span className="label-specimen-sm text-[var(--color-accent)]">● LIVE</span>
          </div>
        </div>
      </div>
    );
  }

  /* ═══ MOBILE — Timepage layout ═══ */
  return (
    <div className="fixed inset-0 overflow-hidden bg-black select-none">

      {/* LEFT DRAWER — Calendar */}
      <motion.div className="absolute inset-0 bg-black text-white px-5 overflow-hidden"
        style={{ opacity: calOpacity, scale: calScale, pointerEvents: drawerState === "left" ? "auto" : "none", paddingTop: "max(env(safe-area-inset-top, 16px), 50px)" }}>
        <div className="flex flex-col h-full overflow-hidden">
          <div className="text-left ml-1">
            <h2 className="text-[40px] font-light tracking-wide leading-[1.1] text-[#CBB696]">{yearStr}</h2>
            <h1 className="text-[40px] font-bold tracking-wide leading-[1.1] text-[#CBB696]">{monthName}</h1>
          </div>
          <div className="mt-5 max-w-[300px]">
            <div className="grid grid-cols-7 mb-[14px] px-1">
              {DAY_HEADERS.map((d, i) => <div key={i} className="text-center text-[11px] font-medium text-white/50">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-y-[11px] px-1">
              {calDays.map((day, i) => {
                let cls = "w-[32px] h-[32px] flex items-center justify-center text-[14px] font-medium rounded-full cursor-pointer transition-colors ";
                if (day.type === "prev" || day.type === "next") cls += "text-[#4B4B4B]";
                else if (day.type === "active") cls += "bg-white text-black font-bold ring-[1px] ring-white ring-offset-[2px] ring-offset-black";
                else if (day.type === "today-dim") cls += "border-[1.5px] border-[#CBB696] text-[#F0F0F0]";
                else if (day.type === "has-commits") cls += "bg-[#474031] text-[#F0F0F0]";
                else cls += "text-[#F0F0F0]";
                return (
                  <div key={i} className="flex justify-center items-center">
                    <div className={cls} onClick={() => day.dateStr && setSelectedDate(day.dateStr === selectedDate ? null : day.dateStr)}>{day.d}</div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="mt-7 flex items-center justify-between px-1">
            <span className="text-[18px] font-bold tracking-wide text-white">{selectedDate ? fmtDate(selectedDate).toUpperCase() : "TODAY"}</span>
            <span className="label-specimen text-white/40">{allCommitsForDate.length}</span>
          </div>
          <div className="mt-4 px-1 space-y-4 overflow-y-auto no-scrollbar flex-1 pb-16">
            {allCommitsForDate.length === 0 ? <p className="text-[13px] text-white/40">No commits this day</p> :
              allCommitsForDate.map(c => (
                <div key={c.sha} className="flex items-start gap-3 cursor-pointer" onClick={() => { openCommit(c); closeDrawer(); }}>
                  <div className="w-[6px] h-[18px] bg-[#F28140] rounded-full mt-[1px] shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[14px] font-medium text-white leading-snug truncate">{c.title}</div>
                    <div className="text-[11px] text-white/60 mt-1">{c.author}</div>
                  </div>
                </div>
              ))}
          </div>
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 bg-[#161616] rounded-full">
            <div className="w-[5px] h-[5px] rounded-full bg-white/30" /><div className="w-[7px] h-[7px] rounded-full bg-white/90" /><div className="w-[5px] h-[5px] rounded-full bg-white/30" />
          </div>
        </div>
      </motion.div>

      {/* RIGHT DRAWER — Feature Progress + Subsystems */}
      <motion.div className="absolute inset-0 bg-black text-white overflow-y-auto no-scrollbar"
        style={{ opacity: archOpacity, scale: archScale, pointerEvents: drawerState === "right" ? "auto" : "none", paddingTop: "max(env(safe-area-inset-top, 16px), 50px)" }}>
        <div className="max-w-[240px] ml-auto px-5 pb-20">
          <h1 className="label-specimen text-[#CBB696] text-[13px] tracking-[0.2em] mb-6">ROADMAP</h1>

          {/* Feature progress cards */}
          <div className="space-y-3 mb-8">
            {featureProgress.map(fp => (
              <div key={fp.key} className="cursor-pointer" onClick={() => {
                openCommit({ sha: fp.key, title: fp.name, author: fp.lead, date: new Date().toISOString(), url: '', category: 'Feature Progress' });
                closeDrawer();
              }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[13px] font-medium text-white">{fp.name}</span>
                  <span className="text-[10px] font-bold" style={{ color: fp.color }}>{fp.progress}%</span>
                </div>
                <div className="h-[3px] rounded-full overflow-hidden bg-white/10">
                  <div className="h-full rounded-full" style={{ width: `${fp.progress}%`, background: fp.color }} />
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[9px] text-white/40">{fp.status}</span>
                  <span className="text-[9px] text-white/40">{fp.lead}</span>
                </div>
                {/* Milestone dots */}
                <div className="flex gap-[2px] mt-1.5">
                  {fp.milestones.map((m, i) => (
                    <div key={i} className="h-[3px] flex-1 rounded-full" style={{ background: m.done ? fp.color : "rgba(255,255,255,0.1)" }} />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Subsystem filter */}
          <div className="border-t border-white/10 pt-5 mb-6">
            <p className="label-specimen-sm text-white/40 mb-3">SUBSYSTEMS</p>
            {SUBSYSTEMS.map(s => (
              <div key={s.key} className="flex items-center gap-2 py-1.5 cursor-pointer" onClick={() => { setSubFilter(s.key); closeDrawer(); }}>
                <div className="w-[4px] h-[14px] rounded-full shrink-0" style={{ background: s.color }} />
                <span className="text-[12px] text-white/70 flex-1">{s.name}</span>
                <span className="text-[10px] text-white/30">{subStats.get(s.key) || 0}</span>
              </div>
            ))}
          </div>

          {/* Contributors */}
          <div className="border-t border-white/10 pt-5">
            <p className="label-specimen-sm text-white/40 mb-3">TOP CONTRIBUTORS</p>
            {topContributors.slice(0, 6).map(([name, count]) => (
              <div key={name} className="flex items-center gap-2 py-1.5">
                <img src={`https://github.com/${name}.png`} alt="" className="w-4 h-4 rounded-full" />
                <span className="text-[12px] text-white/80 flex-1 truncate">{name}</span>
                <span className="text-[10px] text-white/30">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* TOP LAYER — Timeline */}
      <motion.div drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.4} dragDirectionLock
        onDragEnd={handleDragEnd} style={{ x, touchAction: "pan-y" }}
        className="absolute inset-0 flex overflow-hidden z-20 cursor-grab active:cursor-grabbing will-change-transform">

        <div className="absolute left-[80px] right-0 top-0 bottom-0 bg-[#877C65] shadow-[0_0_50px_rgba(0,0,0,0.8)] z-0 pointer-events-none" />
        <motion.div style={{ opacity: datesOpacity }} className="absolute left-0 top-0 bottom-0 w-[80px] bg-black z-0 pointer-events-none" />
        <motion.div style={{ opacity: datesOpacity }} className="absolute left-0 top-0 bottom-0 w-[32px] flex items-center justify-center z-10 pointer-events-none">
          <span className="-rotate-90 whitespace-nowrap text-[11px] tracking-[0.45em] font-semibold text-[#B3A48A] uppercase">{yearStr} {monthName}</span>
        </motion.div>

        {subFilter && (
          <div className="absolute top-3 left-[90px] right-4 z-30 flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "rgba(0,0,0,0.6)" }}>
            <span className="label-specimen-sm text-white/70">Filtered: {SUBSYSTEMS.find(s=>s.key===subFilter)?.name}</span>
            <button onClick={() => setSubFilter(null)} className="label-specimen-sm text-[#F28140] ml-auto">CLEAR</button>
          </div>
        )}

        <div className="absolute inset-0 overflow-y-auto overflow-x-hidden no-scrollbar pb-40 z-20 scroll-smooth">
          <div className="pt-2" />
          {loading ? (
            <div className="p-8 ml-[80px]">{[1,2,3,4,5].map(i => <div key={i} className="skeleton-mech mb-3" style={{ height: 12, width: `${50+i*8}%` }} />)}</div>
          ) : [...commitsByDate.entries()].map(([dateStr, dayCommits], idx) => {
            const d = new Date(dateStr + "T12:00:00");
            return (
              <div key={dateStr} className="flex min-h-[90px] w-full overflow-hidden">
                <motion.div style={{ opacity: datesOpacity }} className="w-[80px] shrink-0 flex items-start justify-end pr-[10px] pt-[14px]">
                  <motion.div layout initial={false}
                    animate={{ backgroundColor: dateStr === todayStr ? "#ffffff" : "transparent", scale: dateStr === todayStr ? 1 : 0.95 }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    className={`w-[40px] h-[60px] flex flex-col items-center justify-center rounded-[14px] ${dateStr === todayStr ? "shadow-md" : ""}`}>
                    <span className={`text-[9px] tracking-widest mb-0.5 ${dateStr === todayStr ? "font-semibold text-black" : "font-medium text-white/50"}`}>{DAY_NAMES[d.getDay()]}</span>
                    <span className={`text-[22px] font-bold leading-none ${dateStr === todayStr ? "text-black" : "text-white"}`}>{d.getDate()}</span>
                  </motion.div>
                </motion.div>
                <div className={`flex-1 min-w-0 flex flex-col justify-center pt-3 pb-4 pl-3 pr-3 overflow-hidden ${idx % 2 === 0 ? "bg-black/[0.04]" : ""}`}>
                  {dayCommits.map(c => (
                    <motion.div key={c.sha} whileTap={{ scale: 0.98, backgroundColor: "rgba(255,255,255,0.08)" }}
                      className="flex items-start gap-3 mb-3 last:mb-0 p-2 -ml-1 rounded-lg cursor-pointer"
                      onClick={e => { e.stopPropagation(); openCommit(c); }} onPointerDown={e => e.stopPropagation()}>
                      <div className="mt-[3px] shrink-0"><div className="w-[5px] h-[18px] rounded-full" style={{ background: catColor(c.category) }} /></div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-[14px] font-medium text-white leading-snug break-words line-clamp-2">{c.title}</h3>
                        <div className="flex items-center gap-1.5 mt-1">
                          <img src={`https://github.com/${c.author}.png`} alt="" className="w-3 h-3 rounded-full" />
                          <span className="text-[11px] text-white/60 truncate">{c.author}</span>
                          {findReport(c) && <span className="text-[8px] font-bold tracking-widest text-[#F28140]">REPORT</span>}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Mobile status bar */}
        <motion.div
          className="absolute bottom-0 left-0 right-0 z-30 border-t border-white/10 backdrop-blur-sm px-4 py-2 flex items-center justify-between"
          style={{ opacity: fabOpacity, paddingBottom: "max(env(safe-area-inset-bottom, 8px), 8px)", background: "rgba(0,0,0,0.85)", backgroundImage: "repeating-linear-gradient(135deg, transparent, transparent 10px, rgba(204,255,0,0.03) 10px, rgba(204,255,0,0.03) 20px)" }}>
          <span className="label-specimen-sm text-white/50">{commits.length} commits</span>
          <span className="label-specimen-sm text-[#CBB696]">● LIVE</span>
        </motion.div>

        <motion.button style={{ opacity: fabOpacity, scale: fabScale }}
          className="absolute bottom-12 right-5 w-[52px] h-[52px] rounded-full bg-[#9F947F] flex items-center justify-center shadow-2xl border border-white/10 z-50"
          onClick={() => { setDrawerState("left"); animate(x, CAL_OFFSET, { type: "spring", stiffness: 300, damping: 30 }); }}>
          <Layers className="w-6 h-6 text-white" />
        </motion.button>

        <div className="absolute inset-0 z-40" style={{ display: drawerState !== "closed" ? "block" : "none" }} onClick={closeDrawer} />
      </motion.div>

      <style dangerouslySetInnerHTML={{ __html: `.no-scrollbar::-webkit-scrollbar{display:none}.no-scrollbar{-ms-overflow-style:none;scrollbar-width:none}` }} />
    </div>
  );
}

/* ═══ Report View ═══ */
function ReportView({ r, tab, setTab }: { r: WebReport; tab: "advanced"|"eli5"; setTab: (t: "advanced"|"eli5") => void }) {
  return (
    <div className="animate-fade-in-up" key={r.githubId}>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <span className="label-specimen-sm" style={{ color: catColor(r.category), borderLeft: `2px solid ${catColor(r.category)}`, paddingLeft: 6 }}>{r.category}</span>
        <span className={`label-specimen ${r.importance >= 8 ? "text-[var(--color-danger)]" : r.importance >= 6 ? "text-[var(--color-warning)]" : "text-[var(--color-text-faint)]"}`}>IMP {r.importance}/10</span>
        <span className="label-specimen-sm text-[var(--color-text-faint)]">{fmtDateFull(r.date)}</span>
      </div>
      <h2 className="text-[18px] font-extrabold text-[var(--color-text)] leading-[1.25] tracking-[-0.02em] font-sans m-0 break-words">{r.title}</h2>
      <div className="flex items-center gap-2.5 mt-3 mb-5 flex-wrap">
        <img src={`https://github.com/${r.author}.png`} alt="" className="w-5 h-5 clip-specimen-sm" />
        <span className="label-specimen text-[var(--color-text-muted)]">{r.author}</span>
        <a href={r.sourceUrl} target="_blank" rel="noopener" className="label-specimen text-[var(--color-accent)] no-underline hover:underline ml-auto flex items-center gap-1">
          SOURCE <ExternalLink className="w-3 h-3" />
        </a>
      </div>
      <div className="flex gap-2 mb-5">
        <MechButton active={tab === "advanced"} onClick={() => setTab("advanced")} className="h-[32px] px-3 text-[10px] uppercase">◆ Advanced</MechButton>
        <MechButton active={tab === "eli5"} onClick={() => setTab("eli5")} className="h-[32px] px-3 text-[10px] uppercase">◇ ELI5</MechButton>
      </div>
      <div className="clip-specimen border-mech corner-marks bg-[var(--color-surface)] p-4 md:p-6" key={`${r.githubId}-${tab}`}>
        <div className={tab === "advanced" ? "prose-mono" : "prose-eli5"}>
          <div dangerouslySetInnerHTML={{ __html: tab === "advanced" ? r.advanced : r.eli5 }} />
        </div>
      </div>
      {r.relatedFeatures.length > 0 && (
        <div className="mt-5">
          <p className="label-specimen-sm text-[var(--color-text-faint)] mb-2">RELATED FEATURES</p>
          <div className="flex flex-wrap gap-2">
            {r.relatedFeatures.map(f => <span key={f} className="clip-specimen-sm label-specimen-sm px-3 py-1.5 bg-[color-mix(in_srgb,var(--color-accent)_8%,transparent)] border border-[color-mix(in_srgb,var(--color-accent)_20%,transparent)] text-[var(--color-accent)]">{f}</span>)}
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
