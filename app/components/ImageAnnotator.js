'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { ReactSketchCanvas } from 'react-sketch-canvas';

const DRAWING_TOOLS = {
  ARROW: 'arrow',
  CIRCLE: 'circle',
  RECTANGLE: 'rectangle',
  PEN: 'pen',
  TEXT: 'text',
};

const COLORS = [
  '#FF0000', '#00FF00', '#0000FF', '#FFFF00',
  '#FF00FF', '#00FFFF', '#000000', '#FFFFFF'
];

export default function ImageAnnotator({
                                         imageUrl,
                                         onSave,
                                         onCancel,
                                         width = 800,
                                         height = 600,
                                       }) {
  const sketchRef = useRef(null);                // ReactSketchCanvas ref (freehand)
  const backgroundCanvasRef = useRef(null);      // Background image
  const annotationCanvasRef = useRef(null);      // Final shapes + text
  const overlayCanvasRef = useRef(null);         // Live preview for shapes
  const textInputRef = useRef(null);

  const [selectedTool, setSelectedTool] = useState(DRAWING_TOOLS.PEN);
  const [selectedColor, setSelectedColor] = useState('#FF0000');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState(null);
  const [showTextInput, setShowTextInput] = useState(false);
  const [textPosition, setTextPosition] = useState({ x: 0, y: 0 });
  const [textValue, setTextValue] = useState('');
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [displaySize, setDisplaySize] = useState({ width: 800, height: 600 });

  // Keep a reference to the loaded image so we can redraw on size changes if needed
  const loadedImageRef = useRef(null);

  // Load background image and preserve original resolution
  useEffect(() => {
    if (!imageUrl || !backgroundCanvasRef.current) return;

    const img = new Image();
    // Important for toBlob/exporting if image is from another origin
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      // Use original image dimensions for canvas (preserves quality)
      const originalWidth = img.width;
      const originalHeight = img.height;
      
      // Calculate display size to fit within the container
      const aspectRatio = originalWidth / originalHeight;
      let displayWidth = Math.min(width, originalWidth);
      let displayHeight = displayWidth / aspectRatio;

      if (displayHeight > height) {
        displayHeight = height;
        displayWidth = displayHeight * aspectRatio;
      }

      // Set canvas size to original resolution (for quality)
      setCanvasSize({ width: originalWidth, height: originalHeight });
      
      // Set display size for CSS scaling
      setDisplaySize({ width: displayWidth, height: displayHeight });

      // Size canvases to original resolution + draw background
      const bg = backgroundCanvasRef.current;
      bg.width = originalWidth;
      bg.height = originalHeight;
      const bgCtx = bg.getContext('2d');
      bgCtx.clearRect(0, 0, originalWidth, originalHeight);
      bgCtx.drawImage(img, 0, 0, originalWidth, originalHeight);

      // Size the other canvases to match original resolution
      if (annotationCanvasRef.current) {
        annotationCanvasRef.current.width = originalWidth;
        annotationCanvasRef.current.height = originalHeight;
      }
      if (overlayCanvasRef.current) {
        overlayCanvasRef.current.width = originalWidth;
        overlayCanvasRef.current.height = originalHeight;
      }

      loadedImageRef.current = img;
    };

    img.src = imageUrl;
  }, [imageUrl, width, height]);

  // Helpers to draw shapes
  const drawArrow = (ctx, fromX, fromY, toX, toY, color, width) => {
    const scale = Math.max(canvasSize.width / displaySize.width, canvasSize.height / displaySize.height);
    const headLength = 20 * scale; // Scale arrow head for resolution
    const dx = toX - fromX;
    const dy = toY - fromY;
    const angle = Math.atan2(dy, dx);

    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(
        toX - headLength * Math.cos(angle - Math.PI / 6),
        toY - headLength * Math.sin(angle - Math.PI / 6)
    );
    ctx.moveTo(toX, toY);
    ctx.lineTo(
        toX - headLength * Math.cos(angle + Math.PI / 6),
        toY - headLength * Math.sin(angle + Math.PI / 6)
    );
    ctx.stroke();
  };

  const drawShape = (ctx, startX, startY, endX, endY, shape, color, width) => {
    const scale = Math.max(canvasSize.width / displaySize.width, canvasSize.height / displaySize.height);
    ctx.strokeStyle = color;
    ctx.lineWidth = width * scale; // Scale stroke width for resolution
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    switch (shape) {
      case DRAWING_TOOLS.CIRCLE: {
        const radius = Math.hypot(endX - startX, endY - startY);
        ctx.beginPath();
        ctx.arc(startX, startY, radius, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case DRAWING_TOOLS.RECTANGLE: {
        ctx.beginPath();
        ctx.rect(startX, startY, endX - startX, endY - startY);
        ctx.stroke();
        break;
      }
      case DRAWING_TOOLS.ARROW: {
        drawArrow(ctx, startX, startY, endX, endY, color, width * scale);
        break;
      }
      default:
        break;
    }
  };

  // Overlay (preview) mouse handlers for shape tools + text placement
  const handleCanvasMouseDown = (e) => {
    if (!overlayCanvasRef.current) return;

    const rect = overlayCanvasRef.current.getBoundingClientRect();
    const scaleX = canvasSize.width / displaySize.width;
    const scaleY = canvasSize.height / displaySize.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    if (selectedTool === DRAWING_TOOLS.TEXT) {
      setTextPosition({ x, y });
      setTextValue('');
      setShowTextInput(true);
      // Focus after render
      setTimeout(() => textInputRef.current?.focus(), 0);
      return;
    }

    if (selectedTool !== DRAWING_TOOLS.PEN) {
      setIsDrawing(true);
      setStartPos({ x, y });
    }
  };

  const handleCanvasMouseMove = (e) => {
    if (!isDrawing || !overlayCanvasRef.current || !startPos) return;

    const rect = overlayCanvasRef.current.getBoundingClientRect();
    const scaleX = canvasSize.width / displaySize.width;
    const scaleY = canvasSize.height / displaySize.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const ctx = overlayCanvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);

    drawShape(ctx, startPos.x, startPos.y, x, y, selectedTool, selectedColor, strokeWidth);
  };

  const handleCanvasMouseUp = (e) => {
    if (!isDrawing || !overlayCanvasRef.current || !startPos || !annotationCanvasRef.current) return;

    const rect = overlayCanvasRef.current.getBoundingClientRect();
    const scaleX = canvasSize.width / displaySize.width;
    const scaleY = canvasSize.height / displaySize.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    // Commit final shape to the **annotation canvas**
    const ctx = annotationCanvasRef.current.getContext('2d');
    drawShape(ctx, startPos.x, startPos.y, x, y, selectedTool, selectedColor, strokeWidth);

    // Clear preview
    const overlayCtx = overlayCanvasRef.current.getContext('2d');
    overlayCtx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);

    setIsDrawing(false);
    setStartPos(null);
  };

  const handleTextSubmit = () => {
    if (!textValue.trim() || !annotationCanvasRef.current) {
      setShowTextInput(false);
      return;
    }
    const ctx = annotationCanvasRef.current.getContext('2d');
    const scale = Math.max(canvasSize.width / displaySize.width, canvasSize.height / displaySize.height);
    const fontSize = Math.max(10, strokeWidth * 8) * scale; // Scale font size for resolution
    ctx.font = `bold ${fontSize}px Arial`;
    ctx.fillStyle = selectedColor;
    ctx.textBaseline = 'top';
    ctx.fillText(textValue, textPosition.x, textPosition.y);
    setShowTextInput(false);
    setTextValue('');
  };

  const handleSave = useCallback(async () => {
    if (!backgroundCanvasRef.current) {
      console.error('Background canvas not available');
      return;
    }

    try {
      // Compose onto a final canvas
      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = canvasSize.width;
      finalCanvas.height = canvasSize.height;
      const finalCtx = finalCanvas.getContext('2d');

      if (!finalCtx) {
        throw new Error('Failed to get canvas context');
      }

      // 1) background
      finalCtx.drawImage(backgroundCanvasRef.current, 0, 0);

      // 2) shapes + text
      if (annotationCanvasRef.current) {
        finalCtx.drawImage(annotationCanvasRef.current, 0, 0);
      }

      // 3) freehand strokes from ReactSketchCanvas
      if (sketchRef.current) {
        try {
          // export as data URL then draw it back scaled to full resolution
          const dataUrl = await sketchRef.current.exportImage('png'); // base64
          if (dataUrl && dataUrl !== 'data:,') {
            await new Promise((resolve, reject) => {
              const img = new Image();
              img.onload = () => {
                try {
                  // Scale the pen strokes to match the full resolution canvas
                  const scaleX = canvasSize.width / displaySize.width;
                  const scaleY = canvasSize.height / displaySize.height;
                  
                  // Draw the scaled sketch layer
                  finalCtx.drawImage(
                    img, 
                    0, 0, displaySize.width, displaySize.height, // Source dimensions (display size)
                    0, 0, canvasSize.width, canvasSize.height    // Target dimensions (full resolution)
                  );
                  resolve();
                } catch (drawError) {
                  console.warn('Failed to draw sketch layer:', drawError);
                  resolve(); // Continue without sketch layer
                }
              };
              img.onerror = (error) => {
                console.warn('Failed to load sketch image:', error);
                resolve(); // Continue without sketch layer
              };
              img.src = dataUrl;
            });
          }
        } catch (sketchError) {
          console.warn('Failed to export sketch canvas:', sketchError);
          // Continue without sketch layer
        }
      }

      // Convert to blob with Promise wrapper for better error handling
      const blob = await new Promise((resolve, reject) => {
        finalCanvas.toBlob(
          (blob) => {
            if (blob && blob.size > 0) {
              resolve(blob);
            } else {
              reject(new Error('Failed to create blob - blob is null or empty'));
            }
          },
          'image/png',
          1.0
        );
      });

      console.log('Successfully created blob:', blob.size, 'bytes');
      onSave(blob);
      
    } catch (err) {
      console.error('Error saving annotated image:', err);
      // Show user-friendly error
      alert(`Failed to save annotations: ${err.message}`);
    }
  }, [onSave, canvasSize.width, canvasSize.height]);

  const handleClear = () => {
    // Clear shapes/text
    if (annotationCanvasRef.current) {
      const ctx = annotationCanvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, annotationCanvasRef.current.width, annotationCanvasRef.current.height);
    }
    // Clear pen strokes
    sketchRef.current?.clearCanvas();
    // Clear any preview
    if (overlayCanvasRef.current) {
      const ctx = overlayCanvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
    }
  };

  const handleUndo = () => sketchRef.current?.undo();
  const handleRedo = () => sketchRef.current?.redo();

  return (
      <div className="flex flex-col h-full">
        {/* Toolbar */}
        <div className="bg-white border-b border-gray-300 p-4 flex flex-wrap gap-4 items-center">
          {/* Tools */}
          <div className="flex gap-2">
            {Object.entries(DRAWING_TOOLS).map(([key, tool]) => (
                <button
                    key={tool}
                    onClick={() => setSelectedTool(tool)}
                    className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                        selectedTool === tool
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                >
                  {key}
                </button>
            ))}
          </div>

          {/* Colors */}
          <div className="flex gap-1">
            {COLORS.map((color) => (
                <button
                    key={color}
                    onClick={() => setSelectedColor(color)}
                    className={`w-8 h-8 rounded border-2 ${
                        selectedColor === color ? 'border-gray-800' : 'border-gray-300'
                    }`}
                    style={{ backgroundColor: color }}
                    aria-label={`Color ${color}`}
                />
            ))}
          </div>

          {/* Stroke Width */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Size:</label>
            <input
                type="range"
                min="1"
                max="10"
                value={strokeWidth}
                onChange={(e) => setStrokeWidth(parseInt(e.target.value))}
                className="w-24"
            />
            <span className="text-sm text-gray-600 w-6">{strokeWidth}</span>
          </div>

          {/* Actions */}
          <div className="flex gap-2 ml-auto">
            <button
                onClick={handleUndo}
                className="px-3 py-2 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300"
            >
              Undo
            </button>
            <button
                onClick={handleRedo}
                className="px-3 py-2 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300"
            >
              Redo
            </button>
            <button
                onClick={handleClear}
                className="px-3 py-2 bg-red-200 text-red-700 rounded text-sm hover:bg-red-300"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 flex items-center justify-center bg-gray-100 p-4 relative overflow-auto min-h-0">
          <div
              className="relative"
              style={{ width: displaySize.width, height: displaySize.height }}
          >
            {/* Background image */}
            <canvas
                ref={backgroundCanvasRef}
                className="absolute top-0 left-0 border border-gray-300 z-10"
                style={{ width: displaySize.width, height: displaySize.height }}
            />
            {/* Shapes + text (persistent) */}
            <canvas
                ref={annotationCanvasRef}
                className="absolute top-0 left-0 z-20"
                style={{ width: displaySize.width, height: displaySize.height }}
            />
            {/* Freehand sketch layer */}
            <ReactSketchCanvas
                ref={sketchRef}
                width={`${displaySize.width}px`}
                height={`${displaySize.height}px`}
                strokeWidth={selectedTool === DRAWING_TOOLS.PEN ? strokeWidth : 0}
                strokeColor={selectedTool === DRAWING_TOOLS.PEN ? selectedColor : 'transparent'}
                canvasColor="transparent"
                className="absolute top-0 left-0 border border-gray-300 z-30"
                style={{ width: displaySize.width, height: displaySize.height }}
                allowOnlyPointerType="all"
            />
            {/* Overlay preview for shapes / text placement */}
            <canvas
                ref={overlayCanvasRef}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                className="absolute top-0 left-0 z-40"
                style={{
                  width: displaySize.width,
                  height: displaySize.height,
                  cursor: selectedTool === DRAWING_TOOLS.TEXT ? 'text' : 'crosshair',
                  // Crucial: let PEN strokes reach ReactSketchCanvas
                  pointerEvents: selectedTool === DRAWING_TOOLS.PEN ? 'none' : 'auto',
                }}
            />
          </div>

          {/* Text input overlay */}
          {showTextInput && (
              <div
                  className="absolute bg-white border border-gray-300 rounded p-2 shadow-lg z-50"
                  style={{
                    left: (textPosition.x * displaySize.width) / canvasSize.width,
                    top: (textPosition.y * displaySize.height) / canvasSize.height,
                    transform: 'translate(-50%, -100%)',
                  }}
              >
                <input
                    ref={textInputRef}
                    type="text"
                    value={textValue}
                    onChange={(e) => setTextValue(e.target.value)}
                    placeholder="Enter text..."
                    className="border border-gray-300 rounded px-2 py-1 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleTextSubmit();
                      if (e.key === 'Escape') setShowTextInput(false);
                    }}
                    autoFocus
                />
                <div className="flex gap-1 mt-2">
                  <button
                      onClick={handleTextSubmit}
                      className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                  >
                    Add
                  </button>
                  <button
                      onClick={() => setShowTextInput(false)}
                      className="px-2 py-1 bg-gray-300 text-gray-700 text-xs rounded hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                </div>
              </div>
          )}
        </div>

        {/* Footer Actions - Always visible */}
        <div className="bg-white border-t border-gray-300 p-4 flex justify-end gap-3 flex-shrink-0">
          <button
              onClick={onCancel}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 font-medium"
          >
            Cancel
          </button>
          <button
              onClick={handleSave}
              className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
          >
            💾 Save Annotations
          </button>
        </div>
      </div>
  );
}
