"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useUser } from "@clerk/nextjs";
import {
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronRight,
  Lightbulb,
  Video,
  Scissors,
  Eye,
  CheckCheck,
  Calendar,
  Send,
  ListChecks,
  Plus,
  Edit2,
  Trash2,
  X,
  Save,
  Sparkles,
} from "lucide-react";

interface WorkflowChecklistViewProps {
  profileId?: string | null;
}

interface ChecklistItem {
  name: string;
  instagramUsername?: string;
  isDefault: boolean;
}

interface ChecklistItem {
  id: string;
  text: string;
  order: number;
  checked: boolean;
}

interface WorkflowPhase {
  id: string;
  name: string;
  description?: string;
  icon: string;
  color: string;
  order: number;
  items: ChecklistItem[];
}

const ICON_MAP: Record<string, any> = {
  Lightbulb,
  Video,
  Scissors,
  Eye,
  CheckCheck,
  Calendar,
  Send,
  Circle,
  ListChecks,
};

export default function WorkflowChecklistView({ profileId }: WorkflowChecklistViewProps = {}) {
  const { user, isLoaded } = useUser();
  const [workflow, setWorkflow] = useState<WorkflowPhase[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedPhases, setExpandedPhases] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);
  
  // Modals
  const [showPhaseModal, setShowPhaseModal] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingPhase, setEditingPhase] = useState<WorkflowPhase | null>(null);
  const [selectedPhaseForItem, setSelectedPhaseForItem] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<ChecklistItem | null>(null);

  // Form data
  const [phaseForm, setPhaseForm] = useState({
    name: "",
    description: "",
    icon: "Circle",
    color: "blue",
  });
  const [itemForm, setItemForm] = useState({ text: "" });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isLoaded || !user) return;
    fetchWorkflow();
  }, [isLoaded, user, profileId]);

  const fetchWorkflow = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (profileId && profileId !== "all") {
        params.append("profileId", profileId);
      }
      const response = await fetch(`/api/instagram/workflow?${params}`);
      const data = await response.json();

      if (data.phases && data.phases.length > 0) {
        setWorkflow(data.phases);
        setExpandedPhases([data.phases[0].id]);
      }
    } catch (error) {
      console.error("Error fetching workflow:", error);
    } finally {
      setLoading(false);
    }
  };

  const initializeTemplate = async () => {
    if (!confirm("This will create the default 7-phase workflow template. Continue?")) return;

    try {
      setLoading(true);
      const response = await fetch("/api/instagram/workflow/init-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId }),
      });

      if (!response.ok) {
        throw new Error("Failed to initialize template");
      }

      await fetchWorkflow();
    } catch (error) {
      console.error("Error initializing template:", error);
      alert("Failed to initialize template. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const togglePhase = (phaseId: string) => {
    setExpandedPhases((prev) =>
      prev.includes(phaseId)
        ? prev.filter((id) => id !== phaseId)
        : [...prev, phaseId]
    );
  };

  const toggleItem = async (item: ChecklistItem) => {
    try {
      const response = await fetch(`/api/instagram/workflow/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checked: !item.checked }),
      });

      if (!response.ok) throw new Error("Failed to update item");

      setWorkflow((prev) =>
        prev.map((phase) => ({
          ...phase,
          items: phase.items.map((i) =>
            i.id === item.id ? { ...i, checked: !i.checked } : i
          ),
        }))
      );
    } catch (error) {
      console.error("Error toggling item:", error);
    }
  };

  const openPhaseModal = (phase?: WorkflowPhase) => {
    if (phase) {
      setEditingPhase(phase);
      setPhaseForm({
        name: phase.name,
        description: phase.description || "",
        icon: phase.icon,
        color: phase.color,
      });
    } else {
      setEditingPhase(null);
      setPhaseForm({ name: "", description: "", icon: "Circle", color: "blue" });
    }
    setShowPhaseModal(true);
  };

  const openItemModal = (phaseId: string, item?: ChecklistItem) => {
    setSelectedPhaseForItem(phaseId);
    if (item) {
      setEditingItem(item);
      setItemForm({ text: item.text });
    } else {
      setEditingItem(null);
      setItemForm({ text: "" });
    }
    setShowItemModal(true);
  };

  const savePhase = async () => {
    try {
      setLoading(true);

      if (editingPhase) {
        // Update existing phase
        const response = await fetch(`/api/instagram/workflow/${editingPhase.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(phaseForm),
        });

        if (!response.ok) throw new Error("Failed to update phase");
      } else {
        // Create new phase
        const response = await fetch("/api/instagram/workflow", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...phaseForm, order: workflow.length, profileId: profileId || "" }),
        });

        if (!response.ok) throw new Error("Failed to create phase");
      }

      setShowPhaseModal(false);
      await fetchWorkflow();
    } catch (error) {
      console.error("Error saving phase:", error);
      alert("Failed to save phase. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const deletePhase = async (phaseId: string) => {
    if (!confirm("Are you sure you want to delete this phase? All items will be deleted.")) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/instagram/workflow/${phaseId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete phase");

      await fetchWorkflow();
    } catch (error) {
      console.error("Error deleting phase:", error);
      alert("Failed to delete phase. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const saveItem = async () => {
    if (!selectedPhaseForItem) return;

    try {
      setLoading(true);

      if (editingItem) {
        // Update existing item
        const response = await fetch(`/api/instagram/workflow/items/${editingItem.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: itemForm.text }),
        });

        if (!response.ok) throw new Error("Failed to update item");
      } else {
        // Create new item
        const phase = workflow.find((p) => p.id === selectedPhaseForItem);
        const response = await fetch("/api/instagram/workflow/items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phaseId: selectedPhaseForItem,
            text: itemForm.text,
            order: phase?.items.length || 0,
          }),
        });

        if (!response.ok) throw new Error("Failed to create item");
      }

      setShowItemModal(false);
      await fetchWorkflow();
    } catch (error) {
      console.error("Error saving item:", error);
      alert("Failed to save item. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const deleteItem = async (itemId: string) => {
    if (!confirm("Are you sure you want to delete this item?")) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/instagram/workflow/items/${itemId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete item");

      await fetchWorkflow();
    } catch (error) {
      console.error("Error deleting item:", error);
      alert("Failed to delete item. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const resetChecklist = async () => {
    if (!confirm("Reset all checkboxes? (This won't delete your custom checklist)")) return;

    try {
      setLoading(true);
      // Uncheck all items
      for (const phase of workflow) {
        for (const item of phase.items.filter((i) => i.checked)) {
          await fetch(`/api/instagram/workflow/items/${item.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ checked: false }),
          });
        }
      }
      await fetchWorkflow();
    } catch (error) {
      console.error("Error resetting checklist:", error);
    } finally {
      setLoading(false);
    }
  };

  const getPhaseProgress = (phase: WorkflowPhase) => {
    const completed = phase.items.filter((item) => item.checked).length;
    const total = phase.items.length;
    return { completed, total, percentage: total > 0 ? (completed / total) * 100 : 0 };
  };

  const totalProgress = workflow.reduce(
    (acc, phase) => {
      const progress = getPhaseProgress(phase);
      return {
        completed: acc.completed + progress.completed,
        total: acc.total + progress.total,
      };
    },
    { completed: 0, total: 0 }
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-green-600/20 to-blue-600/20 rounded-xl">
              <ListChecks className="w-7 h-7 text-green-400" />
            </div>
            Workflow Checklist
          </h2>
          <p className="text-gray-400 text-sm mt-2 ml-1">
            Create and customize your content creation process
          </p>
        </div>
        <div className="flex gap-3">
          {workflow.length > 0 && (
            <>
              <button
                onClick={resetChecklist}
                className="px-5 py-2.5 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white rounded-xl transition-all hover:scale-105 text-sm font-medium shadow-lg"
              >
                Reset Checks
              </button>
              <button
                onClick={() => openPhaseModal()}
                className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl transition-all hover:scale-105 text-sm font-medium flex items-center gap-2 shadow-lg shadow-blue-600/30"
              >
                <Plus className="w-4 h-4" />
                Add Phase
              </button>
            </>
          )}
        </div>
      </div>

      {/* Empty State or Content */}
      {loading && workflow.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="animate-pulse">Loading workflow...</div>
        </div>
      ) : workflow.length === 0 ? (
        <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0f0f0f] border-2 border-[#2a2a2a] rounded-2xl p-16 text-center shadow-2xl">
          <div className="inline-block p-5 bg-gradient-to-br from-blue-600/20 to-purple-600/20 rounded-2xl mb-6">
            <Sparkles className="w-20 h-20 text-blue-400 animate-pulse" />
          </div>
          <h3 className="text-2xl font-bold text-white mb-3">
            Create Your Custom Workflow
          </h3>
          <p className="text-gray-400 mb-8 max-w-md mx-auto text-lg">
            Start with our proven 7-phase template or build your own from scratch
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <button
              onClick={initializeTemplate}
              className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl transition-all hover:scale-105 shadow-lg shadow-blue-600/30 font-medium"
            >
              ✨ Use 7-Phase Template
            </button>
            <button
              onClick={() => openPhaseModal()}
              className="px-8 py-4 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white rounded-xl transition-all hover:scale-105 shadow-lg font-medium"
            >
              🎨 Start From Scratch
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Overall Progress */}
          {totalProgress.total > 0 && (
            <div className="bg-gradient-to-br from-green-600/10 via-blue-600/10 to-purple-600/10 border-2 border-green-600/20 rounded-2xl p-8 shadow-xl relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-green-600/5 to-blue-600/5 animate-pulse" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                      Overall Progress
                    </h3>
                    <p className="text-sm text-gray-400">
                      {totalProgress.completed} of {totalProgress.total} tasks completed
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-4xl font-bold bg-gradient-to-r from-green-400 to-blue-400 bg-clip-text text-transparent">
                      {Math.round((totalProgress.completed / totalProgress.total) * 100)}%
                    </div>
                    {totalProgress.completed === totalProgress.total && (
                      <div className="text-xs text-green-400 font-medium mt-1">🎉 Complete!</div>
                    )}
                  </div>
                </div>
                <div className="w-full bg-[#1a1a1a] rounded-full h-4 overflow-hidden shadow-inner">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{
                      width: `${(totalProgress.completed / totalProgress.total) * 100}%`,
                    }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="h-full bg-gradient-to-r from-green-500 via-blue-500 to-purple-500 shadow-lg relative"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                  </motion.div>
                </div>
              </div>
            </div>
          )}

          {/* Workflow Phases */}
          <div className="space-y-4">
            {workflow.map((phase, index) => {
              const Icon = ICON_MAP[phase.icon] || Circle;
              const progress = getPhaseProgress(phase);
              const isExpanded = expandedPhases.includes(phase.id);
              const isCompleted = progress.total > 0 && progress.completed === progress.total;

              return (
                <motion.div
                  key={phase.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`bg-gradient-to-br from-[#1a1a1a] to-[#0f0f0f] border-2 rounded-2xl overflow-hidden transition-all hover:shadow-2xl ${
                    isCompleted
                      ? "border-green-600/50 shadow-lg shadow-green-600/20"
                      : "border-[#2a2a2a] hover:border-[#3a3a3a]"
                  }`}
                >
                  {/* Phase Header */}
                  <div className="p-6 flex items-center justify-between bg-gradient-to-r from-transparent to-[#ffffff05]">
                    <button
                      onClick={() => togglePhase(phase.id)}
                      className="flex-1 flex items-center gap-5"
                    >
                      <div className={`p-4 rounded-xl bg-gradient-to-br from-${phase.color}-600/20 to-${phase.color}-600/5 shadow-lg relative group-hover:scale-110 transition-transform`}>
                        <Icon className={`w-7 h-7 text-${phase.color}-400`} />
                        {isCompleted && (
                          <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                            <CheckCircle2 className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </div>
                      <div className="text-left flex-1">
                        <h3 className="text-xl font-bold text-white flex items-center gap-3 mb-1">
                          {phase.name}
                        </h3>
                        {phase.description && (
                          <p className="text-sm text-gray-400 mb-3">{phase.description}</p>
                        )}
                        <div className="flex items-center gap-4">
                          <div className="text-sm font-medium text-gray-400">
                            {progress.completed} / {progress.total} tasks
                          </div>
                          {progress.total > 0 && (
                            <div className="flex-1 max-w-xs bg-[#1a1a1a] rounded-full h-2.5 overflow-hidden shadow-inner">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${progress.percentage}%` }}
                                transition={{ duration: 0.5 }}
                                className={`h-full rounded-full bg-gradient-to-r from-${phase.color}-500 to-${phase.color}-400 shadow-lg`}
                              />
                            </div>
                          )}
                          <div className={`text-sm font-bold text-${phase.color}-400`}>
                            {Math.round(progress.percentage)}%
                          </div>
                        </div>
                      </div>
                      <div className="ml-4">
                        {isExpanded ? (
                          <ChevronDown className="w-6 h-6 text-gray-400 transition-transform" />
                        ) : (
                          <ChevronRight className="w-6 h-6 text-gray-400 transition-transform" />
                        )}
                      </div>
                    </button>

                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => openPhaseModal(phase)}
                        className="p-2.5 hover:bg-[#2a2a2a] rounded-xl transition-all hover:scale-110"
                        title="Edit phase"
                      >
                        <Edit2 className="w-4 h-4 text-gray-400 hover:text-blue-400 transition-colors" />
                      </button>
                      <button
                        onClick={() => deletePhase(phase.id)}
                        className="p-2.5 hover:bg-red-600/20 rounded-xl transition-all hover:scale-110"
                        title="Delete phase"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  </div>

                  {/* Phase Checklist */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="border-t border-[#2a2a2a] p-6 pt-5 bg-[#0f0f0f]/50"
                      >
                        <div className="space-y-2">
                          {phase.items.map((item, itemIndex) => (
                            <motion.div
                              key={item.id}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: itemIndex * 0.05 }}
                              className={`flex items-start gap-4 p-4 rounded-xl transition-all group relative ${
                                item.checked
                                  ? "bg-green-600/5 hover:bg-green-600/10"
                                  : "bg-[#1a1a1a]/50 hover:bg-[#2a2a2a]"
                              }`}
                            >
                              <button
                                onClick={() => toggleItem(item)}
                                className="flex-1 flex items-start gap-4"
                              >
                                <div className="relative mt-0.5">
                                  {item.checked ? (
                                    <motion.div
                                      initial={{ scale: 0 }}
                                      animate={{ scale: 1 }}
                                      className="w-6 h-6 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center shadow-lg shadow-green-600/30"
                                    >
                                      <CheckCircle2 className="w-4 h-4 text-white" />
                                    </motion.div>
                                  ) : (
                                    <div className="w-6 h-6 rounded-full border-2 border-gray-600 group-hover:border-gray-400 transition-all flex items-center justify-center">
                                      <Circle className="w-3 h-3 text-gray-600 group-hover:text-gray-400" />
                                    </div>
                                  )}
                                </div>
                                <span
                                  className={`flex-1 text-left text-base leading-relaxed transition-all ${
                                    item.checked
                                      ? "text-gray-500 line-through"
                                      : "text-gray-200 group-hover:text-white"
                                  }`}
                                >
                                  {item.text}
                                </span>
                              </button>
                              <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-all">
                                <button
                                  onClick={() => openItemModal(phase.id, item)}
                                  className="p-2 hover:bg-blue-600/20 rounded-lg transition-all hover:scale-110"
                                  title="Edit item"
                                >
                                  <Edit2 className="w-4 h-4 text-blue-400" />
                                </button>
                                <button
                                  onClick={() => deleteItem(item.id)}
                                  className="p-2 hover:bg-red-600/20 rounded-lg transition-all hover:scale-110"
                                  title="Delete item"
                                >
                                  <Trash2 className="w-4 h-4 text-red-400" />
                                </button>
                              </div>
                            </motion.div>
                          ))}

                          {/* Add Item Button */}
                          <button
                            onClick={() => openItemModal(phase.id)}
                            className="w-full p-4 border-2 border-dashed border-[#3a3a3a] hover:border-blue-600/50 rounded-xl text-gray-400 hover:text-blue-400 transition-all flex items-center justify-center gap-2 group hover:bg-blue-600/5"
                          >
                            <Plus className="w-5 h-5 group-hover:scale-110 transition-transform" />
                            <span className="font-medium">Add Task</span>
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        </>
      )}

      {/* Phase Modal */}
      {showPhaseModal && mounted && createPortal(
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", duration: 0.5 }}
            className="bg-gradient-to-br from-[#1a1a1a] to-[#0f0f0f] border-2 border-[#2a2a2a] rounded-2xl p-8 max-w-md w-full shadow-2xl"
          >
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-bold text-white flex items-center gap-3">
                <div className="p-2 bg-blue-600/20 rounded-xl">
                  <ListChecks className="w-6 h-6 text-blue-400" />
                </div>
                {editingPhase ? "Edit Phase" : "Add Phase"}
              </h3>
              <button
                onClick={() => setShowPhaseModal(false)}
                className="p-2.5 hover:bg-[#2a2a2a] rounded-xl transition-all hover:scale-110"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-3">
                  Phase Name *
                </label>
                <input
                  type="text"
                  value={phaseForm.name}
                  onChange={(e) => setPhaseForm({ ...phaseForm, name: e.target.value })}
                  placeholder="e.g., Idea & Planning"
                  className="w-full px-5 py-3 bg-[#0f0f0f] border-2 border-[#2a2a2a] rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all text-base"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-3">
                  Description
                </label>
                <textarea
                  value={phaseForm.description}
                  onChange={(e) =>
                    setPhaseForm({ ...phaseForm, description: e.target.value })
                  }
                  rows={2}
                  placeholder="Brief description of this phase"
                  className="w-full px-5 py-3 bg-[#0f0f0f] border-2 border-[#2a2a2a] rounded-xl text-white focus:outline-none focus:border-blue-500 resize-none transition-all text-base"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-3">
                    Icon
                  </label>
                  <select
                    value={phaseForm.icon}
                    onChange={(e) => setPhaseForm({ ...phaseForm, icon: e.target.value })}
                    className="w-full px-5 py-3 bg-[#0f0f0f] border-2 border-[#2a2a2a] rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all text-base cursor-pointer"
                  >
                    <option value="Lightbulb">💡 Lightbulb</option>
                    <option value="Video">🎥 Video</option>
                    <option value="Scissors">✂️ Scissors</option>
                    <option value="Eye">👁️ Eye</option>
                    <option value="CheckCheck">✅ CheckCheck</option>
                    <option value="Calendar">📅 Calendar</option>
                    <option value="Send">📤 Send</option>
                    <option value="Circle">⭕ Circle</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-3">
                    Color
                  </label>
                  <select
                    value={phaseForm.color}
                    onChange={(e) => setPhaseForm({ ...phaseForm, color: e.target.value })}
                    className="w-full px-5 py-3 bg-[#0f0f0f] border-2 border-[#2a2a2a] rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all text-base cursor-pointer"
                  >
                    <option value="blue">🔵 Blue</option>
                    <option value="green">🟢 Green</option>
                    <option value="purple">🟣 Purple</option>
                    <option value="red">🔴 Red</option>
                    <option value="yellow">🟡 Yellow</option>
                    <option value="pink">🩷 Pink</option>
                    <option value="orange">🟠 Orange</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex gap-4 mt-8">
              <button
                onClick={() => setShowPhaseModal(false)}
                className="flex-1 px-6 py-3 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white rounded-xl transition-all hover:scale-105 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={savePhase}
                disabled={!phaseForm.name || loading}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl transition-all hover:scale-105 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-lg shadow-blue-600/30"
              >
                <Save className="w-4 h-4" />
                {loading ? "Saving..." : "Save Phase"}
              </button>
            </div>
          </motion.div>
        </div>,
        document.body
      )}

      {/* Item Modal */}
      {showItemModal && mounted && createPortal(
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", duration: 0.5 }}
            className="bg-gradient-to-br from-[#1a1a1a] to-[#0f0f0f] border-2 border-[#2a2a2a] rounded-2xl p-8 max-w-md w-full shadow-2xl"
          >
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-bold text-white flex items-center gap-3">
                <div className="p-2 bg-green-600/20 rounded-xl">
                  <CheckCheck className="w-6 h-6 text-green-400" />
                </div>
                {editingItem ? "Edit Task" : "Add Task"}
              </h3>
              <button
                onClick={() => setShowItemModal(false)}
                className="p-2.5 hover:bg-[#2a2a2a] rounded-xl transition-all hover:scale-110"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-3">
                  Task Description *
                </label>
                <textarea
                  value={itemForm.text}
                  onChange={(e) => setItemForm({ ...itemForm, text: e.target.value })}
                  rows={4}
                  placeholder="What needs to be done?"
                  className="w-full px-5 py-3 bg-[#0f0f0f] border-2 border-[#2a2a2a] rounded-xl text-white focus:outline-none focus:border-green-500 resize-none transition-all text-base"
                />
              </div>
            </div>

            <div className="flex gap-4 mt-8">
              <button
                onClick={() => setShowItemModal(false)}
                className="flex-1 px-6 py-3 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white rounded-xl transition-all hover:scale-105 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={saveItem}
                disabled={!itemForm.text || loading}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-xl transition-all hover:scale-105 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-lg shadow-green-600/30"
              >
                <Save className="w-4 h-4" />
                {loading ? "Saving..." : "Save Task"}
              </button>
            </div>
          </motion.div>
        </div>,
        document.body
      )}
    </div>
  );
}
