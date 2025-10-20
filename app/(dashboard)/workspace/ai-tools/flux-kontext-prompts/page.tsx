"use client";

import { useState, useRef, useEffect } from "react";
import {
  Upload,
  FileImage,
  Sparkles,
  Copy,
  Trash2,
  Send,
  Loader2,
  Zap,
  Image as ImageIcon,
  X,
  User,
  Bot,
  AlertCircle,
  Info,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Brain,
  RefreshCw,
  MessageSquare,
} from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  image?: string;
  timestamp: Date;
}

// Component to render thinking process
function ThinkingProcess({ thinking }: { thinking: string }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="my-3 bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-300/30 dark:border-purple-600/30 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-3 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center space-x-2">
          <Brain className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          <span className="font-semibold text-purple-900 dark:text-purple-200 text-sm">
            💭 View AI's Thinking Process
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-purple-600 dark:text-purple-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-purple-600 dark:text-purple-400" />
        )}
      </button>
      {isExpanded && (
        <div className="p-5 bg-black/10 dark:bg-black/20 border-t border-purple-300/30 dark:border-purple-600/30">
          <pre className="text-sm leading-loose whitespace-pre-wrap text-gray-700 dark:text-gray-300 font-mono overflow-x-auto tracking-wide">
            {thinking}
          </pre>
          <div className="mt-4 pt-3 border-t border-purple-300/20 dark:border-purple-600/20">
            <p className="text-xs text-purple-600 dark:text-purple-400 italic">
              💡 This shows how the AI reasoned through the image analysis
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// Component to render a prompt with copy button
function PromptBlock({ prompt }: { prompt: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-3 group relative">
      <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 dark:from-blue-600/20 dark:to-purple-600/20 border border-blue-300/30 dark:border-blue-600/30 rounded-lg p-4">
        <div className="flex items-start justify-between gap-3">
          <p className="flex-1 text-sm leading-relaxed break-words whitespace-normal">
            {prompt}
          </p>
          <button
            onClick={handleCopy}
            className="flex-shrink-0 p-2 bg-white/80 dark:bg-gray-800/80 hover:bg-white dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg transition-all duration-200 opacity-100 md:opacity-0 md:group-hover:opacity-100"
            title="Copy prompt"
          >
            {copied ? (
              <span className="text-xs text-green-600 dark:text-green-400 font-semibold">✓</span>
            ) : (
              <Copy className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Component to render message content with thinking
function MessageContent({ content }: { content: string }) {
  // Extract thinking process if present
  const thinkingMatch = content.match(/<details>[\s\S]*?<summary>.*?<\/summary>\s*```\n([\s\S]*?)\n```\s*<\/details>/);
  const thinking = thinkingMatch ? thinkingMatch[1] : null;
  const mainContent = thinking && thinkingMatch ? content.replace(thinkingMatch[0], '').trim() : content;

  // Split content into sections (text, bold, code, and prompts)
  const parts = mainContent.split(/(\*\*.*?\*\*|```[\s\S]*?```)/g);
  
  return (
    <>
      {thinking && <ThinkingProcess thinking={thinking} />}
      <div className="text-sm leading-relaxed">
        {parts.map((part, index) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={index} className="block my-2">{part.slice(2, -2)}</strong>;
          } else if (part.startsWith('```') && part.endsWith('```')) {
            const codeContent = part.slice(3, -3).trim();
            // Check if this looks like a prompt (long single paragraph)
            if (codeContent.length > 100 && !codeContent.includes('\n\n')) {
              return <PromptBlock key={index} prompt={codeContent} />;
            }
            return (
              <pre key={index} className="my-2 p-3 bg-black/20 dark:bg-black/40 rounded-lg overflow-x-auto">
                <code className="text-xs">{codeContent}</code>
              </pre>
            );
          }
          return <span key={index} className="whitespace-pre-wrap">{part}</span>;
        })}
      </div>
    </>
  );
}

export default function FluxKontextPrompts() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [showTechniques, setShowTechniques] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Add welcome message on mount
  useEffect(() => {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: "👋 Hello! I'm your Flux Kontext Dev prompt generator assistant. I can help you create optimized prompts for image generation and modification.\n\n**What I can do:**\n• Generate detailed Flux Kontext Dev prompts from your descriptions\n• Help you modify images with specific instructions\n• Work with ALL content types (SFW & NSFW)\n• Apply style transfers and character consistency\n• Provide step-by-step editing guidance\n\n**� How to use:**\n• **Describe what you want**: Just tell me in detail what you'd like to create\n• **Upload reference images**: Works best with objects, scenes, and architecture\n• **For people/portraits**: Describe them to me instead (better results!)\n\n📚 Click \"Prompt Techniques\" above to learn advanced strategies!\n\n**Let's create something amazing - describe your vision or upload a reference image!**",
        timestamp: new Date(),
      },
    ]);
  }, []);

  const generatePromptWithAI = async (
    userMessage: string,
    imageBase64?: string
  ): Promise<string> => {
    try {
      const response = await fetch("/api/flux-kontext-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userMessage,
          image: imageBase64,
          conversationHistory: messages.slice(-6), // Last 6 messages for context
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to generate prompt: ${response.statusText}`);
      }

      const data = await response.json();
      return data.response || "I apologize, but I couldn't generate a response. Please try again.";
    } catch (error) {
      console.error("AI generation error:", error);
      throw new Error("Failed to generate response. Please try again.");
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setUploadedImage(result);
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSendMessage = async (messageToSend?: string, imageToSend?: string) => {
    const textContent = messageToSend || inputMessage.trim();
    const imageContent = imageToSend !== undefined ? imageToSend : uploadedImage;
    
    if (!textContent && !imageContent) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: textContent || "Analyze this image and generate a Flux Kontext prompt",
      image: imageContent || undefined,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputMessage("");
    const currentImage = imageContent;
    setUploadedImage(null);
    setIsGenerating(true);
    setError(null);

    try {
      // Step 1: Initial processing
      setLoadingStep("Processing your request...");
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Step 2: Image analysis or reasoning
      if (currentImage) {
        setLoadingStep("Analyzing image with AI vision...");
        await new Promise(resolve => setTimeout(resolve, 500));
        setLoadingStep("🧠 AI reasoning in progress...");
      } else {
        setLoadingStep("Understanding your requirements...");
      }
      
      const imageBase64 = currentImage ? currentImage.split(",")[1] : undefined;
      
      // Step 3: Generating prompts
      setLoadingStep("✨ Generating optimized prompts...");
      const aiResponse = await generatePromptWithAI(userMessage.content, imageBase64);

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: aiResponse,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error: any) {
      console.error("Message failed:", error);
      setError(error.message || "Failed to generate response. Please try again.");
    } finally {
      setIsGenerating(false);
      setLoadingStep("");
    }
  };

  const handleRegenerateMessage = async (messageId: string) => {
    const messageIndex = messages.findIndex(msg => msg.id === messageId);
    if (messageIndex === -1 || messageIndex === 0) return;
    
    const previousUserMessage = messages[messageIndex - 1];
    if (previousUserMessage.role !== "user") return;
    
    // Remove the assistant message we're regenerating
    setMessages(prev => prev.filter(msg => msg.id !== messageId));
    
    // Regenerate with the previous user message
    setIsGenerating(true);
    setError(null);
    
    try {
      setLoadingStep("Regenerating response...");
      await new Promise(resolve => setTimeout(resolve, 300));
      
      if (previousUserMessage.image) {
        setLoadingStep("Re-analyzing image...");
        await new Promise(resolve => setTimeout(resolve, 500));
        setLoadingStep("🧠 AI reasoning in progress...");
      }
      
      setLoadingStep("✨ Generating new prompts...");
      const imageBase64 = previousUserMessage.image ? previousUserMessage.image.split(",")[1] : undefined;
      const aiResponse = await generatePromptWithAI(previousUserMessage.content, imageBase64);

      const assistantMessage: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: aiResponse,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error: any) {
      console.error("Regeneration failed:", error);
      setError(error.message || "Failed to regenerate response. Please try again.");
    } finally {
      setIsGenerating(false);
      setLoadingStep("");
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  const handleCopyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
  };

  const handleRemoveImage = () => {
    setUploadedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: "👋 Hello! I'm your Flux Kontext Dev prompt generator assistant. Upload an image or describe what you'd like to create!",
        timestamp: new Date(),
      },
    ]);
    setUploadedImage(null);
    setError(null);
  };

  const handleExamplePrompt = (exampleText: string) => {
    setInputMessage(exampleText);
    textareaRef.current?.focus();
  };

  const contextMessageCount = Math.min(messages.filter(m => m.role === "user").length, 6);

  return (
    <div className="max-w-6xl mx-auto h-[calc(100vh-8rem)] flex flex-col space-y-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-white to-gray-50/50 dark:from-gray-900/80 dark:to-gray-800/40 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/30 rounded-xl p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
                Flux Kontext Dev Assistant
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                AI-powered prompt generator with NSFW support
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowTechniques(!showTechniques)}
              className="flex items-center space-x-2 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors text-sm"
            >
              <BookOpen className="w-4 h-4" />
              <span>Prompt Techniques</span>
            </button>
            <button
              onClick={handleClearChat}
              className="flex items-center space-x-2 px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors text-sm"
            >
              <Trash2 className="w-4 h-4" />
              <span>Clear Chat</span>
            </button>
          </div>
        </div>
      </div>

      {/* Techniques Panel */}
      {showTechniques && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-lg max-h-96 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Flux Kontext Prompt Techniques
            </h2>
            <button
              onClick={() => setShowTechniques(false)}
              className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="space-y-4 text-sm">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">1. Basic Modifications</h3>
              <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300">
                <li>Simple and direct: <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">"Change the car color to red"</code></li>
                <li>Maintain style: <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">"Change to daytime while maintaining the same style of the painting"</code></li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">2. Style Transfer</h3>
              <p className="text-gray-700 dark:text-gray-300 mb-2"><strong>Principles:</strong></p>
              <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300">
                <li>Clearly name style: <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">"Transform to Bauhaus art style"</code></li>
                <li>Describe characteristics: <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">"Transform to oil painting with visible brushstrokes, thick paint texture"</code></li>
                <li>Preserve composition: <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">"Change to Bauhaus style while maintaining the original composition"</code></li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">3. Character Consistency</h3>
              <p className="text-gray-700 dark:text-gray-300 mb-2"><strong>Framework:</strong></p>
              <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300">
                <li>Specific description: <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">"The woman with short black hair"</code> instead of "she"</li>
                <li>Preserve features: <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">"while maintaining the same facial features, hairstyle, and expression"</code></li>
                <li>Step-by-step modifications: Change background first, then actions</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">4. Text Editing</h3>
              <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300">
                <li>Use quotes: <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">"Replace 'joy' with 'BFL'"</code></li>
                <li>Maintain format: <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">"Replace text while maintaining the same font style"</code></li>
              </ul>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Common Problem Solutions</h3>
              
              <div className="space-y-3">
                <div>
                  <p className="font-medium text-gray-800 dark:text-gray-200">Character Changes Too Much</p>
                  <p className="text-red-600 dark:text-red-400">❌ Wrong: "Transform the person into a Viking"</p>
                  <p className="text-green-600 dark:text-green-400">✅ Correct: "Change the clothes to be a viking warrior while preserving facial features"</p>
                </div>

                <div>
                  <p className="font-medium text-gray-800 dark:text-gray-200">Composition Position Changes</p>
                  <p className="text-red-600 dark:text-red-400">❌ Wrong: "Put him on a beach"</p>
                  <p className="text-green-600 dark:text-green-400">✅ Correct: "Change the background to a beach while keeping the person in the exact same position, scale, and pose"</p>
                </div>

                <div>
                  <p className="font-medium text-gray-800 dark:text-gray-200">Style Application Inaccuracy</p>
                  <p className="text-red-600 dark:text-red-400">❌ Wrong: "Make it a sketch"</p>
                  <p className="text-green-600 dark:text-green-400">✅ Correct: "Convert to pencil sketch with natural graphite lines, cross-hatching, and visible paper texture"</p>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Core Principles</h3>
              <ol className="list-decimal list-inside space-y-1 text-gray-700 dark:text-gray-300">
                <li><strong>Be Specific and Clear</strong> - Use precise descriptions, avoid vague terms</li>
                <li><strong>Step-by-step Editing</strong> - Break complex modifications into multiple simple steps</li>
                <li><strong>Explicit Preservation</strong> - State what should remain unchanged</li>
                <li><strong>Verb Selection</strong> - Use "change", "replace" rather than "transform"</li>
              </ol>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mt-4">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Remember:</strong> The more specific, the better. Kontext excels at understanding detailed instructions and maintaining consistency.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Chat Messages */}
      <div className="flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] md:max-w-3xl ${
                message.role === "user"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white"
              } rounded-xl p-4 shadow-md`}
            >
              <div className="flex items-start space-x-2 mb-2">
                {message.role === "assistant" ? (
                  <Bot className="w-5 h-5 flex-shrink-0 mt-0.5" />
                ) : (
                  <User className="w-5 h-5 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  {message.image && (
                    <img
                      src={message.image}
                      alt="Uploaded"
                      className="rounded-lg mb-3 max-w-xs max-h-64 object-contain"
                    />
                  )}
                  <MessageContent content={message.content} />
                </div>
              </div>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/20">
                <span className="text-xs opacity-70">
                  {message.timestamp.toLocaleTimeString()}
                </span>
                <div className="flex items-center space-x-2">
                  {message.role === "assistant" && !isGenerating && (
                    <button
                      onClick={() => handleRegenerateMessage(message.id)}
                      className="text-xs opacity-70 hover:opacity-100 flex items-center space-x-1 transition-opacity"
                      title="Regenerate response"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Regenerate</span>
                    </button>
                  )}
                  <button
                    onClick={() => handleCopyMessage(message.content)}
                    className="text-xs opacity-70 hover:opacity-100 flex items-center space-x-1"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Copy</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
        {isGenerating && (
          <div className="flex justify-start">
            <div className="bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900/40 dark:to-purple-900/40 rounded-xl p-4 shadow-md border border-blue-200 dark:border-blue-800">
              <div className="flex items-center space-x-3">
                <Loader2 className="w-5 h-5 animate-spin text-blue-600 dark:text-blue-400" />
                <div>
                  <span className="text-gray-800 dark:text-gray-200 font-medium block">
                    {loadingStep || "Processing..."}
                  </span>
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    This may take a few moments...
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Input Area */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg p-4">
        {/* Quick Examples */}
        {messages.length <= 1 && !uploadedImage && !inputMessage && (
          <div className="mb-4">
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">Quick examples:</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleExamplePrompt("A woman with long red hair in a elegant black dress, standing in a modern luxury apartment, soft natural lighting from large windows, confident pose, photorealistic style")}
                className="text-xs px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors text-gray-700 dark:text-gray-300"
              >
                Elegant Portrait
              </button>
              <button
                onClick={() => handleExamplePrompt("Give me 3 variations: Change the background to a beach at sunset while keeping the person in the exact same position")}
                className="text-xs px-3 py-1.5 bg-blue-100 dark:bg-blue-900/40 hover:bg-blue-200 dark:hover:bg-blue-800/40 rounded-lg transition-colors text-blue-700 dark:text-blue-300"
              >
                Multiple Variations
              </button>
              <button
                onClick={() => handleExamplePrompt("Transform to oil painting style with visible brushstrokes, thick paint texture, and impressionist color palette while maintaining the original composition")}
                className="text-xs px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors text-gray-700 dark:text-gray-300"
              >
                Style Transfer
              </button>
              <button
                onClick={() => handleExamplePrompt("Create 5 different prompts: sensual boudoir photography, woman in elegant lingerie, soft bedroom lighting with warm tones, intimate atmosphere")}
                className="text-xs px-3 py-1.5 bg-purple-100 dark:bg-purple-900/40 hover:bg-purple-200 dark:hover:bg-purple-800/40 rounded-lg transition-colors text-purple-700 dark:text-purple-300"
              >
                Multiple NSFW Variations
              </button>
            </div>
          </div>
        )}
        
        {uploadedImage && (
          <div className="mb-3 relative inline-block group">
            <img
              src={uploadedImage}
              alt="Preview"
              className="h-24 w-24 object-cover rounded-lg border-2 border-blue-300 dark:border-blue-600 shadow-md"
            />
            <button
              onClick={handleRemoveImage}
              className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 shadow-lg transition-transform hover:scale-110"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 rounded-lg transition-colors pointer-events-none"></div>
          </div>
        )}
        
        <div className="relative bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition-all">
          <div className="flex items-center">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-3 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-l-lg transition-colors flex-shrink-0"
              title="Upload image"
            >
              <ImageIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            
            <textarea
              ref={textareaRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Describe what you want to create... (All content types supported - be detailed!)"
              className="flex-1 px-4 py-3 bg-transparent border-none resize-none focus:outline-none text-gray-900 dark:text-white placeholder-gray-500 min-h-[56px]"
              rows={2}
            />
            
            <button
              onClick={() => handleSendMessage()}
              disabled={isGenerating || (!inputMessage.trim() && !uploadedImage)}
              className="p-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 disabled:from-gray-400 disabled:to-gray-500 text-white rounded-lg transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-50 m-1.5 flex-shrink-0"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          className="hidden"
        />
      </div>
    </div>
  );
}
