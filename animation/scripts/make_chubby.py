# make_chubby.py: makes the ferret less long-necked and slim, then rebuilds the clips and the export.
#
# Why: testers and the developer saw a long thin neck and a narrow body, which reads as a
# malnourished ferret. Real ferrets have a thick body, a short neck, and the head sits close on
# the chest. This script reshapes the MESH pieces only (the bones, the rig and the animation
# numbers stay the same):
#   - torso (m_body) and chest (m_chest): 30 percent wider and taller, the chest 4 cm longer
#   - neck (m_neck): much thicker, and the head box (m_head) reaches back over it, so no stick neck shows
#   - tail: 25 percent bushier
#   - legs: 2 cm further out, under the wider body
# Run from the shell, starting from the saved file made before the change, so it never stacks:
#   blender.exe -b animation/source/Ferret_before_chubby.blend --python animation/scripts/make_chubby.py
# It then runs animate.py and export_glb.py and saves animation/Ferret.blend.
import bpy, os, sys
from mathutils import Vector

ROOT = r"D:\The-Game\animation"
S = os.path.join(ROOT, "scripts")

arm = bpy.data.objects["Armature"]
if arm.animation_data:
    arm.animation_data.action = None
for pb in arm.pose.bones:
    pb.location = (0, 0, 0); pb.rotation_euler = (0, 0, 0); pb.rotation_quaternion = (1, 0, 0, 0); pb.scale = (1, 1, 1)
bpy.context.view_layer.update()

# Blender axes: x = animal's left, y = BACKWARD (the nose points to -y, RIG_SPEC.md section 1), z = up.
# So "forward" is a smaller y. (The exported glTF turns -y into +z.)
def edit(name, fn):
    """Move the vertices of one mesh piece, working in world (rest pose) coordinates."""
    o = bpy.data.objects[name]
    m = o.matrix_world.copy(); inv = m.inverted()
    for v in o.data.vertices:
        p = m @ v.co
        q = fn(p.copy())
        v.co = inv @ q
    o.data.update()

def bounds(name):
    o = bpy.data.objects[name]
    ws = [o.matrix_world @ v.co for v in o.data.vertices]
    return [min(w[i] for w in ws) for i in range(3)], [max(w[i] for w in ws) for i in range(3)]

def grow(name, sx, sz, extra=None):
    """Scale the width (x) and height (z) about the piece's own centre."""
    lo, hi = bounds(name)
    cx, cz = (lo[0] + hi[0]) / 2, (lo[2] + hi[2]) / 2
    def f(p):
        p.x = cx + (p.x - cx) * sx
        p.z = cz + (p.z - cz) * sz
        return extra(p) if extra else p
    edit(name, f)

before = {n: bounds(n) for n in ("m_body", "m_chest", "m_neck", "m_head")}
chest_front_y = before["m_chest"][0][1]      # the front face is the smallest y
head_back_y = before["m_head"][1][1]         # the head's rear face is its largest y

# Torso: same centre height, so the feet and legs do not move; the belly drops 1.3 cm.
grow("m_body", 1.30, 1.30)
# Chest: wider, taller, and its front face moves forward 4 cm (the vertices in the front half).
mid_y = (before["m_chest"][0][1] + before["m_chest"][1][1]) / 2
grow("m_chest", 1.30, 1.30, extra=lambda p: Vector((p.x, p.y - (0.04 if p.y < mid_y else 0.0), p.z)))
# Neck: thicker, so it is a chunky link and not a stick.
grow("m_neck", 1.9, 1.15)
# Head: its rear face reaches back over the new chest front by 2 cm, so almost no neck shows.
new_back = chest_front_y - 0.04 + 0.02
edit("m_head", lambda p: Vector((p.x, new_back if p.y > head_back_y - 0.02 else p.y, p.z)))
# Tail: bushier.
grow("m_tail1", 1.25, 1.25)
grow("m_tail2", 1.25, 1.25)
# Legs: further out, under the wider body (a move along x does not change a swing around x).
for side, sign in (("FL", 1), ("BL", 1), ("FR", -1), ("BR", -1)):
    for part in ("m_leg", "m_paw"):
        edit(part + side, lambda p, s=sign: Vector((p.x + 0.02 * s, p.y, p.z)))

after = {n: bounds(n) for n in before}
for n in before:
    print("RESHAPED", n, [round(v, 3) for v in before[n][0]], [round(v, 3) for v in before[n][1]], "->",
          [round(v, 3) for v in after[n][0]], [round(v, 3) for v in after[n][1]])

# From here on the open file is Ferret.blend, so animate.py (which saves the open file) can never
# overwrite the saved starting point in animation/source/.
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT, "Ferret.blend"), check_existing=False)
for f in ("animate.py", "export_glb.py"):
    exec(open(os.path.join(S, f)).read())
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT, "Ferret.blend"), check_existing=False)
print("MAKE CHUBBY OK")
