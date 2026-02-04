"use client";

import { useCallback, useState } from "react";
import { Upload, X, GripVertical } from "lucide-react";
import Image from "next/image";

interface ImageUploaderProps {
  images: string[];
  onImagesChange: (images: string[]) => void;
  maxImages?: number;
}

export function ImageUploader({
  images,
  onImagesChange,
  maxImages = 9,
}: ImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleFileSelect = useCallback(
    async (files: FileList | null) => {
      if (!files) return;

      const newImages: string[] = [];

      for (let i = 0; i < files.length && images.length + newImages.length < maxImages; i++) {
        const file = files[i];
        if (file.type.startsWith("image/")) {
          // Convert to base64 or upload to storage
          // For now, use object URLs for preview
          const url = URL.createObjectURL(file);
          newImages.push(url);
        }
      }

      onImagesChange([...images, ...newImages]);
    },
    [images, maxImages, onImagesChange]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFileSelect(e.dataTransfer.files);
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const removeImage = useCallback(
    (index: number) => {
      const newImages = [...images];
      // Revoke object URL to prevent memory leaks
      if (images[index].startsWith("blob:")) {
        URL.revokeObjectURL(images[index]);
      }
      newImages.splice(index, 1);
      onImagesChange(newImages);
    },
    [images, onImagesChange]
  );

  // Drag and drop reordering
  const handleImageDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleImageDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newImages = [...images];
    const [draggedItem] = newImages.splice(draggedIndex, 1);
    newImages.splice(index, 0, draggedItem);
    onImagesChange(newImages);
    setDraggedIndex(index);
  };

  const handleImageDragEnd = () => {
    setDraggedIndex(null);
  };

  return (
    <div className="space-y-4">
      {/* Upload area */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          relative border-2 border-dashed rounded-lg p-6 text-center transition-colors
          ${
            isDragging
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-muted-foreground/50"
          }
        `}
      >
        <input
          type="file"
          multiple
          accept="image/*"
          onChange={(e) => handleFileSelect(e.target.files)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">
          Drag & drop images here, or click to select
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {images.length} / {maxImages} images
        </p>
      </div>

      {/* Image grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {images.map((image, index) => (
            <div
              key={`${image}-${index}`}
              draggable
              onDragStart={() => handleImageDragStart(index)}
              onDragOver={(e) => handleImageDragOver(e, index)}
              onDragEnd={handleImageDragEnd}
              className={`
                relative aspect-square rounded-lg overflow-hidden bg-muted group cursor-move
                ${draggedIndex === index ? "opacity-50" : ""}
              `}
            >
              <Image
                src={image}
                alt={`Preview ${index + 1}`}
                fill
                className="object-cover"
                unoptimized
              />

              {/* Order indicator */}
              <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                {index + 1}
              </div>

              {/* Drag handle */}
              <div className="absolute top-2 right-10 bg-black/70 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                <GripVertical className="h-4 w-4" />
              </div>

              {/* Remove button */}
              <button
                onClick={() => removeImage(index)}
                className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
