#!/usr/bin/env python3
"""Rasterise the Logline app icons.

No image libraries in the toolchain, so this writes PNGs directly with
zlib + struct. The art is the product in one frame: a logged line
converging from the lower left, the craft at its head.

    python3 scripts/make-icons.py

Outputs into public/icons/. Re-run only when the mark changes.
"""

import math
import os
import struct
import zlib

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "icons")

VOID = (0x05, 0x08, 0x10)
TRAIL = (0x4a, 0x8f, 0xa0)
TRAIL_HOT = (0x6d, 0xc0, 0xd0)
CRAFT = (0xd8, 0xee, 0xf2)
LAMP = (0xe8, 0xb8, 0x7a)

SS = 4  # supersampling factor


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def dist_to_seg(px, py, x0, y0, x1, y1):
    dx, dy = x1 - x0, y1 - y0
    if dx == 0 and dy == 0:
        return math.hypot(px - x0, py - y0), 0.0
    t = ((px - x0) * dx + (py - y0) * dy) / (dx * dx + dy * dy)
    t = max(0.0, min(1.0, t))
    return math.hypot(px - (x0 + dx * t), py - (y0 + dy * t)), t


def in_poly(px, py, pts):
    inside = False
    n = len(pts)
    for i in range(n):
        x0, y0 = pts[i]
        x1, y1 = pts[(i + 1) % n]
        if (y0 > py) != (y1 > py):
            xint = x0 + (py - y0) * (x1 - x0) / (y1 - y0)
            if px < xint:
                inside = not inside
    return inside


def render(size, inset):
    """inset: fraction of the canvas the art is shrunk into (maskable safe zone)."""
    n = size * SS
    px = [[VOID for _ in range(n)] for _ in range(n)]

    c = n / 2.0
    span = n * inset

    def P(u, v):
        """Art space: u,v in -0.5..0.5, y down."""
        return (c + u * span, c + v * span)

    # The logged line: a curve sweeping up from the lower left, converging
    # as it recedes. Sampled fine enough that segment joins never show.
    path = []
    steps = 120
    for i in range(steps + 1):
        t = i / steps
        u = -0.46 + t * 0.70
        v = 0.40 - t * 0.62 + math.sin(t * math.pi * 0.9) * 0.10
        path.append(P(u, v))

    # Only pixels near the path matter, so walk segments and touch their
    # bounding boxes rather than testing every pixel against every segment.
    INF = float("inf")
    best_d = [INF] * (n * n)
    best_k = [0.0] * (n * n)
    for i in range(len(path) - 1):
        x0, y0 = path[i]
        x1, y1 = path[i + 1]
        k = (i + 1) / len(path)
        w = span * (0.006 + 0.021 * k * k)
        pad = w + SS + 1
        for y in range(max(0, int(min(y0, y1) - pad)), min(n, int(max(y0, y1) + pad) + 1)):
            base = y * n
            for x in range(max(0, int(min(x0, x1) - pad)), min(n, int(max(x0, x1) + pad) + 1)):
                d, _ = dist_to_seg(x + 0.5, y + 0.5, x0, y0, x1, y1)
                if d - w < best_d[base + x]:
                    best_d[base + x] = d - w
                    best_k[base + x] = k

    for y in range(n):
        row = px[y]
        base = y * n
        for x in range(n):
            edge = best_d[base + x]
            if edge >= SS:
                continue
            k = best_k[base + x]
            a = max(0.0, min(1.0, (SS - edge) / SS)) * (0.25 + 0.75 * k)
            if a <= 0:
                continue
            row[x] = lerp(row[x], lerp(TRAIL, TRAIL_HOT, k), a)

    # The craft at the head of the line: the same diamond the flight draws,
    # banked slightly so it reads as moving rather than parked.
    hx, hy = path[-1]
    roll = -0.30
    wing = span * 0.078 * math.cos(roll)
    nose = span * 0.178
    tail = span * 0.072
    body = [
        (hx, hy - nose),
        (hx + wing, hy + span * 0.010),
        (hx, hy + tail),
        (hx - wing, hy + span * 0.010),
    ]
    x_lo = max(0, int(hx - wing - 3))
    x_hi = min(n, int(hx + wing + 4))
    y_lo = max(0, int(hy - nose - 3))
    y_hi = min(n, int(hy + tail + 4))
    for y in range(y_lo, y_hi):
        for x in range(x_lo, x_hi):
            if in_poly(x + 0.5, y + 0.5, body):
                px[y][x] = CRAFT

    # A lamp-coloured spark of the projected line, ahead of the nose.
    for i in range(6):
        t = i / 6.0
        sx = hx + span * (0.055 + t * 0.11)
        sy = hy - nose - span * (0.02 + t * 0.10)
        r = span * 0.012 * (1 - t)
        a = 0.55 * (1 - t)
        for y in range(max(0, int(sy - r - 2)), min(n, int(sy + r + 3))):
            for x in range(max(0, int(sx - r - 2)), min(n, int(sx + r + 3))):
                d = math.hypot(x + 0.5 - sx, y + 0.5 - sy)
                if d <= r + SS:
                    k = max(0.0, min(1.0, (r + SS - d) / SS)) * a
                    px[y][x] = lerp(px[y][x], LAMP, k)

    # Box-downsample the supersampled buffer.
    out = bytearray()
    for y in range(size):
        out.append(0)  # PNG filter: none
        for x in range(size):
            r = g = b = 0
            for sy in range(SS):
                srow = px[y * SS + sy]
                for sx in range(SS):
                    p = srow[x * SS + sx]
                    r += p[0]
                    g += p[1]
                    b += p[2]
            k = SS * SS
            out += bytes((r // k, g // k, b // k))
    return bytes(out)


def write_png(path, size, raw):
    def chunk(tag, data):
        c = tag + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(png)
    print(f"  {os.path.relpath(path)}  {len(png):,} bytes")


def main():
    os.makedirs(OUT, exist_ok=True)
    jobs = [
        ("icon-192.png", 192, 0.86),
        ("icon-512.png", 512, 0.86),
        ("maskable-512.png", 512, 0.60),  # art inside the 80% safe circle
        ("apple-touch-icon.png", 180, 0.86),
        ("favicon-32.png", 32, 0.92),
    ]
    print("rendering icons ->", os.path.relpath(OUT))
    for name, size, inset in jobs:
        write_png(os.path.join(OUT, name), size, render(size, inset))


if __name__ == "__main__":
    main()
