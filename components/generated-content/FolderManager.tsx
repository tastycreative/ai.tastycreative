"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { FolderPlus, FolderOpen, X, Check, AlertCircle } from "lucide-react";

interface FolderManagerProps {
  onFolderCreated?: (folderName: string, folderPrefix: string, parentPrefix?: string | null) => void;
  triggerButton?: React.ReactNode;
  existingFolders?: ExistingFolder[];
  defaultParentPrefix?: string | null;
}

interface ExistingFolder {
  name: string;
  prefix: string;
  parentPrefix?: string | null;
  depth?: number;
  path?: string;
}

const ROOT_PARENT = "__ROOT__";

const sanitizePrefix = (prefix: string) => prefix.replace(/\/+$/, "/");

const computeDepthFromPrefix = (prefix: string) => {
  const parts = sanitizePrefix(prefix).split("/").filter(Boolean);
  return Math.max(parts.length - 2, 1);
};

const normalizeParentKey = (value?: string | null) => {
  if (!value) {
    return ROOT_PARENT;
  }
  return sanitizePrefix(value);
};

export function FolderManager({ onFolderCreated, triggerButton, existingFolders = [], defaultParentPrefix = null }: FolderManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [selectedParent, setSelectedParent] = useState<string>(ROOT_PARENT);

  useEffect(() => {
    if (isOpen) {
      setSelectedParent(normalizeParentKey(defaultParentPrefix));
    }
  }, [defaultParentPrefix, isOpen]);

  const parentOptions = useMemo(() => {
    const sortedFolders = [...existingFolders].sort((a, b) => {
      const pathA = a.path || a.name;
      const pathB = b.path || b.name;
      return pathA.localeCompare(pathB);
    });

    const options = sortedFolders.map((folder) => {
      const depth = folder.depth ?? computeDepthFromPrefix(folder.prefix);
      const indentLevel = Math.max(depth - 1, 0);
      const indent = "\u00A0".repeat(indentLevel * 2);
      const labelPrefix = indentLevel > 0 ? `${indent}↳ ` : "";
      return {
        label: `${labelPrefix}${folder.name}`,
        value: sanitizePrefix(folder.prefix),
      };
    });

    return [
      { label: "Top level (My Workspace)", value: ROOT_PARENT },
      ...options,
    ];
  }, [existingFolders]);

  // Validate folder name
  const validateFolderName = (name: string, parentKey: string): string | null => {
    if (!name.trim()) {
      return "Folder name cannot be empty";
    }
    if (name.length < 2) {
      return "Folder name must be at least 2 characters";
    }
    if (name.length > 50) {
      return "Folder name must be less than 50 characters";
    }
    // Allow letters, numbers, spaces, hyphens, underscores
    if (!/^[a-zA-Z0-9\s\-_]+$/.test(name)) {
      return "Folder name can only contain letters, numbers, spaces, hyphens, and underscores";
    }
    const normalizedName = name.trim().toLowerCase();
    const duplicate = existingFolders.some((existing) => {
      const siblingParent = normalizeParentKey(existing.parentPrefix);
      return siblingParent === parentKey && existing.name.trim().toLowerCase() === normalizedName;
    });
    if (duplicate) {
      return "A folder with this name already exists in the selected location.";
    }
    return null;
  };

  const handleCreateFolder = async () => {
    setError(null);
    setSuccess(false);

    // Validate folder name
    const normalizedParentKey = selectedParent;
    const validationError = validateFolderName(folderName, normalizedParentKey);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsCreating(true);

    try {
      // Create folder via API
      const response = await fetch("/api/s3/folders/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          folderName: folderName.trim(),
          parentPrefix: normalizedParentKey === ROOT_PARENT ? null : normalizedParentKey,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create folder");
      }

      console.log("✅ Folder created:", data);

      // Show success
      setSuccess(true);
      
      // Notify parent component
      if (onFolderCreated) {
        onFolderCreated(data.folderName, data.folderPrefix, data.parentPrefix ?? null);
      }

      // Reset and close after a brief delay
      setTimeout(() => {
        setFolderName("");
        setSuccess(false);
        setIsOpen(false);
      }, 1500);

    } catch (err) {
      console.error("❌ Error creating folder:", err);
      setError(err instanceof Error ? err.message : "Failed to create folder");
    } finally {
      setIsCreating(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!isCreating) {
      setIsOpen(open);
      if (!open) {
        // Reset state when closing
        setFolderName("");
        setError(null);
        setSuccess(false);
        setSelectedParent(normalizeParentKey(defaultParentPrefix));
      }
    }
  };

  return (
    <>
      {/* Trigger Button */}
      {triggerButton ? (
        <div onClick={() => setIsOpen(true)}>{triggerButton}</div>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <FolderPlus className="w-4 h-4" />
          New Folder
        </button>
      )}

      {/* Create Folder Dialog Modal */}
      {isOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center isolate">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm z-[9998]"
            onClick={() => !isCreating && handleOpenChange(false)}
          />
          
          {/* Modal */}
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4 z-[9999]">
            {/* Header */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Create New Folder
                </h2>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Create a new folder in your S3 storage to organize your generated content.
              </p>
            </div>

            {/* Form */}
            <div className="space-y-4 py-4">
              {/* Folder Name Input */}
              <div className="space-y-2">
                <label htmlFor="folderName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Folder Name
                </label>
                <input
                  id="folderName"
                  type="text"
                  placeholder="e.g., Client Projects, Portfolio, Drafts"
                  value={folderName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFolderName(e.target.value)}
                  disabled={isCreating || success}
                  onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                    if (e.key === "Enter" && !isCreating && !success) {
                      handleCreateFolder();
                    }
                  }}
                  autoFocus
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Letters, numbers, spaces, hyphens, and underscores are allowed.
                </p>
              </div>

              <div className="space-y-2">
                <label htmlFor="parentFolder" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Parent Folder
                </label>
                <select
                  id="parentFolder"
                  value={selectedParent}
                  onChange={(e) => setSelectedParent(e.target.value)}
                  disabled={isCreating || success || parentOptions.length <= 1}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {parentOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Choose where this folder should live. Nested folders help keep large projects organized.
                </p>
              </div>

              {/* Error Alert */}
              {error && (
                <div className="flex items-start gap-2 p-4 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
                  <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                </div>
              )}

              {/* Success Alert */}
              {success && (
                <div className="flex items-start gap-2 p-4 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
                  <Check className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-green-700 dark:text-green-300">
                    Folder created successfully!
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={() => handleOpenChange(false)}
                disabled={isCreating}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateFolder}
                disabled={isCreating || success || !folderName.trim()}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                {isCreating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Creating...
                  </>
                ) : success ? (
                  <>
                    <Check className="w-4 h-4" />
                    Created!
                  </>
                ) : (
                  <>
                    <FolderPlus className="w-4 h-4" />
                    Create Folder
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
