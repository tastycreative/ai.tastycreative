// components/FaceMaskEditor.tsx - Face detection focused mask editor for face swapping
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { 
  Brush, 
  Eraser, 
  RotateCcw, 
  Download, 
  Upload,
  Minus,
  Plus,
  Eye,
  EyeOff,
  Scan,
  User,
  Loader2
} from 'lucide-react';

interface FaceMaskEditorProps {
  imageUrl: string;
  onMaskUpdate: (maskDataUrl: string | null) => void;
  className?: string;
  onCancel?: () => void;
  onSave?: (maskData: string) => void;
  title?: string;
}

interface Point {
  x: number;
  y: number;
}

interface FaceRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  skinPixels: number;
}

export default function FaceMaskEditor({ 
  imageUrl, 
  onMaskUpdate, 
  className = '',
  onCancel,
  onSave,
  title = "Create Face Mask"
}: FaceMaskEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<'brush' | 'eraser' | 'face-detect'>('face-detect');
  const [brushSize, setBrushSize] = useState(15);
  const [showMask, setShowMask] = useState(true);
  const [maskOpacity, setMaskOpacity] = useState(0.7);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 512, height: 512 });
  const [mousePos, setMousePos] = useState<Point | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [detectedFaces, setDetectedFaces] = useState<FaceRegion[]>([]);

  // Get mouse position relative to canvas
  const getMousePos = (e: React.MouseEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  // Generate mask data and notify parent
  const generateMaskData = useCallback(() => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    
    // Check if mask has any content
    const ctx = maskCanvas.getContext('2d');
    if (!ctx) return;
    
    const imageData = ctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
    const hasContent = imageData.data.some((_, i) => i % 4 === 3 && imageData.data[i] > 0);
    
    if (hasContent) {
      const maskDataUrl = maskCanvas.toDataURL('image/png');
      onMaskUpdate(maskDataUrl);
    } else {
      onMaskUpdate(null);
    }
  }, [onMaskUpdate]);

  // Update mask preview overlay
  const updateMaskPreview = useCallback(() => {
    const canvas = canvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    
    if (!canvas || !maskCanvas || !imageRef.current) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear and redraw image
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imageRef.current, 0, 0, canvas.width, canvas.height);
    
    if (showMask) {
      // Overlay mask with red tint for face areas
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = maskOpacity;
      ctx.fillStyle = 'rgba(255, 100, 100, 0.6)'; // Slightly different red for faces
      
      // Create mask pattern
      const maskImageData = maskCanvas.getContext('2d')?.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
      if (maskImageData) {
        const data = maskImageData.data;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] > 0) { // If mask pixel has alpha > 0
            const x = (i / 4) % maskCanvas.width;
            const y = Math.floor((i / 4) / maskCanvas.width);
            ctx.fillRect(x, y, 1, 1);
          }
        }
      }
      
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    // Draw detected face bounds
    if (detectedFaces.length > 0 && tool === 'face-detect') {
      ctx.save();
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.globalAlpha = 0.8;
      
      detectedFaces.forEach(face => {
        ctx.strokeRect(face.x, face.y, face.width, face.height);
        
        // Draw confidence label
        ctx.fillStyle = '#00ff00';
        ctx.font = '12px Arial';
        ctx.fillText(`Face ${Math.round(face.confidence * 100)}%`, face.x, face.y - 5);
      });
      ctx.restore();
    }

    // Draw cursor circle for brush tools
    if (mousePos && (tool === 'brush' || tool === 'eraser') && !isProcessing) {
      ctx.save();
      ctx.strokeStyle = tool === 'brush' ? '#ff6b6b' : '#4ecdc4';
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 3]);
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.arc(mousePos.x, mousePos.y, brushSize / 2, 0, 2 * Math.PI);
      ctx.stroke();
      
      // Draw crosshair in center
      ctx.setLineDash([]);
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.moveTo(mousePos.x - 5, mousePos.y);
      ctx.lineTo(mousePos.x + 5, mousePos.y);
      ctx.moveTo(mousePos.x, mousePos.y - 5);
      ctx.lineTo(mousePos.x, mousePos.y + 5);
      ctx.stroke();
      ctx.restore();
    }
  }, [showMask, maskOpacity, mousePos, tool, brushSize, isProcessing, detectedFaces]);

  // Draw on mask
  const drawOnMask = useCallback((from: Point, to: Point) => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    
    const ctx = maskCanvas.getContext('2d');
    if (!ctx) return;
    
    ctx.globalCompositeOperation = tool === 'brush' ? 'source-over' : 'destination-out';
    ctx.strokeStyle = tool === 'brush' ? 'white' : 'transparent';
    ctx.fillStyle = tool === 'brush' ? 'white' : 'transparent';
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // Draw line from previous point to current point
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    
    // Draw circle at current point for smoother drawing
    ctx.beginPath();
    ctx.arc(to.x, to.y, brushSize / 2, 0, 2 * Math.PI);
    ctx.fill();
    
    updateMaskPreview();
  }, [tool, brushSize, updateMaskPreview]);

  // Enhanced skin tone detection for faces
  const isFaceSkinTone = (r: number, g: number, b: number): boolean => {
    // Convert RGB to HSV for better face skin detection
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const diff = max - min;
    
    let h = 0;
    if (diff !== 0) {
      if (max === r) {
        h = ((g - b) / diff) % 6;
      } else if (max === g) {
        h = (b - r) / diff + 2;
      } else {
        h = (r - g) / diff + 4;
      }
    }
    h = (h * 60 + 360) % 360;
    
    const s = max === 0 ? 0 : diff / max;
    const v = max / 255;
    
    // More restrictive criteria for face detection (focus on face skin tones)
    const faceSkinCriteria1 = h >= 0 && h <= 40 && s >= 0.25 && s <= 0.7 && v >= 0.4 && v <= 0.95;
    const faceSkinCriteria2 = r > 120 && g > 80 && b > 60 && r > g && r > b && (r - g) >= 8 && (g - b) >= 5;
    const faceSkinCriteria3 = r > 200 && g > 180 && b > 150 && Math.abs(r - g) <= 20 && r >= b && g >= b;
    
    return faceSkinCriteria1 || faceSkinCriteria2 || faceSkinCriteria3;
  };

  // Detect face regions using improved algorithm
  const detectFaces = useCallback(async () => {
    const canvas = canvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    if (!canvas || !maskCanvas) return;

    const ctx = canvas.getContext('2d');
    const maskCtx = maskCanvas.getContext('2d');
    if (!ctx || !maskCtx) return;

    setIsProcessing(true);
    setDetectedFaces([]);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const width = canvas.width;
    const height = canvas.height;

    maskCtx.clearRect(0, 0, width, height);

    // Step 1: Find skin tone pixels
    const skinPixels = new Set<string>();
    const skinDensityMap = new Map<string, number>();
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;
        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];
        
        if (isFaceSkinTone(r, g, b)) {
          skinPixels.add(`${x},${y}`);
          
          // Calculate local skin density
          const regionKey = `${Math.floor(x/16)},${Math.floor(y/16)}`;
          skinDensityMap.set(regionKey, (skinDensityMap.get(regionKey) || 0) + 1);
        }
      }
    }

    // Step 2: Find high-density skin regions (likely faces)
    const faceRegions: FaceRegion[] = [];
    const visited = new Set<string>();
    
    for (const [regionKey, density] of skinDensityMap.entries()) {
      if (density < 30 || visited.has(regionKey)) continue; // Minimum density for face
      
      const [gridX, gridY] = regionKey.split(',').map(Number);
      const startX = gridX * 16;
      const startY = gridY * 16;
      
      // Grow region from this high-density area
      const regionPixels = new Set<string>();
      const queue = [{x: startX, y: startY}];
      
      while (queue.length > 0) {
        const {x, y} = queue.shift()!;
        const pixelKey = `${x},${y}`;
        
        if (x < 0 || x >= width || y < 0 || y >= height) continue;
        if (regionPixels.has(pixelKey) || !skinPixels.has(pixelKey)) continue;
        
        regionPixels.add(pixelKey);
        
        // Add neighbors
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            if (Math.abs(dx) + Math.abs(dy) <= 2) {
              queue.push({x: x + dx, y: y + dy});
            }
          }
        }
        
        // Limit region size for performance
        if (regionPixels.size > 5000) break;
      }
      
      if (regionPixels.size >= 200) { // Minimum face size
        // Calculate bounding box
        let minX = width, maxX = 0, minY = height, maxY = 0;
        for (const pixel of regionPixels) {
          const [px, py] = pixel.split(',').map(Number);
          minX = Math.min(minX, px);
          maxX = Math.max(maxX, px);
          minY = Math.min(minY, py);
          maxY = Math.max(maxY, py);
        }
        
        const faceWidth = maxX - minX;
        const faceHeight = maxY - minY;
        const aspectRatio = faceWidth / faceHeight;
        
        // Filter for face-like regions (aspect ratio and position)
        if (aspectRatio > 0.5 && aspectRatio < 2.0 && faceWidth > 40 && faceHeight > 40) {
          const centerY = minY + faceHeight / 2;
          const isInUpperHalf = centerY < height * 0.7; // Faces usually in upper part
          
          let confidence = Math.min(1.0, regionPixels.size / 1000);
          if (isInUpperHalf) confidence *= 1.3;
          if (aspectRatio > 0.7 && aspectRatio < 1.4) confidence *= 1.2;
          
          faceRegions.push({
            x: minX,
            y: minY,
            width: faceWidth,
            height: faceHeight,
            confidence,
            skinPixels: regionPixels.size
          });
          
          // Mark region as visited
          for (let gy = Math.floor(minY/16); gy <= Math.floor(maxY/16); gy++) {
            for (let gx = Math.floor(minX/16); gx <= Math.floor(maxX/16); gx++) {
              visited.add(`${gx},${gy}`);
            }
          }
        }
      }
    }
    
    // Step 3: Sort faces by confidence and take the best ones
    faceRegions.sort((a, b) => b.confidence - a.confidence);
    const topFaces = faceRegions.slice(0, 3); // Max 3 faces
    
    setDetectedFaces(topFaces);

    // Step 4: Create face masks
    if (topFaces.length > 0) {
      const maskData = maskCtx.createImageData(width, height);
      const maskPixels = maskData.data;
      
      for (const face of topFaces) {
        // Create elliptical mask for each detected face
        const centerX = face.x + face.width / 2;
        const centerY = face.y + face.height / 2;
        const radiusX = face.width / 2 * 1.2; // Slightly larger than detection box
        const radiusY = face.height / 2 * 1.3;
        
        for (let y = Math.floor(face.y - face.height * 0.2); y <= Math.ceil(face.y + face.height * 1.2); y++) {
          for (let x = Math.floor(face.x - face.width * 0.2); x <= Math.ceil(face.x + face.width * 1.2); x++) {
            if (x < 0 || x >= width || y < 0 || y >= height) continue;
            
            const dx = (x - centerX) / radiusX;
            const dy = (y - centerY) / radiusY;
            
            // Elliptical mask with smooth edges
            const distance = dx * dx + dy * dy;
            if (distance <= 1) {
              const alpha = Math.max(0, Math.min(255, 255 * (1.2 - distance)));
              const index = (y * width + x) * 4;
              
              maskPixels[index] = 255;     // R
              maskPixels[index + 1] = 255; // G  
              maskPixels[index + 2] = 255; // B
              maskPixels[index + 3] = alpha; // A
            }
          }
        }
      }
      
      maskCtx.putImageData(maskData, 0, 0);
    } else {
      // Fallback: create center mask if no faces detected
      console.log('No faces detected, creating center fallback mask');
      const centerX = width / 2;
      const centerY = height / 2.2; // Slightly higher for typical face position
      const radiusX = Math.min(width, height) / 6;
      const radiusY = radiusX * 1.2;
      
      maskCtx.fillStyle = 'white';
      maskCtx.beginPath();
      maskCtx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
      maskCtx.fill();
    }
    
    updateMaskPreview();
    generateMaskData();
    setIsProcessing(false);
  }, [updateMaskPreview, generateMaskData]);

  // Initialize canvas when image loads
  const initializeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    const image = imageRef.current;
    
    if (!canvas || !maskCanvas || !image) return;
    
    // Set canvas size to match image (with reasonable max size)
    const maxWidth = 512;
    const maxHeight = 512;
    
    let { width, height } = image;
    
    // Scale down if too large
    if (width > maxWidth || height > maxHeight) {
      const scale = Math.min(maxWidth / width, maxHeight / height);
      width = Math.floor(width * scale);
      height = Math.floor(height * scale);
    }
    
    setCanvasSize({ width, height });
    
    // Set both canvas sizes
    [canvas, maskCanvas].forEach(c => {
      c.width = width;
      c.height = height;
    });
    
    // Draw image on main canvas
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(image, 0, 0, width, height);
    }
    
    // Initialize mask canvas
    const maskCtx = maskCanvas.getContext('2d');
    if (maskCtx) {
      maskCtx.fillStyle = 'rgba(0, 0, 0, 0)';
      maskCtx.fillRect(0, 0, width, height);
    }
    
    setImageLoaded(true);
    
    // Automatically detect faces after a short delay
    setTimeout(() => {
      detectFaces();
    }, 100);
  }, [detectFaces]);

  // Load image
  useEffect(() => {
    const image = imageRef.current;
    if (!image || !imageUrl) return;
    
    image.onload = initializeCanvas;
    image.src = imageUrl;
    
    return () => {
      if (image) {
        image.onload = null;
      }
    };
  }, [imageUrl, initializeCanvas]);

  // Mouse event handlers
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getMousePos(e);
    setMousePos(pos);
    
    if (isDrawing && (tool === 'brush' || tool === 'eraser')) {
      drawOnMask(pos, pos);
    }
  }, [isDrawing, tool, drawOnMask]);

  const handleMouseLeave = useCallback(() => {
    setMousePos(null);
    setIsDrawing(false);
  }, []);

  const startDrawing = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getMousePos(e);
    
    if (tool === 'brush' || tool === 'eraser') {
      setIsDrawing(true);
      drawOnMask(pos, pos);
    }
  }, [tool, drawOnMask]);

  const stopDrawing = useCallback(() => {
    setIsDrawing(false);
    generateMaskData();
  }, [generateMaskData]);

  // Clear mask
  const clearMask = useCallback(() => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    
    const ctx = maskCanvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    setDetectedFaces([]);
    updateMaskPreview();
    onMaskUpdate(null);
  }, [updateMaskPreview, onMaskUpdate]);

  // Download mask
  const downloadMask = () => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    
    const link = document.createElement('a');
    link.download = 'face_mask.png';
    link.href = maskCanvas.toDataURL();
    link.click();
  };

  // Upload mask
  const uploadMask = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const maskCanvas = maskCanvasRef.current;
          if (!maskCanvas) return;
          
          const ctx = maskCanvas.getContext('2d');
          if (!ctx) return;
          
          ctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
          ctx.drawImage(img, 0, 0, maskCanvas.width, maskCanvas.height);
          updateMaskPreview();
          generateMaskData();
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }, [updateMaskPreview, generateMaskData]);

  // Save mask and close
  const handleSave = () => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas || !onSave) return;
    
    const maskData = maskCanvas.toDataURL('image/png');
    onSave(maskData);
  };

  // Update preview when settings change
  useEffect(() => {
    if (imageLoaded) {
      updateMaskPreview();
    }
  }, [showMask, maskOpacity, imageLoaded, mousePos, tool, brushSize, detectedFaces, updateMaskPreview]);

  return (
    <div className={`face-mask-editor ${className}`}>
      {/* Hidden image element */}
      <img 
        ref={imageRef} 
        style={{ display: 'none' }} 
        alt="Reference for face masking"
      />
      
      {/* Header */}
      {(onCancel || onSave) && (
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          {onCancel && (
            <button
              onClick={onCancel}
              className="text-gray-500 hover:text-gray-700 text-xl"
            >
              ✕
            </button>
          )}
        </div>
      )}
      
      {/* Face Mask Tools */}
      <div className="face-mask-tools mb-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border">
        <div className="flex flex-wrap items-center gap-4">
          {/* Tool Selection */}
          <div className="flex space-x-2">
            <button
              onClick={() => setTool('brush')}
              className={`p-2 rounded-lg transition-colors ${
                tool === 'brush' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
              title="Brush - Add to face mask"
            >
              <Brush className="w-4 h-4" />
            </button>
            <button
              onClick={() => setTool('eraser')}
              className={`p-2 rounded-lg transition-colors ${
                tool === 'eraser' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
              title="Eraser - Remove from face mask"
            >
              <Eraser className="w-4 h-4" />
            </button>
            <button
              onClick={detectFaces}
              disabled={isProcessing}
              className={`p-2 rounded-lg transition-colors ${
                isProcessing
                  ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                  : 'bg-green-500 text-white hover:bg-green-600'
              }`}
              title="Automatically detect faces"
            >
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Scan className="w-4 h-4" />}
            </button>
          </div>

          {/* Brush Size */}
          {(tool === 'brush' || tool === 'eraser') && (
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setBrushSize(Math.max(1, brushSize - 3))}
                className="p-1 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="text-sm min-w-[3rem] text-center">{brushSize}px</span>
              <button
                onClick={() => setBrushSize(Math.min(50, brushSize + 3))}
                className="p-1 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Mask Visibility */}
          <button
            onClick={() => setShowMask(!showMask)}
            className={`p-2 rounded-lg transition-colors ${
              showMask 
                ? 'bg-purple-500 text-white' 
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
            title={showMask ? 'Hide face mask overlay' : 'Show face mask overlay'}
          >
            {showMask ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>

          {/* Mask Opacity */}
          {showMask && (
            <div className="flex items-center space-x-2">
              <span className="text-sm">Opacity:</span>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.1"
                value={maskOpacity}
                onChange={(e) => setMaskOpacity(parseFloat(e.target.value))}
                className="w-20"
              />
              <span className="text-sm min-w-[3rem]">{Math.round(maskOpacity * 100)}%</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex space-x-2">
            <button
              onClick={clearMask}
              className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              title="Clear face mask"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={downloadMask}
              className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
              title="Download face mask"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={uploadMask}
              className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              title="Upload face mask"
            >
              <Upload className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Detection Results */}
        {detectedFaces.length > 0 && (
          <div className="mt-3 p-2 bg-green-50 dark:bg-green-900 rounded border text-sm">
            <div className="flex items-center space-x-2">
              <User className="w-4 h-4 text-green-600" />
              <span className="font-medium">
                {detectedFaces.length} face{detectedFaces.length > 1 ? 's' : ''} detected
              </span>
            </div>
            <div className="mt-1 text-xs text-green-700 dark:text-green-300">
              {detectedFaces.map((face, i) => (
                <span key={i} className="mr-3">
                  Face {i + 1}: {Math.round(face.confidence * 100)}% confidence
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Canvas Container */}
      <div className="canvas-container relative inline-block border-2 border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden bg-white">
        {/* Main canvas (shows image + mask overlay) */}
        <canvas
          ref={canvasRef}
          className="block cursor-crosshair"
          onMouseDown={startDrawing}
          onMouseMove={handleMouseMove}
          onMouseUp={stopDrawing}
          onMouseLeave={handleMouseLeave}
          style={{ 
            width: canvasSize.width, 
            height: canvasSize.height,
            maxWidth: '100%'
          }}
        />
        
        {/* Hidden mask canvas */}
        <canvas
          ref={maskCanvasRef}
          style={{ display: 'none' }}
        />
        
        {/* Loading overlay */}
        {!imageLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800">
            <div className="text-center text-gray-500 dark:text-gray-400">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
              <p>Loading image and detecting faces...</p>
            </div>
          </div>
        )}
        
        {/* Tool indicator */}
        {imageLoaded && (
          <div className="absolute top-2 left-2 bg-black bg-opacity-75 text-white px-2 py-1 rounded text-xs">
            {isProcessing ? (
              <span className="flex items-center space-x-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Detecting faces...</span>
              </span>
            ) : (
              <>
                {tool === 'brush' && `🖌️ Add Face Area • ${brushSize}px`}
                {tool === 'eraser' && `🧽 Remove Area • ${brushSize}px`}
                {tool === 'face-detect' && `👤 Face Detection Mode`}
              </>
            )}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      {(onCancel || onSave) && (
        <div className="flex justify-end space-x-3 mt-4">
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
          )}
          {onSave && (
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              Apply Face Mask
            </button>
          )}
        </div>
      )}

      {/* Instructions */}
      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900 rounded-lg">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          <strong>🎯 Face Detection & Masking:</strong>
        </p>
        <ul className="text-xs text-blue-700 dark:text-blue-300 mt-1 space-y-1">
          <li><strong>Auto-Detection:</strong> Automatically detects and masks faces using advanced skin tone analysis</li>
          <li><strong>Manual Refinement:</strong> Use brush/eraser tools to perfect the face mask</li>
          <li><strong>Multiple Faces:</strong> Detects up to 3 faces and shows confidence levels</li>
          <li><strong>Smart Algorithm:</strong> Optimized for face swapping with elliptical masks and smooth edges</li>
          <li>Red overlay shows areas where the new face will be placed</li>
        </ul>
      </div>
    </div>
  );
}