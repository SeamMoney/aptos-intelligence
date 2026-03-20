import { useState, useEffect, useCallback } from "react";
import type { WebReport, FeatureStatus } from "./api";
import { fetchReports, fetchFeatures } from "./api";

// ─── SmoothUI Components (all 40) ───
// All 40 SmoothUI components
import ClipCornersButton from "@/components/smoothui/clip-corners-button";
import ContributionGraph from "@/components/smoothui/contribution-graph";
import CursorFollow from "@/components/smoothui/cursor-follow";
import DotMorphButton from "@/components/smoothui/dot-morph-button";
import DynamicIsland from "@/components/smoothui/dynamic-island";
import ExpandableCards from "@/components/smoothui/expandable-cards";
import ExposureSlider from "@/components/smoothui/exposure-slider";
import FigmaComment from "@/components/smoothui/figma-comment";
import GitHubStarsAnimation from "@/components/smoothui/github-stars-animation";
import GlowHoverCard from "@/components/smoothui/glow-hover-cards";
import GooeyPopover from "@/components/smoothui/gooey-popover";
import GridLoader from "@/components/smoothui/grid-loader";
import ImageMetadataPreview from "@/components/smoothui/image-metadata-preview";
import InfiniteSlider from "@/components/smoothui/infinite-slider";
import InteractiveImageSelector from "@/components/smoothui/interactive-image-selector";
import JobListingComponent from "@/components/smoothui/job-listing-component";
import MagneticButton from "@/components/smoothui/magnetic-button";
import NotificationBadge from "@/components/smoothui/notification-badge";
import NumberFlow from "@/components/smoothui/number-flow";
import Phototab from "@/components/smoothui/phototab";
import PowerOffSlide from "@/components/smoothui/power-off-slide";
import PriceFlow from "@/components/smoothui/price-flow";
import ProductCard from "@/components/smoothui/product-card";
import RevealText from "@/components/smoothui/reveal-text";
import ReviewsCarousel from "@/components/smoothui/reviews-carousel";
import RichTooltip from "@/components/smoothui/rich-popover";
import ScrambleHover from "@/components/smoothui/scramble-hover";
import ScrollRevealParagraph from "@/components/smoothui/scroll-reveal-paragraph";
import ScrollableCardStack from "@/components/smoothui/scrollable-card-stack";
import Scrubber from "@/components/smoothui/scrubber";
import SearchableDropdown from "@/components/smoothui/searchable-dropdown";
import SiriOrb from "@/components/smoothui/siri-orb";
import Skeleton from "@/components/smoothui/skeleton";
import SmoothButton from "@/components/smoothui/smooth-button";
import SocialSelector from "@/components/smoothui/social-selector";
import SwitchboardCard from "@/components/smoothui/switchboard-card";
import TypewriterText from "@/components/smoothui/typewriter-text";
import UserAccountAvatar from "@/components/smoothui/user-account-avatar";
import WaveText from "@/components/smoothui/wave-text";

// ─── Helpers ───
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

// Generate contribution data from reports
function buildContribData(reports: WebReport[]) {
  const counts: Record<string, number> = {};
  reports.forEach((r) => {
    const day = r.date.slice(0, 10);
    counts[day] = (counts[day] || 0) + 1;
  });
  return Object.entries(counts).map(([date, count]) => ({ date, count }));
}

