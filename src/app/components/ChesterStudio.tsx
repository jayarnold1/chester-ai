import { useEffect, useRef, useState } from "react";
import { Logo } from "./Logo";

type Sticker = { id: string; emoji?: string; src?: string; x: number; y: number; size: number };

const STICKER_EMOJIS = ["⭐", "❤️", "🔥", "✨", "🎉", "😎", "🌟", "💎", "🌸", "🦄", "🌈", "🍀"];

const ANIM_IN = ["fadeIn", "slideFromLeft", "zoomIn", "bounce", "none"];
const ANIM_OUT = ["none", "fadeOut", "zoomOut"];
const MOTION = ["none", "zoomIn", "panLeft", "panRight"];

export function ChesterStudio() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskRef = useRef<HTMLCanvasElement>(null);
  const stickerLayerRef = useRef<HTMLDivElement>(null);
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null);
  const [hasImage, setHasImage] = useState(false);
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState("Upload foto, tunggu proses AI");

  // 1. AI Model
  const [aiModel, setAiModel] = useState("medium");
  // 2. Text-to-image prompt
  const [prompt, setPrompt] = useState("");
  // 4-8. Beauty
  const [skin, setSkin] = useState(0);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [sharpness, setSharpness] = useState(0);
  // 9. Quality
  const [quality, setQuality] = useState<"standard" | "hd">("standard");
  // 10. Before/after slider
  const [beforeAfter, setBeforeAfter] = useState(100);
  // 11/12 shadow / smooth
  const [shadow, setShadow] = useState(4);
  const [smooth, setSmooth] = useState(2);
  // 13 zoom & lock
  const [zoom, setZoom] = useState(100);
  const [locked, setLocked] = useState(false);
  // 14 undo/redo
  const historyRef = useRef<string[]>([]);
  const futureRef = useRef<string[]>([]);
  // 17 stickers
  const [stickers, setStickers] = useState<Sticker[]>([]);
  // 18 PPT animation
  const [duration, setDuration] = useState(5);
  const [animIn, setAnimIn] = useState("fadeIn");
  const [animOut, setAnimOut] = useState("none");
  const [motion, setMotion] = useState("none");
  const [videoURL, setVideoURL] = useState("");
  const [videoProgress, setVideoProgress] = useState(0);
  // 19 AI prompt edit
  const [aiPrompt, setAiPrompt] = useState("");
  const [editMode, setEditMode] = useState<"full" | "mask">("full");
  // 20 brush
  const [brushOn, setBrushOn] = useState(false);
  const [brushSize, setBrushSize] = useState(20);
  // 21 auto select
  const [autoSelectOn, setAutoSelectOn] = useState(false);
  const [autoPoints, setAutoPoints] = useState<{ x: number; y: number }[]>([]);
  // 22 background
  const [bgMode, setBgMode] = useState<"color" | "image">("color");
  const [bgColor, setBgColor] = useState("#ffffff");
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
  // transformations
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [rotate, setRotate] = useState(0);
  const [bgRemoved, setBgRemoved] = useState(false);
  const [colorFilter, setColorFilter] = useState(0); // hue rotate

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
    const scale = quality === "hd" ? 2 : 1;
    const w = imgEl.naturalWidth * scale;
    const h = imgEl.naturalHeight * scale;
    c.width = w;
    c.height = h;
    if (maskRef.current) {
      maskRef.current.width = w;
      maskRef.current.height = h;
    }

    ctx.save();
    ctx.clearRect(0, 0, w, h);

    // background
    if (bgRemoved) {
      if (bgMode === "color") {
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, w, h);
      } else if (bgMode === "image" && bgImage) {
        ctx.drawImage(bgImage, 0, 0, w, h);
      }
    }

    // transformations
    ctx.translate(w / 2, h / 2);
    ctx.rotate((rotate * Math.PI) / 180);
    ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);

    // shadow
    if (shadow > 0) {
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = shadow * 2;
      ctx.shadowOffsetY = shadow;
    }

    // filters
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

    // BG removal "fake": make near-white pixels transparent
    if (bgRemoved) {
      const id = ctx.getImageData(0, 0, w, h);
      const d = id.data;
      // Only attempt if there's no bg drawn behind (color/image case is already drawn underneath)
      // We'll skip pixel removal to avoid destroying drawn bg; the underlying bg color/image is the visible result.
      void d;
    }
  }

  useEffect(() => { if (imgEl) draw(); }, [imgEl, brightness, contrast, saturation, skin, sharpness, smooth, shadow, quality, flipH, flipV, rotate, bgMode, bgColor, bgImage, bgRemoved, colorFilter]);

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

  // ---- Feature actions ----
  // 2. Text-to-image (placeholder via picsum seeded)
  async function generateAIImage() {
    if (!prompt.trim()) return;
    setLoading(true); setInfo("Generating AI image...");
    const seed = encodeURIComponent(prompt);
    const url = `https://picsum.photos/seed/${seed}/768/768`;
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => {
      setImgEl(i); setHasImage(true); setLoading(false);
      setInfo(`Generated for "${prompt}"`);
      setTimeout(pushHistory, 50);
    };
    i.onerror = () => { setLoading(false); setInfo("Gagal generate."); };
    i.src = url;
  }
  // 3. Remove BG — uses remove.bg API
  async function removeBG() {
    if (!imgEl) return;
    setLoading(true);
    setInfo(" Sedang menghapus background... ditunggu, yaa!");
    try {
      // Render current canvas to a blob so user-applied edits/transformations are preserved
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
        setInfo("Background berhasil dihapus!");
        setTimeout(pushHistory, 50);
      };
      i.onerror = () => { setLoading(false); setInfo("Gagal memuat hasil PNG"); };
      i.src = url;
    } catch (e: any) {
      setLoading(false);
      setInfo(`Remove BG gagal: ${e.message || e}`);
    }
  }
  // Beauty apply / reset
  function applyBeauty() { pushHistory(); setInfo("Beauty diterapkan"); }
  function resetBeauty() { setSkin(0); setBrightness(100); setContrast(100); setSaturation(100); setSharpness(0); }
  // 14 undo/redo
  function undo() {
    const c = canvasRef.current; if (!c) return;
    const cur = c.toDataURL();
    const prev = historyRef.current.pop();
    if (!prev) return;
    futureRef.current.push(cur);
    const i = new Image(); i.onload = () => { c.getContext("2d")!.drawImage(i, 0, 0); }; i.src = prev;
  }
  function redo() {
    const c = canvasRef.current; if (!c) return;
    const cur = c.toDataURL();
    const nxt = futureRef.current.pop();
    if (!nxt) return;
    historyRef.current.push(cur);
    const i = new Image(); i.onload = () => { c.getContext("2d")!.drawImage(i, 0, 0); }; i.src = nxt;
  }
  // 15 export
  function exportImage(type: "png" | "jpeg" | "webp") {
    const c = canvasRef.current; if (!c) return;
    const url = c.toDataURL(`image/${type}`);
    const a = document.createElement("a");
    a.href = url; a.download = `chester-export.${type === "jpeg" ? "jpg" : type}`; a.click();
  }
  // 17 stickers
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
  // 18 video export — record canvas
  async function generateVideo() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setVideoProgress(0); setVideoURL("");
    const stream = (canvas as any).captureStream(30) as MediaStream;
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
      const t = (performance.now() - start) / dur;
      setVideoProgress(Math.min(100, Math.floor(t * 100)));
      // simple animation: vary brightness for "fadeIn"
      if (!canvas) return;
      const ctx = canvas.getContext("2d")!;
      ctx.globalAlpha = 1;
      // Re-draw with animation effect
      if (imgEl) {
        const w = canvas.width, h = canvas.height;
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
  // 19 AI prompt edit (apply hue/colorize from prompt heuristics)
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
  // 20 brush — paint on mask canvas
  const drawingRef = useRef(false);
  function maskDown(e: React.MouseEvent) {
    if (!brushOn || !maskRef.current) return;
    drawingRef.current = true;
    paintAt(e);
  }
  function maskMove(e: React.MouseEvent) {
    if (!brushOn || !drawingRef.current) return;
    paintAt(e);
  }
  function maskUp() { drawingRef.current = false; }
  function paintAt(e: React.MouseEvent) {
    const m = maskRef.current!;
    const rect = m.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * m.width;
    const y = ((e.clientY - rect.top) / rect.height) * m.height;
    const ctx = m.getContext("2d")!;
    ctx.fillStyle = "rgba(239,68,68,0.4)";
    ctx.beginPath(); ctx.arc(x, y, brushSize, 0, Math.PI * 2); ctx.fill();
  }
  function clearMask() {
    const m = maskRef.current; if (m) m.getContext("2d")!.clearRect(0, 0, m.width, m.height);
  }
  // 21 auto select
  function autoSelectClick(e: React.MouseEvent) {
    if (!autoSelectOn || !maskRef.current) return;
    const m = maskRef.current;
    const rect = m.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * m.width;
    const y = ((e.clientY - rect.top) / rect.height) * m.height;
    setAutoPoints((p) => [...p, { x, y }]);
    const ctx = m.getContext("2d")!;
    ctx.fillStyle = "rgba(59,130,246,0.7)";
    ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
  }
  function resetPoints() {
    setAutoPoints([]); clearMask();
  }
  // 22 bg image upload
  function bgImageInput(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    const i = new Image();
    i.onload = () => setBgImage(i);
    i.src = URL.createObjectURL(f);
  }
  // 23 color filter cycle
  function cycleColorFilter() { setColorFilter((c) => (c + 45) % 360); }
  // expand canvas: shrink image
  function shrink() { setZoom((z) => Math.max(50, z - 10)); }

  return (
    <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
      <div className="p-4 bg-gradient-to-r from-blue-700 to-indigo-700 text-white flex justify-between items-center flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Logo size={44} />
          <div>
            <h1>Chester AI Studio Pro</h1>
            <p className="text-xs opacity-90">by : Evenly · Rolan · Jay </p>
          </div>
        </div>
        <button onClick={generateVideo} className="bg-pink-500 hover:bg-pink-600 px-3 py-1 rounded-lg text-sm">Foto ke Video</button>
      </div>

      <div className="flex flex-col lg:flex-row">
        {/* Sidebar */}
        <div className="w-full lg:w-80 p-4 border-r border-gray-200 bg-gray-50 space-y-3 max-h-[85vh] overflow-y-auto">
          <div className="bg-yellow-50 p-2 rounded-lg text-xs text-yellow-800">{info}</div>

          {/* AI Model */}
          <Panel title="AI Model">
            <select value={aiModel} onChange={(e) => setAiModel(e.target.value)} className="w-full p-2 border rounded-lg">
              <option value="medium">General Object (HD)</option>
              <option value="small">Fast Mobile (Low Res)</option>
            </select>
          </Panel>

          {/* Text to image */}
          <Panel title="Text to Image">
            <input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="cyberpunk girl neon city" className="w-full p-2 border rounded-lg text-sm" />
            <button onClick={generateAIImage} className="w-full bg-blue-600 text-white py-2 rounded mt-2 hover:bg-blue-700">Generate AI Image</button>
          </Panel>

          {/* Remove BG */}
          <Panel title="Remove Background">
            <button onClick={removeBG} disabled={!hasImage} className="w-full bg-purple-600 text-white py-2 rounded hover:bg-purple-700 disabled:opacity-50">Remove Background</button>
            <p className="text-xs text-gray-500 mt-1">Upload gambar dulu ya!</p>
          </Panel>

          {/* Beauty */}
          <Panel title="AI Beauty Retouch" tone="pink">
            <Slider label="Skin Smoothing" value={skin} setValue={setSkin} max={100} />
            <Slider label="Brightness" value={brightness} setValue={setBrightness} max={200} />
            <Slider label="Contrast" value={contrast} setValue={setContrast} max={200} />
            <Slider label="Saturation" value={saturation} setValue={setSaturation} max={200} />
            <Slider label="Sharpness" value={sharpness} setValue={setSharpness} max={100} />
            <button onClick={applyBeauty} className="w-full bg-pink-600 text-white py-2 rounded-lg mt-3 hover:bg-pink-700">Apply Beauty Retouch</button>
            <button onClick={resetBeauty} className="w-full bg-gray-400 text-white py-1 rounded-lg text-sm mt-2 hover:bg-gray-500">Reset Beauty</button>
          </Panel>

          {/* Quality + Before/After */}
          <Panel title="Quality Upscale & Before/After">
            <div className="grid grid-cols-2 gap-2 mb-2">
              <button onClick={() => setQuality("standard")} className={`px-2 py-1 rounded text-sm ${quality === "standard" ? "bg-green-500 text-white" : "bg-gray-200"}`}>Standard</button>
              <button onClick={() => setQuality("hd")} className={`px-2 py-1 rounded text-sm ${quality === "hd" ? "bg-green-500 text-white" : "bg-gray-200"}`}>HD 2x</button>
            </div>
            <p className="text-xs text-center text-gray-500">{imgEl ? `${imgEl.naturalWidth * (quality === "hd" ? 2 : 1)}×${imgEl.naturalHeight * (quality === "hd" ? 2 : 1)} px` : ""}</p>
            <div className="mt-3 pt-2 border-t border-gray-200">
              <div className="flex justify-between text-xs"><span>After</span><span>Before</span></div>
              <input type="range" min={0} max={100} value={beforeAfter} onChange={(e) => setBeforeAfter(+e.target.value)} className="w-full" />
              <p className="text-xs text-center text-gray-400">Geser slider untuk perbandingan</p>
            </div>
          </Panel>

          <Panel title="Shadow Reconstruction">
            <input type="range" min={0} max={25} value={shadow} onChange={(e) => setShadow(+e.target.value)} className="w-full" />
            <span className="text-xs">Intensity: {shadow}</span>
          </Panel>

          <Panel title="〰️ Edge Smoothing">
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

          <Panel title="Animasikan!" tone="orange">
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
            <button onClick={generateVideo} className="w-full bg-orange-600 text-white py-2 rounded mt-2">Generate Video</button>
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

          <Panel title="Seleksi Brush" tone="red">
            <button onClick={() => setBrushOn((v) => !v)} className={`w-full py-1 rounded text-sm text-white ${brushOn ? "bg-red-700" : "bg-red-600"}`}>{brushOn ? "Nonaktifkan Brush" : "Aktifkan Brush"}</button>
            <input type="range" min={5} max={50} value={brushSize} onChange={(e) => setBrushSize(+e.target.value)} className="w-full mt-2" />
            <button onClick={clearMask} className="w-full bg-gray-500 text-white py-1 rounded text-sm mt-1">Hapus Mask</button>
          </Panel>

          <Panel title="Auto Select" tone="blue">
            <button onClick={() => setAutoSelectOn((v) => !v)} className={`w-full py-2 rounded text-white ${autoSelectOn ? "bg-blue-700" : "bg-blue-600"}`}>{autoSelectOn ? "Nonaktifkan" : "Aktifkan"} Auto Select</button>
            <button onClick={resetPoints} className="w-full bg-gray-600 text-white py-1 rounded text-sm mt-1">Reset Titik ({autoPoints.length})</button>
          </Panel>

          <Panel title="Background">
            <select value={bgMode} onChange={(e) => setBgMode(e.target.value as any)} className="w-full p-2 border rounded text-sm">
              <option value="color">Warna</option>
              <option value="image">Gambar</option>
            </select>
            <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="w-full h-10 rounded-lg cursor-pointer mt-2" />
            <input type="file" accept="image/*" onChange={bgImageInput} className="w-full text-xs p-1 border rounded mt-2" />
            <button onClick={() => setBgRemoved(true)} className="w-full bg-blue-600 text-white py-1.5 rounded text-sm mt-2 hover:bg-blue-700">Ganti Background</button>
          </Panel>

          <Panel title="Filter Warna">
            <button onClick={cycleColorFilter} className="w-full bg-purple-500 text-white py-1.5 rounded text-sm hover:bg-purple-600">🎨 Filter Warna ({colorFilter}°)</button>
          </Panel>
        </div>

        {/* Main Canvas */}
        <div className="flex-1 p-5 flex flex-col items-center">
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
              <canvas
                ref={maskRef}
                className="absolute inset-0 w-full h-full"
                style={{ pointerEvents: brushOn || autoSelectOn ? "auto" : "none", cursor: brushOn ? "crosshair" : autoSelectOn ? "pointer" : "default" }}
                onMouseDown={maskDown} onMouseMove={maskMove} onMouseUp={maskUp} onMouseLeave={maskUp}
                onClick={autoSelectClick}
              />
              {/* Before/after dimmer overlay using img clipPath: simulate by overlaying original image */}
              {imgEl && beforeAfter < 100 && (
                <img src={imgEl.src} alt="before" className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                  style={{ clipPath: `inset(0 0 0 ${beforeAfter}%)` }} />
              )}
              <div ref={stickerLayerRef} className="absolute inset-0">
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
  const bg = tone === "pink" ? "bg-pink-50" : tone === "orange" ? "bg-orange-50" : tone === "red" ? "bg-red-50" : tone === "blue" ? "bg-blue-50" : tone === "indigo" ? "bg-indigo-50" : "bg-white";
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
