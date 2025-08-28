// components/SimpleMaskEditor.tsx - ComfyUI-style masking interface
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { 
  Brush, 
  Eraser, 
  RotateCcw, 
  Minus,
  Plus,
  Eye,
  EyeOff,
  Download
} from 'lucide-react';

interface SimpleMaskEditorProps {
  imageUrl: string;
  onMaskUpdate: (maskDataUrl: string | null) => void;
  className?: string;
}

interface Point {
  x: number;
  y: number;
}

export default function SimpleMaskEditor({ 
  imageUrl, 
  onMaskUpdate, 
  className = '' 
}: SimpleMaskEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<'brush' | 'eraser'>('brush');
  const [brushSize, setBrushSize] = useState(30);
  const [showMask, setShowMask] = useState(true);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [lastPoint, setLastPoint] = useState<Point | null>(null);

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
    
    const ctx = maskCanvas.getContext('2d');
    if (!ctx) return;
    
    // Check if mask has any content
    const imageData = ctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
    const hasContent = imageData.data.some((_, i) => i % 4 === 3 && imageData.data[i] > 0);
    
    if (hasContent) {
      const maskDataUrl = maskCanvas.toDataURL('image/png');
      onMaskUpdate(maskDataUrl);
    } else {
      onMaskUpdate(null);
    }
  }, [onMaskUpdate]);

  // Update the display canvas with image and mask overlay
  const updateDisplay = useCallback(() => {
    const canvas = canvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    
    if (!canvas || !maskCanvas || !imageRef.current || !imageLoaded) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear and draw base image
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imageRef.current, 0, 0, canvas.width, canvas.height);
    
    // Draw mask overlay if enabled
    if (showMask) {
      const maskImageData = maskCanvas.getContext('2d')?.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
      if (maskImageData) {
        // Create red overlay for masked areas
        const overlayData = ctx.createImageData(canvas.width, canvas.height);
        
        for (let i = 0; i < maskImageData.data.length; i += 4) {
          if (maskImageData.data[i + 3] > 0) { // If mask pixel is not transparent
            overlayData.data[i] = 255;     // Red
            overlayData.data[i + 1] = 0;   // Green
            overlayData.data[i + 2] = 0;   // Blue
            overlayData.data[i + 3] = 100; // Semi-transparent
          }
        }
        
        ctx.putImageData(overlayData, 0, 0);
      }
    }
  }, [showMask, imageLoaded]);

  // Draw on mask canvas
  const drawOnMask = useCallback((point: Point) => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    
    const ctx = maskCanvas.getContext('2d');
    if (!ctx) return;
    
    if (tool === 'brush') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'white';
    } else {
      ctx.globalCompositeOperation = 'destination-out';
    }
    
    ctx.beginPath();
    ctx.arc(point.x, point.y, brushSize / 2, 0, 2 * Math.PI);
    ctx.fill();
    
    // Draw line to previous point for smooth strokes
    if (lastPoint && isDrawing) {
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(lastPoint.x, lastPoint.y);
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
    }
    
    updateDisplay();
    generateMaskData();
  }, [tool, brushSize, lastPoint, isDrawing, updateDisplay, generateMaskData]);

  // Clear entire mask
  const clearMask = () => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    
    const ctx = maskCanvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    updateDisplay();
    generateMaskData();
  };

  // Download mask as PNG
  const downloadMask = () => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    
    const link = document.createElement('a');
    link.download = 'mask.png';
    link.href = maskCanvas.toDataURL();
    link.click();
  };

  // Initialize image and canvases
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      const canvas = canvasRef.current;
      const maskCanvas = maskCanvasRef.current;
      
      if (!canvas || !maskCanvas) return;
      
      // Set canvas dimensions to match image
      const maxWidth = 512;
      const maxHeight = 512;
      let { width, height } = img;
      
      // Scale down if too large
      if (width > maxWidth || height > maxHeight) {
        const scale = Math.min(maxWidth / width, maxHeight / height);
        width = Math.floor(width * scale);
        height = Math.floor(height * scale);
      }
      
      canvas.width = width;
      canvas.height = height;
      maskCanvas.width = width;
      maskCanvas.height = height;
      
      imageRef.current = img;
      setImageLoaded(true);
      
      // Initial display update
      updateDisplay();
    };
    
    img.onerror = () => {
      console.error('Failed to load image for mask editor');
    };
    
    img.src = imageUrl;
  }, [imageUrl, updateDisplay]);

  // Update display when mask visibility changes
  useEffect(() => {
    if (imageLoaded) {
      updateDisplay();
    }
  }, [showMask, imageLoaded, updateDisplay]);

  // Mouse event handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const point = getMousePos(e);
    setIsDrawing(true);
    setLastPoint(point);
    drawOnMask(point);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const point = getMousePos(e);
    
    if (isDrawing) {
      drawOnMask(point);
      setLastPoint(point);
    }
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
    setLastPoint(null);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Tools */}
      <div className="flex items-center justify-between p-4 bg-slate-100 dark:bg-slate-800 rounded-lg">
        <div className="flex items-center space-x-3">
          {/* Brush/Eraser Toggle */}
          <div className="flex bg-white dark:bg-slate-700 rounded-lg p-1">
            <button
              onClick={() => setTool('brush')}
              className={`p-2 rounded-md transition-all ${
                tool === 'brush'
                  ? 'bg-blue-500 text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600'
              }`}
              title="Brush Tool - Add to mask"
            >
              <Brush className="w-4 h-4" />
            </button>
            <button
              onClick={() => setTool('eraser')}
              className={`p-2 rounded-md transition-all ${
                tool === 'eraser'
                  ? 'bg-red-500 text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600'
              }`}
              title="Eraser Tool - Remove from mask"
            >
              <Eraser className="w-4 h-4" />
            </button>
          </div>

          {/* Brush Size */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setBrushSize(Math.max(5, brushSize - 5))}
              className="p-1 text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100"
            >
              <Minus className="w-4 h-4" />
            </button>
            <div className="min-w-[60px] text-center">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {brushSize}px
              </span>
            </div>
            <button
              onClick={() => setBrushSize(Math.min(100, brushSize + 5))}
              className="p-1 text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Toggle Mask Visibility */}
          <button
            onClick={() => setShowMask(!showMask)}
            className={`p-2 rounded-md transition-all ${
              showMask
                ? 'bg-green-500 text-white'
                : 'bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300'
            }`}
            title="Toggle mask visibility"
          >
            {showMask ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>

          {/* Clear Mask */}
          <button
            onClick={clearMask}
            className="p-2 text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-all"
            title="Clear entire mask"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Download Mask */}
          <button
            onClick={downloadMask}
            className="p-2 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-all"
            title="Download mask"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="relative bg-slate-100 dark:bg-slate-800 rounded-lg p-4">
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className="max-w-full h-auto border-2 border-slate-300 dark:border-slate-600 rounded cursor-crosshair"
          style={{ 
            cursor: tool === 'brush' ? 'crosshair' : 'grab',
            touchAction: 'none'
          }}
        />
        
        {/* Hidden mask canvas */}
        <canvas
          ref={maskCanvasRef}
          className="hidden"
        />

        {/* Instructions */}
        <div className="mt-3 text-xs text-slate-500 dark:text-slate-400 text-center">
          <p>
            <span className="font-medium">White areas</span> will be style-transferred. 
            <span className="font-medium">Black areas</span> will remain unchanged.
          </p>
          <p className="mt-1">
            Use <span className="font-medium text-blue-600">brush</span> to add to mask, 
            <span className="font-medium text-red-600">eraser</span> to remove from mask.
          </p>
        </div>
      </div>
    </div>
  );
}
