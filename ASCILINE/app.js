/**
 * ASCILINE PRO ENGINE
 * ===================
 * Professional UI bindings and real-time canvas rendering.
 */

// ── DOM ELEMENTS ─────────────────────────────────────────────────────────────
const player    = document.getElementById('ascii-player');
const canvas    = document.getElementById('ascii-canvas');
const ctx       = canvas.getContext('2d', { alpha: false }); // Optimize for no transparency
const container = document.getElementById('player-container');
const playOverlay = document.getElementById('play-overlay');
const audioEl   = document.getElementById('ascii-audio');

// Transport
const playPauseBtn = document.getElementById('play-pause-btn');
const iconPlay = document.getElementById('icon-play');
const iconPause = document.getElementById('icon-pause');
const seekSlider = document.getElementById('seek-slider');
const seekPlayed = document.getElementById('seek-played');
const seekWrap = document.getElementById('seek-wrap');
const seekPreview = document.getElementById('seek-preview');
const seekPreviewImg = document.getElementById('seek-preview-img');
const seekPreviewTime = document.getElementById('seek-preview-time');
const timeCurrent = document.getElementById('time-current');
const timeTotal = document.getElementById('time-total');
const btnBack = document.getElementById('btn-back');
const btnFwd = document.getElementById('btn-fwd');
const btnPrev = document.getElementById('btn-prev');
const btnNext = document.getElementById('btn-next');
const btnFullscreen = document.getElementById('btn-fullscreen');

// Volume
const volumeSlider = document.getElementById('volume-slider');
const btnMute = document.getElementById('btn-mute');
const iconVolUp = document.getElementById('icon-vol-up');
const iconVolOff = document.getElementById('icon-vol-off');

// Header & Connection
const connectionDot = document.getElementById('connection-dot');
const connectionText = document.getElementById('connection-text');
const wsUrlDisplay = document.getElementById('ws-url-display');
const streamState = document.getElementById('stream-state');
const streamQueueIdx = document.getElementById('stream-queue-idx');
const btnStreamConnect = document.getElementById('btn-stream-connect');
const btnStreamDisconnect = document.getElementById('btn-stream-disconnect');
const btnHeaderUpload = document.getElementById('btn-header-upload');

// Metadata & Perf
const metaRes = document.getElementById('meta-res');
const metaFps = document.getElementById('meta-fps');
const metaDuration = document.getElementById('meta-duration');
const perfFps = document.getElementById('perf-fps');
const perfBuffer = document.getElementById('perf-buffer');
const perfInflight = document.getElementById('perf-inflight');
const perfGrid = document.getElementById('perf-grid');
const hudFps = document.getElementById('hud-fps');
const hudBuf = document.getElementById('hud-buf');
const hudMode = document.getElementById('hud-mode');
const hudOverlay = document.getElementById('hud-overlay');
const modeBadge = document.getElementById('mode-badge');
const modeBadgeText = document.getElementById('mode-badge-text');

// Sparkline
const sparklineCanvas = document.getElementById('sparkline-canvas');
const sparklineCtx = sparklineCanvas.getContext('2d');
const sparklineHistory = new Array(60).fill(0);

// Upload & URL
const uploadDropzone = document.getElementById('upload-dropzone');
const fileUploadInput = document.getElementById('file-upload-input');
const urlInput = document.getElementById('url-input');
const btnConnectUrl = document.getElementById('btn-connect-url');

// Filters
const filterContrast = document.getElementById('filter-contrast');
const filterGamma = document.getElementById('filter-gamma');
const filterBrightness = document.getElementById('filter-brightness');
const filterSharpness = document.getElementById('filter-sharpness');
const filterPixel = document.getElementById('filter-pixel');
const filterInvert = document.getElementById('filter-invert');
const filterReset = document.getElementById('filter-reset');
const paletteRadios = document.querySelectorAll('input[name="palette"]');

// Sidebar
const sidebar = document.getElementById('sidebar');
const btnSidebarToggle = document.getElementById('btn-sidebar-toggle');
const sidebarTabs = document.querySelectorAll('.sidebar-tab');
const sidebarContents = document.querySelectorAll('.sidebar-content');

// ── STATE ────────────────────────────────────────────────────────────────────
let state = 'IDLE'; // IDLE | PLAYING | PAUSED
let ws = null;
let bufferReportTimer = null;
const frameBuffer = [];
const BUFFER_SIZE = 4;
let codecDecoder = null;
let targetFps = 24;
let frameInterval = 1000 / targetFps;
let renderMode = 1;
let pixelMode = false;
let readyToRender = false;
let pauseStartTime = 0;
let duration = 0;
let isSeeking = false;
let currentQueueIdx = 0;
let audioOffset = 0;
let isWebcamStream = false;

