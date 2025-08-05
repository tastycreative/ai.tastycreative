// app/(dashboard)/workspace/generated-content/page.tsx - Gallery Page
"use client";

import { useState, useEffect } from "react";
import { apiClient } from "@/lib/apiClient";
import {
  ImageIcon,
  Download,
  Share2,
  Trash2,
  Search,
  Filter,
  Grid3X3,
  List,
  Calendar,
  FileImage,
  Eye,
  X,
  Loader2,
  AlertCircle,
  RefreshCw,
  SortAsc,
  SortDesc,
  MoreVertical,
} from "lucide-react";

// Types
interface GeneratedImage {
  id: string;
  filename: string;
  subfolder: string;
  type: string;
  fileSize?: number;
  width?: number;
  height?: number;
  format?: string;
  url?: string; // Dynamically constructed ComfyUI URL
  dataUrl?: string; // Database-served image URL
  createdAt: Date | string;
  jobId: string;
}

interface ImageStats {
  totalImages: number;
  totalSize: number;
  formatBreakdown: Record<string, number>;
  imagesWithData: number;
  imagesWithoutData: number;
}

type ViewMode = 'grid' | 'list';
type SortBy = 'newest' | 'oldest' | 'largest' | 'smallest' | 'name';
type FilterBy = 'all';

