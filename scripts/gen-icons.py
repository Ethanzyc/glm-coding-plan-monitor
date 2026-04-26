"""Generate extension icons — simple "G" with quota arc."""
from PIL import Image, ImageDraw


def create_icon(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    pad = max(size * 0.02, 1)
    cr = size * 0.22

    # Black rounded square background
    draw.rounded_rectangle(
        [pad, pad, size - pad, size - pad],
        radius=cr, fill="#111111",
    )

    cx, cy = size * 0.50, size * 0.50
    ring_r = size * 0.30
    lw = max(size * 0.06, 2)

    # Track (dark gray ring)
    bbox = [cx - ring_r, cy - ring_r, cx + ring_r, cy + ring_r]
    draw.arc(bbox, start=0, end=360, fill="#333333", width=int(lw))

    # Foreground arc (cyan, ~75% filled to suggest "mostly used")
    draw.arc(bbox, start=90, end=360, fill="#22D3EE", width=int(lw))

    # "G" letter in center
    if size >= 48:
        font_size = int(size * 0.28)
        try:
            from PIL import ImageFont
            font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", font_size)
        except (OSError, ImportError):
            font = ImageFont.load_default()
        text = "G"
        tb = draw.textbbox((0, 0), text, font=font)
        tw, th = tb[2] - tb[0], tb[3] - tb[1]
        tx = cx - tw / 2
        ty = cy - th / 2 - size * 0.01
        draw.text((tx, ty), text, fill="#FFFFFF", font=font)
    else:
        # Small dot for 16px
        dr = size * 0.10
        draw.ellipse([cx - dr, cy - dr, cx + dr, cy + dr], fill="#FFFFFF")

    return img


for s in [16, 48, 128]:
    create_icon(s).save(f"icons/icon-{s}.png")
    print(f"icon-{s}.png")

import shutil
for s in [16, 48, 128]:
    src = f"icons/icon-{s}.png"
    dst = f"dist/icons/icon-{s}.png"
    try:
        shutil.copy2(src, dst)
    except FileNotFoundError:
        pass
