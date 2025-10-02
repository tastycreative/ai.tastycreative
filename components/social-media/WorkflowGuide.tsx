'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Info } from 'lucide-react';

type UserRole = 'ADMIN' | 'MANAGER' | 'CONTENT_CREATOR' | 'USER';

interface WorkflowGuideProps {
  userRole: UserRole;
}

export default function WorkflowGuide({ userRole }: WorkflowGuideProps) {
  const [isOpen, setIsOpen] = useState(false);

  const rolePermissions = {
    ADMIN: {
      title: 'Administrator',
      color: 'red',
      permissions: [
        'Create and edit all posts',
        'Submit posts for review',
        'Approve or reject posts',
        'Schedule posts for publishing',
        'Mark posts as published',
        'Delete any post'
      ]
    },
    MANAGER: {
      title: 'Manager',
      color: 'blue',
      permissions: [
        'Create and edit all posts',
        'Submit posts for review',
        'Approve or reject posts',
        'Schedule posts for publishing',
        'Mark posts as published',
        'Delete any post'
      ]
    },
    CONTENT_CREATOR: {
      title: 'Content Creator',
      color: 'green',
      permissions: [
        'Create new posts',
        'Submit posts for review',
        'Edit own draft posts',
        '⚠️ Cannot approve posts',
        '⚠️ Cannot schedule posts',
        '⚠️ Can only delete own drafts'
      ]
    },
    USER: {
      title: 'User',
      color: 'gray',
      permissions: ['No access to Instagram Staging Tool']
    }
  };

  const role = rolePermissions[userRole];
  const colorClasses = {
    red: 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400',
    blue: 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400',
    green: 'bg-green-500/10 border-green-500/30 text-green-600 dark:text-green-400',
    gray: 'bg-gray-500/10 border-gray-500/30 text-gray-600 dark:text-gray-400'
  };

  return (
    <div className={`border rounded-lg overflow-hidden ${colorClasses[role.color as keyof typeof colorClasses]}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4" />
          <span className="font-medium text-sm">
            Your Role: {role.title}
          </span>
        </div>
        {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {isOpen && (
        <div className="px-3 pb-3 space-y-3">
          {/* Permissions */}
          <div>
            <p className="text-xs font-semibold mb-2 opacity-70">Your Permissions:</p>
            <ul className="space-y-1">
              {role.permissions.map((permission, index) => (
                <li key={index} className="text-xs flex items-start gap-2">
                  <span className="opacity-50 mt-0.5">•</span>
                  <span>{permission}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Workflow */}
          {userRole !== 'USER' && (
            <div>
              <p className="text-xs font-semibold mb-2 opacity-70">Content Workflow:</p>
              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-16 h-6 bg-gray-500 rounded flex items-center justify-center text-white text-[10px] font-bold">
                    DRAFT
                  </div>
                  <span className="text-xs opacity-70">→</span>
                  <div className="w-16 h-6 bg-yellow-500 rounded flex items-center justify-center text-white text-[10px] font-bold">
                    REVIEW
                  </div>
                  <span className="text-xs opacity-70">→</span>
                  <div className="w-16 h-6 bg-green-500 rounded flex items-center justify-center text-white text-[10px] font-bold">
                    APPROVED
                  </div>
                </div>
                <div className="flex items-center gap-2 pl-[68px]">
                  <span className="text-xs opacity-70">→</span>
                  <div className="w-20 h-6 bg-purple-500 rounded flex items-center justify-center text-white text-[10px] font-bold">
                    SCHEDULED
                  </div>
                  <span className="text-xs opacity-70">→</span>
                  <div className="w-20 h-6 bg-pink-500 rounded flex items-center justify-center text-white text-[10px] font-bold">
                    PUBLISHED
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
