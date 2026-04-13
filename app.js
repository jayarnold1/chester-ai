// ==============================
// CHESTER AI STUDIO PRO - FULL VERSION WITH UNDO/REDO
// ==============================

class ImageEditor {
    constructor() {

        this.canvas = document.getElementById('mainCanvas');
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
        // ===== MASK CANVAS =====
        this.maskCanvas = document.getElementById("maskCanvas");
        this.maskCtx = this.maskCanvas ? this.maskCanvas.getContext("2d") : null;

        this.isBrushActive = false;

        this.stickerContainer = document.getElementById('sticker-container');

        // Image states
        this.originalImg = null;
        this.processedImg = null;
        this.upscaledImg = null;
        this.beautyProcessedImg = null;
        
        // Undo/Redo stacks
        this.undoStack = [];
        this.redoStack = [];
        this.maxUndoSteps = 50;
        
        // Settings
        this.currentQuality = 'standard';
        this.currentScale = 1;
        this.isBgRemoved = false;
        this.showBackground = false;
        this.showBeforeAfter = true;
        
        // Beauty settings
        this.beautySettings = {
            skin: 0,
            brightness: 100,
            contrast: 100,
            saturation: 100,
            sharpness: 0
        };
        
        // Brush
        this.currentBrush = 'erase';
        this.brushSize = 18;
        this.currentFilter = 'none';
        this.lockedPosition = false;
        this.backgroundColor = "#ffffff";
        this.backgroundImg = null;
        this.bgMode = "color";
        this.isDrawing = false;
        
        // Stickers
        this.stickers = [];
        this.activeSticker = null;
        this.isDragging = false;
        this.dragStartX = 0;
        this.dragStartY = 0;

        // API Key remove.bg
        this.API_KEY = "FjEnMpbSEGGz9ETF35xmpdRK";
        this.isGenerating = false;
        this.isProcessing = false;
        this.cache = {};
        this.init();
    }

    // Save current state to undo stack
    saveToUndo() {
        if (this.lockedPosition) return;
        
        const state = {
            upscaledImg: this.upscaledImg ? this.upscaledImg.src : null,
            processedImg: this.processedImg ? this.processedImg.src : null,
            originalImg: this.originalImg ? this.originalImg.src : null,
            beautyProcessedImg: this.beautyProcessedImg ? this.beautyProcessedImg.src : null,
            isBgRemoved: this.isBgRemoved,
            showBackground: this.showBackground,
            currentQuality: this.currentQuality,
            currentScale: this.currentScale,
            currentFilter: this.currentFilter,
            canvasWidth: this.canvas ? this.canvas.width : 0,
            canvasHeight: this.canvas ? this.canvas.height : 0,
            stickers: JSON.parse(JSON.stringify(this.stickers.map(s => ({
                id: s.id,
                type: s.type,
                customUrl: s.customUrl,
                x: s.x,
                y: s.y,
                width: s.width,
                height: s.height
            }))))
        };
        
        this.undoStack.push(state);
        if (this.undoStack.length > this.maxUndoSteps) {
            this.undoStack.shift();
        }
        this.redoStack = [];
    }

    async loadToCanvas(imgUrl) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                this.originalImg = img;
                this.processedImg = null;
                this.upscaledImg = img;
                this.beautyProcessedImg = null;
                this.isBgRemoved = false;
                this.showBackground = false;

                this.initCanvas();
                this.render();
                this.updateCanvasSize();
                this.clearAllStickers();

