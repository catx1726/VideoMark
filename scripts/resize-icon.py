#!/usr/bin/env python3
"""
Resize the master icon (1024x1024) to standard extension icon sizes.
Also removes the white background by flood-filling from corners.
"""

import os
from collections import deque
from PIL import Image

SRC = os.path.join(os.path.dirname(__file__), '..', 'assets', 'icon-1.png')
OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'extension', 'assets')
SIZES = [16, 48, 128, 512]

def remove_white_bg(img: Image.Image) -> Image.Image:
    """Flood-fill from image corners to remove white background, keep foreground."""
    rgba = img.convert('RGBA')
    pixels = rgba.load()
    w, h = rgba.size

    # Threshold for "white" background
    THRESHOLD = 250

    # Visited mask
    visited = [[False] * h for _ in range(w)]
    queue = deque()

    # Seed from all four corners
    corners = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]
    for cx, cy in corners:
        r, g, b, a = pixels[cx, cy]
        if r >= THRESHOLD and g >= THRESHOLD and b >= THRESHOLD and a > 0:
            visited[cx][cy] = True
            queue.append((cx, cy))

    # 4-direction flood fill
    while queue:
        x, y = queue.popleft()
        r, g, b, a = pixels[x, y]
        # Mark as transparent
        pixels[x, y] = (r, g, b, 0)

        for dx, dy in [(1, 0), (-1, 0), (0, 1), (0, -1)]:
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h and not visited[nx][ny]:
                nr, ng, nb, na = pixels[nx, ny]
                if nr >= THRESHOLD and ng >= THRESHOLD and nb >= THRESHOLD and na > 0:
                    visited[nx][ny] = True
                    queue.append((nx, ny))

    return rgba

def main():
    if not os.path.exists(SRC):
        print(f'Source not found: {SRC}')
        return

    os.makedirs(OUT_DIR, exist_ok=True)

    master = Image.open(SRC)
    print(f'Loaded master: {master.size} mode={master.mode}')

    # Remove white background
    transparent = remove_white_bg(master)
    preview_path = os.path.join(OUT_DIR, 'icon-1024-transparent.png')
    transparent.save(preview_path, 'PNG')
    print(f'Saved transparent preview: {preview_path}')

    # Resize to all sizes using LANCZOS for smooth downscaling
    for s in SIZES:
        resized = transparent.resize((s, s), Image.LANCZOS)
        filepath = os.path.join(OUT_DIR, f'icon-{s}.png')
        resized.save(filepath, 'PNG')
        print(f'Generated: {filepath}')

    # Manifest paths (16, 48, 128)
    manifest_dir = os.path.join(OUT_DIR, 'icon')
    os.makedirs(manifest_dir, exist_ok=True)
    for s in [16, 48, 128]:
        src_img = Image.open(os.path.join(OUT_DIR, f'icon-{s}.png'))
        dst = os.path.join(manifest_dir, f'{s}.png')
        src_img.save(dst, 'PNG')
        print(f'Manifest: {dst}')

    print(f'\nAll done → {os.path.abspath(OUT_DIR)}')

if __name__ == '__main__':
    main()