// Grid & Dimensions
let gridCols = 0, gridRows = 0;
let charWidth = 0, charHeight = 0;
let xPos = null, yPos = null;
let dotImageData = null;
const textDecoder = new TextDecoder();
let selectionBuffer = null;

// Timing & Metrics
let lastRenderTime = 0;
let frameCount = 0, currentFps = 0, lastFpsUpdate = 0;
let streamStartTime = 0;
let streamEpoch = 0; 
let lastUiUpdateTime = 0;
let lastFormattedTime = "";
let framesInFlight = 0;
let decodeQueue = Promise.resolve();
let scrubMeta = null;

const CHAR_LUT = new Array(128);
for (let i = 0; i < 128; i++) CHAR_LUT[i] = String.fromCharCode(i);

// ── UTILITIES ────────────────────────────────────────────────────────────────

function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return "00:00";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
}

function showToast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    
    // Icon mapping
    let icon = '';
    if (type === 'error') icon = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>';
    else if (type === 'success') icon = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>';
    else icon = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>';

    el.innerHTML = `${icon} <span>${msg}</span>`;
    container.appendChild(el);
    
    // Animate in
    requestAnimationFrame(() => {
        el.classList.add('show');
    });
    
    // Remove
    setTimeout(() => {
        el.classList.remove('show');
        setTimeout(() => el.remove(), 300);
    }, 4000);
}

function updateConnectionState(status, isError = false) {
    connectionText.textContent = status.toUpperCase();
    if (status === 'connected' || status === 'playing') {
        connectionDot.className = 'status-dot connected';
        streamState.textContent = 'CONNECTED';
        streamState.className = 'data-value text-success';
    } else if (status === 'connecting' || status === 'buffering') {
        connectionDot.className = 'status-dot connecting';
        streamState.textContent = 'CONNECTING';
        streamState.className = 'data-value text-warning';
    } else {
        connectionDot.className = `status-dot ${isError ? 'error' : ''}`;
        streamState.textContent = isError ? 'ERROR' : 'DISCONNECTED';
        streamState.className = `data-value text-${isError ? 'error' : 'secondary'}`;
    }
}

// ── UI INTERACTIVITY ─────────────────────────────────────────────────────────

// Tabs
sidebarTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        sidebarTabs.forEach(t => t.classList.remove('active'));
        sidebarContents.forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(tab.dataset.tab).classList.add('active');
    });
});

// Sidebar Toggle
btnSidebarToggle.addEventListener('click', () => {
    sidebar.classList.toggle('mobile-open');
});
btnHeaderUpload.addEventListener('click', () => {
    // Switch to Media tab and highlight it
    document.querySelector('.sidebar-tab[data-tab="tab-media"]').click();
    if (window.innerWidth <= 900) sidebar.classList.add('mobile-open');
    uploadDropzone.style.borderColor = 'var(--accent)';
    setTimeout(() => uploadDropzone.style.borderColor = '', 1000);
});

// Fullscreen
btnFullscreen.addEventListener('click', () => {
    if (!document.fullscreenElement) {
        container.requestFullscreen().catch(err => {
            showToast(`Error attempting to enable full-screen mode: ${err.message}`, 'error');
        });
    } else {
        document.exitFullscreen();
    }
});

// Volume / Mute
function setVolume(val) {
    val = Math.max(0, Math.min(1, val));
    audioEl.volume = val;
    volumeSlider.value = val;
    localStorage.setItem('asciline_volume', val);
    
    if (val === 0 || audioEl.muted) {
        iconVolUp.style.display = 'none';
        iconVolOff.style.display = 'block';
    } else {
        iconVolUp.style.display = 'block';
        iconVolOff.style.display = 'none';
    }
}

volumeSlider.addEventListener('input', (e) => {
    audioEl.muted = false;
    setVolume(parseFloat(e.target.value));
});

btnMute.addEventListener('click', () => {
    if (audioEl.muted || audioEl.volume === 0) {
        audioEl.muted = false;
        setVolume(parseFloat(localStorage.getItem('asciline_volume')) || 0.75);
    } else {
        audioEl.muted = true;
        iconVolUp.style.display = 'none';
        iconVolOff.style.display = 'block';
    }
});

// Load volume pref
const savedVol = localStorage.getItem('asciline_volume');
if (savedVol !== null) setVolume(parseFloat(savedVol));

