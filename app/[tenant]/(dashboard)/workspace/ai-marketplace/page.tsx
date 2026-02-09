"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { ShoppingBag, Search, Filter, X, Check } from "lucide-react";
import { createPortal } from "react-dom";

interface Model {
  id: string;
  name: string;
  price: number;
  status: "available" | "sold" | "reserved";
  imageUrl: string;
  category: string;
  gallery: string[];
  description: string;
  included: string[];
  usedFor: string[];
}

export default function AIMarketplacePage() {
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fetch models on mount
  useEffect(() => {
    fetchModels();
  }, []);

  const fetchModels = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/marketplace');
      if (response.ok) {
        const data = await response.json();
        setModels(data);
      }
    } catch (error) {
      console.error('Error fetching models:', error);
    } finally {
      setLoading(false);
    }
  };

  const openModal = (model: Model) => {
    setSelectedModel(model);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setTimeout(() => setSelectedModel(null), 300);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "available":
        return "bg-green-500";
      case "sold":
        return "bg-red-500";
      case "reserved":
        return "bg-yellow-500";
      default:
        return "bg-gray-500";
    }
  };

  const getStatusText = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const filteredModels = models.filter((model) => {
    const matchesSearch = model.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === "all" || model.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center space-x-4 mb-8">
          <div className="p-4 bg-gradient-to-br from-[#5DC3F8] to-[#EC67A1] rounded-2xl shadow-xl">
            <ShoppingBag className="w-10 h-10 text-white" />
          </div>
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-[#5DC3F8] to-[#EC67A1] bg-clip-text text-transparent">
              AI Marketplace
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1.5 text-lg">
              Discover premium AI models for your projects
            </p>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search Bar */}
          <div className="flex-1 relative group">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-[#5DC3F8] transition-colors" />
            <input
              type="text"
              placeholder="Search for AI models..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 bg-white dark:bg-gray-800 border-2 border-[#5DC3F8]/30 dark:border-[#5DC3F8]/30 rounded-xl focus:outline-none focus:border-[#5DC3F8] dark:focus:border-[#5DC3F8] text-gray-900 dark:text-white placeholder:text-gray-400 transition-all shadow-sm hover:shadow-md"
            />
          </div>

          {/* Category Filter */}
          <div className="relative group">
            <Filter className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="pl-12 pr-10 py-3.5 bg-white dark:bg-gray-800 border-2 border-[#5DC3F8]/30 dark:border-[#5DC3F8]/30 rounded-xl focus:outline-none focus:border-[#5DC3F8] dark:focus:border-[#5DC3F8] text-gray-900 dark:text-white appearance-none cursor-pointer min-w-[200px] transition-all shadow-sm hover:shadow-md"
            >
              <option value="all">All Categories</option>
              <option value="Standard">Standard</option>
              <option value="Premium">Premium</option>
              <option value="Luxury">Luxury</option>
            </select>
            <div className="absolute right-4 top-1/2 transform -translate-y-1/2 pointer-events-none">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#5DC3F8]"></div>
        </div>
      ) : filteredModels.length === 0 ? (
        <div className="text-center py-20">
          <ShoppingBag className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            {searchQuery || selectedCategory !== "all"
              ? "No models found matching your criteria"
              : "No models available yet"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredModels.map((model) => (
          <div
            key={model.id}
            onClick={() => openModal(model)}
            className="group bg-white dark:bg-gray-800/50 dark:backdrop-blur-sm rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 border border-gray-100 dark:border-gray-700/50 cursor-pointer backdrop-blur-sm"
          >
            {/* Image Container */}
            <div className="relative h-72 w-full overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900">
              {model.imageUrl && (
                <Image
                  src={model.imageUrl}
                  alt={model.name}
                  fill
                  className="object-contain p-4 group-hover:scale-105 transition-transform duration-700"
                />
              )}
              {/* Floating Status Badge */}
              <div className="absolute top-4 right-4">
                <div
                  className={`${getStatusColor(
                    model.status
                  )} px-4 py-1.5 rounded-full shadow-lg backdrop-blur-sm bg-opacity-90`}
                >
                  <span className="text-xs font-bold text-white uppercase tracking-wide">
                    {getStatusText(model.status)}
                  </span>
                </div>
              </div>
            </div>

            {/* Info Container */}
            <div className="p-6">
              {/* Model Name */}
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3 line-clamp-2 group-hover:text-[#5DC3F8] transition-colors">
                {model.name}
              </h3>

              {/* Price */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Price</p>
                  <span className="text-3xl font-bold bg-gradient-to-r from-[#5DC3F8] to-[#EC67A1] bg-clip-text text-transparent">
                    ${model.price}
                  </span>
                </div>
              </div>

              {/* View Details Button */}
              <button
                className="w-full py-3.5 rounded-xl font-semibold transition-all duration-300 bg-gradient-to-r from-[#5DC3F8] to-[#EC67A1] hover:from-[#5DC3F8] hover:to-[#E1518E] text-white shadow-lg hover:shadow-xl group-hover:scale-105 active:scale-95"
              >
                View Details
              </button>
            </div>
          </div>
        ))}
        </div>
      )}

      {/* Model Details Modal */}
      {isModalOpen &&
        selectedModel &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn"
            onClick={closeModal}
          >
            <div
              className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto animate-scaleIn border border-gray-200 dark:border-gray-700 [&::-webkit-scrollbar]:w-3 [&::-webkit-scrollbar-track]:bg-gray-100 dark:[&::-webkit-scrollbar-track]:bg-gray-900 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gradient-to-b [&::-webkit-scrollbar-thumb]:from-[#5DC3F8] [&::-webkit-scrollbar-thumb]:to-[#EC67A1] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border-2 [&::-webkit-scrollbar-thumb]:border-gray-100 dark:[&::-webkit-scrollbar-thumb]:border-gray-900 hover:[&::-webkit-scrollbar-thumb]:from-[#5DC3F8] hover:[&::-webkit-scrollbar-thumb]:to-[#E1518E]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="sticky top-0 bg-gradient-to-r from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 border-b border-gray-200 dark:border-gray-700 p-8 flex items-center justify-between z-10 backdrop-blur-sm">
                <div>
                  <h2 className="text-4xl font-bold bg-gradient-to-r from-[#5DC3F8] to-[#EC67A1] bg-clip-text text-transparent">
                    {selectedModel.name}
                  </h2>
                  <p className="text-gray-500 dark:text-gray-400 mt-2 text-lg">
                    {selectedModel.description}
                  </p>
                </div>
                <button
                  onClick={closeModal}
                  className="p-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-all duration-200 hover:scale-110 active:scale-95"
                >
                  <X className="w-6 h-6 text-gray-500 dark:text-gray-400" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-8 space-y-10">
                {/* Image Gallery */}
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center">
                    <div className="w-1.5 h-8 bg-gradient-to-b from-[#5DC3F8] to-[#EC67A1] rounded-full mr-3"></div>
                    Gallery
                  </h3>
                  <div className="grid grid-cols-2 gap-6">
                    {selectedModel.gallery.filter(img => img && img.trim() !== '').map((img, idx) => (
                      <div
                        key={idx}
                        className="relative h-72 rounded-2xl overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border border-gray-200 dark:border-gray-700 group"
                      >
                        <Image
                          src={img}
                          alt={`${selectedModel.name} ${idx + 1}`}
                          fill
                          className="object-contain p-4 group-hover:scale-110 transition-transform duration-700"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* What's Included */}
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center">
                    <div className="w-1.5 h-8 bg-gradient-to-b from-green-500 to-emerald-500 rounded-full mr-3"></div>
                    What's Included
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedModel.included.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-start space-x-3 p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl border border-green-200 dark:border-green-700/30 hover:shadow-md transition-all duration-300"
                      >
                        <div className="flex-shrink-0 mt-0.5">
                          <div className="p-1 bg-green-500 rounded-full">
                            <Check className="w-4 h-4 text-white" />
                          </div>
                        </div>
                        <span className="text-gray-700 dark:text-gray-300 font-medium">
                          {item}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Used For */}
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center">
                    <div className="w-1.5 h-8 bg-gradient-to-b from-[#5DC3F8] to-[#EC67A1] rounded-full mr-3"></div>
                    Used For
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedModel.usedFor.map((use, idx) => (
                      <div
                        key={idx}
                        className="flex items-start space-x-3 p-4 bg-gradient-to-br from-[#5DC3F8]/10 to-[#EC67A1]/10 dark:from-[#5DC3F8]/20 dark:to-[#EC67A1]/20 rounded-xl border border-[#5DC3F8]/30 dark:border-[#5DC3F8]/30 hover:shadow-md transition-all duration-300"
                      >
                        <div className="flex-shrink-0 mt-0.5">
                          <div className="p-1 bg-[#5DC3F8] rounded-full">
                            <Check className="w-4 h-4 text-white" />
                          </div>
                        </div>
                        <span className="text-gray-700 dark:text-gray-300 font-medium">
                          {use}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Price and Purchase */}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-8">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold mb-2">
                        Price
                      </p>
                      <p className="text-5xl font-bold bg-gradient-to-r from-[#5DC3F8] to-[#EC67A1] bg-clip-text text-transparent">
                        ${selectedModel.price}
                      </p>
                    </div>
                    <div
                      className={`${getStatusColor(
                        selectedModel.status
                      )} px-6 py-3 rounded-full shadow-lg`}
                    >
                      <span className="text-sm font-bold text-white uppercase tracking-wide">
                        {getStatusText(selectedModel.status)}
                      </span>
                    </div>
                  </div>
                  <button
                    disabled={selectedModel.status !== "available"}
                    className={`w-full py-5 rounded-xl font-bold text-lg transition-all duration-300 ${
                      selectedModel.status === "available"
                        ? "bg-gradient-to-r from-[#5DC3F8] to-[#EC67A1] hover:from-[#5DC3F8] hover:to-[#E1518E] text-white shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95"
                        : "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-500 cursor-not-allowed"
                    }`}
                  >
                    {selectedModel.status === "available"
                      ? "🚀 Purchase Now"
                      : selectedModel.status === "sold"
                      ? "❌ Sold Out"
                      : "⏳ Reserved"}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
