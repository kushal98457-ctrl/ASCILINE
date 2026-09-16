import os

readme_path = 'README.md'
with open(readme_path, 'r', encoding='utf-8') as f:
    readme = f.read()

injection = """
<div align="center">
  <img src="assets/demo-ui.png" width="100%" style="border-radius: 8px; box-shadow: 0 4px 24px rgba(0,0,0,0.5);" alt="Aura Studio UI"/>
</div>

---

## 🎞️ Processing Fidelity (Input vs Output)

ASCILINE's adaptive `NumPy` quantization engine guarantees high-precision perceptual luminance mapping, preserving complex gradients, shadows, and sharp edges even at low terminal column widths. 

<div align="center">
  <table>
    <tr>
      <td align="center"><b>Source Media (Original H.264)</b></td>
      <td align="center"><b>ASCILINE Render (ASCII Mode 4)</b></td>
    </tr>
    <tr>
      <td width="50%"><img src="assets/demo-input.jpg" style="border-radius: 4px;" alt="Input Video"/></td>
      <td width="50%"><img src="assets/demo-output.jpg" style="border-radius: 4px;" alt="Output Render"/></td>
    </tr>
  </table>
</div>
"""

# Replace the existing UI section
readme = readme.replace("""<div align="center">
  <img src="assets/demo-ui.png" width="100%" alt="ASCILINE UI"/>
</div>""", injection)

with open(readme_path, 'w', encoding='utf-8') as f:
    f.write(readme)

print("README updated successfully.")
