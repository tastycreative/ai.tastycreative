"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  BookOpen,
  Copy,
  Check,
  Zap,
  MessageSquare,
  Clock,
  Sparkles,
  TrendingUp,
  Video,
  AlertCircle,
} from "lucide-react";

const HOOKS = [
  {
    category: "Question Hooks",
    items: [
      "Did you know that...?",
      "What if I told you...?",
      "Ever wonder why...?",
      "Want to know the secret to...?",
      "Have you ever noticed...?",
    ],
  },
  {
    category: "Controversial/Bold",
    items: [
      "Stop doing [X] right now!",
      "Nobody tells you about...",
      "The truth about [X] that nobody wants to hear",
      "I'm about to expose...",
      "Hot take: [controversial opinion]",
    ],
  },
  {
    category: "Curiosity/Mystery",
    items: [
      "Wait for it...",
      "You won't believe what happened...",
      "I tried [X] for 30 days and...",
      "POV: You just discovered...",
      "This changed everything...",
    ],
  },
  {
    category: "Relatability",
    items: [
      "Me when [relatable situation]",
      "Things nobody talks about...",
      "If you [X], this is for you",
      "Tell me you're [X] without telling me",
      "Only [type of person] will understand",
    ],
  },
  {
    category: "Value/Tutorial",
    items: [
      "3 things you need to know about...",
      "How to [achieve result] in [time]",
      "The easiest way to...",
      "Save this for later!",
      "Quick tip for...",
    ],
  },
];

const CONTENT_STRUCTURES = [
  {
    name: "Problem → Agitate → Solution",
    description: "Address a pain point, make it relatable, then offer the solution",
    formula: "1. Show the problem (3s)\n2. Make it worse/relatable (5s)\n3. Present your solution (15s)\n4. Strong CTA (2s)",
  },
  {
    name: "Before → After → How",
    description: "Show transformation and explain the process",
    formula: "1. Show 'before' state (3s)\n2. Reveal 'after' result (5s)\n3. Break down how you did it (15s)\n4. Encourage action (2s)",
  },
  {
    name: "List Format",
    description: "Numbered list of tips, mistakes, or secrets",
    formula: "1. Hook with number promise (3s)\n2. Item #1 (5-7s)\n3. Item #2 (5-7s)\n4. Item #3 (5-7s)\n5. Save/follow CTA (2s)",
  },
  {
    name: "Storytelling",
    description: "Personal story or case study",
    formula: "1. Set the scene (3s)\n2. Build tension/problem (8s)\n3. Climax/turning point (8s)\n4. Resolution + lesson (6s)\n5. CTA (2s)",
  },
  {
    name: "Tutorial/How-To",
    description: "Step-by-step educational content",
    formula: "1. Promise the outcome (3s)\n2. Step 1 (6s)\n3. Step 2 (6s)\n4. Step 3 (6s)\n5. Final result + CTA (4s)",
  },
  {
    name: "Myth Busting",
    description: "Debunk common misconceptions",
    formula: "1. State the myth (3s)\n2. Show why it's wrong (10s)\n3. Explain the truth (10s)\n4. CTA (2s)",
  },
];

const CTA_TEMPLATES = [
  {
    category: "Engagement",
    items: [
      "Comment '[word]' if you want more like this",
      "Save this for later!",
      "Share this with someone who needs to see it",
      "Double tap if you agree",
      "Which one are you? Let me know below 👇",
    ],
  },
  {
    category: "Growth",
    items: [
      "Follow for more [niche] tips",
      "Follow me for daily [content type]",
      "Want more? Hit that follow button",
      "Turn on notifications for daily content",
      "Join [X] others already following",
    ],
  },
  {
    category: "Action-Oriented",
    items: [
      "Try this and let me know how it goes",
      "Link in bio to learn more",
      "DM me '[word]' for the full guide",
      "Click the link in my bio",
      "Tag someone who needs this",
    ],
  },
  {
    category: "Question CTAs",
    items: [
      "What would you add to this list?",
      "Have you tried this before?",
      "What's your experience with this?",
      "Agree or disagree?",
      "What do you think?",
    ],
  },
];