// Upload Handling
function handleUpload(file) {
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    
    showToast(`Uploading ${file.name}...`, 'info');
    updateConnectionState('uploading');
    
    fetch('/upload', {
        method: 'POST',
        body: formData
    })
    .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
    })
    .then(data => {
        showToast('Upload complete!', 'success');
        startStreamAt(data.queued_index);
    })
    .catch(err => {
        showToast(`Upload failed: ${err.message}`, 'error');
        updateConnectionState('error', true);
    });
}

uploadDropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadDropzone.classList.add('dragover');
});
uploadDropzone.addEventListener('dragleave', () => {
    uploadDropzone.classList.remove('dragover');
});
uploadDropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadDropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length) handleUpload(e.dataTransfer.files[0]);
});
uploadDropzone.addEventListener('click', () => {
    fileUploadInput.click();
});
fileUploadInput.addEventListener('change', (e) => {
    if (e.target.files.length) handleUpload(e.target.files[0]);
});

// Filters
let currentFilters = { contrast: 1.0, gamma: 1.0, brightness: 0, invert: false, sharpness: 0, palette: 'default' };
let filterSendTimer = null;

function syncFilterUI() {
    filterContrast.value = currentFilters.contrast;
    filterGamma.value = currentFilters.gamma;
    filterBrightness.value = currentFilters.brightness;
    filterSharpness.value = currentFilters.sharpness;
    document.getElementById('filter-contrast-val').textContent = Number(currentFilters.contrast).toFixed(2);
    document.getElementById('filter-gamma-val').textContent = Number(currentFilters.gamma).toFixed(2);
    document.getElementById('filter-brightness-val').textContent = (currentFilters.brightness > 0 ? '+' : '') + currentFilters.brightness;
    document.getElementById('filter-sharpness-val').textContent = currentFilters.sharpness;
    filterInvert.checked = currentFilters.invert;
    
    paletteRadios.forEach(r => { r.checked = (r.value === currentFilters.palette); });
}

(() => {
    const raw = localStorage.getItem('asciline_filters');
    if (!raw) return;
    try {
        const f = JSON.parse(raw);
        const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
        currentFilters = {
            contrast: clamp(parseFloat(f.contrast), 0.1, 3.0) || 1.0,
            gamma: clamp(parseFloat(f.gamma), 0.1, 3.0) || 1.0,
            brightness: clamp(parseInt(f.brightness, 10), -100, 100) || 0,
            sharpness: clamp(parseInt(f.sharpness, 10), 0, 10) || 0,
            palette: ['default', 'flat', 'block'].includes(f.palette) ? f.palette : 'default',
            invert: Boolean(f.invert)
        };
        syncFilterUI();
    } catch (_) {}
})();

function sendFilters() {
    localStorage.setItem('asciline_filters', JSON.stringify(currentFilters));
    if (filterSendTimer) clearTimeout(filterSendTimer);
    filterSendTimer = setTimeout(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'filter',
                contrast: currentFilters.contrast,
                gamma: currentFilters.gamma,
                brightness: currentFilters.brightness,
                invert: currentFilters.invert,
                sharpness: currentFilters.sharpness,
                palette: currentFilters.palette
            }));
        }
        filterSendTimer = null;
    }, 60);
}

['contrast', 'gamma', 'brightness', 'sharpness'].forEach(key => {
    const el = document.getElementById(`filter-${key}`);
    const valEl = document.getElementById(`filter-${key}-val`);
    el.addEventListener('input', () => {
        let v = parseFloat(el.value);
        currentFilters[key] = key === 'brightness' || key === 'sharpness' ? parseInt(el.value, 10) : v;
        
        let display = v;
        if (key === 'contrast' || key === 'gamma') display = v.toFixed(2);
        else if (key === 'brightness') display = (v > 0 ? '+' : '') + v;
        valEl.textContent = display;
        sendFilters();
    });
});

filterInvert.addEventListener('change', () => {
    currentFilters.invert = filterInvert.checked;
    sendFilters();
});

paletteRadios.forEach(radio => {
    radio.addEventListener('change', () => {
        currentFilters.palette = radio.value;
        sendFilters();
    });
});

filterReset.addEventListener('click', () => {
    currentFilters = { contrast: 1.0, gamma: 1.0, brightness: 0, invert: false, sharpness: 0, palette: 'default' };
    syncFilterUI();
    sendFilters();
    showToast('Filters reset', 'info');
});

filterPixel.addEventListener('change', () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
        const nextMode = filterPixel.checked;
        const currentAbsTime = getMasterClock();
        ws.send(JSON.stringify({
            type: 'reinit',
            pixel: nextMode,
            time: currentAbsTime
        }));
    } else {
        // Prevent toggle if not connected
        filterPixel.checked = pixelMode;
    }
});


// ── CANVAS SETUP ─────────────────────────────────────────────────────────────

