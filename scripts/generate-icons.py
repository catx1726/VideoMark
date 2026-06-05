#!/usr/bin/env python3
"""
Generate VideoMark extension icons.
Design: A classic map-pin shape (rounded top + tapered bottom)
with a white play triangle inside.
"""

import math
import os
from PIL import Image, ImageDraw

SIZES = [16, 48, 128, 512]
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'extension', 'assets')
os.makedirs(OUTPUT_DIR, exist_ok=True)

PRIMARY = (59, 130, 246)       # #3B82F6
WHITE = (255, 255, 255)

def draw_pin_shape(draw, cx, cy, size, fill):
    """
    Classic map pin: a circle on top, tapering to a sharp point below.
    PIL coords: y increases downward. Angle 0 = right, 90 = down, 270 = up.
    """
    head_r = int(size * 0.30)
    head_cy = cy - int(size * 0.08)
    tip_y = cy + int(size * 0.44)

    # Arc from left-bottom (135°) up over the top (270°) to right-bottom (45°)
    # We step clockwise from 135° all the way around to 405° (=45°)
    arc_points = []
    steps = 60
    start_deg = 135
    end_deg = 405  # 45° + 360°
    for i in range(steps + 1):
        deg = start_deg + (end_deg - start_deg) * i / steps
        rad = math.radians(deg)
        x = cx + head_r * math.cos(rad)
        y = head_cy + head_r * math.sin(rad)  # sin(270°) = -1 -> y above center, correct!
        arc_points.append((x, y))

    # Taper: from right-bottom arc endpoint to tip to left-bottom arc start
    # Add mid-taper points for a slightly curved, organic feel
    taper_w = head_r * 0.35
    left_mid = (cx - taper_w, head_cy + head_r + int(size * 0.06))
    right_mid = (cx + taper_w, head_cy + head_r + int(size * 0.06))

    # Build full polygon: arc (left-bottom → top → right-bottom)
    # then taper inward to tip
    points = arc_points[:]                     # arc: left → top → right
    points.append(right_mid)                   # curve inward
    points.append((cx, tip_y))                 # sharp tip
    points.append(left_mid)                    # curve inward
    # close back to first arc point automatically via polygon

    draw.polygon(points, fill=fill)

def draw_play_triangle(draw, cx, cy, size, color):
    """Centered play triangle."""
    h = int(size * 0.20)
    w = int(h * 0.88)
    off = int(w * 0.20)  # optical centering
    draw.polygon([
        (cx - w // 2 + off, cy - h // 2),
        (cx - w // 2 + off, cy + h // 2),
        (cx + w // 2 + off, cy),
    ], fill=color)

def draw_gloss(draw, cx, cy, size):
    """Subtle upper-left highlight ellipse."""
    r = int(size * 0.30)
    head_cy = cy - int(size * 0.08)
    rx, ry = int(r * 0.38), int(r * 0.25)
    gx, gy = cx - int(r * 0.12), head_cy - int(r * 0.25)
    draw.ellipse([gx - rx, gy - ry, gx + rx, gy + ry], fill=(255, 255, 255, 50))

def draw_tip_ring(draw, cx, cy, size):
    """Small ring at the pin tip."""
    tip_y = cy + int(size * 0.44)
    rr = max(2, int(size * 0.035))
    draw.ellipse([cx - rr - 1, tip_y - rr - 1, cx + rr + 1, tip_y + rr + 1], fill=WHITE)
    draw.ellipse([cx - rr, tip_y - rr, cx + rr, tip_y + rr], fill=PRIMARY)

def create_icon(size):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    cx, cy = size // 2, size // 2

    # Drop shadow
    if size >= 32:
        off = max(1, size // 35)
        shadow = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        draw_pin_shape(ImageDraw.Draw(shadow), cx + off, cy + off, size, (0, 0, 0, 40))
        img = Image.alpha_composite(img, shadow)
        draw = ImageDraw.Draw(img)

    # Main body
    draw_pin_shape(draw, cx, cy, size, PRIMARY)

    # Gloss
    if size >= 48:
        gloss = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        draw_gloss(ImageDraw.Draw(gloss), cx, cy, size)
        img = Image.alpha_composite(img, gloss)
        draw = ImageDraw.Draw(img)

    # Play triangle (slightly above geometric center because head is top-heavy)
    draw_play_triangle(draw, cx, cy - int(size * 0.04), size, WHITE)

    # Tip ring
    if size >= 32:
        ring = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        draw_tip_ring(ImageDraw.Draw(ring), cx, cy, size)
        img = Image.alpha_composite(img, ring)

    return img

def main():
    for s in SIZES:
        icon = create_icon(s)
        filepath = os.path.join(OUTPUT_DIR, f'icon-{s}.png')
        icon.save(filepath, 'PNG')
        print(f'Generated: {filepath}')

    manifest_dir = os.path.join(OUTPUT_DIR, 'icon')
    os.makedirs(manifest_dir, exist_ok=True)
    for s in [16, 48, 128]:
        src = Image.open(os.path.join(OUTPUT_DIR, f'icon-{s}.png'))
        dst = os.path.join(manifest_dir, f'{s}.png')
        src.save(dst, 'PNG')
        print(f'Manifest: {dst}')

    print(f'\nDone → {os.path.abspath(OUTPUT_DIR)}')

if __name__ == '__main__':
    main()
