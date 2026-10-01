# upgrade_rig_v2.py: gives the rigged ferret a bendable spine and knees.
#   - m_body is split into m_chest (front half, new bone `chest`) and m_body (hips, bone `torso`).
#     `head`, `legFL`, `legFR` move under `chest` (the optional chest bone in RIG_SPEC.md).
#   - each leg box is split into an upper leg (bone legXX) and a paw (new bone pawXX).
# Run ONCE on the v1 rig:  exec(open(r'D:\The-Game\animation\scripts\upgrade_rig_v2.py').read())
# A backup of the v1 file is saved to source/Ferret_rig_v1.blend first.
import bpy, bmesh, os, json
from mathutils import Vector, Matrix

ROOT = r"D:\The-Game\animation"
arm = bpy.data.objects["Armature"]
if "chest" in arm.data.bones:
    raise SystemExit("Rig is already v2.")
if bpy.context.mode != 'OBJECT':
    bpy.ops.object.mode_set(mode='OBJECT')
BACKUP = os.path.join(ROOT, "source", "Ferret_rig_v1.blend")
if not os.path.exists(BACKUP):
    bpy.ops.wm.save_as_mainfile(filepath=BACKUP, copy=True)

# rest pose, no action
if arm.animation_data: arm.animation_data.action = None
for pb in arm.pose.bones:
    pb.location = (0, 0, 0); pb.rotation_euler = (0, 0, 0); pb.rotation_quaternion = (1, 0, 0, 0); pb.scale = (1, 1, 1)
bpy.context.view_layer.update()

# 1. bake every mesh to world space and unparent
meshes = [o for o in bpy.data.objects if o.type == 'MESH' and o.parent == arm]
for o in meshes:
    mw = o.matrix_world.copy()
    o.parent = None; o.parent_type = 'OBJECT'; o.parent_bone = ""
    o.matrix_world = Matrix.Identity(4)
    o.data.transform(mw); o.data.update()
bpy.context.view_layer.update()

def bbox(o):
    vs = [v.co for v in o.data.vertices]
    return (Vector((min(v[i] for v in vs) for i in range(3))), Vector((max(v[i] for v in vs) for i in range(3))))

def cut(o, co, no, keep_positive):
    bm = bmesh.new(); bm.from_mesh(o.data)
    uv = bm.loops.layers.uv.active
    bm.faces.ensure_lookup_table()
    side_uv = bm.faces[0].loops[0][uv].uv.copy()
    geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
    bmesh.ops.bisect_plane(bm, geom=geom, plane_co=co, plane_no=no,
                           clear_inner=keep_positive, clear_outer=not keep_positive)
    res = bmesh.ops.holes_fill(bm, edges=[e for e in bm.edges if e.is_boundary], sides=0)
    for f in res["faces"]:
        for l in f.loops: l[uv].uv = side_uv
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    bm.to_mesh(o.data); bm.free(); o.data.update()

def grow(o, center, sx, sy, sz):
    o.data.transform(Matrix.Translation(center) @ Matrix.Diagonal((sx, sy, sz, 1)) @ Matrix.Translation(-center))
    o.data.update()

def dup(o, name):
    n = o.copy(); n.data = o.data.copy(); n.name = name; n.data.name = name
    for c in o.users_collection: c.objects.link(n)
    return n

# 2. split the torso: chest (front, -Y) and hips (back, +Y), overlapping so a bend shows no gap
body = bpy.data.objects["m_body"]
bmn, bmx = bbox(body); bc = (bmn + bmx) / 2
OV = 0.012
chest = dup(body, "m_chest")
cut(chest, Vector((0, bc.y + OV, 0)), Vector((0, 1, 0)), keep_positive=False)
cut(body, Vector((0, bc.y - OV, 0)), Vector((0, 1, 0)), keep_positive=True)
grow(chest, Vector((0, bc.y, bc.z)), 1.03, 1.0, 1.03)     # sits just outside the hips: no z-fighting

