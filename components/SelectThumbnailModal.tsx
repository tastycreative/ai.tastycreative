"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Loader2, Image as ImageIcon, Check } from "lucide-react";
import { useApiClient } from "@/lib/apiClient";

interface GeneratedImage {
  id: string;
  filename: string;
  url: string | null;
  width: number | null;
  height: number | null;
  createdAt: Date;
  jobId: string;
}

interface SelectThumbnailModalProps {
  isOpen: boolean;
  onClose: () => void;
  influencerId: string;
  influencerName: string;
  onThumbnailSelected: (imageUrl: string) => Promise<void>;
}

export default function SelectThumbnailModal({
  isOpen,
  onClose,
  influencerId,
  influencerName,
  onThumbnailSelected,
}: SelectThumbnailModalProps) {
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const apiClient = useApiClient();

  useEffect(() => {
    if (isOpen && apiClient) {
      fetchGeneratedImages();
    }
  }, [isOpen, apiClient, influencerId]);

  const fetchGeneratedImages = async () => {
    if (!apiClient) return;

    try {
      setLoading(true);
      setError(null);

      const response = await apiClient.get(
        `/api/user/influencers/${influencerId}/generated-images`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch generated images");
      }

      const data = await response.json();
      setImages(data.images || []);

      if (!data.images || data.images.length === 0) {
        setError(
          "No images found. Generate some images using this LoRA first!"
        );
      }
    } catch (error) {
      console.error("Error fetching generated images:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Failed to load generated images"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSelectImage = async () => {
    if (!selectedImageUrl) return;

    try {
      setSaving(true);
      await onThumbnailSelected(selectedImageUrl);
      onClose();
    } catch (error) {
      console.error("Error setting thumbnail:", error);
      alert(
        `Failed to set thumbnail: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 bg-modal-overlay-bg backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-modal-bg rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col border border-modal-border">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-modal-border">
          <div>
            <h2 className="text-2xl font-bold text-modal-foreground">
              Select Thumbnail
            </h2>
            <p className="text-sm text-header-muted mt-1">
              Choose from images generated with{" "}
              <span className="font-semibold">{influencerName}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-header-muted hover:text-modal-foreground transition-colors"
            disabled={saving}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 className="w-12 h-12 animate-spin text-[#EC67A1]" />
              <p className="text-header-muted">
                Loading your generated images...
              </p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="w-16 h-16 rounded-full bg-sidebar-accent flex items-center justify-center">
                <ImageIcon className="w-8 h-8 text-header-muted" />
              </div>
              <p className="text-header-muted text-center max-w-md">
                {error}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {images.map((image) => (
                <button
                  key={image.id}
                  onClick={() => setSelectedImageUrl(image.url)}
                  className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all hover:scale-105 ${
                    selectedImageUrl === image.url
                      ? "border-[#EC67A1] ring-4 ring-[#EC67A1]/30"
                      : "border-modal-border hover:border-[#5DC3F8]"
                  }`}
                >
                  {image.url ? (
                    <>
                      <img
                        src={image.url}
                        alt={image.filename}
                        className="w-full h-full object-cover"
                      />
                      {selectedImageUrl === image.url && (
                        <div className="absolute inset-0 bg-[#EC67A1]/20 flex items-center justify-center">
                          <div className="w-12 h-12 rounded-full bg-[#EC67A1] flex items-center justify-center">
                            <Check className="w-8 h-8 text-white" />
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="w-full h-full bg-sidebar-accent flex items-center justify-center">
                      <ImageIcon className="w-8 h-8 text-header-muted" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-modal-border bg-modal-section-bg">
          <p className="text-sm text-header-muted">
            {selectedImageUrl
              ? "Click 'Set as Thumbnail' to confirm"
              : "Click an image to select it"}
          </p>
          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-modal-foreground hover:bg-modal-hover-bg rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSelectImage}
              disabled={!selectedImageUrl || saving}
              className="px-6 py-2 bg-gradient-to-r from-[#9333ea] to-[#EC67A1] text-white rounded-lg hover:from-[#7e22ce] hover:to-[#E1518E] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Setting...</span>
                </>
              ) : (
                <span>Set as Thumbnail</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
