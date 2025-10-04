'use client';

import { useState } from 'react';
import { Download, FileText, FileJson, Archive, Loader2 } from 'lucide-react';

interface ExportButtonProps {
  selectedPostIds: string[];
  onExportComplete?: () => void;
}

export function ExportButton({ selectedPostIds, onExportComplete }: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const handleExport = async (format: 'json' | 'csv' | 'txt') => {
    if (selectedPostIds.length === 0) {
      alert('Please select posts to export');
      return;
    }

    setIsExporting(true);
    setShowMenu(false);

    try {
      const response = await fetch('/api/instagram/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postIds: selectedPostIds,
          format,
        }),
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      if (format === 'csv') {
        // Download CSV file
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `instagram-posts-${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else if (format === 'json') {
        // Download JSON file
        const data = await response.json();
        const jsonStr = JSON.stringify(data.data, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `instagram-posts-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else if (format === 'txt') {
        // Generate text file with captions
        const response2 = await fetch('/api/instagram/export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            postIds: selectedPostIds,
            format: 'json',
          }),
        });
        const data = await response2.json();
        
        const textContent = data.data.map((post: any, index: number) => {
          return `
═══════════════════════════════════════
POST ${index + 1}: ${post.fileName}
═══════════════════════════════════════
Scheduled: ${post.scheduledDate ? new Date(post.scheduledDate).toLocaleString() : 'Not scheduled'}
Status: ${post.status}
Type: ${post.postType}

CAPTION:
${post.caption || '(No caption)'}

IMAGE URL:
${post.imageUrl}
`;
        }).join('\n\n');

        const blob = new Blob([textContent], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `instagram-posts-${Date.now()}.txt`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }

      onExportComplete?.();
      alert(`✅ Successfully exported ${selectedPostIds.length} post(s)!`);
    } catch (error) {
      console.error('Export error:', error);
      alert('❌ Failed to export posts. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        disabled={isExporting || selectedPostIds.length === 0}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
          selectedPostIds.length === 0
            ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
            : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white shadow-lg shadow-green-500/25'
        }`}
        title={selectedPostIds.length === 0 ? 'Select posts to export' : 'Export selected posts'}
      >
        {isExporting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Exporting...
          </>
        ) : (
          <>
            <Download className="w-4 h-4" />
            Export {selectedPostIds.length > 0 ? `(${selectedPostIds.length})` : ''}
          </>
        )}
      </button>

      {/* Dropdown Menu */}
      {showMenu && !isExporting && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowMenu(false)}
          />
          
          {/* Menu */}
          <div className="absolute right-0 mt-2 w-56 bg-gray-800 border border-gray-700 rounded-lg shadow-2xl z-20 overflow-hidden">
            <div className="py-1">
              <button
                onClick={() => handleExport('txt')}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-700 text-white transition-colors"
              >
                <FileText className="w-4 h-4 text-blue-400" />
                <div className="text-left">
                  <div className="font-medium">Text File (.txt)</div>
                  <div className="text-xs text-gray-400">Captions ready to copy/paste</div>
                </div>
              </button>

              <button
                onClick={() => handleExport('csv')}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-700 text-white transition-colors"
              >
                <FileText className="w-4 h-4 text-green-400" />
                <div className="text-left">
                  <div className="font-medium">CSV File (.csv)</div>
                  <div className="text-xs text-gray-400">For spreadsheets</div>
                </div>
              </button>

              <button
                onClick={() => handleExport('json')}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-700 text-white transition-colors"
              >
                <FileJson className="w-4 h-4 text-purple-400" />
                <div className="text-left">
                  <div className="font-medium">JSON File (.json)</div>
                  <div className="text-xs text-gray-400">For developers</div>
                </div>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
