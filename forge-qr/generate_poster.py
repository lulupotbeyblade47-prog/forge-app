"""Render an A4 classroom poster using the generated Forge QR code."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).parent
W, H = 2480, 3508  # A4 at 300 dpi
INK = "#111211"
ORANGE = "#FF6B35"
MUTED = "#5F605C"
PAPER = "#F8F7F2"
FONT = "/System/Library/Fonts/Supplemental/Arial.ttf"
FONT_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"

image = Image.new("RGB", (W, H), PAPER)
draw = ImageDraw.Draw(image)

def font(path, size):
    return ImageFont.truetype(path, size)

def centered(text, y, use_font, fill):
    box = draw.textbbox((0, 0), text, font=use_font)
    draw.text(((W - (box[2] - box[0])) / 2, y), text, font=use_font, fill=fill)

draw.rounded_rectangle((95, 95, W - 95, H - 95), radius=75, outline="#D9D7D0", width=5)
draw.rounded_rectangle((W // 2 - 22, 205, W // 2 + 22, 265), radius=18, fill=ORANGE)
centered("FORGE", 300, font(FONT_BOLD, 105), INK)
centered("TON ENTRAÎNEMENT. À TON RYTHME.", 550, font(FONT_BOLD, 120), INK)
centered("Scanne le QR code pour accéder à Forge.", 725, font(FONT, 66), MUTED)

qr = Image.open(ROOT / "forge-qr.png").convert("RGB")
qr_side = 1500
qr = qr.resize((qr_side, qr_side), Image.Resampling.NEAREST)
x0 = (W - qr_side) // 2
y0 = 920
draw.rounded_rectangle((x0 - 34, y0 - 34, x0 + qr_side + 34, y0 + qr_side + 34),
                       radius=52, fill="white", outline="#E4E2DB", width=5)
image.paste(qr, (x0, y0))

centered("SCANNER POUR OUVRIR", 2520, font(FONT_BOLD, 72), ORANGE)

box_y = 2680
box_h = 250
left, right = 190, W - 190
gap = 40
box_w = (right - left - gap) // 2
for x, title, subtitle in (
    (left, "iPHONE", "Version web"),
    (left + box_w + gap, "ANDROID", "APK ou version web"),
):
    draw.rounded_rectangle((x, box_y, x + box_w, box_y + box_h), radius=36,
                           fill="white", outline="#D9D7D0", width=5)
    title_font = font(FONT_BOLD, 55)
    subtitle_font = font(FONT, 42)
    draw.text((x + 35, box_y + 48), title, font=title_font, fill=INK)
    draw.text((x + 35, box_y + 135), subtitle, font=subtitle_font, fill=MUTED)

centered("forge-e1f5b.web.app", 3050, font(FONT_BOLD, 48), INK)
centered("Aucune installation automatique : tu choisis sur ton téléphone.",
         3140, font(FONT, 34), MUTED)

output = ROOT / "affiche-forge-a4.png"
image.save(output, dpi=(300, 300), optimize=True)
print(f"Affiche prête : {output} — A4, 300 dpi")
