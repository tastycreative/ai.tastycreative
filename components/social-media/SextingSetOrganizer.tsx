"use client";

/**
 * Sexting Set Organizer Component
 * 
 * Recent UX Improvements (Feb 2026):
 * 
 * 1. Better Visual Feedback:
 *    - Custom styled confirmation modals instead of browser alerts
 *    - Toast notifications for all actions (success/error/info)
 *    - Prominent saving order indicator (floating badge)
 *    - Skeleton loaders on initial load
 * 
 * 2. Quick Actions on Hover:
 *    - Floating action buttons on image cards
 *    - Quick delete, rename, preview buttons
 *    - Visual drag handle indicator
 *    - Smooth transitions and delays for better UX
 * 
 * 3. Enhanced Drag & Drop:
 *    - Visual preview while dragging (with move icon)
 *    - Drop zone highlighting with pulsing border
 *    - Enhanced visual feedback (shadows, rings, scale)
 *    - Grid gap highlighting for precise placement
 * 
 * 4. Mobile Optimization:
 *    - Swipe-to-delete gesture on images
 *    - Bottom sheet modals instead of centered dialogs
 *    - Touch-friendly 44px minimum touch targets
 *    - Responsive button labels (hidden on mobile)
 *    - Floating Action Button (FAB) for quick upload
 *    - Simplified mobile layout
 */

import { useState, useEffect, useCallback, useRef, useMemo, memo } from "react";
import { createPortal } from "react-dom";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  Plus,
  Trash2,
  GripVertical,
  Upload,
  FolderPlus,
  Edit3,
  Check,
  X,
  Image as ImageIcon,
  Video,
  Loader2,
  Sparkles,
  Heart,
  Flame,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Calendar,
  Eye,
  EyeOff,
  MoreHorizontal,
  Download,
  Copy,
  Share2,
  FolderOutput,
  FolderInput,
  Folder,
  CheckCircle2,
  XCircle,
  User,
  Users,
  FileText,
  Mic,
  Volume2,
  Music,
  HardDrive,
  RefreshCw,
  Search,
  Link,
  ExternalLink,
  MoreVertical,
  PlusCircle,
  AlertCircle,
  LogOut,
  Info,
  Move,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  Minimize2,
  PanelRightOpen,
  PanelRightClose,
  Send,
  LayoutGrid,
} from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { useInstagramProfile } from "@/hooks/useInstagramProfile";
import { useSpaces, type SpaceWithBoards, type SpaceBoardColumn } from "@/lib/hooks/useSpaces.query";
import KeycardGenerator from "./KeycardGenerator";
import EmbeddedVoiceGenerator from "./EmbeddedVoiceGenerator";

interface InstagramProfile {
  id: string;
  name: string;
  instagramUsername?: string | null;
  isDefault?: boolean;
}

interface SextingImage {
  id: string;
  setId: string;
  url: string;
  name: string;
  type: string;
  sequence: number;
  size: number;
  uploadedAt: string;
}

interface SextingSet {
  id: string;
  userId: string;
  name: string;
  category: string;
  s3FolderPath: string;
  status: string;
  scheduledDate: string | null;
  createdAt: string;
  updatedAt: string;
  images: SextingImage[];
  profileName?: string | null;
}

interface VaultFolder {
  id: string;
  name: string;
  profileId: string;
  isDefault?: boolean;
  _count?: { items: number };
}

interface VaultItem {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  awsS3Url: string;
  createdAt: string;
  folderId: string;
  profileId: string;
}

interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  webViewLink?: string;
  webContentLink?: string;
  thumbnailLink?: string;
}

interface GoogleDriveFolder {
  id: string;
  name: string;
  mimeType: string;
  shared?: boolean;
}

interface GoogleDriveBreadcrumb {
  id: string | null;
  name: string;
}

interface SextingSetOrganizerProps {
  profileId: string | null;
  tenant: string;
}

// Helper functions extracted outside component to avoid recreating
const isVideo = (type: string) => type.startsWith("video/");
const isAudio = (type: string) => type.startsWith("audio/");
const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
};

// Memoized image card component to prevent re-renders on sibling hover/state changes
interface ImageCardProps {
  image: SextingImage;
  index: number;
  totalImages: number;
  isMobile: boolean;
  draggedIndex: number | null;
  dragOverIndex: number | null;
  touchOffsetValue: number;
  isSelected: boolean;
  isSelectMode: boolean;
  onToggleSelect: (imageId: string) => void;
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDragEnd: () => void;
  onClick: (image: SextingImage) => void;
  onDelete: (imageId: string) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onMoveToPosition: (fromIndex: number, toPosition: number) => void;
  onTouchStart: (e: React.TouchEvent, imageId: string) => void;
  onTouchMove: (e: React.TouchEvent, imageId: string) => void;
  onTouchEnd: (imageId: string) => void;
}

