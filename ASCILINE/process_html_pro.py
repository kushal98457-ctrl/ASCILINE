import re

with open('stitch_ui_pro.html', 'r', encoding='utf-8') as f:
    html = f.read()

# 1. Replace the image with the canvas and audio tags
img_tag_regex = re.compile(r'<img[^>]+src="https://lh3.googleusercontent.com/aida-public/[^>]+/>')
html = img_tag_regex.sub(
    '<canvas id="ascii-canvas" class="absolute inset-0 w-full h-full object-contain z-10" style="image-rendering: pixelated;"></canvas><pre id="ascii-player" class="absolute inset-0 w-full h-full object-contain z-10 font-mono text-[8px] leading-[8px] font-bold text-transparent select-text" style="display:none;"></pre><audio id="ascii-audio"></audio>', 
    html
)

# 2. Inject the Upload, Stream, and Filter controls into the right panel
controls_injection = """
  <!-- Media Input & Stream Connect -->
  <div class="bg-surface-container-lowest rounded border border-outline-variant/30 p-2 space-y-2">
    <div class="flex items-center justify-between">
      <span class="text-label-mono-xs font-label-mono-xs uppercase tracking-wider text-on-surface-variant">Media Ingest</span>
    </div>
    
    <div class="space-y-1">
      <div id="upload-dropzone" class="border border-dashed border-outline-variant/50 hover:border-inverse-primary rounded p-2 text-center cursor-pointer transition-colors">
         <span class="text-[10px] font-label-ui text-on-surface-variant">Click or Drop Media File</span>
      </div>
    </div>
    
    <div class="space-y-1 pt-1">
       <span class="text-[9px] font-label-mono-xs text-outline">Network Stream URL</span>
       <div class="flex gap-1">
          <input type="text" id="url-input" class="w-full bg-surface-container text-[10px] font-label-mono-xs text-on-surface border border-outline-variant/30 rounded px-1 py-0.5 focus:border-inverse-primary focus:outline-none" value="video.mp4">
          <button id="btn-connect-url" class="bg-inverse-primary hover:bg-primary-container text-white px-2 rounded text-[9px] font-bold transition-colors">CONNECT</button>
       </div>
    </div>
  </div>

  <!-- Render Settings -->
  <div class="bg-surface-container-lowest rounded border border-outline-variant/30 p-2 space-y-2 mt-2">
    <div class="flex items-center justify-between">
      <span class="text-label-mono-xs font-label-mono-xs uppercase tracking-wider text-on-surface-variant">Render Matrix</span>
    </div>
    <div class="space-y-2 text-[10px] font-label-mono-xs text-on-surface-variant">
      <div class="flex justify-between items-center">
         <span>Contrast</span>
         <input type="range" id="filter-contrast" class="w-20 h-1 bg-surface-container-highest appearance-none bg-transparent accent-inverse-primary" min="0.1" max="3.0" step="0.05" value="1.0" />
      </div>
      <div class="flex justify-between items-center">
         <span>Brightness</span>
         <input type="range" id="filter-brightness" class="w-20 h-1 bg-surface-container-highest appearance-none bg-transparent accent-inverse-primary" min="-100" max="100" step="1" value="0" />
      </div>
      <div class="flex justify-between items-center">
         <span>Gamma</span>
         <input type="range" id="filter-gamma" class="w-20 h-1 bg-surface-container-highest appearance-none bg-transparent accent-inverse-primary" min="0.1" max="3.0" step="0.05" value="1.0" />
      </div>
      <div class="flex justify-between items-center">
         <span>Pixel Mode</span>
         <input type="checkbox" id="filter-pixel" class="form-checkbox bg-surface-container text-inverse-primary border-outline-variant/50 rounded" />
      </div>
    </div>
  </div>
"""
html = html.replace('<!-- Telemetry Diagnostic Gauges -->', controls_injection + '\n  <!-- Telemetry Diagnostic Gauges -->')

