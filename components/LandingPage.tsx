'use client'
import React, { useState, useEffect } from "react";
import { ChevronRight, Play, Sparkles, Zap, Shield, Globe } from "lucide-react";
import { AuthButtons } from '@/components/auth/auth-buttons';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import Link from 'next/link';

export default function LandingPage() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-black text-gray-900 dark:text-white overflow-hidden relative">
      {/* Animated background gradient */}
      <div
        className="absolute inset-0 dark:opacity-30 opacity-10"
        style={{
          background: `radial-gradient(200px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(29, 78, 216, 0.15), transparent 80%)`,
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
          <span className="text-xl font-bold text-gray-900 dark:text-white">Creative Ink</span>
        </div>

        <div className="hidden md:flex items-center space-x-8">
          <Link
            href="/demo"
            className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            Demo
          </Link>
          <Link
            href="/about"
            className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            About
          </Link>
          <Link
            href="/pricing"
            className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            Pricing
          </Link>
          <Link
            href="/dashboard"
            className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            Dashboard
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
          {/* Badge */}
          <div className="inline-flex items-center space-x-2 bg-gray-100/50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-800 rounded-full px-4 py-2 mb-8 backdrop-blur-sm">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-sm text-gray-600 dark:text-gray-300">Now in Beta</span>
          </div>

          {/* Main heading */}
          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight text-gray-900 dark:text-white">
            <span className="block">The Future of</span>
            <span className="block bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
              AI-Powered
            </span>
            <span className="block">Experiences</span>
          </h1>

          {/* Subtitle */}
          <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 mb-12 max-w-3xl mx-auto leading-relaxed">
            Transform your workflow with intelligent automation that learns,
            adapts, and evolves with your needs. Experience the next generation
            of productivity.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-6 mb-16">
            <Link href="/register" className="group bg-gray-900 dark:bg-white text-white dark:text-black px-8 py-4 rounded-xl hover:bg-gray-800 dark:hover:bg-gray-100 transition-all duration-300 font-semibold text-lg flex items-center space-x-2 shadow-2xl hover:shadow-gray-500/20 dark:hover:shadow-white/20">
              <span>Start Free Trial</span>
              <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>

            <Link href="/demo" className="group border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white px-8 py-4 rounded-xl hover:border-gray-400 dark:hover:border-gray-600 hover:bg-gray-100/50 dark:hover:bg-gray-900/50 transition-all duration-300 font-semibold text-lg flex items-center space-x-2 backdrop-blur-sm">
              <Play className="w-5 h-5" />
              <span>View Demo</span>
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-2xl mx-auto">
            <div>
              <div className="text-3xl font-bold text-blue-400 mb-2">99.9%</div>
              <div className="text-gray-500 dark:text-gray-400">Uptime</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-purple-400 mb-2">
                50M+
              </div>
              <div className="text-gray-500 dark:text-gray-400">API Calls</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-pink-400 mb-2">500K+</div>
              <div className="text-gray-500 dark:text-gray-400">Users</div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="relative z-10 max-w-6xl mx-auto px-6 md:px-8 py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-6 text-gray-900 dark:text-white">
            Powerful Features,
            <span className="block text-blue-400">Simple Interface</span>
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Everything you need to supercharge your productivity, built with
            cutting-edge AI technology.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              icon: <Zap className="w-8 h-8" />,
              title: "Lightning Fast",
              description:
                "Process thousands of requests per second with our optimized infrastructure.",
            },
            {
              icon: <Shield className="w-8 h-8" />,
              title: "Enterprise Security",
              description:
                "Bank-level encryption and compliance with SOC 2 Type II standards.",
            },
            {
              icon: <Globe className="w-8 h-8" />,
              title: "Global Scale",
              description:
                "Deploy across 15+ regions worldwide with automatic failover.",
            },
          ].map((feature, index) => (
            <div
              key={index}
              className="group bg-gray-100/30 dark:bg-gray-900/30 border border-gray-300 dark:border-gray-800 rounded-2xl p-8 hover:border-gray-400 dark:hover:border-gray-700 hover:bg-gray-100/50 dark:hover:bg-gray-900/50 transition-all duration-300 backdrop-blur-sm"
            >
              <div className="text-blue-400 mb-4 group-hover:scale-110 transition-transform duration-300">
                {feature.icon}
              </div>
              <h3 className="text-xl font-semibold mb-3 text-gray-900 dark:text-white">{feature.title}</h3>
              <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="relative z-10 max-w-4xl mx-auto px-6 md:px-8 py-20 text-center">
        <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-3xl p-12 backdrop-blur-sm">
          <h2 className="text-3xl md:text-4xl font-bold mb-6 text-gray-900 dark:text-white">
            Ready to Transform Your Workflow?
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
            Join thousands of teams already using our platform to build the future.
          </p>
          <Link href="/register" className="inline-block bg-gradient-to-r from-blue-500 to-purple-600 text-white px-10 py-4 rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all duration-300 font-semibold text-lg shadow-2xl hover:shadow-blue-500/25">
            Get Started Today
          </Link>
        </div>
      </div>

      {/* Floating elements */}
      <div className="absolute top-1/4 left-10 w-20 h-20 bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-xl animate-pulse" />
      <div className="absolute top-3/4 right-20 w-32 h-32 bg-purple-500/5 dark:bg-purple-500/10 rounded-full blur-2xl animate-pulse delay-1000" />
      <div className="absolute bottom-1/4 left-1/3 w-16 h-16 bg-pink-500/5 dark:bg-pink-500/10 rounded-full blur-lg animate-pulse delay-500" />
    </div>
  );
}
