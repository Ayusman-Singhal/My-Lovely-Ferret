# build_rig.py: turns the imported Blockbench ferret into the rigged rest pose
# described in RIG_SPEC.md. Run ONCE in the open Ferret.blend (Python console):
#   exec(open(r'D:\The-Game\animation\scripts\build_rig.py').read())
# It first saves a backup to source/Ferret_before_rig.blend. To redo, open that
# backup, save it over Ferret.blend, and run again.
import bpy, bmesh, json, os, math
from mathutils import Vector, Matrix
import numpy as np

ROOT = r"D:\The-Game\animation"
REPORT = os.path.join(ROOT, "scripts", "build_report.json")
log = []
def say(*a):
    s = " ".join(str(x) for x in a); log.append(s); print(s)

if "Armature" in bpy.data.objects:
    raise SystemExit("Armature already exists: this file is already rigged. Restore source/Ferret_before_rig.blend to rebuild.")

# ---------------------------------------------------------------- 0. backup, scene
if bpy.context.mode != 'OBJECT':
    bpy.ops.object.mode_set(mode='OBJECT')
BACKUP = os.path.join(ROOT, "source", "Ferret_before_rig.blend")
if not os.path.exists(BACKUP):          # never overwrite the first, clean backup
    bpy.ops.wm.save_as_mainfile(filepath=BACKUP, copy=True)
if "cube" not in bpy.data.objects or bpy.data.objects["cube"].parent is None:
    raise SystemExit("Scene is not the clean import (a previous run was interrupted). Run restore_backup.py first.")
scn = bpy.context.scene
scn.render.fps = 30
scn.render.fps_base = 1.0
scn.unit_settings.system = 'METRIC'
scn.unit_settings.scale_length = 1.0

# Imported Blockbench boxes (pre-flip coordinates: nose toward +Y)
PART = {
    "cube": "legFR", "cube.001": "legFL", "cube.002": "legBL", "cube.003": "legBR",
    "cube.004": "body", "cube.005": "tail", "cube.006": "neck", "cube.007": "head",
    "cube.008": "nose", "cube.009": "earL", "cube.010": "earR",
}
objs = {}
for name, part in PART.items():
    o = bpy.data.objects.get(name)
    if o is None or o.type != 'MESH':
        raise SystemExit("Missing imported box " + name)
    objs[part] = o

def bbox(o):
    vs = [v.co for v in o.data.vertices]
    mn = Vector((min(v[i] for v in vs) for i in range(3)))
    mx = Vector((max(v[i] for v in vs) for i in range(3)))
    return mn, mx

# ---------------------------------------------------------------- 1. bake to world, undo the posed rotations
tail_rot = objs["tail"].matrix_world.to_quaternion()
UNROTATE = {"legFR", "legFL", "legBL", "legBR", "head", "nose", "earL", "earR"}
for part, o in objs.items():
    mw = o.matrix_world.copy()
    M = Matrix.Translation(mw.to_translation()) if part in UNROTATE else mw
    o.data.transform(M)
    o.parent = None
    o.matrix_world = Matrix.Identity(4)
    o.rotation_mode = 'XYZ'
    o.rotation_euler = (0, 0, 0)
    o.location = (0, 0, 0)
    o.scale = (1, 1, 1)
bpy.context.view_layer.update()

# legs: straight, feet on Z=0, symmetric front/back stance
for part in ("legFR", "legFL", "legBL", "legBR"):
    o = objs[part]; mn, mx = bbox(o); c = (mn + mx) / 2
    ty = (0.28 if c.y > 0 else -0.28) - c.y
    o.data.transform(Matrix.Translation((0, ty, -mn.z)))

# head group: level (done by unrotate) and centered on X
hmn, hmx = bbox(objs["head"]); hcx = (hmn.x + hmx.x) / 2
for part in ("head", "nose", "earL", "earR"):
    objs[part].data.transform(Matrix.Translation((-hcx, 0, 0)))
say("head recentered by", round(-hcx, 4))

# ---------------------------------------------------------------- 2. split the tail in two
axis = (tail_rot @ Vector((0, 1, 0))).normalized()
to = objs["tail"]
proj = [v.co.dot(axis) for v in to.data.vertices]
mid = (min(proj) + max(proj)) / 2
centroid = sum((v.co for v in to.data.vertices), Vector()) / len(to.data.vertices)
plane_co = centroid + axis * (mid - centroid.dot(axis))
tail_front = centroid + axis * (max(proj) - centroid.dot(axis))
tail_back = centroid + axis * (min(proj) - centroid.dot(axis))
t2 = to.copy(); t2.data = to.data.copy(); bpy.context.collection.objects.link(t2)

