"use client";

import { useState, useMemo } from "react";
import {
  TEMPLATES,
  getTemplateCategories,
  getTemplatesByCategory,
  searchTemplates,
  type Template,
  type TemplateCategory,
} from "@/lib/gif-maker/templates";
import { useVideoEditorStore } from "@/stores/video-editor-store";
import {
  Sparkles,
  Search,
  Clock,
  Zap,
  TrendingUp,
  GraduationCap,
  Briefcase,
  PartyPopper,
  Check,
} from "lucide-react";

export function TemplateLibrary() {
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [appliedTemplateId, setAppliedTemplateId] = useState<string | null>(null);

  const setPlatform = useVideoEditorStore((s) => s.setPlatform);
  const updateSettings = useVideoEditorStore((s) => s.updateSettings);
  const addOverlay = useVideoEditorStore((s) => s.addOverlay);
  const clips = useVideoEditorStore((s) => s.clips);

  // Get categories with counts
  const categories = getTemplateCategories();

  // Filter templates
  const filteredTemplates = useMemo(() => {
    let templates = TEMPLATES;

    // Filter by category
    if (selectedCategory !== "all") {
      templates = getTemplatesByCategory(selectedCategory);
    }

    // Filter by search
    if (searchQuery.trim()) {
      templates = searchTemplates(searchQuery);
    }

    return templates;
  }, [selectedCategory, searchQuery]);

  // Apply template
  const applyTemplate = (template: Template) => {
    // Set platform and dimensions
    setPlatform(template.platform);
    updateSettings({
      width: template.settings.width,
      height: template.settings.height,
      fps: template.settings.fps,
    });

    // Apply overlays if user has clips
    if (clips.length > 0) {
      template.overlays.forEach((overlay) => {
        addOverlay({
          id: `overlay-${Date.now()}-${Math.random()}`,
          type: overlay.type as any,
          x: overlay.position.x,
          y: overlay.position.y,
          width: overlay.size.width,
          height: overlay.size.height,
          startFrame: 0,
          durationInFrames: template.settings.duration * template.settings.fps,
          trackId: "main",
          ...overlay.properties,
        } as any);
      });
    }

    // TODO: Apply effects to selected clip if available

    setAppliedTemplateId(template.id);
    setTimeout(() => setAppliedTemplateId(null), 2000);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800/50">
        <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-brand-light-pink" />
          Template Library
        </h3>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search templates..."
            className="w-full h-9 pl-10 pr-3 bg-zinc-800/50 border border-zinc-700/50 rounded-lg text-sm text-zinc-100 placeholder-zinc-500 focus:border-brand-light-pink focus:ring-1 focus:ring-brand-light-pink/30 outline-none transition-all"
          />
        </div>
      </div>

      {/* Categories */}
      <div className="p-4 border-b border-zinc-800/50">
        <div className="flex flex-wrap gap-2">
          <CategoryButton
            icon={<Sparkles className="w-3.5 h-3.5" />}
            label="All"
            count={TEMPLATES.length}
            active={selectedCategory === "all"}
            onClick={() => setSelectedCategory("all")}
          />
          {categories.map((cat) => (
            <CategoryButton
              key={cat.id}
              icon={getCategoryIcon(cat.id)}
              label={cat.name}
              count={cat.count}
              active={selectedCategory === cat.id}
              onClick={() => setSelectedCategory(cat.id)}
            />
          ))}
        </div>
      </div>

      {/* Templates Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredTemplates.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="p-4 rounded-full bg-zinc-800/30 mb-4">
              <Search className="w-8 h-8 text-zinc-600" />
            </div>
            <p className="text-sm text-zinc-500 mb-2">No templates found</p>
            <p className="text-xs text-zinc-600">
              Try a different search or category
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {filteredTemplates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onApply={applyTemplate}
                isApplied={appliedTemplateId === template.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════

interface CategoryButtonProps {
  icon: React.ReactNode;
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}

function CategoryButton({
  icon,
  label,
  count,
  active,
  onClick,
}: CategoryButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ${
        active
          ? "bg-brand-light-pink/15 text-brand-light-pink border border-brand-light-pink/30"
          : "bg-zinc-800/30 text-zinc-400 border border-zinc-700/50 hover:border-zinc-600 hover:text-zinc-300"
      }`}
    >
      {icon}
      <span>{label}</span>
      <span
        className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
          active ? "bg-brand-light-pink/20" : "bg-zinc-700/50"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

interface TemplateCardProps {
  template: Template;
  onApply: (template: Template) => void;
  isApplied: boolean;
}

function TemplateCard({ template, onApply, isApplied }: TemplateCardProps) {
  return (
    <div className="group relative p-4 rounded-xl bg-zinc-800/30 border border-zinc-700/50 hover:border-brand-light-pink/30 transition-all duration-200">
      {/* Category Badge */}
      <div className="absolute top-3 right-3">
        <span className="px-2 py-1 text-[10px] font-medium bg-zinc-700/50 text-zinc-400 rounded-full">
          {template.category}
        </span>
      </div>

      {/* Content */}
      <div className="mb-3">
        <h4 className="text-sm font-semibold text-zinc-100 mb-1">
          {template.name}
        </h4>
        <p className="text-xs text-zinc-500 leading-relaxed">
          {template.description}
        </p>
      </div>

      {/* Details */}
      <div className="flex items-center gap-3 mb-3 text-[10px] text-zinc-600">
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          <span>{template.settings.duration}s</span>
        </div>
        <div className="flex items-center gap-1">
          <Zap className="w-3 h-3" />
          <span>{template.settings.fps} fps</span>
        </div>
        <div className="flex items-center gap-1">
          <span>
            {template.settings.width}×{template.settings.height}
          </span>
        </div>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {template.tags.slice(0, 3).map((tag) => (
          <span
            key={tag}
            className="px-2 py-0.5 text-[10px] bg-zinc-700/30 text-zinc-500 rounded"
          >
            {tag}
          </span>
        ))}
      </div>

      {/* Apply Button */}
      <button
        onClick={() => onApply(template)}
        disabled={isApplied}
        className={`w-full py-2 px-3 rounded-lg text-xs font-semibold transition-all duration-150 ${
          isApplied
            ? "bg-brand-blue/20 text-brand-blue border border-brand-blue/30"
            : "bg-brand-light-pink/10 text-brand-light-pink border border-brand-light-pink/30 hover:bg-brand-light-pink/20 active:scale-95"
        }`}
      >
        {isApplied ? (
          <span className="flex items-center justify-center gap-2">
            <Check className="w-4 h-4" />
            Applied!
          </span>
        ) : (
          "Use Template"
        )}
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════

function getCategoryIcon(category: TemplateCategory): React.ReactNode {
  const icons: Record<TemplateCategory, React.ReactNode> = {
    "social-media": <TrendingUp className="w-3.5 h-3.5" />,
    marketing: <Zap className="w-3.5 h-3.5" />,
    tutorials: <GraduationCap className="w-3.5 h-3.5" />,
    professional: <Briefcase className="w-3.5 h-3.5" />,
    entertainment: <PartyPopper className="w-3.5 h-3.5" />,
  };
  return icons[category];
}