function buildCanvas(cols, rows) {
    gridCols = cols;
    gridRows = rows;
    perfGrid.textContent = `${cols} × ${rows}`;

    const syncSize = (el) => {
        el.style.width  = container.clientWidth + 'px';
        el.style.height = container.clientHeight + 'px';
        el.style.objectFit = 'contain';
        el.style.position = 'absolute';
        el.style.top = '0';
        el.style.left = '0';
    };

    if (pixelMode) {
        canvas.width  = cols;
        canvas.height = rows;
        canvas.style.display = 'block';
        canvas.style.imageRendering = 'pixelated';
        dotImageData = ctx.createImageData(cols, rows);
        const d = dotImageData.data;
        for (let i = 3; i < d.length; i += 4) d[i] = 255; // Alpha
        syncSize(canvas);
        player.style.display = 'none';
        
        modeBadgeText.textContent = 'PIXEL MODE';
    } else {
        canvas.style.imageRendering = '';
        dotImageData = null;
        ctx.font = 'bold 8px Courier New';
        charWidth = ctx.measureText('M').width;
        charHeight = 8;
        canvas.width  = cols * charWidth;
        canvas.height = rows * charHeight;
        canvas.style.display = 'block';

        selectionBuffer = new Uint8Array((cols + 1) * rows);
        for (let r = 0; r < rows; r++) selectionBuffer[r * (cols + 1) + cols] = 10; // newline

        syncSize(canvas);

        const fitScaleX = container.clientWidth / canvas.width;
        const fitScaleY = container.clientHeight / canvas.height;
        const fitScale  = Math.min(fitScaleX, fitScaleY);
        const offsetX   = (container.clientWidth - (canvas.width * fitScale)) / 2;
        const offsetY   = (container.clientHeight - (canvas.height * fitScale)) / 2;

        player.style.width  = canvas.width + 'px';
        player.style.height = canvas.height + 'px';
        player.style.position = 'absolute';
        player.style.top = '0';
        player.style.left = '0';
        player.style.transformOrigin = 'top left';
        player.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${fitScale})`;

        ctx.textBaseline = 'top';
        xPos = new Float32Array(cols);
        yPos = new Float32Array(rows);
        for (let c = 0; c < cols; c++) xPos[c] = c * charWidth;
        for (let r = 0; r < rows; r++) yPos[r] = r * charHeight;
        
        const modes = { 2: '64 COLORS', 3: '512 COLORS', 4: '32K COLORS', 5: '262K COLORS', 6: '16M ULTRA' };
        modeBadgeText.textContent = modes[renderMode] || 'B&W ASCII';
    }
    
    modeBadge.style.display = 'flex';
    hudMode.textContent = modeBadgeText.textContent;
}

window.addEventListener('resize', () => {
    if (gridCols > 0 && gridRows > 0) {
        buildCanvas(gridCols, gridRows);
    }
});

// ── STREAM CONTROL ───────────────────────────────────────────────────────────

const beginRendering = () => {
    if (readyToRender) return;
    readyToRender = true;
    streamStartTime = performance.now() - (audioOffset * 1000.0);
    lastRenderTime = performance.now();
    lastFpsUpdate = lastRenderTime;
    requestAnimationFrame(renderFrame);
    startBufferReports();
    hudOverlay.classList.remove('hidden');
};

const triggerPlaybackStart = (epochToMatch) => {
    if (readyToRender || state !== 'PLAYING') return;
    if (isWebcamStream) {
        beginRendering();
        return;
    }
    if (audioEl) {
        audioEl.play().catch(() => {});
        if (audioEl.readyState >= 3) {
            beginRendering();
        } else {
            audioEl.addEventListener('playing', () => {
                if (epochToMatch !== streamEpoch) return;
                beginRendering();
            }, { once: true });
            setTimeout(() => { 
                if (epochToMatch !== streamEpoch) return;
                if (!readyToRender) beginRendering(); 
            }, 500);
        }
    } else {
        beginRendering();
    }
};

function startStreamAt(index) {
    if (ws && ws.readyState !== WebSocket.CLOSED) {
        ws.onclose = null;
        ws.close();
    }
    if (state !== 'IDLE') finishStream();
    
    setTimeout(() => {
        state = 'IDLE';
        connectWebSocket(index);
    }, 80);
}

function startStream() {
    if (state !== 'IDLE') return;
    connectWebSocket();
}

function connectWebSocket(startIndex) {
    frameBuffer.length = 0;
    frameCount = 0;
    currentFps = 0;
    
    playOverlay.classList.add('hidden');
    updateConnectionState('connecting');

    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    let wsUrl = `${protocol}//${location.host}/ws?codec=adaptive`;
    if (startIndex !== undefined && startIndex !== null) wsUrl += `&start_index=${startIndex}`;
    
    ws = new WebSocket(wsUrl);
    ws.binaryType = 'arraybuffer';
    wsUrlDisplay.value = ws.url;

    ws.onmessage = (event) => {
        if (typeof event.data === 'string') {
            if (event.data === 'UPLOAD_READY') {
                updateConnectionState('idle');
                playOverlay.classList.remove('hidden');
                document.getElementById('overlay-title').textContent = 'READY FOR MEDIA';
                document.getElementById('overlay-subtitle').textContent = 'Upload a video to begin playback';
                return;
            }
            if (event.data.startsWith('Error:')) {
                showToast(event.data, 'error');
                updateConnectionState('error', true);
                if (ws) ws.close();
                setTimeout(() => finishStream(), 3000);
                return;
            }
            if (event.data.startsWith('INIT:')) {
                const p = event.data.split(':');
                targetFps = parseFloat(p[1]);
                frameInterval = 1000 / targetFps;
                renderMode = parseInt(p[2]);
                pixelMode = (p.length > 5 && parseInt(p[5]) === 1);
                currentQueueIdx = (p.length > 6) ? parseInt(p[6]) : 0;
                duration = (p.length > 7) ? parseFloat(p[7]) : 0;
                audioOffset = (p.length > 8) ? parseFloat(p[8]) : 0;
                isWebcamStream = (p.length > 9 && parseInt(p[9]) === 1);
                
                // Update UI metadata
                streamQueueIdx.textContent = currentQueueIdx;
                metaFps.textContent = targetFps.toFixed(2);
                metaRes.textContent = `${p[3]} × ${p[4]}`;
                metaDuration.textContent = formatTime(duration);
                timeTotal.textContent = formatTime(duration);
                timeCurrent.textContent = "00:00:00";
                
                seekSlider.max = duration;
                seekSlider.value = 0;
                seekPlayed.style.transform = 'scaleX(0)';
                
                filterPixel.checked = pixelMode;
                filterPixel.disabled = isWebcamStream;

                frameBuffer.length = 0;
                framesInFlight = 0;
                streamEpoch++;
                scrubMeta = null;
                
                if (!scrubMeta && !isWebcamStream) {
                    seekWrap.addEventListener('mouseenter', () => {
                        if (!scrubMeta) setupScrub(currentQueueIdx);
                    }, { once: true });
                }
                
                buildCanvas(parseInt(p[3]), parseInt(p[4]));

                if (typeof AscilineCodec !== 'undefined' && renderMode > 1 && !pixelMode) {
                    codecDecoder = AscilineCodec.makeDecoder(4);
                } else {
                    codecDecoder = null;
                }

                decodeQueue = Promise.resolve();
                const wasPaused = (state === 'PAUSED');
                readyToRender = false;
                if (!wasPaused) state = 'PLAYING';

                if (audioEl && !isWebcamStream) {
                    audioEl.pause();
                    audioEl.src = `/audio?v=${currentQueueIdx}&start=${audioOffset}&t=${Date.now()}`;
                    audioEl.volume = volumeSlider.value;
                    audioEl.load();
                }

                sendFilters();
                updateConnectionState('playing');
                iconPlay.style.display = 'none';
                iconPause.style.display = 'block';
                return;
            }
            
            // Mode 1: Text Frame
            const text = event.data;
            const newlineIdx = text.indexOf('\n');
            const frameIndex = parseInt(text.substring(0, newlineIdx));
            frameBuffer.push({ data: text.substring(newlineIdx + 1), time: frameIndex / targetFps });
            triggerPlaybackStart(streamEpoch);
        } else {
            // Binary Frames
            if (codecDecoder) {
                framesInFlight++;
                decodeQueue = decodeQueue.then(() =>
                    codecDecoder.decode(event.data).then(({ frameIndex, frame }) => {
                        framesInFlight--;
                        frameBuffer.push({ data: frame, time: frameIndex / targetFps });
                        triggerPlaybackStart(streamEpoch);
                    }).catch(e => {
                        framesInFlight--;
                        console.error("Decode error", e);
                    })
                );
            } else {
                const view = new DataView(event.data);
                const frameIndex = view.getUint32(0, false);
                frameBuffer.push({ data: new Uint8Array(event.data, 4), time: frameIndex / targetFps });
                triggerPlaybackStart(streamEpoch);
            }
        }

        while (frameBuffer.length > BUFFER_SIZE * 5) frameBuffer.shift();
    };

    ws.onopen = () => {
        updateConnectionState('buffering');
    };

    ws.onclose = (event) => {
        if (state === 'PLAYING' || state === 'PAUSED') {
            const ended = event.code === 1000;
            if (!ended) showToast('Connection lost', 'warning');
            updateConnectionState('disconnected', !ended);
            if (audioEl) audioEl.pause();
            setTimeout(() => finishStream(), 800);
        }
    };

    ws.onerror = () => {
        showToast('Connection error', 'error');
        updateConnectionState('error', true);
        setTimeout(() => finishStream(), 2000);
    };
}

