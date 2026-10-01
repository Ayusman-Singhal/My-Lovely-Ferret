# export_parts.py: exports the ferret's mesh pieces only (no armature, no animation) to
# animation/export/ferret_parts.glb. One piece per rig v2 bone, named after the bone
# (RIG_SPEC.md). Each piece's origin sits on its bone's joint, so it can be rotated in place.
# Boxes that share a bone are merged (m_head + m_neck -> "head"). Bones with no box
# (root, body, carry) have no piece. Works on temporary copies; Ferret.blend is not changed.
#   exec(open(r'D:\The-Game\animation\scripts\export_parts.py').read())
import bpy, bmesh, os, re, json
from mathutils import Matrix

ROOT = r"D:\The-Game\animation"
OUT = os.path.join(ROOT, "export", "ferret_parts.glb")
arm = bpy.data.objects["Armature"]
if bpy.context.mode != 'OBJECT':
    bpy.ops.object.mode_set(mode='OBJECT')

# rest pose, no action
saved_action = arm.animation_data.action if arm.animation_data else None
if arm.animation_data: arm.animation_data.action = None
saved_pose = {pb.name: (pb.location.copy(), pb.rotation_euler.copy(), pb.scale.copy()) for pb in arm.pose.bones}
for pb in arm.pose.bones:
    pb.location = (0, 0, 0); pb.rotation_euler = (0, 0, 0); pb.scale = (1, 1, 1)
bpy.context.view_layer.update()

groups = {}
for o in arm.children:
    if o.type == 'MESH' and o.parent_type == 'BONE':
        groups.setdefault(o.parent_bone, []).append(o)

coll = bpy.data.collections.new("_parts_export")
bpy.context.scene.collection.children.link(coll)
made, report = [], {}
for bone in [b.name for b in arm.data.bones if b.name in groups]:
    objs = sorted(groups[bone], key=lambda o: o.name)
    pivot = arm.matrix_world @ arm.data.bones[bone].head_local
    bm = bmesh.new()
    for o in objs:
        tmp = o.data.copy()
        tmp.transform(Matrix.Translation(-pivot) @ o.matrix_world)
        bm.from_mesh(tmp)
        bpy.data.meshes.remove(tmp)
    me = bpy.data.meshes.new("part_" + bone)
    bm.to_mesh(me); bm.free()
    me.materials.append(objs[0].data.materials[0])
    ob = bpy.data.objects.new(bone, me)
    coll.objects.link(ob)
    ob.location = pivot
    made.append(ob)
    report[bone] = {"from": [o.name for o in objs], "pivot": [round(v, 4) for v in pivot],
                    "tris": sum(len(p.vertices) - 2 for p in me.polygons)}
bpy.context.view_layer.update()

for o in bpy.context.view_layer.objects:
    o.select_set(False)
for ob in made:
    ob.select_set(True)
bpy.context.view_layer.objects.active = made[0]

opts = dict(filepath=OUT, export_format='GLB', use_selection=True, export_yup=True, export_apply=True,
            export_texcoords=True, export_normals=True, export_materials='EXPORT', export_image_format='AUTO',
            export_animations=False, export_skins=False, export_morph=False,
            export_lights=False, export_cameras=False)
dropped = []
try:
    while True:
        try:
            bpy.ops.export_scene.gltf(**opts); break
        except TypeError as e:
            m = re.search(r'"(\w+)"', str(e))
            if not m or m.group(1) not in opts: raise
            dropped.append(m.group(1)); opts.pop(m.group(1))
finally:
    for ob in made:
        me = ob.data; bpy.data.objects.remove(ob, do_unlink=True); bpy.data.meshes.remove(me)
    bpy.data.collections.remove(coll)
    for pb in arm.pose.bones:
        l, r, s = saved_pose[pb.name]; pb.location = l; pb.rotation_euler = r; pb.scale = s
    if arm.animation_data: arm.animation_data.action = saved_action
    bpy.context.view_layer.update()

json.dump({"file": OUT, "bytes": os.path.getsize(OUT), "pieces": report, "dropped_options": dropped},
          open(os.path.join(ROOT, "scripts", "export_parts_report.json"), "w"), indent=1)
print("PARTS EXPORTED", OUT, os.path.getsize(OUT), "bytes,", len(made), "pieces")
