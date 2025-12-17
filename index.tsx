import React, { useState, useRef, useEffect, useCallback } from "react";
import { createRoot } from "react-dom/client";
import { 
  Upload, 
  Download, 
  X, 
  Settings2, 
  Type, 
  Image as ImageIcon, 
  Palette, 
  LayoutTemplate,
  Move,
  Trash2,
  Check,
  RefreshCcw,
  Loader2,
  Maximize2,
  Eye,
  EyeOff,
  Split,
  HardDriveDownload,
  Scaling,
  Wand2,
  ArrowLeftRight,
  CheckCircle2,
  Layers,
  Sliders,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link as LinkIcon,
  Unlink,
  Lock,
  Unlock,
  RectangleHorizontal
} from "lucide-react";
// @ts-ignore
import JSZip from "https://esm.run/jszip";

// --- Types ---

type Position = 
  | "top-left" | "top-center" | "top-right"
  | "center-left" | "center" | "center-right"
  | "bottom-left" | "bottom-center" | "bottom-right";

type Alignment = 'left' | 'center' | 'right';

interface LayerSettings {
  enabled: boolean;
  text: string;
  fontSize: number;
  fontFamily: string;
  color: string;
  opacity: number;
  
  // Background / Protection
  bgEnabled: boolean;
  bgOpacity: number; // 0 - 1
  bgBlur: number;    // Controls the fade length (directional blur feel)
  bgPadding: number;
  
  // Absolute Positioning
  position: Position;
  offsetX: number;
  offsetY: number;

  // Relative Positioning (For Sub Layer)
  isLinkedToMain?: boolean;
  linkAlignment?: Alignment;
  linkSpacing?: number;
}

interface WatermarkSettings {
  // Image Processing
  resizeMode: 'original' | 'fixed-long-edge' | 'manual';
  resizeLongEdge: number;
  resizeWidth?: number;
  resizeHeight?: number;
  autoEnhance: boolean;
  enhanceIntensity: number; // 0 - 100
  
  // Layers
  main: LayerSettings;
  sub: LayerSettings;
}

interface ProcessedImage {
  id: string;
  file: File;
  previewUrl: string; // Original blob URL
  originalWidth: number;
  originalHeight: number;
  settings: WatermarkSettings;
  isCustomized: boolean;
}

interface FontOption {
  name: string;
  value: string;
}

// --- Constants ---

const INITIAL_FONTS: FontOption[] = [
  { name: "标准黑体 (Web)", value: "'Noto Sans SC', sans-serif" },
  { name: "优雅宋体 (Web)", value: "'Noto Serif SC', serif" },
  { name: "书法艺术 (Web)", value: "'Ma Shan Zheng', cursive" },
  { name: "代码等宽 (Web)", value: "'Roboto Mono', monospace" },
  { name: "方正兰亭中粗黑 (Local)", value: "'FZLanTingHei-DB-GBK', '方正兰亭中粗黑', 'Microsoft YaHei', sans-serif" },
  { name: "微软雅黑 (Win)", value: "'Microsoft YaHei', '微软雅黑', sans-serif" },
  { name: "黑体 (Win)", value: "SimHei, '黑体', sans-serif" },
  { name: "宋体 (Win)", value: "SimSun, '宋体', serif" },
  { name: "楷体 (Win)", value: "KaiTi, '楷体', serif" },
  { name: "苹方 (Mac)", value: "'PingFang SC', sans-serif" },
];

const POSITIONS: Position[] = [
  "top-left", "top-center", "top-right",
  "center-left", "center", "center-right",
  "bottom-left", "bottom-center", "bottom-right"
];

const DEFAULT_LAYER: LayerSettings = {
  enabled: true,
  text: "在此输入水印",
  fontSize: 48,
  fontFamily: "'Noto Sans SC', sans-serif",
  color: "#ffffff",
  opacity: 0.9,
  
  bgEnabled: false,
  bgOpacity: 0.6,
  bgBlur: 20,
  bgPadding: 15,

  position: "bottom-right",
  offsetX: 20,
  offsetY: 20,
  isLinkedToMain: false,
};

const DEFAULT_SETTINGS: WatermarkSettings = {
  resizeMode: 'original',
  resizeLongEdge: 1920,
  resizeWidth: 0,
  resizeHeight: 0,
  autoEnhance: false,
  enhanceIntensity: 50,
  main: { ...DEFAULT_LAYER },
  sub: { 
    ...DEFAULT_LAYER, 
    enabled: false, 
    text: "副标题 / 第二行水印", 
    fontSize: 24, 
    position: "bottom-right",
    offsetY: 80,
    isLinkedToMain: true, // Default to linked
    linkAlignment: 'left',
    linkSpacing: 10
  },
};

// --- Helper Functions ---

const generateId = () => Math.random().toString(36).substr(2, 9);

const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
};

// --- Components ---

const Button = ({ 
  children, onClick, variant = "primary", className = "", disabled = false, icon: Icon, title, ...props 
}: any) => {
  const baseStyle = "inline-flex items-center justify-center rounded-md text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2";
  const variants = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-900/20",
    secondary: "bg-zinc-800 text-zinc-100 hover:bg-zinc-700 border border-zinc-700",
    outline: "border border-zinc-700 bg-transparent hover:bg-zinc-800 text-zinc-300",
    ghost: "hover:bg-zinc-800 text-zinc-300",
    destructive: "bg-red-900/50 text-red-200 border border-red-900 hover:bg-red-900/70",
  };
  
  return (
    <button 
      onClick={onClick} 
      disabled={disabled}
      title={title}
      className={`${baseStyle} ${variants[variant as keyof typeof variants]} ${className}`}
      {...props}
    >
      {Icon && <Icon className="mr-2 h-4 w-4" />}
      {children}
    </button>
  );
};

const Label = ({ children, className = "" }: any) => (
  <label className={`text-xs font-medium uppercase tracking-wider text-zinc-500 mb-1.5 block ${className}`}>
    {children}
  </label>
);

const Input = (props: any) => (
  <input 
    {...props}
    className={`flex h-10 w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white ring-offset-zinc-950 placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:cursor-not-allowed disabled:opacity-50 ${props.className || ''}`} 
  />
);

const Slider = ({ value, min, max, step = 1, onChange, className = "" }: any) => (
  <input 
    type="range" 
    min={min} 
    max={max} 
    step={step}
    value={value} 
    onChange={(e) => onChange(Number(e.target.value))}
    className={`w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500 ${className}`}
  />
);

const ColorPicker = ({ value, onChange }: any) => (
  <div className="flex items-center gap-3">
    <div className="relative w-10 h-10 rounded-lg border border-zinc-600 overflow-hidden shadow-sm hover:border-zinc-500 transition-colors">
      <input 
        type="color" 
        value={value} 
        onChange={(e) => onChange(e.target.value)}
        className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] p-0 border-0 cursor-pointer" 
      />
    </div>
    <span className="text-sm text-zinc-400 font-mono bg-zinc-800 px-2 py-1 rounded border border-zinc-700 select-all">{value}</span>
  </div>
);

// --- Image Processing Hook ---

