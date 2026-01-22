"use client";

import { useState, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  FileText,
  Download,
  Loader2,
  Palette,
  Type,
  Sparkles,
  X,
  Copy,
  Check,
  Image as ImageIcon,
  Save,
} from "lucide-react";

interface KeycardStyle {
  id: string;
  name: string;
  background: string;
  textColor: string;
  fontFamily: string;
  fontFamilyCanvas: string; // Clean font name for canvas
  borderStyle: string;
  shadow: string;
  overlay?: string;
  overlayGradient?: string; // For canvas rendering
}

const KEYCARD_STYLES: KeycardStyle[] = [
  {
    id: "elegant-dark",
    name: "Elegant Dark",
    background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
    textColor: "#f8f8f8",
    fontFamily: "'Playfair Display', serif",
    fontFamilyCanvas: "Playfair Display, serif",
    borderStyle: "border border-gray-600/50",
    shadow: "shadow-2xl shadow-purple-900/30",
    overlay: "bg-gradient-to-br from-purple-500/5 to-pink-500/5",
    overlayGradient: "rgba(168,85,247,0.05),rgba(236,72,153,0.05)",
  },
  {
    id: "romantic-pink",
    name: "Romantic Pink",
    background: "linear-gradient(135deg, #ff6b6b 0%, #ee5a5a 50%, #ff8e8e 100%)",
    textColor: "#ffffff",
    fontFamily: "'Dancing Script', cursive",
    fontFamilyCanvas: "Dancing Script, cursive",
    borderStyle: "border-2 border-white/30",
    shadow: "shadow-2xl shadow-pink-500/40",
    overlay: "bg-gradient-to-br from-white/10 to-transparent",
    overlayGradient: "rgba(255,255,255,0.1),transparent",
  },
  {
    id: "midnight-blue",
    name: "Midnight Blue",
    background: "linear-gradient(135deg, #2c3e50 0%, #3498db 50%, #2980b9 100%)",
    textColor: "#ecf0f1",
    fontFamily: "'Merriweather', serif",
    fontFamilyCanvas: "Merriweather, serif",
    borderStyle: "border border-blue-400/30",
    shadow: "shadow-2xl shadow-blue-900/40",
    overlay: "bg-gradient-to-br from-blue-400/10 to-transparent",
    overlayGradient: "rgba(96,165,250,0.1),transparent",
  },
  {
    id: "golden-luxury",
    name: "Golden Luxury",
    background: "linear-gradient(135deg, #232526 0%, #414345 50%, #232526 100%)",
    textColor: "#ffd700",
    fontFamily: "'Cinzel', serif",
    fontFamilyCanvas: "Cinzel, serif",
    borderStyle: "border-2 border-yellow-500/40",
    shadow: "shadow-2xl shadow-yellow-500/20",
    overlay: "bg-gradient-to-br from-yellow-500/5 to-transparent",
    overlayGradient: "rgba(234,179,8,0.05),transparent",
  },
  {
    id: "soft-pastel",
    name: "Soft Pastel",
    background: "linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)",
    textColor: "#5c4033",
    fontFamily: "'Quicksand', sans-serif",
    fontFamilyCanvas: "Quicksand, sans-serif",
    borderStyle: "border border-orange-300/50",
    shadow: "shadow-xl shadow-orange-200/30",
    overlay: "bg-gradient-to-br from-white/20 to-transparent",
    overlayGradient: "rgba(255,255,255,0.2),transparent",
  },
  {
    id: "neon-glow",
    name: "Neon Glow",
    background: "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)",
    textColor: "#00ff88",
    fontFamily: "'Orbitron', sans-serif",
    fontFamilyCanvas: "Orbitron, sans-serif",
    borderStyle: "border border-green-400/50",
    shadow: "shadow-2xl shadow-green-500/30",
    overlay: "bg-gradient-to-br from-green-500/5 to-purple-500/5",
    overlayGradient: "rgba(34,197,94,0.05),rgba(168,85,247,0.05)",
  },
  {
    id: "vintage-paper",
    name: "Vintage Paper",
    background: "linear-gradient(135deg, #f5e6d3 0%, #e8d5b7 50%, #d4c4a8 100%)",
    textColor: "#4a3728",
    fontFamily: "'Libre Baskerville', serif",
    fontFamilyCanvas: "Libre Baskerville, serif",
    borderStyle: "border-2 border-amber-800/30",
    shadow: "shadow-lg shadow-amber-900/20",
  },
  {
    id: "minimalist-white",
    name: "Minimalist White",
    background: "linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)",
    textColor: "#1a1a1a",
    fontFamily: "'Inter', sans-serif",
    fontFamilyCanvas: "Inter, sans-serif",
    borderStyle: "border border-gray-200",
    shadow: "shadow-xl shadow-gray-200/50",
    overlay: "bg-gradient-to-br from-gray-50/50 to-transparent",
    overlayGradient: "rgba(249,250,251,0.5),transparent",
  },
];

