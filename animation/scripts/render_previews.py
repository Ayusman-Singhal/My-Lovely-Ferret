# render_previews.py: renders every clip from a 3/4 view and saves one sprite sheet per clip
# to scripts/qa/v2/<clip>.png (+ sheets.json). Read-only for the animation data.
#   exec(open(r'D:\The-Game\animation\scripts\render_previews.py').read())
import bpy, os, json, zlib, struct, math
import numpy as np
from mathutils import Vector
ROOT = r"D:\The-Game\animation"
OUT = os.path.join(ROOT, "scripts", "qa", "v2"); os.makedirs(OUT, exist_ok=True)
TMP = os.path.join(OUT, "_frame.png")
arm = bpy.data.objects["Armature"]; scn = bpy.context.scene
clips = json.load(open(os.path.join(ROOT, "clips.json")))["clips"]
ONLY = globals().get("ONLY")                # e.g. ONLY = ["walk"] before exec to render a subset
W, H, COLS = 240, 180, 8
r = scn.render; sh = scn.display.shading
saved = (r.engine, r.resolution_x, r.resolution_y, r.resolution_percentage, r.filepath, scn.camera,
         sh.light, sh.color_type, sh.show_shadows, sh.show_cavity)
r.engine = 'BLENDER_WORKBENCH'; r.resolution_x, r.resolution_y, r.resolution_percentage = W, H, 100
sh.light = 'STUDIO'; sh.color_type = 'TEXTURE'; sh.show_shadows = True; sh.show_cavity = True
cd = bpy.data.cameras.new("QA_prev"); cam = bpy.data.objects.new("QA_prev", cd); scn.collection.objects.link(cam)
cam.location = (0.80, -0.30, 0.26); target = Vector((0.0, -0.05, 0.075))
cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler(); cd.lens = 38
scn.camera = cam
def write_png(path, rgb):
    h, w, _ = rgb.shape
    raw = b"".join(b"\x00" + rgb[y].tobytes() for y in range(h))
    def chunk(t, d): return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    open(path, "wb").write(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
                           + chunk(b"IDAT", zlib.compress(raw, 6)) + chunk(b"IEND", b""))
meta = {}
for name, c in clips.items():
    if ONLY and name not in ONLY: continue
    N = c["frames"]; step = 1 if N <= 42 else 2
    frames = list(range(0, N if c["loop"] else N + 1, step))
    for pb in arm.pose.bones:
        pb.location = (0, 0, 0); pb.rotation_euler = (0, 0, 0); pb.scale = (1, 1, 1)
    arm.animation_data.action = bpy.data.actions[name]
    rows = math.ceil(len(frames) / COLS)
    sheet = np.zeros((rows * H, COLS * W, 3), dtype=np.uint8)
    for i, f in enumerate(frames):
        scn.frame_set(f); r.filepath = TMP
        bpy.ops.render.render(write_still=True)
        img = bpy.data.images.load(TMP, check_existing=False)
        a = np.array(img.pixels[:], dtype=np.float32).reshape(H, W, 4)[::-1, :, :3]
        bpy.data.images.remove(img)
        y, x = (i // COLS) * H, (i % COLS) * W
        sheet[y:y + H, x:x + W] = (np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8)
    write_png(os.path.join(OUT, name + ".png"), sheet)
    meta[name] = {"frames": frames, "step": step, "cols": COLS, "w": W, "h": H, "fps": 30 / step}
arm.animation_data.action = None
for pb in arm.pose.bones:
    pb.location = (0, 0, 0); pb.rotation_euler = (0, 0, 0); pb.scale = (1, 1, 1)
scn.frame_set(0)
bpy.data.objects.remove(cam, do_unlink=True); bpy.data.cameras.remove(cd)
(r.engine, r.resolution_x, r.resolution_y, r.resolution_percentage, r.filepath, scn.camera,
 sh.light, sh.color_type, sh.show_shadows, sh.show_cavity) = saved
if os.path.exists(TMP): os.remove(TMP)
old = {}
mp = os.path.join(OUT, "sheets.json")
if os.path.exists(mp): old = json.load(open(mp))
old.update(meta); json.dump(old, open(mp, "w"), indent=1)
print("PREVIEWS OK", list(meta))