const useImageProcessor = () => {
  const drawWatermark = useCallback((
    img: HTMLImageElement, 
    settings: WatermarkSettings, 
    originalWidth: number, 
    originalHeight: number
  ): string => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return "";

    // 1. Determine Dimensions
    let width = originalWidth;
    let height = originalHeight;

    if (settings.resizeMode === 'fixed-long-edge' && settings.resizeLongEdge > 0) {
      const longSide = Math.max(width, height);
      const scale = settings.resizeLongEdge / longSide;
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    } else if (settings.resizeMode === 'manual' && settings.resizeWidth && settings.resizeHeight) {
      width = settings.resizeWidth;
      height = settings.resizeHeight;
    }

    canvas.width = width;
    canvas.height = height;

    // 2. Enhance with Intensity
    if (settings.autoEnhance) {
      const intensity = (settings.enhanceIntensity ?? 50) / 100; // 0 to 1
      const contrast = 1 + (0.2 * intensity);
      const saturate = 1 + (0.4 * intensity);
      const brightness = 1 + (0.1 * intensity);
      ctx.filter = `contrast(${contrast}) saturate(${saturate}) brightness(${brightness})`;
    } else {
      ctx.filter = "none";
    }

    // 3. Draw Image
    ctx.drawImage(img, 0, 0, width, height);
    ctx.filter = "none"; 

    // Global Scale Factor
    const scaleFactor = Math.max(width, height) / 1000;

    // --- Helper to measure and calculate layer position ---
    const calculateLayerMetrics = (layer: LayerSettings) => {
      if (!layer.enabled || !layer.text) return null;

      const fontSize = layer.fontSize * scaleFactor;
      ctx.font = `${fontSize}px ${layer.fontFamily}`;
      const textMetrics = ctx.measureText(layer.text);
      
      const heightMetric = ctx.measureText('M');
      const textHeight = heightMetric.width * 1.2; 

      return { w: textMetrics.width, h: textHeight, fontSize };
    };

    // --- Helper to Draw Background (With Directional Fade) ---
    const drawBackground = (x: number, y: number, w: number, h: number, layer: LayerSettings) => {
      if (!layer.bgEnabled) return;
      
      const padding = layer.bgPadding * scaleFactor;
      // Calculate blur length as a factor of padding + extra scale
      // This creates the "left/right directional blur" effect via gradient
      const blurFactor = layer.bgBlur / 50; // 0 to 1
      const extraWidth = w * blurFactor * 0.5; // Extend width based on blur
      
      const bgX = x - padding - extraWidth;
      const bgY = y - padding;
      const bgW = w + (padding * 2) + (extraWidth * 2);
      const bgH = h + padding * 2;

      ctx.save();
      
      // Use Linear Gradient for "Left-Right" blur feel
      const gradient = ctx.createLinearGradient(bgX, 0, bgX + bgW, 0);
      
      // Calculate fade stops
      // If blur is 0, stops are at 0 and 1 (hard edge)
      // If blur is high, stops move inward
      const fadeSize = Math.max(0.01, blurFactor * 0.4); // Max 40% fade on each side
      
      const colorCenter = `rgba(0,0,0,${layer.bgOpacity})`;
      const colorEdge = `rgba(0,0,0,0)`;
      
      gradient.addColorStop(0, colorEdge);
      gradient.addColorStop(fadeSize, colorCenter);
      gradient.addColorStop(1 - fadeSize, colorCenter);
      gradient.addColorStop(1, colorEdge);

      ctx.fillStyle = gradient;
      
      // Optional: Add a small vertical shadow for softness if blur > 0
      if (layer.bgBlur > 5) {
         ctx.shadowColor = "rgba(0,0,0,0.5)";
         ctx.shadowBlur = layer.bgBlur * scaleFactor * 0.5;
      }
      
      ctx.fillRect(bgX, bgY, bgW, bgH);
      ctx.restore();
    };

    // --- Helper to Draw Text ---
    const drawText = (x: number, y: number, layer: LayerSettings, fontSize: number) => {
      const { r, g, b } = hexToRgb(layer.color);
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${layer.opacity})`;
      ctx.textBaseline = 'top';
      
      // Text Drop Shadow
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 4 * scaleFactor;
      ctx.shadowOffsetX = 2 * scaleFactor;
      ctx.shadowOffsetY = 2 * scaleFactor;
      
      ctx.font = `${fontSize}px ${layer.fontFamily}`;
      ctx.fillText(layer.text, x, y);
    };

    // --- 4. Draw Main Layer ---
    let mainMetrics = { x: 0, y: 0, w: 0, h: 0 };
    
    if (settings.main.enabled && settings.main.text) {
       const m = calculateLayerMetrics(settings.main);
       if (m) {
          // Calculate Absolute Position for Main
          let x = 0;
          let y = 0;
          
          switch (settings.main.position) {
            case 'top-left': x = 0; y = 0; break;
            case 'top-center': x = (width - m.w) / 2; y = 0; break;
            case 'top-right': x = width - m.w; y = 0; break;
            case 'center-left': x = 0; y = (height - m.h) / 2; break;
            case 'center': x = (width - m.w) / 2; y = (height - m.h) / 2; break;
            case 'center-right': x = width - m.w; y = (height - m.h) / 2; break;
            case 'bottom-left': x = 0; y = height - m.h; break;
            case 'bottom-center': x = (width - m.w) / 2; y = height - m.h; break;
            case 'bottom-right': x = width - m.w; y = height - m.h; break;
          }

          const offsetX = settings.main.offsetX * scaleFactor;
          const offsetY = settings.main.offsetY * scaleFactor;

          if (settings.main.position.includes('left')) x += offsetX;
          if (settings.main.position.includes('right')) x -= offsetX;
          if (settings.main.position.includes('top')) y += offsetY;
          if (settings.main.position.includes('bottom')) y -= offsetY;

          // Draw Background First
          drawBackground(x, y, m.w, m.h, settings.main);
          // Draw Text
          drawText(x, y, settings.main, m.fontSize);

          // Save metrics for sub layer
          mainMetrics = { x, y, w: m.w, h: m.h };
       }
    }

    // --- 5. Draw Sub Layer ---
    if (settings.sub.enabled && settings.sub.text) {
       const s = calculateLayerMetrics(settings.sub);
       if (s) {
          let x = 0;
          let y = 0;

          if (settings.sub.isLinkedToMain && settings.main.enabled) {
             // Relative Positioning
             const spacing = (settings.sub.linkSpacing || 0) * scaleFactor;
             y = mainMetrics.y + mainMetrics.h + spacing;

             // Alignment relative to main
             const align = settings.sub.linkAlignment || 'left';
             if (align === 'left') {
               x = mainMetrics.x;
             } else if (align === 'center') {
               x = mainMetrics.x + (mainMetrics.w - s.w) / 2;
             } else if (align === 'right') {
               x = mainMetrics.x + mainMetrics.w - s.w;
             }
          } else {
             // Absolute Positioning
             switch (settings.sub.position) {
                case 'top-left': x = 0; y = 0; break;
                case 'top-center': x = (width - s.w) / 2; y = 0; break;
                case 'top-right': x = width - s.w; y = 0; break;
                case 'center-left': x = 0; y = (height - s.h) / 2; break;
                case 'center': x = (width - s.w) / 2; y = (height - s.h) / 2; break;
                case 'center-right': x = width - s.w; y = (height - s.h) / 2; break;
                case 'bottom-left': x = 0; y = height - s.h; break;
                case 'bottom-center': x = (width - s.w) / 2; y = height - s.h; break;
                case 'bottom-right': x = width - s.w; y = height - s.h; break;
              }
              const offsetX = settings.sub.offsetX * scaleFactor;
              const offsetY = settings.sub.offsetY * scaleFactor;
              if (settings.sub.position.includes('left')) x += offsetX;
              if (settings.sub.position.includes('right')) x -= offsetX;
              if (settings.sub.position.includes('top')) y += offsetY;
              if (settings.sub.position.includes('bottom')) y -= offsetY;
          }

          // Draw Background First
          drawBackground(x, y, s.w, s.h, settings.sub);
          // Draw Text
          drawText(x, y, settings.sub, s.fontSize);
       }
    }

    return canvas.toDataURL('image/jpeg', 0.9);
  }, []);

  return { drawWatermark };
};

// --- Comparison Modal Component ---

const ComparisonModal = ({ 
  imageA, 
  imageB, 
  onClose,
  drawWatermark
}: { 
  imageA: ProcessedImage, 
  imageB: ProcessedImage, 
  onClose: () => void,
  drawWatermark: any
}) => {
  const [sliderPos, setSliderPos] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [srcA, setSrcA] = useState<string>("");
  const [srcB, setSrcB] = useState<string>("");

  useEffect(() => {
    const generate = async (imgItem: ProcessedImage, setSrc: Function) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = imgItem.previewUrl;
      img.onload = () => {
        const url = drawWatermark(img, imgItem.settings, imgItem.originalWidth, imgItem.originalHeight);
        setSrc(url);
      };
    };
    generate(imageA, setSrcA);
    generate(imageB, setSrcB);
  }, [imageA, imageB, drawWatermark]);

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    let clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percentage = (x / rect.width) * 100;
    setSliderPos(percentage);
  };

  const handleInteractionStart = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDragging(true);
    handleMouseMove(e);
  };

  const handleInteractionEnd = () => {
    setIsDragging(false);
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black flex flex-col animate-in fade-in duration-200">
      <div className="absolute top-4 right-4 z-50">
        <button 
          onClick={onClose}
          className="bg-zinc-900/80 backdrop-blur text-white p-2 rounded-full hover:bg-zinc-800 border border-zinc-700"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="h-12 flex items-center justify-center gap-8 bg-zinc-900 border-b border-zinc-800 z-10 shrink-0">
           <div className="flex items-center gap-2 text-sm text-zinc-400">
             <span className="w-3 h-3 rounded-full bg-zinc-600"></span>
             {imageA.file.name}
           </div>
           <ArrowLeftRight className="w-4 h-4 text-zinc-600" />
           <div className="flex items-center gap-2 text-sm text-white">
             {imageB.file.name}
             <span className="w-3 h-3 rounded-full bg-blue-500"></span>
           </div>
        </div>

        <div className="flex-1 relative flex items-center justify-center p-4 overflow-hidden bg-[#111] select-none">
          {srcA && srcB && (
             <div 
              ref={containerRef}
              className="relative max-w-full max-h-full aspect-[4/3] w-auto h-full cursor-ew-resize select-none overflow-hidden rounded-lg shadow-2xl border border-zinc-800"
              onMouseDown={handleInteractionStart}
              onMouseMove={(e) => isDragging && handleMouseMove(e)}
              onMouseUp={handleInteractionEnd}
              onMouseLeave={handleInteractionEnd}
              onTouchStart={handleInteractionStart}
              onTouchMove={(e) => isDragging && handleMouseMove(e)}
              onTouchEnd={handleInteractionEnd}
             >
                <img 
                  src={srcA} 
                  className="absolute inset-0 w-full h-full object-contain bg-[#09090b]" 
                  draggable={false}
                />
                <div 
                  className="absolute inset-0 w-full h-full"
                  style={{ clipPath: `inset(0 0 0 ${sliderPos}%)` }}
                >
                   <img 
                    src={srcB} 
                    className="absolute inset-0 w-full h-full object-contain bg-[#09090b]" 
                    draggable={false}
                  />
                </div>
                <div 
                  className="absolute inset-y-0 w-0.5 bg-white shadow-[0_0_10px_rgba(0,0,0,0.5)] z-20 pointer-events-none"
                  style={{ left: `${sliderPos}%` }}
                >
                   <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white text-zinc-900 rounded-full flex items-center justify-center shadow-lg">
                      <ArrowLeftRight className="w-4 h-4" />
                   </div>
                </div>
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

// --- Reusable Watermark Layer Settings Component ---

const WatermarkLayerConfig = ({
  layer,
  onChange,
  fontOptions,
  onLoadLocalFonts,
  title,
  isSubLayer = false // New prop to identify if it's the sub layer
}: {
  layer: LayerSettings,
  onChange: (key: keyof LayerSettings, val: any) => void,
  fontOptions: FontOption[],
  onLoadLocalFonts?: () => void,
  title?: string,
  isSubLayer?: boolean
}) => {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="flex items-center justify-between">
         {title && <h3 className="text-sm font-semibold text-zinc-300">{title}</h3>}
         {/* Toggle Switch */}
         <button 
          onClick={() => onChange('enabled', !layer.enabled)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${layer.enabled ? 'bg-blue-600/20 text-blue-400 border border-blue-600/50' : 'bg-zinc-800 text-zinc-500 border border-zinc-700'}`}
         >
            {layer.enabled ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            {layer.enabled ? "已启用" : "已禁用"}
         </button>
      </div>

      <div className={`space-y-6 transition-opacity duration-300 ${layer.enabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
        <div className="space-y-2">
          <Label>内容</Label>
          <Input 
            value={layer.text} 
            onChange={(e: any) => onChange('text', e.target.value)} 
            placeholder="输入水印文字..."
          />
        </div>

        <div className="space-y-4">
           <Label>样式</Label>
           <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-2">
               <Label className="!mb-0">字体</Label>
               <div className="flex gap-2">
                  <div className="relative flex-1">
                    <select 
                      className="flex h-10 w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white ring-offset-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 appearance-none truncate pr-8"
                      value={layer.fontFamily}
                      onChange={(e) => onChange('fontFamily', e.target.value)}
                    >
                      {fontOptions.map((f, idx) => (
                        <option key={`${f.value}-${idx}`} value={f.value}>{f.name}</option>
                      ))}
                    </select>
                    <Type className="absolute right-3 top-2.5 h-4 w-4 text-zinc-500 pointer-events-none" />
                  </div>
                  {onLoadLocalFonts && (
                    <Button 
                      variant="secondary" 
                      className="px-3" 
                      title="读取本地电脑字体"
                      onClick={onLoadLocalFonts}
                    >
                      <HardDriveDownload className="w-4 h-4" />
                    </Button>
                  )}
               </div>
            </div>

            <div>
               <Label className="!mb-2">颜色</Label>
               <ColorPicker 
                value={layer.color} 
                onChange={(v: string) => onChange('color', v)} 
              />
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <Label className="!mb-0">不透明度</Label>
                <span className="text-xs text-zinc-400">{Math.round(layer.opacity * 100)}%</span>
              </div>
              <Slider 
                min={0} max={1} step={0.01}
                value={layer.opacity} 
                onChange={(v: number) => onChange('opacity', v)} 
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between">
            <Label>大小</Label>
            <span className="text-xs text-zinc-400">{layer.fontSize}px</span>
          </div>
          <Slider 
            min={10} max={300} step={1}
            value={layer.fontSize} 
            onChange={(v: number) => onChange('fontSize', v)} 
          />
        </div>

        {/* --- Background Protection Section --- */}
        <div className="space-y-4 pt-4 border-t border-zinc-800">
           <div className="flex items-center justify-between">
             <Label className="!mb-0">背景保护</Label>
             <button 
                onClick={() => onChange('bgEnabled', !layer.bgEnabled)}
                className={`w-10 h-5 rounded-full transition-colors relative ${layer.bgEnabled ? 'bg-blue-600' : 'bg-zinc-700'}`}
             >
                <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${layer.bgEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
             </button>
           </div>
           
           {layer.bgEnabled && (
             <div className="bg-zinc-800/50 p-4 rounded-xl border border-zinc-800/50 space-y-4 animate-in fade-in slide-in-from-top-2">
               <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label className="!mb-0">背景不透明度</Label>
                    <span className="text-xs text-zinc-400">{Math.round(layer.bgOpacity * 100)}%</span>
                  </div>
                  <Slider 
                    min={0} max={1} step={0.01}
                    value={layer.bgOpacity} 
                    onChange={(v: number) => onChange('bgOpacity', v)} 
                  />
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="!mb-0">边缘模糊 (左右渐变)</Label>
                    <Slider 
                      min={0} max={50} step={1}
                      value={layer.bgBlur} 
                      onChange={(v: number) => onChange('bgBlur', v)} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="!mb-0">背景边距</Label>
                    <Slider 
                      min={0} max={50} step={1}
                      value={layer.bgPadding} 
                      onChange={(v: number) => onChange('bgPadding', v)} 
                    />
                  </div>
               </div>
             </div>
           )}
        </div>

        {/* --- Positioning Section --- */}
        <div className="space-y-4 pt-4 border-t border-zinc-800">
          <div className="flex justify-between items-center mb-2">
             <Label className="!mb-0">布局位置</Label>
             {/* Link Toggle for Sub Layer */}
             {isSubLayer && (
               <button 
                 onClick={() => onChange('isLinkedToMain', !layer.isLinkedToMain)}
                 className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded transition-colors ${layer.isLinkedToMain ? 'text-blue-400 bg-blue-900/30' : 'text-zinc-500 bg-zinc-800'}`}
                 title={layer.isLinkedToMain ? "跟随主水印移动" : "独立位置"}
               >
                  {layer.isLinkedToMain ? <LinkIcon className="w-3 h-3" /> : <Unlink className="w-3 h-3" />}
                  {layer.isLinkedToMain ? "已跟随主水印" : "独立定位"}
               </button>
             )}
          </div>

          {isSubLayer && layer.isLinkedToMain ? (
             <div className="bg-zinc-800/50 p-4 rounded-xl border border-zinc-800/50 space-y-4 animate-in fade-in slide-in-from-top-2">
                <div className="space-y-2">
                   <Label>相对主水印对齐</Label>
                   <div className="flex gap-2">
                      {[
                        { val: 'left', icon: AlignLeft, label: "左对齐" },
                        { val: 'center', icon: AlignCenter, label: "居中" },
                        { val: 'right', icon: AlignRight, label: "右对齐" }
                      ].map((opt) => (
                        <button
                          key={opt.val}
                          onClick={() => onChange('linkAlignment', opt.val)}
                          className={`flex-1 h-9 rounded-md flex items-center justify-center gap-2 border transition-all ${
                             layer.linkAlignment === opt.val 
                             ? 'bg-blue-600 border-blue-500 text-white' 
                             : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700'
                          }`}
                          title={opt.label}
                        >
                           <opt.icon className="w-4 h-4" />
                        </button>
                      ))}
                   </div>
                </div>
                <div className="space-y-2">
                   <div className="flex justify-between">
                     <Label>垂直间距 (距离主水印)</Label>
                     <span className="text-xs text-zinc-400">{layer.linkSpacing}px</span>
                   </div>
                   <Slider 
                      min={-50} max={200} step={1}
                      value={layer.linkSpacing || 0} 
                      onChange={(v: number) => onChange('linkSpacing', v)} 
                   />
                </div>
             </div>
          ) : (
            <>
              <div className="bg-zinc-800/50 p-4 rounded-xl border border-zinc-800/50">
                <div className="grid grid-cols-3 gap-2 w-32 mx-auto">
                  {POSITIONS.map((pos) => (
                    <button
                      key={pos}
                      onClick={() => onChange('position', pos)}
                      className={`w-8 h-8 rounded-md border flex items-center justify-center transition-all ${
                        layer.position === pos 
                          ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/50' 
                          : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      <div className={`w-2 h-2 rounded-full ${layer.position === pos ? 'bg-white' : 'bg-current'}`} />
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>水平边距 (X)</Label>
                  <Input 
                    type="number" 
                    value={layer.offsetX} 
                    onChange={(e: any) => onChange('offsetX', Number(e.target.value))} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>垂直边距 (Y)</Label>
                  <Input 
                    type="number" 
                    value={layer.offsetY} 
                    onChange={(e: any) => onChange('offsetY', Number(e.target.value))} 
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// --- Settings Panel Component (Tabbed) ---

const SettingsPanel = ({ 
  settings, 
  onChange, 
  title = "Settings", 
  isGlobal = false,
  fontOptions = INITIAL_FONTS,
  onLoadLocalFonts,
  isComparisonMode,
  toggleComparisonMode,
  compareSelectionCount,
  imageDimensions
}: { 
  settings: WatermarkSettings, 
  onChange: (s: WatermarkSettings) => void,
  title?: string,
  isGlobal?: boolean,
  fontOptions?: FontOption[],
  onLoadLocalFonts?: () => void,
  isComparisonMode?: boolean,
  toggleComparisonMode?: () => void,
  compareSelectionCount?: number,
  imageDimensions?: { width: number, height: number }
}) => {
  const [activeTab, setActiveTab] = useState<'base' | 'main' | 'sub'>('base');
  const [aspectLocked, setAspectLocked] = useState(true);

  // Sync manual dimensions if they are 0 (not set yet) when opening individual edit
  useEffect(() => {
    if (!isGlobal && imageDimensions && settings.resizeMode === 'manual') {
      if (!settings.resizeWidth || !settings.resizeHeight) {
         onChange({
           ...settings,
           resizeWidth: imageDimensions.width,
           resizeHeight: imageDimensions.height
         });
      }
    }
  }, [isGlobal, imageDimensions, settings.resizeMode]);

  const update = (key: keyof WatermarkSettings, value: any) => {
    onChange({ ...settings, [key]: value });
  };

  const updateLayer = (layerName: 'main' | 'sub', key: keyof LayerSettings, value: any) => {
     onChange({
       ...settings,
       [layerName]: {
         ...settings[layerName],
         [key]: value
       }
     });
  };

  const handleDimensionChange = (dim: 'width' | 'height', val: number) => {
    if (!aspectLocked || !imageDimensions) {
      update(dim === 'width' ? 'resizeWidth' : 'resizeHeight', val);
      return;
    }

    // Aspect Ratio Locked Logic
    const ratio = imageDimensions.width / imageDimensions.height;
    if (dim === 'width') {
      onChange({
        ...settings,
        resizeWidth: val,
        resizeHeight: Math.round(val / ratio)
      });
    } else {
      onChange({
        ...settings,
        resizeHeight: val,
        resizeWidth: Math.round(val * ratio)
      });
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 pt-0">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          {isGlobal ? <LayoutTemplate className="w-5 h-5 text-blue-500" /> : <Settings2 className="w-5 h-5 text-blue-500" />}
          {title}
        </h3>
        
        {/* Tabs Header */}
        <div className="flex p-1 bg-zinc-800/80 rounded-lg mb-6 gap-1">
           <button 
             onClick={() => setActiveTab('base')}
             className={`flex-1 py-1.5 text-xs font-medium rounded-md flex items-center justify-center gap-1.5 transition-all ${activeTab === 'base' ? 'bg-zinc-600 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50'}`}
           >
              <Sliders className="w-3.5 h-3.5" /> 基础
           </button>
           <button 
             onClick={() => setActiveTab('main')}
             className={`flex-1 py-1.5 text-xs font-medium rounded-md flex items-center justify-center gap-1.5 transition-all ${activeTab === 'main' ? 'bg-zinc-600 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50'}`}
           >
              <Type className="w-3.5 h-3.5" /> 主水印
           </button>
           <button 
             onClick={() => setActiveTab('sub')}
             className={`flex-1 py-1.5 text-xs font-medium rounded-md flex items-center justify-center gap-1.5 transition-all ${activeTab === 'sub' ? 'bg-zinc-600 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50'}`}
           >
              <Layers className="w-3.5 h-3.5" /> 副水印
           </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-8 scrollbar-thin">
        
        {/* TAB: BASE PROCESSING */}
        {activeTab === 'base' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
            
            {/* Comparison Mode Toggle (Only Global) */}
            {isGlobal && toggleComparisonMode && (
              <div className="p-4 rounded-xl bg-zinc-800/30 border border-zinc-800 space-y-3">
                 <div className="flex items-center justify-between">
                    <Label className="!mb-0">对比模式</Label>
                    <Button 
                      variant={isComparisonMode ? "secondary" : "ghost"}
                      className={`h-8 text-xs ${isComparisonMode ? 'bg-blue-900/30 text-blue-400 border-blue-900/50' : ''}`}
                      onClick={toggleComparisonMode}
                      icon={Split}
                    >
                      {isComparisonMode ? "退出模式" : "开启对比"}
                    </Button>
                 </div>
                 {isComparisonMode && (
                   <p className="text-xs text-zinc-500">
                     已选择 {compareSelectionCount} / 2 张图片
                   </p>
                 )}
              </div>
            )}

            {/* Auto Enhance */}
            <div className="space-y-4">
               <Label>图像强化</Label>
               <div className="bg-zinc-800/50 p-4 rounded-lg border border-zinc-800 space-y-4">
                 <div className="flex items-center justify-between">
                   <div className="flex flex-col">
                     <span className="text-sm font-medium text-zinc-200 flex items-center gap-2">
                       <Wand2 className="w-4 h-4 text-purple-400" /> 智能优化
                     </span>
                     <span className="text-xs text-zinc-500">自动调整色彩与对比度</span>
                   </div>
                   <button 
                    onClick={() => update('autoEnhance', !settings.autoEnhance)}
                    className={`w-12 h-6 rounded-full transition-colors relative ${settings.autoEnhance ? 'bg-purple-600' : 'bg-zinc-700'}`}
                   >
                      <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${settings.autoEnhance ? 'translate-x-6' : 'translate-x-0'}`} />
                   </button>
                 </div>
                 
                 {/* Enhancement Intensity Slider */}
                 {settings.autoEnhance && (
                    <div className="animate-in fade-in slide-in-from-top-2 pt-2 border-t border-zinc-700/50">
                       <div className="flex justify-between mb-2">
                          <Label className="!mb-0">优化强度</Label>
                          <span className="text-xs text-purple-300">{settings.enhanceIntensity ?? 50}%</span>
                       </div>
                       <Slider 
                          min={0} max={100} step={1}
                          value={settings.enhanceIntensity ?? 50} 
                          onChange={(v: number) => update('enhanceIntensity', v)}
                          className="accent-purple-500" 
                       />
                    </div>
                 )}
               </div>
            </div>

            {/* Resize */}
            <div className="space-y-3">
               <Label>尺寸调整</Label>
               
               {isGlobal ? (
                 /* GLOBAL: Original vs Long Edge */
                 <>
                   <div className="flex gap-2">
                      <button 
                        onClick={() => update('resizeMode', 'original')}
                        className={`flex-1 py-2 text-xs rounded-md border transition-all ${settings.resizeMode === 'original' ? 'bg-zinc-700 border-zinc-500 text-white' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700'}`}
                      >
                        原图尺寸
                      </button>
                      <button 
                        onClick={() => update('resizeMode', 'fixed-long-edge')}
                        className={`flex-1 py-2 text-xs rounded-md border transition-all ${settings.resizeMode === 'fixed-long-edge' ? 'bg-zinc-700 border-zinc-500 text-white' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700'}`}
                      >
                        统一长边
                      </button>
                   </div>
                   
                   {settings.resizeMode === 'fixed-long-edge' && (
                     <div className="animate-in fade-in slide-in-from-top-2 pt-2">
                       <div className="relative">
                          <Input 
                            type="number" 
                            value={settings.resizeLongEdge} 
                            onChange={(e: any) => update('resizeLongEdge', Number(e.target.value))}
                            className="pl-8"
                          />
                          <Scaling className="absolute left-2.5 top-2.5 w-4 h-4 text-zinc-500" />
                          <span className="absolute right-3 top-2.5 text-xs text-zinc-500">px</span>
                       </div>
                       <p className="text-[10px] text-zinc-500 mt-1.5 ml-1">
                         长边调整为 {settings.resizeLongEdge}px，短边按比例缩放
                       </p>
                     </div>
                   )}
                 </>
               ) : (
                 /* INDIVIDUAL: Original vs Custom WxH */
                 <>
                   <div className="flex gap-2">
                      <button 
                        onClick={() => update('resizeMode', 'original')}
                        className={`flex-1 py-2 text-xs rounded-md border transition-all ${settings.resizeMode === 'original' ? 'bg-zinc-700 border-zinc-500 text-white' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700'}`}
                      >
                        原图尺寸
                      </button>
                      <button 
                        onClick={() => update('resizeMode', 'manual')}
                        className={`flex-1 py-2 text-xs rounded-md border transition-all ${settings.resizeMode === 'manual' ? 'bg-zinc-700 border-zinc-500 text-white' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700'}`}
                      >
                        自定义尺寸
                      </button>
                   </div>

                   {settings.resizeMode === 'manual' && (
                     <div className="animate-in fade-in slide-in-from-top-2 pt-2 space-y-3">
                        <div className="flex items-center gap-3">
                           <div className="flex-1">
                              <Label className="!text-[10px]">宽度</Label>
                              <div className="relative">
                                <Input 
                                  type="number" 
                                  value={settings.resizeWidth || 0}
                                  onChange={(e: any) => handleDimensionChange('width', Number(e.target.value))}
                                />
                                <span className="absolute right-2 top-2.5 text-xs text-zinc-500">px</span>
                              </div>
                           </div>
                           
                           {/* Aspect Ratio Lock */}
                           <button 
                            onClick={() => setAspectLocked(!aspectLocked)}
                            className={`mt-5 p-2 rounded hover:bg-zinc-800 transition-colors ${aspectLocked ? 'text-blue-500' : 'text-zinc-600'}`}
                            title={aspectLocked ? "解除比例锁定" : "锁定长宽比"}
                           >
                              {aspectLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                           </button>

                           <div className="flex-1">
                              <Label className="!text-[10px]">高度</Label>
                              <div className="relative">
                                <Input 
                                  type="number" 
                                  value={settings.resizeHeight || 0}
                                  onChange={(e: any) => handleDimensionChange('height', Number(e.target.value))}
                                />
                                <span className="absolute right-2 top-2.5 text-xs text-zinc-500">px</span>
                              </div>
                           </div>
                        </div>
                        <p className="text-[10px] text-zinc-500">
                          {aspectLocked ? "宽高比例已锁定" : "宽高可独立调整 (可能会变形)"}
                        </p>
                     </div>
                   )}
                 </>
               )}
            </div>
          </div>
        )}

        {/* TAB: MAIN WATERMARK */}
        {activeTab === 'main' && (
           <WatermarkLayerConfig 
             layer={settings.main}
             onChange={(k, v) => updateLayer('main', k, v)}
             fontOptions={fontOptions}
             onLoadLocalFonts={onLoadLocalFonts}
             title="主水印设置"
           />
        )}

        {/* TAB: SUB WATERMARK */}
        {activeTab === 'sub' && (
           <WatermarkLayerConfig 
             layer={settings.sub}
             onChange={(k, v) => updateLayer('sub', k, v)}
             fontOptions={fontOptions}
             onLoadLocalFonts={onLoadLocalFonts}
             title="副水印设置"
             isSubLayer={true}
           />
        )}

      </div>
    </div>
  );
};

// --- Watermark Preview Component ---

const WatermarkPreview = ({ 
  image, 
  drawWatermark, 
  showOriginal = false,
  className = "" 
}: { 
  image: ProcessedImage, 
  drawWatermark: any, 
  showOriginal?: boolean,
  className?: string
}) => {
  const [watermarkedUrl, setWatermarkedUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    
    const generate = async () => {
      // Create a temporary image to load the source
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = image.previewUrl;
      
      await new Promise((resolve) => {
        if (img.complete) resolve(null);
        else img.onload = () => resolve(null);
      });

      if (!active) return;

      const url = drawWatermark(img, image.settings, image.originalWidth || img.width, image.originalHeight || img.height);
      if (active) setWatermarkedUrl(url);
    };

    generate();

    return () => { active = false; };
  }, [image.settings, image.previewUrl, image.originalWidth, image.originalHeight, drawWatermark]);

  const displaySrc = showOriginal ? image.previewUrl : (watermarkedUrl || image.previewUrl);

  return (
    <img 
      src={displaySrc} 
      className={`w-full h-full object-contain ${className}`} 
      alt="Preview" 
    />
  );
};


// --- Main App Component ---

const App = () => {
  const [images, setImages] = useState<ProcessedImage[]>([]);
  const [globalSettings, setGlobalSettings] = useState<WatermarkSettings>(DEFAULT_SETTINGS);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [isFullscreenId, setIsFullscreenId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isComparing, setIsComparing] = useState(false); // Press-to-compare state
  
  // Comparison Mode States
  const [isComparisonMode, setIsComparisonMode] = useState(false);
  const [compareSelection, setCompareSelection] = useState<string[]>([]);
  const [showComparisonModal, setShowComparisonModal] = useState(false);

  const [fontOptions, setFontOptions] = useState<FontOption[]>(INITIAL_FONTS);
  
  const { drawWatermark } = useImageProcessor();

  // Handle File Upload
  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newImages: ProcessedImage[] = Array.from(e.target.files).map((file: any) => ({
        id: generateId(),
        file: file as File,
        previewUrl: URL.createObjectURL(file as Blob),
        originalWidth: 0,
        originalHeight: 0,
        settings: JSON.parse(JSON.stringify(globalSettings)), // Deep copy to avoid reference issues
        isCustomized: false
      }));

      // Load dimensions
      newImages.forEach(img => {
        const i = new Image();
        i.onload = () => {
          setImages(prev => prev.map(p => {
            if (p.id === img.id) {
              return { ...p, originalWidth: i.width, originalHeight: i.height };
            }
            return p;
          }));
        };
        i.src = img.previewUrl;
      });

      setImages(prev => [...prev, ...newImages]);
      e.target.value = '';
    }
  };

  const handleGlobalChange = (newSettings: WatermarkSettings) => {
    setGlobalSettings(newSettings);
    setImages(prev => prev.map(img => 
      img.isCustomized ? img : { ...img, settings: JSON.parse(JSON.stringify(newSettings)) }
    ));
  };

  const handleIndividualChange = (id: string, newSettings: WatermarkSettings) => {
    setImages(prev => prev.map(img => 
      img.id === id ? { ...img, settings: newSettings, isCustomized: true } : img
    ));
  };

  const resetToGlobal = (id: string) => {
    setImages(prev => prev.map(img => 
      img.id === id ? { ...img, settings: JSON.parse(JSON.stringify(globalSettings)), isCustomized: false } : img
    ));
  };

  const removeImage = (id: string) => {
    setImages(prev => prev.filter(img => img.id !== id));
    if (selectedImageId === id) setSelectedImageId(null);
    if (isFullscreenId === id) setIsFullscreenId(null);
    if (compareSelection.includes(id)) setCompareSelection(prev => prev.filter(cid => cid !== id));
  };

  // Toggle image selection for comparison
  const toggleCompareSelection = (id: string) => {
    setCompareSelection(prev => {
      if (prev.includes(id)) return prev.filter(cid => cid !== id);
      if (prev.length >= 2) return [prev[1], id]; // Keep last one and add new
      return [...prev, id];
    });
  };

  const handleLoadLocalFonts = async () => {
    if ('queryLocalFonts' in window) {
      try {
        // @ts-ignore
        const localFonts = await window.queryLocalFonts();
        const seen = new Set(fontOptions.map(f => f.name));
        const newFonts: FontOption[] = [];
        
        // @ts-ignore
        for (const font of localFonts) {
          if (!seen.has(font.family)) {
            seen.add(font.family);
            newFonts.push({ 
              name: font.family, 
              value: `"${font.family}"` 
            });
          }
        }
        
        if (newFonts.length > 0) {
          setFontOptions(prev => [...prev, ...newFonts]);
          alert(`成功加载 ${newFonts.length} 款本地字体`);
        } else {
            alert("未发现新的本地字体或已全部加载");
        }
      } catch (err: any) {
        console.error("Local fonts error:", err);
        // Specifically handle the permissions policy error
        if (err.name === 'SecurityError' || err.message?.includes('Permissions Policy')) {
             alert("无法读取本地字体：当前环境安全策略限制了此功能。请在标准浏览器环境中使用，或使用列表中的预设字体。");
        } else {
             alert("无法读取本地字体，请确认授予权限或重试。");
        }
      }
    } else {
      alert("您的浏览器不支持读取本地字体功能（仅支持 Chrome/Edge 桌面版）。");
    }
  };

  const handleDownloadAll = async () => {
    if (images.length === 0) return;
    setIsProcessing(true);

    try {
      const zip = new JSZip();
      
      const promises = images.map(async (imgItem) => {
        return new Promise<void>((resolve) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => {
            const dataUrl = drawWatermark(
              img, 
              imgItem.settings, 
              imgItem.originalWidth, 
              imgItem.originalHeight
            );
            const base64Data = dataUrl.replace(/^data:image\/(png|jpg|jpeg);base64,/, "");
            zip.file(`watermarked_${imgItem.file.name}`, base64Data, { base64: true });
            resolve();
          };
          img.src = imgItem.previewUrl;
        });
      });

      await Promise.all(promises);
      const content = await zip.generateAsync({ type: "blob" });
      
      const link = document.createElement("a");
      link.href = URL.createObjectURL(content);
      link.download = "images_with_watermark.zip";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
    } catch (error) {
      console.error("Error creating zip:", error);
      alert("打包下载失败，请重试。");
    } finally {
      setIsProcessing(false);
    }
  };

  const selectedImage = images.find(img => img.id === selectedImageId);
  const fullscreenImage = images.find(img => img.id === isFullscreenId);
  const compareImageA = images.find(img => img.id === compareSelection[0]);
  const compareImageB = images.find(img => img.id === compareSelection[1]);

  return (
    <div className="flex h-screen bg-black overflow-hidden text-zinc-100">
      
      {/* Sidebar */}
      <aside className="w-80 bg-zinc-900 border-r border-zinc-800 flex flex-col z-10 shadow-xl shrink-0">
        <div className="p-6 pb-2 border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm">
          <h1 className="text-xl font-bold flex items-center gap-2 text-white tracking-tight">
            <LayoutTemplate className="w-6 h-6 text-blue-500" />
            批量水印大师
          </h1>
          <p className="text-xs text-zinc-500 mt-1">高效、安全的本地图片处理工具</p>
        </div>
        
        <div className="flex-1 overflow-hidden flex flex-col pt-4">
          {!isComparisonMode && (
             <SettingsPanel 
              title="全局设置"
              settings={globalSettings} 
              onChange={handleGlobalChange} 
              isGlobal={true}
              fontOptions={fontOptions}
              onLoadLocalFonts={handleLoadLocalFonts}
              isComparisonMode={isComparisonMode}
              toggleComparisonMode={() => {
                setIsComparisonMode(!isComparisonMode);
                setCompareSelection([]);
              }}
              compareSelectionCount={compareSelection.length}
            />
          )}

          {/* If In Comparison Mode, Show helper text instead of settings */}
          {isComparisonMode && (
             <div className="p-6 space-y-4">
                <div className="p-4 rounded-xl bg-blue-900/20 border border-blue-900/50">
                  <h3 className="text-blue-400 font-medium flex items-center gap-2 mb-2">
                     <Split className="w-4 h-4" /> 对比模式已开启
                  </h3>
                  <p className="text-xs text-blue-200/70">
                    请在右侧点击选择两张图片进行对比。
                  </p>
                </div>

                <div className="space-y-2">
                   <div className="flex justify-between text-sm text-zinc-400">
                      <span>已选图片</span>
                      <span>{compareSelection.length} / 2</span>
                   </div>
                   <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 transition-all duration-300" 
                        style={{ width: `${(compareSelection.length / 2) * 100}%` }} 
                      />
                   </div>
                </div>

                {compareSelection.length === 2 ? (
                   <Button 
                     className="w-full mt-4" 
                     onClick={() => setShowComparisonModal(true)}
                     icon={ArrowLeftRight}
                   >
                     开始对比
                   </Button>
                ) : (
                  <Button 
                     className="w-full mt-4 bg-zinc-800 text-zinc-500 hover:bg-zinc-800 cursor-not-allowed" 
                     disabled
                  >
                     请选择 2 张图片
                  </Button>
                )}

                <Button 
                   variant="outline"
                   className="w-full"
                   onClick={() => {
                     setIsComparisonMode(false);
                     setCompareSelection([]);
                   }}
                >
                   退出对比模式
                </Button>
             </div>
          )}
        </div>

        <div className="p-4 border-t border-zinc-800 bg-zinc-900 space-y-3 z-20">
          <div className="relative group">
            <input 
              type="file" 
              multiple 
              accept="image/*" 
              onChange={handleUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
            />
            <Button variant="outline" className="w-full relative z-10 pointer-events-none group-hover:bg-zinc-800 transition-colors border-dashed" icon={Upload}>
              添加图片
            </Button>
          </div>
          <Button 
            className="w-full" 
            onClick={handleDownloadAll} 
            disabled={images.length === 0 || isProcessing}
            icon={isProcessing ? Loader2 : Download}
          >
            {isProcessing ? "正在处理..." : `下载全部 (${images.length} 张)`}
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-8 relative bg-[#09090b] bg-[radial-gradient(#18181b_1px,transparent_1px)] [background-size:16px_16px]">
        {images.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-zinc-500 border-2 border-dashed border-zinc-800 rounded-2xl bg-zinc-900/30 m-4 transition-all hover:border-zinc-700 hover:bg-zinc-900/50">
            <div className="bg-zinc-800 p-6 rounded-full mb-6 shadow-lg shadow-black/20">
               <ImageIcon className="w-16 h-16 text-zinc-600" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">暂无图片</h3>
            <p className="text-sm mb-8 text-zinc-400">请上传图片开始批量制作水印</p>
            <div className="relative">
               <input 
                type="file" 
                multiple 
                accept="image/*" 
                onChange={handleUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <Button className="px-8 py-6 text-lg">点击上传图片</Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
            {images.map(img => (
              <ImageCard 
                key={img.id} 
                image={img} 
                drawWatermark={drawWatermark}
                onEdit={() => !isComparisonMode && setSelectedImageId(img.id)}
                onRemove={() => removeImage(img.id)}
                onMaximize={() => setIsFullscreenId(img.id)}
                onReset={() => resetToGlobal(img.id)}
                isComparisonMode={isComparisonMode}
                isSelectedForCompare={compareSelection.includes(img.id)}
                onToggleCompare={() => toggleCompareSelection(img.id)}
              />
            ))}
          </div>
        )}
      </main>

      {/* --- REFACTORED Individual Edit Modal --- */}
      {selectedImage && !isComparisonMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 md:p-8 animate-in fade-in duration-200">
           <div className="bg-zinc-900 w-full h-full max-w-[95vw] max-h-[95vh] rounded-2xl overflow-hidden flex shadow-2xl border border-zinc-800 relative">
             
             {/* Left: Pure Black Preview */}
             <div className="flex-1 bg-black relative flex items-center justify-center overflow-hidden p-8 group">
                <WatermarkPreview 
                   image={selectedImage} 
                   drawWatermark={drawWatermark} 
                   showOriginal={isComparing}
                   className="max-w-full max-h-full object-contain shadow-2xl"
                />
                
                {/* Floating Controls in Preview */}
                <div className="absolute top-4 left-4 flex gap-2">
                   <div className="bg-zinc-900/80 backdrop-blur px-3 py-1.5 rounded-full border border-zinc-800 text-xs text-zinc-400">
                      预览模式
                   </div>
                </div>

                <div className="absolute bottom-6 flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0 duration-300">
                   <button 
                    onMouseDown={() => setIsComparing(true)}
                    onMouseUp={() => setIsComparing(false)}
                    onMouseLeave={() => setIsComparing(false)}
                    className="bg-zinc-900/90 backdrop-blur text-white px-5 py-2.5 rounded-full border border-zinc-700 hover:bg-zinc-800 text-sm font-medium flex items-center gap-2 shadow-lg hover:scale-105 transition-all"
                  >
                     <Split className="w-4 h-4" /> 按住对比原图
                  </button>
                </div>
             </div>

             {/* Right: Settings Panel */}
             <div className="w-[420px] border-l border-zinc-800 bg-zinc-900 flex flex-col shrink-0">
               <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900">
                  <div>
                    <h3 className="font-semibold text-white">单独编辑</h3>
                    <p className="text-xs text-zinc-500 truncate max-w-[200px]" title={selectedImage.file.name}>
                      {selectedImage.file.name}
                    </p>
                  </div>
                  <button 
                    onClick={() => setSelectedImageId(null)} 
                    className="p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
               </div>

               <div className="flex-1 overflow-y-auto">
                  <div className="p-2">
                    <SettingsPanel 
                      title="当前图片设置"
                      settings={selectedImage.settings} 
                      onChange={(s) => handleIndividualChange(selectedImage.id, s)} 
                      fontOptions={fontOptions}
                      onLoadLocalFonts={handleLoadLocalFonts}
                      isGlobal={false}
                      imageDimensions={{ 
                        width: selectedImage.originalWidth, 
                        height: selectedImage.originalHeight 
                      }}
                    />

                    {selectedImage.isCustomized && (
                      <div className="mx-4 mt-4 pt-4 border-t border-zinc-800 mb-8">
                        <Button 
                          variant="destructive" 
                          className="w-full text-sm" 
                          onClick={() => resetToGlobal(selectedImage.id)}
                          icon={RefreshCcw}
                        >
                          重置为全局默认设置
                        </Button>
                      </div>
                    )}
                  </div>
               </div>
             </div>

           </div>
        </div>
      )}

      {/* Fullscreen Modal */}
      {fullscreenImage && (
        <div className="fixed inset-0 z-[60] bg-black flex flex-col animate-in fade-in duration-200">
           <div className="absolute top-4 right-4 z-50 flex items-center gap-4">
              <button 
                  onMouseDown={() => setIsComparing(true)}
                  onMouseUp={() => setIsComparing(false)}
                  onMouseLeave={() => setIsComparing(false)}
                  className="bg-zinc-900/80 backdrop-blur text-white px-4 py-2 rounded-lg border border-zinc-700 hover:bg-zinc-800 text-sm font-medium flex items-center gap-2"
                >
                   <Split className="w-4 h-4" /> 按住对比原图
              </button>
              <button 
                onClick={() => setIsFullscreenId(null)}
                className="bg-zinc-900/80 backdrop-blur text-white p-2 rounded-full hover:bg-zinc-800 border border-zinc-700"
              >
                <X className="w-6 h-6" />
              </button>
           </div>
           
           <div className="flex-1 p-8 flex items-center justify-center overflow-hidden">
              <WatermarkPreview 
                image={fullscreenImage} 
                drawWatermark={drawWatermark} 
                showOriginal={isComparing}
                className="max-w-full max-h-full"
              />
           </div>
           
           <div className="p-4 bg-zinc-900 text-center text-sm text-zinc-500">
              {fullscreenImage.file.name} - {isComparing ? "原图" : "水印预览"}
           </div>
        </div>
      )}
      
      {/* Comparison Modal (Slider) */}
      {showComparisonModal && compareImageA && compareImageB && (
         <ComparisonModal 
            imageA={compareImageA} 
            imageB={compareImageB} 
            onClose={() => setShowComparisonModal(false)}
            drawWatermark={drawWatermark}
         />
      )}

    </div>
  );
};

