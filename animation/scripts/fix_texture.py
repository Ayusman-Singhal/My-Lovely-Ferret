# fix_texture.py: paints over Blockbench's blue/yellow "hidden face" marker pixels
# (they show when the tail or head turns far) with the nearest fur colour.
# Safe to run more than once. Saves the packed texture and source/coat_sable.png.
import bpy, os, zlib, struct
ROOT = r"D:\The-Game\animation"
img = bpy.data.images["Image_0"]; W, H = img.size
px = list(img.pixels)
def idx(c, r): return ((H - 1 - r) * W + c) * 4          # r counted from the top
def is_marker(c, r):
    i = idx(c, r); R, G, B, A = [v * 255 for v in px[i:i + 4]]
    return A > 0 and ((B > R + 40) or (R > 200 and G > 180 and B < 150))
KEEP = {(48, 2), (50, 2), (52, 2), (40, 2), (41, 2), (44, 2), (45, 2)}   # colours added by build_rig
marks = {(c, r) for r in range(H) for c in range(W) if is_marker(c, r) and (c, r) not in KEEP}
fixed = 0
while marks:
    done = set()
    for (c, r) in marks:
        cols = []
        for dc, dr in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1)):
            n = (c + dc, r + dr)
            if 0 <= n[0] < W and 0 <= n[1] < H and n not in marks:
                i = idx(*n)
                if px[i + 3] > 0: cols.append(px[i:i + 4])
        if cols:
            i = idx(c, r)
            px[i:i + 4] = [sum(cc[k] for cc in cols) / len(cols) for k in range(3)] + [1.0]
            done.add((c, r))
    if not done: break
    marks -= done; fixed += len(done)
img.pixels = px; img.update(); img.pack()
def write_png(path, flat, w, h):
    raw = bytearray()
    for row in range(h):
        raw.append(0); base = (h - 1 - row) * w * 4
        for i in range(w * 4): raw.append(max(0, min(255, round(flat[base + i] * 255))))
    def chunk(t, d): return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    open(path, "wb").write(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
                           + chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + chunk(b"IEND", b""))
write_png(os.path.join(ROOT, "source", "coat_sable.png"), px, W, H)
bpy.ops.wm.save_mainfile()
print("TEXTURE FIXED, pixels repainted:", fixed)
