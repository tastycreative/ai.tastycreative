"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import {
  Hash,
  Copy,
  Check,
  Search,
  Sparkles,
  Heart,
  Dumbbell,
  Plane,
  Shirt,
  Coffee,
  Camera,
  TrendingUp,
  Plus,
  Edit2,
  Trash2,
  X,
  Save,
} from "lucide-react";

interface HashtagSet {
  id: string;
  name: string;
  category: string;
  icon: string;
  color: string;
  hashtags: string[];
  description?: string;
  order: number;
}

const ICON_MAP: Record<string, any> = {
  Coffee,
  Shirt,
  Dumbbell,
  Plane,
  Sparkles,
  Heart,
  Camera,
  TrendingUp,
  Hash,
};

export default function HashtagBankView() {
  const [hashtagSets, setHashtagSets] = useState<HashtagSet[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [mounted, setMounted] = useState(false);

  // Modals
  const [showSetModal, setShowSetModal] = useState(false);
  const [editingSet, setEditingSet] = useState<HashtagSet | null>(null);

  // Form data
  const [setForm, setSetForm] = useState({
    name: "",
    category: "",
    description: "",
    icon: "Hash",
    color: "blue",
    hashtags: [] as string[],
  });
  const [hashtagInput, setHashtagInput] = useState("");

  useEffect(() => {
    setMounted(true);
    fetchHashtagSets();
  }, []);

  const fetchHashtagSets = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/instagram/hashtags");
      const data = await response.json();

      if (data.sets) {
        setHashtagSets(data.sets);
      }
    } catch (error) {
      console.error("Error fetching hashtag sets:", error);
    } finally {
      setLoading(false);
    }
  };

  const initializeTemplate = async () => {
    if (!confirm("This will create 9 pre-made hashtag sets. Continue?")) return;

    try {
      setLoading(true);
      const response = await fetch("/api/instagram/hashtags/init-template", {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        if (data.error === "User already has hashtag sets") {
          alert("You already have hashtag sets!");
          return;
        }
        throw new Error("Failed to initialize template");
      }

      await fetchHashtagSets();
    } catch (error) {
      console.error("Error initializing template:", error);
      alert("Failed to initialize template. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const openSetModal = (set?: HashtagSet) => {
    if (set) {
      setEditingSet(set);
      setSetForm({
        name: set.name,
        category: set.category,
        description: set.description || "",
        icon: set.icon,
        color: set.color,
        hashtags: set.hashtags,
      });
    } else {
      setEditingSet(null);
      setSetForm({
        name: "",
        category: "",
        description: "",
        icon: "Hash",
        color: "blue",
        hashtags: [],
      });
    }
    setHashtagInput("");
    setShowSetModal(true);
  };

  const saveSet = async () => {
    try {
      setLoading(true);

      if (editingSet) {
        // Update existing set
        const response = await fetch(`/api/instagram/hashtags/${editingSet.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(setForm),
        });

        if (!response.ok) throw new Error("Failed to update hashtag set");
      } else {
        // Create new set
        const response = await fetch("/api/instagram/hashtags", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...setForm, order: hashtagSets.length }),
        });

        if (!response.ok) throw new Error("Failed to create hashtag set");
      }

      setShowSetModal(false);
      await fetchHashtagSets();
    } catch (error) {
      console.error("Error saving hashtag set:", error);
      alert("Failed to save hashtag set. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const deleteSet = async (setId: string) => {
    if (!confirm("Are you sure you want to delete this hashtag set?")) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/instagram/hashtags/${setId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete hashtag set");

      await fetchHashtagSets();
    } catch (error) {
      console.error("Error deleting hashtag set:", error);
      alert("Failed to delete hashtag set. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const addHashtag = () => {
    if (!hashtagInput.trim()) return;

    const hashtag = hashtagInput.trim().startsWith("#")
      ? hashtagInput.trim()
      : `#${hashtagInput.trim()}`;

    if (!setForm.hashtags.includes(hashtag)) {
      setSetForm({ ...setForm, hashtags: [...setForm.hashtags, hashtag] });
    }
    setHashtagInput("");
  };

  const removeHashtag = (index: number) => {
    setSetForm({
      ...setForm,
      hashtags: setForm.hashtags.filter((_, i) => i !== index),
    });
  };

  const categories = ["all", ...Array.from(new Set(hashtagSets.map((set) => set.category)))];

  const filteredSets = hashtagSets.filter((set) => {
    const matchesSearch =
      set.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (set.description && set.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      set.hashtags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory =
      selectedCategory === "all" || set.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const copyToClipboard = (hashtags: string[], setId: string) => {
    const hashtagString = hashtags.join(" ");
    navigator.clipboard.writeText(hashtagString);
    setCopiedId(setId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-blue-600/20 to-purple-600/20 rounded-xl">
              <Hash className="w-7 h-7 text-blue-400" />
            </div>
            Hashtag Bank
          </h2>
          <p className="text-gray-400 text-sm mt-2 ml-1">
            Pre-made hashtag sets for easy copy & paste
          </p>
        </div>
        <div className="flex gap-3">
          {hashtagSets.length > 0 && (
            <button
              onClick={() => openSetModal()}
              className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl transition-all hover:scale-105 text-sm font-medium flex items-center gap-2 shadow-lg shadow-blue-600/30"
            >
              <Plus className="w-4 h-4" />
              Add Set
            </button>
          )}
        </div>
      </div>

      {/* Empty State or Content */}
      {loading && hashtagSets.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="animate-pulse">Loading hashtag sets...</div>
        </div>
      ) : hashtagSets.length === 0 ? (
        <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0f0f0f] border-2 border-[#2a2a2a] rounded-2xl p-16 text-center shadow-2xl">
          <div className="inline-block p-5 bg-gradient-to-br from-blue-600/20 to-purple-600/20 rounded-2xl mb-6">
            <Hash className="w-20 h-20 text-blue-400 animate-pulse" />
          </div>
          <h3 className="text-2xl font-bold text-white mb-3">
            Create Your Hashtag Library
          </h3>
          <p className="text-gray-400 mb-8 max-w-md mx-auto text-lg">
            Start with our 9 pre-made sets or create your own custom collections
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <button
              onClick={initializeTemplate}
              className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl transition-all hover:scale-105 shadow-lg shadow-blue-600/30 font-medium"
            >
              # Use Pre-made Sets
            </button>
            <button
              onClick={() => openSetModal()}
              className="px-8 py-4 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white rounded-xl transition-all hover:scale-105 shadow-lg font-medium"
            >
              ✨ Create Custom Set
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search hashtags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-[#1a1a1a] border-2 border-[#2a2a2a] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-all"
              />
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-5 py-2.5 rounded-xl whitespace-nowrap transition-all font-medium ${
                    selectedCategory === category
                      ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-600/30 scale-105"
                      : "bg-[#1a1a1a] text-gray-400 hover:bg-[#2a2a2a] hover:scale-105"
                  }`}
                >
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Hashtag Sets Grid */}
          {filteredSets.length === 0 ? (
            <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0f0f0f] border-2 border-[#2a2a2a] rounded-2xl p-16 text-center">
              <div className="inline-block p-4 bg-gray-600/10 rounded-2xl mb-4">
                <Hash className="w-16 h-16 text-gray-600" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">No hashtags found</h3>
              <p className="text-gray-400 text-lg">Try a different search or category</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredSets.map((set) => {
                const Icon = ICON_MAP[set.icon] || Hash;
                return (
                  <motion.div
                    key={set.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={{ y: -4 }}
                    className="bg-gradient-to-br from-[#1a1a1a] to-[#0f0f0f] border-2 border-[#2a2a2a] rounded-2xl p-6 hover:border-[#3a3a3a] transition-all hover:shadow-2xl group"
                  >
                    <div className="flex items-start justify-between mb-5">
                      <div className="flex items-start gap-4 flex-1">
                        <div className={`p-4 rounded-xl bg-gradient-to-br from-${set.color}-600/20 to-${set.color}-600/5 shadow-lg group-hover:scale-110 transition-transform`}>
                          <Icon className={`w-7 h-7 text-${set.color}-400`} />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-xl font-bold text-white mb-2">
                            {set.name}
                          </h3>
                          {set.description && (
                            <p className="text-sm text-gray-400 mb-3">{set.description}</p>
                          )}
                          <span className="inline-flex items-center gap-2 text-xs bg-gradient-to-r from-${set.color}-600/20 to-${set.color}-600/10 text-${set.color}-400 px-3 py-1.5 rounded-lg font-medium">
                            <Hash className="w-3 h-3" />
                            {set.hashtags.length} hashtags
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-2">
                        <button
                          onClick={() => copyToClipboard(set.hashtags, set.id)}
                          className={`p-2.5 rounded-xl transition-all hover:scale-110 ${
                            copiedId === set.id
                              ? "bg-green-600/20 text-green-400 shadow-lg shadow-green-600/30"
                              : "bg-[#2a2a2a] hover:bg-[#3a3a3a] text-gray-400"
                          }`}
                          title="Copy all hashtags"
                        >
                          {copiedId === set.id ? (
                            <Check className="w-5 h-5" />
                          ) : (
                            <Copy className="w-5 h-5" />
                          )}
                        </button>
                        <button
                          onClick={() => openSetModal(set)}
                          className="p-2.5 hover:bg-blue-600/20 rounded-xl transition-all hover:scale-110"
                          title="Edit set"
                        >
                          <Edit2 className="w-4 h-4 text-blue-400" />
                        </button>
                        <button
                          onClick={() => deleteSet(set.id)}
                          className="p-2.5 hover:bg-red-600/20 rounded-xl transition-all hover:scale-110"
                          title="Delete set"
                        >
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      </div>
                    </div>

                    {/* Hashtag Preview */}
                    <div className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-xl p-5 max-h-44 overflow-y-auto">
                      <div className="flex flex-wrap gap-2.5">
                        {set.hashtags.slice(0, 15).map((tag, idx) => (
                          <span
                            key={idx}
                            className="text-sm text-blue-400 hover:text-blue-300 cursor-default px-2 py-1 bg-blue-600/10 rounded-lg transition-colors hover:bg-blue-600/20"
                          >
                            {tag}
                          </span>
                        ))}
                        {set.hashtags.length > 15 && (
                          <span className="text-sm text-gray-500 px-2 py-1 bg-[#1a1a1a] rounded-lg font-medium">
                            +{set.hashtags.length - 15} more
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Copy Confirmation */}
                    {copiedId === set.id && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-4 p-3 bg-green-600/10 border border-green-600/30 rounded-xl text-sm text-green-400 flex items-center justify-center gap-2 font-medium"
                      >
                        <Check className="w-4 h-4" />
                        Copied {set.hashtags.length} hashtags to clipboard!
                      </motion.div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Add/Edit Set Modal */}
      {mounted && showSetModal && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", duration: 0.5 }}
            className="bg-gradient-to-br from-[#1a1a1a] to-[#0f0f0f] border-2 border-[#2a2a2a] rounded-2xl p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
          >
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-bold text-white flex items-center gap-3">
                <div className="p-2 bg-blue-600/20 rounded-xl">
                  <Hash className="w-6 h-6 text-blue-400" />
                </div>
                {editingSet ? 'Edit Hashtag Set' : 'Create New Hashtag Set'}
              </h3>
              <button
                onClick={() => setShowSetModal(false)}
                className="p-2.5 hover:bg-[#2a2a2a] rounded-xl transition-all hover:scale-110"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="space-y-5">
              {/* Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-3">
                  Set Name*
                </label>
                <input
                  type="text"
                  value={setForm.name}
                  onChange={(e) => setSetForm({ ...setForm, name: e.target.value })}
                  placeholder="e.g., Daily Lifestyle, Fashion & Style"
                  className="w-full px-5 py-3 bg-[#0f0f0f] border-2 border-[#2a2a2a] rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all text-base"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-3">
                  Category*
                </label>
                <select
                  value={setForm.category}
                  onChange={(e) => setSetForm({ ...setForm, category: e.target.value })}
                  className="w-full px-5 py-3 bg-[#0f0f0f] border-2 border-[#2a2a2a] rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all text-base cursor-pointer"
                >
                  <option value="lifestyle">🌟 Lifestyle</option>
                  <option value="business">💼 Business</option>
                  <option value="creative">🎨 Creative</option>
                  <option value="health">💪 Health & Fitness</option>
                  <option value="food">🍔 Food & Drink</option>
                  <option value="travel">✈️ Travel</option>
                  <option value="custom">✨ Custom</option>
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-3">
                  Description (Optional)
                </label>
                <textarea
                  value={setForm.description}
                  onChange={(e) => setSetForm({ ...setForm, description: e.target.value })}
                  placeholder="Brief description of what this hashtag set is for..."
                  rows={2}
                  className="w-full px-5 py-3 bg-[#0f0f0f] border-2 border-[#2a2a2a] rounded-xl text-white focus:outline-none focus:border-blue-500 resize-none transition-all text-base"
                />
              </div>

              {/* Icon and Color */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-3">
                    Icon
                  </label>
                  <select
                    value={setForm.icon}
                    onChange={(e) => setSetForm({ ...setForm, icon: e.target.value })}
                    className="w-full px-5 py-3 bg-[#0f0f0f] border-2 border-[#2a2a2a] rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all text-base cursor-pointer"
                  >
                    <option value="Coffee">☕ Coffee</option>
                    <option value="Shirt">👕 Fashion</option>
                    <option value="Dumbbell">💪 Fitness</option>
                    <option value="Plane">✈️ Travel</option>
                    <option value="Sparkles">✨ Beauty</option>
                    <option value="Heart">❤️ Lifestyle</option>
                    <option value="Camera">📷 Photo</option>
                    <option value="TrendingUp">📈 Growth</option>
                    <option value="Hash"># Default</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-3">
                    Color
                  </label>
                  <select
                    value={setForm.color}
                    onChange={(e) => setSetForm({ ...setForm, color: e.target.value })}
                    className="w-full px-5 py-3 bg-[#0f0f0f] border-2 border-[#2a2a2a] rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all text-base cursor-pointer"
                  >
                    <option value="amber">🟡 Amber</option>
                    <option value="pink">🩷 Pink</option>
                    <option value="red">🔴 Red</option>
                    <option value="blue">🔵 Blue</option>
                    <option value="purple">🟣 Purple</option>
                    <option value="orange">🟠 Orange</option>
                    <option value="green">🟢 Green</option>
                  </select>
                </div>
              </div>

              {/* Hashtags */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-3">
                  Hashtags
                </label>
                <div className="flex gap-3 mb-4">
                  <input
                    type="text"
                    value={hashtagInput}
                    onChange={(e) => setHashtagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addHashtag();
                      }
                    }}
                    placeholder="Type hashtag and press Enter"
                    className="flex-1 px-5 py-3 bg-[#0f0f0f] border-2 border-[#2a2a2a] rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all text-base"
                  />
                  <button
                    onClick={addHashtag}
                    className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl transition-all hover:scale-105 font-medium shadow-lg shadow-blue-600/30"
                  >
                    Add
                  </button>
                </div>

                {/* Hashtag List */}
                {setForm.hashtags.length > 0 && (
                  <div className="bg-[#0f0f0f] border-2 border-[#2a2a2a] rounded-xl p-5 max-h-52 overflow-y-auto">
                    <div className="flex flex-wrap gap-2.5">
                      {setForm.hashtags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600/20 text-blue-400 rounded-xl text-sm font-medium border border-blue-600/30 group hover:bg-blue-600/30 transition-all"
                        >
                          {tag}
                          <button
                            onClick={() => removeHashtag(idx)}
                            className="hover:text-red-400 transition-colors hover:scale-125"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <p className="text-sm text-gray-500 mt-4 font-medium flex items-center gap-2">
                      <Hash className="w-4 h-4" />
                      {setForm.hashtags.length} hashtag{setForm.hashtags.length !== 1 ? 's' : ''} added
                    </p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-4 pt-6 border-t-2 border-[#2a2a2a]">
                <button
                  onClick={() => setShowSetModal(false)}
                  className="flex-1 px-6 py-3 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white rounded-xl transition-all hover:scale-105 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={saveSet}
                  disabled={!setForm.name || !setForm.category}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed text-white rounded-xl transition-all hover:scale-105 flex items-center justify-center gap-2 font-medium shadow-lg shadow-blue-600/30 disabled:shadow-none"
                >
                  <Save className="w-4 h-4" />
                  {editingSet ? 'Update Set' : 'Create Set'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>,
        document.body
      )}
    </div>
  );
}