export default function GeneratedContentPage() {
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [stats, setStats] = useState<ImageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // UI State
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortBy, setSortBy] = useState<SortBy>('newest');
  const [filterBy, setFilterBy] = useState<FilterBy>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [imagesPerPage] = useState(20);

  // Fetch images and stats
  useEffect(() => {
    fetchImages();
    fetchStats();
  }, []);

  const fetchImages = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🖼️ Fetching user images for gallery...');
      
      const response = await apiClient.get('/api/images');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch images: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('📊 Gallery images data:', data);
      
      if (data.success && data.images) {
        // Convert string dates to Date objects
        const processedImages = data.images.map((img: any) => ({
          ...img,
          createdAt: new Date(img.createdAt)
        }));
        
        setImages(processedImages);
        console.log('✅ Loaded', processedImages.length, 'images');
      } else {
        throw new Error(data.error || 'Failed to load images');
      }
    } catch (error) {
      console.error('💥 Error fetching images:', error);
      setError(error instanceof Error ? error.message : 'Failed to load images');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await apiClient.get('/api/images?stats=true');
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setStats(data.stats);
        }
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  // Filter and sort images
  const filteredAndSortedImages = () => {
    let filtered = [...images];
    
    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(img => 
        img.filename.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'largest':
          return (b.fileSize || 0) - (a.fileSize || 0);
        case 'smallest':
          return (a.fileSize || 0) - (b.fileSize || 0);
        case 'name':
          return a.filename.localeCompare(b.filename);
        default:
          return 0;
      }
    });
    
    return filtered;
  };

  // Pagination
  const paginatedImages = () => {
    const filtered = filteredAndSortedImages();
    const startIndex = (currentPage - 1) * imagesPerPage;
    return filtered.slice(startIndex, startIndex + imagesPerPage);
  };

  const totalPages = Math.ceil(filteredAndSortedImages().length / imagesPerPage);

  // Download image with dynamic URL support
  const downloadImage = async (image: GeneratedImage) => {
    try {
      console.log('📥 Downloading image:', image.filename);
      
      if (image.dataUrl) {
        // Priority 1: Download from database
        const response = await apiClient.get(image.dataUrl);
        if (response.ok) {
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = image.filename;
          link.click();
          URL.revokeObjectURL(url);
          console.log('✅ Database image downloaded');
          return;
        }
      }
      
      if (image.url) {
        // Priority 2: Download from ComfyUI (dynamic URL)
        const link = document.createElement('a');
        link.href = image.url;
        link.download = image.filename;
        link.click();
        console.log('✅ ComfyUI image downloaded');
        return;
      }
      
      throw new Error('No download URL available');
      
    } catch (error) {
      console.error('Download error:', error);
      alert('Failed to download image: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  // Share image with dynamic URL support
  const shareImage = (image: GeneratedImage) => {
    let urlToShare = '';
    
    if (image.dataUrl) {
      // Priority 1: Share database URL (more reliable)
      urlToShare = `${window.location.origin}${image.dataUrl}`;
    } else if (image.url) {
      // Priority 2: Share ComfyUI URL (dynamic)
      urlToShare = image.url;
    } else {
      alert('No shareable URL available for this image');
      return;
    }
    
    navigator.clipboard.writeText(urlToShare);
    alert('Image URL copied to clipboard!');
  };

  // Delete image
  const deleteImage = async (image: GeneratedImage) => {
    if (!confirm(`Delete "${image.filename}"? This cannot be undone.`)) {
      return;
    }
    
    try {
      const response = await apiClient.delete('/api/images', {
        imageId: image.id
      });
      
      if (response.ok) {
        setImages(prev => prev.filter(img => img.id !== image.id));
        setSelectedImage(null);
        await fetchStats(); // Refresh stats
        alert('Image deleted successfully');
      } else {
        throw new Error('Failed to delete image');
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete image');
    }
  };

  // Format file size
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown';
    const kb = bytes / 1024;
    const mb = kb / 1024;
    if (mb >= 1) return `${mb.toFixed(1)} MB`;
    return `${kb.toFixed(1)} KB`;
  };

  // Format date
  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-500" />
          <p className="text-gray-600 dark:text-gray-400">Loading your images...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 mx-auto mb-4 text-red-500" />
          <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
          <button
            onClick={fetchImages}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center space-x-2 mx-auto"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Retry</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-lg">
              <ImageIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Generated Content
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                View and manage your AI-generated images
              </p>
            </div>
          </div>
          <button
            onClick={fetchImages}
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            title="Refresh gallery"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-2">
              <FileImage className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Images</p>
                <p className="text-xl font-semibold text-gray-900 dark:text-white">{stats.totalImages}</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-2">
              <Download className="w-5 h-5 text-green-500" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Size</p>
                <p className="text-xl font-semibold text-gray-900 dark:text-white">
                  {Math.round(stats.totalSize / 1024 / 1024 * 100) / 100} MB
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search images..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Controls */}
          <div className="flex items-center space-x-2">
            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="largest">Largest First</option>
              <option value="smallest">Smallest First</option>
              <option value="name">Name</option>
            </select>

            {/* View Mode */}
            <div className="flex border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 ${viewMode === 'grid' ? 'bg-blue-500 text-white' : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}
                title="Grid view"
              >
                <Grid3X3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 ${viewMode === 'list' ? 'bg-blue-500 text-white' : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}
                title="List view"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Images */}
      {filteredAndSortedImages().length === 0 ? (
        <div className="text-center py-12">
          <ImageIcon className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No images found</h3>
          <p className="text-gray-600 dark:text-gray-400">
            {searchQuery || filterBy !== 'all' 
              ? 'Try adjusting your filters or search query'
              : 'Start generating images to see them here'
            }
          </p>
        </div>
      ) : (
        <>
          {/* Grid View */}
          {viewMode === 'grid' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {paginatedImages().map((image) => (
                <div
                  key={image.id}
                  className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-shadow group"
                >
                  <div className="relative aspect-square">
                    <img
                      src={image.dataUrl || image.url}
                      alt={image.filename}
                      className="w-full h-full object-cover cursor-pointer"
                      onClick={() => setSelectedImage(image)}
                      onError={(e) => {
                        console.error('Image load error for:', image.filename);
                        
                        // Smart fallback logic
                        const currentSrc = (e.target as HTMLImageElement).src;
                        
                        if (currentSrc === image.dataUrl && image.url) {
                          console.log('Falling back to ComfyUI URL');
                          (e.target as HTMLImageElement).src = image.url;
                        } else if (currentSrc === image.url && image.dataUrl) {
                          console.log('Falling back to database URL');
                          (e.target as HTMLImageElement).src = image.dataUrl;
                        } else {
                          console.error('All URLs failed for:', image.filename);
                          (e.target as HTMLImageElement).style.display = 'none';
                        }
                      }}
                    />
                    
                    {/* Overlay */}
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-opacity flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <div className="flex space-x-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedImage(image);
                          }}
                          className="p-2 bg-white rounded-full shadow-lg hover:bg-gray-100"
                          title="View image"
                        >
                          <Eye className="w-4 h-4 text-gray-700" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadImage(image);
                          }}
                          className="p-2 bg-white rounded-full shadow-lg hover:bg-gray-100"
                          title="Download image"
                        >
                          <Download className="w-4 h-4 text-gray-700" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            shareImage(image);
                          }}
                          className="p-2 bg-white rounded-full shadow-lg hover:bg-gray-100"
                          title="Share image"
                        >
                          <Share2 className="w-4 h-4 text-gray-700" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="p-3">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate" title={image.filename}>
                      {image.filename}
                    </p>
                    <div className="flex items-center justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
                      <span>{formatFileSize(image.fileSize)}</span>
                      {image.width && image.height && (
                        <span>{image.width}×{image.height}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* List View */}
          {viewMode === 'list' && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {paginatedImages().map((image) => (
                  <div key={image.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <div className="flex items-center space-x-4">
                      <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                        <img
                          src={image.dataUrl || image.url}
                          alt={image.filename}
                          className="w-full h-full object-cover cursor-pointer"
                          onClick={() => setSelectedImage(image)}
                          onError={(e) => {
                            console.error('List view image load error for:', image.filename);
                            
                            // Smart fallback logic
                            const currentSrc = (e.target as HTMLImageElement).src;
                            
                            if (currentSrc === image.dataUrl && image.url) {
                              console.log('Falling back to ComfyUI URL');
                              (e.target as HTMLImageElement).src = image.url;
                            } else if (currentSrc === image.url && image.dataUrl) {
                              console.log('Falling back to database URL');
                              (e.target as HTMLImageElement).src = image.dataUrl;
                            } else {
                              console.error('All URLs failed for:', image.filename);
                              (e.target as HTMLImageElement).style.display = 'none';
                            }
                          }}
                        />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {image.filename}
                        </p>
                        <div className="flex items-center space-x-4 mt-1 text-xs text-gray-500 dark:text-gray-400">
                          <span>{formatDate(image.createdAt)}</span>
                          {image.width && image.height && <span>{image.width}×{image.height}</span>}
                          <span>{formatFileSize(image.fileSize)}</span>
                          {image.format && <span>{image.format.toUpperCase()}</span>}
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setSelectedImage(image)}
                          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600"
                          title="View image"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => downloadImage(image)}
                          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600"
                          title="Download image"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => shareImage(image)}
                          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600"
                          title="Share image"
                        >
                          <Share2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteImage(image)}
                          className="p-2 text-red-400 hover:text-red-600 dark:hover:text-red-300 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                          title="Delete image"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Showing {((currentPage - 1) * imagesPerPage) + 1} to {Math.min(currentPage * imagesPerPage, filteredAndSortedImages().length)} of {filteredAndSortedImages().length} images
              </p>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Image Modal */}
      {selectedImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75" onClick={() => setSelectedImage(null)}>
          <div className="relative max-w-4xl max-h-[90vh] mx-4" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute -top-12 right-0 p-2 text-white hover:text-gray-300 rounded-full bg-black bg-opacity-50"
            >
              <X className="w-6 h-6" />
            </button>
            
            <img
              src={selectedImage.dataUrl || selectedImage.url}
              alt={selectedImage.filename}
              className="max-w-full max-h-[80vh] object-contain rounded-lg"
              onError={(e) => {
                console.error('Modal image load error for:', selectedImage.filename);
                
                // Smart fallback logic
                const currentSrc = (e.target as HTMLImageElement).src;
                
                if (currentSrc === selectedImage.dataUrl && selectedImage.url) {
                  console.log('Modal falling back to ComfyUI URL');
                  (e.target as HTMLImageElement).src = selectedImage.url;
                } else if (currentSrc === selectedImage.url && selectedImage.dataUrl) {
                  console.log('Modal falling back to database URL');
                  (e.target as HTMLImageElement).src = selectedImage.dataUrl;
                } else {
                  console.error('All modal URLs failed for:', selectedImage.filename);
                }
              }}
            />
            
            <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-75 text-white p-4 rounded-b-lg">
              <h3 className="text-lg font-medium mb-2">{selectedImage.filename}</h3>
              <div className="flex items-center justify-between">
                <div className="text-sm space-y-1">
                  <p>Created: {formatDate(selectedImage.createdAt)}</p>
                  {selectedImage.width && selectedImage.height && (
                    <p>Dimensions: {selectedImage.width} × {selectedImage.height}</p>
                  )}
                  <p>Size: {formatFileSize(selectedImage.fileSize)}</p>
                  {selectedImage.format && <p>Format: {selectedImage.format.toUpperCase()}</p>}
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => downloadImage(selectedImage)}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center space-x-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download</span>
                  </button>
                  <button
                    onClick={() => shareImage(selectedImage)}
                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center space-x-2"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>Share</span>
                  </button>
                  <button
                    onClick={() => deleteImage(selectedImage)}
                    className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 flex items-center space-x-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}