const ImageCard = memo(function ImageCard({
  image,
  index,
  totalImages,
  isMobile,
  draggedIndex,
  dragOverIndex,
  touchOffsetValue,
  isSelected,
  isSelectMode,
  onToggleSelect,
  onDragStart,
  onDragOver,
  onDragEnd,
  onClick,
  onDelete,
  onMoveUp,
  onMoveDown,
  onMoveToPosition,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
}: ImageCardProps) {
  const isDragging = draggedIndex === index;
  const isDropTarget = dragOverIndex === index;
  const isInsertBefore = draggedIndex !== null && dragOverIndex === index && draggedIndex > index;
  const isInsertAfter = draggedIndex !== null && dragOverIndex === index && draggedIndex < index;
  const [isEditingPos, setIsEditingPos] = useState(false);
  const [posInput, setPosInput] = useState("");
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const badgeRef = useRef<HTMLButtonElement>(null);

  const showTooltip = useCallback(() => {
    if (badgeRef.current) {
      const rect = badgeRef.current.getBoundingClientRect();
      setTooltipPos({ x: rect.left + rect.width / 2, y: rect.bottom + 6 });
    }
  }, []);
  const hideTooltip = useCallback(() => setTooltipPos(null), []);

  return (
    <div className="relative">
      {/* Drop insertion indicator - left/top edge line */}
      {isInsertBefore && !isDragging && (
        <div className="absolute -left-[5px] top-0 bottom-0 w-[3px] bg-[var(--color-brand-mid-pink)] rounded-full z-20 shadow-[0_0_6px_var(--color-brand-mid-pink)]" />
      )}

      <div
        draggable={!isMobile && !isEditingPos && !isSelectMode}
        onDragStart={(e) => onDragStart(e, index)}
        onDragOver={(e) => onDragOver(e, index)}
        onDragEnd={onDragEnd}
        onClick={() => {
          if (isSelectMode) { onToggleSelect(image.id); return; }
          if (!isMobile && !isEditingPos) onClick(image);
        }}
        onTouchStart={(e) => onTouchStart(e, image.id)}
        onTouchMove={(e) => onTouchMove(e, image.id)}
        onTouchEnd={() => onTouchEnd(image.id)}
        className={`group relative aspect-square rounded-xl overflow-hidden border-2 will-change-transform transition-[border-color,transform,opacity,box-shadow] duration-200 ${
          isSelected ? 'border-[var(--color-brand-mid-pink)] ring-2 ring-[var(--color-brand-mid-pink)]/50' : ''} ${
          isMobile ? 'active:scale-95' : 'cursor-grab active:cursor-grabbing hover:border-[var(--color-brand-mid-pink)]/50 hover:scale-[1.02]'
        } ${
          isDragging
            ? "opacity-30 scale-95 border-[var(--color-brand-mid-pink)] shadow-xl"
            : isDropTarget
              ? "border-[var(--color-brand-mid-pink)]/60"
              : "border-transparent"
        }`}
        style={{
          contentVisibility: 'auto',
          containIntrinsicSize: '0 200px',
          transform: isMobile && touchOffsetValue !== 0 ? `translateX(${touchOffsetValue}px)` : undefined,
          transition: touchOffsetValue !== 0 ? 'none' : undefined,
        }}
      >
        {/* Visual drag preview indicator */}
        {isDragging && (
          <div className="absolute inset-0 bg-[var(--color-brand-mid-pink)]/20 flex items-center justify-center z-20">
            <div className="bg-[var(--color-brand-mid-pink)] rounded-full p-3 shadow-xl">
              <Move className="w-6 h-6 text-white" />
            </div>
          </div>
        )}

        {/* Swipe delete indicator (mobile) */}
        {isMobile && touchOffsetValue < -50 && (
          <div className="absolute inset-y-0 right-0 w-20 bg-red-500 flex items-center justify-center">
            <Trash2 className="w-6 h-6 text-white" />
          </div>
        )}

        {/* Bulk select checkbox */}
        <div
          className={`absolute top-2 left-2 z-20 transition-opacity duration-150 ${
            isSelectMode ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
          onClick={(e) => { e.stopPropagation(); onToggleSelect(image.id); }}
        >
          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer transition-colors ${
            isSelected
              ? 'bg-[var(--color-brand-mid-pink)] border-[var(--color-brand-mid-pink)]'
              : 'bg-black/50 border-white/70 hover:border-[var(--color-brand-mid-pink)]'
          }`}>
            {isSelected && <Check className="w-3 h-3 text-white" />}
          </div>
        </div>

        {/* Reorder controls - position badge + move arrows */}
        <div
          className={`absolute top-2 left-2 z-10 flex items-center gap-1.5 transition-opacity ${
            isSelectMode ? 'opacity-0 pointer-events-none' : ''
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Position badge - clickable to jump to position */}
          {isEditingPos ? (
            <div className="flex flex-col items-start gap-1">
              <input
                type="number"
                min={1}
                max={totalImages}
                value={posInput}
                onChange={(e) => setPosInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const pos = parseInt(posInput, 10);
                    if (pos >= 1 && pos <= totalImages && pos !== index + 1) {
                      onMoveToPosition(index, pos);
                    }
                    setIsEditingPos(false);
                  } else if (e.key === "Escape") {
                    setIsEditingPos(false);
                  }
                }}
                onBlur={() => setIsEditingPos(false)}
                autoFocus
                className="w-12 h-8 text-center text-sm font-bold rounded-lg border-2 border-[var(--color-brand-mid-pink)] bg-white dark:bg-gray-900 text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-mid-pink)] shadow-lg"
              />
              <span className="text-[10px] text-white bg-black/70 rounded px-1.5 py-0.5 whitespace-nowrap shadow">
                Enter to move · Esc to cancel
              </span>
            </div>
          ) : (
            <button
              ref={badgeRef}
              onClick={() => { setPosInput(String(index + 1)); setIsEditingPos(true); hideTooltip(); }}
              onMouseEnter={showTooltip}
              onMouseLeave={hideTooltip}
              className="w-8 h-8 bg-gradient-to-br from-[var(--color-brand-mid-pink)] to-[var(--color-brand-dark-pink)] rounded-lg flex items-center justify-center shadow-lg hover:shadow-xl hover:scale-110 transition-all cursor-text"
            >
              <span className="text-white text-sm font-bold">
                {index + 1}
              </span>
            </button>
          )}

        </div>

      {/* Media */}
      {isVideo(image.type) ? (
        <video
          src={image.url}
          className="w-full h-full object-cover"
          muted
          preload="metadata"
        />
      ) : isAudio(image.type) ? (
        <div className="w-full h-full bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 dark:from-violet-900/50 dark:to-fuchsia-900/50 flex flex-col items-center justify-center p-3">
          <Music className="w-10 h-10 text-violet-500 mb-2" />
          <audio
            src={image.url}
            controls
            className="w-full h-8"
            onClick={(e) => e.stopPropagation()}
          />
          <span className="text-xs text-muted-foreground mt-2 truncate max-w-full">
            {image.name}
          </span>
        </div>
      ) : (
        <img
          src={image.url}
          alt={image.name}
          className="w-full h-full object-cover"
          loading="lazy"
          decoding="async"
        />
      )}

      {/* Hover overlay with quick actions - CSS only, no React state */}
      <div className={`absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent transition-opacity duration-200 ${
        isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
      }`}>
        {/* Top action buttons */}
        <div className="absolute top-2 right-2 flex gap-1">
          {/* Drag handle - desktop only */}
          {!isMobile && (
            <div className="p-2 bg-black/80 hover:bg-[var(--color-brand-mid-pink)]/80 rounded-lg transition-[opacity,transform] cursor-grab active:cursor-grabbing opacity-0 -translate-y-2 group-hover:opacity-100 group-hover:translate-y-0"
              title="Drag to reorder"
            >
              <GripVertical className="w-4 h-4 text-white" />
            </div>
          )}

          {/* Quick delete */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(image.id);
            }}
            className={`p-2 bg-black/80 hover:bg-red-500/80 rounded-lg transition-[opacity,transform] ${
              isMobile ? 'opacity-100' : 'opacity-0 -translate-y-2 group-hover:opacity-100 group-hover:translate-y-0'
            }`}
            title="Delete"
            style={{ transitionDelay: isMobile ? '0ms' : '50ms' }}
          >
            <Trash2 className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Bottom info bar */}
        <div className="absolute bottom-0 left-0 right-0 p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isVideo(image.type) ? (
              <Video className="w-4 h-4 text-[var(--color-brand-blue)]" />
            ) : isAudio(image.type) ? (
              <Volume2 className="w-4 h-4 text-violet-500" />
            ) : (
              <ImageIcon className="w-4 h-4 text-[var(--color-brand-mid-pink)]" />
            )}
            <span className="text-xs text-white/90 font-medium">
              {formatFileSize(image.size)}
            </span>
          </div>
          {isMobile && (
            <span className="text-xs text-white/70">
              Swipe left to delete
            </span>
          )}
        </div>

        {/* File name on hover */}
        <div className="absolute bottom-12 left-2 right-2">
          <p className="text-xs text-white/90 font-medium truncate bg-black/75 px-2 py-1 rounded">
            {image.name}
          </p>
        </div>
      </div>
    </div>

      {/* Drop insertion indicator - right/bottom edge line */}
      {isInsertAfter && !isDragging && (
        <div className="absolute -right-[5px] top-0 bottom-0 w-[3px] bg-[var(--color-brand-mid-pink)] rounded-full z-20 shadow-[0_0_6px_var(--color-brand-mid-pink)]" />
      )}

      {/* Portal tooltip for position badge */}
      {tooltipPos && createPortal(
        <div
          className="fixed z-[9999] pointer-events-none animate-in fade-in duration-150"
          style={{ left: tooltipPos.x, top: tooltipPos.y, transform: 'translateX(-50%)' }}
        >
          <div className="bg-gray-900 text-white text-xs rounded-md px-2.5 py-1.5 shadow-xl whitespace-nowrap border border-white/10">
            Click to set position
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45 border-l border-t border-white/10" />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
});

// Memoized folder item for sidebar - prevents re-renders from sibling hover/state
interface FolderItemProps {
  set: SextingSet;
  isSelected: boolean;
  isEditing: boolean;
  tempName: string;
  onSelect: (set: SextingSet) => void;
  onEditStart: (id: string, name: string) => void;
  onEditSave: (id: string, name: string) => void;
  onEditCancel: () => void;
  onTempNameChange: (name: string) => void;
  onDelete: (id: string) => void;
  // Drag props (optional - only for single-profile view)
  draggable?: boolean;
  isDragTarget?: boolean;
  isDragging?: boolean;
  onDragStart?: (e: React.DragEvent, index: number) => void;
  onDragOver?: (e: React.DragEvent, index: number) => void;
  onDragEnd?: () => void;
  dragIndex?: number;
  showDragHandle?: boolean;
}

const FolderItem = memo(function FolderItem({
  set,
  isSelected,
  isEditing,
  tempName,
  onSelect,
  onEditStart,
  onEditSave,
  onEditCancel,
  onTempNameChange,
  onDelete,
  draggable = false,
  isDragTarget = false,
  isDragging = false,
  onDragStart,
  onDragOver,
  onDragEnd,
  dragIndex = 0,
  showDragHandle = false,
}: FolderItemProps) {
  return (
    <div
      draggable={draggable && !isEditing}
      onDragStart={onDragStart ? (e) => onDragStart(e, dragIndex) : undefined}
      onDragOver={onDragOver ? (e) => onDragOver(e, dragIndex) : undefined}
      onDragEnd={onDragEnd}
      className={`group flex items-center gap-1 px-1 py-0.5 cursor-pointer will-change-transform ${
        isDragTarget ? "bg-[var(--color-brand-mid-pink)]/15" : ""
      } ${isDragging ? "opacity-40" : ""} ${
        isSelected
          ? "bg-[var(--color-brand-mid-pink)]/10"
          : "hover:bg-muted/60"
      }`}
      onClick={() => onSelect(set)}
    >
      {/* Drag handle */}
      {showDragHandle && (
        <div className="p-1 cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground shrink-0" title="Drag to reorder">
          <GripVertical className="w-3 h-3" />
        </div>
      )}

      {/* Left accent bar */}
      {showDragHandle && (
        <div className={`w-0.5 self-stretch rounded-full shrink-0 ${isSelected ? "bg-[var(--color-brand-mid-pink)]" : "bg-transparent"}`} />
      )}

      {/* For non-drag view (all profiles), add border accent */}
      {!showDragHandle && (
        <div className={`w-0 border-l-2 self-stretch shrink-0 ml-1 ${isSelected ? "border-l-[var(--color-brand-mid-pink)]" : "border-l-transparent"}`} />
      )}

      <div className="flex-1 min-w-0 py-1 px-1">
        {isEditing ? (
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={tempName}
              onChange={(e) => onTempNameChange(e.target.value)}
              className="flex-1 px-2 py-0.5 bg-background border border-border rounded text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-mid-pink)]"
              autoFocus
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === "Enter") onEditSave(set.id, tempName);
                else if (e.key === "Escape") onEditCancel();
              }}
            />
            <button onClick={(e) => { e.stopPropagation(); onEditSave(set.id, tempName); }} className="p-0.5 text-green-500 hover:text-green-600">
              <Check className="w-3.5 h-3.5" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); onEditCancel(); }} className="p-0.5 text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <Folder className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium text-foreground truncate">{set.name}</span>
            <span className="text-[10px] text-muted-foreground bg-muted/80 px-1 py-0.5 rounded shrink-0">{set.images.length}</span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button onClick={(e) => { e.stopPropagation(); onEditStart(set.id, set.name); }} className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors">
          <Edit3 className="w-3 h-3" />
        </button>
        <button onClick={(e) => { e.stopPropagation(); onDelete(set.id); }} className="p-1 text-muted-foreground hover:text-red-500 rounded transition-colors">
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
});

export default function SextingSetOrganizer({
  profileId,
  tenant,
}: SextingSetOrganizerProps) {
  const [sets, setSets] = useState<SextingSet[]>([]);
  const [selectedSet, setSelectedSet] = useState<SextingSet | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [newSetName, setNewSetName] = useState("");
  const [tempName, setTempName] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [expandedSets, setExpandedSets] = useState<Set<string>>(new Set());
  const [savingOrder, setSavingOrder] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  
  // Upload progress state for direct S3 uploads
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  
  // Debounce timer ref for reorder saves
  const reorderTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingReorderRef = useRef<{ setId: string; imageIds: string[] } | null>(null);

  // Export to Vault state
  const [showExportModal, setShowExportModal] = useState(false);
  const [profiles, setProfiles] = useState<InstagramProfile[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [selectedExportProfileId, setSelectedExportProfileId] = useState<
    string | null
  >(null);
  const [exportFolderName, setExportFolderName] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState<{
    folderName: string;
    itemCount: number;
  } | null>(null);

  // Import from Vault state
  const [showImportModal, setShowImportModal] = useState(false);
  const [vaultFolders, setVaultFolders] = useState<VaultFolder[]>([]);
  const [vaultItems, setVaultItems] = useState<VaultItem[]>([]);
  const [selectedVaultFolderId, setSelectedVaultFolderId] = useState<string | null>(null);
  const [selectedVaultItems, setSelectedVaultItems] = useState<Set<string>>(new Set());
  const [loadingVaultFolders, setLoadingVaultFolders] = useState(false);
  const [loadingVaultItems, setLoadingVaultItems] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState<{ itemCount: number } | null>(null);

  // Import from Google Drive state
  const [showGoogleDriveModal, setShowGoogleDriveModal] = useState(false);
  const [googleDriveAccessToken, setGoogleDriveAccessToken] = useState<string | null>(null);
  const [googleDriveFiles, setGoogleDriveFiles] = useState<GoogleDriveFile[]>([]);
  const [googleDriveFolders, setGoogleDriveFolders] = useState<GoogleDriveFolder[]>([]);
  const [googleDriveBreadcrumbs, setGoogleDriveBreadcrumbs] = useState<GoogleDriveBreadcrumb[]>([{ id: null, name: 'My Drive' }]);
  const [currentGoogleDriveFolderId, setCurrentGoogleDriveFolderId] = useState<string | null>(null);
  const [selectedGoogleDriveFiles, setSelectedGoogleDriveFiles] = useState<Set<string>>(new Set());
  const [loadingGoogleDriveFiles, setLoadingGoogleDriveFiles] = useState(false);
  const [importingFromGoogleDrive, setImportingFromGoogleDrive] = useState(false);
  const [googleDriveImportSuccess, setGoogleDriveImportSuccess] = useState<{ itemCount: number } | null>(null);
  const [googleDriveError, setGoogleDriveError] = useState<string | null>(null);
  const [showSharedFolders, setShowSharedFolders] = useState(false);
  const [googleDriveSearchQuery, setGoogleDriveSearchQuery] = useState("");
  const [isGoogleDriveSearchMode, setIsGoogleDriveSearchMode] = useState(false);
  const [googleDriveViewMode, setGoogleDriveViewMode] = useState<'myDrive' | 'shared' | 'link'>('myDrive');
  const [googleDriveLinkInput, setGoogleDriveLinkInput] = useState("");

  // Image rename state
  const [editingImageId, setEditingImageId] = useState<string | null>(null);
  const [editingImageName, setEditingImageName] = useState("");
  const [savingImageName, setSavingImageName] = useState(false);

  // Image detail modal state
  const [showImageDetailModal, setShowImageDetailModal] = useState(false);
  const [selectedImageForDetail, setSelectedImageForDetail] = useState<SextingImage | null>(null);

  // Bulk selection state
  const [selectedImageIds, setSelectedImageIds] = useState<Set<string>>(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Keycard and Voice modal states
  const [showKeycardModal, setShowKeycardModal] = useState(false);
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [actionsMenuPosition, setActionsMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const actionsMenuRef = useRef<HTMLDivElement>(null);
  const actionsButtonRef = useRef<HTMLButtonElement>(null);
  const [mounted, setMounted] = useState(false);

  // Push to Board state
  const [showPushToBoardModal, setShowPushToBoardModal] = useState(false);
  const [pushingToBoard, setPushingToBoard] = useState(false);
  const [pushToBoardSuccess, setPushToBoardSuccess] = useState<{ itemNo: number; title: string } | null>(null);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  const [selectedSpaceDetail, setSelectedSpaceDetail] = useState<SpaceWithBoards | null>(null);
  const [loadingSpaceDetail, setLoadingSpaceDetail] = useState(false);

  // Toast notification state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    confirmText: string;
    confirmAction: () => void;
    isDangerous?: boolean;
  } | null>(null);

  // Mobile detection
  const [isMobile, setIsMobile] = useState(false);

  // Touch gesture state for swipe
  const [touchStart, setTouchStart] = useState<{ x: number; y: number; id: string } | null>(null);
  const [touchOffset, setTouchOffset] = useState<{ id: string; offset: number } | null>(null);

  // Drop zone state for drag between sets
  const [dropTargetSetId, setDropTargetSetId] = useState<string | null>(null);

  // Folder (set) drag reordering state
  const [folderDragIndex, setFolderDragIndex] = useState<number | null>(null);
  const [folderDragOverIndex, setFolderDragOverIndex] = useState<number | null>(null);
  const [savingFolderOrder, setSavingFolderOrder] = useState(false);
  const folderReorderTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Folder search state
  const [folderSearchQuery, setFolderSearchQuery] = useState("");

  // Check if "All Profiles" is selected
  const isAllProfiles = profileId === "all";

  // Access the user and profiles from hooks for shared profile detection
  const { user: clerkUser } = useUser();
  const { profiles: globalProfiles } = useInstagramProfile();

  // Helper to check if selected profile is shared (not owned by current user)
  const isSharedProfile = useMemo(() => {
    if (!profileId || profileId === "all" || !clerkUser?.id) return false;
    const profile = globalProfiles.find(p => p.id === profileId);
    if (!profile) return false;
    // Check if the profile's clerkId matches the current user
    return profile.clerkId !== clerkUser.id;
  }, [profileId, globalProfiles, clerkUser?.id]);

  // Helper to get owner name for shared profiles
  const getSharedProfileOwnerName = useMemo(() => {
    if (!isSharedProfile) return null;
    const profile = globalProfiles.find(p => p.id === profileId);
    if (!profile?.user) return null;
    if (profile.user.firstName && profile.user.lastName) {
      return `${profile.user.firstName} ${profile.user.lastName}`;
    }
    if (profile.user.firstName) return profile.user.firstName;
    if (profile.user.name) return profile.user.name;
    return null;
  }, [isSharedProfile, profileId, globalProfiles]);

  // Fetch spaces for push-to-board (only SEXTING_SETS template spaces)
  const { data: spacesData } = useSpaces();
  const sextingSetsSpaces = useMemo(() => {
    if (!spacesData?.spaces) return [];
    return spacesData.spaces.filter(s => s.templateType === 'SEXTING_SETS');
  }, [spacesData]);

  // Fetch space detail when selected for push-to-board
  const fetchSpaceDetail = useCallback(async (spaceId: string) => {
    setLoadingSpaceDetail(true);
    setSelectedSpaceDetail(null);
    try {
      const res = await fetch(`/api/spaces/${spaceId}`);
      if (!res.ok) throw new Error('Failed to fetch space');
      const data: SpaceWithBoards = await res.json();
      setSelectedSpaceDetail(data);
    } catch (err) {
      console.error('Error fetching space detail:', err);
    } finally {
      setLoadingSpaceDetail(false);
    }
  }, []);

  // Open push-to-board modal
  const openPushToBoardModal = () => {
    if (!selectedSet) return;
    if (selectedSet.images.length === 0) {
      setToast({ message: 'This set has no images to push', type: 'error' });
      return;
    }
    setShowPushToBoardModal(true);
    setPushToBoardSuccess(null);
    setSelectedSpaceId(null);
    setSelectedSpaceDetail(null);
  };

  // Push to board action
  const pushToBoard = async () => {
    if (!selectedSet || !selectedSpaceId || !selectedSpaceDetail) return;

    const board = selectedSpaceDetail.boards[0];
    if (!board) {
      setToast({ message: 'No board found in this space', type: 'error' });
      return;
    }
    const column =
      board.columns.find((c) => c.name.toLowerCase().includes('submission')) ??
      board.columns[0];
    if (!column) {
      setToast({ message: 'No column found in this space', type: 'error' });
      return;
    }

    try {
      setPushingToBoard(true);
      const response = await fetch('/api/sexting-sets/push-to-board', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          setId: selectedSet.id,
          spaceId: selectedSpaceId,
          boardId: board.id,
          columnId: column.id,
          category: selectedSet.category,
          model: selectedSet.profileName || '',
          clientId: isAllProfiles ? selectedSet.category : profileId,
          clientName: selectedSet.profileName || '',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to push to board');
      }

      setPushToBoardSuccess({ itemNo: data.item.itemNo, title: data.item.title });
      setToast({ message: `Pushed "${selectedSet.name}" to board successfully!`, type: 'success' });

      // Auto-close after success
      setTimeout(() => {
        setShowPushToBoardModal(false);
        setPushToBoardSuccess(null);
      }, 2000);
    } catch (error) {
      console.error('Error pushing to board:', error);
      setToast({ 
        message: error instanceof Error ? error.message : 'Failed to push to board', 
        type: 'error' 
      });
    } finally {
      setPushingToBoard(false);
    }
  };

  // Set mounted state for portals
  useEffect(() => {
    setMounted(true);
  }, []);

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Toast auto-dismiss
  useEffect(() => {
    if (toast) {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = setTimeout(() => {
        setToast(null);
      }, 4000);
    }
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, [toast]);

  // Show toast notification
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
  };

  // Update dropdown position when menu opens
  useEffect(() => {
    if (showActionsMenu && actionsButtonRef.current) {
      const rect = actionsButtonRef.current.getBoundingClientRect();
      setActionsMenuPosition({
        top: rect.bottom + 8,
        left: rect.right - 224, // 224px = w-56 (14rem)
      });
    }
  }, [showActionsMenu]);

  // Close actions menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const isInsideMenu = actionsMenuRef.current?.contains(target);
      const isInsideButton = actionsButtonRef.current?.contains(target);
      
      if (!isInsideMenu && !isInsideButton) {
        setShowActionsMenu(false);
      }
    };
    
    if (showActionsMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showActionsMenu]);

  // Clear selected set when profile changes
  useEffect(() => {
    setSelectedSet(null);
    setExpandedSets(new Set());
  }, [profileId]);

  // Fetch sets - accepts profileId as parameter to avoid stale closure
  const fetchSets = useCallback(async (profileIdParam: string | null, autoSelectFirst = false) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (profileIdParam) params.set("profileId", profileIdParam);

      const response = await fetch(`/api/sexting-sets?${params.toString()}`);
      const data = await response.json();

      if (data.sets) {
        setSets(data.sets);
        // Auto-select first set only on initial load
        if (autoSelectFirst && data.sets.length > 0) {
          setSelectedSet(data.sets[0]);
          setExpandedSets(new Set([data.sets[0].id]));
        }
      }
    } catch (error) {
      console.error("Error fetching sets:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch - only runs when profileId changes
  useEffect(() => {
    fetchSets(profileId, true); // Auto-select first set on initial load
  }, [profileId, fetchSets]);

  // Create new set
  const createSet = async () => {
    if (!newSetName.trim()) return;

    try {
      setCreating(true);
      const response = await fetch("/api/sexting-sets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newSetName,
          profileId,
          category: profileId || "general",
        }),
      });

      const data = await response.json();
      if (data.set) {
        setSets((prev) => [data.set, ...prev]);
        setSelectedSet(data.set);
        setExpandedSets((prev) => new Set([...prev, data.set.id]));
        setNewSetName("");
        setShowCreateModal(false);
        showToast(`"${data.set.name}" created successfully`, 'success');
      }
    } catch (error) {
      console.error("Error creating set:", error);
      showToast('Failed to create set', 'error');
    } finally {
      setCreating(false);
    }
  };

  // Delete set
  const deleteSet = async (setId: string) => {
    const setToDelete = sets.find(s => s.id === setId);
    if (!setToDelete) return;

    setConfirmModal({
      title: "Delete Set",
      message: `Are you sure you want to delete "${setToDelete.name}" and all ${setToDelete.images.length} image${setToDelete.images.length !== 1 ? 's' : ''}? This action cannot be undone.`,
      confirmText: "Delete Set",
      isDangerous: true,
      confirmAction: async () => {
        try {
          await fetch(`/api/sexting-sets?id=${setId}`, { method: "DELETE" });
          setSets((prev) => prev.filter((s) => s.id !== setId));
          if (selectedSet?.id === setId) {
            setSelectedSet(null);
          }
          showToast(`"${setToDelete.name}" deleted successfully`, 'success');
        } catch (error) {
          console.error("Error deleting set:", error);
          showToast('Failed to delete set', 'error');
        }
      }
    });
  };

  // Update set name
  const updateSetName = async (setId: string, name: string) => {
    try {
      const response = await fetch("/api/sexting-sets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: setId, name }),
      });

      const data = await response.json();
      if (data.set) {
        setSets((prev) => prev.map((s) => (s.id === setId ? data.set : s)));
        if (selectedSet?.id === setId) {
          setSelectedSet(data.set);
        }
      }
    } catch (error) {
      console.error("Error updating set name:", error);
    }
    setEditingName(null);
  };

  // Upload images - Direct S3 upload to bypass Vercel's 4.5MB limit
  const handleFileUpload = async (
    files: FileList | null,
    targetSetId?: string,
  ) => {
    const setId = targetSetId || selectedSet?.id;
    if (!files || files.length === 0 || !setId) return;

    try {
      setUploading(true);
      setUploadProgress({ current: 0, total: files.length });

      const fileArray = Array.from(files);
      
      // Step 1: Get presigned URLs for all files
      const urlResponse = await fetch("/api/sexting-sets/get-upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          setId,
          files: fileArray.map(f => ({
            name: f.name,
            type: f.type,
            size: f.size,
          })),
        }),
      });

      const urlData = await urlResponse.json();
      if (!urlData.uploadUrls) {
        throw new Error("Failed to get upload URLs");
      }

      // Step 2: Upload each file directly to S3
      const uploadedFiles = [];
      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        const uploadInfo = urlData.uploadUrls[i];

        // Upload directly to S3 using presigned URL
        const uploadResponse = await fetch(uploadInfo.uploadUrl, {
          method: "PUT",
          body: file,
          headers: {
            "Content-Type": file.type,
          },
        });

        if (!uploadResponse.ok) {
          console.error(`Failed to upload ${file.name}`);
          continue;
        }

        uploadedFiles.push(uploadInfo);
        setUploadProgress({ current: i + 1, total: files.length });
      }

      // Step 3: Confirm uploads and create database records
      if (uploadedFiles.length > 0) {
        const confirmResponse = await fetch("/api/sexting-sets/confirm-upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            setId,
            uploadedFiles,
          }),
        });

        const confirmData = await confirmResponse.json();
        if (confirmData.success) {
          // Refresh the set
          const setResponse = await fetch(`/api/sexting-sets/${setId}`);
          const setData = await setResponse.json();
          if (setData.set) {
            setSets((prev) =>
              prev.map((s) => (s.id === setId ? setData.set : s)),
            );
            if (selectedSet?.id === setId) {
              setSelectedSet(setData.set);
            }
          }
          showToast(`${uploadedFiles.length} file${uploadedFiles.length !== 1 ? 's' : ''} uploaded successfully`, 'success');
        }
      } else {
        showToast('No files were uploaded', 'error');
      }
    } catch (error) {
      console.error("Error uploading images:", error);
      showToast('Upload failed. Please try again.', 'error');
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  // Delete image
  const deleteImage = async (setId: string, imageId: string) => {
    const set = sets.find(s => s.id === setId);
    const image = set?.images.find(img => img.id === imageId);
    if (!image) return;

    setConfirmModal({
      title: "Delete Image",
      message: `Are you sure you want to delete "${image.name}"? This action cannot be undone.`,
      confirmText: "Delete",
      isDangerous: true,
      confirmAction: async () => {
        try {
          await fetch(`/api/sexting-sets/${setId}?imageId=${imageId}`, {
            method: "DELETE",
          });

          // Update local state
          setSets((prev) =>
            prev.map((s) => {
              if (s.id !== setId) return s;
              return {
                ...s,
                images: s.images
                  .filter((img) => img.id !== imageId)
                  .map((img, idx) => ({ ...img, sequence: idx + 1 })),
              };
            }),
          );

          if (selectedSet?.id === setId) {
            setSelectedSet((prev) => {
              if (!prev) return null;
              return {
                ...prev,
                images: prev.images
                  .filter((img) => img.id !== imageId)
                  .map((img, idx) => ({ ...img, sequence: idx + 1 })),
              };
            });
          }

          showToast(`"${image.name}" deleted successfully`, 'success');
          if (showImageDetailModal) {
            setShowImageDetailModal(false);
            setSelectedImageForDetail(null);
          }
        } catch (error) {
          console.error("Error deleting image:", error);
          showToast('Failed to delete image', 'error');
        }
      }
    });
  };

  // Bulk delete selected images
  const bulkDeleteImages = async () => {
    if (!selectedSet || selectedImageIds.size === 0) return;
    const setId = selectedSet.id;
    const idsToDelete = [...selectedImageIds];
    setConfirmModal({
      title: `Delete ${idsToDelete.length} Images`,
      message: `Are you sure you want to delete ${idsToDelete.length} selected image${idsToDelete.length !== 1 ? 's' : ''}? This action cannot be undone.`,
      confirmText: `Delete ${idsToDelete.length}`,
      isDangerous: true,
      confirmAction: async () => {
        setBulkDeleting(true);
        try {
          await fetch(
            `/api/sexting-sets/${setId}?imageIds=${idsToDelete.join(',')}`,
            { method: 'DELETE' }
          );
          // Update local state: remove deleted images and re-sequence
          const updateImages = (images: SextingImage[]) =>
            images
              .filter((img) => !idsToDelete.includes(img.id))
              .map((img, idx) => ({ ...img, sequence: idx + 1 }));
          setSets((prev) =>
            prev.map((s) => s.id !== setId ? s : { ...s, images: updateImages(s.images) })
          );
          setSelectedSet((prev) =>
            prev && prev.id === setId ? { ...prev, images: updateImages(prev.images) } : prev
          );
          setSelectedImageIds(new Set());
          setIsSelectMode(false);
          showToast(`${idsToDelete.length} image${idsToDelete.length !== 1 ? 's' : ''} deleted`, 'success');
        } catch (error) {
          console.error('Bulk delete error:', error);
          showToast('Failed to delete some images', 'error');
        } finally {
          setBulkDeleting(false);
        }
      },
    });
  };

  // Toggle a single image selection
  const toggleImageSelection = useCallback((imageId: string) => {
    setIsSelectMode(true); // auto-activate select mode when any checkbox is touched
    setSelectedImageIds((prev) => {
      const next = new Set(prev);
      if (next.has(imageId)) next.delete(imageId);
      else next.add(imageId);
      return next;
    });
  }, []);

  // Rename image
  const renameImage = async (setId: string, imageId: string, newName: string) => {
    if (!newName.trim()) return;
    
    try {
      setSavingImageName(true);
      const response = await fetch(`/api/sexting-sets/${setId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageId, newName: newName.trim() }),
      });

      const data = await response.json();
      if (data.success && data.image) {
        // Update local state
        setSets((prev) =>
          prev.map((s) => {
            if (s.id !== setId) return s;
            return {
              ...s,
              images: s.images.map((img) =>
                img.id === imageId ? { ...img, name: data.image.name } : img
              ),
            };
          })
        );

        if (selectedSet?.id === setId) {
          setSelectedSet((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              images: prev.images.map((img) =>
                img.id === imageId ? { ...img, name: data.image.name } : img
              ),
            };
          });
        }

        // Update the detail modal if open
        if (selectedImageForDetail?.id === imageId) {
          setSelectedImageForDetail((prev) =>
            prev ? { ...prev, name: data.image.name } : null
          );
        }
      }
    } catch (error) {
      console.error("Error renaming image:", error);
    } finally {
      setSavingImageName(false);
      setEditingImageId(null);
      setEditingImageName("");
    }
  };

  // Zoom/pan state for image detail viewer
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const imageContainerRef = useRef<HTMLDivElement>(null);

  const resetZoom = useCallback(() => {
    setZoomLevel(1);
    setPanPosition({ x: 0, y: 0 });
  }, []);

  const handleZoomIn = useCallback(() => {
    setZoomLevel(prev => Math.min(prev + 0.5, 8));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomLevel(prev => {
      const next = Math.max(prev - 0.5, 0.5);
      if (next <= 1) setPanPosition({ x: 0, y: 0 });
      return next;
    });
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const delta = e.deltaY > 0 ? -0.25 : 0.25;
    setZoomLevel(prev => {
      const next = Math.min(Math.max(prev + delta, 0.5), 8);
      if (next <= 1) setPanPosition({ x: 0, y: 0 });
      return next;
    });
  }, []);

  const handlePanStart = useCallback((e: React.MouseEvent) => {
    if (zoomLevel <= 1) return;
    e.preventDefault();
    setIsPanning(true);
    setPanStart({ x: e.clientX - panPosition.x, y: e.clientY - panPosition.y });
  }, [zoomLevel, panPosition]);

  const handlePanMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning) return;
    setPanPosition({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
  }, [isPanning, panStart]);

  const handlePanEnd = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Touch support for pinch-to-zoom
  const lastTouchDistance = useRef<number | null>(null);
  const handleZoomTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastTouchDistance.current = Math.hypot(dx, dy);
    } else if (e.touches.length === 1 && zoomLevel > 1) {
      setPanStart({ x: e.touches[0].clientX - panPosition.x, y: e.touches[0].clientY - panPosition.y });
      setIsPanning(true);
    }
  }, [zoomLevel, panPosition]);

  const handleZoomTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastTouchDistance.current !== null) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const scale = dist / lastTouchDistance.current;
      setZoomLevel(prev => Math.min(Math.max(prev * scale, 0.5), 8));
      lastTouchDistance.current = dist;
    } else if (e.touches.length === 1 && isPanning) {
      setPanPosition({ x: e.touches[0].clientX - panStart.x, y: e.touches[0].clientY - panStart.y });
    }
  }, [isPanning, panStart]);

  const handleZoomTouchEnd = useCallback(() => {
    lastTouchDistance.current = null;
    setIsPanning(false);
  }, []);

  // Open image detail modal
  const openImageDetail = useCallback((image: SextingImage) => {
    setSelectedImageForDetail(image);
    setShowImageDetailModal(true);
    resetZoom();
    setIsFullscreen(false);
  }, [resetZoom]);

  // Navigate to prev/next image in the detail modal
  const navigateImageDetail = useCallback((direction: 'prev' | 'next') => {
    if (!selectedSet || !selectedImageForDetail) return;
    const images = selectedSet.images;
    const currentIdx = images.findIndex((img) => img.id === selectedImageForDetail.id);
    if (currentIdx === -1) return;
    const nextIdx = direction === 'next'
      ? (currentIdx + 1) % images.length
      : (currentIdx - 1 + images.length) % images.length;
    setSelectedImageForDetail(images[nextIdx]);
    setEditingImageId(null);
    setEditingImageName('');
    resetZoom();
  }, [selectedSet, selectedImageForDetail, resetZoom]);

  // Keyboard arrow navigation for image detail modal
  useEffect(() => {
    if (!showImageDetailModal) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') navigateImageDetail('next');
      else if (e.key === 'ArrowLeft') navigateImageDetail('prev');
      else if (e.key === '=' || e.key === '+') { e.preventDefault(); handleZoomIn(); }
      else if (e.key === '-' || e.key === '_') { e.preventDefault(); handleZoomOut(); }
      else if (e.key === '0') { e.preventDefault(); resetZoom(); }
      else if (e.key === 'f' || e.key === 'F') { setIsFullscreen(f => !f); }
      else if (e.key === 'i' || e.key === 'I') { setShowInfoPanel(p => !p); }
      else if (e.key === 'Escape') {
        if (zoomLevel > 1) {
          resetZoom();
        } else if (showInfoPanel) {
          setShowInfoPanel(false);
        } else if (isFullscreen) {
          setIsFullscreen(false);
        } else {
          setShowImageDetailModal(false);
          setSelectedImageForDetail(null);
          setEditingImageId(null);
          setEditingImageName('');
          setIsFullscreen(false);
          setShowInfoPanel(false);
          resetZoom();
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [showImageDetailModal, navigateImageDetail, handleZoomIn, handleZoomOut, resetZoom, zoomLevel, isFullscreen, showInfoPanel]);

  // Stable ref so useCallback closures always call the latest deleteImage
  const deleteImageRef = useRef(deleteImage);
  deleteImageRef.current = deleteImage;

  // Stable delete handler for current set — only changes when selected set changes
  const handleDeleteCurrentSetImage = useCallback((imageId: string) => {
    if (selectedSet) deleteImageRef.current(selectedSet.id, imageId);
  }, [selectedSet?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Touch gesture handlers for swipe delete
  const handleTouchStart = useCallback((e: React.TouchEvent, imageId: string) => {
    if (!isMobile) return;
    const touch = e.touches[0];
    setTouchStart({ x: touch.clientX, y: touch.clientY, id: imageId });
  }, [isMobile]);

  const handleTouchMove = useCallback((e: React.TouchEvent, imageId: string) => {
    if (!isMobile || !touchStart || touchStart.id !== imageId) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStart.x;
    const deltaY = Math.abs(touch.clientY - touchStart.y);
    if (deltaY < 30 && Math.abs(deltaX) > 10) {
      setTouchOffset({ id: imageId, offset: deltaX });
    }
  }, [isMobile, touchStart]);

  const handleTouchEnd = useCallback((imageId: string) => {
    if (!isMobile || !touchOffset || touchOffset.id !== imageId) {
      setTouchStart(null);
      setTouchOffset(null);
      return;
    }
    if (touchOffset.offset < -100 && selectedSet) {
      deleteImageRef.current(selectedSet.id, imageId);
    }
    setTouchStart(null);
    setTouchOffset(null);
  }, [isMobile, touchOffset, selectedSet?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch profiles for export
  const fetchProfiles = async () => {
    try {
      setLoadingProfiles(true);
      const response = await fetch("/api/instagram/profiles");
      const data = await response.json();

      if (data.profiles && Array.isArray(data.profiles)) {
        setProfiles(data.profiles);
        // Auto-select current profile or first one
        if (data.profiles.length > 0 && !selectedExportProfileId) {
          setSelectedExportProfileId(profileId || data.profiles[0].id);
        }
      }
    } catch (error) {
      console.error("Error fetching profiles:", error);
    } finally {
      setLoadingProfiles(false);
    }
  };

  // Open export modal
  const openExportModal = () => {
    if (!selectedSet || selectedSet.images.length === 0) return;
    setShowExportModal(true);
    setExportSuccess(null);
    setExportFolderName(selectedSet.name); // Pre-fill with set name
    
    // Fetch profiles and pre-select the set's profile when viewing All Profiles
    if (isAllProfiles) {
      fetchProfiles();
      // Pre-select the profile that owns this set (category stores the profileId)
      setSelectedExportProfileId(selectedSet.category);
    }
  };

  // Export to vault - creates a new folder with all items
  const exportToVault = async () => {
    // When viewing All Profiles, use the selected export profile ID
    const targetProfileId = isAllProfiles ? selectedExportProfileId : profileId;
    
    if (!selectedSet || !targetProfileId) return;

    if (!exportFolderName.trim()) {
      alert("Please enter a folder name");
      return;
    }

    try {
      setExporting(true);
      const response = await fetch("/api/sexting-sets/export-to-vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          setId: selectedSet.id,
          profileId: targetProfileId,
          folderName: exportFolderName.trim(),
          organizationSlug: tenant,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to export");
      }

      setExportSuccess({
        folderName: data.folderName,
        itemCount: data.itemCount,
      });

      // Reset state after success
      setTimeout(() => {
        setShowExportModal(false);
        setExportSuccess(null);
        setExportFolderName("");
      }, 2000);
    } catch (error) {
      console.error("Error exporting to vault:", error);
      alert(
        error instanceof Error ? error.message : "Failed to export to vault",
      );
    } finally {
      setExporting(false);
    }
  };

  // Fetch vault folders for import
  const fetchVaultFolders = async () => {
    if (!profileId) return;
    try {
      setLoadingVaultFolders(true);
      const response = await fetch(`/api/vault/folders?profileId=${profileId}`);
      const data = await response.json();
      if (Array.isArray(data)) {
        setVaultFolders(data);
      }
    } catch (error) {
      console.error("Error fetching vault folders:", error);
    } finally {
      setLoadingVaultFolders(false);
    }
  };

  // Fetch vault items for a folder
  const fetchVaultItems = async (folderId: string) => {
    if (!profileId) return;
    try {
      setLoadingVaultItems(true);
      const response = await fetch(`/api/vault/items?profileId=${profileId}&folderId=${folderId}`);
      const data = await response.json();
      if (Array.isArray(data)) {
        // Filter to only show images, videos, and audio files
        const mediaItems = data.filter((item: VaultItem) => 
          item.fileType.startsWith('image/') || item.fileType.startsWith('video/') || item.fileType.startsWith('audio/')
        );
        setVaultItems(mediaItems);
      }
    } catch (error) {
      console.error("Error fetching vault items:", error);
    } finally {
      setLoadingVaultItems(false);
    }
  };

  // Open import modal
  const openImportModal = () => {
    if (!selectedSet) return;
    setShowImportModal(true);
    setImportSuccess(null);
    setSelectedVaultFolderId(null);
    setSelectedVaultItems(new Set());
    setVaultItems([]);
    fetchVaultFolders();
  };

  // Handle vault folder selection
  const handleVaultFolderSelect = (folderId: string) => {
    setSelectedVaultFolderId(folderId);
    setSelectedVaultItems(new Set());
    fetchVaultItems(folderId);
  };

  // Toggle vault item selection
  const toggleVaultItemSelection = (itemId: string) => {
    setSelectedVaultItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  // Select all vault items
  const selectAllVaultItems = () => {
    if (selectedVaultItems.size === vaultItems.length) {
      setSelectedVaultItems(new Set());
    } else {
      setSelectedVaultItems(new Set(vaultItems.map(item => item.id)));
    }
  };

  // Import from vault
  const importFromVault = async () => {
    if (!selectedSet || selectedVaultItems.size === 0) return;

    try {
      setImporting(true);
      const response = await fetch("/api/sexting-sets/import-from-vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          setId: selectedSet.id,
          vaultItemIds: Array.from(selectedVaultItems),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to import");
      }

      // Update local state with the new set data
      if (data.set) {
        setSets(prev => prev.map(s => s.id === data.set.id ? data.set : s));
        setSelectedSet(data.set);
      }

      setImportSuccess({ itemCount: data.itemCount });

      // Reset and close after success
      setTimeout(() => {
        setShowImportModal(false);
        setImportSuccess(null);
        setSelectedVaultFolderId(null);
        setSelectedVaultItems(new Set());
        setVaultItems([]);
      }, 2000);
    } catch (error) {
      console.error("Error importing from vault:", error);
      alert(
        error instanceof Error ? error.message : "Failed to import from vault",
      );
    } finally {
      setImporting(false);
    }
  };

  // Check for Google Drive access token in URL (after OAuth callback) or localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // First check URL for new token from OAuth callback
      const urlParams = new URLSearchParams(window.location.search);
      const accessToken = urlParams.get('access_token');
      if (accessToken) {
        setGoogleDriveAccessToken(accessToken);
        // Save to localStorage for persistence
        localStorage.setItem('googleDriveAccessToken', accessToken);
        // Clean up URL
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      } else {
        // Try to load from localStorage
        const savedToken = localStorage.getItem('googleDriveAccessToken');
        if (savedToken) {
          setGoogleDriveAccessToken(savedToken);
        }
      }
    }
  }, []);

  // Connect to Google Drive
  const connectToGoogleDrive = async () => {
    try {
      const currentPath = window.location.pathname;
      const response = await fetch(`/api/auth/google?redirect=${encodeURIComponent(currentPath)}`);
      const data = await response.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch (error) {
      console.error("Error connecting to Google Drive:", error);
      setGoogleDriveError("Failed to connect to Google Drive");
    }
  };

  // Fetch Google Drive contents (folders and files) for current folder
  const fetchGoogleDriveContents = async (folderId: string | null = null) => {
    if (!googleDriveAccessToken) return;

    try {
      setLoadingGoogleDriveFiles(true);
      setGoogleDriveError(null);
      
      const params = new URLSearchParams({
        accessToken: googleDriveAccessToken,
      });
      if (folderId) {
        params.append('folderId', folderId);
      }
      
      const response = await fetch(`/api/google-drive/browse?${params}`);
      const data = await response.json();

      if (data.authError) {
        setGoogleDriveAccessToken(null);
        localStorage.removeItem('googleDriveAccessToken');
        setGoogleDriveError("Session expired. Please reconnect to Google Drive.");
        return;
      }

      if (data.error) {
        // Check if it's an access/permission error
        if (data.permissionError || data.error.includes('access') || data.error.includes('permission') || data.error.includes('not found')) {
          setGoogleDriveError("Unable to access this folder. You may not have permission or the link may be invalid.");
        } else {
          setGoogleDriveError(data.error);
        }
        return;
      }

      const folders = data.folders || [];
      const mediaFiles = data.mediaFiles || [];
      
      setGoogleDriveFolders(folders);
      setGoogleDriveFiles(mediaFiles);
    } catch (error) {
      console.error("Error fetching Google Drive contents:", error);
      setGoogleDriveError("Failed to fetch contents from Google Drive");
    } finally {
      setLoadingGoogleDriveFiles(false);
    }
  };

  // Navigate into a Google Drive folder
  const navigateToGoogleDriveFolder = (folder: GoogleDriveFolder) => {
    setCurrentGoogleDriveFolderId(folder.id);
    setGoogleDriveBreadcrumbs(prev => [...prev, { id: folder.id, name: folder.name }]);
    setSelectedGoogleDriveFiles(new Set());
    fetchGoogleDriveContents(folder.id);
  };

  // Navigate to a specific breadcrumb
  const navigateToBreadcrumb = (index: number) => {
    const breadcrumb = googleDriveBreadcrumbs[index];
    setCurrentGoogleDriveFolderId(breadcrumb.id);
    setGoogleDriveBreadcrumbs(prev => prev.slice(0, index + 1));
    setSelectedGoogleDriveFiles(new Set());
    fetchGoogleDriveContents(breadcrumb.id);
  };

  // Fetch shared folders
  const fetchSharedFolders = async () => {
    if (!googleDriveAccessToken) return;

    try {
      setLoadingGoogleDriveFiles(true);
      setGoogleDriveError(null);
      
      const params = new URLSearchParams({
        accessToken: googleDriveAccessToken,
        includeShared: 'true',
      });
      
      const response = await fetch(`/api/google-drive/folders?${params}`);
      const data = await response.json();

      if (data.authError) {
        setGoogleDriveAccessToken(null);
        setGoogleDriveError("Session expired. Please reconnect to Google Drive.");
        return;
      }

      if (data.error) {
        setGoogleDriveError(data.error);
        return;
      }

      // Filter to only show shared folders
      const sharedFolders = (data.folders || []).filter((f: GoogleDriveFolder) => f.shared);
      setGoogleDriveFolders(sharedFolders);
      setGoogleDriveFiles([]);
    } catch (error) {
      console.error("Error fetching shared folders:", error);
      setGoogleDriveError("Failed to fetch shared folders");
    } finally {
      setLoadingGoogleDriveFiles(false);
    }
  };

  // Switch between view modes (My Drive, Shared, Link)
  const switchGoogleDriveViewMode = (mode: 'myDrive' | 'shared' | 'link') => {
    setGoogleDriveViewMode(mode);
    setShowSharedFolders(mode === 'shared');
    setSelectedGoogleDriveFiles(new Set());
    setIsGoogleDriveSearchMode(false);
    setGoogleDriveSearchQuery("");
    
    if (mode === 'myDrive') {
      setGoogleDriveBreadcrumbs([{ id: null, name: 'My Drive' }]);
      setCurrentGoogleDriveFolderId(null);
      fetchGoogleDriveContents(null);
    } else if (mode === 'shared') {
      setGoogleDriveBreadcrumbs([{ id: null, name: 'Shared with me' }]);
      setCurrentGoogleDriveFolderId(null);
      fetchSharedFolders();
    } else if (mode === 'link') {
      // Link mode - wait for user to paste a link
      setGoogleDriveBreadcrumbs([{ id: null, name: 'From Link' }]);
      setGoogleDriveFolders([]);
      setGoogleDriveFiles([]);
    }
  };

  // Extract folder ID from Google Drive link
  const extractFolderIdFromLink = (link: string): string | null => {
    // Handle various Google Drive folder URL formats:
    // https://drive.google.com/drive/folders/FOLDER_ID
    // https://drive.google.com/drive/u/0/folders/FOLDER_ID
    // https://drive.google.com/drive/folders/FOLDER_ID?usp=sharing
    // https://drive.google.com/drive/u/1/folders/FOLDER_ID?resourcekey=xxx
    const patterns = [
      /\/folders\/([a-zA-Z0-9_-]+)/,
      /\/drive\/.*folders\/([a-zA-Z0-9_-]+)/,
      /id=([a-zA-Z0-9_-]+)/,
    ];
    
    for (const pattern of patterns) {
      const match = link.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  };

  // Browse a Google Drive folder from a link
  const browseGoogleDriveLink = async () => {
    if (!googleDriveAccessToken || !googleDriveLinkInput.trim()) return;
    
    const folderId = extractFolderIdFromLink(googleDriveLinkInput.trim());
    if (!folderId) {
      setGoogleDriveError("Invalid Google Drive link. Please paste a valid folder link.");
      return;
    }

    try {
      setLoadingGoogleDriveFiles(true);
      setGoogleDriveError(null);
      setGoogleDriveBreadcrumbs([{ id: folderId, name: 'Linked Folder' }]);
      setCurrentGoogleDriveFolderId(folderId);
      
      await fetchGoogleDriveContents(folderId);
    } catch (error) {
      console.error("Error browsing Google Drive link:", error);
      setGoogleDriveError("Failed to access the linked folder. Make sure you have permission.");
    }
  };

  // Global search across all Google Drive
  const searchGoogleDrive = async (query: string) => {
    if (!googleDriveAccessToken || !query.trim()) return;

    try {
      setLoadingGoogleDriveFiles(true);
      setGoogleDriveError(null);
      setIsGoogleDriveSearchMode(true);
      setGoogleDriveBreadcrumbs([{ id: null, name: `Search: "${query}"` }]);
      
      const params = new URLSearchParams({
        accessToken: googleDriveAccessToken,
        search: query.trim(),
      });
      
      const response = await fetch(`/api/google-drive/browse?${params}`);
      const data = await response.json();

      if (data.authError) {
        setGoogleDriveAccessToken(null);
        setGoogleDriveError("Session expired. Please reconnect to Google Drive.");
        return;
      }

      if (data.error) {
        setGoogleDriveError(data.error);
        return;
      }

      setGoogleDriveFolders(data.folders || []);
      setGoogleDriveFiles(data.mediaFiles || []);
    } catch (error) {
      console.error("Error searching Google Drive:", error);
      setGoogleDriveError("Failed to search Google Drive");
    } finally {
      setLoadingGoogleDriveFiles(false);
    }
  };

  // Clear search and go back to link input
  const clearGoogleDriveSearch = () => {
    setGoogleDriveSearchQuery("");
    setIsGoogleDriveSearchMode(false);
    setSelectedGoogleDriveFiles(new Set());
    setGoogleDriveBreadcrumbs([{ id: null, name: 'From Link' }]);
    // Keep current folder contents if browsing a link, otherwise clear
    if (!currentGoogleDriveFolderId) {
      setGoogleDriveFolders([]);
      setGoogleDriveFiles([]);
    }
  };

  // Open Google Drive import modal
  const openGoogleDriveModal = () => {
    if (!selectedSet) return;
    setShowGoogleDriveModal(true);
    setGoogleDriveImportSuccess(null);
    setSelectedGoogleDriveFiles(new Set());
    setGoogleDriveError(null);
    setGoogleDriveViewMode('link');
    setGoogleDriveLinkInput("");
    setGoogleDriveBreadcrumbs([{ id: null, name: 'From Link' }]);
    setCurrentGoogleDriveFolderId(null);
    setGoogleDriveFolders([]);
    setGoogleDriveFiles([]);
    setGoogleDriveSearchQuery("");
    setIsGoogleDriveSearchMode(false);
  };

  // Toggle Google Drive file selection
  const toggleGoogleDriveFileSelection = (fileId: string) => {
    setSelectedGoogleDriveFiles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fileId)) {
        newSet.delete(fileId);
      } else {
        newSet.add(fileId);
      }
      return newSet;
    });
  };

  // Select all Google Drive files
  const selectAllGoogleDriveFiles = () => {
    if (selectedGoogleDriveFiles.size === googleDriveFiles.length) {
      setSelectedGoogleDriveFiles(new Set());
    } else {
      setSelectedGoogleDriveFiles(new Set(googleDriveFiles.map(file => file.id)));
    }
  };

  // Import from Google Drive
  const importFromGoogleDrive = async () => {
    if (!selectedSet || selectedGoogleDriveFiles.size === 0 || !googleDriveAccessToken) return;

    try {
      setImportingFromGoogleDrive(true);
      setGoogleDriveError(null);
      const response = await fetch("/api/sexting-sets/import-from-google-drive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          setId: selectedSet.id,
          fileIds: Array.from(selectedGoogleDriveFiles),
          accessToken: googleDriveAccessToken,
        }),
      });

      const data = await response.json();

      if (data.authError) {
        setGoogleDriveAccessToken(null);
        setGoogleDriveError("Session expired. Please reconnect to Google Drive.");
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || "Failed to import");
      }

      // Update local state with the new set data
      if (data.set) {
        setSets(prev => prev.map(s => s.id === data.set.id ? data.set : s));
        setSelectedSet(data.set);
      }

      setGoogleDriveImportSuccess({ itemCount: data.itemCount });

      // Reset and close after success
      setTimeout(() => {
        setShowGoogleDriveModal(false);
        setGoogleDriveImportSuccess(null);
        setSelectedGoogleDriveFiles(new Set());
        setGoogleDriveFiles([]);
      }, 2000);
    } catch (error) {
      console.error("Error importing from Google Drive:", error);
      setGoogleDriveError(
        error instanceof Error ? error.message : "Failed to import from Google Drive"
      );
    } finally {
      setImportingFromGoogleDrive(false);
    }
  };

  // Drag and drop handlers
  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", index.toString());
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  }, []);

  // Debounced save function for reordering
  const saveReorderDebounced = useCallback((setId: string, imageIds: string[]) => {
    // Store the pending reorder
    pendingReorderRef.current = { setId, imageIds };
    
    // Clear any existing timeout
    if (reorderTimeoutRef.current) {
      clearTimeout(reorderTimeoutRef.current);
    }
    
    // Set a new timeout to save after 1.5 seconds of no activity
    reorderTimeoutRef.current = setTimeout(async () => {
      const pending = pendingReorderRef.current;
      if (!pending) return;
      
      try {
        setSavingOrder(true);
        await fetch("/api/sexting-sets/reorder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(pending),
        });
        pendingReorderRef.current = null;
      } catch (error) {
        console.error("Error saving order:", error);
      } finally {
        setSavingOrder(false);
      }
    }, 1500); // 1.5 second debounce
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (reorderTimeoutRef.current) {
        clearTimeout(reorderTimeoutRef.current);
      }
    };
  }, []);

  // Core insert/shift reorder logic - reusable by drag, move buttons, and position input
  const reorderImages = useCallback((fromIndex: number, toIndex: number) => {
    if (!selectedSet || fromIndex === toIndex) return;
    if (fromIndex < 0 || fromIndex >= selectedSet.images.length) return;
    if (toIndex < 0 || toIndex >= selectedSet.images.length) return;

    const newImages = [...selectedSet.images];
    // Remove from old position
    const [movedItem] = newImages.splice(fromIndex, 1);
    // Insert at new position (shift, not swap)
    newImages.splice(toIndex, 0, movedItem);

    // Update sequences
    const reorderedImages = newImages.map((img, idx) => ({
      ...img,
      sequence: idx + 1,
    }));

    // Optimistic update
    const updatedSet = { ...selectedSet, images: reorderedImages };
    setSelectedSet(updatedSet);
    setSets((prev) =>
      prev.map((s) => (s.id === selectedSet.id ? updatedSet : s)),
    );

    // Debounced save
    saveReorderDebounced(selectedSet.id, reorderedImages.map((img) => img.id));
  }, [selectedSet, saveReorderDebounced]);

  const handleDragEnd = useCallback(() => {
    if (draggedIndex === null || dragOverIndex === null || !selectedSet) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    if (draggedIndex !== dragOverIndex) {
      reorderImages(draggedIndex, dragOverIndex);
    }

    setDraggedIndex(null);
    setDragOverIndex(null);
  }, [draggedIndex, dragOverIndex, selectedSet, reorderImages]);

  // Move item up one position
  const handleMoveUp = useCallback((index: number) => {
    if (index > 0) reorderImages(index, index - 1);
  }, [reorderImages]);

  // Move item down one position
  const handleMoveDown = useCallback((index: number) => {
    if (selectedSet && index < selectedSet.images.length - 1) reorderImages(index, index + 1);
  }, [selectedSet, reorderImages]);

  // Move item to a specific 1-based position
  const handleMoveToPosition = useCallback((fromIndex: number, toPosition: number) => {
    const toIndex = toPosition - 1; // Convert 1-based to 0-based
    reorderImages(fromIndex, toIndex);
  }, [reorderImages]);

  // File drop zone handlers
  const handleFileDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes("Files")) {
      setIsDraggingFile(true);
    }
  };

  const handleFileDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);

    if (e.dataTransfer.files.length > 0 && selectedSet) {
      handleFileUpload(e.dataTransfer.files);
    }
  };

  // Folder (set) drag reorder handlers
  const handleFolderDragStart = useCallback((e: React.DragEvent, index: number) => {
    setFolderDragIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/folder-reorder", index.toString());
  }, []);

  const handleFolderDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    // Only respond to folder reorders, not file drops
    if (e.dataTransfer.types.includes("text/folder-reorder")) {
      setFolderDragOverIndex(index);
    }
  }, []);

  const handleFolderDragEnd = useCallback(() => {
    if (folderDragIndex === null || folderDragOverIndex === null || folderDragIndex === folderDragOverIndex) {
      setFolderDragIndex(null);
      setFolderDragOverIndex(null);
      return;
    }

    const newSets = [...sets];
    const [movedSet] = newSets.splice(folderDragIndex, 1);
    newSets.splice(folderDragOverIndex, 0, movedSet);

    // Optimistic update
    setSets(newSets);

    // Update selected set reference if needed
    if (selectedSet) {
      const updated = newSets.find(s => s.id === selectedSet.id);
      if (updated) setSelectedSet(updated);
    }

    setFolderDragIndex(null);
    setFolderDragOverIndex(null);

    // Debounced save
    if (folderReorderTimeoutRef.current) {
      clearTimeout(folderReorderTimeoutRef.current);
    }
    folderReorderTimeoutRef.current = setTimeout(async () => {
      try {
        setSavingFolderOrder(true);
        await fetch("/api/sexting-sets/reorder-sets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ setIds: newSets.map(s => s.id) }),
        });
      } catch (error) {
        console.error("Error saving folder order:", error);
        showToast("Failed to save folder order", "error");
      } finally {
        setSavingFolderOrder(false);
      }
    }, 1000);
  }, [folderDragIndex, folderDragOverIndex, sets, selectedSet]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup folder reorder timeout on unmount
  useEffect(() => {
    return () => {
      if (folderReorderTimeoutRef.current) {
        clearTimeout(folderReorderTimeoutRef.current);
      }
    };
  }, []);

  // Filtered sets based on search
  const filteredSets = useMemo(() => {
    if (!folderSearchQuery.trim()) return sets;
    const q = folderSearchQuery.toLowerCase();
    return sets.filter(s => s.name.toLowerCase().includes(q));
  }, [sets, folderSearchQuery]);

  // For "All Profiles" grouped view, flatten into a single items array for virtualizer
  const allProfileFolderItems = useMemo(() => {
    if (!isAllProfiles) return [];
    const items: Array<{ type: 'header'; profileName: string; count: number } | { type: 'set'; set: SextingSet }> = [];
    const grouped = filteredSets.reduce((acc, set) => {
      const profileName = set.profileName || "Unknown Profile";
      if (!acc[profileName]) acc[profileName] = [];
      acc[profileName].push(set);
      return acc;
    }, {} as Record<string, SextingSet[]>);
    for (const [profileName, profileSets] of Object.entries(grouped)) {
      items.push({ type: 'header', profileName, count: profileSets.length });
      for (const set of profileSets) {
        items.push({ type: 'set', set });
      }
    }
    return items;
  }, [isAllProfiles, filteredSets]);

  // Virtualizer refs
  const folderListRef = useRef<HTMLDivElement>(null);
  const contentGridRef = useRef<HTMLDivElement>(null);

  // Folder list virtualizer
  const folderVirtualizer = useVirtualizer({
    count: isAllProfiles ? allProfileFolderItems.length : filteredSets.length,
    getScrollElement: () => folderListRef.current,
    estimateSize: useCallback((index: number) => {
      if (isAllProfiles && allProfileFolderItems[index]?.type === 'header') return 28;
      return 32;
    }, [isAllProfiles, allProfileFolderItems]),
    overscan: 5,
  });

  // Grid column count - track responsive columns for virtualizing grid rows
  const [gridColumns, setGridColumns] = useState(3);
  useEffect(() => {
    const updateCols = () => {
      const w = window.innerWidth;
      // Matches: grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6
      // But content area is ~2/3 of viewport on lg+
      if (w >= 1024) setGridColumns(6);
      else if (w >= 768) setGridColumns(5);
      else if (w >= 640) setGridColumns(4);
      else setGridColumns(3);
    };
    updateCols();
    window.addEventListener('resize', updateCols);
    return () => window.removeEventListener('resize', updateCols);
  }, []);

  // Content grid virtualizer - virtualize rows of images
  const gridRowCount = useMemo(() => {
    if (!selectedSet) return 0;
    return Math.ceil(selectedSet.images.length / gridColumns);
  }, [selectedSet, gridColumns]);

  // Use a ref for row height so ResizeObserver can update it without recreating the virtualizer
  const estimatedRowHeightRef = useRef(160);
  const gridVirtualizerRef = useRef<ReturnType<typeof useVirtualizer<HTMLDivElement, Element>> | null>(null);

  const gridVirtualizer = useVirtualizer({
    count: gridRowCount,
    getScrollElement: () => contentGridRef.current,
    estimateSize: () => estimatedRowHeightRef.current,
    overscan: 5,
  });

  // Keep the ref up to date so ResizeObserver callback can call measure()
  gridVirtualizerRef.current = gridVirtualizer;

  // Dynamically measure the grid container so row heights are correct at any zoom level
  useEffect(() => {
    const el = contentGridRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      if (!width) return;
      const gap = 6; // gap-1.5 = 0.375rem = 6px
      const innerWidth = width - 16; // p-2 (8px) padding on each side
      const cellWidth = (innerWidth - (gridColumns - 1) * gap) / gridColumns;
      const rowHeight = Math.max(40, Math.ceil(cellWidth) + gap);
      if (Math.abs(rowHeight - estimatedRowHeightRef.current) > 2) {
        estimatedRowHeightRef.current = rowHeight;
        gridVirtualizerRef.current?.measure();
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  // Re-run when column count changes or a new set is selected (ref element may change)
  }, [gridColumns, selectedSet?.id]);

  // Stable callbacks for FolderItem to prevent re-renders
  const handleFolderSelect = useCallback((set: SextingSet) => {
    setSelectedSet(set);
    setExpandedSets((prev) => new Set([...prev, set.id]));
    setSelectedImageIds(new Set());
    setIsSelectMode(false);
  }, []);

  const handleFolderEditStart = useCallback((id: string, name: string) => {
    setEditingName(id);
    setTempName(name);
  }, []);

  const handleFolderEditCancel = useCallback(() => {
    setEditingName(null);
  }, []);

  const handleTempNameChange = useCallback((name: string) => {
    setTempName(name);
  }, []);

  // Toggle set expansion
  const toggleSetExpansion = (setId: string) => {
    setExpandedSets((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(setId)) {
        newSet.delete(setId);
      } else {
        newSet.add(setId);
      }
      return newSet;
    });
  };


  if (loading) {
    return (
      <div className="space-y-4">
        {/* Header Skeleton */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-muted rounded-xl animate-pulse" />
            <div className="space-y-1.5">
              <div className="h-5 w-44 bg-muted rounded animate-pulse" />
              <div className="h-3.5 w-28 bg-muted rounded animate-pulse" />
            </div>
          </div>
          <div className="h-9 w-28 bg-muted rounded-xl animate-pulse" />
        </div>

        {/* Content Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Sidebar Skeleton */}
          <div className="lg:col-span-1">
            <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
              <div className="px-3 py-2.5 border-b border-border">
                <div className="h-4 w-20 bg-muted rounded animate-pulse" />
              </div>
              <div className="py-0.5">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="h-8 mx-1 my-0.5 bg-muted rounded animate-pulse" />
                ))}
              </div>
            </div>
          </div>

          {/* Main Content Skeleton */}
          <div className="lg:col-span-2">
            <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
              <div className="px-3 py-2.5 border-b border-border">
                <div className="h-5 w-36 bg-muted rounded animate-pulse" />
              </div>
              <div className="p-2">
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-1.5">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => (
                    <div key={i} className="aspect-square bg-muted rounded-lg animate-pulse" />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header with gradient and tabs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-gradient-to-br from-[var(--color-brand-mid-pink)] to-[var(--color-brand-dark-pink)] rounded-lg shadow-md">
            <Flame className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-foreground">
                Sexting Set Organizer
              </h2>
              {isSharedProfile && !isAllProfiles && (
                <span className="flex items-center gap-1 px-1.5 py-0.5 bg-[var(--color-brand-blue)]/10 text-[var(--color-brand-blue)] text-[10px] font-medium rounded-full border border-[var(--color-brand-blue)]/30">
                  <Share2 className="w-2.5 h-2.5" />
                  Shared
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {isAllProfiles && <span>All Profiles • </span>}
              {isSharedProfile 
                ? `Viewing ${getSharedProfileOwnerName ? `${getSharedProfileOwnerName}'s` : "shared"} sets`
                : `${sets.length} set${sets.length !== 1 ? "s" : ""} • Drag to reorder`}
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          disabled={isAllProfiles}
          className={`flex items-center gap-2 px-3 py-2 sm:px-3.5 sm:py-2 min-h-[40px] rounded-lg font-medium shadow-md transition-all duration-200 text-sm ${
            isAllProfiles
              ? "bg-muted text-muted-foreground cursor-not-allowed"
              : "bg-gradient-to-r from-[var(--color-brand-mid-pink)] to-[var(--color-brand-dark-pink)] hover:from-[var(--color-brand-light-pink)] hover:to-[var(--color-brand-mid-pink)] text-white hover:scale-105 active:scale-95"
          }`}
          title={isAllProfiles ? "Select a specific profile to create a new set" : "Create a new set"}
        >
          <FolderPlus className="w-4 h-4" />
          <span className="hidden sm:inline">New Set</span>
        </button>
      </div>

      {/* Shared Profile Notice */}
      {isSharedProfile && !isAllProfiles && (
        <div className="flex items-center gap-2 px-3 py-2 bg-[var(--color-brand-blue)]/10 border border-[var(--color-brand-blue)]/30 rounded-lg">
          <Info className="w-4 h-4 text-[var(--color-brand-blue)] shrink-0" />
          <p className="text-xs text-foreground">
            Viewing a shared profile{getSharedProfileOwnerName ? ` from ${getSharedProfileOwnerName}` : ""}. 
            You can view, organize, and add content.
          </p>
        </div>
      )}

      {/* All Profiles Notice */}
      {isAllProfiles && (
        <div className="flex items-center gap-2 px-3 py-2 bg-[var(--color-brand-mid-pink)]/10 border border-[var(--color-brand-mid-pink)]/30 rounded-lg">
          <Users className="w-4 h-4 text-[var(--color-brand-mid-pink)] shrink-0" />
          <p className="text-xs text-foreground">
            Viewing sets from all profiles. Select a specific profile for full actions.
          </p>
        </div>
      )}

      {/* Main content area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Sets sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
            {/* Sidebar header */}
            <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                {isAllProfiles ? (
                  <>
                    <Users className="w-3.5 h-3.5 text-[var(--color-brand-mid-pink)]" />
                    All Sets
                  </>
                ) : (
                  <>
                    <Heart className="w-3.5 h-3.5 text-[var(--color-brand-mid-pink)]" />
                    Sets
                  </>
                )}
                <span className="text-xs text-muted-foreground font-normal ml-1">({sets.length})</span>
              </h3>
              {savingFolderOrder && (
                <span className="text-xs text-[var(--color-brand-mid-pink)] flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Saving...
                </span>
              )}
            </div>

            {/* Search input */}
            {sets.length > 5 && (
              <div className="px-2 py-1.5 border-b border-border">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search sets..."
                    value={folderSearchQuery}
                    onChange={(e) => setFolderSearchQuery(e.target.value)}
                    className="w-full pl-7 pr-2 py-1.5 bg-muted/50 border border-transparent rounded-lg text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-[var(--color-brand-mid-pink)]/40 focus:bg-background transition-colors"
                  />
                </div>
              </div>
            )}

            {sets.length === 0 ? (
              <div className="text-center py-8 px-3">
                <Sparkles className="w-8 h-8 text-[var(--color-brand-mid-pink)] mx-auto mb-2" />
                <p className="text-foreground text-sm font-medium">No sets yet</p>
                {!isAllProfiles && (
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="mt-2 text-[var(--color-brand-mid-pink)] hover:text-[var(--color-brand-dark-pink)] text-sm font-medium transition-colors"
                  >
                    Create your first set
                  </button>
                )}
              </div>
            ) : (
              <div
                ref={folderListRef}
                className="max-h-[calc(100vh-280px)] overflow-y-auto custom-scrollbar"
              >
                <div
                  style={{
                    height: `${folderVirtualizer.getTotalSize()}px`,
                    width: '100%',
                    position: 'relative',
                  }}
                >
                  {folderVirtualizer.getVirtualItems().map((virtualRow) => {
                    if (isAllProfiles) {
                      const item = allProfileFolderItems[virtualRow.index];
                      if (item.type === 'header') {
                        return (
                          <div
                            key={`header-${item.profileName}`}
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: '100%',
                              height: `${virtualRow.size}px`,
                              transform: `translateY(${virtualRow.start}px)`,
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-muted/30 border-b border-border"
                          >
                            <User className="w-3 h-3 text-[var(--color-brand-mid-pink)]" />
                            <span className="text-xs font-medium text-[var(--color-brand-mid-pink)]">{item.profileName}</span>
                            <span className="text-[10px] text-muted-foreground">({item.count})</span>
                          </div>
                        );
                      }
                      const set = item.set;
                      return (
                        <div
                          key={set.id}
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: `${virtualRow.size}px`,
                            transform: `translateY(${virtualRow.start}px)`,
                          }}
                        >
                          <FolderItem
                            set={set}
                            isSelected={selectedSet?.id === set.id}
                            isEditing={editingName === set.id}
                            tempName={tempName}
                            onSelect={handleFolderSelect}
                            onEditStart={handleFolderEditStart}
                            onEditSave={updateSetName}
                            onEditCancel={handleFolderEditCancel}
                            onTempNameChange={handleTempNameChange}
                            onDelete={deleteSet}
                          />
                        </div>
                      );
                    } else {
                      const set = filteredSets[virtualRow.index];
                      const actualIndex = sets.indexOf(set);
                      return (
                        <div
                          key={set.id}
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: `${virtualRow.size}px`,
                            transform: `translateY(${virtualRow.start}px)`,
                          }}
                        >
                          <FolderItem
                            set={set}
                            isSelected={selectedSet?.id === set.id}
                            isEditing={editingName === set.id}
                            tempName={tempName}
                            onSelect={handleFolderSelect}
                            onEditStart={handleFolderEditStart}
                            onEditSave={updateSetName}
                            onEditCancel={handleFolderEditCancel}
                            onTempNameChange={handleTempNameChange}
                            onDelete={deleteSet}
                            showDragHandle
                            draggable
                            isDragTarget={folderDragOverIndex === actualIndex}
                            isDragging={folderDragIndex === actualIndex}
                            onDragStart={handleFolderDragStart}
                            onDragOver={handleFolderDragOver}
                            onDragEnd={handleFolderDragEnd}
                            dragIndex={actualIndex}
                          />
                        </div>
                      );
                    }
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Image organizer area */}
        <div className="lg:col-span-2">
          {selectedSet ? (
            <div
              className={`bg-card border rounded-xl overflow-hidden shadow-sm transition-colors ${
                isDraggingFile ? "border-[var(--color-brand-mid-pink)] ring-2 ring-[var(--color-brand-mid-pink)]/30" : "border-border"
              }`}
              onDragOver={handleFileDragOver}
              onDragLeave={handleFileDragLeave}
              onDrop={handleFileDrop}
            >
              {/* Header */}
              <div className="px-3 py-2.5 border-b border-border">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground text-base truncate">
                        {selectedSet.name}
                      </h3>
                      {isAllProfiles && selectedSet.profileName && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-brand-mid-pink)]/10 text-[var(--color-brand-mid-pink)] shrink-0">
                          {selectedSet.profileName}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground shrink-0">
                        {selectedSet.images.length} item{selectedSet.images.length !== 1 ? "s" : ""}
                      </span>
                      {savingOrder && (
                        <span className="text-xs text-[var(--color-brand-mid-pink)] shrink-0">• Saving...</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Select mode toggle */}
                    {selectedSet.images.length > 0 && (
                      <button
                        onClick={() => {
                          setIsSelectMode((v) => !v);
                          setSelectedImageIds(new Set());
                        }}
                        className={`flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-xl font-medium text-sm transition-all duration-200 border ${
                          isSelectMode
                            ? 'bg-[var(--color-brand-mid-pink)]/10 border-[var(--color-brand-mid-pink)]/50 text-[var(--color-brand-mid-pink)]'
                            : 'bg-muted hover:bg-muted/80 border-border text-foreground'
                        }`}
                        title={isSelectMode ? 'Exit selection' : 'Select images'}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span className="hidden sm:inline">{isSelectMode ? 'Cancel' : 'Select'}</span>
                      </button>
                    )}
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={(e) => handleFileUpload(e.target.files)}
                      multiple
                      accept="image/*,video/*,audio/*"
                      className="hidden"
                    />
                    
                    {/* Upload Progress - shown outside dropdown */}
                    {uploading && uploadProgress && (
                      <div className="flex items-center gap-2 px-4 py-2 bg-[var(--color-brand-mid-pink)]/10 border border-[var(--color-brand-mid-pink)]/30 rounded-xl">
                        <Loader2 className="w-4 h-4 text-[var(--color-brand-mid-pink)] animate-spin" />
                        <span className="text-sm text-foreground">
                          Uploading {uploadProgress.current}/{uploadProgress.total}
                        </span>
                      </div>
                    )}
                    
                    {/* Save to Vault button - always visible when there are images */}
                    {selectedSet.images.length > 0 && (
                      <button
                        onClick={openExportModal}
                        className="flex items-center gap-2 px-3 sm:px-4 py-2 min-h-[44px] bg-gradient-to-r from-purple-500 to-violet-500 hover:from-purple-600 hover:to-violet-600 active:scale-95 text-white rounded-xl font-medium transition-all duration-200 shadow-lg"
                      >
                        <FolderOutput className="w-4 h-4" />
                        <span className="hidden sm:inline">Save to Vault</span>
                        <span className="sm:hidden">Save</span>
                      </button>
                    )}
                    
                    {/* More actions dropdown */}
                    <div className="relative">
                      <button
                        ref={actionsButtonRef}
                        onClick={() => setShowActionsMenu(!showActionsMenu)}
                        className="flex items-center gap-2 px-3 sm:px-4 py-2 min-h-[44px] bg-muted hover:bg-muted/80 active:scale-95 border border-border text-foreground rounded-xl font-medium transition-all duration-200"
                      >
                        <PlusCircle className="w-4 h-4" />
                        <span className="hidden sm:inline">Actions</span>
                        <ChevronDown className={`w-4 h-4 transition-transform ${showActionsMenu ? 'rotate-180' : ''}`} />
                      </button>
                      
                      {/* Actions dropdown portal */}
                      {showActionsMenu && mounted && actionsMenuPosition && createPortal(
                        <div 
                          ref={actionsMenuRef}
                          className="fixed w-56 bg-card border border-border rounded-xl shadow-xl z-[9999] py-2 overflow-hidden"
                          style={{
                            top: actionsMenuPosition.top,
                            left: actionsMenuPosition.left,
                          }}
                        >
                          <button
                            onClick={() => { fileInputRef.current?.click(); setShowActionsMenu(false); }}
                            disabled={uploading}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-foreground hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Upload className="w-4 h-4 text-[var(--color-brand-mid-pink)]" />
                            <span>Upload Files</span>
                          </button>
                          <div className="border-t border-border my-2" />
                          <button
                            onClick={() => { openImportModal(); setShowActionsMenu(false); }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-foreground hover:bg-muted transition-colors"
                          >
                            <FolderInput className="w-4 h-4 text-emerald-500" />
                            <span>Import from Vault</span>
                          </button>
                          <button
                            onClick={() => { openGoogleDriveModal(); setShowActionsMenu(false); }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-foreground hover:bg-muted transition-colors"
                          >
                            <HardDrive className="w-4 h-4 text-[var(--color-brand-blue)]" />
                            <span>Import from Google Drive</span>
                          </button>
                          <div className="border-t border-border my-2" />
                          <button
                            onClick={() => { openPushToBoardModal(); setShowActionsMenu(false); }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-foreground hover:bg-muted transition-colors"
                          >
                            <Send className="w-4 h-4 text-[var(--color-brand-light-pink)]" />
                            <span>Push to Board</span>
                          </button>
                          <div className="border-t border-border my-2" />
                          <button
                            onClick={() => { setShowKeycardModal(true); setShowActionsMenu(false); }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-foreground hover:bg-muted transition-colors"
                          >
                            <FileText className="w-4 h-4 text-indigo-500" />
                            <span>Generate Keycard</span>
                          </button>
                          <button
                            onClick={() => { setShowVoiceModal(true); setShowActionsMenu(false); }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-foreground hover:bg-muted transition-colors"
                          >
                            <Mic className="w-4 h-4 text-violet-500" />
                            <span>Generate Voice</span>
                          </button>
                        </div>,
                        document.body
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Bulk action bar */}
              {isSelectMode && (
                <div className="px-3 py-2 border-b border-border bg-[var(--color-brand-mid-pink)]/5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        if (selectedImageIds.size === selectedSet.images.length) {
                          setSelectedImageIds(new Set());
                        } else {
                          setSelectedImageIds(new Set(selectedSet.images.map((i) => i.id)));
                        }
                      }}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 bg-muted hover:bg-muted/80 border border-border rounded-lg text-sm font-medium text-foreground transition-colors"
                    >
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                        selectedImageIds.size === selectedSet.images.length
                          ? 'bg-[var(--color-brand-mid-pink)] border-[var(--color-brand-mid-pink)]'
                          : 'border-muted-foreground'
                      }`}>
                        {selectedImageIds.size === selectedSet.images.length && <Check className="w-2.5 h-2.5 text-white" />}
                      </div>
                      {selectedImageIds.size === selectedSet.images.length ? 'Deselect All' : 'Select All'}
                    </button>
                    <span className="text-xs text-muted-foreground">
                      {selectedImageIds.size > 0 ? `${selectedImageIds.size} selected` : 'None selected'}
                    </span>
                  </div>
                  {selectedImageIds.size > 0 && (
                    <button
                      onClick={bulkDeleteImages}
                      disabled={bulkDeleting}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-500 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      {bulkDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      Delete {selectedImageIds.size}
                    </button>
                  )}
                </div>
              )}

              {/* Images grid */}
              <div
                ref={contentGridRef}
                className="p-2 max-h-[calc(100vh-220px)] overflow-y-auto custom-scrollbar"
              >
                {selectedSet.images.length === 0 ? (
                  <div
                    className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                      isDraggingFile
                        ? "border-[var(--color-brand-mid-pink)] bg-[var(--color-brand-mid-pink)]/10"
                        : "border-border hover:border-[var(--color-brand-mid-pink)]/50"
                    }`}
                  >
                    <Upload
                      className={`w-10 h-10 mx-auto mb-3 ${
                        isDraggingFile ? "text-[var(--color-brand-mid-pink)]" : "text-muted-foreground"
                      }`}
                    />
                    <p
                      className={`font-medium text-sm ${
                        isDraggingFile ? "text-[var(--color-brand-mid-pink)]" : "text-muted-foreground"
                      }`}
                    >
                      {isDraggingFile
                        ? "Drop your files here!"
                        : "Drop images or videos here"}
                    </p>
                    <p className="text-muted-foreground text-xs mt-1">
                      or click upload to browse
                    </p>
                  </div>
                ) : (
                  <div
                    style={{
                      height: `${gridVirtualizer.getTotalSize()}px`,
                      width: '100%',
                      position: 'relative',
                    }}
                  >
                    {gridVirtualizer.getVirtualItems().map((virtualRow) => {
                      const startIdx = virtualRow.index * gridColumns;
                      const rowImages = selectedSet.images.slice(startIdx, startIdx + gridColumns);
                      return (
                        <div
                          key={virtualRow.index}
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: `${virtualRow.size}px`,
                            transform: `translateY(${virtualRow.start}px)`,
                          }}
                          className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-1.5"
                        >
                          {rowImages.map((image, colIdx) => (
                            <ImageCard
                              key={image.id}
                              image={image}
                              index={startIdx + colIdx}
                              totalImages={selectedSet.images.length}
                              isMobile={isMobile}
                              draggedIndex={draggedIndex}
                              dragOverIndex={dragOverIndex}
                              touchOffsetValue={touchOffset?.id === image.id ? touchOffset.offset : 0}
                              isSelected={selectedImageIds.has(image.id)}
                              isSelectMode={isSelectMode}
                              onToggleSelect={toggleImageSelection}
                              onDragStart={handleDragStart}
                              onDragOver={handleDragOver}
                              onDragEnd={handleDragEnd}
                              onClick={openImageDetail}
                              onDelete={handleDeleteCurrentSetImage}
                              onMoveUp={handleMoveUp}
                              onMoveDown={handleMoveDown}
                              onMoveToPosition={handleMoveToPosition}
                              onTouchStart={handleTouchStart}
                              onTouchMove={handleTouchMove}
                              onTouchEnd={handleTouchEnd}
                            />
                          ))}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl p-8 text-center shadow-sm">
              <Sparkles className="w-12 h-12 text-[var(--color-brand-mid-pink)]/30 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-foreground mb-1">
                Select a Set
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Choose a set from the sidebar to organize your content
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[var(--color-brand-mid-pink)] to-[var(--color-brand-dark-pink)] hover:from-[var(--color-brand-light-pink)] hover:to-[var(--color-brand-mid-pink)] text-white rounded-xl font-medium shadow-lg transition-all duration-200"
              >
                <FolderPlus className="w-5 h-5" />
                Create New Set
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Create Modal - React Portal */}
      {showCreateModal &&
        typeof document !== "undefined" &&
        createPortal(
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={() => {
              setShowCreateModal(false);
              setNewSetName("");
            }}
          >
            <div 
              className="bg-card border-t sm:border border-border rounded-t-2xl sm:rounded-2xl w-full max-w-md shadow-2xl animate-in slide-in-from-bottom-full sm:zoom-in-95 duration-300"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-[var(--color-brand-mid-pink)] to-[var(--color-brand-dark-pink)] rounded-xl">
                    <FolderPlus className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">
                    Create New Set
                  </h3>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Set Name
                  </label>
                  <input
                    type="text"
                    value={newSetName}
                    onChange={(e) => setNewSetName(e.target.value)}
                    placeholder="e.g., Valentine's Day Set"
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-mid-pink)] focus:border-transparent"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") createSet();
                    }}
                  />
                </div>
              </div>

              <div className="p-6 border-t border-border flex gap-3">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewSetName("");
                  }}
                  className="flex-1 px-4 py-2.5 bg-muted hover:bg-muted/80 text-foreground rounded-xl font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={createSet}
                  disabled={!newSetName.trim() || creating}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-[var(--color-brand-mid-pink)] to-[var(--color-brand-dark-pink)] hover:from-[var(--color-brand-light-pink)] hover:to-[var(--color-brand-mid-pink)] text-white rounded-xl font-medium shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {creating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Create Set
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Export to Vault Modal - React Portal */}
      {showExportModal &&
        selectedSet &&
        typeof document !== "undefined" &&
        createPortal(
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={() => {
              if (!exporting) {
                setShowExportModal(false);
                setExportSuccess(null);
                setExportFolderName("");
              }
            }}
          >
            <div 
              className="bg-card border-t sm:border border-border rounded-t-2xl sm:rounded-2xl w-full max-w-md shadow-2xl animate-in slide-in-from-bottom-full sm:zoom-in-95 duration-300"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl">
                    <FolderOutput className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">
                      Save to Vault
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {selectedSet.images.length} item
                      {selectedSet.images.length !== 1 ? "s" : ""} from "
                      {selectedSet.name}"
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-4">
                {exportSuccess ? (
                  <div className="text-center py-6">
                    <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle2 className="w-8 h-8 text-green-500" />
                    </div>
                    <h4 className="text-lg font-semibold text-foreground mb-2">
                      Export Complete!
                    </h4>
                    <p className="text-muted-foreground">
                      {exportSuccess.itemCount} item
                      {exportSuccess.itemCount !== 1 ? "s" : ""} exported to{" "}
                      <span className="text-purple-500">
                        {exportSuccess.folderName}
                      </span>
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Profile Selector - shown when viewing All Profiles */}
                    {isAllProfiles && (
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                          Save to Profile
                        </label>
                        {loadingProfiles ? (
                          <div className="flex items-center gap-2 px-4 py-3 bg-muted border border-border rounded-xl">
                            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                            <span className="text-muted-foreground">Loading profiles...</span>
                          </div>
                        ) : (
                          <select
                            value={selectedExportProfileId || ""}
                            onChange={(e) => setSelectedExportProfileId(e.target.value)}
                            className="w-full px-4 py-3 bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          >
                            <option value="" disabled>Select a profile</option>
                            {profiles.map((profile) => (
                              <option key={profile.id} value={profile.id}>
                                {profile.name}
                              </option>
                            ))}
                          </select>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">
                          Choose which profile&apos;s vault to save to
                        </p>
                      </div>
                    )}
                    
                    {/* Folder Name */}
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Folder Name
                      </label>
                      <input
                        type="text"
                        value={exportFolderName}
                        onChange={(e) => setExportFolderName(e.target.value)}
                        placeholder="e.g., Valentine's Day Collection"
                        className="w-full px-4 py-3 bg-background border border-border rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                      <p className="text-xs text-muted-foreground mt-2">
                        A new folder will be created in your Vault with this
                        name
                      </p>
                    </div>
                  </>
                )}
              </div>

              {!exportSuccess && (
                <div className="p-6 border-t border-border flex gap-3">
                  <button
                    onClick={() => {
                      setShowExportModal(false);
                      setExportFolderName("");
                    }}
                    className="flex-1 px-4 py-2.5 bg-muted hover:bg-muted/80 text-foreground rounded-xl font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={exportToVault}
                    disabled={
                      exporting ||
                      (isAllProfiles ? !selectedExportProfileId : !profileId) ||
                      !exportFolderName.trim()
                    }
                    className="flex-1 px-4 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white rounded-xl font-medium shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {exporting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Exporting...
                      </>
                    ) : (
                      <>
                        <FolderOutput className="w-4 h-4" />
                        Export as Folder
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}

      {/* Import from Vault Modal - React Portal */}
      {showImportModal &&
        selectedSet &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => {
              if (!importing) {
                setShowImportModal(false);
                setSelectedVaultFolderId(null);
                setSelectedVaultItems(new Set());
                setVaultItems([]);
                setImportSuccess(null);
              }
            }}
          >
            <div
              className="bg-card border border-border rounded-2xl w-full max-w-4xl max-h-[85vh] shadow-2xl flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-6 border-b border-border shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl">
                    <FolderInput className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">
                      Import from Vault
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Add images to "{selectedSet.name}"
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-6 flex-1 overflow-y-auto">
                {importSuccess ? (
                  <div className="text-center py-6">
                    <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle2 className="w-8 h-8 text-green-500" />
                    </div>
                    <h4 className="text-xl font-semibold text-foreground mb-2">
                      Import Successful!
                    </h4>
                    <p className="text-muted-foreground">
                      {importSuccess.itemCount} item
                      {importSuccess.itemCount !== 1 ? "s" : ""} imported to{" "}
                      "{selectedSet.name}"
                    </p>
                  </div>
                ) : (
                  <div className="flex gap-6">
                    {/* Folder Selection */}
                    <div className="w-64 shrink-0">
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Select Folder
                      </label>
                      {loadingVaultFolders ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        </div>
                      ) : vaultFolders.filter(f => f.name !== 'All Media').length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <Folder className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No folders found</p>
                        </div>
                      ) : (
                        <div className="space-y-1 max-h-[400px] overflow-y-auto pr-2">
                          {vaultFolders.filter(f => f.name !== 'All Media').map((folder) => (
                            <button
                              key={folder.id}
                              onClick={() => handleVaultFolderSelect(folder.id)}
                              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all ${
                                selectedVaultFolderId === folder.id
                                  ? "bg-emerald-500/20 border border-emerald-500/50 text-emerald-500"
                                  : "bg-muted/50 hover:bg-muted text-foreground border border-transparent"
                              }`}
                            >
                              <Folder className="w-4 h-4 shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm">{folder.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {folder._count?.items || 0} items
                                </p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Items Grid */}
                    <div className="flex-1 min-w-0">
                      {selectedVaultFolderId ? (
                        <>  <div className="flex items-center justify-between mb-3">
                            <label className="text-sm font-medium text-foreground">
                              Select Items ({selectedVaultItems.size} selected)
                            </label>
                            {vaultItems.length > 0 && (
                              <button
                                onClick={selectAllVaultItems}
                                className="text-sm text-emerald-500 hover:text-emerald-600 transition-colors"
                              >
                                {selectedVaultItems.size === vaultItems.length
                                  ? "Deselect All"
                                  : "Select All"}
                              </button>
                            )}
                          </div>
                          {loadingVaultItems ? (
                            <div className="flex items-center justify-center py-12">
                              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                            </div>
                          ) : vaultItems.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                              <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                              <p className="text-sm">No media files in this folder</p>
                            </div>
                          ) : (
                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[350px] overflow-y-auto pr-2">
                              {vaultItems.map((item) => (
                                <div
                                  key={item.id}
                                  onClick={() => toggleVaultItemSelection(item.id)}
                                  className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${
                                    selectedVaultItems.has(item.id)
                                      ? "border-emerald-500 ring-2 ring-emerald-500/30"
                                      : "border-transparent hover:border-border"
                                  }`}
                                >
                                  {item.fileType.startsWith("video/") ? (
                                    <video
                                      src={item.awsS3Url}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : item.fileType.startsWith("audio/") ? (
                                    <div className="w-full h-full bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex flex-col items-center justify-center p-2">
                                      <Music className="w-8 h-8 text-violet-500 mb-1" />
                                      <p className="text-xs text-muted-foreground text-center truncate w-full px-1">
                                        {item.fileName}
                                      </p>
                                    </div>
                                  ) : (
                                    <img
                                      src={item.awsS3Url}
                                      alt={item.fileName}
                                      className="w-full h-full object-cover"
                                    />
                                  )}
                                  {selectedVaultItems.has(item.id) && (
                                    <div className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center">
                                      <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                                    </div>
                                  )}
                                  {item.fileType.startsWith("video/") && (
                                    <div className="absolute bottom-1 right-1 bg-black/70 rounded px-1">
                                      <Video className="w-3 h-3 text-white" />
                                    </div>
                                  )}
                                  {item.fileType.startsWith("audio/") && (
                                    <div className="absolute bottom-1 right-1 bg-black/70 rounded px-1">
                                      <Volume2 className="w-3 h-3 text-white" />
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                          <div className="text-center">
                            <Folder className="w-12 h-12 mx-auto mb-2 opacity-50" />
                            <p>Select a folder to view items</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {!importSuccess && (
                <div className="p-6 border-t border-border flex gap-3 shrink-0">
                  <button
                    onClick={() => {
                      setShowImportModal(false);
                      setSelectedVaultFolderId(null);
                      setSelectedVaultItems(new Set());
                      setVaultItems([]);
                    }}
                    disabled={importing}
                    className="flex-1 px-4 py-2.5 bg-muted hover:bg-muted/80 text-foreground rounded-xl font-medium transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={importFromVault}
                    disabled={importing || selectedVaultItems.size === 0}
                    className="flex-1 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-xl font-medium shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {importing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <FolderInput className="w-4 h-4" />
                        Import {selectedVaultItems.size} Item{selectedVaultItems.size !== 1 ? "s" : ""}
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}

      {/* Import from Google Drive Modal - React Portal */}
      {showGoogleDriveModal &&
        selectedSet &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => {
              if (!importingFromGoogleDrive) {
                setShowGoogleDriveModal(false);
                setSelectedGoogleDriveFiles(new Set());
                setGoogleDriveFiles([]);
                setGoogleDriveImportSuccess(null);
                setGoogleDriveError(null);
              }
            }}
          >
            <div
              className="bg-card border border-border rounded-2xl w-full max-w-6xl max-h-[90vh] shadow-2xl flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-6 border-b border-border shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-gradient-to-br from-[var(--color-brand-blue)] to-cyan-600 rounded-xl">
                    <HardDrive className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-foreground">
                      Import from Google Drive
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Add files to "{selectedSet.name}"
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-6 flex-1 overflow-y-auto">
                {googleDriveImportSuccess ? (
                  <div className="text-center py-6">
                    <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle2 className="w-8 h-8 text-green-500" />
                    </div>
                    <h4 className="text-xl font-semibold text-foreground mb-2">
                      Import Successful!
                    </h4>
                    <p className="text-muted-foreground">
                      {googleDriveImportSuccess.itemCount} file
                      {googleDriveImportSuccess.itemCount !== 1 ? "s" : ""} imported to{" "}
                      "{selectedSet.name}"
                    </p>
                  </div>
                ) : !googleDriveAccessToken ? (
                  <div className="text-center py-12">
                    <div className="w-20 h-20 bg-[var(--color-brand-blue)]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                      <HardDrive className="w-10 h-10 text-[var(--color-brand-blue)]" />
                    </div>
                    <h4 className="text-xl font-semibold text-foreground mb-2">
                      Connect to Google Drive
                    </h4>
                    <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                      To import files from Google Drive, you need to connect your account first.
                    </p>
                    <button
                      onClick={connectToGoogleDrive}
                      className="px-6 py-3 bg-gradient-to-r from-[var(--color-brand-blue)] to-cyan-500 hover:from-[var(--color-brand-blue)] hover:to-cyan-600 text-white rounded-xl font-medium shadow-lg transition-all duration-200 flex items-center gap-2 mx-auto"
                    >
                      <HardDrive className="w-5 h-5" />
                      Connect Google Drive
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-5">
                    {/* Link Input Section */}
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-2 text-foreground">
                        <Link className="w-5 h-5 text-[var(--color-brand-blue)]" />
                        <span className="font-medium">Paste a Google Drive folder link to browse</span>
                      </div>
                      <div className="flex gap-2 p-4 bg-muted/30 rounded-xl border border-border">
                        <div className="flex-1 relative">
                          <ExternalLink className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <input
                            type="text"
                            placeholder="Paste Google Drive folder link here..."
                            value={googleDriveLinkInput}
                            onChange={(e) => setGoogleDriveLinkInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && googleDriveLinkInput.trim()) {
                                browseGoogleDriveLink();
                              }
                            }}
                            className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:border-[var(--color-brand-blue)]/50 focus:ring-1 focus:ring-[var(--color-brand-blue)]/30 transition-all text-sm"
                          />
                        </div>
                        <button
                          onClick={browseGoogleDriveLink}
                          disabled={loadingGoogleDriveFiles || !googleDriveLinkInput.trim()}
                          className="px-5 py-2.5 bg-[var(--color-brand-blue)] hover:bg-[var(--color-brand-blue)]/90 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Browse
                        </button>
                      </div>
                    </div>

                    {/* Breadcrumb Navigation */}
                    <div className="flex items-center gap-1 text-sm bg-muted/30 rounded-xl px-4 py-2.5 overflow-x-auto">
                      {googleDriveBreadcrumbs.map((crumb, index) => (
                        <div key={index} className="flex items-center">
                          {index > 0 && <ChevronRight className="w-4 h-4 text-muted-foreground mx-1" />}
                          <button
                            onClick={() => navigateToBreadcrumb(index)}
                            className={`px-2 py-1 rounded-lg hover:bg-muted transition-colors truncate max-w-[180px] ${
                              index === googleDriveBreadcrumbs.length - 1
                                ? "text-[var(--color-brand-blue)] font-medium bg-[var(--color-brand-blue)]/10"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {crumb.name}
                          </button>
                        </div>
                      ))}
                      <div className="ml-auto flex items-center gap-2">
                        <button
                          onClick={() => fetchGoogleDriveContents(currentGoogleDriveFolderId)}
                          disabled={loadingGoogleDriveFiles}
                          className="p-2 bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground rounded-lg transition-all"
                          title="Refresh"
                        >
                          <RefreshCw className={`w-4 h-4 ${loadingGoogleDriveFiles ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                          onClick={() => {
                            setGoogleDriveAccessToken(null);
                            localStorage.removeItem('googleDriveAccessToken');
                            setGoogleDriveFiles([]);
                            setGoogleDriveFolders([]);
                            setGoogleDriveBreadcrumbs([{ id: null, name: 'My Drive' }]);
                            setGoogleDriveLinkInput('');
                            setGoogleDriveError(null);
                          }}
                          className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg transition-all"
                          title="Sign out of Google Drive"
                        >
                          <LogOut className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {googleDriveError && (
                      <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-500 text-sm flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium">{googleDriveError.includes("permission") || googleDriveError.includes("access") ? "Access Denied" : "Error"}</p>
                          <p className="text-red-500/80 mt-1">{googleDriveError}</p>
                        </div>
                      </div>
                    )}

                    {/* Content Area */}
                    {loadingGoogleDriveFiles ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : googleDriveFolders.length === 0 && googleDriveFiles.length === 0 && !googleDriveError ? (
                      <div className="text-center py-12 text-muted-foreground bg-muted/30 rounded-xl border border-border">
                        <Folder className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p className="text-base font-medium">This folder is empty</p>
                        <p className="text-sm mt-1">
                          {googleDriveBreadcrumbs.length > 1 
                            ? "Go back or paste a different folder link"
                            : "Paste a folder link above to browse its contents"}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-5">
                        {/* Folders */}
                        {googleDriveFolders.length > 0 && (
                          <div>
                            <label className="block text-sm font-medium text-foreground mb-3">
                              📁 Folders ({googleDriveFolders.length})
                            </label>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[200px] overflow-y-auto pr-2">
                              {googleDriveFolders.map((folder) => (
                                <button
                                  key={folder.id}
                                  onClick={() => {
                                    setIsGoogleDriveSearchMode(false);
                                    navigateToGoogleDriveFolder(folder);
                                  }}
                                  className="flex items-center gap-3 px-4 py-3 bg-muted/50 hover:bg-muted rounded-xl text-left transition-all border border-border hover:border-[var(--color-brand-blue)]/30 group"
                                >
                                  <div className="p-2 bg-yellow-500/10 rounded-lg group-hover:bg-yellow-500/20 transition-colors">
                                    <Folder className="w-5 h-5 text-yellow-500" />
                                  </div>
                                  <span className="text-sm text-foreground truncate flex-1">{folder.name}</span>
                                  {folder.shared && (
                                    <Users className="w-4 h-4 text-muted-foreground shrink-0" />
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Files */}
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <label className="text-sm font-medium text-foreground">
                              🖼️ Media Files ({googleDriveFiles.length})
                              {selectedGoogleDriveFiles.size > 0 && (
                                <span className="ml-2 px-2 py-0.5 bg-[var(--color-brand-blue)]/10 text-[var(--color-brand-blue)] rounded-full text-xs border border-[var(--color-brand-blue)]/30">
                                  {selectedGoogleDriveFiles.size} selected
                                </span>
                              )}
                            </label>
                            {googleDriveFiles.length > 0 && (
                              <button
                                onClick={selectAllGoogleDriveFiles}
                                className="text-sm text-[var(--color-brand-blue)] hover:text-[var(--color-brand-blue)]/80 px-3 py-1 rounded-lg hover:bg-[var(--color-brand-blue)]/10 transition-colors"
                              >
                                {selectedGoogleDriveFiles.size === googleDriveFiles.length
                                  ? "Deselect All"
                                  : "Select All"}
                              </button>
                            )}
                          </div>

                          {googleDriveFiles.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground bg-muted/30 rounded-xl">
                              <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                              <p className="text-base">No media files found</p>
                              <p className="text-sm mt-1">
                                {isGoogleDriveSearchMode 
                                  ? "Try a different search term" 
                                  : "Browse into folders or search to find images, videos, and audio files"}
                              </p>
                            </div>
                          ) : (
                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 max-h-[320px] overflow-y-auto pr-2">
                              {googleDriveFiles.map((file) => (
                                <div
                                  key={file.id}
                                  onClick={() => toggleGoogleDriveFileSelection(file.id)}
                                  className={`relative aspect-square rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${
                                    selectedGoogleDriveFiles.has(file.id)
                                      ? "border-[var(--color-brand-blue)] ring-2 ring-[var(--color-brand-blue)]/30"
                                      : "border-transparent hover:border-border"
                                  }`}
                                >
                                  {file.mimeType?.startsWith("video/") ? (
                                    file.thumbnailLink ? (
                                      <img
                                        src={file.thumbnailLink}
                                        alt={file.name}
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <div className="w-full h-full bg-gradient-to-br from-muted to-muted/80 flex flex-col items-center justify-center p-2">
                                        <Video className="w-8 h-8 text-muted-foreground mb-1" />
                                        <p className="text-xs text-muted-foreground text-center truncate w-full px-1">
                                          {file.name}
                                        </p>
                                      </div>
                                    )
                                  ) : file.mimeType?.startsWith("audio/") ? (
                                    <div className="w-full h-full bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex flex-col items-center justify-center p-2">
                                      <Music className="w-8 h-8 text-violet-500 mb-1" />
                                      <p className="text-xs text-muted-foreground text-center truncate w-full px-1">
                                        {file.name}
                                      </p>
                                    </div>
                                  ) : file.thumbnailLink ? (
                                    <img
                                      src={file.thumbnailLink}
                                      alt={file.name}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-full h-full bg-gradient-to-br from-muted to-muted/80 flex flex-col items-center justify-center p-2">
                                      <ImageIcon className="w-8 h-8 text-muted-foreground mb-1" />
                                      <p className="text-xs text-muted-foreground text-center truncate w-full px-1">
                                        {file.name}
                                      </p>
                                    </div>
                                  )}
                                  {selectedGoogleDriveFiles.has(file.id) && (
                                    <div className="absolute inset-0 bg-[var(--color-brand-blue)]/20 flex items-center justify-center">
                                      <CheckCircle2 className="w-6 h-6 text-[var(--color-brand-blue)]" />
                                    </div>
                                  )}
                                  {file.mimeType?.startsWith("video/") && (
                                    <div className="absolute bottom-1 right-1 bg-black/70 rounded px-1">
                                      <Video className="w-3 h-3 text-white" />
                                    </div>
                                  )}
                                  {file.mimeType?.startsWith("audio/") && (
                                    <div className="absolute bottom-1 right-1 bg-black/70 rounded px-1">
                                      <Volume2 className="w-3 h-3 text-white" />
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {!googleDriveImportSuccess && googleDriveAccessToken && (
                <div className="p-6 border-t border-gray-700 flex gap-3 shrink-0">
                  <button
                    onClick={() => {
                      setShowGoogleDriveModal(false);
                      setSelectedGoogleDriveFiles(new Set());
                      setGoogleDriveFiles([]);
                      setGoogleDriveError(null);
                    }}
                    disabled={importingFromGoogleDrive}
                    className="flex-1 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={importFromGoogleDrive}
                    disabled={importingFromGoogleDrive || selectedGoogleDriveFiles.size === 0}
                    className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-xl font-medium shadow-lg shadow-blue-500/25 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {importingFromGoogleDrive ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <HardDrive className="w-4 h-4" />
                        Import {selectedGoogleDriveFiles.size} File{selectedGoogleDriveFiles.size !== 1 ? "s" : ""}
                      </>
                    )}
                  </button>
                </div>
              )}

              {!googleDriveAccessToken && (
                <div className="p-6 border-t border-gray-700 shrink-0">
                  <button
                    onClick={() => setShowGoogleDriveModal(false)}
                    className="w-full px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-medium transition-colors"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}

      {/* Image Detail/Rename Modal - React Portal */}
      {showImageDetailModal &&
        selectedImageForDetail &&
        selectedSet &&
        typeof document !== "undefined" &&
        createPortal(
          <div 
            className="fixed inset-0 bg-black z-50 flex"
            onClick={(e) => {
              // Only close if clicking the image area background (not controls or info panel)
              if (e.target === e.currentTarget) {
                setShowImageDetailModal(false);
                setSelectedImageForDetail(null);
                setEditingImageId(null);
                setEditingImageName("");
                setIsFullscreen(false);
                setShowInfoPanel(false);
                resetZoom();
              }
            }}
          >
            {/* Main image area - fills available space */}
            <div className={`relative flex-1 flex flex-col min-w-0 transition-all duration-300`}>
              
              {/* Top floating toolbar */}
              <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-3 bg-gradient-to-b from-black/70 via-black/30 to-transparent">
                {/* Left: counter + filename */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md rounded-full px-3 py-1.5">
                    <div className="w-6 h-6 bg-gradient-to-br from-[var(--color-brand-mid-pink)] to-[var(--color-brand-dark-pink)] rounded-full flex items-center justify-center">
                      <span className="text-white text-[10px] font-bold">
                        {selectedImageForDetail.sequence}
                      </span>
                    </div>
                    <span className="text-white/90 text-sm font-medium">
                      {selectedSet.images.findIndex(i => i.id === selectedImageForDetail.id) + 1} / {selectedSet.images.length}
                    </span>
                  </div>
                  <span className="text-white/60 text-sm truncate max-w-[200px] sm:max-w-[350px] hidden sm:block">
                    {selectedImageForDetail.name}
                  </span>
                </div>

                {/* Right: action buttons */}
                <div className="flex items-center gap-1">
                  {/* Zoom controls - inline in toolbar for images */}
                  {!isVideo(selectedImageForDetail.type) && !isAudio(selectedImageForDetail.type) && (
                    <div className="flex items-center gap-0.5 bg-white/10 backdrop-blur-md rounded-full px-1 py-0.5 mr-1">
                      <button
                        onClick={handleZoomOut}
                        disabled={zoomLevel <= 0.5}
                        className="p-1.5 hover:bg-white/10 rounded-full transition-colors text-white disabled:opacity-30"
                        title="Zoom out"
                      >
                        <ZoomOut className="w-4 h-4" />
                      </button>
                      <button
                        onClick={resetZoom}
                        className="px-1.5 py-0.5 hover:bg-white/10 rounded-full transition-colors text-white text-[11px] font-mono min-w-[40px] text-center"
                        title="Reset zoom"
                      >
                        {Math.round(zoomLevel * 100)}%
                      </button>
                      <button
                        onClick={handleZoomIn}
                        disabled={zoomLevel >= 8}
                        className="p-1.5 hover:bg-white/10 rounded-full transition-colors text-white disabled:opacity-30"
                        title="Zoom in"
                      >
                        <ZoomIn className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  <button
                    onClick={() => setShowInfoPanel(p => !p)}
                    className={`p-2 rounded-full transition-colors ${showInfoPanel ? 'bg-[var(--color-brand-mid-pink)]/30 text-[var(--color-brand-light-pink)]' : 'hover:bg-white/10 text-white/80'}`}
                    title={showInfoPanel ? "Hide info" : "Show info (I)"}
                  >
                    {showInfoPanel ? <PanelRightClose className="w-5 h-5" /> : <PanelRightOpen className="w-5 h-5" />}
                  </button>
                  <a
                    href={selectedImageForDetail.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/80"
                    title="Open original"
                  >
                    <ExternalLink className="w-5 h-5" />
                  </a>
                  <button
                    onClick={() => {
                      setShowImageDetailModal(false);
                      setSelectedImageForDetail(null);
                      setEditingImageId(null);
                      setEditingImageName("");
                      setIsFullscreen(false);
                      setShowInfoPanel(false);
                      resetZoom();
                    }}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/80"
                    title="Close (Esc)"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Prev button */}
              {selectedSet.images.length > 1 && (
                <button
                  onClick={(e) => { e.stopPropagation(); navigateImageDetail('prev'); }}
                  className="absolute left-3 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-black/40 hover:bg-black/60 text-white/80 hover:text-white transition-all hover:scale-110 active:scale-95 backdrop-blur-sm"
                  aria-label="Previous"
                >
                  <ChevronRight className="w-5 h-5 rotate-180" />
                </button>
              )}

              {/* Next button */}
              {selectedSet.images.length > 1 && (
                <button
                  onClick={(e) => { e.stopPropagation(); navigateImageDetail('next'); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-black/40 hover:bg-black/60 text-white/80 hover:text-white transition-all hover:scale-110 active:scale-95 backdrop-blur-sm"
                  aria-label="Next"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              )}

              {/* Image viewer area */}
              <div
                ref={imageContainerRef}
                className={`flex-1 relative overflow-hidden ${
                  zoomLevel > 1 ? (isPanning ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-zoom-in'
                }`}
                onWheel={!isVideo(selectedImageForDetail.type) && !isAudio(selectedImageForDetail.type) ? handleWheel : undefined}
                onMouseDown={handlePanStart}
                onMouseMove={handlePanMove}
                onMouseUp={handlePanEnd}
                onMouseLeave={handlePanEnd}
                onTouchStart={handleZoomTouchStart}
                onTouchMove={handleZoomTouchMove}
                onTouchEnd={handleZoomTouchEnd}
                onDoubleClick={() => {
                  if (zoomLevel === 1) {
                    setZoomLevel(3);
                  } else {
                    resetZoom();
                  }
                }}
              >
                {isVideo(selectedImageForDetail.type) ? (
                  <video
                    src={selectedImageForDetail.url}
                    className="w-full h-full object-contain"
                    controls
                  />
                ) : isAudio(selectedImageForDetail.type) ? (
                  <div className="w-full h-full bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex flex-col items-center justify-center p-6">
                    <Music className="w-20 h-20 text-violet-500 mb-4" />
                    <audio
                      src={selectedImageForDetail.url}
                      controls
                      className="w-full max-w-md"
                    />
                    <span className="text-sm text-white/70 mt-4">{selectedImageForDetail.name}</span>
                  </div>
                ) : (
                  <img
                    src={selectedImageForDetail.url}
                    alt={selectedImageForDetail.name}
                    className="w-full h-full object-contain select-none"
                    draggable={false}
                    style={{
                      transform: `scale(${zoomLevel}) translate(${panPosition.x / zoomLevel}px, ${panPosition.y / zoomLevel}px)`,
                      transformOrigin: 'center center',
                      transition: isPanning ? 'none' : 'transform 0.2s ease-out',
                    }}
                  />
                )}
              </div>

              {/* Bottom hint - shown only at 1x zoom */}
              {!isVideo(selectedImageForDetail.type) && !isAudio(selectedImageForDetail.type) && zoomLevel === 1 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 text-xs text-white/40 bg-white/5 backdrop-blur-sm rounded-full px-4 py-1.5 pointer-events-none">
                  Scroll to zoom &bull; Double-click for 3x &bull; Drag to pan
                </div>
              )}
            </div>

            {/* Right info panel - slides in/out */}
            <div className={`shrink-0 bg-card border-l border-border overflow-y-auto transition-all duration-300 ease-in-out ${
              showInfoPanel ? 'w-[340px] opacity-100' : 'w-0 opacity-0 overflow-hidden'
            }`}>
              <div className="w-[340px] p-5 space-y-5">
                {/* Panel header */}
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Details</h3>
                  <button
                    onClick={() => setShowInfoPanel(false)}
                    className="p-1 hover:bg-muted rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>

                {/* Thumbnail preview */}
                <div className="aspect-square rounded-xl overflow-hidden bg-black/20 border border-border/50">
                  {isVideo(selectedImageForDetail.type) ? (
                    <video src={selectedImageForDetail.url} className="w-full h-full object-cover" />
                  ) : isAudio(selectedImageForDetail.type) ? (
                    <div className="w-full h-full flex items-center justify-center bg-violet-500/10">
                      <Music className="w-10 h-10 text-violet-500" />
                    </div>
                  ) : (
                    <img src={selectedImageForDetail.url} alt="" className="w-full h-full object-cover" />
                  )}
                </div>

                {/* Filename - Editable */}
                <div>
                  <label className="block text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                    Filename
                  </label>
                  {editingImageId === selectedImageForDetail.id ? (
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={editingImageName}
                        onChange={(e) => setEditingImageName(e.target.value)}
                        className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-mid-pink)] focus:border-transparent"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            renameImage(selectedSet.id, selectedImageForDetail.id, editingImageName);
                          } else if (e.key === "Escape") {
                            setEditingImageId(null);
                            setEditingImageName("");
                          }
                        }}
                      />
                      <button
                        onClick={() => renameImage(selectedSet.id, selectedImageForDetail.id, editingImageName)}
                        disabled={savingImageName || !editingImageName.trim()}
                        className="px-2.5 py-2 bg-gradient-to-r from-[var(--color-brand-mid-pink)] to-[var(--color-brand-dark-pink)] text-white rounded-lg transition-all disabled:opacity-50 flex items-center"
                      >
                        {savingImageName ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => { setEditingImageId(null); setEditingImageName(""); }}
                        className="px-2.5 py-2 bg-muted hover:bg-muted/80 text-foreground rounded-lg transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => {
                        setEditingImageId(selectedImageForDetail.id);
                        setEditingImageName(selectedImageForDetail.name.replace(/\.[^/.]+$/, ''));
                      }}
                      className="px-3 py-2 bg-muted border border-border rounded-lg text-foreground text-sm cursor-pointer hover:border-[var(--color-brand-mid-pink)]/50 transition-colors flex items-center justify-between group"
                    >
                      <span className="truncate">{selectedImageForDetail.name}</span>
                      <Edit3 className="w-3.5 h-3.5 text-muted-foreground group-hover:text-[var(--color-brand-mid-pink)] transition-colors shrink-0 ml-2" />
                    </div>
                  )}
                </div>

                {/* Metadata grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Sequence</label>
                    <div className="px-3 py-2 bg-muted border border-border rounded-lg text-foreground text-sm">
                      #{selectedImageForDetail.sequence}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">File Size</label>
                    <div className="px-3 py-2 bg-muted border border-border rounded-lg text-foreground text-sm">
                      {formatFileSize(selectedImageForDetail.size)}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Type</label>
                    <div className="px-3 py-2 bg-muted border border-border rounded-lg text-foreground text-sm flex items-center gap-1.5">
                      {isVideo(selectedImageForDetail.type) ? (
                        <><Video className="w-3.5 h-3.5 text-[var(--color-brand-blue)]" />Video</>
                      ) : isAudio(selectedImageForDetail.type) ? (
                        <><Volume2 className="w-3.5 h-3.5 text-violet-500" />Audio</>
                      ) : (
                        <><ImageIcon className="w-3.5 h-3.5 text-[var(--color-brand-mid-pink)]" />Image</>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Uploaded</label>
                    <div className="px-3 py-2 bg-muted border border-border rounded-lg text-foreground text-sm">
                      {new Date(selectedImageForDetail.uploadedAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t border-border" />

                {/* Actions */}
                <div className="space-y-2">
                  <a
                    href={selectedImageForDetail.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full px-3 py-2.5 bg-muted hover:bg-muted/80 text-foreground rounded-lg font-medium transition-colors flex items-center justify-center gap-2 text-sm"
                  >
                    <Download className="w-4 h-4" />
                    Open Original
                  </a>
                  <button
                    onClick={() => {
                      if (confirm("Are you sure you want to delete this image?")) {
                        deleteImage(selectedSet.id, selectedImageForDetail.id);
                        setShowImageDetailModal(false);
                        setSelectedImageForDetail(null);
                      }
                    }}
                    className="w-full px-3 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 text-sm"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>

                {/* Keyboard shortcuts hint */}
                <div className="border-t border-border pt-4">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-2">Shortcuts</p>
                  <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                    <span><kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">&larr;&rarr;</kbd> Navigate</span>
                    <span><kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">+/-</kbd> Zoom</span>
                    <span><kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">0</kbd> Reset</span>
                    <span><kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">I</kbd> Info</span>
                    <span><kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">Esc</kbd> Close</span>
                    <span><kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">Dbl-click</kbd> 3x</span>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Keycard Generator Modal - React Portal */}
      {showKeycardModal &&
        typeof document !== "undefined" &&
        createPortal(
          <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowKeycardModal(false)}
          >
            <div 
              className="bg-card border border-border rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="sticky top-0 z-10 p-4 border-b border-border bg-card flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl">
                    <FileText className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">Keycard Generator</h3>
                    <p className="text-xs text-muted-foreground">Create custom keycards for your set</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowKeycardModal(false)}
                  className="p-2 hover:bg-muted rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>

              {/* Content */}
              <div className="p-4">
                <KeycardGenerator
                  profileId={profileId}
                  hasSelectedSet={!!selectedSet}
                  directSaveMode={true}
                  onSaveToSet={selectedSet ? async (blob, filename) => {
                    // Convert blob to File and upload
                    const file = new File([blob], filename, { type: "image/png" });
                    const dataTransfer = new DataTransfer();
                    dataTransfer.items.add(file);
                    await handleFileUpload(dataTransfer.files);
                  } : undefined}
                  onSaveComplete={() => {
                    // Close modal after saving
                    setShowKeycardModal(false);
                  }}
                />
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Voice Generator Modal - React Portal */}
      {showVoiceModal &&
        typeof document !== "undefined" &&
        createPortal(
          <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowVoiceModal(false)}
          >
            <div 
              className="bg-card border border-border rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="sticky top-0 z-10 p-4 border-b border-border bg-card flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-violet-500 to-fuchsia-600 rounded-xl">
                    <Mic className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">Voice Generator</h3>
                    <p className="text-xs text-muted-foreground">Generate AI voice notes for your set</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowVoiceModal(false)}
                  className="p-2 hover:bg-muted rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>

              {/* Content */}
              <div className="p-4">
                <EmbeddedVoiceGenerator
                  setId={selectedSet?.id || null}
                  onSaveToSet={selectedSet ? async (audioBlob, filename, thumbnailBlob, thumbnailFilename) => {
                    // Upload the thumbnail first (it will display as the visual in the grid)
                    if (thumbnailBlob && thumbnailFilename) {
                      const thumbnailFile = new File([thumbnailBlob], thumbnailFilename, { type: "image/png" });
                      const thumbnailTransfer = new DataTransfer();
                      thumbnailTransfer.items.add(thumbnailFile);
                      await handleFileUpload(thumbnailTransfer.files, selectedSet.id);
                    }
                    
                    // Then upload the audio file
                    const audioFile = new File([audioBlob], filename, { type: audioBlob.type });
                    const audioTransfer = new DataTransfer();
                    audioTransfer.items.add(audioFile);
                    await handleFileUpload(audioTransfer.files, selectedSet.id);
                  } : undefined}
                  onSaveComplete={() => {
                    // Refresh to show the saved audio and close modal
                    fetchSets(profileId);
                    setShowVoiceModal(false);
                  }}
                />
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Push to Board Modal - React Portal */}
      {showPushToBoardModal &&
        selectedSet &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={() => {
              if (!pushingToBoard) {
                setShowPushToBoardModal(false);
                setPushToBoardSuccess(null);
              }
            }}
          >
            <div
              className="bg-card border-t sm:border border-border rounded-t-2xl sm:rounded-2xl w-full max-w-md shadow-2xl animate-in slide-in-from-bottom-full sm:zoom-in-95 duration-300"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-[var(--color-brand-light-pink)] to-[var(--color-brand-dark-pink)] rounded-xl">
                    <Send className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">
                      Push to Board
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {selectedSet.images.length} image
                      {selectedSet.images.length !== 1 ? "s" : ""} from &ldquo;
                      {selectedSet.name}&rdquo;
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-4">
                {pushToBoardSuccess ? (
                  <div className="text-center py-6">
                    <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle2 className="w-8 h-8 text-green-500" />
                    </div>
                    <h4 className="text-lg font-semibold text-foreground mb-2">
                      Pushed to Board!
                    </h4>
                    <p className="text-muted-foreground">
                      Task <span className="text-[var(--color-brand-light-pink)] font-medium">#{pushToBoardSuccess.itemNo}</span>{" "}
                      &ldquo;{pushToBoardSuccess.title}&rdquo; created
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Space Selector */}
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Select Space
                      </label>
                      {sextingSetsSpaces.length === 0 ? (
                        <div className="flex items-center gap-2 px-4 py-3 bg-muted border border-border rounded-xl">
                          <AlertCircle className="w-4 h-4 text-amber-400" />
                          <span className="text-sm text-muted-foreground">
                            No Sexting Sets spaces found. Create one first.
                          </span>
                        </div>
                      ) : (
                        <select
                          value={selectedSpaceId || ""}
                          onChange={(e) => {
                            const spaceId = e.target.value;
                            setSelectedSpaceId(spaceId);
                            if (spaceId) fetchSpaceDetail(spaceId);
                          }}
                          className="w-full px-4 py-3 bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-light-pink)] focus:border-transparent"
                        >
                          <option value="" disabled>Select a space</option>
                          {sextingSetsSpaces.map((space) => (
                            <option key={space.id} value={space.id}>
                              {space.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    {/* Space loading / resolve preview */}
                    {selectedSpaceId && (
                      loadingSpaceDetail ? (
                        <div className="flex items-center gap-2 px-4 py-3 bg-muted border border-border rounded-xl">
                          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                          <span className="text-muted-foreground">Loading space details...</span>
                        </div>
                      ) : selectedSpaceDetail ? (() => {
                        const board = selectedSpaceDetail.boards[0];
                        const column = board?.columns.find((c) => c.name.toLowerCase().includes('submission')) ?? board?.columns[0];
                        if (!board || !column) return (
                          <div className="flex items-center gap-2 px-4 py-3 bg-muted border border-border rounded-xl">
                            <AlertCircle className="w-4 h-4 text-amber-400" />
                            <span className="text-sm text-muted-foreground">No usable board/column in this space.</span>
                          </div>
                        );
                        return (
                          <div className="bg-muted/50 border border-border rounded-xl p-4 space-y-2">
                            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Summary</h4>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Set Name</span>
                              <span className="text-foreground font-medium">{selectedSet.name}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Images</span>
                              <span className="text-foreground font-medium">{selectedSet.images.length}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Board</span>
                              <span className="text-foreground font-medium">{board.name}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Column</span>
                              <span className="text-[var(--color-brand-light-pink)] font-medium">{column.name}</span>
                            </div>
                          </div>
                        );
                      })() : null
                    )}
                  </>
                )}
              </div>

              {!pushToBoardSuccess && (
                <div className="p-6 border-t border-border flex gap-3">
                  <button
                    onClick={() => {
                      setShowPushToBoardModal(false);
                    }}
                    className="flex-1 px-4 py-2.5 bg-muted hover:bg-muted/80 text-foreground rounded-xl font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={pushToBoard}
                    disabled={pushingToBoard || !selectedSpaceId || !selectedSpaceDetail || loadingSpaceDetail}
                    className="flex-1 px-4 py-2.5 bg-gradient-to-r from-[var(--color-brand-mid-pink)] to-[var(--color-brand-dark-pink)] hover:from-[var(--color-brand-light-pink)] hover:to-[var(--color-brand-mid-pink)] text-white rounded-xl font-medium transition-all duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {pushingToBoard ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Pushing...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Push to Board
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}

      {/* Toast Notification - React Portal */}
      {toast &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed top-4 right-4 z-[60] animate-in slide-in-from-top-2 duration-300">
            <div className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl backdrop-blur-sm border max-w-md ${
              toast.type === 'success' ? 'bg-green-500/90 border-green-400/50 text-white' :
              toast.type === 'error' ? 'bg-red-500/90 border-red-400/50 text-white' :
              'bg-blue-500/90 border-blue-400/50 text-white'
            }`}>
              {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 shrink-0" />}
              {toast.type === 'error' && <XCircle className="w-5 h-5 shrink-0" />}
              {toast.type === 'info' && <Info className="w-5 h-5 shrink-0" />}
              <p className="text-sm font-medium">{toast.message}</p>
              <button
                onClick={() => setToast(null)}
                className="ml-2 p-1 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>,
          document.body,
        )}

      {/* Confirmation Modal - React Portal */}
      {confirmModal &&
        typeof document !== "undefined" &&
        createPortal(
          <div 
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
          >
            <div 
              className="bg-card border-t sm:border border-border rounded-t-2xl sm:rounded-2xl w-full max-w-md shadow-2xl animate-in slide-in-from-bottom-full sm:zoom-in-95 duration-200"
            >
              <div className="p-6 border-b border-border">
                <h3 className="text-xl font-bold text-foreground">{confirmModal.title}</h3>
              </div>

              <div className="p-6">
                <p className="text-foreground">{confirmModal.message}</p>
              </div>

              <div className="p-6 border-t border-border flex gap-3">
                <button
                  onClick={() => setConfirmModal(null)}
                  className="flex-1 px-4 py-2.5 bg-muted hover:bg-muted/80 text-foreground rounded-xl font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    confirmModal.confirmAction();
                    setConfirmModal(null);
                  }}
                  className={`flex-1 px-4 py-2.5 text-white rounded-xl font-medium transition-all duration-200 shadow-lg ${
                    confirmModal.isDangerous
                      ? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700'
                      : 'bg-gradient-to-r from-[var(--color-brand-mid-pink)] to-[var(--color-brand-dark-pink)] hover:from-[var(--color-brand-light-pink)] hover:to-[var(--color-brand-mid-pink)]'
                  }`}
                >
                  {confirmModal.confirmText}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Prominent Saving Order Indicator */}
      {savingOrder && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-[var(--color-brand-mid-pink)] to-[var(--color-brand-dark-pink)] text-white rounded-full shadow-2xl">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="font-medium">Saving order...</span>
          </div>
        </div>
      )}

      {/* Mobile FAB - Quick Upload (only on mobile when set is selected) */}
      {isMobile && selectedSet && (
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="fixed bottom-6 right-6 z-40 w-14 h-14 bg-gradient-to-r from-[var(--color-brand-mid-pink)] to-[var(--color-brand-dark-pink)] hover:from-[var(--color-brand-light-pink)] hover:to-[var(--color-brand-mid-pink)] active:scale-90 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-full shadow-2xl flex items-center justify-center transition-all duration-200"
        >
          {uploading ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : (
            <Upload className="w-6 h-6" />
          )}
        </button>
      )}
    </div>
  );
}
