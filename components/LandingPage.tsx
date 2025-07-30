"use client";
import React, { useState, useEffect } from "react";
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

export default function LandingPage() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isVisible, setIsVisible] = useState(false);

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

  return (
    <div className="min-h-screen bg-white dark:bg-black text-gray-900 dark:text-white overflow-hidden relative">
      {/* Animated background gradient */}
      <div
        className="absolute inset-0 dark:opacity-40 opacity-25"
        style={{
          background: `radial-gradient(300px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(29, 78, 216, 0.2), rgba(147, 51, 234, 0.1) 50%, transparent 70%)`,
        }}
      />

      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-5 dark:opacity-20"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(100,100,100,0.3) 1px, transparent 0)`,
          backgroundSize: "50px 50px",
        }}
      />

      {/* Navigation */}
      <nav className="relative z-50 flex items-center justify-between p-6 md:p-8">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <span className="text-xl font-bold text-gray-900 dark:text-white">
            Creative Ink
          </span>
        </div>

        <div className="hidden md:flex items-center space-x-8">
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

        <div className="flex items-center space-x-4">
          <ThemeToggle />
          <AuthButtons />
        </div>
      </nav>

      {/* Hero Section */}
      <div
        className={`relative z-10 max-w-6xl mx-auto px-6 md:px-8 pt-20 pb-32 transition-all duration-1000 ${
          isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
        }`}
      >
        <div className="text-center">
          {/* Main heading */}
          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight text-gray-900 dark:text-white">
            <span className="block">Scale Your Influence.</span>
            <span className="block">Automate Your Content.</span>
          </h1>

          {/* Subtitle */}
          <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 mb-12 max-w-4xl mx-auto leading-relaxed">
            Build your hyper-realistic AI twin and grow your influence
            effortlessly. Be everywhere at once, without lifting a finger.
          </p>

          {/* CTA Button */}
          <div className="flex items-center justify-center mb-16">
            <Link
              href="/register"
              className="group bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-4 rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-300 font-semibold text-lg flex items-center space-x-2 shadow-2xl"
            >
              <span>Start Creating For Free</span>
              <Play className="w-5 h-5" />
            </Link>
          </div>

          {/* Hero Image/Video Placeholder */}
          <div className="relative max-w-4xl mx-auto mb-16">
            <div className="relative rounded-2xl overflow-hidden shadow-2xl bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-gray-200 dark:border-gray-700">
              <div className="aspect-video flex items-center justify-center">
                <div className="text-center space-y-4">
                  <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto hover:scale-110 transition-transform duration-300 cursor-pointer">
                    <Play className="w-8 h-8 text-white" />
                  </div>
                  <p className="text-gray-600 dark:text-gray-400 font-medium">Watch Demo Video</p>
                  <p className="text-sm text-gray-500 dark:text-gray-500">See how AI creates content in seconds</p>
                </div>
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none"></div>
            </div>
          </div>

          {/* Feature badges */}
          <div className="flex flex-wrap items-center justify-center gap-6 mb-16">
            {[
              { icon: Bot, text: "Fully Automated", color: "text-blue-500", delay: "delay-100" },
              { icon: TrendingUp, text: "Self Improving", color: "text-green-500", delay: "delay-200" },
              { icon: Video, text: "Feed Posts & Reels", color: "text-purple-500", delay: "delay-300" }
            ].map((badge, index) => (
              <div key={index} className={`flex items-center space-x-2 bg-gray-100/50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-800 rounded-full px-4 py-2 backdrop-blur-sm hover:scale-105 transition-all duration-300 ${badge.delay} animate-fade-in-up`}>
                <badge.icon className={`w-4 h-4 ${badge.color} animate-pulse`} />
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  {badge.text}
                </span>
              </div>
            ))}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-3xl mx-auto">
            {[
              { icon: Users, count: "7,645", label: "Users", color: "text-blue-400", delay: "delay-100" },
              { icon: Image, count: "90,564", label: "Feed Posts", color: "text-green-400", delay: "delay-200" },
              { icon: Video, count: "70,794", label: "Reels", color: "text-purple-400", delay: "delay-300" },
              { icon: Star, count: "4.9/5", label: "Avg. rating", color: "text-yellow-400", delay: "delay-400" }
            ].map((stat, index) => (
              <div key={index} className={`group hover:scale-110 transition-all duration-300 ${stat.delay} animate-fade-in-up`}>
                <div className="flex items-center justify-center mb-2">
                  <stat.icon className={`w-6 h-6 ${stat.color} mr-2 group-hover:animate-bounce`} />
                  <span className="text-2xl font-bold text-gray-900 dark:text-white">
                    {stat.count}
                  </span>
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Testimonial Section */}
      <div className="relative z-10 max-w-6xl mx-auto px-6 md:px-8 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-6 text-gray-900 dark:text-white">
            Ambassadors who already automate their content
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {[
            { name: "Bailey", role: "Pop Trendsetter", growth: "240%", avatar: "https://images.unsplash.com/photo-1494790108755-2616b612b77c?w=150&h=150&fit=crop&crop=face" },
            { name: "Emily", role: "Lifestyle Vlogger", growth: "180%", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face" },
            { name: "Fiona", role: "E-girl", growth: "320%", avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop&crop=face" },
          ].map((ambassador, index) => (
            <div key={index} className={`text-center group hover:scale-105 transition-all duration-300 delay-${(index + 1) * 100} animate-fade-in-up`}>
              <div className="relative w-20 h-20 mx-auto mb-4 group-hover:shadow-lg group-hover:shadow-blue-500/25 transition-all duration-300">
                <img
                  src={ambassador.avatar}
                  alt={ambassador.name}
                  className="w-full h-full rounded-full object-cover border-3 border-gradient-to-r from-blue-400 to-purple-600 group-hover:scale-110 transition-transform duration-300"
                />
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-400 to-purple-600 p-0.5">
                  <img
                    src={ambassador.avatar}
                    alt={ambassador.name}
                    className="w-full h-full rounded-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {ambassador.name}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                {ambassador.role}
              </p>
            </div>
          ))}
        </div>

        <div className="bg-gray-100/50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-800 rounded-2xl p-8 backdrop-blur-sm">
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
        id="features"
        className="relative z-10 max-w-6xl mx-auto px-6 md:px-8 py-20"
      >
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-6 text-gray-900 dark:text-white">
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
              className={`group bg-gray-100/30 dark:bg-gray-900/30 border border-gray-300 dark:border-gray-800 rounded-2xl p-8 hover:border-gray-400 dark:hover:border-gray-700 hover:scale-105 hover:shadow-xl transition-all duration-300 delay-${(index + 1) * 100} animate-fade-in-up`}
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
      <div className="relative z-10 max-w-6xl mx-auto px-6 md:px-8 py-20">
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
              className="bg-gray-100/30 dark:bg-gray-900/30 border border-gray-300 dark:border-gray-800 rounded-2xl p-6 hover:border-gray-400 dark:hover:border-gray-700 transition-all duration-300 relative"
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
        id="pricing"
        className="relative z-10 max-w-7xl mx-auto px-6 md:px-8 py-20"
      >
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-6 text-gray-900 dark:text-white">
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
              className="bg-gray-100/30 dark:bg-gray-900/30 border border-gray-300 dark:border-gray-800 rounded-2xl p-6 hover:border-gray-400 dark:hover:border-gray-700 transition-all duration-300 relative overflow-visible"
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
              <ul className="space-y-3 mb-6">
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
              <button className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium">
                {plan.cta || "Sign Up"}
              </button>
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