const POSTING_TIMES = [
  {
    day: "Monday - Friday",
    times: ["6:00 AM - 9:00 AM", "12:00 PM - 1:00 PM", "7:00 PM - 9:00 PM"],
    note: "Commute times and lunch breaks see high engagement",
  },
  {
    day: "Saturday - Sunday",
    times: ["9:00 AM - 11:00 AM", "7:00 PM - 9:00 PM"],
    note: "Weekend mornings and evenings perform best",
  },
  {
    day: "Best Overall Times",
    times: ["9:00 AM", "12:00 PM", "3:00 PM", "7:00 PM"],
    note: "Peak engagement windows across all days",
  },
];

const REEL_TEMPLATES = [
  {
    name: "GRWM (Get Ready With Me)",
    structure: "Fast-motion getting ready + talking over it",
    duration: "30-45 seconds",
    tips: "Share a story or tips while getting ready, use trending audio",
  },
  {
    name: "Outfit Check",
    structure: "Multiple outfit transitions or single outfit showcase",
    duration: "15-30 seconds",
    tips: "Use outfit transition trends, tag brands, show personality",
  },
  {
    name: "Day in the Life",
    structure: "Quick clips from your day with voiceover",
    duration: "45-60 seconds",
    tips: "Show variety, keep it fast-paced, be authentic",
  },
  {
    name: "Tutorial",
    structure: "Step-by-step process with text overlays",
    duration: "30-60 seconds",
    tips: "Clear steps, close-ups when needed, promise result upfront",
  },
  {
    name: "Trending Audio",
    structure: "Use trending audio creatively for your niche",
    duration: "15-30 seconds",
    tips: "Put your unique spin on it, add value beyond the trend",
  },
  {
    name: "Before & After",
    structure: "Show transformation with transition",
    duration: "20-30 seconds",
    tips: "Build anticipation, dramatic reveal, explain process briefly",
  },
  {
    name: "Reaction/Commentary",
    structure: "React to another video or trend with your take",
    duration: "30-45 seconds",
    tips: "Add your unique perspective, be genuine, engage with community",
  },
  {
    name: "Behind the Scenes",
    structure: "Show the process behind your content/work",
    duration: "30-45 seconds",
    tips: "Be authentic, show challenges, make viewers feel special",
  },
  {
    name: "Quick Tip",
    structure: "Single valuable tip delivered quickly",
    duration: "15-25 seconds",
    tips: "Get to the point fast, demonstrate clearly, encourage saves",
  },
];