interface KeycardGeneratorProps {
  onSaveToSet?: (imageBlob: Blob, filename: string) => Promise<void>;
  onSaveComplete?: () => void; // Called after successful save to navigate
  profileId?: string | null;
  hasSelectedSet?: boolean; // Whether a set is selected
  directSaveMode?: boolean; // If true, skip preview modal and save directly
}

export default function KeycardGenerator({ onSaveToSet, onSaveComplete, profileId, hasSelectedSet = false, directSaveMode = false }: KeycardGeneratorProps) {
  const [text, setText] = useState("");
  const [selectedStyle, setSelectedStyle] = useState<KeycardStyle>(KEYCARD_STYLES[0]);
  const [fontSize, setFontSize] = useState(24);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [cardSize, setCardSize] = useState<"square" | "portrait" | "landscape">("square");
  const [isSaving, setIsSaving] = useState(false);

  const getCardDimensions = () => {
    switch (cardSize) {
      case "portrait":
        return { width: 400, height: 600, aspectRatio: "aspect-[2/3]" };
      case "landscape":
        return { width: 600, height: 400, aspectRatio: "aspect-[3/2]" };
      default:
        return { width: 500, height: 500, aspectRatio: "aspect-square" };
    }
  };

  // Parse gradient string to get color stops
  const parseGradient = (gradientStr: string): { angle: number; stops: { color: string; position: number }[] } => {
    const angleMatch = gradientStr.match(/(\d+)deg/);
    const angle = angleMatch ? parseInt(angleMatch[1]) : 135;
    
    const colorStops: { color: string; position: number }[] = [];
    const stopRegex = /(#[a-fA-F0-9]{6}|#[a-fA-F0-9]{3}|rgba?\([^)]+\))\s*(\d+)?%?/g;
    let match;
    let index = 0;
    
    while ((match = stopRegex.exec(gradientStr)) !== null) {
      const position = match[2] ? parseInt(match[2]) / 100 : index === 0 ? 0 : 1;
      colorStops.push({ color: match[1], position });
      index++;
    }
    
    return { angle, stops: colorStops };
  };

  // Draw gradient on canvas
  const drawGradient = (ctx: CanvasRenderingContext2D, width: number, height: number, gradientStr: string) => {
    const { angle, stops } = parseGradient(gradientStr);
    
    // Convert angle to coordinates
    const angleRad = (angle - 90) * Math.PI / 180;
    const x1 = width / 2 - Math.cos(angleRad) * width;
    const y1 = height / 2 - Math.sin(angleRad) * height;
    const x2 = width / 2 + Math.cos(angleRad) * width;
    const y2 = height / 2 + Math.sin(angleRad) * height;
    
    const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
    stops.forEach(stop => {
      gradient.addColorStop(stop.position, stop.color);
    });
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  };

  // Wrap text for canvas
  const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] => {
    const lines: string[] = [];
    const paragraphs = text.split('\n');
    
    for (const paragraph of paragraphs) {
      const words = paragraph.split(' ');
      let currentLine = '';
      
      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const metrics = ctx.measureText(testLine);
        
        if (metrics.width > maxWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      
      if (currentLine) {
        lines.push(currentLine);
      }
    }
    
    return lines;
  };

  const generateImage = useCallback(async () => {
    if (!text.trim()) return;

    try {
      setIsGenerating(true);
      
      const dimensions = getCardDimensions();
      const scale = 2; // For high DPI
      const width = dimensions.width * scale;
      const height = dimensions.height * scale;
      const padding = 64 * scale;
      
      // Create canvas
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        throw new Error('Could not get canvas context');
      }
      
      // Draw rounded rectangle background
      const radius = 32 * scale;
      ctx.beginPath();
      ctx.roundRect(0, 0, width, height, radius);
      ctx.clip();
      
      // Draw background gradient
      drawGradient(ctx, width, height, selectedStyle.background);
      
      // Draw overlay gradient if exists
      if (selectedStyle.overlayGradient) {
        // Parse overlay colors - handle rgba() values which contain commas
        const overlayStr = selectedStyle.overlayGradient;
        const colorMatches = overlayStr.match(/rgba?\([^)]+\)|transparent|#[a-fA-F0-9]{3,8}/g);
        
        if (colorMatches && colorMatches.length >= 2) {
          const overlayGradient = ctx.createLinearGradient(0, 0, width, height);
          overlayGradient.addColorStop(0, colorMatches[0]);
          overlayGradient.addColorStop(1, colorMatches[1]);
          ctx.fillStyle = overlayGradient;
          ctx.fillRect(0, 0, width, height);
        }
      }
      
      // Configure text
      ctx.fillStyle = selectedStyle.textColor;
      ctx.font = `${fontSize * scale}px ${selectedStyle.fontFamilyCanvas}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Add text shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
      ctx.shadowBlur = 8 * scale;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 4 * scale;
      
      // Wrap and draw text
      const maxWidth = width - (padding * 2);
      const lines = wrapText(ctx, text, maxWidth);
      const lineHeight = fontSize * scale * 1.6;
      const totalTextHeight = lines.length * lineHeight;
      const startY = (height - totalTextHeight) / 2 + lineHeight / 2;
      
      lines.forEach((line, index) => {
        ctx.fillText(line, width / 2, startY + index * lineHeight);
      });
      
      // Convert to image
      const imageUrl = canvas.toDataURL('image/png');
      setGeneratedImage(imageUrl);
      
      // If directSaveMode is enabled and we have a set selected, save directly
      if (directSaveMode && hasSelectedSet && onSaveToSet) {
        try {
          setIsSaving(true);
          const response = await fetch(imageUrl);
          const blob = await response.blob();
          const filename = `keycard-${Date.now()}.png`;
          await onSaveToSet(blob, filename);
          setText(""); // Clear text after successful save
          setGeneratedImage(null);
          if (onSaveComplete) {
            onSaveComplete();
          }
        } catch (saveError) {
          console.error("Error saving keycard:", saveError);
          alert("Failed to save keycard. Please try again.");
        } finally {
          setIsSaving(false);
        }
      } else if (directSaveMode && !hasSelectedSet) {
        alert("Please select a set first before generating a keycard.");
        setGeneratedImage(null);
      } else {
        // Show preview modal for non-direct save mode
        setShowPreviewModal(true);
      }
    } catch (error) {
      console.error("Error generating image:", error);
      alert("Failed to generate image. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  }, [text, selectedStyle, fontSize, cardSize, directSaveMode, hasSelectedSet, onSaveToSet, onSaveComplete]);

  const downloadImage = () => {
    if (!generatedImage) return;

    const link = document.createElement("a");
    link.href = generatedImage;
    link.download = `keycard-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyToClipboard = async () => {
    if (!generatedImage) return;

    try {
      const response = await fetch(generatedImage);
      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Error copying to clipboard:", error);
      alert("Failed to copy image. Please download instead.");
    }
  };

  const saveToSet = async () => {
    if (!generatedImage) return;
    
    // Check if a set is selected
    if (!hasSelectedSet || !onSaveToSet) {
      alert("Please create or select a set first before saving the keycard.");
      return;
    }

    try {
      setIsSaving(true);
      const response = await fetch(generatedImage);
      const blob = await response.blob();
      const filename = `keycard-${Date.now()}.png`;
      await onSaveToSet(blob, filename);
      setShowPreviewModal(false);
      
      // Call onSaveComplete to navigate to the set
      if (onSaveComplete) {
        onSaveComplete();
      }
    } catch (error) {
      console.error("Error saving to set:", error);
      alert("Failed to save to set. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const dimensions = getCardDimensions();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/25">
          <FileText className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent">
            Keycard Generator
          </h2>
          <p className="text-sm text-gray-400">
            Create beautiful text cards to share
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Editor Panel */}
        <div className="space-y-4">
          {/* Text Input */}
          <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/60 border border-gray-700/50 rounded-2xl p-4 backdrop-blur-sm">
            <label className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
              <Type className="w-4 h-4 text-indigo-400" />
              Your Message
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type your message here..."
              rows={5}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
            />
            <p className="text-xs text-gray-500 mt-2">
              {text.length} characters
            </p>
          </div>

          {/* Style Selector */}
          <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/60 border border-gray-700/50 rounded-2xl p-4 backdrop-blur-sm">
            <label className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
              <Palette className="w-4 h-4 text-indigo-400" />
              Card Style
            </label>
            <div className="grid grid-cols-4 gap-2">
              {KEYCARD_STYLES.map((style) => (
                <button
                  key={style.id}
                  onClick={() => setSelectedStyle(style)}
                  className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all duration-200 ${
                    selectedStyle.id === style.id
                      ? "border-indigo-500 ring-2 ring-indigo-500/50 scale-105"
                      : "border-transparent hover:border-gray-600"
                  }`}
                  title={style.name}
                >
                  <div
                    className="absolute inset-0"
                    style={{ background: style.background }}
                  />
                  {selectedStyle.id === style.id && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <Check className="w-5 h-5 text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2 text-center">
              {selectedStyle.name}
            </p>
          </div>

          {/* Card Size */}
          <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/60 border border-gray-700/50 rounded-2xl p-4 backdrop-blur-sm">
            <label className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-indigo-400" />
              Card Size
            </label>
            <div className="flex gap-2">
              {(["square", "portrait", "landscape"] as const).map((size) => (
                <button
                  key={size}
                  onClick={() => setCardSize(size)}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                    cardSize === size
                      ? "bg-indigo-500 text-white"
                      : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                  }`}
                >
                  {size.charAt(0).toUpperCase() + size.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Font Size */}
          <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/60 border border-gray-700/50 rounded-2xl p-4 backdrop-blur-sm">
            <label className="text-sm font-medium text-gray-300 mb-3 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Type className="w-4 h-4 text-indigo-400" />
                Font Size
              </span>
              <span className="text-indigo-400">{fontSize}px</span>
            </label>
            <input
              type="range"
              min="12"
              max="48"
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
          </div>

          {/* Generate Button */}
          <button
            onClick={generateImage}
            disabled={!text.trim() || isGenerating || isSaving || (directSaveMode && !hasSelectedSet)}
            className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white rounded-xl font-medium shadow-lg shadow-indigo-500/25 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isGenerating || isSaving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {isSaving ? "Saving..." : "Generating..."}
              </>
            ) : directSaveMode ? (
              <>
                <Save className="w-5 h-5" />
                {hasSelectedSet ? "Generate & Save to Set" : "Select a Set First"}
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Generate Keycard
              </>
            )}
          </button>
        </div>

        {/* Preview Panel */}
        <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/60 border border-gray-700/50 rounded-2xl p-6 backdrop-blur-sm">
          <h3 className="text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            Live Preview
          </h3>
          
          <div className="flex items-center justify-center">
            {/* Card container for visual preview - pure CSS, no canvas involvement */}
            <div className={`relative ${dimensions.aspectRatio} w-full max-w-md`}>
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: selectedStyle.background,
                  fontFamily: selectedStyle.fontFamily,
                  borderRadius: "16px",
                  overflow: "hidden",
                  border: selectedStyle.id === "romantic-pink" || selectedStyle.id === "golden-luxury" || selectedStyle.id === "vintage-paper" 
                    ? "2px solid rgba(255,255,255,0.3)" 
                    : "1px solid rgba(107,114,128,0.5)",
                  boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
                }}
              >
                {/* Overlay */}
                {selectedStyle.overlayGradient && (
                  <div 
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: `linear-gradient(to bottom right, ${selectedStyle.overlayGradient})`,
                    }}
                  />
                )}
                
                {/* Text Content */}
                <div 
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "32px",
                  }}
                >
                  <p
                    style={{
                      color: selectedStyle.textColor,
                      fontSize: `${fontSize}px`,
                      textShadow: "0 2px 4px rgba(0,0,0,0.1)",
                      textAlign: "center",
                      lineHeight: 1.6,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      margin: 0,
                    }}
                  >
                    {text || "Your message will appear here..."}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <p className="text-xs text-gray-500 mt-4 text-center">
            The preview shows exactly how your keycard will look
          </p>
        </div>
      </div>

      {/* Preview Modal */}
      {showPreviewModal &&
        generatedImage &&
        typeof document !== "undefined" &&
        createPortal(
          <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowPreviewModal(false)}
          >
            <div 
              className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-4 border-b border-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">
                    Keycard Generated!
                  </h3>
                </div>
                <button
                  onClick={() => setShowPreviewModal(false)}
                  className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {/* Preview */}
              <div className="p-6">
                <div className="rounded-xl overflow-hidden border border-gray-700">
                  <img
                    src={generatedImage}
                    alt="Generated Keycard"
                    className="w-full h-auto"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="p-4 border-t border-gray-700 flex flex-wrap gap-2">
                <button
                  onClick={downloadImage}
                  className="flex-1 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white rounded-xl font-medium transition-all flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
                <button
                  onClick={copyToClipboard}
                  className="flex-1 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-green-400" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy
                    </>
                  )}
                </button>
                <button
                  onClick={saveToSet}
                  disabled={isSaving}
                  className={`flex-1 py-2.5 text-white rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
                    hasSelectedSet
                      ? "bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600"
                      : "bg-gray-600 hover:bg-gray-500"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      {hasSelectedSet ? "Save to Set" : "Select Set First"}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
