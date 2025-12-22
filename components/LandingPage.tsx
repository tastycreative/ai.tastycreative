"use client";
import React, { useState, useEffect, useRef } from "react";
import {
  ChevronRight,
  Play,
  Sparkles,
  Zap,
  Shield,
  Globe,
  Bot,
  TrendingUp,
  Video,
  Users,
  Image,
  Star,
} from "lucide-react";
import { AuthButtons } from "@/components/auth/auth-buttons";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import Link from "next/link";
import { SignInButton } from "@clerk/nextjs";

export default function LandingPage() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isVisible, setIsVisible] = useState(false);
  const [visibleSections, setVisibleSections] = useState<Record<string, boolean>>({});
  
  const testimonialRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);
  const benefitsRef = useRef<HTMLDivElement>(null);
  const pricingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsVisible(true);
    const handleMouseMove = (e: MouseEvent) => {
      const rect = document.documentElement.getBoundingClientRect(); 
      setMousePosition({ 
        x: e.clientX - rect.left, 
        y: e.clientY - rect.top 
      });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  useEffect(() => {
    const observerOptions = {
      threshold: 0.1,
      rootMargin: "-50px"
    };

    const observerCallback = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        setVisibleSections(prev => ({
          ...prev,
          [entry.target.id]: entry.isIntersecting
        }));
      });
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);

    const refs = [testimonialRef, featuresRef, benefitsRef, pricingRef];
    refs.forEach(ref => {
      if (ref.current) observer.observe(ref.current);
    });

    return () => {
      refs.forEach(ref => {
        if (ref.current) observer.unobserve(ref.current);
      });
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-blue-50/50 to-white dark:from-black dark:via-blue-950/40 dark:to-black text-gray-900 dark:text-white overflow-hidden relative">
      {/* Animated background gradient */}
      <div
        className="absolute inset-0 dark:opacity-60 opacity-35"
        style={{
          background: `radial-gradient(360px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(59,130,246,0.15), rgba(168,85,247,0.12) 45%, transparent 70%)`,
        }}
      />

      {/* Soft conic glow */}
      <div className="absolute inset-0 bg-[conic-gradient(at_20%_30%,rgba(59,130,246,0.08),transparent_40%,rgba(168,85,247,0.1),transparent_70%)] blur-3xl" />

      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-10 dark:opacity-25 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(120,120,120,0.3) 1px, transparent 0)`,
          backgroundSize: "48px 48px",
        }}
      />

      {/* Floating beams */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-10 top-10 h-64 w-64 bg-gradient-to-br from-blue-500/15 via-purple-500/10 to-transparent blur-3xl animate-pulse" />
        <div className="absolute right-0 top-1/3 h-64 w-64 bg-gradient-to-br from-purple-500/20 via-pink-500/10 to-transparent blur-3xl animate-pulse delay-1000" />
        <div className="absolute left-1/3 bottom-10 h-48 w-48 bg-gradient-to-br from-blue-400/10 via-cyan-400/10 to-transparent blur-2xl animate-pulse delay-700" />
      </div>      {/* Navigation */}
      <nav className="z-50 flex items-center justify-between p-4 md:p-6 lg:p-8 backdrop-blur-sm bg-white/60 dark:bg-black/40 border-b border-white/40 dark:border-white/10 sticky top-0">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 md:w-9 md:h-9 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shadow-md">
            <Sparkles className="w-4 h-4 md:w-5 md:h-5 text-white" />
          </div>
          <span className="text-lg md:text-xl font-bold text-gray-900 dark:text-white">
            Creative Ink
          </span>
        </div>

        <div className="hidden md:flex items-center space-x-8 text-sm font-medium">
          <Link
            href="#features"
            className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            Features
          </Link>
          <Link
            href="#pricing"
            className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            Pricing
          </Link>
          <Link
            href="/about"
            className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            About
          </Link>
        </div>

        <div className="flex items-center space-x-2 md:space-x-4">
          <ThemeToggle />
          <AuthButtons />
        </div>
      </nav>

      {/* Hero Section */}
      <div
        className={`relative z-10 max-w-7xl mx-auto px-4 md:px-6 lg:px-8 pt-12 md:pt-20 pb-20 md:pb-32 transition-all duration-1000 ${
          isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
        }`}
      >
        <div className="grid gap-8 lg:gap-12 lg:grid-cols-[1.05fr_0.95fr] items-center">
          <div className="space-y-6 md:space-y-8">
            <div className="inline-flex items-center space-x-2 rounded-full bg-white/80 dark:bg-white/10 border border-white/40 dark:border-white/10 px-3 md:px-4 py-1.5 md:py-2 shadow-sm backdrop-blur animate-fade-in-up">
              <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
              <p className="text-[10px] md:text-xs font-semibold uppercase tracking-[0.2em] text-gray-600 dark:text-gray-300">New • Hyper-real AI Twins</p>
            </div>

            {/* Main heading */}
            <h1 className="text-4xl md:text-5xl lg:text-7xl font-bold leading-tight text-gray-900 dark:text-white space-y-1 md:space-y-2">
              <span className="block">Scale Your Influence.</span>
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-purple-600 to-blue-500">Automate Your Content.</span>
            </h1>

            {/* Subtitle */}
            <p className="text-base md:text-lg lg:text-xl text-gray-600 dark:text-gray-300 max-w-2xl leading-relaxed">
              Build a hyper-realistic AI twin that plans, scripts, and ships content in your voice. Stay on-brand, everywhere—while you sleep.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 md:gap-4">
              <SignInButton>
                <button className="group relative inline-flex items-center justify-center overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 via-purple-600 to-blue-500 px-6 md:px-8 py-3 md:py-4 text-white shadow-2xl transition-all duration-300 hover:scale-[1.02] hover:shadow-blue-500/30">
                  <span className="absolute inset-0 translate-x-[-60%] bg-white/30 blur-xl transition-all duration-700 group-hover:translate-x-[120%]" />
                  <span className="relative flex items-center space-x-2 font-semibold text-base md:text-lg">
                    <span>Start Creating Free</span>
                    <Play className="w-4 h-4 md:w-5 md:h-5" />
                  </span>
                </button>
              </SignInButton>
              <Link
                href="#features"
                className="inline-flex items-center justify-center space-x-2 rounded-xl border border-gray-200/80 dark:border-white/10 bg-white/70 dark:bg-white/5 px-5 md:px-6 py-3 text-gray-900 dark:text-white shadow-sm backdrop-blur transition-all duration-300 hover:scale-[1.01] hover:border-blue-400/60 hover:shadow-lg"
              >
                <span>See how it works</span>
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>

            {/* Hero checklist */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {["Autoplan & auto-post", "Voice-cloned scripts", "Platform-tuned formats"].map((item, index) => (
                <div
                  key={item}
                  className={`flex items-center space-x-2 rounded-lg border border-gray-200/60 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:shadow-lg animate-fade-in-up delay-${(index + 1) * 100}`}
                >
                  <span className="h-2 w-2 rounded-full bg-blue-500" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Hero media + floating cards */}
          <div className="relative mt-8 lg:mt-0">
            <div className="absolute -inset-6 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-cyan-400/10 blur-3xl animate-pulse" />
            <div className="relative rounded-3xl overflow-hidden border border-white/60 dark:border-white/10 bg-gradient-to-br from-white/70 via-blue-50/50 to-purple-50/50 dark:from-white/5 dark:via-blue-900/10 dark:to-purple-900/10 shadow-2xl backdrop-blur">
              <div className="aspect-video flex items-center justify-center p-4">
                <div className="text-center space-y-3 md:space-y-4">
                  <div className="w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto hover:scale-110 transition-transform duration-300 cursor-pointer shadow-lg shadow-blue-500/30">
                    <Play className="w-6 h-6 md:w-8 md:h-8 text-white" />
                  </div>
                  <p className="text-sm md:text-base text-gray-600 dark:text-gray-300 font-medium px-2">Watch how Creative Ink plans, scripts, and posts</p>
                  <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">90s overview • No fluff</p>
                </div>
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent pointer-events-none" />
            </div>

            <div className="hidden xl:block absolute -left-10 -bottom-10 w-48 rounded-2xl border border-white/60 dark:border-white/10 bg-white/80 dark:bg-white/5 p-4 shadow-xl backdrop-blur animate-fade-in-up">
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-300">Time saved weekly</p>
                  <p className="text-xl font-semibold">18h</p>
                </div>
              </div>
              <div className="mt-3 h-1.5 w-full rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden">
                <div className="h-full w-5/6 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 animate-pulse" />
              </div>
            </div>

            <div className="hidden xl:block absolute -right-6 top-6 w-52 rounded-2xl border border-white/60 dark:border-white/10 bg-white/90 dark:bg-white/5 p-4 shadow-xl backdrop-blur animate-fade-in-up delay-200">
              <div className="flex items-center space-x-3 mb-3">
                <div className="h-9 w-9 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center text-white">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-300">Brand safety</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">Human-in-the-loop</p>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
                <span>Style locked</span>
                <span className="text-emerald-500 font-semibold">On</span>
              </div>
            </div>

            <div className="hidden xl:block absolute left-1/3 -bottom-14 w-52 rounded-2xl border border-white/60 dark:border-white/10 bg-white/90 dark:bg-white/5 p-4 shadow-xl backdrop-blur animate-fade-in-up delay-300">
              <div className="flex items-center space-x-2 mb-2">
                <Globe className="w-4 h-4 text-blue-500" />
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">Omnichannel</span>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-200">TikTok • IG • YT • Shorts • X</p>
              <div className="mt-3 grid grid-cols-4 gap-1">
                {["TT", "IG", "YT", "X"].map((item) => (
                  <div key={item} className="text-[10px] rounded-lg bg-gradient-to-br from-blue-500/15 to-purple-500/15 text-gray-800 dark:text-gray-200 px-2 py-1 text-center border border-white/40 dark:border-white/10">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Feature badges */}
        <div className="flex flex-wrap items-center justify-center gap-2 md:gap-4 mt-12 md:mt-16 mb-8 md:mb-10">
          {[
            { icon: Bot, text: "Fully Automated", color: "text-blue-500", delay: "delay-100" },
            { icon: TrendingUp, text: "Self Improving", color: "text-green-500", delay: "delay-200" },
            { icon: Video, text: "Feed Posts & Reels", color: "text-purple-500", delay: "delay-300" },
            { icon: Shield, text: "Brand Safe", color: "text-emerald-500", delay: "delay-400" },
          ].map((badge, index) => (
            <div
              key={index}
              className={`flex items-center space-x-1.5 md:space-x-2 bg-white/80 dark:bg-white/5 border border-gray-200/70 dark:border-white/10 rounded-full px-3 md:px-4 py-1.5 md:py-2 backdrop-blur hover:scale-105 transition-all duration-300 ${badge.delay} animate-fade-in-up`}
            >
              <badge.icon className={`w-3.5 h-3.5 md:w-4 md:h-4 ${badge.color} animate-pulse`} />
              <span className="text-xs md:text-sm text-gray-700 dark:text-gray-200">{badge.text}</span>
            </div>
          ))}
        </div>        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 max-w-4xl mx-auto">
          {[
            { icon: Users, count: "7,645", label: "Creators onboarded", color: "text-blue-400", delay: "delay-100" },
            { icon: Image, count: "90,564", label: "Feed Posts", color: "text-green-400", delay: "delay-200" },
            { icon: Video, count: "70,794", label: "Reels", color: "text-purple-400", delay: "delay-300" },
            { icon: Star, count: "4.9/5", label: "Avg. rating", color: "text-yellow-400", delay: "delay-400" },
          ].map((stat, index) => (
            <div
              key={index}
              className={`group rounded-xl md:rounded-2xl border border-white/50 dark:border-white/10 bg-white/80 dark:bg-white/5 p-3 md:p-4 shadow-sm backdrop-blur hover:-translate-y-2 hover:shadow-xl transition-all duration-300 ${stat.delay} animate-fade-in-up`}
            >
              <div className="flex flex-col md:flex-row items-start md:items-center mb-2">
                <stat.icon className={`w-5 h-5 md:w-6 md:h-6 ${stat.color} mr-0 md:mr-2 mb-1 md:mb-0 group-hover:animate-bounce`} />
                <span className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">{stat.count}</span>
              </div>
              <div className="text-xs md:text-sm text-gray-500 dark:text-gray-400">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>      {/* Testimonial Section */}
      <div 
        ref={testimonialRef}
        id="testimonials"
        className={`relative z-10 max-w-6xl mx-auto px-4 md:px-6 lg:px-8 py-12 md:py-20 transition-all duration-700 ${
          visibleSections['testimonials'] ? 'opacity-100 translate-y-0' : 'opacity-0'
        }`}
      >
        <div className="text-center mb-12 md:mb-16">
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-4 md:mb-6 text-gray-900 dark:text-white">
            Ambassadors who already automate their content
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {[
            { name: "Bailey", role: "Pop Trendsetter", growth: "240%", avatar: "https://images.unsplash.com/photo-1494790108755-2616b612b77c?w=150&h=150&fit=crop&crop=face" },
            { name: "Emily", role: "Lifestyle Vlogger", growth: "180%", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face" },
            { name: "Fiona", role: "E-girl", growth: "320%", avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop&crop=face" },
          ].map((ambassador, index) => (
            <div
              key={index}
              className={`text-center group hover:scale-105 transition-all duration-300 delay-${(index + 1) * 100} animate-fade-in-up rounded-2xl border border-gray-200/70 dark:border-white/10 bg-white/80 dark:bg-white/5 p-6 backdrop-blur shadow-sm`}
            >
              <div className="relative w-20 h-20 mx-auto mb-4 group-hover:shadow-lg group-hover:shadow-blue-500/25 transition-all duration-300">
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-400 to-purple-600 p-0.5">
                  <img
                    src={ambassador.avatar}
                    alt={ambassador.name}
                    className="w-full h-full rounded-full object-cover"
                  />
                </div>
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white">{ambassador.name}</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">{ambassador.role}</p>
              <p className="text-sm text-emerald-500 mt-2 font-semibold">+{ambassador.growth} growth</p>
            </div>
          ))}
        </div>

        <div className="bg-gray-100/60 dark:bg-gray-900/60 border border-gray-300 dark:border-gray-800 rounded-2xl p-8 backdrop-blur-sm shadow-lg">
          <div className="flex items-center mb-4">
            <div className="relative w-12 h-12 mr-4">
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-400 to-purple-600 p-0.5">
                <img
                  src="https://images.unsplash.com/photo-1494790108755-2616b612b77c?w=150&h=150&fit=crop&crop=face"
                  alt="Bailey"
                  className="w-full h-full rounded-full object-cover"
                />
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white">
                Bailey
              </h4>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                @bbaileymoore
              </p>
            </div>
          </div>
          <p className="text-gray-700 dark:text-gray-300">
            Grew 240% since automating her content with Creative Ink.
          </p>
        </div>
      </div>

      {/* Features Section */}
      <div
        ref={featuresRef}
        id="features"
        className={`relative z-10 max-w-6xl mx-auto px-4 md:px-6 lg:px-8 py-12 md:py-20 transition-all duration-700 ${
          visibleSections['features'] ? 'opacity-100 translate-y-0' : 'opacity-0'
        }`}
      >
        <div className="text-center mb-12 md:mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 md:mb-6 text-gray-900 dark:text-white">
            Quality AI Content That Goes Viral
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-4xl mx-auto leading-relaxed">
            Tired of filming and editing every day? Creative Ink builds a
            hyper-realistic AI twin of you that creates videos and images in
            your style—automatically. Just upload a few photos, and Creative Ink
            generates high-quality, on-brand content at scale.
          </p>
          <p className="text-lg text-gray-600 dark:text-gray-300 mt-6 font-medium">
            No cameras. No burnout. Just effortless growth.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
          {[
            {
              icon: <Users className="w-8 h-8" />,
              title: "Train your Influencer",
              description:
                "Upload a few high-quality photos of yourself and tell us about your style, personality, and brand identity. The more we know, the more precise and on-brand your AI-generated content will be.",
              cta: "Start Training",
            },
            {
              icon: <Bot className="w-8 h-8" />,
              title: "Get Content on Autopilot",
              description:
                "Let Creative Ink take the heavy lifting out of content creation. We auto-plan an engaging, data-driven calendar weeks in advance—yet you keep full creative control to tweak or reorder posts at any time.",
              cta: "Start Automating",
            },
            {
              icon: <Sparkles className="w-8 h-8" />,
              title: "Generate on Demand",
              description:
                "Need a fresh post outside the scheduled queue? Our streamlined prompt builder turns a few words into scroll-stopping videos and images on demand. Choose action, location, and outfit instantly.",
              cta: "Generate Now",
            },
          ].map((feature, index) => (
            <div
              key={index}
              className={`group bg-gray-100/40 dark:bg-gray-900/30 border border-gray-300 dark:border-gray-800 rounded-2xl p-8 hover:border-gray-400 dark:hover:border-gray-700 hover:scale-105 hover:shadow-xl transition-all duration-300 delay-${(index + 1) * 100} animate-fade-in-up`}
            >
              <div className="text-blue-400 mb-6 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">{feature.icon}</div>
              <h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
                {feature.title}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-6">
                {feature.description}
              </p>
              <button className="text-blue-600 dark:text-blue-400 font-medium hover:underline group-hover:translate-x-2 transition-all duration-300">
                {feature.cta}
              </button>
            </div>
          ))}
        </div>

        <div className="bg-gradient-to-r from-blue-600/10 to-purple-600/10 border border-blue-500/20 rounded-2xl p-8 text-center">
          <h3 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
            Hyper Real Technology
          </h3>
          
          {/* Content Examples Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&h=300&fit=crop",
              "https://images.unsplash.com/photo-1494790108755-2616b612b77c?w=300&h=300&fit=crop", 
              "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=300&h=300&fit=crop",
              "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=300&fit=crop"
            ].map((image, index) => (
              <div key={index} className={`relative rounded-lg overflow-hidden aspect-square group hover:scale-105 transition-all duration-300 delay-${index * 50}`}>
                <img
                  src={image}
                  alt={`AI Generated Content ${index + 1}`}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end">
                  <p className="text-white text-xs font-medium p-2">AI Generated</p>
                </div>
              </div>
            ))}
          </div>

          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-3xl mx-auto mb-6">
            Looks shot on a million-dollar set—because your audience can&apos;t tell
            it isn&apos;t. Creative Ink&apos;s state-of-the-art diffusion models deliver
            skin texture, fabric detail, and natural motion so lifelike that
            followers assume you booked a pro crew and studio lighting.
          </p>
          <button className="text-blue-600 dark:text-blue-400 font-medium hover:underline">
            See Quality
          </button>
        </div>
      </div>

      {/* Benefits Section */}
      <div 
        ref={benefitsRef}
        id="benefits"
        className={`relative z-10 max-w-6xl mx-auto px-4 md:px-6 lg:px-8 py-12 md:py-20 transition-all duration-700 ${
          visibleSections['benefits'] ? 'opacity-100 translate-y-0' : 'opacity-0'
        }`}
      >
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-6 text-gray-900 dark:text-white">
            Benefits of Using Creative Ink
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-12">
            Experience the future of content creation with our cutting-edge AI
            technology
          </p>

          {/* Dashboard Preview */}
          <div className="relative max-w-4xl mx-auto mb-16">
            <div className="absolute -inset-6 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-cyan-400/10 blur-3xl" />
            <div className="relative rounded-2xl overflow-hidden shadow-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
              <div className="bg-gray-100 dark:bg-gray-800 px-4 py-3 flex items-center space-x-2">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <div className="ml-4 text-sm text-gray-600 dark:text-gray-400">Creative Ink Dashboard</div>
              </div>
              <div className="aspect-video bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-900 flex items-center justify-center">
                <div className="text-center space-y-4">
                  <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <div key={i} className="aspect-square bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg animate-pulse" style={{ animationDelay: `${i * 0.1}s` }}></div>
                    ))}
                  </div>
                  <p className="text-gray-600 dark:text-gray-400 font-medium">Your AI-Generated Content Library</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[
            {
              title: "Unlimited Content Creation",
              description:
                "Generate endless high-quality videos and images, tailored to your brand, without ever recording again.",
            },
            {
              title: "Viral-Smart AI Engine",
              description:
                "Creative Ink predicts which ideas will hit big in your niche and auto-tunes every post so your content is always optimized to go viral.",
            },
            {
              title: "Built-in Calendar & Auto-Posting",
              description:
                "Creative Ink's in-dashboard calendar can auto-publish for you, generate scroll-worthy captions, or let you pick exact dates and times.",
              badge: "Coming Soon",
            },
            {
              title: "Smart Auto-Editing",
              description:
                "Select a preset and Creative Ink instantly cuts, captions, and brands your video—ready in seconds.",
              badge: "Coming Soon",
            },
            {
              title: "Multi-Platform Support",
              description:
                "Generate content optimized for any social media platform, ensuring maximum engagement across all channels.",
            },
            {
              title: "24/7 Support",
              description:
                "Get help whenever you need it with our round-the-clock customer support team.",
            },
          ].map((benefit, index) => (
            <div
              key={index}
              className="bg-gray-100/40 dark:bg-gray-900/30 border border-gray-300 dark:border-gray-800 rounded-2xl p-6 hover:border-gray-400 dark:hover:border-gray-700 transition-all duration-300 relative hover:-translate-y-1 hover:shadow-xl"
            >
              {benefit.badge && (
                <span className="absolute top-4 right-4 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 text-xs font-medium px-2 py-1 rounded-full">
                  {benefit.badge}
                </span>
              )}
              <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">
                {benefit.title}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                {benefit.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Pricing Section */}
      <div
        ref={pricingRef}
        id="pricing"
        className={`relative z-10 max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-12 md:py-20 transition-all duration-700 ${
          visibleSections['pricing'] ? 'opacity-100 translate-y-0' : 'opacity-0'
        }`}
      >
        <div className="text-center mb-12 md:mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 md:mb-6 text-gray-900 dark:text-white">
            Our Pricing Plans
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mt-8">
          {[
            {
              name: "STARTER PLAN",
              price: "$79",
              period: "/month",
              credits: "125 Credits included",
              features: [
                "1 custom character",
                "Basic AI content generation",
                "Standard support",
                "Basic analytics",
                "Social media optimization",
                "Content calendar access",
              ],
            },
            {
              name: "GROWTH PLAN",
              price: "$299",
              period: "/month",
              credits: "750 Credits included",
              badge: "Save 15% compared to Starter",
              features: [
                "3 custom characters",
                "Advanced AI content generation",
                "Priority support",
                "Advanced analytics",
                "Enhanced social media optimization",
                "Advanced content calendar",
              ],
            },
            {
              name: "PRO PLAN",
              price: "$699",
              period: "/month",
              credits: "1500 Credits included",
              badge: "Save 30% compared to Starter",
              features: [
                "10 custom characters",
                "Premium AI content generation",
                "24/7 priority support",
                "Advanced analytics & insights",
                "Full social media optimization",
                "Advanced content calendar",
                "Custom branding & templates",
              ],
            },
            {
              name: "ENTERPRISE PLAN",
              price: "Custom",
              period: "",
              credits:
                "Need a tailored solution for your organization? Let's build something amazing together.",
              features: [
                "Customized for your needs",
                "Scalable solutions",
                "Dedicated support team",
              ],
              cta: "Get in Touch",
            },
          ].map((plan, index) => (
            <div
              key={index}
              className="bg-gray-100/40 dark:bg-gray-900/30 border border-gray-300 dark:border-gray-800 rounded-2xl p-6 hover:border-blue-400 dark:hover:border-blue-500 transition-all duration-300 relative overflow-visible shadow-sm hover:shadow-xl hover:-translate-y-1 flex flex-col"
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 z-10">
                  <span className="bg-blue-600 text-white text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap">
                    {plan.badge}
                  </span>
                </div>
              )}
              <div className="text-center mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {plan.name}
                </h3>
                <div className="mb-2">
                  <span className="text-3xl font-bold text-gray-900 dark:text-white">
                    {plan.price}
                  </span>
                  <span className="text-gray-600 dark:text-gray-400">
                    {plan.period}
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {plan.credits}
                </p>
              </div>
              <ul className="space-y-3 mb-6 flex-grow">
                {plan.features.map((feature, featureIndex) => (
                  <li
                    key={featureIndex}
                    className="text-sm text-gray-600 dark:text-gray-400 flex items-start"
                  >
                    <span className="text-green-500 mr-2">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>
              <div className="mt-auto">
                <button className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium">
                  {plan.cta || "Sign Up"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 bg-gray-100/50 dark:bg-gray-900/50 border-t border-gray-300 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-6 md:px-8 py-20">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
            {/* Brand */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold text-gray-900 dark:text-white">Creative Ink</span>
              </div>
              <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                Automate and scale your social media presence with AI-powered tools.
              </p>
            </div>

            {/* Product */}
            <div className="space-y-4">
              <h4 className="font-semibold text-gray-900 dark:text-white">Product</h4>
              <ul className="space-y-2">
                {['Features', 'Pricing', 'Security'].map((item) => (
                  <li key={item}>
                    <Link href="#" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                      {item}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Company */}
            <div className="space-y-4">
              <h4 className="font-semibold text-gray-900 dark:text-white">Company</h4>
              <ul className="space-y-2">
                {['About', 'Blog', 'Careers'].map((item) => (
                  <li key={item}>
                    <Link href="#" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                      {item}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Support */}
            <div className="space-y-4">
              <h4 className="font-semibold text-gray-900 dark:text-white">Support</h4>
              <ul className="space-y-2">
                {['Help Center', 'Contact'].map((item) => (
                  <li key={item}>
                    <Link href="#" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                      {item}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Bottom */}
          <div className="flex flex-col md:flex-row items-center justify-between pt-8 border-t border-gray-300 dark:border-gray-700">
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              © 2024 Creative Ink. All rights reserved.
            </p>
            <div className="flex items-center space-x-6 mt-4 md:mt-0">
              <Link href="#" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm transition-colors">
                Terms
              </Link>
              <Link href="#" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm transition-colors">
                Privacy
              </Link>
            </div>
          </div>
        </div>
      </footer>

      {/* Floating elements */}
      <div className="absolute top-1/4 left-10 w-20 h-20 bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-xl animate-pulse" />
      <div className="absolute top-3/4 right-20 w-32 h-32 bg-purple-500/5 dark:bg-purple-500/10 rounded-full blur-2xl animate-pulse delay-1000" />
      <div className="absolute bottom-1/4 left-1/3 w-16 h-16 bg-pink-500/5 dark:bg-pink-500/10 rounded-full blur-lg animate-pulse delay-500" />
    </div>
  );
}
