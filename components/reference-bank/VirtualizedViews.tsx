"use client";

import { memo, useCallback, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  Check,
  PlayCircle,
  Heart,
  Folder,
  BarChart3,
  Download,
  Copy,
  Move,
  Edit2,
  Trash2,
  Image as ImageIcon,
  Video as VideoIcon,
  Calendar,
} from "lucide-react";
import type { ReferenceItem } from "@/lib/reference-bank/api";

interface VirtualizedViewsProps {
  items: ReferenceItem[];
  selectedIds: string[];
  onSelect: (id: string) => void;
  onPreview: (item: ReferenceItem) => void;
  onToggleFavorite: (item: ReferenceItem) => void;
  onEdit: (item: ReferenceItem) => void;
  onDelete: (item: ReferenceItem) => void;
  onDragStart: (itemId: string) => void;
  onDragEnd: () => void;
}

// Grid Item Card Component
const GridItemCard = memo(function GridItemCard({
  item,
  isSelected,
  onSelect,
  onPreview,
  onToggleFavorite,
  onEdit,
  onDelete,
  onDragStart,
  onDragEnd,
}: {
  item: ReferenceItem;
  isSelected: boolean;
  onSelect: () => void;
  onPreview: () => void;
  onToggleFavorite: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`group relative bg-gray-800 rounded-xl overflow-hidden cursor-pointer transition-all hover:scale-[1.02] hover:shadow-xl ${
        isSelected ? "ring-2 ring-violet-500 shadow-lg shadow-violet-500/20" : ""
      }`}
    >
      {/* Thumbnail */}
      <div
        className="aspect-square bg-gray-900 relative overflow-hidden"
        onClick={onPreview}
      >
        {item.fileType.startsWith("video/") ? (
          <>
            <video
              src={item.thumbnailUrl || item.awsS3Url}
              className="w-full h-full object-cover"
              muted
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
              <PlayCircle className="w-12 h-12 text-white opacity-80" />
            </div>
          </>
        ) : (
          <img
            src={item.thumbnailUrl || item.awsS3Url}
            alt={item.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        )}

        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

        {/* Quick actions */}
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite();
            }}
            className={`p-1.5 rounded-lg backdrop-blur-sm transition-colors ${
              item.isFavorite
                ? "bg-pink-500/90 text-white"
                : "bg-black/50 text-white hover:bg-pink-500/90"
            }`}
          >
            <Heart className={`w-4 h-4 ${item.isFavorite ? "fill-current" : ""}`} />
          </button>
        </div>

        {/* Selection checkbox */}
        <div className="absolute top-2 left-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
            }}
            className={`w-5 h-5 rounded border-2 transition-all ${
              isSelected
                ? "bg-violet-500 border-violet-500"
                : "bg-black/30 border-white/50 hover:border-white"
            } backdrop-blur-sm flex items-center justify-center`}
          >
            {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
          </button>
        </div>

        {/* Type badge */}
        <div className="absolute bottom-2 left-2">
          {item.fileType.startsWith("video/") ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-500/90 backdrop-blur-sm text-white text-xs rounded-md">
              <VideoIcon className="w-3 h-3" />
              Video
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-500/90 backdrop-blur-sm text-white text-xs rounded-md">
              <ImageIcon className="w-3 h-3" />
              Image
            </span>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        <h3 className="text-sm font-medium text-white truncate mb-1">{item.name}</h3>
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>
            {item.width && item.height
              ? `${item.width}×${item.height}`
              : item.fileSize
              ? `${(item.fileSize / 1024 / 1024).toFixed(2)} MB`
              : "Unknown"}
          </span>
          <div className="flex items-center gap-2">
            {item.usageCount > 0 && (
              <span className="flex items-center gap-1">
                <BarChart3 className="w-3 h-3" />
                {item.usageCount}
              </span>
            )}
          </div>
        </div>

        {/* Tags */}
        {item.tags && item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {item.tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="px-1.5 py-0.5 bg-violet-500/20 text-violet-300 text-xs rounded"
              >
                {tag}
              </span>
            ))}
            {item.tags.length > 2 && (
              <span className="px-1.5 py-0.5 bg-gray-700 text-gray-400 text-xs rounded">
                +{item.tags.length - 2}
              </span>
            )}
          </div>
        )}

        {/* Action buttons (on hover) */}
        <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="flex-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded transition-colors"
          >
            <Edit2 className="w-3 h-3 mx-auto" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="flex-1 px-2 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs rounded transition-colors"
          >
            <Trash2 className="w-3 h-3 mx-auto" />
          </button>
        </div>
      </div>
    </div>
  );
});

