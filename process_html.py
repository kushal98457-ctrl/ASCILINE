import re

with open('stitch_ui.html', 'r', encoding='utf-8') as f:
    html = f.read()

html = html.replace('<img class="absolute inset-0', '<canvas id="ascii-canvas" class="absolute inset-0 w-full h-full object-cover z-10" style="image-rendering: pixelated;"></canvas><pre id="ascii-player" class="absolute inset-0 w-full h-full object-cover z-10 font-mono text-[8px] leading-[8px] font-bold text-transparent select-text" style="display:none;"></pre><audio id="ascii-audio"></audio><img class="absolute inset-0 hidden')

html = html.replace('120FPS SYNC</span>', '120FPS SYNC</span><span id="connection-text" class="ml-4 text-xs font-bold text-error">DISCONNECTED</span>')

html = html.replace('COMPILE_PIPELINE', 'CONNECT_UPLINK')
html = html.replace('bg-primary-container text-on-primary-fixed font-label-caps text-[10px] font-bold tracking-wider hover:bg-primary-fixed-dim transition-none"', 'bg-primary-container text-on-primary-fixed font-label-caps text-[10px] font-bold tracking-wider hover:bg-primary-fixed-dim transition-none" id="btn-stream-connect"')

html = html.replace('border border-dashed border-primary-container/60', 'border border-dashed border-primary-container/60" id="upload-dropzone')

html = html.replace('id="btn-stream-connect">\n                [CONNECT]\n              </button>', 'id="btn-connect-url">\n                [CONNECT]\n              </button>')
html = html.replace('<input class="w-full bg-transparent', '<input id="url-input" class="w-full bg-transparent')

html = html.replace('3840x2160 @ 60.00fps', '<span id="meta-res">-</span> @ <span id="meta-fps">-</span> fps')

html = html.replace('''<div class="relative flex items-center">
<div class="w-full h-1 bg-surface-container-highest">
<div class="h-full bg-secondary-container w-3/4"></div>
</div>
<div class="absolute left-3/4 -ml-1.5 w-3 h-3 bg-primary-container glow-cyan cursor-pointer"></div>
</div>''', '<input type="range" id="filter-contrast" class="w-full h-1 bg-surface-container-highest appearance-none bg-transparent accent-primary-container" min="0.1" max="3.0" step="0.05" value="1.0" />')

html = html.replace('''<div class="relative flex items-center">
<div class="w-full h-1 bg-surface-container-highest">
<div class="h-full bg-secondary-container w-[78%]"></div>
</div>
<div class="absolute left-[78%] -ml-1.5 w-3 h-3 bg-primary-container glow-cyan cursor-pointer"></div>
</div>''', '<input type="range" id="filter-brightness" class="w-full h-1 bg-surface-container-highest appearance-none bg-transparent accent-primary-container" min="-100" max="100" step="1" value="0" />')

html = html.replace('''<div class="relative flex items-center">
<div class="w-full h-1 bg-surface-container-highest">
<div class="h-full bg-secondary-container w-[45%]"></div>
</div>
<div class="absolute left-[45%] -ml-1.5 w-3 h-3 bg-primary-container glow-cyan cursor-pointer"></div>
</div>''', '<input type="range" id="filter-gamma" class="w-full h-1 bg-surface-container-highest appearance-none bg-transparent accent-primary-container" min="0.1" max="3.0" step="0.05" value="1.0" />')

html = html.replace('<span class="bg-secondary-container text-on-secondary font-label-caps text-[9px] px-1.5 py-0.5 font-bold">[ON]</span>', '<input type="checkbox" id="filter-pixel" class="form-checkbox bg-surface-container-highest text-primary-container border-outline-variant rounded-none" />')

html = html.replace('<div class="h-6 w-full bg-surface-container-lowest border border-outline-variant flex items-end p-0.5 gap-1">', '<canvas id="sparkline-canvas" class="h-6 w-full bg-surface-container-lowest border border-outline-variant"></canvas><div class="hidden">')

html = html.replace('16.6 ms</span>', '<span id="hud-fps">0</span> ms</span>')
html = html.replace('60.0 FPS [LOCKED]</span>', '<span id="perf-fps">0</span> FPS</span>')

html = html.replace('00:04:18:22 <span class="text-outline text-sm">/ 00:12:45:00</span>', '<span id="time-current">00:00:00</span> <span class="text-outline text-sm">/ <span id="time-total">00:00:00</span></span>')

html = html.replace('<button class="w-10 h-10 bg-primary-container text-on-primary-fixed hover:bg-primary-fixed-dim glow-cyan flex items-center justify-center transition-none mx-1 font-bold" title="Toggle Playback">', '<button id="play-pause-btn" class="w-10 h-10 bg-primary-container text-on-primary-fixed hover:bg-primary-fixed-dim glow-cyan flex items-center justify-center transition-none mx-1 font-bold" title="Toggle Playback"><span class="material-symbols-outlined text-2xl" id="icon-play" style="font-variation-settings: \'FILL\' 1;">play_arrow</span><span class="material-symbols-outlined text-2xl hidden" id="icon-pause" style="font-variation-settings: \'FILL\' 1;">pause</span></button><button class="hidden">')

html = html.replace('<div class="relative w-full h-2 bg-surface-container-highest">', '<div class="relative w-full h-2 bg-surface-container-highest" id="seek-wrap">')
html = html.replace('<div class="absolute left-[34%] -ml-1.5 -top-1 w-3 h-4 bg-primary-container glow-cyan cursor-ew-resize"></div>', '<input type="range" id="seek-slider" class="absolute top-0 left-0 w-full h-full opacity-0 cursor-ew-resize z-10" min="0" max="100" value="0" /><div id="seek-thumb" class="absolute left-[0%] -ml-1.5 -top-1 w-3 h-4 bg-primary-container glow-cyan pointer-events-none"></div>')
html = html.replace('<div class="absolute left-0 top-0 h-full bg-secondary-container w-[34%]"></div>', '<div id="seek-played" class="absolute left-0 top-0 h-full bg-secondary-container w-[0%]"></div>')

html = html.replace('<div class="absolute left-0 top-0 h-full bg-secondary-container/40 w-3/5 glow-green"></div>', '')
html = html.replace('14.2</span>/24.0 GB', '<span id="perf-buffer">0</span> B</span')
html = html.replace('<span class="text-on-surface">120FPS SYNC</span>', '<span class="text-on-surface" id="perf-inflight">0</span> IN-FLIGHT')

html = html.replace('</body>', '<input type="file" id="file-upload-input" class="hidden" accept=".mp4,.webm,.mkv" /><script src="/static/codec.js"></script><script src="app.js"></script></body>')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)

print("index.html rewritten successfully.")