// ── RENDER LOOP ──────────────────────────────────────────────────────────────

function drawSparkline() {
    const w = sparklineCanvas.width;
    const h = sparklineCanvas.height;
    sparklineCtx.clearRect(0, 0, w, h);
    
    if (sparklineHistory.length === 0) return;
    
    const maxVal = Math.max(...sparklineHistory, targetFps) * 1.1;
    const stepX = w / (sparklineHistory.length - 1);
    
    sparklineCtx.beginPath();
    sparklineCtx.moveTo(0, h);
    
    for (let i = 0; i < sparklineHistory.length; i++) {
        const val = sparklineHistory[i];
        const x = i * stepX;
        const y = h - (val / maxVal) * h;
        sparklineCtx.lineTo(x, y);
    }
    
    sparklineCtx.lineTo(w, h);
    sparklineCtx.fillStyle = 'rgba(74, 158, 255, 0.2)';
    sparklineCtx.fill();
    
    sparklineCtx.beginPath();
    for (let i = 0; i < sparklineHistory.length; i++) {
        const val = sparklineHistory[i];
        const x = i * stepX;
        const y = h - (val / maxVal) * h;
        if (i === 0) sparklineCtx.moveTo(x, y);
        else sparklineCtx.lineTo(x, y);
    }
    sparklineCtx.strokeStyle = '#4a9eff';
    sparklineCtx.lineWidth = 1.5;
    sparklineCtx.stroke();
}

