# Dumps the open Blender scene to scripts/inspect_report.json (read-only, changes nothing).
import bpy, json, os
from mathutils import Vector

ROOT = os.path.dirname(bpy.data.filepath) if bpy.data.filepath else r"D:\The-Game\animation"
out = {
    "blender": bpy.app.version_string,
    "file": bpy.data.filepath,
    "fps": bpy.context.scene.render.fps,
    "fps_base": bpy.context.scene.render.fps_base,
    "unit_system": bpy.context.scene.unit_settings.system,
    "unit_scale": bpy.context.scene.unit_settings.scale_length,
    "mode": bpy.context.mode,
    "objects": [],
    "actions": [a.name for a in bpy.data.actions],
    "materials": [m.name for m in bpy.data.materials],
    "images": [(i.name, list(i.size), i.filepath) for i in bpy.data.images],
}
for o in bpy.data.objects:
    d = {
        "name": o.name, "type": o.type,
        "parent": o.parent.name if o.parent else None,
        "parent_type": o.parent_type, "parent_bone": o.parent_bone,
        "loc": [round(v, 4) for v in o.location],
        "rot_mode": o.rotation_mode,
        "rot": [round(v, 4) for v in o.rotation_euler],
        "scale": [round(v, 4) for v in o.scale],
        "collections": [c.name for c in o.users_collection],
        "in_view_layer": o.name in bpy.context.view_layer.objects,
    }
    if o.type == 'MESH':
        mw = o.matrix_world
        pts = [mw @ v.co for v in o.data.vertices]
        if pts:
            d["world_min"] = [round(min(p[i] for p in pts), 4) for i in range(3)]
            d["world_max"] = [round(max(p[i] for p in pts), 4) for i in range(3)]
        d["verts"] = len(o.data.vertices)
        d["polys"] = len(o.data.polygons)
        d["mesh_users"] = o.data.users
        d["mesh_name"] = o.data.name
        d["materials"] = [m.name if m else None for m in o.data.materials]
        d["uv_layers"] = [u.name for u in o.data.uv_layers]
    out["objects"].append(d)

path = os.path.join(ROOT, "scripts", "inspect_report.json")
with open(path, "w") as f:
    json.dump(out, f, indent=1)
print("WROTE", path)