def cut(o, keep_positive):
    bm = bmesh.new(); bm.from_mesh(o.data)
    uv = bm.loops.layers.uv.active
    bm.faces.ensure_lookup_table()
    some_uv = bm.faces[0].loops[0][uv].uv.copy()
    geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
    bmesh.ops.bisect_plane(bm, geom=geom, plane_co=plane_co, plane_no=axis,
                           clear_inner=keep_positive, clear_outer=not keep_positive)
    boundary = [e for e in bm.edges if e.is_boundary]
    res = bmesh.ops.holes_fill(bm, edges=boundary, sides=0)
    for f in res["faces"]:
        for l in f.loops:
            l[uv].uv = some_uv
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    bm.to_mesh(o.data); bm.free(); o.data.update()
cut(to, True)      # front half (toward the body) -> tail1
cut(t2, False)     # back half -> tail2
objs["tail1"] = to; objs["tail2"] = t2
del objs["tail"]

# ---------------------------------------------------------------- 3. texture: move painted eyes onto eye boxes, add colours
img = bpy.data.images.get("Image_0")
if img is None or tuple(img.size) != (64, 64):
    raise SystemExit("Expected the 64x64 texture Image_0")
W = 64
px = list(img.pixels)
def get(col, row):   # row counted from the TOP of the PNG
    i = ((W - 1 - row) * W + col) * 4; return px[i:i + 4]
def put(col, row, rgba):
    i = ((W - 1 - row) * W + col) * 4; px[i:i + 4] = list(rgba)
def rgb(r, g, b): return (r / 255, g / 255, b / 255, 1.0)
EYE_SRC = {"a": (6, 37), "b": (11, 37)}      # 2x1 eye strips painted on the head front
EYE_DST = {"a": (40, 2), "b": (44, 2)}
for k in EYE_SRC:
    (sc, sr), (dc, dr) = EYE_SRC[k], EYE_DST[k]
    for dx in range(2):
        put(dc + dx, dr, get(sc + dx, sr))
MASK = rgb(88, 66, 49)
for k, (sc, sr) in EYE_SRC.items():
    for dx in range(2):
        put(sc + dx, sr, MASK)               # paint over the old painted eyes
PIX = {"pink": (48, 2), "cream": (50, 2), "mask": (52, 2)}
put(48, 2, rgb(229, 154, 160)); put(50, 2, rgb(245, 226, 211)); put(52, 2, MASK)
img.pixels = px
img.update()
img.pack()
def write_png(path, flat, w, h):
    import zlib, struct
    raw = bytearray()
    for row in range(h):                      # PNG rows go top to bottom
        raw.append(0)
        base = (h - 1 - row) * w * 4
        for i in range(w * 4):
            raw.append(max(0, min(255, round(flat[base + i] * 255))))
    def chunk(t, d): return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    data = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)) \
        + chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + chunk(b"IEND", b"")
    with open(path, "wb") as f: f.write(data)
png_path = os.path.join(ROOT, "source", "coat_sable.png")
write_png(png_path, px, W, W)
say("texture edited, packed, and saved to", png_path)
def pix_uv(name):
    c, r = PIX[name]; return ((c + 0.5) / W, 1 - (r + 0.5) / W)

# ---------------------------------------------------------------- 4. eye and jaw boxes
mat = objs["head"].data.materials[0]
ho = objs["head"]
hmn, hmx = bbox(ho)
# affine map (x, z) -> (u, v) from the head's front face (normal +Y before the flip)
uvl = ho.data.uv_layers.active.data
rows, U, V = [], [], []
for poly in ho.data.polygons:
    if poly.normal.y > 0.9:
        for li in poly.loop_indices:
            co = ho.data.vertices[ho.data.loops[li].vertex_index].co
            rows.append([co.x, co.z, 1.0]); U.append(uvl[li].uv[0]); V.append(uvl[li].uv[1])
A = np.array(rows)
cu = np.linalg.lstsq(A, np.array(U), rcond=None)[0]
cv = np.linalg.lstsq(A, np.array(V), rcond=None)[0]
Minv = np.linalg.inv(np.array([[cu[0], cu[1]], [cv[0], cv[1]]]))
def uv_to_xz(u, v):
    x, z = Minv @ (np.array([u, v]) - np.array([cu[2], cv[2]])); return x, z
def xz_to_uv(x, z):
    return (cu[0] * x + cu[1] * z + cu[2], cv[0] * x + cv[1] * z + cv[2])

def make_box(name, mn, mx, uv_fn):
    me = bpy.data.meshes.new(name); o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((mn[i] + (v.co[i] + 0.5) * (mx[i] - mn[i]) for i in range(3)))
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    uv = bm.loops.layers.uv.new("UVMap")
    for f in bm.faces:
        f.normal_update()
        for l in f.loops:
            l[uv].uv = uv_fn(f, l.vert.co)
    bm.to_mesh(me); bm.free()
    me.materials.append(mat)
    return o