// --- Sub-Components for Rendering ---

const ImageCard = ({ 
  image, 
  drawWatermark, 
  onEdit, 
  onRemove, 
  onMaximize,
  onReset,
  isComparisonMode,
  isSelectedForCompare,
  onToggleCompare
}: any) => {
  return (
    <div 
      onClick={() => isComparisonMode && onToggleCompare()}
      className={`group relative bg-zinc-900 rounded-xl shadow-lg overflow-hidden transition-all duration-300 ${isComparisonMode ? 'cursor-pointer' : ''} ${isSelectedForCompare ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-zinc-950' : 'border border-zinc-800 hover:shadow-xl hover:border-zinc-600'}`}
    >
      <div className="aspect-[4/3] bg-zinc-950 relative overflow-hidden flex items-center justify-center">
        <WatermarkPreview 
          image={image} 
          drawWatermark={drawWatermark} 
        />
        
        {/* Comparison Selection Indicator */}
        {isComparisonMode && (
           <div className={`absolute inset-0 transition-colors flex items-center justify-center ${isSelectedForCompare ? 'bg-blue-900/40' : 'bg-transparent hover:bg-white/5'}`}>
              {isSelectedForCompare ? (
                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center shadow-lg animate-in zoom-in duration-200">
                   <Check className="w-6 h-6 text-white" />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-full border-2 border-zinc-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-zinc-900/50 backdrop-blur-sm">
                   <div className="w-3 h-3 bg-zinc-600 rounded-full"></div>
                </div>
              )}
           </div>
        )}

        {/* Normal Hover Overlay */}
        {!isComparisonMode && (
          <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100 gap-3 backdrop-blur-[2px]">
            <button 
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="bg-blue-600 text-white p-3 rounded-full shadow-lg hover:bg-blue-500 hover:scale-110 transition-all border border-blue-500"
              title="单独编辑"
            >
              <Settings2 className="w-5 h-5" />
            </button>
            {image.isCustomized && (
               <button 
                onClick={(e) => { e.stopPropagation(); onReset(); }}
                className="bg-zinc-800 text-yellow-400 p-3 rounded-full shadow-lg hover:bg-zinc-700 hover:text-yellow-300 hover:scale-110 transition-all border border-zinc-700"
                title="取消定制 (恢复默认)"
              >
                <RefreshCcw className="w-5 h-5" />
              </button>
            )}
            <button 
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              className="bg-zinc-800 text-red-400 p-3 rounded-full shadow-lg hover:bg-zinc-700 hover:text-red-300 hover:scale-110 transition-all border border-zinc-700"
              title="删除"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
      
      <div className="p-3 flex justify-between items-center bg-zinc-900 border-t border-zinc-800/50">
        <span className="text-xs font-medium text-zinc-400 truncate max-w-[150px]" title={image.file.name}>
          {image.file.name}
        </span>
        {image.isCustomized && (
          <span className="text-[10px] bg-blue-900/30 text-blue-400 px-2 py-0.5 rounded-full font-medium border border-blue-900/50">
            已定制
          </span>
        )}
      </div>
    </div>
  );
};

const root = createRoot(document.getElementById("root")!);
root.render(<App />);