                resolve();
            };
            img.onerror = reject;
            img.src = imgUrl;
        });
    }

    // Undo last action
    async undo() {
        if (this.lockedPosition) {
            alert("Posisi terkunci! Buka kunci terlebih dahulu untuk melakukan undo.");
            return;
        }
        
        if (this.undoStack.length === 0) {
            alert("Tidak ada aksi yang dapat di-undo!");
            return;
        }
        
        const currentState = {
            upscaledImg: this.upscaledImg ? this.upscaledImg.src : null,
            processedImg: this.processedImg ? this.processedImg.src : null,
            originalImg: this.originalImg ? this.originalImg.src : null,
            beautyProcessedImg: this.beautyProcessedImg ? this.beautyProcessedImg.src : null,
            isBgRemoved: this.isBgRemoved,
            showBackground: this.showBackground,
            currentQuality: this.currentQuality,
            currentScale: this.currentScale,
            currentFilter: this.currentFilter,
            canvasWidth: this.canvas ? this.canvas.width : 0,
            canvasHeight: this.canvas ? this.canvas.height : 0,
            stickers: JSON.parse(JSON.stringify(this.stickers.map(s => ({
                id: s.id,
                type: s.type,
                customUrl: s.customUrl,
                x: s.x,
                y: s.y,
                width: s.width,
                height: s.height
            }))))
        };
        this.redoStack.push(currentState);
        
        const prevState = this.undoStack.pop();
        await this.restoreState(prevState);
    }

    // Redo last undone action
    async redo() {
        if (this.lockedPosition) {
            alert("Posisi terkunci! Buka kunci terlebih dahulu untuk melakukan redo.");
            return;
        }
        
        if (this.redoStack.length === 0) {
            alert("Tidak ada aksi yang dapat di-redo!");
            return;
        }
        
        const currentState = {
            upscaledImg: this.upscaledImg ? this.upscaledImg.src : null,
            processedImg: this.processedImg ? this.processedImg.src : null,
            originalImg: this.originalImg ? this.originalImg.src : null,
            beautyProcessedImg: this.beautyProcessedImg ? this.beautyProcessedImg.src : null,
            isBgRemoved: this.isBgRemoved,
            showBackground: this.showBackground,
            currentQuality: this.currentQuality,
            currentScale: this.currentScale,
            currentFilter: this.currentFilter,
            canvasWidth: this.canvas ? this.canvas.width : 0,
            canvasHeight: this.canvas ? this.canvas.height : 0,
            stickers: JSON.parse(JSON.stringify(this.stickers.map(s => ({
                id: s.id,
                type: s.type,
                customUrl: s.customUrl,
                x: s.x,
                y: s.y,
                width: s.width,
                height: s.height
            }))))
        };
        this.undoStack.push(currentState);
        
        const redoState = this.redoStack.pop();
        await this.restoreState(redoState);
    }

    // Helper to restore state from saved data
    async restoreState(state) {
        if (!state) return;
        
        this.clearAllStickers();
        
        if (state.originalImg) {
            this.originalImg = new Image();
            await new Promise((resolve) => {
                this.originalImg.onload = resolve;
                this.originalImg.src = state.originalImg;
            });
        } else {
            this.originalImg = null;
        }
        
        if (state.processedImg) {
            this.processedImg = new Image();
            await new Promise((resolve) => {
                this.processedImg.onload = resolve;
                this.processedImg.src = state.processedImg;
            });
        } else {
            this.processedImg = null;
        }
        
        if (state.upscaledImg) {
            this.upscaledImg = new Image();
            await new Promise((resolve) => {
                this.upscaledImg.onload = resolve;
                this.upscaledImg.src = state.upscaledImg;
            });
        } else {
            this.upscaledImg = null;
        }
        
        if (state.beautyProcessedImg) {
            this.beautyProcessedImg = new Image();
            await new Promise((resolve) => {
                this.beautyProcessedImg.onload = resolve;
                this.beautyProcessedImg.src = state.beautyProcessedImg;
            });
        } else {
            this.beautyProcessedImg = null;
        }
        
        this.isBgRemoved = state.isBgRemoved;
        this.showBackground = state.showBackground || false;
        this.currentQuality = state.currentQuality;
        this.currentScale = state.currentScale;
        this.currentFilter = state.currentFilter;
        
        if (this.canvas) {
            this.canvas.width = state.canvasWidth;
            this.canvas.height = state.canvasHeight;
        }
        
        if (state.stickers) {
            for (const stickerData of state.stickers) {
                if (stickerData.customUrl) {
                    this.addSticker(stickerData.type, stickerData.customUrl, true);
                } else {
                    this.addSticker(stickerData.type, null, true);
                }
                const lastSticker = this.stickers[this.stickers.length - 1];
                if (lastSticker) {
                    lastSticker.x = stickerData.x;
                    lastSticker.y = stickerData.y;
                    lastSticker.width = stickerData.width;
                    lastSticker.height = stickerData.height;
                    if (lastSticker.element) {
                        lastSticker.element.style.left = `${stickerData.x}px`;
                        lastSticker.element.style.top = `${stickerData.y}px`;
                        lastSticker.element.style.width = `${stickerData.width}px`;
                        lastSticker.element.style.height = `${stickerData.height}px`;
                    }
                }
            }
        }
        
        this.updateResolutionInfo();
        this.updateButtonStyles();
        this.render();
        this.updateCanvasSize();
    }

    init() {
        this.getElements();
        this.initEventListeners();
        this.initStickerEvents();
        this.updateButtonStyles();
        console.log("✅ AI Studio Pro + Beauty Retouch + Before/After + Undo/Redo siap!");
    }

    getElements() {
        this.bgColorPicker = document.getElementById("bgColorPicker");
        this.bgImageInput = document.getElementById("bgImageInput");
        this.bgModeSelect = document.getElementById("bgMode");
        this.bgPreview = document.getElementById("bgPreview");

        this.uploadArea = document.getElementById('upload-area');
        this.canvasContainer = document.getElementById('canvas-container');
        this.loaderDiv = document.getElementById('loader');
        this.imageInput = document.getElementById('imageInput');

        this.shadowSlider = document.getElementById('shadowRange');
        this.smoothSlider = document.getElementById('smoothRange');
        this.zoomSlider = document.getElementById('zoomRange');
        this.beforeAfterSlider = document.getElementById('beforeAfterSlider');
        
        this.beautySkin = document.getElementById('beautySkin');
        this.beautyBrightness = document.getElementById('beautyBrightness');
        this.beautyContrast = document.getElementById('beautyContrast');
        this.beautySaturation = document.getElementById('beautySaturation');
        this.beautySharpness = document.getElementById('beautySharpness');
        this.applyBeautyBtn = document.getElementById('applyBeautyBtn');
        this.resetBeautyBtn = document.getElementById('resetBeautyBtn');
        
        this.undoBtn = document.getElementById('undoBtn');
        this.redoBtn = document.getElementById('redoBtn');
        
        if (this.shadowSlider) {
            const shadowVal = document.getElementById('shadowVal');
            if (shadowVal) {
                this.shadowSlider.addEventListener('input', (e) => {
                    shadowVal.innerText = `Intensity: ${e.target.value}`;
                });
            }
        }
    }

    initEventListeners() {

        const toggleBrush = document.getElementById("toggleSelectMode");
        if (toggleBrush) {
            toggleBrush.onclick = () => {
                this.isBrushActive = !this.isBrushActive;
                toggleBrush.textContent = this.isBrushActive ? "Matikan Brush" : "Aktifkan Brush";
            };
        }

        if (this.maskCanvas) {
            this.maskCanvas.addEventListener("mousedown", (e) => {
                if (!this.isBrushActive) return;
                this.isDrawing = true;
                this.drawMask(e);
            });

            this.maskCanvas.addEventListener("mousemove", (e) => {
                if (!this.isDrawing) return;
                this.drawMask(e);
            });
        }

        window.addEventListener("mouseup", () => {
            this.isDrawing = false;
        });
        
        if (this.uploadArea) {
            this.uploadArea.addEventListener('click', (e) => {
                if (e.target === this.uploadArea || e.target.closest('#upload-area')) {
                    if (this.imageInput) {
                        this.imageInput.click();
                    }
                }
            });
        }

        if (this.imageInput) {
            this.imageInput.addEventListener('change', (e) => {
                if (e.target.files && e.target.files[0]) {
                    this.handleImageUpload(e);
                }
            });
        }

        if (this.uploadArea) {
            this.uploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                this.uploadArea.classList.add('bg-blue-50');
            });

            this.uploadArea.addEventListener('dragleave', () => {
                this.uploadArea.classList.remove('bg-blue-50');
            });

            this.uploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                this.uploadArea.classList.remove('bg-blue-50');
                const file = e.dataTransfer.files[0];
                if (file && file.type.startsWith('image/')) {
                    this.processImageFile(file);
                }
            });
        }

        const removeBgBtn = document.getElementById('removeBgBtn');
        if (removeBgBtn) removeBgBtn.onclick = () => this.removeBackground();

        if (this.shadowSlider) this.shadowSlider.oninput = () => this.render();
        if (this.smoothSlider) this.smoothSlider.oninput = () => this.render();
        if (this.beforeAfterSlider) {
            this.beforeAfterSlider.oninput = () => this.render();
        }

        if (this.zoomSlider) {
            this.zoomSlider.oninput = (e) => {
                const scale = e.target.value / 100;
                if (this.canvas) {
                    this.canvas.style.transform = `scale(${scale})`;
                    this.canvas.style.transformOrigin = "center top";
                }
                this.stickers.forEach(s => {
                    if (s.element) {
                        s.element.style.transform = `scale(${scale})`;
                        s.element.style.transformOrigin = 'top left';
                    }
                });
            };
        }

        const generateBtn = document.getElementById('generateAIImage');
        const editBtn = document.getElementById('generateAIEdit');
        const aiPrompt = document.getElementById('aiPrompt');

        if (editBtn && aiPrompt) {
            editBtn.onclick = () => {
                const prompt = aiPrompt.value.trim();
                if (!this.originalImg) {
                    alert("Upload gambar dulu!");
                    return;
                }
                if (!prompt) {
                    alert("❌ Isi prompt dulu!");
                    return;
                }
                this.generateAIEdit(prompt);
            };
        }
        const promptInput = document.getElementById('promptInput');

        if (generateBtn && promptInput) {
            generateBtn.onclick = () => {
                const prompt = promptInput.value.trim();
                this.generateAIImage(prompt);
            };
        }

        const exportPNG = document.getElementById('exportPNG');
        const exportJPG = document.getElementById('exportJPG');
        const exportWEBP = document.getElementById('exportWEBP');
        if (exportPNG) exportPNG.onclick = () => this.downloadCanvas('image/png', 'image.png');
        if (exportJPG) exportJPG.onclick = () => this.downloadCanvas('image/jpeg', 'image.jpg');
        if (exportWEBP) exportWEBP.onclick = () => this.downloadCanvas('image/webp', 'image.webp');

        const flipHBtn = document.getElementById('flipHBtn');
        const flipVBtn = document.getElementById('flipVBtn');
        const rotateBtn = document.getElementById('rotateBtn');
        const expandCanvasBtn = document.getElementById('expandCanvasBtn');
        if (flipHBtn) flipHBtn.onclick = () => this.flip(true);
        if (flipVBtn) flipVBtn.onclick = () => this.flip(false);
        if (rotateBtn) rotateBtn.onclick = () => this.rotate();
        if (expandCanvasBtn) expandCanvasBtn.onclick = () => this.expandCanvas();

        const lockBtn = document.getElementById('lockPositionBtn');
        if (lockBtn) lockBtn.onclick = () => this.toggleLock();

        if (this.undoBtn) this.undoBtn.onclick = () => this.undo();
        if (this.redoBtn) this.redoBtn.onclick = () => this.redo();

        const btnStandard = document.getElementById('btnStandard');
        const btnHD = document.getElementById('btnHD');
        const btnUltra = document.getElementById('btnUltra');
        if (btnStandard) btnStandard.onclick = () => this.setQuality('standard');
        if (btnHD) btnHD.onclick = () => this.setQuality('hd');
        if (btnUltra) btnUltra.onclick = () => this.setQuality('ultra');

        if (this.applyBeautyBtn) this.applyBeautyBtn.onclick = () => this.applyBeautyRetouch();
        if (this.resetBeautyBtn) this.resetBeautyBtn.onclick = () => this.resetBeauty();

        const colorFilterBtn = document.getElementById('colorFilterBtn');
        const changeBgBtn = document.getElementById('changeBgBtn');

        if (this.bgModeSelect) {
            this.bgModeSelect.onchange = (e) => {
                this.bgMode = e.target.value;
                if (this.bgMode === "image") {
                    if (this.bgColorPicker) {
                        this.bgColorPicker.disabled = true;
                        this.bgColorPicker.style.opacity = 0.5;
                    }
                    if (this.bgImageInput) {
                        this.bgImageInput.disabled = false;
                    }
                }
                if (this.bgMode === "color") {
                    if (this.bgColorPicker) {
                        this.bgColorPicker.disabled = false;
                        this.bgColorPicker.style.opacity = 1;
                    }
                    if (this.bgImageInput) {
                        this.bgImageInput.disabled = true;
                    }
                }
            };
        }

        if (this.bgColorPicker) {
            this.bgColorPicker.oninput = (e) => {
                this.backgroundColor = e.target.value;
                if (this.bgPreview) {
                    this.bgPreview.style.backgroundColor = this.backgroundColor;
                    this.bgPreview.innerHTML = "Warna dipilih";
                }
                if (this.isBgRemoved && this.showBackground) {
                    this.render();
                }
            };
        }

        if (this.bgImageInput) {
            this.bgImageInput.onchange = (e) => {
                if (this.bgMode !== "image") return;
                const file = e.target.files[0];
                if (!file) {
                    this.backgroundImg = null;
                    if (this.bgPreview) {
                        this.bgPreview.style.backgroundImage = "";
                        this.bgPreview.innerHTML = "Preview Background";
                    }
                    return;
                }
                const img = new Image();
                img.onload = () => {
                    this.backgroundImg = img;
                    if (this.bgPreview) {
                        this.bgPreview.style.backgroundImage = `url(${img.src})`;
                        this.bgPreview.style.backgroundSize = "cover";
                        this.bgPreview.innerHTML = "";
                    }
                    if (this.isBgRemoved && this.showBackground) {
                        this.render();
                    }
                };
                img.src = URL.createObjectURL(file);
            };
        }
        
        if (colorFilterBtn) colorFilterBtn.onclick = () => this.cycleFilters();
        
        if (changeBgBtn) {
            changeBgBtn.onclick = () => {
                if (!this.isBgRemoved) {
                    alert("⚠️ Hapus background terlebih dahulu menggunakan tombol 'Remove Background'!");
                    return;
                }
                if (!this.processedImg && !this.upscaledImg) {
                    alert("⚠️ Tidak ada gambar yang diproses!");
                    return;
                }
                this.showBackground = true;
                if (this.bgMode === "color") {
                    if (this.bgColorPicker) {
                        this.backgroundColor = this.bgColorPicker.value;
                    }
                    this.render();
                    alert(`✅ Background berhasil diganti dengan warna: ${this.backgroundColor}`);
                }
                if (this.bgMode === "image") {
                    if (!this.backgroundImg) {
                        alert("📁 Silakan pilih gambar background terlebih dahulu!");
                        this.bgImageInput.click();
                        return;
                    }
                    this.render();
                    alert("✅ Background berhasil diganti dengan gambar!");
                }
            };
        }
        
        const clearStickersBtn = document.getElementById('clearStickersBtn');
        if (clearStickersBtn) clearStickersBtn.onclick = () => this.clearAllStickers();
        
        const customSticker = document.getElementById('customSticker');
        if (customSticker) {
            customSticker.addEventListener('change', (e) => {
                if (e.target.files[0]) this.addSticker('custom', URL.createObjectURL(e.target.files[0]));
            });
        }
        
        const videoDuration = document.getElementById('videoDuration');
        if (videoDuration) {
            videoDuration.addEventListener('input', (e) => {
                const durationValue = document.getElementById('durationValue');
                if (durationValue) durationValue.innerText = `${e.target.value} detik`;
            });
        }
        
        const createVideoBtn = document.getElementById('createVideoBtn');
        if (createVideoBtn) createVideoBtn.onclick = () => this.createVideo();
        
        const exportVideoBtn = document.getElementById('exportVideoBtn');
        if (exportVideoBtn) exportVideoBtn.onclick = () => this.exportVideo();

        const clearMask = document.getElementById("clearMask");
        if (clearMask) {
            clearMask.onclick = () => {
                if (!this.maskCtx) return;
                this.maskCtx.clearRect(0, 0, this.maskCanvas.width, this.maskCanvas.height);
            };
        }
        
        window.addEventListener('resize', () => this.updateCanvasSize());
    }

    async handleImageUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        await this.processImageFile(file);
    }

    async processImageFile(file) {
        if (this.uploadArea) this.uploadArea.classList.add('hidden');
        if (this.canvasContainer) this.canvasContainer.classList.add('hidden');
        if (this.loaderDiv) this.loaderDiv.classList.remove('hidden');

        try {
            const url = URL.createObjectURL(file);
            this.originalImg = new Image();
            
            await new Promise((resolve, reject) => {
                this.originalImg.onload = resolve;
                this.originalImg.onerror = reject;
                this.originalImg.src = url;
            });
            
            this.processedImg = null;
            this.upscaledImg = this.originalImg;
            this.beautyProcessedImg = null;
            this.isBgRemoved = false;
            this.showBackground = false;
            
            if (this.beautySkin) this.beautySkin.value = 0;
            if (this.beautyBrightness) this.beautyBrightness.value = 100;
            if (this.beautyContrast) this.beautyContrast.value = 100;
            if (this.beautySaturation) this.beautySaturation.value = 100;
            if (this.beautySharpness) this.beautySharpness.value = 0;
            
            this.beautySettings = {
                skin: 0, brightness: 100, contrast: 100, saturation: 100, sharpness: 0
            };
            
            this.initCanvas();
            if (this.maskCtx) {
                this.maskCtx.clearRect(0, 0, this.maskCanvas.width, this.maskCanvas.height);
            }
            if (this.canvasContainer) this.canvasContainer.classList.remove('hidden');
            if (this.uploadArea) this.uploadArea.classList.add('hidden');
            
            const removeBgBtn = document.getElementById('removeBgBtn');
            if (removeBgBtn) {
                removeBgBtn.disabled = false;
                removeBgBtn.textContent = '🪄 Remove Background';
                removeBgBtn.classList.remove('bg-gray-400');
                removeBgBtn.classList.add('bg-purple-600', 'hover:bg-purple-700');
            }
            
            this.updateResolutionInfo();
            this.render();
            this.clearAllStickers();
            
            if (this.loaderDiv) this.loaderDiv.classList.add('hidden');
            this.saveToUndo();

        } catch (error) {
            console.error(error);
            alert("❌ Gagal memuat gambar.");
            if (this.loaderDiv) this.loaderDiv.classList.add('hidden');
            if (this.uploadArea) this.uploadArea.classList.remove('hidden');
        }
    }

    async removeBackgroundFromImage(file) {
        const formData = new FormData();
        formData.append("image_file", file);
        formData.append("size", "auto");

        const response = await fetch("https://api.remove.bg/v1.0/removebg", {
            method: "POST",
            headers: {
                "X-Api-Key": this.API_KEY
            },
            body: formData
        });

        if (!response.ok) {
            throw new Error("API Error: " + response.status);
        }

        return await response.blob();
    }

    async removeBackground() {
        if (!this.originalImg) {
            alert("Upload gambar dulu ya!");
            return;
        }
        
        if (this.lockedPosition) {
            alert("Posisi terkunci! Buka kunci terlebih dahulu untuk menghapus background.");
            return;
        }
        
        if (this.isBgRemoved) {
            alert("Background sudah dihapus! Upload gambar baru jika ingin menghapus ulang.");
            return;
        }
        
        this.saveToUndo();
        
        if (this.loaderDiv) this.loaderDiv.classList.remove('hidden');
        const removeBgBtn = document.getElementById('removeBgBtn');
        if (removeBgBtn) {
            removeBgBtn.disabled = true;
            removeBgBtn.textContent = '⏳ Memproses...';
        }
        
        try {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = this.originalImg.width;
            tempCanvas.height = this.originalImg.height;
            const tempCtx = tempCanvas.getContext('2d');
            
            tempCtx.drawImage(this.originalImg, 0, 0, this.originalImg.width, this.originalImg.height);
            
            const blob = await new Promise(resolve => {
                tempCanvas.toBlob(resolve, 'image/png');
            });
            
            if (!blob) {
                throw new Error("Gagal konversi gambar ke blob");
            }
            
            const resultBlob = await this.removeBackgroundFromImage(blob);
            const processedUrl = URL.createObjectURL(resultBlob);
            
            this.processedImg = new Image();
            await new Promise((resolve, reject) => {
                this.processedImg.onload = resolve;
                this.processedImg.onerror = reject;
                this.processedImg.src = processedUrl;
            });
            
            this.upscaledImg = this.processedImg;
            this.beautyProcessedImg = null;
            this.isBgRemoved = true;
            this.showBackground = false;
            this.currentQuality = 'standard';
            this.currentScale = 1;
            
            this.canvas.width = this.processedImg.width;
            this.canvas.height = this.processedImg.height;
            
            if (this.maskCanvas) {
                this.maskCanvas.width = this.processedImg.width;
                this.maskCanvas.height = this.processedImg.height;
                if (this.maskCtx) {
                    this.maskCtx.clearRect(0, 0, this.maskCanvas.width, this.maskCanvas.height);
                }
            }
            
            if (this.loaderDiv) this.loaderDiv.classList.add('hidden');
            if (removeBgBtn) {
                removeBgBtn.disabled = false;
                removeBgBtn.textContent = '✅ Background Removed';
                removeBgBtn.classList.remove('bg-purple-600', 'hover:bg-purple-700');
                removeBgBtn.classList.add('bg-green-600');
            }
            
            this.updateResolutionInfo();
            this.render();
            this.updateButtonStyles();
            this.updateCanvasSize();
            
        } catch (err) {
            console.error(err);
            alert("Gagal menghapus background: " + err.message);
            if (this.loaderDiv) this.loaderDiv.classList.add('hidden');
            if (removeBgBtn) {
                removeBgBtn.disabled = false;
                removeBgBtn.textContent = '🪄 Remove Background';
            }
        }
    }

    async applyBeautyRetouch() {
        const sourceImg = this.upscaledImg || this.originalImg;
        if (!sourceImg) {
            alert("Upload gambar dulu ya!");
            return;
        }
        
        if (this.lockedPosition) {
            alert("Posisi terkunci! Buka kunci terlebih dahulu untuk melakukan beauty retouch.");
            return;
        }
        
        this.saveToUndo();
        
        if (this.loaderDiv) this.loaderDiv.classList.remove('hidden');
        
        this.beautySettings = {
            skin: parseInt(this.beautySkin?.value) || 0,
            brightness: parseInt(this.beautyBrightness?.value) || 100,
            contrast: parseInt(this.beautyContrast?.value) || 100,
            saturation: parseInt(this.beautySaturation?.value) || 100,
            sharpness: parseInt(this.beautySharpness?.value) || 0
        };
        
        try {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = sourceImg.width;
            tempCanvas.height = sourceImg.height;
            const tempCtx = tempCanvas.getContext('2d');
            
            tempCtx.drawImage(sourceImg, 0, 0);
            
            let imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
            let data = imageData.data;
            
            const brightness = this.beautySettings.brightness / 100;
            const contrast = this.beautySettings.contrast / 100;
            const saturation = this.beautySettings.saturation / 100;
            
            for (let i = 0; i < data.length; i += 4) {
                let r = data[i];
                let g = data[i+1];
                let b = data[i+2];
                
                let factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
                r = factor * (r - 128) + 128;
                g = factor * (g - 128) + 128;
                b = factor * (b - 128) + 128;
                
                r = r * brightness;
                g = g * brightness;
                b = b * brightness;
                
                const gray = 0.2989 * r + 0.5870 * g + 0.1140 * b;
                r = gray + (r - gray) * saturation;
                g = gray + (g - gray) * saturation;
                b = gray + (b - gray) * saturation;
                
                data[i] = Math.min(255, Math.max(0, r));
                data[i+1] = Math.min(255, Math.max(0, g));
                data[i+2] = Math.min(255, Math.max(0, b));
            }
            
            tempCtx.putImageData(imageData, 0, 0);
            
            if (this.beautySettings.skin > 0) {
                const blurAmount = this.beautySettings.skin / 50;
                tempCtx.filter = `blur(${blurAmount}px)`;
                tempCtx.drawImage(tempCanvas, 0, 0);
                tempCtx.filter = 'none';
            }
            
            if (this.beautySettings.sharpness > 0) {
                const sharpImageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
                const sharpData = sharpImageData.data;
                const sharpAmount = this.beautySettings.sharpness / 50;
                
                for (let i = 0; i < sharpData.length; i += 4) {
                    if (i + 4 < sharpData.length) {
                        sharpData[i] = Math.min(255, Math.max(0, sharpData[i] + (sharpData[i] - sharpData[i+4]) * sharpAmount));
                        sharpData[i+1] = Math.min(255, Math.max(0, sharpData[i+1] + (sharpData[i+1] - sharpData[i+5]) * sharpAmount));
                        sharpData[i+2] = Math.min(255, Math.max(0, sharpData[i+2] + (sharpData[i+2] - sharpData[i+6]) * sharpAmount));
                    }
                }
                tempCtx.putImageData(sharpImageData, 0, 0);
            }
            
            const beautyUrl = tempCanvas.toDataURL();
            this.beautyProcessedImg = new Image();
            
            await new Promise((resolve, reject) => {
                this.beautyProcessedImg.onload = resolve;
                this.beautyProcessedImg.onerror = reject;
                this.beautyProcessedImg.src = beautyUrl;
            });
            
            this.upscaledImg = this.beautyProcessedImg;
            this.canvas.width = this.upscaledImg.width;
            this.canvas.height = this.upscaledImg.height;
            
            if (this.loaderDiv) this.loaderDiv.classList.add('hidden');
            this.render();
            this.updateCanvasSize();
            
            const btn = this.applyBeautyBtn;
            const originalText = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-check"></i> Applied!';
            setTimeout(() => {
                btn.innerHTML = originalText;
            }, 1500);
            
        } catch (err) {
            console.error(err);
            alert("Gagal menerapkan beauty retouch: " + err.message);
            if (this.loaderDiv) this.loaderDiv.classList.add('hidden');
        }
    }
    
    resetBeauty() {
        if (this.lockedPosition) {
            alert("Posisi terkunci! Buka kunci terlebih dahulu untuk reset beauty.");
            return;
        }
        
        this.saveToUndo();
        
        if (this.beautySkin) this.beautySkin.value = 0;
        if (this.beautyBrightness) this.beautyBrightness.value = 100;
        if (this.beautyContrast) this.beautyContrast.value = 100;
        if (this.beautySaturation) this.beautySaturation.value = 100;
        if (this.beautySharpness) this.beautySharpness.value = 0;
        
        this.beautySettings = {
            skin: 0, brightness: 100, contrast: 100, saturation: 100, sharpness: 0
        };
        
        const sourceImg = this.isBgRemoved ? this.processedImg : this.originalImg;
        if (sourceImg) {
            this.upscaledImg = sourceImg;
            this.beautyProcessedImg = null;
            this.canvas.width = this.upscaledImg.width;
            this.canvas.height = this.upscaledImg.height;
            this.render();
            this.updateCanvasSize();
        }
        
        const btn = this.resetBeautyBtn;
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-check"></i> Reset!';
        setTimeout(() => {
            btn.innerHTML = originalText;
        }, 1000);
    }

    initCanvas() {
        const imgToShow = this.upscaledImg || this.originalImg;
        if (!imgToShow || !this.canvas) return;
        
        this.canvas.width = imgToShow.width;
        this.canvas.height = imgToShow.height;
        this.updateCanvasSize();
        if (this.maskCanvas) {
            this.maskCanvas.width = this.canvas.width;
            this.maskCanvas.height = this.canvas.height;
            this.maskCanvas.style.width = this.canvas.style.width;
            this.maskCanvas.style.height = this.canvas.style.height;
        }
    }

    updateCanvasSize() {
        const imgToShow = this.upscaledImg || this.originalImg;
        if (!imgToShow || !this.canvasContainer || !this.canvas) return;
        
        const containerWidth = this.canvasContainer.parentElement ? 
            this.canvasContainer.parentElement.clientWidth - 40 : 800;
        const ratio = Math.min(1, containerWidth / imgToShow.width);
        this.canvas.style.width = `${imgToShow.width * ratio}px`;
        this.canvas.style.height = `${imgToShow.height * ratio}px`;
        if (this.stickerContainer) {
            this.stickerContainer.style.width = `${imgToShow.width * ratio}px`;
            this.stickerContainer.style.height = `${imgToShow.height * ratio}px`;
        }
    }

    render() {
        const imgToShow = this.upscaledImg || this.originalImg;
        if (!imgToShow || !this.ctx) return;
        
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        if (this.isBgRemoved && this.showBackground) {
            if (this.bgMode === "color") {
                this.ctx.fillStyle = this.backgroundColor;
                this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            }
            if (this.bgMode === "image" && this.backgroundImg) {
                this.ctx.drawImage(this.backgroundImg, 0, 0, this.canvas.width, this.canvas.height);
            }
        }
        
        const shadow = this.shadowSlider ? parseInt(this.shadowSlider.value) : 0;
        const smooth = this.smoothSlider ? parseInt(this.smoothSlider.value) : 0;
        
        const beforeImg = this.processedImg;
        const afterImg = this.upscaledImg;
        
        const splitRatio = this.beforeAfterSlider ? (this.beforeAfterSlider.value / 100) : 1;
        const showSplit = splitRatio < 1 && splitRatio > 0;
        
        if (showSplit && beforeImg && afterImg && beforeImg !== afterImg) {
            this.ctx.save();
            this.ctx.beginPath();
            this.ctx.rect(0, 0, this.canvas.width * splitRatio, this.canvas.height);
            this.ctx.clip();
            this.ctx.drawImage(beforeImg, 0, 0, this.canvas.width, this.canvas.height);
            this.ctx.restore();
            
            this.ctx.save();
            this.ctx.beginPath();
            this.ctx.rect(this.canvas.width * splitRatio, 0, this.canvas.width - (this.canvas.width * splitRatio), this.canvas.height);
            this.ctx.clip();
            if (shadow > 0) {
                this.ctx.shadowColor = "rgba(0,0,0,0.3)";
                this.ctx.shadowBlur = shadow;
                this.ctx.shadowOffsetX = 3;
                this.ctx.shadowOffsetY = 3;
            }
            this.ctx.filter = `blur(${smooth / 10}px)`;
            this.ctx.drawImage(afterImg, 0, 0, this.canvas.width, this.canvas.height);
            this.ctx.filter = 'none';
            this.ctx.shadowBlur = 0;
            this.ctx.restore();
            
            this.ctx.beginPath();
            this.ctx.moveTo(this.canvas.width * splitRatio, 0);
            this.ctx.lineTo(this.canvas.width * splitRatio, this.canvas.height);
            this.ctx.strokeStyle = 'white';
            this.ctx.lineWidth = 3;
            this.ctx.stroke();
            this.ctx.beginPath();
            this.ctx.moveTo(this.canvas.width * splitRatio - 1, 0);
            this.ctx.lineTo(this.canvas.width * splitRatio - 1, this.canvas.height);
            this.ctx.strokeStyle = '#3b82f6';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
        } else {
            if (shadow > 0) {
                this.ctx.shadowColor = "rgba(0,0,0,0.3)";
                this.ctx.shadowBlur = shadow;
                this.ctx.shadowOffsetX = 3;
                this.ctx.shadowOffsetY = 3;
            }
            this.ctx.filter = `blur(${smooth / 10}px)`;
            this.ctx.drawImage(afterImg, 0, 0, this.canvas.width, this.canvas.height);
            this.ctx.filter = 'none';
            this.ctx.shadowBlur = 0;
        }
        
        if (this.currentFilter !== 'none' && (!showSplit || splitRatio === 1)) {
            this.ctx.filter = this.currentFilter;
            this.ctx.drawImage(this.canvas, 0, 0);
            this.ctx.filter = 'none';
        }
    }

    // ===================== UPSCALE METHOD DENGAN KUALITAS TINGGI =====================
    async upscale(img, scale) {
        const canvas = document.createElement('canvas');
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const tempCtx = canvas.getContext('2d');
        
        // Enable high-quality scaling
        tempCtx.imageSmoothingEnabled = true;
        tempCtx.imageSmoothingQuality = "high";
        
        tempCtx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const newImg = new Image();
        newImg.src = canvas.toDataURL();
        return new Promise(resolve => { newImg.onload = () => resolve(newImg); });
    }

    // ===================== SHARPENING METHOD YANG LEBIH KUAT =====================
    async applySharpening(img, strength) {
        return new Promise((resolve) => {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = img.width;
            tempCanvas.height = img.height;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.drawImage(img, 0, 0);
            
            const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
            const data = imageData.data;
            const width = tempCanvas.width;
            const height = tempCanvas.height;
            
            // Sharpening dengan kernel yang lebih baik (unsharp mask)
            for (let y = 1; y < height - 1; y++) {
                for (let x = 1; x < width - 1; x++) {
                    const idx = (y * width + x) * 4;
                    const leftIdx = (y * width + (x - 1)) * 4;
                    const rightIdx = (y * width + (x + 1)) * 4;
                    const topIdx = ((y - 1) * width + x) * 4;
                    const bottomIdx = ((y + 1) * width + x) * 4;
                    const topLeftIdx = ((y - 1) * width + (x - 1)) * 4;
                    const topRightIdx = ((y - 1) * width + (x + 1)) * 4;
                    const bottomLeftIdx = ((y + 1) * width + (x - 1)) * 4;
                    const bottomRightIdx = ((y + 1) * width + (x + 1)) * 4;
                    
                    for (let c = 0; c < 3; c++) {
                        const center = data[idx + c];
                        const left = data[leftIdx + c];
                        const right = data[rightIdx + c];
                        const top = data[topIdx + c];
                        const bottom = data[bottomIdx + c];
                        const topLeft = data[topLeftIdx + c];
                        const topRight = data[topRightIdx + c];
                        const bottomLeft = data[bottomLeftIdx + c];
                        const bottomRight = data[bottomRightIdx + c];
                        
                        // Kernel sharper (lebih banyak neighbor)
                        const average = (left + right + top + bottom + topLeft + topRight + bottomLeft + bottomRight) / 8;
                        let sharpened = center + (center - average) * strength;
                        
                        data[idx + c] = Math.min(255, Math.max(0, sharpened));
                    }
                }
            }
            tempCtx.putImageData(imageData, 0, 0);
            
            const sharpenedImg = new Image();
            sharpenedImg.onload = () => resolve(sharpenedImg);
            sharpenedImg.src = tempCanvas.toDataURL();
        });
    }

    // ===================== SET QUALITY METHOD (DIPERBAIKI) =====================
    async setQuality(quality) {
        if (!this.originalImg) {
            alert("Upload gambar dulu ya!");
            return;
        }
        
        if (this.lockedPosition) {
            alert("Posisi terkunci! Buka kunci terlebih dahulu untuk mengubah kualitas.");
            return;
        }
        
        this.saveToUndo();
        
        if (this.loaderDiv) this.loaderDiv.classList.remove('hidden');
        
        const sourceImg = (this.isBgRemoved && this.processedImg) ? this.processedImg : this.originalImg;
        
        // Simpan before image untuk perbandingan
        if (!this.isBgRemoved) {
            this.processedImg = sourceImg;
        }
        
        this.currentQuality = quality;
        
        if (quality === 'standard') {
            // STANDARD: Resolusi asli, tanpa upscale, ketajaman normal
            this.currentScale = 1;
            this.upscaledImg = sourceImg;
            
        } else if (quality === 'hd') {
            // HD: 2x upscale + sharpening strength 0.8 (lebih tajam dari sebelumnya)
            this.currentScale = 2;
            this.upscaledImg = await this.upscale(sourceImg, 2);
            this.upscaledImg = await this.applySharpening(this.upscaledImg, 0.8);
            
        } else if (quality === 'ultra') {
            // ULTRA: 4x upscale + sharpening strength 1.5 (sangat tajam dan jernih)
            this.currentScale = 4;
            this.upscaledImg = await this.upscale(sourceImg, 4);
            this.upscaledImg = await this.applySharpening(this.upscaledImg, 1.5);
            // Tambahan sharpening kedua untuk ultra
            this.upscaledImg = await this.applySharpening(this.upscaledImg, 0.5);
        }
        
        this.beautyProcessedImg = null;
        
        if (this.upscaledImg && this.canvas) {
            this.canvas.width = this.upscaledImg.width;
            this.canvas.height = this.upscaledImg.height;
            this.updateCanvasSize();
        }
        
        if (this.loaderDiv) this.loaderDiv.classList.add('hidden');
        this.updateResolutionInfo();
        this.render();
        this.updateButtonStyles();
    }

    updateResolutionInfo() {
        if (!this.originalImg) return;
        
        const resInfo = document.getElementById('resolutionInfo');
        if (!resInfo) return;
        
        if (!this.isBgRemoved) {
            let currentRes = '';
            let qualityText = '';
            if (this.currentQuality === 'standard') {
                currentRes = `${this.originalImg.width}x${this.originalImg.height}`;
                qualityText = 'Standard (Original)';
            } else if (this.currentQuality === 'hd') {
                currentRes = `${this.originalImg.width*2}x${this.originalImg.height*2}`;
                qualityText = 'HD 2x (Sharpened)';
            } else {
                currentRes = `${this.originalImg.width*4}x${this.originalImg.height*4}`;
                qualityText = 'Ultra 4x (Super Sharp)';
            }
            resInfo.innerHTML = `📷 Original: ${this.originalImg.width}x${this.originalImg.height}<br>✨ ${qualityText}: ${currentRes}`;
            return;
        }
        
        if (this.processedImg) {
            let currentRes = '';
            let qualityText = '';
            if (this.currentQuality === 'standard') {
                currentRes = `${this.processedImg.width}x${this.processedImg.height}`;
                qualityText = 'Standard (Original)';
            } else if (this.currentQuality === 'hd') {
                currentRes = `${this.processedImg.width*2}x${this.processedImg.height*2}`;
                qualityText = 'HD 2x (Sharpened)';
            } else {
                currentRes = `${this.processedImg.width*4}x${this.processedImg.height*4}`;
                qualityText = 'Ultra 4x (Super Sharp)';
            }
            const bgStatus = this.showBackground ? "🎨 Background Aktif" : "✨ Transparan (klik Ganti Background)";
            resInfo.innerHTML = `✅ Background Terhapus!<br>📐 ${qualityText}: ${currentRes}<br>${bgStatus}`;
        }
    }

    updateButtonStyles() {
        const btnStandard = document.getElementById('btnStandard');
        const btnHD = document.getElementById('btnHD');
        const btnUltra = document.getElementById('btnUltra');
        
        if (btnStandard) {
            btnStandard.className = this.currentQuality === 'standard' 
                ? 'bg-green-500 text-white px-2 py-1 rounded text-sm font-bold' 
                : 'bg-gray-200 px-2 py-1 rounded text-sm';
        }
        if (btnHD) {
            btnHD.className = this.currentQuality === 'hd' 
                ? 'bg-blue-500 text-white px-2 py-1 rounded text-sm font-bold' 
                : 'bg-gray-200 px-2 py-1 rounded text-sm';
        }
        if (btnUltra) {
            btnUltra.className = this.currentQuality === 'ultra' 
                ? 'bg-purple-500 text-white px-2 py-1 rounded text-sm font-bold' 
                : 'bg-gray-200 px-2 py-1 rounded text-sm';
        }
    }

    toggleLock() {
        this.lockedPosition = !this.lockedPosition;
        const lockBtn = document.getElementById('lockPositionBtn');
        if (lockBtn) {
            lockBtn.innerHTML = this.lockedPosition ? 
                '<i class="fas fa-lock"></i> Posisi Terkunci' : 
                '<i class="fas fa-lock-open"></i> Kunci Posisi';
            lockBtn.classList.toggle('bg-gray-700', this.lockedPosition);
            lockBtn.classList.toggle('bg-gray-500', !this.lockedPosition);
        }
        
        if (this.undoBtn) this.undoBtn.disabled = this.lockedPosition;
        if (this.redoBtn) this.redoBtn.disabled = this.lockedPosition;
        
        alert(this.lockedPosition ? "🔒 Posisi dikunci - tidak dapat mengedit" : "🔓 Posisi dibuka - dapat mengedit");
    }

    async flip(horizontal) {
        if (this.lockedPosition) {
            alert("Posisi terkunci! Buka kunci terlebih dahulu.");
            return;
        }
        
        this.saveToUndo();
        
        const imgToFlip = this.upscaledImg || this.originalImg;
        if (!imgToFlip) return;
        
        const temp = document.createElement('canvas');
        temp.width = this.canvas.width;
        temp.height = this.canvas.height;
        const tempCtx = temp.getContext('2d');
        
        if (horizontal) {
            tempCtx.translate(temp.width, 0);
            tempCtx.scale(-1, 1);
        } else {
            tempCtx.translate(0, temp.height);
            tempCtx.scale(1, -1);
        }
        
        tempCtx.drawImage(this.canvas, 0, 0);
        
        const newImg = new Image();
        newImg.onload = () => {
            if (this.isBgRemoved && this.processedImg) {
                this.processedImg = newImg;
                this.upscaledImg = newImg;
            } else {
                this.originalImg = newImg;
                this.upscaledImg = newImg;
            }
            this.canvas.width = newImg.width;
            this.canvas.height = newImg.height;
            this.render();
        };
        newImg.src = temp.toDataURL();
    }

    async rotate() {
        if (this.lockedPosition) {
            alert("Posisi terkunci! Buka kunci terlebih dahulu.");
            return;
        }
        
        this.saveToUndo();
        
        const imgToRotate = this.upscaledImg || this.originalImg;
        if (!imgToRotate) return;
        
        const temp = document.createElement('canvas');
        temp.width = this.canvas.height;
        temp.height = this.canvas.width;
        
        const tempCtx = temp.getContext('2d');
        tempCtx.translate(temp.width / 2, temp.height / 2);
        tempCtx.rotate(Math.PI / 2);
        tempCtx.drawImage(this.canvas, -this.canvas.width / 2, -this.canvas.height / 2);
        
        const newImg = new Image();
        newImg.onload = () => {
            if (this.isBgRemoved && this.processedImg) {
                this.processedImg = newImg;
                this.upscaledImg = newImg;
            } else {
                this.originalImg = newImg;
                this.upscaledImg = newImg;
            }
            this.canvas.width = newImg.width;
            this.canvas.height = newImg.height;
            this.render();
        };
        newImg.src = temp.toDataURL();
    }

    async expandCanvas() {
        if (this.lockedPosition) {
            alert("Posisi terkunci! Buka kunci terlebih dahulu.");
            return;
        }
        
        this.saveToUndo();
        
        const temp = document.createElement('canvas');
        temp.width = this.canvas.width + 200;
        temp.height = this.canvas.height;
        
        const tempCtx = temp.getContext('2d');
        tempCtx.fillStyle = '#ffffff';
        tempCtx.fillRect(0, 0, temp.width, temp.height);
        tempCtx.drawImage(this.canvas, 100, 0);
        
        const newImg = new Image();
        newImg.onload = () => {
            if (this.isBgRemoved && this.processedImg) {
                this.processedImg = newImg;
                this.upscaledImg = newImg;
            } else {
                this.originalImg = newImg;
                this.upscaledImg = newImg;
            }
            this.canvas.width = newImg.width;
            this.canvas.height = newImg.height;
            this.render();
        };
        newImg.src = temp.toDataURL();
    }

    cycleFilters() {
        if (this.lockedPosition) {
            alert("Posisi terkunci! Buka kunci terlebih dahulu untuk mengubah filter.");
            return;
        }
        
        const filters = ['none', 'grayscale(1)', 'sepia(1)', 'invert(1)', 'brightness(1.3)', 'contrast(1.3)'];
        let i = filters.indexOf(this.currentFilter);
        this.currentFilter = filters[(i + 1) % filters.length];
        
        const filterBtn = document.getElementById('colorFilterBtn');
        if (filterBtn) {
            const filterNames = ['Filter Warna', 'Grayscale', 'Sepia', 'Invert', 'Brightness', 'Contrast'];
            filterBtn.innerHTML = `<i class="fas fa-palette"></i> ${filterNames[(i + 1) % filters.length]}`;
        }
        
        this.render();
    }

    downloadCanvas(type, filename) {
        const imgToDownload = this.upscaledImg || this.originalImg;
        if (!imgToDownload) {
            alert("Tidak ada gambar untuk di-download!");
            return;
        }
        
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.canvas.width;
        tempCanvas.height = this.canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        tempCtx.drawImage(this.canvas, 0, 0);
        
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        this.stickers.forEach(s => {
            if (s.element) {
                const stickerRect = s.element.getBoundingClientRect();
                const canvasRect = this.canvasContainer ? this.canvasContainer.getBoundingClientRect() : this.canvas.getBoundingClientRect();
                
                const relativeLeft = stickerRect.left - canvasRect.left;
                const relativeTop = stickerRect.top - canvasRect.top;
                
                const x = relativeLeft * scaleX;
                const y = relativeTop * scaleY;
                const width = stickerRect.width * scaleX;
                const height = stickerRect.height * scaleY;
                
                if (s.customUrl) {
                    const img = new Image();
                    img.src = s.customUrl;
                    try {
                        tempCtx.drawImage(img, x, y, width, height);
                    } catch(e) {
                        console.log("Gagal render stiker gambar");
                    }
                } else if (s.type && s.type !== 'custom') {
                    tempCtx.font = `${Math.min(70, width)}px "Segoe UI Emoji"`;
                    tempCtx.textAlign = "center";
                    tempCtx.textBaseline = "middle";
                    tempCtx.fillText(s.type, x + width/2, y + height/2);
                }
            }
        });
        
        const link = document.createElement('a');
        link.download = filename;
        link.href = tempCanvas.toDataURL(type, 0.95);
        link.click();
    }

    initStickerEvents() {
        const stickerItems = document.querySelectorAll('.sticker-item');
        stickerItems.forEach(el => {
            el.addEventListener('click', () => this.addSticker(el.getAttribute('data-sticker')));
        });
    }

    addSticker(type, customUrl = null, skipSave = false) {
        if (this.lockedPosition) {
            alert("Posisi terkunci! Buka kunci terlebih dahulu untuk menambah stiker.");
            return;
        }
        
        if (!skipSave) this.saveToUndo();
        
        if (!this.upscaledImg && !this.originalImg) {
            alert("Upload gambar dulu ya!");
            return;
        }
        
        if (!this.stickerContainer) {
            console.error("Sticker container not found");
            return;
        }
        
        const canvasRect = this.canvas.getBoundingClientRect();
        const id = Date.now();
        const div = document.createElement('div');
        div.className = 'sticker-element';
        div.id = `sticker-${id}`;
        
        const posX = (canvasRect.width / 2) - 40;
        const posY = (canvasRect.height / 2) - 40;
        
        div.style.left = `${posX}px`;
        div.style.top = `${posY}px`;
        div.style.width = '70px';
        div.style.height = '70px';
        
        if (customUrl) {
            const img = document.createElement('img');
            img.src = customUrl;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'contain';
            div.appendChild(img);
        } else {
            const span = document.createElement('span');
            span.textContent = type;
            span.style.fontSize = '50px';
            span.style.display = 'block';
            span.style.textAlign = 'center';
            span.style.lineHeight = '70px';
            div.appendChild(span);
        }
        
        const del = document.createElement('div');
        del.className = 'delete-sticker';
        del.innerHTML = '×';
        del.onclick = (e) => { 
            e.stopPropagation(); 
            this.removeSticker(id); 
        };
        div.appendChild(del);
        
        const resize = document.createElement('div');
        resize.className = 'resize-handle';
        resize.onmousedown = (e) => { 
            e.stopPropagation(); 
            this.startResize(id, e); 
        };
        div.appendChild(resize);
        
        div.onmousedown = (e) => {
            if (e.target === del || e.target === resize) return;
            e.stopPropagation();
            this.startDrag(id, e);
        };
        
        this.stickerContainer.appendChild(div);
        
        this.stickers.push({
            id, element: div, type, customUrl,
            x: posX, y: posY, width: 70, height: 70
        });
    }

    removeSticker(id) {
        if (this.lockedPosition) {
            alert("Posisi terkunci! Buka kunci terlebih dahulu.");
            return;
        }
        
        this.saveToUndo();
        
        const idx = this.stickers.findIndex(s => s.id === id);
        if (idx !== -1) {
            if (this.stickers[idx].element) {
                this.stickers[idx].element.remove();
            }
            this.stickers.splice(idx, 1);
        }
    }

    clearAllStickers() {
        if (this.lockedPosition) {
            alert("Posisi terkunci! Buka kunci terlebih dahulu.");
            return;
        }
        
        if (this.stickers.length > 0) {
            this.saveToUndo();
        }
        
        this.stickers.forEach(s => {
            if (s.element) s.element.remove();
        });
        this.stickers = [];
    }

    startDrag(id, e) {
        if (this.lockedPosition) return;
        
        this.activeSticker = this.stickers.find(s => s.id === id);
        if (!this.activeSticker) return;
        this.isDragging = true;
        
        const clientX = e.clientX || (e.touches ? e.touches[0].clientX : 0);
        const clientY = e.clientY || (e.touches ? e.touches[0].clientY : 0);
        
        this.dragStartX = clientX - this.activeSticker.x;
        this.dragStartY = clientY - this.activeSticker.y;
        
        const onMouseMove = (me) => {
            if (!this.isDragging || !this.activeSticker) return;
            const rect = this.canvasContainer ? this.canvasContainer.getBoundingClientRect() : this.canvas.getBoundingClientRect();
            const moveX = me.clientX || (me.touches ? me.touches[0].clientX : 0);
            const moveY = me.clientY || (me.touches ? me.touches[0].clientY : 0);
            
            let newX = moveX - this.dragStartX;
            let newY = moveY - this.dragStartY;
            newX = Math.max(0, Math.min(newX, rect.width - this.activeSticker.width));
            newY = Math.max(0, Math.min(newY, rect.height - this.activeSticker.height));
            this.activeSticker.x = newX;
            this.activeSticker.y = newY;
            this.activeSticker.element.style.left = `${newX}px`;
            this.activeSticker.element.style.top = `${newY}px`;
        };
        
        const onMouseUp = () => {
            this.isDragging = false;
            this.activeSticker = null;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            document.removeEventListener('touchmove', onMouseMove);
            document.removeEventListener('touchend', onMouseUp);
        };
        
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        document.addEventListener('touchmove', onMouseMove);
        document.addEventListener('touchend', onMouseUp);
    }

    startResize(id, e) {
        if (this.lockedPosition) return;
        
        this.activeSticker = this.stickers.find(s => s.id === id);
        if (!this.activeSticker) return;
        
        this.saveToUndo();
        
        const startX = e.clientX || (e.touches ? e.touches[0].clientX : 0);
        const startW = this.activeSticker.width;
        
        const onMouseMove = (me) => {
            const moveX = me.clientX || (me.touches ? me.touches[0].clientX : 0);
            let newW = Math.max(30, Math.min(200, startW + (moveX - startX)));
            this.activeSticker.width = newW;
            this.activeSticker.height = newW;
            this.activeSticker.element.style.width = `${newW}px`;
            this.activeSticker.element.style.height = `${newW}px`;
        };
        
        const onMouseUp = () => {
            this.activeSticker = null;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            document.removeEventListener('touchmove', onMouseMove);
            document.removeEventListener('touchend', onMouseUp);
        };
        
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        document.addEventListener('touchmove', onMouseMove);
        document.addEventListener('touchend', onMouseUp);
        e.stopPropagation();
    }

    async captureWithStickers(baseImg) {
        const canvas = document.createElement('canvas');
        canvas.width = baseImg.width;
        canvas.height = baseImg.height;
        const tempCtx = canvas.getContext('2d');
        tempCtx.drawImage(baseImg, 0, 0);
        
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = baseImg.width / rect.width;
        const scaleY = baseImg.height / rect.height;
        tempCtx.font = `50px "Segoe UI Emoji"`;
        
        this.stickers.forEach(s => {
            if (s.element && !s.customUrl && s.type !== 'custom') {
                tempCtx.fillText(s.type, s.x * scaleX, (s.y + 55) * scaleY);
            }
        });
        
        return new Promise(resolve => {
            canvas.toBlob(blob => resolve(URL.createObjectURL(blob)), 'image/png');
        });
    }

    async createVideo() {
        const imgToUse = this.upscaledImg || this.originalImg;
        if (!imgToUse) { 
            alert("Upload gambar dulu!"); 
            return; 
        }
        
        const durationInput = document.getElementById('videoDuration');
        const animInSelect = document.getElementById('animationIn');
        const animOutSelect = document.getElementById('animationOut');
        const motionSelect = document.getElementById('motionEffect');
        
        const duration = durationInput ? parseFloat(durationInput.value) : 5;
        const animIn = animInSelect ? animInSelect.value : 'fadeIn';
        const animOut = animOutSelect ? animOutSelect.value : 'none';
        const motion = motionSelect ? motionSelect.value : 'none';
        const fps = 30;
        
        const videoProgress = document.getElementById('videoProgress');
        const videoResult = document.getElementById('videoResult');
        if (videoProgress) videoProgress.classList.remove('hidden');
        if (videoResult) videoResult.classList.add('hidden');
        
        const finalImg = await this.captureWithStickers(imgToUse);
        await this.generateVideo(finalImg, duration, animIn, animOut, motion, fps);
    }

    async generateVideo(imgUrl, duration, animIn, animOut, motion, fps) {
        const img = new Image();
        img.src = imgUrl;
        await new Promise(r => { img.onload = r; });
        
        const outW = 720, outH = 720;
        const canvas = document.createElement('canvas');
        canvas.width = outW;
        canvas.height = outH;
        const canvasCtx = canvas.getContext('2d');
        
        const stream = canvas.captureStream(fps);
        const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
        let chunks = [];
        
        recorder.ondataavailable = e => chunks.push(e.data);
        recorder.onstop = () => {
            const blob = new Blob(chunks, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            const outputVideo = document.getElementById('outputVideo');
            const downloadVideoLink = document.getElementById('downloadVideoLink');
            const videoResult = document.getElementById('videoResult');
            const videoProgress = document.getElementById('videoProgress');
            
            if (outputVideo) outputVideo.src = url;
            if (downloadVideoLink) downloadVideoLink.href = url;
            if (videoResult) videoResult.classList.remove('hidden');
            if (videoProgress) videoProgress.classList.add('hidden');
        };
        
        recorder.start();
        
        const startTime = performance.now();
        const animInDur = animIn !== 'none' ? 0.8 : 0;
        const animOutDur = animOut !== 'none' ? 0.8 : 0;
        
        const getTransform = (t, type, isEntry) => {
            let p = isEntry ? t : 1 - t;
            p = Math.min(1, Math.max(0, p));
            switch(type) {
                case 'fadeIn': case 'fadeOut': return { scale: 1, tx: 0, ty: 0, opacity: p };
                case 'slideFromLeft': return { scale: 1, tx: (1-p) * -outW, ty: 0, opacity: 1 };
                case 'zoomIn': case 'zoomOut': return { scale: 0.3 + p*0.7, tx: 0, ty: 0, opacity: p };
                case 'bounce': return { scale: 1, tx: 0, ty: Math.sin(p * Math.PI * 2) * 20 * (1-p), opacity: 1 };
                default: return { scale: 1, tx: 0, ty: 0, opacity: 1 };
            }
        };
        
        const getMotion = (t, type) => {
            if (type === 'none') return { sx: 0, sy: 0, sw: img.width, sh: img.height };
            if (type === 'zoomIn') {
                const z = 1 - t * 0.2;
                const sw = img.width * z, sh = img.height * z;
                return { sx: (img.width - sw)/2, sy: (img.height - sh)/2, sw, sh };
            }
            if (type === 'panLeft') return { sx: img.width * t * 0.2, sy: 0, sw: img.width, sh: img.height };
            if (type === 'panRight') return { sx: img.width * (1-t) * 0.2, sy: 0, sw: img.width, sh: img.height };
            return { sx: 0, sy: 0, sw: img.width, sh: img.height };
        };
        
        let frame = 0;
        const drawFrame = () => {
            const now = (performance.now() - startTime) / 1000;
            let t = Math.min(1, now / duration);
            
            if (t >= 1) {
                recorder.stop();
                return;
            }
            
            canvasCtx.clearRect(0, 0, outW, outH);
            canvasCtx.save();
            
            let transform = { scale: 1, tx: 0, ty: 0, opacity: 1 };
            if (t < animInDur/duration && animIn !== 'none') {
                transform = getTransform(t / (animInDur/duration), animIn, true);
            } else if (t > (duration - animOutDur)/duration && animOut !== 'none') {
                transform = getTransform((t - (duration - animOutDur)/duration) / (animOutDur/duration), animOut, false);
            }
            
            const motionCrop = getMotion(t, motion);
            
            canvasCtx.globalAlpha = transform.opacity;
            canvasCtx.translate(outW/2, outH/2);
            canvasCtx.translate(transform.tx, transform.ty);
            canvasCtx.scale(transform.scale, transform.scale);
            canvasCtx.translate(-outW/2, -outH/2);
            
            canvasCtx.drawImage(img, motionCrop.sx, motionCrop.sy, motionCrop.sw, motionCrop.sh, 0, 0, outW, outH);
            canvasCtx.restore();
            
            frame++;
            if (frame % (fps/2) === 0) {
                const progressBar = document.getElementById('progressBar');
                if (progressBar) progressBar.style.width = `${Math.floor(t*100)}%`;
            }
            
            requestAnimationFrame(drawFrame);
        };
        
        drawFrame();
    }

    async exportVideo() {
        const imgToUse = this.upscaledImg || this.originalImg;
        if (!imgToUse) {
            alert("Tidak ada gambar untuk diexport!");
            return;
        }
        
        const stream = this.canvas.captureStream(30);
        const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
        const chunks = [];

        recorder.ondataavailable = e => chunks.push(e.data);

        recorder.onstop = () => {
            const blob = new Blob(chunks, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'photo-video.webm';
            a.click();
        };

        recorder.start();

        let zoom = 1;
        const interval = setInterval(() => {
            zoom += 0.02;
            this.canvas.style.transform = `scale(${zoom})`;
            this.canvas.style.transformOrigin = "center";
        }, 100);

        setTimeout(() => {
            clearInterval(interval);
            recorder.stop();
            this.canvas.style.transform = 'scale(1)';
        }, 3000);
    }

    async generateAIImage(prompt) {
        if (!prompt) {
            alert("Isi prompt dulu!");
            return;
        }

        if (this.isGenerating) return;
        this.isGenerating = true;

        if (this.loaderDiv) this.loaderDiv.classList.remove('hidden');

        const finalPrompt = prompt + ", high quality, detailed, realistic";
        const seed = Math.floor(Math.random() * 10000);

        const apis = [
        `https://image.pollinations.ai/prompt/${encodeURIComponent(finalPrompt)}?width=512&height=512&seed=${seed}`
        ];

        let success = false;

        for (let api of apis) {
            try {
                console.log("TRY API:", api);

                let response = await fetch(api);

                if (!response.ok) {
                    await new Promise(r => setTimeout(r, 1000));
                    response = await fetch(api);
                }

                if (!response.ok) continue;

                const blob = await response.blob();
                const imgUrl = URL.createObjectURL(blob);

                await this.loadToCanvas(imgUrl);

                success = true;
                break;

            } catch (err) {
                console.log("API gagal:", api);
            }
        }

        if (!success) {
            alert("⚠️ AI gagal (server limit), coba lagi!");
        }

        this.loaderDiv.classList.add('hidden');
        this.isGenerating = false;
    }

    async generateAIEdit(prompt) {
        if (this.isProcessing) return;
        this.isProcessing = true;

        try {
            if (!this.originalImg) {
                alert("Upload gambar dulu!");
                this.isProcessing = false;
                return;
            }

            if (!this.maskCtx || !this.ctx) {
                alert("Canvas tidak tersedia!");
                this.isProcessing = false;
                return;
            }

            this.saveToUndo();

            const width = this.canvas.width;
            const height = this.canvas.height;
            const mode = document.getElementById("editMode")?.value || "mask";

            let imageData = this.ctx.getImageData(0, 0, width, height);
            let maskData = this.maskCtx.getImageData(0, 0, width, height);

            let data = imageData.data;
            let mask = maskData.data;

            const p = prompt.toLowerCase();

            let hasMask = false;
            for (let i = 3; i < mask.length; i += 4) {
                if (mask[i] > 0) {
                    hasMask = true;
                    break;
                }
            }

            if (!hasMask && mode === "mask") {
                alert("Gunakan brush dulu!");
                this.isProcessing = false;
                return;
            }

            let modeFilter = "none";

            if (p.includes("malam") || p.includes("night")) {
                modeFilter = "night";
            } else if (p.includes("dark")) {
                modeFilter = "dark";
            } else if (p.includes("sunset")) {
                modeFilter = "sunset";
            }

            const clamp = (v) => Math.max(0, Math.min(255, v));

            for (let i = 0; i < data.length; i += 4) {
                const alpha = mask[i + 3] / 255;

                if (mode === "full" || alpha > 0) {
                    let r = data[i];
                    let g = data[i + 1];
                    let b = data[i + 2];

                    switch (modeFilter) {
                        case "night":
                            r *= 0.3;
                            g *= 0.3;
                            b *= 0.6;
                            break;

                        case "dark":
                            r *= 0.2;
                            g *= 0.2;
                            b *= 0.8;
                            break;

                        case "sunset":
                            r *= 1.3;
                            g *= 0.7;
                            b *= 0.5;
                            break;
                    }

                    const nr = clamp(r);
                    const ng = clamp(g);
                    const nb = clamp(b);

                    data[i]     = data[i]     * (1 - alpha) + nr * alpha;
                    data[i + 1] = data[i + 1] * (1 - alpha) + ng * alpha;
                    data[i + 2] = data[i + 2] * (1 - alpha) + nb * alpha;
                }
            }

            this.ctx.putImageData(imageData, 0, 0);
            this.maskCtx.clearRect(0, 0, width, height);

        } catch (err) {
            console.error(err);
            alert("Terjadi error saat AI Edit");
        } finally {
            this.isProcessing = false;
        }
    }
    
    drawMask(e) {
        if (!this.maskCtx || !this.isDrawing) return;

        const rect = this.maskCanvas.getBoundingClientRect();

        const scaleX = this.maskCanvas.width / rect.width;
        const scaleY = this.maskCanvas.height / rect.height;

        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        this.maskCtx.fillStyle = "rgba(255,0,0,0.4)";
        this.maskCtx.beginPath();
        this.maskCtx.arc(x, y, this.brushSize, 0, Math.PI * 2);
        this.maskCtx.fill();
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.editor = new ImageEditor();
});