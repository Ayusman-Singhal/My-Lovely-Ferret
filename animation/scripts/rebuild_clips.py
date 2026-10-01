# rebuild_clips.py: rebuilds the 13 clips from animate.py and writes the export, without the preview
# renders. Run it from the shell on the main file:
#   blender.exe -b animation/Ferret.blend --python animation/scripts/rebuild_clips.py
# (This is run_all.py minus render_previews.py, which needs a display.) It saves Ferret.blend.
import bpy, os
_S = r"D:\The-Game\animation\scripts"
for _f in ("animate.py", "export_glb.py"):
    exec(open(os.path.join(_S, _f)).read())
bpy.ops.wm.save_mainfile()
print("REBUILD OK")