// List Item Row Component
const ListItemRow = memo(function ListItemRow({
  item,
  isSelected,
  onSelect,
  onPreview,
  onToggleFavorite,
  onEdit,
  onDelete,
  onDragStart,
  onDragEnd,
}: {
  item: ReferenceItem;
  isSelected: boolean;
  onSelect: () => void;
  onPreview: () => void;
  onToggleFavorite: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`group flex items-center gap-4 p-3 bg-gray-800 rounded-lg cursor-pointer transition-all hover:bg-gray-750 ${
        isSelected ? "ring-2 ring-violet-500" : ""
      }`}
      onClick={onPreview}
    >
      {/* Checkbox */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        className={`w-5 h-5 rounded border-2 transition-all shrink-0 ${
          isSelected
            ? "bg-violet-500 border-violet-500"
            : "bg-gray-700 border-gray-600 hover:border-gray-500"
        } flex items-center justify-center`}
      >
        {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
      </button>

      {/* Thumbnail */}
      <div className="w-16 h-16 bg-gray-900 rounded-lg overflow-hidden shrink-0 relative">
        {item.fileType.startsWith("video/") ? (
          <>
            <video
              src={item.thumbnailUrl || item.awsS3Url}
              className="w-full h-full object-cover"
              muted
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <PlayCircle className="w-6 h-6 text-white opacity-80" />
            </div>
          </>
        ) : (
          <img
            src={item.thumbnailUrl || item.awsS3Url}
            alt={item.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-sm font-medium text-white truncate">{item.name}</h3>
          {item.isFavorite && <Heart className="w-4 h-4 text-pink-500 fill-current shrink-0" />}
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            {item.fileType.startsWith("video/") ? (
              <VideoIcon className="w-3 h-3" />
            ) : (
              <ImageIcon className="w-3 h-3" />
            )}
            {item.fileType.startsWith("video/") ? "Video" : "Image"}
          </span>
          {item.width && item.height && (
            <span>{item.width}×{item.height}</span>
          )}
          {item.fileSize && (
            <span>{(item.fileSize / 1024 / 1024).toFixed(2)} MB</span>
          )}
          {item.usageCount > 0 && (
            <span className="flex items-center gap-1">
              <BarChart3 className="w-3 h-3" />
              {item.usageCount} uses
            </span>
          )}
        </div>
        {item.tags && item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {item.tags.map((tag) => (
              <span
                key={tag}
                className="px-1.5 py-0.5 bg-violet-500/20 text-violet-300 text-xs rounded"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite();
          }}
          className={`p-2 rounded-lg transition-colors ${
            item.isFavorite
              ? "text-pink-500 hover:bg-pink-500/20"
              : "text-gray-400 hover:bg-gray-700 hover:text-white"
          }`}
        >
          <Heart className={`w-4 h-4 ${item.isFavorite ? "fill-current" : ""}`} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="p-2 text-gray-400 hover:bg-gray-700 hover:text-white rounded-lg transition-colors"
        >
          <Edit2 className="w-4 h-4" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="p-2 text-gray-400 hover:bg-red-500/20 hover:text-red-400 rounded-lg transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
});

// Virtualized Grid Component
export const VirtualizedGrid = memo(function VirtualizedGrid({
  items,
  selectedIds,
  onSelect,
  onPreview,
  onToggleFavorite,
  onEdit,
  onDelete,
  onDragStart,
  onDragEnd,
}: VirtualizedViewsProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  // Calculate columns based on container width
  const getColumnCount = () => {
    if (!parentRef.current) return 4;
    const width = parentRef.current.offsetWidth;
    if (width < 640) return 2;
    if (width < 1024) return 3;
    if (width < 1536) return 4;
    return 5;
  };

  const columnCount = getColumnCount();
  const rowCount = Math.ceil(items.length / columnCount);

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 320,
    overscan: 2,
  });

  return (
    <div ref={parentRef} className="h-full overflow-auto">
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const startIndex = virtualRow.index * columnCount;
          const endIndex = Math.min(startIndex + columnCount, items.length);
          const rowItems = items.slice(startIndex, endIndex);

          return (
            <div
              key={virtualRow.key}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <div className="grid gap-4 px-4 h-full" style={{
                gridTemplateColumns: `repeat(${columnCount}, 1fr)`,
              }}>
                {rowItems.map((item) => (
                  <GridItemCard
                    key={item.id}
                    item={item}
                    isSelected={selectedIds.includes(item.id)}
                    onSelect={() => onSelect(item.id)}
                    onPreview={() => onPreview(item)}
                    onToggleFavorite={() => onToggleFavorite(item)}
                    onEdit={() => onEdit(item)}
                    onDelete={() => onDelete(item)}
                    onDragStart={() => onDragStart(item.id)}
                    onDragEnd={onDragEnd}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

// Virtualized List Component
export const VirtualizedList = memo(function VirtualizedList({
  items,
  selectedIds,
  onSelect,
  onPreview,
  onToggleFavorite,
  onEdit,
  onDelete,
  onDragStart,
  onDragEnd,
}: VirtualizedViewsProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 88,
    overscan: 5,
  });

  return (
    <div ref={parentRef} className="h-full overflow-auto">
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const item = items[virtualRow.index];

          return (
            <div
              key={virtualRow.key}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <div className="px-4 pb-2">
                <ListItemRow
                  item={item}
                  isSelected={selectedIds.includes(item.id)}
                  onSelect={() => onSelect(item.id)}
                  onPreview={() => onPreview(item)}
                  onToggleFavorite={() => onToggleFavorite(item)}
                  onEdit={() => onEdit(item)}
                  onDelete={() => onDelete(item)}
                  onDragStart={() => onDragStart(item.id)}
                  onDragEnd={onDragEnd}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});