# 3. Fix up Telemetry text mapping
html = html.replace('GPU 38% • VRAM 14.2 GB • Playback 24.0 fps locked', 
'<span id="connection-text" class="text-error font-bold">DISCONNECTED</span> • <span id="perf-inflight">0</span> IN-FLIGHT • <span id="perf-fps">0</span> FPS')

html = html.replace('24.000 fps', '<span id="meta-fps">-</span> fps')
html = html.replace('3840 × 2160 DCI 4K', '<span id="meta-res">-</span>')

# 4. Connect sparkline
html = html.replace('<div class="flex items-center space-x-1 border border-white/5 bg-black/50 p-1 rounded">',
'<div class="flex items-center space-x-1 border border-white/5 bg-black/50 p-1 rounded hidden">') # hide old fake sparkline bars
html = html.replace('<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>',
'<canvas id="sparkline-canvas" class="h-4 w-20 bg-surface border border-outline-variant/30 rounded"></canvas><span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping ml-2"></span>')

html = html.replace('16.6ms', '<span id="hud-fps">0</span>ms')

# 5. Playback Transport
html = html.replace('01:14:32:18 <span class="text-outline/70">/ 02:45:00:00</span>',
'<span id="time-current">00:00:00:00</span> <span class="text-outline/70">/ <span id="time-total">00:00:00:00</span></span>')

# Play/pause button ID
html = html.replace('<button class="w-8 h-8 mx-1 rounded-full bg-inverse-primary hover:bg-primary-container text-white flex items-center justify-center shadow-lg hover:shadow-primary/20 transition-all active:scale-95" title="Play / Pause [Space]">',
'<button id="play-pause-btn" class="w-8 h-8 mx-1 rounded-full bg-inverse-primary hover:bg-primary-container text-white flex items-center justify-center shadow-lg hover:shadow-primary/20 transition-all active:scale-95" title="Play / Pause [Space]"><span class="material-symbols-outlined text-[18px]" id="icon-play" style="font-variation-settings: \'FILL\' 1;">play_arrow</span><span class="material-symbols-outlined text-[18px] hidden" id="icon-pause" style="font-variation-settings: \'FILL\' 1;">pause</span></button><button class="hidden">')

# 6. Scrubber IDs
html = html.replace('<div class="w-full h-10 bg-surface-container-highest relative flex items-center cursor-pointer group">',
'<div id="seek-wrap" class="w-full h-10 bg-surface-container-highest relative flex items-center cursor-pointer group">')

html = html.replace('<div class="absolute left-0 bottom-0 h-full bg-inverse-primary rounded-r shadow-[0_0_8px_rgba(99,102,241,0.6)] w-1/3"></div>',
'<div id="seek-played" class="absolute left-0 bottom-0 h-full bg-inverse-primary rounded-r shadow-[0_0_8px_rgba(99,102,241,0.6)] w-0 pointer-events-none"></div>')

html = html.replace('<div class="absolute left-1/3 bottom-0 top-0 w-px bg-white shadow-[0_0_12px_rgba(255,255,255,1)] z-10">',
'<div id="seek-thumb" class="absolute left-0 bottom-0 top-0 w-px bg-white shadow-[0_0_12px_rgba(255,255,255,1)] z-10 pointer-events-none">')

html = html.replace('<div class="absolute left-1/3 top-10 flex flex-col items-center -ml-8 opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none">',
'<input type="range" id="seek-slider" class="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-20" min="0" max="100" value="0" /><div class="absolute left-1/3 top-10 flex flex-col items-center -ml-8 opacity-0 transition-opacity z-20 pointer-events-none hidden">')

# 7. Append Scripts
html = html.replace('</body>', '<input type="file" id="file-upload-input" class="hidden" accept=".mp4,.webm,.mkv" /><script src="/static/codec.js"></script><script src="app.js"></script></body>')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)

print("Professional UI parsed and index.html generated successfully.")
