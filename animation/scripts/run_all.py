# run_all.py: rebuild the clips, render the preview sheets, export ferret.glb.
#   exec(open(r'D:\The-Game\animation\scripts\run_all.py').read())
import os
_S = r"D:\The-Game\animation\scripts"
for _f in ("animate.py", "render_previews.py", "export_glb.py"):
    exec(open(os.path.join(_S, _f)).read())
print("RUN ALL OK")