// ─── Main Dashboard ───
export default function Dashboard() {
  const [reports, setReports] = useState<WebReport[]>([]);
  const [features, setFeatures] = useState<FeatureStatus[]>([]);
  const [activeReport, setActiveReport] = useState<WebReport | null>(null);
  const [activeCategory, setActiveCategory] = useState("All");
  const [loading, setLoading] = useState(true);
  const [importanceThreshold, setImportanceThreshold] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [dotState, setDotState] = useState<"idle" | "loading" | "success">("idle");

  const load = useCallback(async () => {
    setLoading(true);
    setDotState("loading");
    try {
      const [reps, feats] = await Promise.all([fetchReports(), fetchFeatures()]);
      setReports(reps);
      setFeatures(feats);
      if (reps.length > 0 && !activeReport) setActiveReport(reps[0]);
      setDotState("success");
    } catch {
      setDotState("idle");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = reports.filter((r) => {
    if (activeCategory !== "All" && r.category !== activeCategory) return false;
    if (r.importance < importanceThreshold) return false;
    if (searchQuery && !r.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const totalImportance = reports.reduce((sum, r) => sum + r.importance, 0);
  const avgImportance = reports.length ? Math.round(totalImportance / reports.length * 10) / 10 : 0;

  // ─── Render ───
  return (
    <CursorFollow>
      <div className="flex h-screen overflow-hidden bg-[#0a0a0f]">

        {/* ████ LEFT SIDEBAR ████ */}
        <div className="w-[400px] min-w-[400px] border-r border-white/5 flex flex-col">

          {/* Logo + Dynamic Island */}
          <div className="p-5 border-b border-white/5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <SiriOrb size="40px" />
                <div>
                  <RevealText direction="up">
                    <h1 className="text-xl font-bold text-emerald-400 leading-tight">Aptos Intelligence</h1>
                  </RevealText>
                  <TypewriterText speed={30} className="text-xs text-white/40">
                    Every commit that matters — explained
                  </TypewriterText>
                </div>
              </div>
              <NotificationBadge variant="count" count={reports.length} className="relative" />
            </div>

            <DynamicIsland
              view="compact"
              className="w-full"
            >
              <div className="flex items-center justify-between px-3 py-1 text-xs text-white/60 w-full">
                <span>Live monitoring aptos-core</span>
                <span className="text-emerald-400">Active</span>
              </div>
            </DynamicIsland>
          </div>

          {/* Search + Filters */}
          <div className="p-4 border-b border-white/5 space-y-3">
            <SearchableDropdown
              label="Search reports..."
              items={reports.map((r) => ({ id: String(r.id), label: r.title, description: r.category }))}
              onSelect={(item) => {
                const found = reports.find((r) => String(r.id) === item.id);
                if (found) setActiveReport(found);
              }}
            />

            <div className="flex gap-1.5 flex-wrap">
              {CATEGORIES.map((cat) => (
                <ClipCornersButton
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`text-xs px-3 py-1 transition-colors ${
                    activeCategory === cat
                      ? "bg-emerald-400/20 text-emerald-400"
                      : "bg-white/5 text-white/40 hover:text-white/60"
                  }`}
                >
                  {cat}
                </ClipCornersButton>
              ))}
            </div>
          </div>

          {/* Report list */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1" data-cursor-text="Select">
            {loading ? (
              <div className="p-8 flex flex-col items-center gap-4">
                <GridLoader pattern="plus-hollow" mode="pulse" />
                <Skeleton width="80%" height={16} />
                <Skeleton width="60%" height={16} />
                <Skeleton width="70%" height={16} />
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center text-white/30 text-sm">
                <WaveText amplitude={4} className="text-lg">No reports found</WaveText>
                <p className="mt-2">Adjust filters or wait for the bot to analyze new commits.</p>
              </div>
            ) : (
              filtered.map((r) => (
                <GlowHoverCard
                  key={r.id}
                  className={`cursor-pointer transition-all ${
                    activeReport?.id === r.id
                      ? "border-emerald-400/40 bg-emerald-400/5"
                      : "hover:bg-white/[0.03]"
                  }`}
                  glowColor={activeReport?.id === r.id ? "rgba(0,232,157,0.12)" : "rgba(255,255,255,0.04)"}
                >
                  <div className="p-4" onClick={() => setActiveReport(r)}>
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
                </GlowHoverCard>
              ))
            )}
          </div>

          {/* GitHub Stars Footer */}
          <div className="p-3 border-t border-white/5">
            <GitHubStarsAnimation owner="aptos-labs" repo="aptos-core" />
          </div>
        </div>

        {/* ████ MAIN CONTENT ████ */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Top Stats Bar */}
          <div className="border-b border-white/5 px-8 py-4">
            <div className="flex items-center gap-8">
              {/* Stats */}
              <div className="flex gap-6">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-white/30 mb-1">Reports</div>
                  <NumberFlow value={reports.length} min={0} max={9999} />
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-white/30 mb-1">Avg Importance</div>
                  <PriceFlow value={avgImportance} />
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-white/30 mb-1">Features Tracked</div>
                  <NumberFlow value={features.length} min={0} max={99} />
                </div>
              </div>

              <div className="flex-1" />

              {/* Controls */}
              <div className="flex items-center gap-3">
                <ExposureSlider
                  min={0}
                  max={10}
                  step={1}
                  defaultValue={0}
                  onChange={(val: number) => setImportanceThreshold(val)}
                />
                <DotMorphButton
                  label="Refresh"
                  state={dotState}
                  onClick={() => { setDotState("idle"); load(); }}
                />
                <RichTooltip
                  trigger={
                    <MagneticButton strength={0.2}>
                      <SmoothButton variant="outline" size="sm">Settings</SmoothButton>
                    </MagneticButton>
                  }
                  title="Dashboard Settings"
                  description="Configure importance threshold and refresh interval."
                />
              </div>
            </div>

            {/* Infinite ticker */}
            {reports.length > 0 && (
              <div className="mt-3 -mx-8 px-8 border-t border-white/5 pt-3">
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
          </div>

          {/* Content area */}
          <div className="flex-1 overflow-y-auto">
            {!activeReport ? (
              <div className="flex flex-col items-center justify-center h-full gap-6 text-white/20">
                <SiriOrb size="120px" />
                <WaveText amplitude={6} className="text-2xl font-light">Select a report to begin</WaveText>
                <p className="text-sm max-w-md text-center">
                  Each update has Advanced and ELI5 explanations powered by AI analysis of Aptos-core commits.
                </p>
              </div>
            ) : (
              <div className="p-8 max-w-5xl mx-auto space-y-8">

                {/* Report Header */}
                <div>
                  <RevealText direction="up" className="text-2xl font-semibold text-white leading-tight">
                    {activeReport.title}
                  </RevealText>
                  <div className="flex items-center gap-4 mt-3 text-sm text-white/40">
                    <UserAccountAvatar
                      user={{ name: activeReport.author, email: "", avatar: `https://github.com/${activeReport.author}.png` }}
                    />
                    <span>{activeReport.author}</span>
                    <span>{formatDate(activeReport.date)}</span>
                    <span className={`px-2 py-0.5 rounded border text-xs font-mono ${badgeColor(activeReport.category)}`}>
                      {activeReport.category}
                    </span>
                    <a
                      href={activeReport.sourceUrl}
                      target="_blank"
                      rel="noopener"
                      className="text-emerald-400 hover:underline"
                    >
                      View on GitHub
                    </a>
                  </div>
                </div>

                {/* ─── Advanced / ELI5 Tab Switcher (Phototab) ─── */}
                <Phototab
                  tabs={[
                    {
                      name: "Advanced",
                      icon: (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                        </svg>
                      ),
                      image: "",
                    },
                    {
                      name: "ELI5",
                      icon: (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      ),
                      image: "",
                    },
                  ]}
                  renderContent={(activeTab) => (
                    <div className="prose prose-invert max-w-none mt-6">
                      {activeTab === 0 ? (
                        <div dangerouslySetInnerHTML={{ __html: activeReport.advanced }} />
                      ) : (
                        <div className="text-lg leading-relaxed" dangerouslySetInnerHTML={{ __html: activeReport.eli5 }} />
                      )}
                    </div>
                  )}
                />

                {/* Related Features */}
                {activeReport.relatedFeatures.length > 0 && (
                  <GlowHoverCard className="p-5">
                    <div className="text-[10px] uppercase tracking-widest text-white/30 mb-3">Related Features</div>
                    <div className="flex flex-wrap gap-2">
                      {activeReport.relatedFeatures.map((f) => (
                        <span key={f} className="px-3 py-1 rounded-lg text-xs bg-emerald-400/10 text-emerald-400 border border-emerald-400/20">
                          {f}
                        </span>
                      ))}
                    </div>
                  </GlowHoverCard>
                )}

                {/* Figma-style comment for community notes */}
                <FigmaComment
                  authorName="Aptos Intelligence Bot"
                  message={`Analyzed with importance ${activeReport.importance}/10. Category: ${activeReport.category}. ${activeReport.relatedFeatures.length} related features detected.`}
                  avatarUrl="https://github.com/aptos-labs.png"
                  timestamp={formatDate(activeReport.date)}
                />

                {/* Image metadata-style PR info card */}
                <ImageMetadataPreview
                  imageSrc="https://github.com/aptos-labs.png"
                  metadata={{
                    created: formatDate(activeReport.date),
                    updated: formatDate(activeReport.date),
                    by: activeReport.author,
                    source: activeReport.sourceUrl,
                  }}
                />

                {/* Tweet Preview */}
                <GlowHoverCard className="p-5">
                  <div className="text-[10px] uppercase tracking-widest text-white/30 mb-3">Generated Tweet Preview</div>
                  <div className="bg-black/40 rounded-xl p-4 border border-white/5">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-full bg-emerald-400/20 flex items-center justify-center text-emerald-400 text-xs font-bold">AI</div>
                      <div>
                        <div className="text-sm font-medium text-white">Aptos Intelligence</div>
                        <div className="text-xs text-white/30">@AptosIntelligence</div>
                      </div>
                    </div>
                    <p className="text-sm text-white/70 leading-relaxed">
                      {activeReport.category === "Release" ? "📦" : "⚙️"} {activeReport.title.slice(0, 180)}...
                    </p>
                    <div className="mt-2 text-xs text-white/20">{formatDate(activeReport.date)}</div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <PowerOffSlide
                      label="Slide to post"
                      onComplete={() => console.log("Posted to X!")}
                    />
                  </div>
                </GlowHoverCard>

                {/* Contribution Graph */}
                <GlowHoverCard className="p-5">
                  <div className="text-[10px] uppercase tracking-widest text-white/30 mb-3">Report Activity</div>
                  <ContributionGraph
                    data={buildContribData(reports)}
                    year={new Date().getFullYear()}
                  />
                </GlowHoverCard>

                {/* Feature Status Cards (Switchboard + Expandable) */}
                {features.length > 0 && (
                  <div>
                    <ScrollRevealParagraph paragraph="Feature Tracker — Live status of major Aptos features being tracked across the codebase." />
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      {features.slice(0, 4).map((f) => (
                        <SwitchboardCard
                          key={f.key}
                          title={f.name}
                          subtitle={`${f.status} — ${f.progress}%`}
                        />
                      ))}
                    </div>

                    {features.length > 4 && (
                      <div className="mt-4">
                        <ExpandableCards
                          cards={features.slice(4).map((f, i) => ({
                            id: i + 5,
                            title: f.name,
                            image: "https://github.com/aptos-labs.png",
                            content: `Status: ${f.status} | Progress: ${f.progress}% | Last updated: ${f.lastUpdated}`,
                          }))}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Reviews Carousel for highlighted reports */}
                {reports.length > 3 && (
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-white/30 mb-3">Highlighted Reports</div>
                    <ReviewsCarousel
                      reviews={reports.slice(0, 6).map((r) => ({
                        id: r.id,
                        body: r.advanced.replace(/<[^>]*>/g, "").slice(0, 200) + "...",
                        author: r.author,
                        title: r.title,
                      }))}
                    />
                  </div>
                )}

                {/* Scrollable Card Stack */}
                {reports.length > 2 && (
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-white/30 mb-3">Recent Stack</div>
                    <ScrollableCardStack
                      items={reports.slice(0, 5).map((r) => ({
                        id: r.id,
                        name: r.title,
                        handle: `@${r.author}`,
                        avatar: `https://github.com/${r.author}.png`,
                        image: "https://github.com/aptos-labs.png",
                        href: r.sourceUrl,
                      }))}
                    />
                  </div>
                )}

                {/* Product Card — Feature highlight */}
                {features.length > 0 && (
                  <div className="grid grid-cols-2 gap-4">
                    {features.slice(0, 2).map((f) => (
                      <ProductCard
                        key={f.key}
                        image="https://github.com/aptos-labs.png"
                        title={f.name}
                        price={f.progress}
                        description={f.status}
                      />
                    ))}
                  </div>
                )}

                {/* Interactive Image Selector for categories */}
                <InteractiveImageSelector
                  images={CATEGORIES.filter((c) => c !== "All").map((cat, i) => ({
                    id: i + 1,
                    src: "https://github.com/aptos-labs.png",
                    caption: cat,
                  }))}
                  onSelect={(selected) => {
                    if (selected.length > 0) {
                      const cat = CATEGORIES.filter((c) => c !== "All")[selected[0] - 1];
                      if (cat) setActiveCategory(cat);
                    }
                  }}
                />

                {/* Job Listing-style report list */}
                {filtered.length > 0 && (
                  <JobListingComponent
                    jobs={filtered.slice(0, 5).map((r) => ({
                      company: "Aptos Labs",
                      title: r.title,
                      logo: "https://github.com/aptos-labs.png",
                      location: r.category,
                      salary: `Importance: ${r.importance}/10`,
                      tags: r.relatedFeatures.slice(0, 3),
                      type: r.category,
                      posted: formatDate(r.date),
                    }))}
                  />
                )}

                {/* Scrubber for timeline navigation */}
                <div className="py-4">
                  <div className="text-[10px] uppercase tracking-widest text-white/30 mb-3">Timeline</div>
                  <Scrubber
                    label="Reports"
                    min={0}
                    max={Math.max(reports.length - 1, 1)}
                    step={1}
                    defaultValue={0}
                    onChange={(val: number) => {
                      if (reports[val]) setActiveReport(reports[val]);
                    }}
                  />
                </div>

                {/* Social Selector — Platform links */}
                <SocialSelector
                  platforms={[
                    { name: "GitHub", icon: "github" },
                    { name: "Twitter", icon: "twitter" },
                    { name: "Discord", icon: "discord" },
                  ]}
                  handle="aptos-labs"
                />

                {/* Gooey Popover for extra info */}
                <div className="flex gap-4 items-center">
                  <GooeyPopover>
                    <SmoothButton variant="ghost" size="sm">About Aptos Intelligence</SmoothButton>
                  </GooeyPopover>
                </div>

              </div>
            )}
          </div>
        </div>
      </div>
    </CursorFollow>
  );
}
