import bpy, json, os
arm = bpy.data.objects["Armature"]; scn = bpy.context.scene
out = {}
for name in ("happy", "surprise", "walk"):
    for pb in arm.pose.bones:
        pb.location = (0, 0, 0); pb.rotation_euler = (0, 0, 0); pb.scale = (1, 1, 1)
    arm.animation_data.action = bpy.data.actions[name]
    rows = []
    N = int(bpy.data.actions[name].frame_end)
    for f in range(0, N + 1):
        scn.frame_set(f)
        pz = {}
        for s in ("FL", "FR", "BL", "BR"):
            o = bpy.data.objects["m_paw" + s]
            pz[s] = round(min((o.matrix_world @ v.co).z for v in o.data.vertices), 4)
        b = bpy.data.objects["m_body"]
        rows.append({"f": f, "body_z": round(arm.pose.bones["body"].location.z, 4),
                     "hips_bottom": round(min((b.matrix_world @ v.co).z for v in b.data.vertices), 4), "paws": pz,
                     "legFL": round(arm.pose.bones["legFL"].rotation_euler.x, 3), "pawFL": round(arm.pose.bones["pawFL"].rotation_euler.x, 3)})
    out[name] = rows
arm.animation_data.action = None
for pb in arm.pose.bones:
    pb.location = (0, 0, 0); pb.rotation_euler = (0, 0, 0); pb.scale = (1, 1, 1)
scn.frame_set(0)
json.dump(out, open(r"D:\The-Game\animation\scripts\diag.json", "w"), indent=0)
print("DIAG OK")