front_y = hmx.y
for k, (sc, sr) in EYE_SRC.items():
    u0, u1 = sc / W, (sc + 2) / W
    v0, v1 = 1 - (sr + 1) / W, 1 - sr / W
    xa, za = uv_to_xz(u0, v0); xb, zb = uv_to_xz(u1, v1)
    mn = Vector((min(xa, xb), front_y - 0.004, min(za, zb)))
    mx = Vector((max(xa, xb), front_y + 0.016, max(za, zb)))
    du = (EYE_DST[k][0] - sc) / W; dv = (sr - EYE_DST[k][1]) / W
    def eye_uv(f, co, du=du, dv=dv):
        if f.normal.y > 0.9:
            u, v = xz_to_uv(co.x, co.z); return (u + du, v + dv)
        return pix_uv("mask")
    objs["eye_" + k] = make_box("eye_" + k, mn, mx, eye_uv)

nmn, nmx = bbox(objs["nose"])
jaw_mn = Vector((-0.0625, hmn.y + 0.19, hmn.z + 0.008))
jaw_mx = Vector((0.0625, nmx.y - 0.015, hmn.z + 0.040))
def jaw_uv(f, co):
    return pix_uv("pink") if f.normal.z > 0.9 else pix_uv("cream")
objs["jaw"] = make_box("jaw", jaw_mn, jaw_mx, jaw_uv)

# ---------------------------------------------------------------- 5. flip to face -Y, scale to 0.5 m nose to tail base
bmn, bmx = bbox(objs["body"])
length_bb = nmx.y - bmn.y
S = 0.5 / length_bb
G = Matrix.Diagonal((S, S, S, 1.0)) @ Matrix.Rotation(math.pi, 4, 'Z')
for o in objs.values():
    o.data.transform(G); o.data.update()
def g(p): return G @ Vector(p)
say("scale factor", round(S, 4), "nose to tail base (bb units)", round(length_bb, 4))

# eyes: name by side after the flip (+X is the animal's left)
ea, eb_ = objs.pop("eye_a"), objs.pop("eye_b")
ca = sum((v.co for v in ea.data.vertices), Vector()) / 8
if ca.x > 0: objs["eyeL"], objs["eyeR"] = ea, eb_
else: objs["eyeL"], objs["eyeR"] = eb_, ea
for e in ("earL", "earR", "legFL", "legFR", "legBL", "legBR"):
    o = objs[e]; mn, mx = bbox(o); c = (mn + mx) / 2
    want_pos = e.endswith("L")
    if (c.x > 0) != want_pos:
        raise SystemExit("Side check failed for " + e)

MESHNAME = {"body": "m_body", "neck": "m_neck", "head": "m_head", "nose": "m_nose",
            "earL": "m_earL", "earR": "m_earR", "eyeL": "m_eyeL", "eyeR": "m_eyeR",
            "jaw": "m_jaw", "tail1": "m_tail1", "tail2": "m_tail2",
            "legFL": "m_legFL", "legFR": "m_legFR", "legBL": "m_legBL", "legBR": "m_legBR"}
for part, o in objs.items():
    o.name = MESHNAME[part]; o.data.name = MESHNAME[part]
node = bpy.data.objects.get("Node_11")
if node: bpy.data.objects.remove(node, do_unlink=True)

# ---------------------------------------------------------------- 6. armature
def center(o):
    mn, mx = bbox(o); return (mn + mx) / 2
def bb(o): return bbox(o)
B = {}
bmn, bmx = bb(objs["body"]); bc = (bmn + bmx) / 2
B["root"] = (Vector((0, 0, 0)), Vector((0, 0, 0.05)), None, 'V')
B["body"] = (Vector((0, bc.y, bc.z)), Vector((0, bc.y - 0.06, bc.z)), "root", 'F')
B["torso"] = (Vector((0, bc.y, bmn.z)), Vector((0, bc.y - 0.06, bmn.z)), "body", 'F')
B["head"] = (g((0, 0.40, 0.36)), g((0, 0.80, 0.40)), "body", 'F')
B["jaw"] = (g((0, jaw_mn.y, (jaw_mn.z + jaw_mx.z) / 2)), g((0, jaw_mx.y, (jaw_mn.z + jaw_mx.z) / 2)), "head", 'F')
nc = center(objs["nose"])
B["nose"] = (nc, nc + Vector((0, -0.02, 0)), "head", 'F')
for e in ("earL", "earR"):
    mn, mx = bb(objs[e]); c = (mn + mx) / 2
    B[e] = (Vector((c.x, c.y, mn.z)), Vector((c.x, c.y, mx.z + 0.01)), "head", 'V')
for e in ("eyeL", "eyeR"):
    c = center(objs[e]); B[e] = (c, c + Vector((0, -0.01, 0)), "head", 'F')