# 3. split each leg into upper leg + paw
legs = {}
for s in ("FL", "FR", "BL", "BR"):
    lo = bpy.data.objects["m_leg" + s]
    mn, mx = bbox(lo); c = (mn + mx) / 2
    KNEE = mn.z + 0.47 * (mx.z - mn.z)
    paw = dup(lo, "m_paw" + s)
    cut(lo, Vector((0, 0, KNEE - 0.004)), Vector((0, 0, 1)), keep_positive=True)
    cut(paw, Vector((0, 0, KNEE + 0.004)), Vector((0, 0, 1)), keep_positive=False)
    grow(paw, Vector((c.x, c.y, KNEE)), 1.04, 1.04, 1.0)
    legs[s] = (c, KNEE, mn.z, mx.z)

# 4. bones
bpy.context.view_layer.objects.active = arm
for o in bpy.data.objects:
    if o.name in bpy.context.view_layer.objects: o.select_set(False)
arm.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
eb = arm.data.edit_bones
b = eb["body"]
ch = eb.new("chest"); ch.head = b.head.copy(); ch.tail = b.head + Vector((0, -0.06, 0))
ch.parent = b; ch.use_connect = False; ch.align_roll(Vector((0, 0, 1)))
for n in ("head", "legFL", "legFR"):
    eb[n].parent = ch
for s, (c, knee, z0, z1) in legs.items():
    lb = eb["leg" + s]
    lb.tail = Vector((lb.head.x, lb.head.y, knee)); lb.align_roll(Vector((0, -1, 0)))
    pw = eb.new("paw" + s); pw.head = Vector((c.x, c.y, knee)); pw.tail = Vector((c.x, c.y, z0))
    pw.parent = lb; pw.use_connect = False; pw.align_roll(Vector((0, -1, 0)))
bpy.ops.object.mode_set(mode='OBJECT')
for pb in arm.pose.bones:
    pb.rotation_mode = 'ZYX' if pb.name in ("tail1", "tail2") else 'XYZ'
    pb.location = (0, 0, 0); pb.rotation_euler = (0, 0, 0); pb.scale = (1, 1, 1)
bpy.context.view_layer.update()

# 5. re-attach every box to its bone
BONE_OF = {"m_body": "torso", "m_chest": "chest", "m_neck": "head", "m_head": "head", "m_nose": "nose",
           "m_earL": "earL", "m_earR": "earR", "m_eyeL": "eyeL", "m_eyeR": "eyeR", "m_jaw": "jaw",
           "m_tail1": "tail1", "m_tail2": "tail2"}
for s in ("FL", "FR", "BL", "BR"):
    BONE_OF["m_leg" + s] = "leg" + s; BONE_OF["m_paw" + s] = "paw" + s
for mname, bname in BONE_OF.items():
    o = bpy.data.objects[mname]
    o.parent = arm; o.parent_type = 'BONE'; o.parent_bone = bname
    bpy.context.view_layer.update()
    o.matrix_world = Matrix.Identity(4)
bpy.context.view_layer.update()

rep = {"bones": {}, "meshes": {}}
for bn in arm.data.bones:
    rep["bones"][bn.name] = {"head": [round(v, 4) for v in bn.head_local], "tail": [round(v, 4) for v in bn.tail_local],
                             "parent": bn.parent.name if bn.parent else None, "length": round(bn.length, 4)}
tris = 0
for mname in BONE_OF:
    o = bpy.data.objects[mname]
    t = sum(len(p.vertices) - 2 for p in o.data.polygons); tris += t
    pts = [o.matrix_world @ v.co for v in o.data.vertices]
    rep["meshes"][mname] = {"tris": t, "min": [round(min(p[i] for p in pts), 4) for i in range(3)],
                            "max": [round(max(p[i] for p in pts), 4) for i in range(3)]}
rep["triangles"] = tris; rep["bone_count"] = len(arm.data.bones)
json.dump(rep, open(os.path.join(ROOT, "scripts", "upgrade_report.json"), "w"), indent=1)
bpy.ops.wm.save_mainfile()
print("RIG V2 OK", rep["bone_count"], "bones", tris, "triangles")