export default function ReelsFormulaView() {
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"hooks" | "structures" | "ctas" | "times" | "templates">("hooks");

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const tabs = [
    { id: "hooks" as const, label: "Hooks", icon: Zap },
    { id: "structures" as const, label: "Structures", icon: BookOpen },
    { id: "ctas" as const, label: "CTAs", icon: MessageSquare },
    { id: "times" as const, label: "Best Times", icon: Clock },
    { id: "templates" as const, label: "Templates", icon: Video },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-[var(--color-brand-mid-pink)]/20 to-[var(--color-brand-light-pink)]/20 border border-[var(--color-brand-mid-pink)]/30">
              <Sparkles className="w-7 h-7 text-[var(--color-brand-mid-pink)]" />
            </div>
            Reels Formula Cheat Sheet
          </h2>
          <p className="text-muted-foreground mt-2">
            Proven formulas, hooks, and templates to create viral reels
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-card border-2 border-border rounded-2xl p-3 shadow-xl">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <motion.button
                key={tab.id}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-3 rounded-xl transition-all font-semibold ${
                  activeTab === tab.id
                    ? "bg-gradient-to-r from-[var(--color-brand-mid-pink)] to-[var(--color-brand-light-pink)] text-white shadow-lg"
                    : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{tab.label}</span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Hooks */}
        {activeTab === "hooks" && (
          <div className="space-y-6">
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-r from-[var(--color-brand-mid-pink)]/20 via-[var(--color-brand-light-pink)]/10 to-[var(--color-brand-mid-pink)]/20 border-2 border-[var(--color-brand-mid-pink)]/30 rounded-2xl p-6 shadow-xl"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-[var(--color-brand-mid-pink)]/20">
                  <AlertCircle className="w-6 h-6 text-[var(--color-brand-mid-pink)] flex-shrink-0" />
                </div>
                <div className="text-sm text-muted-foreground">
                  <strong className="text-foreground text-base">Pro Tip:</strong> The first 3 seconds determine if viewers keep watching.
                  Use these hooks to grab attention immediately!
                </div>
              </div>
            </motion.div>

            {HOOKS.map((section, idx) => (
              <motion.div 
                key={idx} 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="bg-card border-2 border-border rounded-2xl p-6 shadow-xl hover:border-[var(--color-brand-mid-pink)]/30 transition-all"
              >
                <h3 className="text-xl font-bold text-foreground mb-5 flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-[var(--color-brand-mid-pink)]/20 to-[var(--color-brand-light-pink)]/20">
                    <TrendingUp className="w-5 h-5 text-[var(--color-brand-mid-pink)]" />
                  </div>
                  {section.category}
                </h3>
                <div className="space-y-3">
                  {section.items.map((hook, i) => (
                    <motion.div
                      key={i}
                      whileHover={{ x: 4 }}
                      className="flex items-start justify-between gap-3 p-4 bg-muted rounded-xl hover:bg-[var(--color-brand-mid-pink)]/10 transition-all group border border-transparent hover:border-[var(--color-brand-mid-pink)]/20"
                    >
                      <span className="text-foreground flex-1 font-medium">{hook}</span>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => copyToClipboard(hook)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-[var(--color-brand-mid-pink)]/20 rounded-lg"
                        title="Copy to clipboard"
                      >
                        {copiedText === hook ? (
                          <Check className="w-5 h-5 text-green-400" />
                        ) : (
                          <Copy className="w-5 h-5 text-[var(--color-brand-mid-pink)]" />
                        )}
                      </motion.button>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Content Structures */}
        {activeTab === "structures" && (
          <div className="space-y-5">
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-r from-[var(--color-brand-mid-pink)]/20 via-[var(--color-brand-light-pink)]/10 to-[var(--color-brand-mid-pink)]/20 border-2 border-[var(--color-brand-mid-pink)]/30 rounded-2xl p-6 shadow-xl"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-[var(--color-brand-mid-pink)]/20">
                  <AlertCircle className="w-6 h-6 text-[var(--color-brand-mid-pink)] flex-shrink-0" />
                </div>
                <div className="text-sm text-muted-foreground">
                  These proven structures help organize your content for maximum impact. Adapt timing based on your content.
                </div>
              </div>
            </motion.div>

            {CONTENT_STRUCTURES.map((structure, idx) => (
              <motion.div 
                key={idx} 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="bg-card border-2 border-border rounded-2xl p-6 shadow-xl hover:border-[var(--color-brand-mid-pink)]/30 transition-all"
              >
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-foreground mb-2 flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-[var(--color-brand-mid-pink)]" />
                      {structure.name}
                    </h3>
                    <p className="text-sm text-muted-foreground">{structure.description}</p>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => copyToClipboard(structure.formula)}
                    className="p-3 hover:bg-[var(--color-brand-mid-pink)]/20 rounded-xl transition-colors border border-[var(--color-brand-mid-pink)]/20"
                    title="Copy formula"
                  >
                    {copiedText === structure.formula ? (
                      <Check className="w-5 h-5 text-green-400" />
                    ) : (
                      <Copy className="w-5 h-5 text-[var(--color-brand-mid-pink)]" />
                    )}
                  </motion.button>
                </div>
                <div className="bg-muted rounded-xl p-5 border border-[var(--color-brand-mid-pink)]/10">
                  <pre className="text-sm text-foreground whitespace-pre-wrap font-mono leading-relaxed">
                    {structure.formula}
                  </pre>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* CTAs */}
        {activeTab === "ctas" && (
          <div className="space-y-6">
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-r from-[var(--color-brand-mid-pink)]/20 via-[var(--color-brand-light-pink)]/10 to-[var(--color-brand-mid-pink)]/20 border-2 border-[var(--color-brand-mid-pink)]/30 rounded-2xl p-6 shadow-xl"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-[var(--color-brand-mid-pink)]/20">
                  <AlertCircle className="w-6 h-6 text-[var(--color-brand-mid-pink)] flex-shrink-0" />
                </div>
                <div className="text-sm text-muted-foreground">
                  <strong className="text-foreground text-base">Always include a CTA!</strong> Tell viewers exactly what you want them to do next.
                </div>
              </div>
            </motion.div>

            {CTA_TEMPLATES.map((section, idx) => (
              <motion.div 
                key={idx} 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="bg-card border-2 border-border rounded-2xl p-6 shadow-xl hover:border-[var(--color-brand-mid-pink)]/30 transition-all"
              >
                <h3 className="text-xl font-bold text-foreground mb-5 flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-[var(--color-brand-mid-pink)]/20 to-[var(--color-brand-light-pink)]/20">
                    <MessageSquare className="w-5 h-5 text-[var(--color-brand-mid-pink)]" />
                  </div>
                  {section.category}
                </h3>
                <div className="space-y-3">
                  {section.items.map((cta, i) => (
                    <motion.div
                      key={i}
                      whileHover={{ x: 4 }}
                      className="flex items-start justify-between gap-3 p-4 bg-muted rounded-xl hover:bg-[var(--color-brand-mid-pink)]/10 transition-all group border border-transparent hover:border-[var(--color-brand-mid-pink)]/20"
                    >
                      <span className="text-foreground flex-1 font-medium">{cta}</span>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => copyToClipboard(cta)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-[var(--color-brand-mid-pink)]/20 rounded-lg"
                        title="Copy to clipboard"
                      >
                        {copiedText === cta ? (
                          <Check className="w-5 h-5 text-green-400" />
                        ) : (
                          <Copy className="w-5 h-5 text-[var(--color-brand-mid-pink)]" />
                        )}
                      </motion.button>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Best Posting Times */}
        {activeTab === "times" && (
          <div className="space-y-5">
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-r from-[var(--color-brand-mid-pink)]/20 via-[var(--color-brand-light-pink)]/10 to-[var(--color-brand-mid-pink)]/20 border-2 border-[var(--color-brand-mid-pink)]/30 rounded-2xl p-6 shadow-xl"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-[var(--color-brand-mid-pink)]/20">
                  <AlertCircle className="w-6 h-6 text-[var(--color-brand-mid-pink)] flex-shrink-0" />
                </div>
                <div className="text-sm text-muted-foreground">
                  <strong className="text-foreground text-base">Note:</strong> These are general guidelines. Test different times to find what works best for YOUR audience!
                </div>
              </div>
            </motion.div>

            {POSTING_TIMES.map((timeSlot, idx) => (
              <motion.div 
                key={idx} 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="bg-card border-2 border-border rounded-2xl p-6 shadow-xl hover:border-[var(--color-brand-mid-pink)]/30 transition-all"
              >
                <h3 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-[var(--color-brand-mid-pink)]/20 to-[var(--color-brand-light-pink)]/20">
                    <Clock className="w-5 h-5 text-[var(--color-brand-mid-pink)]" />
                  </div>
                  {timeSlot.day}
                </h3>
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-3">
                    {timeSlot.times.map((time, i) => (
                      <motion.span
                        key={i}
                        whileHover={{ scale: 1.05 }}
                        className="px-5 py-3 bg-gradient-to-r from-[var(--color-brand-mid-pink)]/30 to-[var(--color-brand-light-pink)]/30 text-[var(--color-brand-mid-pink)] rounded-xl font-semibold shadow-lg border border-[var(--color-brand-mid-pink)]/20"
                      >
                        {time}
                      </motion.span>
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground italic flex items-center gap-2">
                    <span className="text-[var(--color-brand-mid-pink)]">ℹ️</span>
                    {timeSlot.note}
                  </p>
                </div>
              </motion.div>
            ))}

            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-r from-[var(--color-brand-blue)]/20 via-[var(--color-brand-blue)]/10 to-[var(--color-brand-blue)]/20 border-2 border-[var(--color-brand-blue)]/30 rounded-2xl p-6 shadow-xl"
            >
              <h4 className="font-bold text-[var(--color-brand-blue)] mb-4 text-lg flex items-center gap-2">
                <span>💡</span> Pro Tips for Timing:
              </h4>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-[var(--color-brand-blue)] mt-0.5">•</span>
                  <span>Post consistently at the same times to train your audience</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[var(--color-brand-blue)] mt-0.5">•</span>
                  <span>Check your Instagram Insights to see when YOUR followers are most active</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[var(--color-brand-blue)] mt-0.5">•</span>
                  <span>Consider time zones if you have an international audience</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[var(--color-brand-blue)] mt-0.5">•</span>
                  <span>Test posting at different times for 2 weeks and track engagement</span>
                </li>
              </ul>
            </motion.div>
          </div>
        )}

        {/* Reel Templates */}
        {activeTab === "templates" && (
          <div className="space-y-5">
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-r from-[var(--color-brand-mid-pink)]/20 via-[var(--color-brand-light-pink)]/10 to-[var(--color-brand-mid-pink)]/20 border-2 border-[var(--color-brand-mid-pink)]/30 rounded-2xl p-6 shadow-xl"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-[var(--color-brand-mid-pink)]/20">
                  <AlertCircle className="w-6 h-6 text-[var(--color-brand-mid-pink)] flex-shrink-0" />
                </div>
                <div className="text-sm text-muted-foreground">
                  Use these templates as starting points. Add your unique personality and style to stand out!
                </div>
              </div>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {REEL_TEMPLATES.map((template, idx) => (
                <motion.div 
                  key={idx} 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.05 }}
                  whileHover={{ y: -4 }}
                  className="bg-card border-2 border-border rounded-2xl p-6 shadow-xl hover:border-[var(--color-brand-mid-pink)]/30 transition-all"
                >
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-foreground mb-2 flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-gradient-to-br from-[var(--color-brand-mid-pink)]/30 to-[var(--color-brand-light-pink)]/30">
                          <Video className="w-5 h-5 text-[var(--color-brand-mid-pink)]" />
                        </div>
                        {template.name}
                      </h3>
                      <span className="text-xs font-semibold text-[var(--color-brand-mid-pink)] bg-[var(--color-brand-mid-pink)]/20 px-3 py-1.5 rounded-lg border border-[var(--color-brand-mid-pink)]/20">
                        ⏱️ {template.duration}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="bg-muted rounded-xl p-4 border border-[var(--color-brand-mid-pink)]/10">
                      <div className="text-xs font-bold text-[var(--color-brand-mid-pink)] mb-2 uppercase tracking-wide">📋 Structure</div>
                      <div className="text-sm text-foreground leading-relaxed">{template.structure}</div>
                    </div>

                    <div className="bg-muted rounded-xl p-4 border border-[var(--color-brand-mid-pink)]/10">
                      <div className="text-xs font-bold text-[var(--color-brand-mid-pink)] mb-2 uppercase tracking-wide">💡 Tips</div>
                      <div className="text-sm text-foreground leading-relaxed">{template.tips}</div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
