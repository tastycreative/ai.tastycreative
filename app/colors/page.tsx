"use client";

import { colors } from '@/lib/colors';
import { Copy, Check } from 'lucide-react';
import { useState } from 'react';

export default function ColorsPage() {
  const [copiedText, setCopiedText] = useState<string | null>(null);

  

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const CodeBlock = ({ code }: { code: string }) => (
    <button
      onClick={() => copyToClipboard(code)}
      className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors group text-left w-full"
    >
      <code className="text-sm font-mono text-gray-900 dark:text-white flex-1">
        {code}
      </code>
      {copiedText === code ? (
        <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
      ) : (
        <Copy className="w-4 h-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 flex-shrink-0" />
      )}
    </button>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-gray-50 to-white dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-brand-light-pink via-brand-mid-pink to-brand-blue bg-clip-text text-transparent">
            Brand Color Palette
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Custom Tailwind CSS color system - Click any code block to copy
          </p>
        </div>

        {/* Color Cards */}
        <div className="space-y-8 mb-16">
          {colors.map((color) => (
            <div
              key={color.key}
              className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 md:p-8 shadow-lg hover:shadow-xl transition-shadow"
            >
              <div className="grid md:grid-cols-2 gap-6">
                {/* Color Info */}
                <div>
                  <div className="flex items-center gap-4 mb-4">
                    <div
                      className={`w-16 h-16 rounded-2xl shadow-lg border-2 border-white dark:border-gray-800`}
                      style={{ backgroundColor: color.hex }}
                    />
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                        {color.name}
                      </h2>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {color.hex}
                      </p>
                    </div>
                  </div>
                  <p className="text-gray-700 dark:text-gray-300 mb-4">
                    {color.description}
                  </p>
                  <div className="text-sm font-mono bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg">
                    className="<span className="text-blue-600 dark:text-blue-400">{color.key}</span>"
                  </div>
                </div>

                {/* Usage Examples */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
                    Usage Examples
                  </h3>

                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Background</p>
                    <CodeBlock code={`bg-${color.key}`} />
                  </div>

                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Text</p>
                    <CodeBlock code={`text-${color.key}`} />
                  </div>

                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Border</p>
                    <CodeBlock code={`border border-${color.key}`} />
                  </div>

                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">With Opacity</p>
                    <CodeBlock code={`bg-${color.key}/50`} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Interactive Examples */}
        <div className="space-y-8">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white text-center mb-8">
            Interactive Examples
          </h2>

          {/* Buttons */}
          <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 md:p-8">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Buttons
            </h3>
            <div className="flex flex-wrap gap-4">
              <button className="px-6 py-3 bg-brand-light-pink text-white rounded-lg hover:bg-brand-dark-pink transition-colors font-medium shadow-lg shadow-brand-light-pink/30">
                Light Pink Button
              </button>
              <button className="px-6 py-3 bg-brand-dark-pink text-white rounded-lg hover:bg-brand-mid-pink transition-colors font-medium shadow-lg shadow-brand-dark-pink/30">
                Dark Pink Button
              </button>
              <button className="px-6 py-3 bg-brand-blue text-white rounded-lg hover:opacity-90 transition-opacity font-medium shadow-lg shadow-brand-blue/30">
                Blue Button
              </button>
            </div>
          </div>

          {/* Text Colors */}
          <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 md:p-8">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Text Colors
            </h3>
            <div className="space-y-2">
              <p className="text-brand-light-pink text-lg font-semibold">This is Light Pink text</p>
              <p className="text-brand-dark-pink text-lg font-semibold">This is Dark Pink text</p>
              <p className="text-brand-mid-pink text-lg font-semibold">This is Mid Pink text</p>
              <p className="text-brand-blue text-lg font-semibold">This is Blue text</p>
            </div>
          </div>

          {/* Gradients */}
          <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 md:p-8">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Gradient Examples
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="h-32 bg-gradient-to-r from-brand-light-pink to-brand-blue rounded-xl shadow-lg flex items-center justify-center">
                <span className="text-white font-semibold">Pink to Blue</span>
              </div>
              <div className="h-32 bg-gradient-to-br from-brand-dark-pink via-brand-mid-pink to-brand-light-pink rounded-xl shadow-lg flex items-center justify-center">
                <span className="text-white font-semibold">Pink Gradient</span>
              </div>
              <div className="h-32 bg-gradient-to-r from-brand-blue to-brand-light-pink rounded-xl shadow-lg flex items-center justify-center">
                <span className="text-white font-semibold">Blue to Pink</span>
              </div>
              <div className="h-32 bg-gradient-to-tl from-brand-dark-pink to-brand-blue rounded-xl shadow-lg flex items-center justify-center">
                <span className="text-white font-semibold">Diagonal Gradient</span>
              </div>
            </div>
          </div>

          {/* Borders */}
          <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 md:p-8">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Border Examples
            </h3>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="p-6 border-2 border-brand-light-pink rounded-xl">
                <p className="text-gray-900 dark:text-white font-medium">Light Pink Border</p>
              </div>
              <div className="p-6 border-2 border-brand-dark-pink rounded-xl">
                <p className="text-gray-900 dark:text-white font-medium">Dark Pink Border</p>
              </div>
              <div className="p-6 border-2 border-brand-blue rounded-xl">
                <p className="text-gray-900 dark:text-white font-medium">Blue Border</p>
              </div>
            </div>
          </div>

          {/* Cards */}
          <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 md:p-8">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Card Examples
            </h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-brand-light-pink/10 border border-brand-light-pink/30 rounded-xl p-6">
                <h4 className="text-brand-light-pink font-bold text-lg mb-2">Light Pink Card</h4>
                <p className="text-gray-700 dark:text-gray-300">
                  Card with light pink background and border
                </p>
              </div>
              <div className="bg-brand-blue/10 border border-brand-blue/30 rounded-xl p-6">
                <h4 className="text-brand-blue font-bold text-lg mb-2">Blue Card</h4>
                <p className="text-gray-700 dark:text-gray-300">
                  Card with blue background and border
                </p>
              </div>
            </div>
          </div>

          {/* Badges */}
          <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 md:p-8">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Badge Examples
            </h3>
            <div className="flex flex-wrap gap-3">
              <span className="px-4 py-2 bg-brand-light-pink text-white rounded-full text-sm font-medium">
                Light Pink Badge
              </span>
              <span className="px-4 py-2 bg-brand-dark-pink text-white rounded-full text-sm font-medium">
                Dark Pink Badge
              </span>
              <span className="px-4 py-2 bg-brand-mid-pink text-white rounded-full text-sm font-medium">
                Mid Pink Badge
              </span>
              <span className="px-4 py-2 bg-brand-blue text-white rounded-full text-sm font-medium">
                Blue Badge
              </span>
              <span className="px-4 py-2 bg-brand-light-pink/20 text-brand-light-pink border border-brand-light-pink rounded-full text-sm font-medium">
                Outline Badge
              </span>
            </div>
          </div>

          {/* Shadows */}
          <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 md:p-8">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Shadow Examples
            </h3>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg shadow-brand-light-pink/30">
                <p className="text-gray-900 dark:text-white font-medium">Pink Shadow</p>
              </div>
              <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg shadow-brand-blue/30">
                <p className="text-gray-900 dark:text-white font-medium">Blue Shadow</p>
              </div>
              <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg shadow-brand-dark-pink/30">
                <p className="text-gray-900 dark:text-white font-medium">Dark Pink Shadow</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-16 text-center">
          <div className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-brand-light-pink to-brand-blue text-white rounded-full font-semibold shadow-lg">
            <span>✨</span>
            <span>Your Brand Colors Are Ready!</span>
            <span>🎨</span>
          </div>
        </div>
      </div>
    </div>
  );
}
