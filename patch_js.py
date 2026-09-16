import re

with open('app.js', 'r', encoding='utf-8') as f:
    js = f.read()

# Make all DOM elements nullable safely, or at least avoid errors on null
# For example: if (el) el.style...
# I'll just add a helper function for safe UI updates
patch = """
function safeSet(id, prop, val) {
    const el = document.getElementById(id);
    if(el) {
        if(prop === 'text') el.textContent = val;
        else if(prop === 'display') el.style.display = val;
        else if(prop === 'class') el.className = val;
        else if(prop === 'value') el.value = val;
    }
}
"""

# Let's just do targeted replacements in app.js using regex
js = js.replace('document.getElementById(\'overlay-title\').textContent', 'if(document.getElementById("overlay-title")) document.getElementById("overlay-title").textContent')
js = js.replace('document.getElementById(\'overlay-subtitle\').textContent', 'if(document.getElementById("overlay-subtitle")) document.getElementById("overlay-subtitle").textContent')
js = js.replace('playOverlay.classList.', 'if(playOverlay) playOverlay.classList.')
js = js.replace('playOverlay.style.', 'if(playOverlay) playOverlay.style.')
js = js.replace('modeBadge.', 'if(modeBadge) modeBadge.')
js = js.replace('hudOverlay.classList', 'if(hudOverlay) hudOverlay.classList')

# Seek thumb update
js = js.replace('seekPlayed.style.transform = `scaleX(${Math.min(1, masterClock / duration)})`;', 'seekPlayed.style.width = `${Math.min(100, (masterClock / duration)*100)}%`; if(document.getElementById("seek-thumb")) document.getElementById("seek-thumb").style.left = `${Math.min(100, (masterClock / duration)*100)}%`;')

js = js.replace('seekPlayed.style.transform = `scaleX(${Math.min(1, seekSlider.value / duration)})`;', 'seekPlayed.style.width = `${Math.min(100, (seekSlider.value / duration)*100)}%`; if(document.getElementById("seek-thumb")) document.getElementById("seek-thumb").style.left = `${Math.min(100, (seekSlider.value / duration)*100)}%`;')

js = js.replace('seekPlayed.style.transform = \'scaleX(0)\';', 'seekPlayed.style.width = "0%"; if(document.getElementById("seek-thumb")) document.getElementById("seek-thumb").style.left = "0%";')

# Make missing elements not break event listeners
listeners = ['playOverlay', 'btnBack', 'btnFwd', 'btnPrev', 'btnNext', 'btnStreamConnect', 'btnStreamDisconnect', 'btnConnectUrl', 'filterReset', 'btnFullscreen', 'btnMute', 'volumeSlider', 'uploadDropzone', 'fileUploadInput', 'btnSidebarToggle', 'btnHeaderUpload']
for el in listeners:
    js = js.replace(f'{el}.addEventListener', f'if({el}) {el}.addEventListener')

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(js)

print("app.js patched.")