function renderFrame(now) {
    if (state !== 'PLAYING' || !readyToRender) return;
    requestAnimationFrame(renderFrame);

    const masterClock = getMasterClock();

    // UI Updates
    if (now - lastUiUpdateTime >= 100) {
        if (!isSeeking) {
            seekSlider.value = masterClock;
            if (duration) seekPlayed.style.transform = `scaleX(${Math.min(1, masterClock / duration)})`;
            
            const formattedTime = formatTime(masterClock);
            if (formattedTime !== lastFormattedTime) {
                timeCurrent.textContent = formattedTime;
                lastFormattedTime = formattedTime;
            }
        }
        perfBuffer.textContent = frameBuffer.length;
        perfInflight.textContent = framesInFlight;
        hudBuf.textContent = frameBuffer.length;
        lastUiUpdateTime = now;
    }

    if (frameBuffer.length === 0) return;

    let frameObj;

    if (isWebcamStream) {
        frameObj = frameBuffer.pop();
        frameBuffer.length = 0;
    } else {
        while (frameBuffer.length > 0 && frameBuffer[0].time < masterClock - 0.1) {
            frameBuffer.shift();
        }
        if (frameBuffer.length === 0) return;
        if (frameBuffer[0].time > masterClock + 0.05) return;
        frameObj = frameBuffer.shift();
    }

    const frame = frameObj.data;
    frameCount++;

    // FPS Counter
    if (now - lastFpsUpdate >= 1000) {
        currentFps = frameCount;
        frameCount = 0;
        lastFpsUpdate = now;
        
        perfFps.textContent = `${currentFps} / ${Math.round(targetFps)}`;
        hudFps.textContent = currentFps;
        
        sparklineHistory.shift();
        sparklineHistory.push(currentFps);
        drawSparkline();
    }

    lastRenderTime = now;

    // Render Logic
    if (pixelMode) {
        const view = frame;
        const data = dotImageData.data;
        for (let src = 0, dst = 0; src < view.length; src += 3, dst += 4) {
            data[dst]     = view[src + 2]; // R
            data[dst + 1] = view[src + 1]; // G
            data[dst + 2] = view[src];     // B
        }
        ctx.putImageData(dotImageData, 0, 0);
    } else if (renderMode === 1) {
        player.style.display = 'block';
        player.style.color = 'var(--text-primary)';
        player.textContent = frame;
    } else {
        const view = frame;
        
        // Background
        ctx.fillStyle = '#141417'; // Match --bg-base
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        let col = 0, row = 0, prevPacked = -1;
        for (let idx = 0; idx < view.length; idx += 4) {
            const packed = (view[idx+1] << 16) | (view[idx+2] << 8) | view[idx+3];
            if (packed !== prevPacked) {
                ctx.fillStyle = `rgb(${view[idx+1]},${view[idx+2]},${view[idx+3]})`;
                prevPacked = packed;
            }
            ctx.fillText(CHAR_LUT[view[idx]], xPos[col], yPos[row]);
            selectionBuffer[row * (gridCols + 1) + col] = view[idx];

            col++;
            if (col >= gridCols) { col = 0; row++; }
        }

        player.style.display = 'block';
        player.style.color = 'transparent';
        player.textContent = textDecoder.decode(selectionBuffer);
    }
}

