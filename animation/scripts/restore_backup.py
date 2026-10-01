# Puts Ferret.blend back to the state saved in source/Ferret_before_rig.blend.
import bpy, os, shutil
ROOT = r"D:\The-Game\animation"
src = os.path.join(ROOT, "source", "Ferret_before_rig.blend")
dst = os.path.join(ROOT, "Ferret.blend")
shutil.copyfile(src, dst)
bpy.ops.wm.open_mainfile(filepath=dst)
print("RESTORED", dst)
