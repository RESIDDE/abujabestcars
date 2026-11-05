import React, { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { XCircle, PenLine } from "lucide-react";
import { useTheme } from "next-themes";

interface SignaturePadProps {
  value?: string;
  onChange: (dataUrl: string) => void;
}

export function SignaturePad({ value, onChange }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  // Always capture digital signatures with solid black ink so they render crisply on receipts and documents
  const strokeColor = "#000000";

  // Initialize and size canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size with device pixel ratio for sharp rendering
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = strokeColor;

    // Load existing signature if provided
    if (value) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
        setHasDrawn(true);
      };
      img.src = value;
    }
  }, [value, strokeColor]);

  const getPos = (e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY };
  };

  const startDraw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setIsDrawing(true);
  };

  const draw = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setHasDrawn(true);
  };

  const endDraw = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      onChange(canvas.toDataURL("image/png"));
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    setHasDrawn(false);
    onChange("");
  };

  return (
    <div className="space-y-2">
      <div className="relative rounded-2xl border-2 border-zinc-300 dark:border-zinc-600 bg-white shadow-inner overflow-hidden">
        <canvas
          ref={canvasRef}
          className="w-full h-40 cursor-crosshair touch-none bg-white"
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
        {!hasDrawn && !value && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-zinc-400 text-xs font-semibold tracking-wider uppercase gap-1.5 select-none">
            <PenLine className="w-4 h-4 opacity-60 text-zinc-500" />
            <span>Sign here with finger or mouse</span>
          </div>
        )}
        <div className="pointer-events-none absolute bottom-5 left-6 right-6 border-b border-dashed border-zinc-300" />
      </div>
      <div className="flex items-center justify-between">
        <Button 
          type="button" 
          variant="ghost" 
          size="sm" 
          onClick={clear}
          className="text-xs font-semibold text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all gap-1.5 h-8 px-2.5"
        >
          <XCircle className="w-3.5 h-3.5" />
          Clear Signature
        </Button>
        <span className="text-[10px] text-muted-foreground/60">Digital Signature</span>
      </div>
    </div>
  );
}
