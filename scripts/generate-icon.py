from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
ASSETS.mkdir(exist_ok=True)

SIZE = 512
PADDING = 28
INNER = 84


def hex_to_rgb(value: str) -> tuple[int, int, int]:
    value = value.lstrip("#")
    return tuple(int(value[i : i + 2], 16) for i in (0, 2, 4))


def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def gradient_color(t: float) -> tuple[int, int, int, int]:
    start = hex_to_rgb("#6ee7b7")
    mid = hex_to_rgb("#54d4d7")
    end = hex_to_rgb("#38bdf8")
    if t < 0.5:
      local_t = t / 0.5
      left = start
      right = mid
    else:
      local_t = (t - 0.5) / 0.5
      left = mid
      right = end
    return tuple(round(lerp(left[i], right[i], local_t)) for i in range(3)) + (255,)


def build_logo() -> Image.Image:
    image = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    shadow = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    shadow_draw.ellipse(
        (44, 52, SIZE - 44, SIZE - 36),
        fill=(15, 23, 42, 44),
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(20))
    image.alpha_composite(shadow)

    gradient = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    pixels = gradient.load()
    center = SIZE / 2
    radius = (SIZE - PADDING * 2) / 2

    for y in range(SIZE):
        for x in range(SIZE):
            dx = x - center
            dy = y - center
            distance = (dx * dx + dy * dy) ** 0.5
            if distance <= radius:
                t = (x + y) / (2 * (SIZE - 1))
                pixels[x, y] = gradient_color(t)

    highlight = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    highlight_draw = ImageDraw.Draw(highlight)
    highlight_draw.ellipse((96, 88, 312, 220), fill=(255, 255, 255, 82))
    highlight = highlight.filter(ImageFilter.GaussianBlur(18))

    ring = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    ring_draw = ImageDraw.Draw(ring)
    ring_draw.ellipse(
        (PADDING, PADDING, SIZE - PADDING, SIZE - PADDING),
        outline=(255, 255, 255, 78),
        width=8,
    )

    inner_glow = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    inner_draw = ImageDraw.Draw(inner_glow)
    inner_draw.ellipse(
        (INNER, INNER, SIZE - INNER, SIZE - INNER),
        fill=(255, 255, 255, 14),
    )
    inner_glow = inner_glow.filter(ImageFilter.GaussianBlur(20))

    image.alpha_composite(gradient)
    image.alpha_composite(inner_glow)
    image.alpha_composite(highlight)
    image.alpha_composite(ring)
    return image


logo = build_logo()
png_path = ASSETS / "icon.png"
ico_path = ASSETS / "icon.ico"
logo.save(png_path)
logo.save(ico_path, sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)])

print(f"Created {png_path}")
print(f"Created {ico_path}")
