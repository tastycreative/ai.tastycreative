// components/UserDebugComponent.tsx - For testing user isolation
"use client";

import { useState, useEffect } from "react";
import { getUserId, setUserId, clearUserId } from "@/lib/userIdUtils";
import { User, RefreshCw, Trash2, Users } from "lucide-react";

export default function UserDebugComponent() {
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setCurrentUserId(getUserId());
  }, []);

  const handleCreateNewUser = () => {
    clearUserId();
    const newUserId = getUserId(); // This will generate a new ID
    setCurrentUserId(newUserId);
    window.location.reload(); // Refresh to show the new user's data
  };

  const handleSetSpecificUser = (userId: string) => {
    if (userId.trim()) {
      setUserId(userId.trim());
      setCurrentUserId(userId.trim());
      window.location.reload();
    }
  };

  const predefinedUsers = [
    "user-account-1",
    "user-account-2",
    "user-account-3",
    "test-user-alice",
    "test-user-bob",
  ];

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setIsVisible(!isVisible)}
        className="fixed bottom-4 right-4 z-50 p-3 bg-blue-500 hover:bg-blue-600 text-white rounded-full shadow-lg transition-colors"
        title="User Debug Panel"
      >
        <Users className="w-5 h-5" />
      </button>

      {/* Debug Panel */}
      {isVisible && (
        <div className="fixed bottom-20 right-4 z-50 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
              <User className="w-5 h-5" />
              <span>User Debug Panel</span>
            </h3>
            <button
              onClick={() => setIsVisible(false)}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              ✕
            </button>
          </div>

          {/* Current User */}
          <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Current User ID:
            </label>
            <div className="text-xs font-mono text-gray-600 dark:text-gray-400 break-all">
              {currentUserId}
            </div>
          </div>

          {/* Quick Switch Users */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Quick Switch:
            </label>
            <div className="space-y-1">
              {predefinedUsers.map((userId) => (
                <button
                  key={userId}
                  onClick={() => handleSetSpecificUser(userId)}
                  className={`w-full text-left px-3 py-2 text-sm rounded transition-colors ${
                    currentUserId === userId
                      ? "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300"
                      : "bg-gray-100 hover:bg-gray-200 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-300"
                  }`}
                >
                  {userId}
                  {currentUserId === userId && (
                    <span className="ml-2 text-xs">(current)</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Custom User ID */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Set Custom User ID:
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                placeholder="Enter user ID..."
                className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    handleSetSpecificUser((e.target as HTMLInputElement).value);
                  }
                }}
              />
              <button
                onClick={(e) => {
                  const input = (
                    e.target as HTMLButtonElement
                  ).parentElement?.querySelector("input") as HTMLInputElement;
                  if (input) {
                    handleSetSpecificUser(input.value);
                  }
                }}
                className="px-3 py-2 bg-green-500 hover:bg-green-600 text-white text-sm rounded transition-colors"
              >
                Set
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex space-x-2">
            <button
              onClick={handleCreateNewUser}
              className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              <span>New User</span>
            </button>
            <button
              onClick={() => {
                clearUserId();
                setCurrentUserId("");
                window.location.reload();
              }}
              className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 bg-red-500 hover:bg-red-600 text-white text-sm rounded transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span>Clear</span>
            </button>
          </div>

          {/* Info */}
          <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <p className="text-xs text-yellow-700 dark:text-yellow-300">
              <strong>Debug Mode:</strong> This panel allows you to switch
              between different user accounts to test user isolation. Each user
              will have their own LoRA models and generation history.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
