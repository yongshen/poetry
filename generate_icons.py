#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
诗泉 · 背诗 —— PWA 图标生成脚本
生成 assets/icon-192.png 与 assets/icon-512.png（朱砂印章「詩」）

用法：python generate_icons.py
依赖：Pillow（pip install Pillow）
"""
import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(HERE, "assets")

CINNABAR = (158, 43, 30)      # #9E2B1E
WHITE = (255, 246, 239)       # #FFF6EF

# 尝试找到一款能渲染中文的字体
FONT_CANDIDATES = [
    r"C:\Windows\Fonts\simkai.ttf",
    r"C:\Windows\Fonts\kaiu.ttf",
    r"C:\Windows\Fonts\msyh.ttc",
    r"C:\Windows\Fonts\msyhbd.ttc",
    r"C:\Windows\Fonts\simhei.ttf",
    "/System/Library/Fonts/STHeiti Light.ttc",
    "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
]


def find_font(size):
    for p in FONT_CANDIDATES:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                continue
    return None


def make_icon(size):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # 圆角背景
    radius = int(size * 0.22)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=CINNABAR)

    # 内圈描边
    ring = int(size * 0.065)
    inset = int(size * 0.10)
    d.rounded_rectangle(
        [inset, inset, size - 1 - inset, size - 1 - inset],
        radius=radius - inset // 2,
        outline=(255, 246, 239, 90),
        width=ring,
    )

    # 中央「詩」字
    font = find_font(int(size * 0.52))
    if font:
        text = "詩"
        # 使用 textbbox 精确居中
        bbox = d.textbbox((0, 0), text, font=font)
        w = bbox[2] - bbox[0]
        h = bbox[3] - bbox[1]
        x = (size - w) / 2 - bbox[0]
        y = (size - h) / 2 - bbox[1]
        d.text((x, y), text, font=font, fill=WHITE)

    return img


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    for size in (192, 512):
        path = os.path.join(OUT_DIR, f"icon-{size}.png")
        make_icon(size).save(path, "PNG")
        print("生成", path)


if __name__ == "__main__":
    main()
