// components/MaskEditor.tsx - Person Detection focused mask editor
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
  Target
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
  const [tool, setTool] = useState<'brush' | 'eraser' | 'person-detect'>('brush');
  const [brushSize, setBrushSize] = useState(20);
  const [showMask, setShowMask] = useState(true);
  const [maskOpacity, setMaskOpacity] = useState(0.5);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 512, height: 512 });
  const [mousePos, setMousePos] = useState<Point | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

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

    // Draw cursor circle for brush tools
    if (mousePos && (tool === 'brush' || tool === 'eraser') && !isProcessing) {
      ctx.save();
      ctx.strokeStyle = tool === 'brush' ? '#ff6b6b' : '#4ecdc4';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
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
  }, [showMask, maskOpacity, mousePos, tool, brushSize, isProcessing]);

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

  // Enhanced skin tone detection function
  const isSkinTone = (r: number, g: number, b: number): boolean => {
    // Convert RGB to HSV for better skin detection
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const diff = max - min;
    
    // Calculate HSV values
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
    
    // Multiple skin tone detection criteria
    const criteria1 = h >= 0 && h <= 50 && s >= 0.23 && s <= 0.68 && v >= 0.35 && v <= 0.95;
    const criteria2 = r > 95 && g > 40 && b > 20 && r > g && r > b && Math.abs(r - g) > 15;
    const criteria3 = r > 200 && g > 210 && b > 170 && Math.abs(r - g) <= 15 && r > b && g > b;
    const criteria4 = r > 120 && g > 80 && b > 50 && r >= g && g >= b && (r - g) >= 10 && (g - b) >= 5;
    
    return criteria1 || criteria2 || criteria3 || criteria4;
  };

  // Find connected regions of skin pixels
  const findConnectedRegions = (mask: Uint8Array, width: number, height: number, skinPixels: Set<string>) => {
    const visited = new Set<string>();
    const regions: Array<{points: Set<string>, centerX: number, centerY: number, size: number}> = [];
    
    for (const pixel of skinPixels) {
      if (visited.has(pixel)) continue;
      
      const [x, y] = pixel.split(',').map(Number);
      const region = new Set<string>();
      const stack = [{x, y}];
      
      let sumX = 0, sumY = 0, count = 0;
      
      while (stack.length > 0) {
        const {x: cx, y: cy} = stack.pop()!;
        const key = `${cx},${cy}`;
        
        if (visited.has(key) || cx < 0 || cx >= width || cy < 0 || cy >= height) continue;
        if (!skinPixels.has(key)) continue;
        
        visited.add(key);
        region.add(key);
        sumX += cx;
        sumY += cy;
        count++;
        
        // Add 8-connected neighbors
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            stack.push({x: cx + dx, y: cy + dy});
          }
        }
      }
      
      if (count >= 20) { // Minimum region size
        regions.push({
          points: region,
          centerX: sumX / count,
          centerY: sumY / count,
          size: count
        });
      }
    }
    
    return regions;
  };

  // Get bounding box of a region
  const getBoundingBox = (points: Set<string>) => {
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    
    for (const point of points) {
      const [x, y] = point.split(',').map(Number);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  };

  // Find the primary skin region (likely face)
  const findPrimarySkinRegion = (regions: Array<{points: Set<string>, centerX: number, centerY: number, size: number}>, width: number, height: number) => {
    if (regions.length === 0) return null;
    
    // Score regions based on size, position, and shape
    let bestRegion = regions[0];
    let bestScore = 0;
    
    for (const region of regions) {
      // Prefer larger regions
      let score = region.size;
      
      // Prefer regions in upper half (where faces usually are)
      if (region.centerY < height * 0.6) {
        score *= 1.5;
      }
      
      // Prefer regions closer to center horizontally
      const centerDistance = Math.abs(region.centerX - width / 2) / (width / 2);
      score *= (1 - centerDistance * 0.3);
      
      // Prefer regions that are not too elongated (more face-like)
      const boundingBox = getBoundingBox(region.points);
      const aspectRatio = boundingBox.width / boundingBox.height;
      if (aspectRatio > 0.5 && aspectRatio < 2) {
        score *= 1.2;
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestRegion = region;
      }
    }
    
    return bestRegion;
  };

  // Sample background colors from image edges
  const sampleBackgroundColors = (data: Uint8ClampedArray, width: number, height: number) => {
    const colors: Array<{r: number, g: number, b: number}> = [];
    const sampleSize = 5;
    
    // Sample from edges
    for (let i = 0; i < width; i += sampleSize) {
      // Top edge
      const topIndex = i * 4;
      colors.push({r: data[topIndex], g: data[topIndex + 1], b: data[topIndex + 2]});
      
      // Bottom edge
      const bottomIndex = ((height - 1) * width + i) * 4;
      colors.push({r: data[bottomIndex], g: data[bottomIndex + 1], b: data[bottomIndex + 2]});
    }
    
    for (let i = 0; i < height; i += sampleSize) {
      // Left edge
      const leftIndex = (i * width) * 4;
      colors.push({r: data[leftIndex], g: data[leftIndex + 1], b: data[leftIndex + 2]});
      
      // Right edge
      const rightIndex = (i * width + width - 1) * 4;
      colors.push({r: data[rightIndex], g: data[rightIndex + 1], b: data[rightIndex + 2]});
    }
    
    return colors;
  };

  // Check if color is similar to background colors
  const isBackgroundColor = (r: number, g: number, b: number, bgColors: Array<{r: number, g: number, b: number}>) => {
    const threshold = 40;
    
    for (const bg of bgColors) {
      const distance = Math.sqrt(
        Math.pow(r - bg.r, 2) + 
        Math.pow(g - bg.g, 2) + 
        Math.pow(b - bg.b, 2)
      );
      
      if (distance < threshold) {
        return true;
      }
    }
    
    return false;
  };

  // Check if color is person-like (clothing, skin, hair, etc.)
  const isPersonLikeColor = (r: number, g: number, b: number) => {
    // Accept skin tones
    if (isSkinTone(r, g, b)) return true;
    
    // Accept typical clothing colors (avoid very bright backgrounds)
    const brightness = (r + g + b) / 3;
    const saturation = (Math.max(r, g, b) - Math.min(r, g, b)) / Math.max(r, g, b);
    
    // Accept darker colors (hair, clothing)
    if (brightness < 200) return true;
    
    // Accept moderately saturated colors (clothing)
    if (saturation > 0.2 && brightness < 240) return true;
    
    return false;
  };

  // Expand mask around detected person using region growing
  const expandPersonMask = (data: Uint8ClampedArray, width: number, height: number, skinRegion: {points: Set<string>, centerX: number, centerY: number}) => {
    const mask = new Uint8Array(width * height);
    
    // Start with skin region
    for (const point of skinRegion.points) {
      const [x, y] = point.split(',').map(Number);
      mask[y * width + x] = 255;
    }
    
    // Get bounding box of skin region and expand it
    const bbox = getBoundingBox(skinRegion.points);
    
    // Estimate person body area based on face position
    const faceWidth = bbox.width;
    const faceHeight = bbox.height;
    const faceCenterX = skinRegion.centerX;
    const faceCenterY = skinRegion.centerY;
    
    // Typical person proportions (head is about 1/8 of body height)
    const estimatedBodyHeight = faceHeight * 7;
    const estimatedBodyWidth = faceWidth * 3;
    
    // Define person area (from head to estimated body bottom)
    const bodyTop = Math.max(0, faceCenterY - faceHeight);
    const bodyBottom = Math.min(height - 1, faceCenterY + estimatedBodyHeight);
    const bodyLeft = Math.max(0, faceCenterX - estimatedBodyWidth / 2);
    const bodyRight = Math.min(width - 1, faceCenterX + estimatedBodyWidth / 2);
    
    // Sample background colors from image edges
    const bgColors = sampleBackgroundColors(data, width, height);
    
    // Region growing within estimated person area
    const queue: {x: number, y: number}[] = [];
    const visited = new Set<string>();
    
    // Add skin pixels as seeds
    for (const point of skinRegion.points) {
      const [x, y] = point.split(',').map(Number);
      queue.push({x, y});
      visited.add(`${x},${y}`);
    }
    
    while (queue.length > 0) {
      const {x, y} = queue.shift()!;
      
      // Check 8-connected neighbors
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          
          const nx = x + dx;
          const ny = y + dy;
          const key = `${nx},${ny}`;
          
          if (nx < bodyLeft || nx > bodyRight || ny < bodyTop || ny > bodyBottom) continue;
          if (visited.has(key)) continue;
          
          const index = (ny * width + nx) * 4;
          const r = data[index];
          const g = data[index + 1];
          const b = data[index + 2];
          
          // Check if pixel is person-like (not background)
          if (!isBackgroundColor(r, g, b, bgColors) && isPersonLikeColor(r, g, b)) {
            mask[ny * width + nx] = 255;
            queue.push({x: nx, y: ny});
          }
          
          visited.add(key);
        }
      }
    }
    
    return mask;
  };

  // Fallback to general subject detection if person detection fails
  const fallbackSubjectDetection = (data: Uint8ClampedArray, width: number, height: number, maskCtx: CanvasRenderingContext2D) => {
    // Simple center-weighted subject detection as fallback
    const centerX = width / 2;
    const centerY = height / 2;
    const maxDistance = Math.sqrt(centerX * centerX + centerY * centerY);
    
    // Sample edge colors for background
    const edgeColors: number[][] = [];
    const sampleSize = 10;
    
    for (let x = 0; x < width; x += sampleSize) {
      const topIndex = x * 4;
      const bottomIndex = ((height - 1) * width + x) * 4;
      edgeColors.push([data[topIndex], data[topIndex + 1], data[topIndex + 2]]);
      edgeColors.push([data[bottomIndex], data[bottomIndex + 1], data[bottomIndex + 2]]);
    }
    
    const avgBgColor = edgeColors.reduce((acc, color) => {
      acc[0] += color[0];
      acc[1] += color[1];
      acc[2] += color[2];
      return acc;
    }, [0, 0, 0]).map(c => c / edgeColors.length);

    const maskData = maskCtx.createImageData(width, height);
    const maskPixels = maskData.data;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;
        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];

        const colorDiff = Math.sqrt(
          Math.pow(r - avgBgColor[0], 2) + 
          Math.pow(g - avgBgColor[1], 2) + 
          Math.pow(b - avgBgColor[2], 2)
        );

        const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
        const centerWeight = 1 - (distance / maxDistance);
        const score = (colorDiff / 255) * centerWeight;
        
        if (score > 0.3) {
          maskPixels[index] = 255;
          maskPixels[index + 1] = 255;
          maskPixels[index + 2] = 255;
          maskPixels[index + 3] = 255;
        }
      }
    }

    maskCtx.putImageData(maskData, 0, 0);
    updateMaskPreview();
    generateMaskData();
  };

  // Person detection - specifically detects people in images
  const detectPerson = useCallback(() => {
    const canvas = canvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    if (!canvas || !maskCanvas) return;

    const ctx = canvas.getContext('2d');
    const maskCtx = maskCanvas.getContext('2d');
    if (!ctx || !maskCtx) return;

    setIsProcessing(true);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const width = canvas.width;
    const height = canvas.height;

    maskCtx.clearRect(0, 0, width, height);

    // Person detection algorithm
    const personMask = new Uint8Array(width * height);
    
    // Step 1: Detect skin tones
    const skinPixels = new Set<string>();
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;
        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];
        
        // Enhanced skin tone detection with multiple criteria
        if (isSkinTone(r, g, b)) {
          skinPixels.add(`${x},${y}`);
          personMask[y * width + x] = 255;
        }
      }
    }

    // Step 2: Find connected skin regions (potential face/hands)
    const skinRegions = findConnectedRegions(personMask, width, height, skinPixels);
    
    // Step 3: Identify the largest/most central skin region (likely face)
    const primarySkinRegion = findPrimarySkinRegion(skinRegions, width, height);
    
    if (!primarySkinRegion || primarySkinRegion.size < 50) {
      // Fallback to general subject detection if no person detected
      fallbackSubjectDetection(data, width, height, maskCtx);
      setIsProcessing(false);
      return;
    }

    // Step 4: Expand mask around detected person area
    const finalMask = expandPersonMask(data, width, height, primarySkinRegion);
    
    // Step 5: Apply the person mask
    const maskData = maskCtx.createImageData(width, height);
    const maskPixels = maskData.data;
    
    for (let i = 0; i < finalMask.length; i++) {
      if (finalMask[i] > 0) {
        maskPixels[i * 4] = 255;     // R
        maskPixels[i * 4 + 1] = 255; // G
        maskPixels[i * 4 + 2] = 255; // B
        maskPixels[i * 4 + 3] = 255; // A
      }
    }

    maskCtx.putImageData(maskData, 0, 0);
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
    
    // Automatically apply person detection after a short delay
    setTimeout(() => {
      detectPerson();
    }, 100);
  }, [detectPerson]);

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

  // Track mouse movement for cursor preview
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getMousePos(e);
    setMousePos(pos);
    
    if (isDrawing && (tool === 'brush' || tool === 'eraser')) {
      drawOnMask(pos, pos);
    }
  }, [isDrawing, tool, drawOnMask]);

  // Handle mouse leave
  const handleMouseLeave = useCallback(() => {
    setMousePos(null);
    setIsDrawing(false);
  }, []);

  // Start drawing
  const startDrawing = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getMousePos(e);
    
    if (tool === 'brush' || tool === 'eraser') {
      setIsDrawing(true);
      drawOnMask(pos, pos);
    }
  }, [tool, drawOnMask]);

  // Continue drawing
  const draw = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    handleMouseMove(e);
  }, [handleMouseMove]);

  // Stop drawing
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
    updateMaskPreview();
    onMaskUpdate(null);
  }, [updateMaskPreview, onMaskUpdate]);

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

  // Update mask preview when settings change
  useEffect(() => {
    if (imageLoaded) {
      updateMaskPreview();
    }
  }, [showMask, maskOpacity, imageLoaded, mousePos, tool, brushSize, updateMaskPreview]);

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
            <button
              onClick={() => detectPerson()}
              disabled={isProcessing}
              className={`p-2 rounded-lg transition-colors ${
                isProcessing
                  ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                  : 'bg-purple-500 text-white hover:bg-purple-600'
              }`}
              title="Detect person automatically"
            >
              <Target className="w-4 h-4" />
            </button>
          </div>

          {/* Brush Size */}
          {(tool === 'brush' || tool === 'eraser') && (
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
          )}

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
          onMouseMove={handleMouseMove}
          onMouseUp={stopDrawing}
          onMouseLeave={handleMouseLeave}
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
              <p>Loading image and detecting person...</p>
            </div>
          </div>
        )}
        
        {/* Tool indicator */}
        {imageLoaded && (
          <div className="absolute top-2 left-2 bg-black bg-opacity-75 text-white px-2 py-1 rounded text-xs">
            {isProcessing ? (
              <span className="flex items-center space-x-1">
                <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Processing...</span>
              </span>
            ) : (
              <>
                {tool === 'brush' && `🖌️ Brush • ${brushSize}px`}
                {tool === 'eraser' && `🧽 Eraser • ${brushSize}px`}
                {tool === 'person-detect' && `👤 Person Detection`}
              </>
            )}
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
        <p><strong>Person Detection & Masking:</strong></p>
        <ul className="list-disc list-inside space-y-1">
          <li><strong>👤 Automatic Person Detection:</strong> Detects and masks people automatically when you upload an image</li>
          <li><strong>🖌️ Brush Tool:</strong> Manually add areas to the person mask</li>
          <li><strong>🧽 Eraser Tool:</strong> Remove areas from the person mask</li>
          <li><strong>🎯 Re-detect Person:</strong> Click the target button to run person detection again</li>
          <li><strong>Algorithm:</strong> Uses skin tone detection + human proportions + intelligent region growing</li>
          <li><strong>Best for:</strong> Portraits, full-body photos, group photos, fashion shots</li>
          <li>Red overlay shows detected person areas that will receive style transfer</li>
        </ul>
      </div>
    </div>
  );
}