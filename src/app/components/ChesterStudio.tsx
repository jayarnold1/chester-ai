import { useEffect, useRef, useState } from "react";

// 🔑 API Key Pollinations
const POLLINATIONS_API_KEY = "sk_AWpnKcJrTzd3qLTFYXKA02urWhSNnAaB";

type Sticker = { id: string; emoji?: string; src?: string; x: number; y: number; size: number };

const STICKER_EMOJIS = ["⭐", "❤️", "🔥", "✨", "🎉", "😎", "🌟", "💎", "🌸", "🦄", "🌈", "🍀"];

const ANIM_IN = ["fadeIn", "slideFromLeft", "zoomIn", "bounce", "none"];
const ANIM_OUT = ["none", "fadeOut", "zoomOut"];
const MOTION = ["none", "zoomIn", "panLeft", "panRight"];

export function ChesterStudio() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stickerLayerRef = useRef<HTMLDivElement>(null);
  const cropOverlayRef = useRef<HTMLCanvasElement>(null);
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null);
  const [hasImage, setHasImage] = useState(false);
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState("Upload foto, tunggu proses AI");

  // AI Model
  const [aiModel, setAiModel] = useState("medium");
  // Text-to-image prompt
  const [prompt, setPrompt] = useState("");
  // Beauty
  const [skin, setSkin] = useState(0);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [sharpness, setSharpness] = useState(0);
  // Quality & before/after (akan diganti)
  const [beforeAfter, setBeforeAfter] = useState(100);
  // Shadow & smooth
  const [shadow, setShadow] = useState(4);
  const [smooth, setSmooth] = useState(2);
  // Zoom & lock
  const [zoom, setZoom] = useState(100);
  const [locked, setLocked] = useState(false);
  // Undo/redo
  const historyRef = useRef<string[]>([]);
  const futureRef = useRef<string[]>([]);
  // Stickers
  const [stickers, setStickers] = useState<Sticker[]>([]);
  // Video animation from canvas
  const [duration, setDuration] = useState(5);
  const [animIn, setAnimIn] = useState("fadeIn");
  const [animOut, setAnimOut] = useState("none");
  const [motion, setMotion] = useState("none");
  const [videoURL, setVideoURL] = useState("");
  const [videoProgress, setVideoProgress] = useState(0);
  // AI Prompt edit
  const [aiPrompt, setAiPrompt] = useState("");
  const [editMode, setEditMode] = useState<"full" | "mask">("full");
  // Background
  const [bgMode, setBgMode] = useState<"color" | "image">("color");
  const [bgColor, setBgColor] = useState("#ffffff");
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
  // Transformations
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [rotate, setRotate] = useState(0);
  const [bgRemoved, setBgRemoved] = useState(false);
  const [colorFilter, setColorFilter] = useState(0);

  // ---- Wadah output khusus untuk Text-to-Image ----
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [generatedImageLoading, setGeneratedImageLoading] = useState(false);

  // ---- Fitur baru: Background Generator ----
  const [bgPrompt, setBgPrompt] = useState("");
  const [generatingBg, setGeneratingBg] = useState(false);

  // ---- Fitur baru: Art Style Transfer ----
  const [stylePrompt, setStylePrompt] = useState("");
  const [styleTransferLoading, setStyleTransferLoading] = useState(false);
  const [styleOutputUrl, setStyleOutputUrl] = useState<string | null>(null);

  // ---- Crop states ----
  const [cropMode, setCropMode] = useState(false);
  const [cropRect, setCropRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const cropDragRef = useRef<{
    active: boolean;
    type: 'move' | 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w' | null;
    startX: number;
    startY: number;
    initialRect: { x: number; y: number; w: number; h: number };
  }>({ active: false, type: null, startX: 0, startY: 0, initialRect: { x: 0, y: 0, w: 0, h: 0 } });

  // ---- Drawing pipeline ----
  function pushHistory() {
    const c = canvasRef.current;
    if (!c) return;
    historyRef.current.push(c.toDataURL());
    if (historyRef.current.length > 30) historyRef.current.shift();
    futureRef.current = [];
  }

  function draw() {
    const c = canvasRef.current;
    if (!c || !imgEl) return;
    const ctx = c.getContext("2d")!;
    const scale = 1; // Hapus quality, gunakan ukuran asli
    const w = imgEl.naturalWidth * scale;
    const h = imgEl.naturalHeight * scale;
    c.width = w;
    c.height = h;

    ctx.save();
    ctx.clearRect(0, 0, w, h);

    if (bgRemoved) {
      if (bgMode === "color") {
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, w, h);
      } else if (bgMode === "image" && bgImage) {
        ctx.drawImage(bgImage, 0, 0, w, h);
      }
    }

    ctx.translate(w / 2, h / 2);
    ctx.rotate((rotate * Math.PI) / 180);
    ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);

    if (shadow > 0) {
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = shadow * 2;
      ctx.shadowOffsetY = shadow;
    }

    const filterParts: string[] = [];
    filterParts.push(`brightness(${brightness}%)`);
    filterParts.push(`contrast(${contrast}%)`);
    filterParts.push(`saturate(${saturation}%)`);
    if (skin > 0) filterParts.push(`blur(${(skin / 100) * 2}px)`);
    if (smooth > 0) filterParts.push(`blur(${smooth * 0.2}px)`);
    if (sharpness > 0) filterParts.push(`contrast(${100 + sharpness}%)`);
    if (colorFilter > 0) filterParts.push(`hue-rotate(${colorFilter}deg)`);
    ctx.filter = filterParts.join(" ");

    ctx.drawImage(imgEl, -w / 2, -h / 2, w, h);
    ctx.restore();
  }

  useEffect(() => { if (imgEl) draw(); }, [imgEl, brightness, contrast, saturation, skin, sharpness, smooth, shadow, flipH, flipV, rotate, bgMode, bgColor, bgImage, bgRemoved, colorFilter]);

  // ---- Upload ----
  function handleFile(file: File) {
    setLoading(true);
    setInfo("Memuat gambar...");
    const url = URL.createObjectURL(file);
    const i = new Image();
    i.onload = () => {
      setImgEl(i);
      setHasImage(true);
      setLoading(false);
      setInfo(`Gambar dimuat: ${i.naturalWidth}×${i.naturalHeight}`);
      setTimeout(pushHistory, 50);
    };
    i.src = url;
  }
  function onUploadInput(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (f) handleFile(f);
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0]; if (f) handleFile(f);
  }

  // ---- Pollinations AI Image Generation ----
  async function generateAIImage() {
    if (!prompt.trim()) {
      setInfo("Isi prompt terlebih dahulu");
      return;
    }
    setGeneratedImageLoading(true);
    setInfo("Generating AI image with Pollinations...");
    try {
      const encodedPrompt = encodeURIComponent(prompt);
      const model = "flux";
      const url = `https://gen.pollinations.ai/image/${encodedPrompt}?model=${model}`;
      
      const response = await fetch(url, {
        method: "GET",
        headers: { "Authorization": `Bearer ${POLLINATIONS_API_KEY}` }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`${response.status} ${response.statusText} - ${errorText}`);
      }
      
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.startsWith("image/")) {
        const text = await response.text();
        throw new Error("API tidak mengembalikan gambar: " + text.substring(0, 200));
      }
      
      const blob = await response.blob();
      const imageUrl = URL.createObjectURL(blob);
      setGeneratedImageUrl(imageUrl);
      setInfo(`Image generated for "${prompt}" - klik "Gunakan di Canvas" untuk edit`);
    } catch (err: any) {
      setInfo(`Pollinas error: ${err.message}`);
      console.error(err);
    } finally {
      setGeneratedImageLoading(false);
    }
  }

  // Pindahkan hasil generate ke canvas utama
  function useGeneratedImageInCanvas() {
    if (!generatedImageUrl) return;
    const img = new Image();
    img.onload = () => {
      setImgEl(img);
      setHasImage(true);
      setInfo("Gambar hasil generate dipindahkan ke canvas");
      setTimeout(pushHistory, 50);
    };
    img.src = generatedImageUrl;
  }

  // ---- FITUR BARU 1: AI Background Generator (mengganti background dengan teks) ----
  async function generateBackgroundFromPrompt() {
    if (!bgPrompt.trim()) {
      setInfo("❌ Masukkan deskripsi background.");
      return;
    }
    if (!imgEl) {
      setInfo("❌ Upload gambar terlebih dahulu.");
      return;
    }
    setGeneratingBg(true);
    setInfo("🎨 Generating background image...");
    try {
      const encodedPrompt = encodeURIComponent(bgPrompt);
      const url = `https://gen.pollinations.ai/image/${encodedPrompt}?model=flux`;
      const response = await fetch(url, {
        method: "GET",
        headers: { "Authorization": `Bearer ${POLLINATIONS_API_KEY}` }
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const blob = await response.blob();
      const bgUrl = URL.createObjectURL(blob);
      const bgImg = new Image();
      bgImg.onload = () => {
        setBgImage(bgImg);
        setBgMode("image");
        setBgRemoved(true); // Aktifkan mode background
        setInfo("✅ Background berhasil diganti! Silakan atur posisi objek jika perlu.");
        URL.revokeObjectURL(bgUrl);
        setGeneratingBg(false);
        // Trigger redraw
        setTimeout(() => draw(), 100);
      };
      bgImg.onerror = () => {
        setInfo("❌ Gagal memuat background.");
        setGeneratingBg(false);
      };
      bgImg.src = bgUrl;
    } catch (err: any) {
      setInfo(`❌ Error: ${err.message}`);
      setGeneratingBg(false);
    }
  }

  // ---- FITUR BARU 2: Art Style Transfer (menghasilkan gambar baru dengan gaya artistik) ----
  async function generateStyleTransfer() {
    if (!stylePrompt.trim()) {
      setInfo("❌ Masukkan gaya yang diinginkan (contoh: anime, oil painting, cyberpunk).");
      return;
    }
    if (!prompt.trim()) {
      setInfo("❌ Isi prompt deskripsi subjek di panel 'Text to Image' terlebih dahulu.");
      return;
    }
    setStyleTransferLoading(true);
    setInfo("🎨 Generating art style transfer...");
    try {
      // Gabungkan prompt asli dengan gaya
      const fullPrompt = `${prompt}, in the style of ${stylePrompt}, high quality, detailed`;
      const encodedPrompt = encodeURIComponent(fullPrompt);
      const url = `https://gen.pollinations.ai/image/${encodedPrompt}?model=flux`;
      const response = await fetch(url, {
        method: "GET",
        headers: { "Authorization": `Bearer ${POLLINATIONS_API_KEY}` }
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const blob = await response.blob();
      const imageUrl = URL.createObjectURL(blob);
      setStyleOutputUrl(imageUrl);
      setInfo(`✅ Style transfer berhasil. Klik "Gunakan di Canvas" untuk menerapkan.`);
    } catch (err: any) {
      setInfo(`❌ Style transfer error: ${err.message}`);
    } finally {
      setStyleTransferLoading(false);
    }
  }

  function useStyleTransferInCanvas() {
    if (!styleOutputUrl) return;
    const img = new Image();
    img.onload = () => {
      setImgEl(img);
      setHasImage(true);
      setInfo("Gambar hasil style transfer dipindahkan ke canvas.");
      setTimeout(pushHistory, 50);
    };
    img.src = styleOutputUrl;
  }

  // ---- Remove Background ----
  async function removeBG() {
    if (!imgEl) return;
    setLoading(true);
    setInfo("Sedang menghapus background...");
    try {
      const c = canvasRef.current;
      if (!c) throw new Error("Canvas tidak siap");
      const blob: Blob = await new Promise((resolve, reject) =>
        c.toBlob((b) => (b ? resolve(b) : reject(new Error("Canvas blob gagal"))), "image/png")
      );
      const formData = new FormData();
      formData.append("size", "auto");
      formData.append("image_file", blob, "input.png");
      const response = await fetch("https://api.remove.bg/v1.0/removebg", {
        method: "POST",
        headers: { "X-Api-Key": "Sx9S94GNGXuz9xehhNa2FSJr" },
        body: formData,
      });
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`${response.status} ${response.statusText} ${text}`);
      }
      const buf = await response.arrayBuffer();
      const resultBlob = new Blob([buf], { type: "image/png" });
      const url = URL.createObjectURL(resultBlob);
      const i = new Image();
      i.onload = () => {
        setImgEl(i);
        setBgRemoved(true);
        setHasImage(true);
        setLoading(false);
        setInfo("Background berhasil dihapus ✨");
        setTimeout(pushHistory, 50);
      };
      i.onerror = () => { setLoading(false); setInfo("Gagal memuat hasil PNG"); };
      i.src = url;
    } catch (e: any) {
      setLoading(false);
      setInfo(`Remove BG gagal: ${e.message || e}`);
    }
  }

  function applyBeauty() { pushHistory(); setInfo("Beauty diterapkan"); }
  function resetBeauty() { setSkin(0); setBrightness(100); setContrast(100); setSaturation(100); setSharpness(0); }

  function undo() {
    if (historyRef.current.length === 0) return;
    const c = canvasRef.current;
    if (!c) return;
    const prev = historyRef.current.pop();
    if (!prev) return;
    const cur = c.toDataURL();
    futureRef.current.push(cur);
    const img = new Image();
    img.onload = () => {
      setImgEl(img);
      setHasImage(true);
      setCropMode(false);
      setCropRect(null);
      setInfo("Undo berhasil");
    };
    img.src = prev;
  }

  function redo() {
    if (futureRef.current.length === 0) return;
    const nxt = futureRef.current.pop();
    if (!nxt) return;
    const c = canvasRef.current;
    if (c) {
      const cur = c.toDataURL();
      historyRef.current.push(cur);
    }
    const img = new Image();
    img.onload = () => {
      setImgEl(img);
      setHasImage(true);
      setCropMode(false);
      setCropRect(null);
      setInfo("Redo berhasil");
    };
    img.src = nxt;
  }

  function exportImage(type: "png" | "jpeg" | "webp") {
    const c = canvasRef.current; if (!c) return;
    const url = c.toDataURL(`image/${type}`);
    const a = document.createElement("a");
    a.href = url; a.download = `chester-export.${type === "jpeg" ? "jpg" : type}`; a.click();
  }

  function addSticker(emoji?: string, src?: string) {
    const id = String(Date.now() + Math.random());
    setStickers((s) => [...s, { id, emoji, src, x: 50, y: 50, size: 64 }]);
  }
  function clearStickers() { setStickers([]); }
  function removeSticker(id: string) { setStickers((s) => s.filter((x) => x.id !== id)); }
  function customSticker(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => addSticker(undefined, r.result as string);
    r.readAsDataURL(f);
  }

  async function generateVideoFromCanvas() {
    const c = canvasRef.current; if (!c) return;
    setVideoProgress(0); setVideoURL("");
    const stream = (c as any).captureStream(30) as MediaStream;
    const rec = new MediaRecorder(stream, { mimeType: "video/webm" });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    rec.onstop = () => {
      const blob = new Blob(chunks, { type: "video/webm" });
      setVideoURL(URL.createObjectURL(blob));
      setVideoProgress(100);
    };
    rec.start();
    const start = performance.now();
    const dur = duration * 1000;
    function tick() {
      if (!c) return;
      const t = (performance.now() - start) / dur;
      setVideoProgress(Math.min(100, Math.floor(t * 100)));
      const ctx = c.getContext("2d");
      if (!ctx) return;
      ctx.globalAlpha = 1;
      if (imgEl) {
        const w = c.width, h = c.height;
        ctx.clearRect(0, 0, w, h);
        let alpha = 1, scale = 1, dx = 0;
        if (animIn === "fadeIn") alpha = Math.min(1, t * 3);
        if (animIn === "zoomIn") scale = 0.8 + Math.min(1, t * 3) * 0.2;
        if (animIn === "slideFromLeft") dx = (1 - Math.min(1, t * 3)) * -w;
        if (animIn === "bounce") scale = 1 + Math.sin(t * Math.PI * 4) * 0.05;
        if (animOut === "fadeOut" && t > 0.7) alpha *= (1 - (t - 0.7) / 0.3);
        if (animOut === "zoomOut" && t > 0.7) scale *= 1 - (t - 0.7) / 0.3 * 0.2;
        if (motion === "zoomIn") scale *= 1 + t * 0.1;
        if (motion === "panLeft") dx -= t * 30;
        if (motion === "panRight") dx += t * 30;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(w / 2 + dx, h / 2);
        ctx.scale(scale, scale);
        ctx.drawImage(imgEl, -w / 2, -h / 2, w, h);
        ctx.restore();
      }
      if (t < 1) requestAnimationFrame(tick);
      else rec.stop();
    }
    tick();
  }

  function aiEdit() {
    if (!aiPrompt.trim()) return;
    const p = aiPrompt.toLowerCase();
    if (p.includes("malam") || p.includes("night")) { setBrightness(60); setContrast(140); setColorFilter(220); }
    else if (p.includes("cyber")) { setColorFilter(280); setSaturation(180); }
    else if (p.includes("vintage")) { setSaturation(60); setColorFilter(30); setBrightness(110); }
    else if (p.includes("warm")) { setColorFilter(20); setSaturation(130); }
    else if (p.includes("cold") || p.includes("dingin")) { setColorFilter(200); setSaturation(110); }
    else { setColorFilter((c) => (c + 60) % 360); }
    setInfo(`AI edit (${editMode}): ${aiPrompt}`);
    pushHistory();
  }

  function bgImageInput(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    const i = new Image();
    i.onload = () => {
      setBgImage(i);
      setBgMode("image");
      setInfo("Background gambar berhasil dimuat");
    };
    i.src = URL.createObjectURL(f);
  }

  function handleBgColorChange(color: string) {
    setBgColor(color);
    setBgMode("color");
  }

  function cycleColorFilter() { setColorFilter((c) => (c + 45) % 360); }
  function shrink() { setZoom((z) => Math.max(50, z - 10)); }

  // ---- Crop Functions ----
  function activateCrop() {
    if (!canvasRef.current || !hasImage) return;
    const canvasDisplay = canvasRef.current;
    const rect = canvasDisplay.getBoundingClientRect();
    setCropRect({ x: 0, y: 0, w: rect.width, h: rect.height });
    setCropMode(true);
    drawCropOverlay();
  }

  function drawCropOverlay() {
    const overlay = cropOverlayRef.current;
    const canvasDisplay = canvasRef.current;
    if (!overlay || !canvasDisplay || !cropRect) return;
    const parentRect = canvasDisplay.getBoundingClientRect();
    overlay.width = parentRect.width;
    overlay.height = parentRect.height;
    const ctx = overlay.getContext("2d")!;
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, 0, overlay.width, overlay.height);
    ctx.clearRect(cropRect.x, cropRect.y, cropRect.w, cropRect.h);
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;
    ctx.strokeRect(cropRect.x, cropRect.y, cropRect.w, cropRect.h);
    const handleSize = 12;
    const positions = [
      { x: cropRect.x, y: cropRect.y, type: 'nw' },
      { x: cropRect.x + cropRect.w - handleSize, y: cropRect.y, type: 'ne' },
      { x: cropRect.x, y: cropRect.y + cropRect.h - handleSize, type: 'sw' },
      { x: cropRect.x + cropRect.w - handleSize, y: cropRect.y + cropRect.h - handleSize, type: 'se' },
      { x: cropRect.x + cropRect.w/2 - handleSize/2, y: cropRect.y, type: 'n' },
      { x: cropRect.x + cropRect.w/2 - handleSize/2, y: cropRect.y + cropRect.h - handleSize, type: 's' },
      { x: cropRect.x, y: cropRect.y + cropRect.h/2 - handleSize/2, type: 'w' },
      { x: cropRect.x + cropRect.w - handleSize, y: cropRect.y + cropRect.h/2 - handleSize/2, type: 'e' }
    ];
    ctx.fillStyle = "white";
    positions.forEach(pos => {
      ctx.fillRect(pos.x, pos.y, handleSize, handleSize);
      ctx.fillStyle = "#2196F3";
      ctx.fillRect(pos.x + 2, pos.y + 2, handleSize - 4, handleSize - 4);
      ctx.fillStyle = "white";
    });
    ctx.beginPath();
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 1;
    for (let i = 1; i <= 2; i++) {
      const x = cropRect.x + (cropRect.w * i / 3);
      ctx.moveTo(x, cropRect.y);
      ctx.lineTo(x, cropRect.y + cropRect.h);
      const y = cropRect.y + (cropRect.h * i / 3);
      ctx.moveTo(cropRect.x, y);
      ctx.lineTo(cropRect.x + cropRect.w, y);
    }
    ctx.stroke();
  }

  function startCropDrag(e: React.MouseEvent<HTMLCanvasElement>, type: 'move' | 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w') {
    e.preventDefault();
    if (!cropRect) return;
    const rect = cropOverlayRef.current!.getBoundingClientRect();
    const startX = e.clientX - rect.left;
    const startY = e.clientY - rect.top;
    cropDragRef.current = {
      active: true,
      type,
      startX,
      startY,
      initialRect: { ...cropRect }
    };
  }

  function onCropMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!cropDragRef.current.active || !cropRect) return;
    const rect = cropOverlayRef.current!.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;
    const dx = currentX - cropDragRef.current.startX;
    const dy = currentY - cropDragRef.current.startY;
    let newRect = { ...cropDragRef.current.initialRect };
    const parentRect = canvasRef.current!.getBoundingClientRect();
    const maxW = parentRect.width;
    const maxH = parentRect.height;
    const minSize = 50;

    switch (cropDragRef.current.type) {
      case 'move':
        newRect.x = Math.min(Math.max(0, newRect.x + dx), maxW - newRect.w);
        newRect.y = Math.min(Math.max(0, newRect.y + dy), maxH - newRect.h);
        break;
      case 'nw':
        newRect.w = Math.max(minSize, newRect.w - dx);
        newRect.h = Math.max(minSize, newRect.h - dy);
        newRect.x = Math.min(newRect.x + dx, newRect.x + newRect.w - minSize);
        newRect.y = Math.min(newRect.y + dy, newRect.y + newRect.h - minSize);
        newRect.x = Math.max(0, newRect.x);
        newRect.y = Math.max(0, newRect.y);
        newRect.w = Math.min(maxW - newRect.x, newRect.w);
        newRect.h = Math.min(maxH - newRect.y, newRect.h);
        break;
      case 'ne':
        newRect.w = Math.max(minSize, newRect.w + dx);
        newRect.h = Math.max(minSize, newRect.h - dy);
        newRect.y = Math.min(newRect.y + dy, newRect.y + newRect.h - minSize);
        newRect.y = Math.max(0, newRect.y);
        newRect.w = Math.min(maxW - newRect.x, newRect.w);
        newRect.h = Math.min(maxH - newRect.y, newRect.h);
        break;
      case 'sw':
        newRect.w = Math.max(minSize, newRect.w - dx);
        newRect.h = Math.max(minSize, newRect.h + dy);
        newRect.x = Math.min(newRect.x + dx, newRect.x + newRect.w - minSize);
        newRect.x = Math.max(0, newRect.x);
        newRect.w = Math.min(maxW - newRect.x, newRect.w);
        newRect.h = Math.min(maxH - newRect.y, newRect.h);
        break;
      case 'se':
        newRect.w = Math.max(minSize, newRect.w + dx);
        newRect.h = Math.max(minSize, newRect.h + dy);
        newRect.w = Math.min(maxW - newRect.x, newRect.w);
        newRect.h = Math.min(maxH - newRect.y, newRect.h);
        break;
      case 'n':
        newRect.h = Math.max(minSize, newRect.h - dy);
        newRect.y = Math.min(newRect.y + dy, newRect.y + newRect.h - minSize);
        newRect.y = Math.max(0, newRect.y);
        newRect.h = Math.min(maxH - newRect.y, newRect.h);
        break;
      case 's':
        newRect.h = Math.max(minSize, newRect.h + dy);
        newRect.h = Math.min(maxH - newRect.y, newRect.h);
        break;
      case 'e':
        newRect.w = Math.max(minSize, newRect.w + dx);
        newRect.w = Math.min(maxW - newRect.x, newRect.w);
        break;
      case 'w':
        newRect.w = Math.max(minSize, newRect.w - dx);
        newRect.x = Math.min(newRect.x + dx, newRect.x + newRect.w - minSize);
        newRect.x = Math.max(0, newRect.x);
        newRect.w = Math.min(maxW - newRect.x, newRect.w);
        break;
    }
    setCropRect(newRect);
    drawCropOverlay();
  }

  function endCropDrag() {
    cropDragRef.current.active = false;
  }

  async function applyCrop() {
    if (!cropRect || !canvasRef.current || !imgEl) return;
    const canvasDisplay = canvasRef.current;
    const displayRect = canvasDisplay.getBoundingClientRect();
    const scaleX = canvasDisplay.width / displayRect.width;
    const scaleY = canvasDisplay.height / displayRect.height;
    let sx = cropRect.x * scaleX;
    let sy = cropRect.y * scaleY;
    let sw = cropRect.w * scaleX;
    let sh = cropRect.h * scaleY;
    sx = Math.max(0, Math.min(sx, canvasDisplay.width));
    sy = Math.max(0, Math.min(sy, canvasDisplay.height));
    sw = Math.min(sw, canvasDisplay.width - sx);
    sh = Math.min(sh, canvasDisplay.height - sy);
    if (sw <= 0 || sh <= 0) {
      setInfo("Area crop tidak valid");
      return;
    }
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = sw;
    tempCanvas.height = sh;
    const tempCtx = tempCanvas.getContext("2d")!;
    tempCtx.drawImage(canvasDisplay, sx, sy, sw, sh, 0, 0, sw, sh);
    const croppedImage = new Image();
    croppedImage.onload = () => {
      setImgEl(croppedImage);
      setHasImage(true);
      setCropMode(false);
      setCropRect(null);
      pushHistory();
      setInfo("Crop berhasil diterapkan");
      const overlay = cropOverlayRef.current;
      if (overlay) {
        const ctx = overlay.getContext("2d");
        ctx?.clearRect(0, 0, overlay.width, overlay.height);
      }
    };
    croppedImage.onerror = () => {
      setInfo("Gagal melakukan crop");
      setCropMode(false);
    };
    croppedImage.src = tempCanvas.toDataURL();
  }

  function cancelCrop() {
    setCropMode(false);
    setCropRect(null);
    const overlay = cropOverlayRef.current;
    if (overlay) {
      const ctx = overlay.getContext("2d")!;
      ctx.clearRect(0, 0, overlay.width, overlay.height);
    }
  }

  useEffect(() => {
    if (cropMode && cropRect) drawCropOverlay();
  }, [cropRect, cropMode]);

  function getCropHandleAt(e: React.MouseEvent<HTMLCanvasElement>): 'move' | 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w' | null {
    if (!cropRect) return null;
    const rect = cropOverlayRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const handleSize = 12;
    const handlePositions = [
      { x: cropRect.x, y: cropRect.y, type: 'nw' as const },
      { x: cropRect.x + cropRect.w - handleSize, y: cropRect.y, type: 'ne' as const },
      { x: cropRect.x, y: cropRect.y + cropRect.h - handleSize, type: 'sw' as const },
      { x: cropRect.x + cropRect.w - handleSize, y: cropRect.y + cropRect.h - handleSize, type: 'se' as const },
      { x: cropRect.x + cropRect.w/2 - handleSize/2, y: cropRect.y, type: 'n' as const },
      { x: cropRect.x + cropRect.w/2 - handleSize/2, y: cropRect.y + cropRect.h - handleSize, type: 's' as const },
      { x: cropRect.x, y: cropRect.y + cropRect.h/2 - handleSize/2, type: 'w' as const },
      { x: cropRect.x + cropRect.w - handleSize, y: cropRect.y + cropRect.h/2 - handleSize/2, type: 'e' as const }
    ];
    for (const h of handlePositions) {
      if (x >= h.x && x <= h.x + handleSize && y >= h.y && y <= h.y + handleSize) {
        return h.type;
      }
    }
    if (x >= cropRect.x && x <= cropRect.x + cropRect.w && y >= cropRect.y && y <= cropRect.y + cropRect.h) {
      return 'move';
    }
    return null;
  }

  function onCropMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!cropMode) return;
    const handle = getCropHandleAt(e);
    if (handle) {
      startCropDrag(e, handle);
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
      <div className="p-4 bg-gradient-to-r from-blue-700 to-indigo-700 text-white flex justify-between items-center flex-wrap gap-2">
        <div>
          <h1 className="flex items-center gap-2">Chester AI Studio Pro</h1>
          <p className="text-xs opacity-90">by : Evenly · Rolan · Jay</p>
        </div>
        <button onClick={generateVideoFromCanvas} className="bg-pink-500 hover:bg-pink-600 px-3 py-1 rounded-lg text-sm">🎥 Foto ke Video (Canvas)</button>
      </div>

      <div className="flex flex-col lg:flex-row">
        {/* Sidebar */}
        <div className="w-full lg:w-96 p-4 border-r border-gray-200 bg-gray-50 space-y-3 max-h-[85vh] overflow-y-auto">
          <div className="bg-yellow-50 p-2 rounded-lg text-xs text-yellow-800"> {info}</div>

          <Panel title="AI Model">
            <select value={aiModel} onChange={(e) => setAiModel(e.target.value)} className="w-full p-2 border rounded-lg">
              <option value="medium">General Object (HD)</option>
              <option value="small">Fast Mobile (Low Res)</option>
            </select>
          </Panel>

          {/* PANEL TEXT TO IMAGE */}
          <Panel title="Text to Image" tone="blue">
            <input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="cyberpunk girl neon city" className="w-full p-2 border rounded-lg text-sm" />
            <button onClick={generateAIImage} disabled={generatedImageLoading} className="w-full bg-blue-600 text-white py-2 rounded mt-2 hover:bg-blue-700 disabled:opacity-50">
              {generatedImageLoading ? "Generating..." : "Generate AI Image"}
            </button>
            {generatedImageUrl && (
              <div className="mt-3 p-2 bg-white rounded border">
                <p className="text-xs font-semibold mb-1">Output Image:</p>
                <img src={generatedImageUrl} alt="Generated" className="w-full rounded border max-h-40 object-contain" />
                <div className="flex gap-2 mt-2">
                  <button onClick={useGeneratedImageInCanvas} className="flex-1 bg-green-600 text-white text-xs py-1 rounded hover:bg-green-700">Gunakan di Canvas</button>
                  <a href={generatedImageUrl} download="pollinations-image.png" className="flex-1 bg-gray-600 text-white text-xs py-1 rounded text-center hover:bg-gray-700">Download</a>
                </div>
              </div>
            )}
          </Panel>

          <Panel title="Remove Background">
            <button onClick={removeBG} disabled={!hasImage} className="w-full bg-purple-600 text-white py-2 rounded hover:bg-purple-700 disabled:opacity-50">Remove Background</button>
            <p className="text-xs text-gray-500 mt-1">Upload gambar dulu ya!</p>
          </Panel>

          <Panel title="AI Beauty Retouch" tone="pink">
            <Slider label="Skin Smoothing" value={skin} setValue={setSkin} max={100} />
            <Slider label="Brightness" value={brightness} setValue={setBrightness} max={200} />
            <Slider label="Contrast" value={contrast} setValue={setContrast} max={200} />
            <Slider label="Saturation" value={saturation} setValue={setSaturation} max={200} />
            <Slider label="Sharpness" value={sharpness} setValue={setSharpness} max={100} />
            <button onClick={applyBeauty} className="w-full bg-pink-600 text-white py-2 rounded-lg mt-3 hover:bg-pink-700">Apply Beauty Retouch</button>
            <button onClick={resetBeauty} className="w-full bg-gray-400 text-white py-1 rounded-lg text-sm mt-2 hover:bg-gray-500">Reset Beauty</button>
          </Panel>

          {/* FITUR BARU: AI Background Generator (mengganti card Quality Upscale) */}
          <Panel title="AI Background Generator" tone="green">
            <textarea 
              value={bgPrompt} 
              onChange={(e) => setBgPrompt(e.target.value)} 
              rows={2} 
              className="w-full p-2 border rounded text-sm" 
              placeholder="Deskripsikan background baru... contoh: sunset beach, cyberpunk city, forest with waterfall"
            />
            <button 
              onClick={generateBackgroundFromPrompt} 
              disabled={generatingBg || !hasImage} 
              className="w-full bg-green-600 text-white py-2 rounded mt-2 hover:bg-green-700 disabled:opacity-50"
            >
              {generatingBg ? "Generating Background..." : "Generate & Ganti Background"}
            </button>
            <p className="text-xs text-gray-500 mt-1">Akan menghasilkan background dari teks dan mengganti latar belakang gambar saat ini.</p>
          </Panel>

          {/* FITUR BARU: Art Style Transfer (mengganti card Text-to-Video) */}
          <Panel title="AI Art Style Transfer" tone="purple">
            <input 
              value={stylePrompt} 
              onChange={(e) => setStylePrompt(e.target.value)} 
              placeholder="Gaya artistik: anime, oil painting, cyberpunk, watercolor, van gogh, pixel art"
              className="w-full p-2 border rounded text-sm"
            />
            <button 
              onClick={generateStyleTransfer} 
              disabled={styleTransferLoading} 
              className="w-full bg-purple-600 text-white py-2 rounded mt-2 hover:bg-purple-700 disabled:opacity-50"
            >
              {styleTransferLoading ? "Generating Style Transfer..." : "Apply Style Transfer"}
            </button>
            {styleOutputUrl && (
              <div className="mt-3 p-2 bg-white rounded border">
                <p className="text-xs font-semibold mb-1">Hasil Style Transfer:</p>
                <img src={styleOutputUrl} alt="Style Transfer" className="w-full rounded border max-h-40 object-contain" />
                <div className="flex gap-2 mt-2">
                  <button onClick={useStyleTransferInCanvas} className="flex-1 bg-green-600 text-white text-xs py-1 rounded hover:bg-green-700">Gunakan di Canvas</button>
                  <a href={styleOutputUrl} download="style-transfer.png" className="flex-1 bg-gray-600 text-white text-xs py-1 rounded text-center hover:bg-gray-700">Download</a>
                </div>
              </div>
            )}
            <p className="text-xs text-gray-500 mt-1">Berdasarkan prompt di Text to Image, hasilkan gambar dengan gaya artistik pilihan.</p>
          </Panel>

          <Panel title="Shadow Reconstruction">
            <input type="range" min={0} max={25} value={shadow} onChange={(e) => setShadow(+e.target.value)} className="w-full" />
            <span className="text-xs">Intensity: {shadow}</span>
          </Panel>

          <Panel title="Edge Smoothing">
            <input type="range" min={0} max={12} value={smooth} onChange={(e) => setSmooth(+e.target.value)} className="w-full" />
          </Panel>

          <Panel title="Zoom & Lock">
            <input type="range" min={50} max={350} value={zoom} onChange={(e) => setZoom(+e.target.value)} className="w-full" />
            <button onClick={() => setLocked((l) => !l)} className={`mt-2 w-full py-1 rounded text-sm text-white ${locked ? "bg-gray-800" : "bg-gray-700 hover:bg-gray-800"}`}>
              {locked ? "Buka Posisi" : "Kunci Posisi"}
            </button>
            <div className="flex gap-2 mt-2">
              <button onClick={undo} className="flex-1 bg-blue-600 text-white py-1 rounded text-sm hover:bg-blue-700">↶ Undo</button>
              <button onClick={redo} className="flex-1 bg-blue-600 text-white py-1 rounded text-sm hover:bg-blue-700">↷ Redo</button>
            </div>
          </Panel>

          <Panel title="Export">
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => exportImage("png")} className="bg-blue-600 text-white py-1 rounded">PNG</button>
              <button onClick={() => exportImage("jpeg")} className="bg-green-600 text-white py-1 rounded">JPG</button>
              <button onClick={() => exportImage("webp")} className="bg-purple-600 text-white py-1 rounded">WEBP</button>
            </div>
          </Panel>

          <Panel title="Transformasi">
            <div className="flex gap-2 mb-2">
              <button onClick={() => setFlipH((v) => !v)} className="bg-indigo-100 p-2 rounded text-sm flex-1">↔ Flip H</button>
              <button onClick={() => setFlipV((v) => !v)} className="bg-indigo-100 p-2 rounded text-sm flex-1">↕ Flip V</button>
              <button onClick={() => setRotate((r) => (r + 90) % 360)} className="bg-amber-100 p-2 rounded text-sm flex-1">⟳ Rotate</button>
            </div>
            <button onClick={shrink} className="w-full bg-teal-500 text-white py-1.5 rounded text-sm hover:bg-teal-600">Sempitkan Gambar</button>
          </Panel>

          <Panel title="Tambah Stiker" tone="pink">
            <div className="grid grid-cols-6 gap-1 mb-2">
              {STICKER_EMOJIS.map((s) => (
                <button key={s} onClick={() => addSticker(s)} className="p-2 bg-white rounded hover:bg-gray-100">{s}</button>
              ))}
            </div>
            <input type="file" accept="image/*" onChange={customSticker} className="w-full text-xs p-1 border rounded mb-2" />
            <button onClick={clearStickers} className="w-full bg-gray-500 text-white py-1 rounded text-sm">Hapus Semua Stiker</button>
          </Panel>

          <Panel title="Animasikan (Foto di Canvas ke Video)" tone="orange">
            <label className="text-xs">Durasi: {duration} detik</label>
            <input type="range" min={2} max={10} step={0.5} value={duration} onChange={(e) => setDuration(+e.target.value)} className="w-full" />
            <select value={animIn} onChange={(e) => setAnimIn(e.target.value)} className="w-full p-1 border rounded text-sm mt-1">
              {ANIM_IN.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
            <select value={animOut} onChange={(e) => setAnimOut(e.target.value)} className="w-full p-1 border rounded text-sm mt-1">
              {ANIM_OUT.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
            <select value={motion} onChange={(e) => setMotion(e.target.value)} className="w-full p-1 border rounded text-sm mt-1">
              {MOTION.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
            <button onClick={generateVideoFromCanvas} className="w-full bg-orange-600 text-white py-2 rounded mt-2">Generate Video dari Foto Canvas</button>
            {videoProgress > 0 && videoProgress < 100 && (
              <div className="mt-2"><div className="bg-gray-200 rounded-full h-2 overflow-hidden"><div className="bg-orange-600 h-2" style={{ width: `${videoProgress}%` }} /></div></div>
            )}
            {videoURL && (
              <div className="mt-2">
                <video src={videoURL} controls className="w-full rounded" />
                <a href={videoURL} download="animation.webm" className="block text-center bg-gray-800 text-white text-sm py-1 rounded mt-1">Download Video</a>
              </div>
            )}
          </Panel>

          <Panel title="AI Prompt Edit" tone="indigo">
            <textarea value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} rows={3} className="w-full p-2 border rounded text-sm" placeholder="ubah jadi malam cyberpunk..." />
            <select value={editMode} onChange={(e) => setEditMode(e.target.value as any)} className="w-full p-2 border rounded text-sm mb-2 mt-1">
              <option value="full">Full Image</option>
              <option value="mask">Target (Mask)</option>
            </select>
            <button onClick={aiEdit} className="w-full bg-indigo-600 text-white py-2 rounded">Generate AI Edit</button>
          </Panel>

          <Panel title="Crop Image" tone="green">
            <button onClick={activateCrop} disabled={!hasImage} className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 disabled:opacity-50">Aktifkan Crop</button>
            {cropMode && (
              <div className="mt-2 flex gap-2">
                <button onClick={applyCrop} className="flex-1 bg-blue-600 text-white py-1 rounded text-sm">Terapkan Crop</button>
                <button onClick={cancelCrop} className="flex-1 bg-gray-600 text-white py-1 rounded text-sm">Batal</button>
              </div>
            )}
            <p className="text-xs text-gray-500 mt-2">Drag area, resize via handle. Klik Terapkan untuk memotong.</p>
          </Panel>

          <Panel title="Background">
            <select value={bgMode} onChange={(e) => setBgMode(e.target.value as any)} className="w-full p-2 border rounded text-sm">
              <option value="color">Warna</option>
              <option value="image">Gambar</option>
            </select>
            <input
              type="color"
              value={bgColor}
              onChange={(e) => handleBgColorChange(e.target.value)}
              className="w-full h-10 rounded-lg cursor-pointer mt-2"
            />
            <input
              type="file"
              accept="image/*"
              onChange={bgImageInput}
              className="w-full text-xs p-1 border rounded mt-2"
            />
            <button
              onClick={() => setBgRemoved(true)}
              className="w-full bg-blue-600 text-white py-1.5 rounded text-sm mt-2 hover:bg-blue-700"
            >
              Ganti Background
            </button>
            <p className="text-xs text-gray-500 mt-1">
              {bgRemoved ? "Background aktif" : "Aktifkan dengan 'Ganti Background' atau hapus background dulu"}
            </p>
          </Panel>

          <Panel title="Filter Warna">
            <button onClick={cycleColorFilter} className="w-full bg-purple-500 text-white py-1.5 rounded text-sm hover:bg-purple-600">Filter Warna ({colorFilter}°)</button>
          </Panel>
        </div>

        {/* Main Canvas */}
        <div className="flex-1 p-5 flex flex-col items-center">
          <div className="mb-2 text-sm text-gray-500">Canvas Utama (Edit & Preview)</div>
          {!hasImage && (
            <div onDrop={onDrop} onDragOver={(e) => e.preventDefault()}
              onClick={() => document.getElementById("imageInput")?.click()}
              className="w-full border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center bg-gray-50 cursor-pointer hover:bg-gray-100">
              <div className="text-5xl text-blue-500 mb-2">☁️</div>
              <p className="text-blue-600 text-lg">Klik atau Seret Foto ke Sini</p>
              <p className="text-gray-400 text-sm">JPG, PNG, WebP | Background akan dihapus otomatis</p>
              <input id="imageInput" type="file" accept="image/*" className="hidden" onChange={onUploadInput} />
            </div>
          )}

          <div className={`mt-4 relative ${hasImage ? "" : "hidden"}`} style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top center" }}>
            <div className="relative inline-block rounded-lg overflow-hidden" style={{ background: "linear-gradient(45deg,#ccc 25%,transparent 25%),linear-gradient(-45deg,#ccc 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#ccc 75%),linear-gradient(-45deg,transparent 75%,#ccc 75%)", backgroundSize: "20px 20px", backgroundPosition: "0 0,0 10px,10px -10px,-10px 0px" }}>
              <canvas ref={canvasRef} className="rounded-lg shadow-md max-w-full block" style={{ maxWidth: "min(800px,90vw)" }} />
              
              {/* Crop overlay */}
              <canvas
                ref={cropOverlayRef}
                className="absolute inset-0 w-full h-full"
                style={{
                  pointerEvents: cropMode ? "auto" : "none",
                  cursor: cropMode ? "default" : "none"
                }}
                onMouseDown={onCropMouseDown}
                onMouseMove={onCropMouseMove}
                onMouseUp={endCropDrag}
                onMouseLeave={endCropDrag}
              />
              
              {/* Before/after overlay (tapi kita tidak punya beforeAfter, mungkin tetap dipertahankan) */}
              {imgEl && beforeAfter < 100 && (
                <img src={imgEl.src} alt="before" className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                  style={{ clipPath: `inset(0 0 0 ${beforeAfter}%)` }} />
              )}
              
              {/* Sticker layer */}
              <div
                ref={stickerLayerRef}
                className="absolute inset-0"
                style={{ pointerEvents: cropMode ? "none" : "auto" }}
              >
                {stickers.map((s) => (
                  <StickerView key={s.id} sticker={s} onMove={(x, y) => setStickers((arr) => arr.map((a) => a.id === s.id ? { ...a, x, y } : a))} onResize={(sz) => setStickers((arr) => arr.map((a) => a.id === s.id ? { ...a, size: sz } : a))} onDelete={() => removeSticker(s.id)} locked={locked} />
                ))}
              </div>
            </div>
          </div>
          {loading && (
            <div className="mt-4 flex flex-col items-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
              <p className="mt-3">AI Sedang Memproses...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Panel({ title, tone, children }: { title: string; tone?: string; children: React.ReactNode }) {
  const bg = tone === "pink" ? "bg-pink-50" : tone === "orange" ? "bg-orange-50" : tone === "red" ? "bg-red-50" : tone === "blue" ? "bg-blue-50" : tone === "indigo" ? "bg-indigo-50" : tone === "green" ? "bg-emerald-50" : tone === "purple" ? "bg-purple-50" : "bg-white";
  return (
    <div className={`${bg} p-3 rounded-xl shadow-sm`}>
      <div className="text-sm mb-2">{title}</div>
      {children}
    </div>
  );
}

function Slider({ label, value, setValue, max }: { label: string; value: number; setValue: (n: number) => void; max: number }) {
  return (
    <div className="mb-1">
      <label className="text-xs text-gray-600">{label}: {value}</label>
      <input type="range" min={0} max={max} value={value} onChange={(e) => setValue(+e.target.value)} className="w-full" />
    </div>
  );
}

function StickerView({ sticker, onMove, onResize, onDelete, locked }: { sticker: Sticker; onMove: (x: number, y: number) => void; onResize: (s: number) => void; onDelete: () => void; locked: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  function down(e: React.MouseEvent) {
    if (locked) return;
    e.preventDefault();
    const startX = e.clientX, startY = e.clientY;
    const ox = sticker.x, oy = sticker.y;
    function move(ev: MouseEvent) { onMove(ox + (ev.clientX - startX), oy + (ev.clientY - startY)); }
    function up() { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); }
    window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
  }
  function resizeDown(e: React.MouseEvent) {
    e.stopPropagation();
    const startX = e.clientX; const os = sticker.size;
    function move(ev: MouseEvent) { onResize(Math.max(20, os + (ev.clientX - startX))); }
    function up() { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); }
    window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
  }
  return (
    <div ref={ref} onMouseDown={down}
      style={{ position: "absolute", left: sticker.x, top: sticker.y, width: sticker.size, height: sticker.size, cursor: locked ? "default" : "move" }}
      className="group">
      {sticker.emoji ? (
        <div style={{ fontSize: sticker.size * 0.85, lineHeight: 1 }}>{sticker.emoji}</div>
      ) : (
        <img src={sticker.src} alt="" draggable={false} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
      )}
      <button onClick={onDelete} className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white text-xs hidden group-hover:flex items-center justify-center">×</button>
      <div onMouseDown={resizeDown} className="absolute -bottom-1 -right-1 w-3 h-3 bg-blue-500 rounded-full hidden group-hover:block cursor-nwse-resize" />
    </div>
  );
}
