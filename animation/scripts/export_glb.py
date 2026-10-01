# export_glb.py: writes animation/export/ferret.glb with every clip (RIG_SPEC + BLENDER_GUIDE §7).
#   exec(open(r'D:\The-Game\animation\scripts\export_glb.py').read())
import bpy, os, re
ROOT = r"D:\The-Game\animation"
OUT = os.path.join(ROOT, "export", "ferret.glb")
if bpy.context.mode != 'OBJECT':
    bpy.ops.object.mode_set(mode='OBJECT')
arm = bpy.data.objects["Armature"]
if arm.animation_data: arm.animation_data.action = None
for pb in arm.pose.bones:
    pb.location = (0, 0, 0); pb.rotation_euler = (0, 0, 0); pb.rotation_quaternion = (1, 0, 0, 0); pb.scale = (1, 1, 1)
for o in bpy.data.objects:
    if o.name in bpy.context.view_layer.objects: o.select_set(False)
arm.select_set(True)
for o in arm.children: o.select_set(True)
bpy.context.view_layer.objects.active = arm
bpy.context.scene.frame_set(0)
opts = dict(filepath=OUT, export_format='GLB', use_selection=True, export_yup=True, export_apply=True,
            export_texcoords=True, export_normals=True, export_materials='EXPORT', export_image_format='AUTO',
            export_animations=True, export_animation_mode='ACTIONS', export_force_sampling=True,
            export_frame_step=1, export_optimize_animation_size=True, export_def_bones=False,
            export_reset_pose_bones=True, export_morph=False, export_lights=False, export_cameras=False)
dropped = []
while True:
    try:
        bpy.ops.export_scene.gltf(**opts); break
    except TypeError as e:
        m = re.search(r'"(\w+)"', str(e))
        if not m or m.group(1) not in opts: raise
        dropped.append(m.group(1)); opts.pop(m.group(1))
print("EXPORTED", OUT, os.path.getsize(OUT), "bytes; options not known by this exporter:", dropped)