cy = (G @ Vector((0, 1.10, 0.29))); B["carry"] = (cy, cy + Vector((0, -0.02, 0)), "head", 'F')
tf, tm, tb = G @ tail_front, G @ plane_co, G @ tail_back
B["tail1"] = (tf, tm, "body", 'F')
B["tail2"] = (tm, tb, "tail1", 'F')
for e in ("legFL", "legFR", "legBL", "legBR"):
    mn, mx = bb(objs[e]); c = (mn + mx) / 2
    B[e] = (Vector((c.x, c.y, mx.z)), Vector((c.x, c.y, mn.z)), "body", 'V')

arm_data = bpy.data.armatures.new("ferret")
arm = bpy.data.objects.new("Armature", arm_data)
bpy.context.collection.objects.link(arm)
arm.show_in_front = True
arm_data.show_names = True
bpy.context.view_layer.update()
for o in bpy.data.objects:
    if o is not None and o.name in bpy.context.view_layer.objects:
        o.select_set(False)
bpy.context.view_layer.objects.active = arm
arm.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
ebs = arm_data.edit_bones
order = ["root", "body", "torso", "head", "jaw", "nose", "earL", "earR", "eyeL", "eyeR",
         "carry", "tail1", "tail2", "legFL", "legFR", "legBL", "legBR"]
for n in order:
    h, t, par, kind = B[n]
    eb = ebs.new(n); eb.head = h; eb.tail = t
    eb.use_connect = False
    if par: eb.parent = ebs[par]
    eb.align_roll(Vector((0, 0, 1)) if kind == 'F' else Vector((0, -1, 0)))
bpy.ops.object.mode_set(mode='OBJECT')
for pb in arm.pose.bones:
    pb.rotation_mode = 'XYZ'
    pb.location = (0, 0, 0); pb.rotation_euler = (0, 0, 0); pb.scale = (1, 1, 1)
bpy.context.view_layer.update()

# ---------------------------------------------------------------- 7. attach every box to its bone (no skinning)
BONE_OF = {"m_body": "torso", "m_neck": "head", "m_head": "head", "m_nose": "nose",
           "m_earL": "earL", "m_earR": "earR", "m_eyeL": "eyeL", "m_eyeR": "eyeR",
           "m_jaw": "jaw", "m_tail1": "tail1", "m_tail2": "tail2",
           "m_legFL": "legFL", "m_legFR": "legFR", "m_legBL": "legBL", "m_legBR": "legBR"}
for mname, bname in BONE_OF.items():
    o = bpy.data.objects[mname]
    mw = o.matrix_world.copy()
    o.parent = arm; o.parent_type = 'BONE'; o.parent_bone = bname
    bpy.context.view_layer.update()
    o.matrix_world = mw
bpy.context.view_layer.update()

# paint over Blockbench's hidden-face marker colours (blue/yellow)
exec(open(os.path.join(ROOT, "scripts", "fix_texture.py")).read())

# crisp pixels
for m in bpy.data.materials:
    if m.node_tree:
        for n in m.node_tree.nodes:
            if n.type == 'TEX_IMAGE': n.interpolation = 'Closest'

# ---------------------------------------------------------------- 8. checks + report
rep = {"scale": S, "bones": {}, "meshes": {}, "log": log}
for b in arm_data.bones:
    xa = (arm.matrix_world.to_3x3() @ b.matrix_local.to_3x3() @ Vector((1, 0, 0)))
    rep["bones"][b.name] = {"head": [round(v, 4) for v in b.head_local], "tail": [round(v, 4) for v in b.tail_local],
                            "parent": b.parent.name if b.parent else None, "x_axis": [round(v, 3) for v in xa]}
tris = 0; zmin = 9; allmn = Vector((9, 9, 9)); allmx = Vector((-9, -9, -9))
for mname in BONE_OF:
    o = bpy.data.objects[mname]
    pts = [o.matrix_world @ v.co for v in o.data.vertices]
    mn = Vector((min(p[i] for p in pts) for i in range(3))); mx = Vector((max(p[i] for p in pts) for i in range(3)))
    t = sum(len(p.vertices) - 2 for p in o.data.polygons); tris += t
    for i in range(3): allmn[i] = min(allmn[i], mn[i]); allmx[i] = max(allmx[i], mx[i])
    rep["meshes"][mname] = {"min": [round(v, 4) for v in mn], "max": [round(v, 4) for v in mx], "tris": t, "bone": o.parent_bone}
rep["triangles"] = tris
rep["bbox_min"] = [round(v, 4) for v in allmn]; rep["bbox_max"] = [round(v, 4) for v in allmx]
with open(REPORT, "w") as f: json.dump(rep, f, indent=1)
bpy.ops.wm.save_mainfile()
print("BUILD OK, report:", REPORT)