function startBufferReports() {
    stopBufferReports();
    bufferReportTimer = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN && state === 'PLAYING') {
            ws.send(JSON.stringify({ type: 'buffer', depth: framesInFlight }));
        }
    }, 250);
}

function stopBufferReports() {
    if (bufferReportTimer) { clearInterval(bufferReportTimer); bufferReportTimer = null; }
}

function finishStream() {
    state = 'IDLE';
    stopBufferReports();
    if (ws) { ws.onclose = null; ws.close(); ws = null; }
    if (audioEl) { audioEl.pause(); audioEl.src = ''; }
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    player.textContent = '';
    player.style.display = 'none';
    container.classList.remove('paused');
    
    playOverlay.classList.remove('hidden');
    document.getElementById('overlay-title').textContent = 'INITIALIZE UPLINK';
    document.getElementById('overlay-subtitle').textContent = 'Click to connect to stream';
    modeBadge.style.display = 'none';
    hudOverlay.classList.add('hidden');
    
    iconPlay.style.display = 'block';
    iconPause.style.display = 'none';
    
    updateConnectionState('disconnected');
    
    readyToRender = false;
    pauseStartTime = 0;
    frameBuffer.length = 0;
}

// ── PLAYBACK CONTROLS ────────────────────────────────────────────────────────

function togglePause() {
    if (isWebcamStream) {
        showToast('Cannot pause live webcam feed', 'warning');
        return;
    }
    if (state === 'PLAYING') {
        state = 'PAUSED';
        pauseStartTime = performance.now();
        if (audioEl && !audioEl.paused) audioEl.pause();
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'pause', paused: true }));
        }
        container.classList.add('paused');
        iconPlay.style.display = 'block';
        iconPause.style.display = 'none';
    } else if (state === 'PAUSED') {
        state = 'PLAYING';
        readyToRender = true;
        streamStartTime += (performance.now() - pauseStartTime);
        pauseStartTime = 0;
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'pause', paused: false }));
        }
        if (audioEl && audioEl.paused) audioEl.play().catch(() => {});
        frameBuffer.length = 0;
        
        container.classList.remove('paused');
        iconPlay.style.display = 'none';
        iconPause.style.display = 'block';
        
        lastRenderTime = performance.now();
        lastFpsUpdate = performance.now();
        frameCount = 0;
        requestAnimationFrame(renderFrame);
    }
}

function doSeek(targetSec) {
    if (isWebcamStream) {
        showToast('Cannot seek live webcam feed', 'warning');
        return;
    }
    if (duration) targetSec = Math.max(0, Math.min(targetSec, duration));
    seekSlider.value = targetSec;
    if (duration) seekPlayed.style.transform = `scaleX(${Math.min(1, targetSec / duration)})`;

    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'seek', time: targetSec }));
    }

    frameBuffer.length = 0;
    audioOffset = targetSec;

    if (audioEl) {
        audioEl.pause();
        streamEpoch++;
        const myEpoch = streamEpoch;
        audioEl.src = `/audio?v=${currentQueueIdx}&start=${targetSec}&t=${Date.now()}`;
        audioEl.load();

        if (state === 'PLAYING') {
            readyToRender = false;
            audioEl.play().catch(() => {});
            const onAudioStart = () => {
                if (!readyToRender) {
                    readyToRender = true;
                    streamStartTime = performance.now() - (targetSec * 1000.0);
                    lastRenderTime = performance.now();
                    lastFpsUpdate = performance.now();
                    frameCount = 0;
                    requestAnimationFrame(renderFrame);
                }
            };
            if (audioEl.readyState >= 3) onAudioStart();
            else {
                audioEl.addEventListener('playing', () => {
                    if (myEpoch !== streamEpoch) return;
                    onAudioStart();
                }, { once: true });
                setTimeout(() => { if (myEpoch === streamEpoch) onAudioStart(); }, 500);
            }
        } else {
            streamStartTime = performance.now() - (targetSec * 1000.0);
            if (state === 'PAUSED') pauseStartTime = performance.now();
        }
    } else {
        streamStartTime = performance.now() - (targetSec * 1000.0);
        if (state === 'PAUSED') pauseStartTime = performance.now();
    }
}

