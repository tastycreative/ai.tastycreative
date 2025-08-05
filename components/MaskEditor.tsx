// components/MaskEditor.tsx - Canvas-based mask editor like ComfyUI clipspace
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
  EyeOff
} from 'lucide-react';

interface MaskEditorProps {
  imageUrl: string;
  onMaskUpdate: (maskDataUrl: string | null) => void;
  className?: string;
}

interface Point {
  x: number;
  y: number;
}

export default function MaskEditor({ imageUrl, onMaskUpdate, className = '' }: MaskEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<'brush' | 'eraser'>('brush');
  const [brushSize, setBrushSize] = useState(20);
  const [showMask, setShowMask] = useState(true);
  const [maskOpacity, setMaskOpacity] = useState(0.5);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 512, height: 512 });

  // Initialize canvas when image loads
  const initializeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    const image = imageRef.current;
    
    if (!canvas || !maskCanvas || !image) return;
    
    // Set canvas size to match image
    const maxWidth = 512;
    const maxHeight = 512;
    
    let { width, height } = image;
    
    // Scale down if too large
    if (width > maxWidth || height > maxHeight) {
      const scale = Math.min(maxWidth / width, maxHeight / height);
      width *= scale;
      height *= scale;
    }
    
    setCanvasSize({ width, height });
    
    // Set both canvas sizes
    [canvas, maskCanvas].forEach(c => {
      c.width = width;
      c.height = height;
      c.style.width = `${width}px`;
      c.style.height = `${height}px`;
    });
    
    // Draw image on main canvas
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(image, 0, 0, width, height);
    }
    
    // Initialize mask canvas with transparent background
    const maskCtx = maskCanvas.getContext('2d');
    if (maskCtx) {
      maskCtx.fillStyle = 'rgba(0, 0, 0, 0)';
      maskCtx.fillRect(0, 0, width, height);
    }
    
    setImageLoaded(true);
  }, []);

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

  // Start drawing
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const pos = getMousePos(e);
    drawOnMask(pos, pos);
  };

  // Draw on mask
  const drawOnMask = (from: Point, to: Point) => {
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
  };

  // Continue drawing
  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    
    const pos = getMousePos(e);
    drawOnMask(pos, pos);
  };

  // Stop drawing
  const stopDrawing = () => {
    setIsDrawing(false);
    generateMaskData();
  };

  // Update mask preview overlay
  const updateMaskPreview = () => {
    const canvas = canvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    
    if (!canvas || !maskCanvas || !imageRef.current) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear and redraw image
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imageRef.current, 0, 0, canvas.width, canvas.height);
    
    if (showMask) {
      // Overlay mask with red tint
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = maskOpacity;
      ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
      
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
  };

  // Generate mask data and notify parent
  const generateMaskData = () => {
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
  };

  // Clear mask
  const clearMask = () => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    
    const ctx = maskCanvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    updateMaskPreview();
    onMaskUpdate(null);
  };

  // Download mask
  const downloadMask = () => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    
    const link = document.createElement('a');
    link.download = 'mask.png';
    link.href = maskCanvas.toDataURL();
    link.click();
  };

  // Upload mask
  const uploadMask = () => {
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
  };

  // Update mask preview when settings change
  useEffect(() => {
    if (imageLoaded) {
      updateMaskPreview();
    }
  }, [showMask, maskOpacity, imageLoaded]);

  return (
    <div className={`mask-editor ${className}`}>
      {/* Hidden image element for loading */}
      <img 
        ref={imageRef} 
        style={{ display: 'none' }} 
        alt="Reference for masking"
      />
      
      {/* Mask Tools */}
      <div className="mask-tools mb-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
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
              title="Brush - Draw mask"
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
              title="Eraser - Remove mask"
            >
              <Eraser className="w-4 h-4" />
            </button>
          </div>

          {/* Brush Size */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setBrushSize(Math.max(1, brushSize - 5))}
              className="p-1 bg-gray-200 dark:bg-gray-700 rounded"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="text-sm min-w-[3rem] text-center">{brushSize}px</span>
            <button
              onClick={() => setBrushSize(Math.min(100, brushSize + 5))}
              className="p-1 bg-gray-200 dark:bg-gray-700 rounded"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>

          {/* Mask Visibility */}
          <button
            onClick={() => setShowMask(!showMask)}
            className={`p-2 rounded-lg transition-colors ${
              showMask 
                ? 'bg-green-500 text-white' 
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
            title={showMask ? 'Hide mask overlay' : 'Show mask overlay'}
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
              title="Clear mask"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={downloadMask}
              className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
              title="Download mask"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={uploadMask}
              className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              title="Upload mask"
            >
              <Upload className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Canvas Container */}
      <div className="canvas-container relative inline-block border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
        {/* Main canvas (shows image + mask overlay) */}
        <canvas
          ref={canvasRef}
          className="block cursor-crosshair"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          style={{ 
            width: canvasSize.width, 
            height: canvasSize.height,
            maxWidth: '100%',
            height: 'auto'
          }}
        />
        
        {/* Hidden mask canvas */}
        <canvas
          ref={maskCanvasRef}
          style={{ display: 'none' }}
        />
        
        {/* Instructions overlay */}
        {!imageLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800">
            <div className="text-center text-gray-500 dark:text-gray-400">
              <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
              <p>Loading image for masking...</p>
            </div>
          </div>
        )}
        
        {/* Tool indicator */}
        {imageLoaded && (
          <div className="absolute top-2 left-2 bg-black bg-opacity-75 text-white px-2 py-1 rounded text-xs">
            {tool === 'brush' ? '🖌️ Brush' : '🧽 Eraser'} • {brushSize}px
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
        <p><strong>Instructions:</strong></p>
        <ul className="list-disc list-inside space-y-1">
          <li>Use the <strong>Brush</strong> tool to paint areas you want to apply style transfer to</li>
          <li>Use the <strong>Eraser</strong> tool to remove mask areas</li>
          <li>White areas = styled, Black areas = original</li>
          <li>Adjust brush size and mask opacity as needed</li>
          <li>Toggle mask visibility to see your original image</li>
        </ul>
      </div>
    </div>
  );
}