function getMasterClock() {
    if (audioEl && audioEl.readyState >= 1) return audioEl.currentTime + audioOffset;
    return (performance.now() - streamStartTime) / 1000.0;
}

function skip(delta) {
    if (state !== 'PLAYING' && state !== 'PAUSED') return;
    if (!duration) return;
    doSeek(getMasterClock() + delta);
}

// ── SCRUB / TIMELINE ─────────────────────────────────────────────────────────

function setupScrub(v) {
    scrubMeta = null;
    seekPreviewImg.style.backgroundImage = '';
    fetch(`/scrub?v=${v || 0}&t=${Date.now()}`).then(r => r.json()).then(m => {
        if (!m || !m.available) return;
        scrubMeta = m;
        seekPreviewImg.style.width = m.cellW + 'px';
        seekPreviewImg.style.height = m.cellH + 'px';
        seekPreviewImg.style.backgroundImage = `url(${m.sprite})`;
        seekPreviewImg.style.backgroundSize = `${m.gridCols * m.cellW}px ${m.gridRows * m.cellH}px`;
    }).catch(() => {});
}

seekWrap.addEventListener('mousemove', (e) => {
    if (!scrubMeta || !duration) return;
    const rect = seekWrap.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const time = (x / rect.width) * duration;
    
    const idx = Math.max(0, Math.min(Math.floor(time / scrubMeta.interval), scrubMeta.count - 1));
    const col = idx % scrubMeta.gridCols, row = Math.floor(idx / scrubMeta.gridCols);
    
    seekPreviewImg.style.backgroundPosition = `-${col * scrubMeta.cellW}px -${row * scrubMeta.cellH}px`;
    seekPreviewTime.textContent = formatTime(time);
    
    const half = scrubMeta.cellW / 2;
    seekPreview.style.left = Math.max(half, Math.min(x, rect.width - half)) + 'px';
    seekPreview.classList.add('show');
});

seekWrap.addEventListener('mouseleave', () => {
    seekPreview.classList.remove('show');
});

seekSlider.addEventListener('input', () => {
    isSeeking = true;
    timeCurrent.textContent = formatTime(seekSlider.value);
    if (duration) seekPlayed.style.transform = `scaleX(${Math.min(1, seekSlider.value / duration)})`;
});

seekSlider.addEventListener('change', () => {
    doSeek(parseFloat(seekSlider.value));
    isSeeking = false;
});


// ── EVENT BINDINGS ───────────────────────────────────────────────────────────

playOverlay.addEventListener('click', (e) => {
    e.stopPropagation();
    startStream();
});

container.addEventListener('click', (e) => {
    if (e.target.closest('#play-overlay')) return;
    if (window.getSelection().toString().length > 0) return;
    togglePause();
});

playPauseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (state === 'IDLE') startStream();
    else togglePause();
});

btnBack.addEventListener('click', (e) => { e.stopPropagation(); skip(-10); });
btnFwd.addEventListener('click', (e) => { e.stopPropagation(); skip(10); });

btnPrev.addEventListener('click', (e) => {
    e.stopPropagation();
    if (currentQueueIdx > 0) startStreamAt(currentQueueIdx - 1);
    else showToast('Already at start of playlist', 'info');
});

btnNext.addEventListener('click', (e) => {
    e.stopPropagation();
    startStreamAt(currentQueueIdx + 1);
});

btnStreamConnect.addEventListener('click', () => {
    startStream();
});

btnStreamDisconnect.addEventListener('click', () => {
    if (ws) ws.close();
    finishStream();
});

btnConnectUrl.addEventListener('click', () => {
    const val = urlInput.value.trim();
    if (!val) {
        showToast('Enter a URL first', 'warning');
        return;
    }
    // Simplistic backend connection - we assume URL handling relies on backend queue.
    // ASCILINE backend natively uses playlist.json for URLs.
    showToast('Direct URL connection not yet implemented in backend. Use file upload.', 'warning');
});

document.addEventListener('keydown', (e) => {
    // Ignore if typing in an input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    
    if (state === 'PLAYING' || state === 'PAUSED') {
        if (e.code === 'Space') {
            e.preventDefault();
            togglePause();
        } else if (e.code === 'ArrowRight') {
            e.preventDefault();
            skip(10);
        } else if (e.code === 'ArrowLeft') {
            e.preventDefault();
            skip(-10);
        }
    }
});

// Init layout
sparklineCanvas.width = sparklineCanvas.clientWidth * window.devicePixelRatio;
sparklineCanvas.height = sparklineCanvas.clientHeight * window.devicePixelRatio;
sparklineCtx.scale(window.devicePixelRatio, window.devicePixelRatio);
