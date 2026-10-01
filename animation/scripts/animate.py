# animate.py (v2): builds the 13 clips on the v2 rig (bendable spine + knees).
#   exec(open(r'D:\The-Game\animation\scripts\animate.py').read())
# Safe to run again: deletes and rebuilds only these 13 actions.
#
# What makes v2 lifelike:
#   - feet are placed with 2-bone IK (hip + knee), so standing feet stay planted while the body
#     breathes, leans, crouches or rears, and walking feet plant, push back and lift like real paws
#   - real gaits: lateral-sequence walk, crouched stalk for sneak, half-bound gallop for run
#   - the spine bends between chest and hips (walk wiggle, gallop flex, sleep curl)
#   - the head stabilises against body motion, ears and tail follow through with lag
#   - eased holds (look, hold, look back) instead of pure sine waves; anticipation and settle
#
# Bone axes (see RIG_SPEC.md):
#   body, chest, torso, head, jaw, nose, eyes: +rx = nose up, +rz = turn to the pet's left, ry = tilt;
#       loc +y forward, +z up. Scale only on leaf bones (torso = hips box, eyes, nose).
#   leg (upper) +rx = swings forward; paw (lower) +rx = folds forward.
#   ears: +rx = perk forward, ry = swivel.  tail1/tail2 (ZYX order): +rx = raise, rz = sway.
#   The modelled tail is raised 25 deg at rest: a tail "raised T" in a loop is rx = T - 25.
import bpy, json, os, math
from math import sin, cos, pi, atan2, acos, sqrt, radians, degrees
from mathutils import Vector

ROOT = r"D:\The-Game\animation"
QA_DIR = os.path.join(ROOT, "scripts", "qa")
arm = bpy.data.objects["Armature"]
scn = bpy.context.scene
if "chest" not in arm.data.bones:
    raise SystemExit("Run upgrade_rig_v2.py first.")

SIDES = ["FL", "FR", "BL", "BR"]
FRONT = {"FL", "FR"}
BONES = ["body", "torso", "chest", "head", "jaw", "nose", "earL", "earR", "eyeL", "eyeR",
         "tail1", "tail2"] + ["leg" + s for s in SIDES] + ["paw" + s for s in SIDES]   # never root, never carry
ROT_MODE = {"tail1": "ZYX", "tail2": "ZYX"}

# ------------------------------------------------------------------ helpers
def clamp(x, a=0.0, b=1.0): return max(a, min(b, x))
def sstep(a, b, x):
    t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t)
def smoother(t):
    t = clamp(t); return t * t * t * (t * (6 * t - 15) + 10)
def hold(f, a, b, c, d):
    if f <= a or f >= d: return 0.0
    if f < b: return sstep(a, b, f)
    if f <= c: return 1.0
    return 1.0 - sstep(c, d, f)
def bump(f, start, dur):
    t = (f - start) / dur
    return 0.0 if t < 0 or t > 1 else sin(pi * t) ** 2
def wave(f, period, shift=0.0): return sin(2 * pi * (f - shift) / period)
def track(f, pts, N=None):
    """Eased curve through (frame, value) keys; with N it wraps (loops)."""
    pts = list(pts)
    if N:
        pts = [(pts[-1][0] - N, pts[-1][1])] + pts + [(pts[0][0] + N, pts[0][1])]
        f = f % N
    if f <= pts[0][0]: return pts[0][1]
    for (f0, v0), (f1, v1) in zip(pts, pts[1:]):
        if f0 <= f <= f1:
            return v0 + (v1 - v0) * smoother((f - f0) / (f1 - f0)) if f1 > f0 else v1
    return pts[-1][1]
def lag(fn, f, k): return fn(f - k)

class Pose(dict):
    def __init__(self):
        super().__init__(); self.feet = {}
    def b(self, name):
        if name not in self: self[name] = {"l": [0.0, 0.0, 0.0], "r": [0.0, 0.0, 0.0], "s": [1.0, 1.0, 1.0]}
        return self[name]
    def rot(self, name, x=0.0, y=0.0, z=0.0):
        r = self.b(name)["r"]; r[0] += x; r[1] += y; r[2] += z
    def loc(self, name, x=0.0, y=0.0, z=0.0):
        l = self.b(name)["l"]; l[0] += x; l[1] += y; l[2] += z
    def spine(self, pitch=0.0, yaw=0.0, roll=0.0):
        """Bend between hips and chest; hips take half the opposite way."""
        self.rot("body", -pitch / 2, -roll / 2, -yaw / 2)
        self.rot("chest", pitch, roll, yaw)
    def ears(self, rx=0.0, ry=0.0):
        self.rot("earL", rx, ry); self.rot("earR", rx, ry)
    def eyes(self, sz):
        for e in ("eyeL", "eyeR"): self.b(e)["s"][2] = sz
    def nose(self, s):
        self.b("nose")["s"] = [s, s, s]
    def foot(self, side, offset=(0.0, 0.0, 0.0)):
        """IK target: rest foot + (forward, left, up) offset in metres."""
        fwd, left, up = offset
        self.feet[side] = ("ik", REST_FOOT[side] + Vector((left, -fwd, up)))
    def fk(self, side, hip, knee):
        self.feet[side] = ("fk", hip, knee)

def pivot_offset(theta_deg, q):
    """Bone-local translation that makes a pitch about the bone's X axis turn around point q."""
    t = radians(theta_deg); c, s = cos(t), sin(t)
    y, z = q[1], q[2]
    return (0.0, y - (y * c - z * s), z - (y * s + z * c))

# rig measurements
REST_FOOT = {s: arm.data.bones["paw" + s].tail_local.copy() for s in SIDES}
L1 = {s: arm.data.bones["leg" + s].length for s in SIDES}
L2 = {s: arm.data.bones["paw" + s].length for s in SIDES}
def half_depth(name):
    o = bpy.data.objects[name]; ys = [(o.matrix_world @ v.co).y for v in o.data.vertices]
    return (max(ys) - min(ys)) / 2
PAW_HALF = {s: half_depth("m_paw" + s) for s in SIDES}
BODY_HEAD = arm.data.bones["body"].head_local.copy()
def body_local(world_pt):
    """World point -> body-bone rest-local coordinates (x = -X, y = -Y, z = Z)."""
    d = world_pt - BODY_HEAD; return (-d.x, -d.y, d.z)
HIND_CONTACT = body_local(Vector((0, REST_FOOT["BL"].y, 0)))

def gait(p, f, N, stride, duty, lift, phase, fold=55.0):
    """stride = ground covered per cycle. In place, a planted foot slides back at ground speed, so it
    travels stride * duty while planted. Planted legs are straight and push back from the hip (the
    blocky look); a lifted leg folds at the knee as it swings forward, like a real paw stepping."""
    step = stride * duty
    for s in SIDES:
        L = L1[s] + L2[s]
        back, front = degrees(math.asin(clamp(-step / 2 / L, -1, 1))), degrees(math.asin(clamp(step / 2 / L, -1, 1)))
        u = (f / N + phase[s]) % 1.0
        sign = -1.0 if s in FRONT else 1.0
        if u < duty:
            t = u / duty
            fwd = step / 2 - step * t
            p.feet[s] = ("world", degrees(math.asin(clamp(fwd / L, -1, 1))), 0.0)
        else:
            t = (u - duty) / (1 - duty)
            fwd = -step / 2 + step * smoother(t)
            p.feet[s] = ("swingik", REST_FOOT[s] + Vector((0.0, -fwd, 0.0)), lift * sin(pi * t))

# ------------------------------------------------------------------ clips (loops)
def idle(f):
    N = 96; p = Pose()
    br = 0.5 - 0.5 * cos(2 * pi * f / 48)                       # two breaths per cycle
    p.loc("body", z=-0.004 + 0.0012 * br, x=0.003 * wave(f, 96))
    p.rot("body", y=1.5 * wave(f, 96))
    p.b("torso")["s"] = [1 + 0.012 * br, 1 + 0.01 * br, 1 + 0.03 * br]
    p.loc("chest", z=0.0015 * br)
    look = lambda t: track(t, [(0, 0), (14, 0), (22, 16), (40, 16), (48, 0), (60, 0), (68, -11), (82, -11), (90, 0)], N)
    p.rot("head", x=2 * cos(2 * pi * (f - 12) / 48), y=0.35 * look(f), z=look(f))
    p.spine(yaw=0.25 * lag(look, f, 3))
    p.ears(ry=0.5 * lag(look, f, 3))
    p.rot("earR", x=-17 * bump(f, 20, 8)); p.rot("earL", x=-17 * bump(f, 68, 8))
    p.nose(1 + 0.12 * (bump(f, 30, 3) + bump(f, 34, 3) + bump(f, 78, 3) + bump(f, 82, 3)))
    p.rot("tail1", x=-14 + 3 * wave(f, 96), z=7 * wave(f, 96))
    p.rot("tail2", x=-4 + 3 * wave(f, 48, 6), z=9 * wave(f, 96, 6))
    return p

WALK = {"N": 16, "stride": 0.10, "duty": 0.62, "lift": 0.02,
        "phase": {"BL": 0.0, "FL": 0.75, "BR": 0.5, "FR": 0.25}}       # lateral sequence LH, LF, RH, RF
def walk(f):
    W = WALK; N = W["N"]; p = Pose()
    gait(p, f, N, W["stride"], W["duty"], W["lift"], W["phase"])
    p.loc("body", z=-0.001 + 0.002 * cos(4 * pi * f / N))
    hip_yaw = 3 * wave(f, N); flex = 7 * wave(f, N, 1)
    p.rot("body", z=hip_yaw, y=2 * wave(f, N, 2))
    p.spine(yaw=flex, roll=-2 * wave(f, N, 2))
    p.rot("head", x=2 + 1.5 * wave(f, 8, 1), z=-0.8 * (hip_yaw + flex / 2))   # head stays steady
    p.ears(rx=-8 + 3 * wave(f, 8, 2))
    p.rot("tail1", x=-12, z=-5 * wave(f, N, 3))
    p.rot("tail2", x=-2, z=-6 * wave(f, N, 6))
    return p

SNEAK = {"N": 20, "stride": 0.07, "duty": 0.72, "lift": 0.012,
         "phase": {"BL": 0.0, "FL": 0.75, "BR": 0.5, "FR": 0.25}}
def sneak(f):
    S = SNEAK; N = S["N"]; p = Pose()
    gait(p, f, N, S["stride"], S["duty"], S["lift"], S["phase"], fold=60.0)
    p.loc("body", z=-0.004 + 0.0015 * cos(4 * pi * f / N))           # low and smooth
    p.b("torso")["s"][2] = 0.95
    p.rot("body", z=2 * wave(f, N))
    p.spine(yaw=5 * wave(f, N, 1), pitch=-3)
    look = 12 * wave(f, N, 3)
    p.rot("head", x=13, z=look - 0.6 * 2 * wave(f, N))
    p.ears(rx=-16, ry=0.4 * look)
    p.eyes(0.7)
    p.rot("tail1", x=-30, z=2 * wave(f, N, 4))
    p.rot("tail2", x=-4, z=3 * wave(f, N, 7))
    return p

RUN = {"N": 12, "stride": 0.24, "duty": 0.30, "lift": 0.03,
       "phase": {"BL": 0.0, "BR": 0.95, "FL": 0.5, "FR": 0.45}}         # half-bound
def run(f):
    R = RUN; N = R["N"]; p = Pose()
    gait(p, f, N, R["stride"], R["duty"], R["lift"], R["phase"], fold=55.0)
    flex = -18 * cos(2 * pi * (f / N - 0.05))                         # hump when hind feet land, stretch at fore landing
    p.spine(pitch=flex)
    p.loc("body", z=-0.003 + 0.016 * (0.5 - 0.5 * cos(4 * pi * (f / N - 0.17))))
    p.rot("body", x=5 * sin(2 * pi * (f / N - 0.3)))
    p.b("torso")["s"][1] = 1 + 0.06 * (-cos(2 * pi * (f / N - 0.05)))
    p.rot("head", x=4 - 0.6 * (flex / 2 + 5 * sin(2 * pi * (f / N - 0.3))))
    p.ears(rx=-25 + 4 * wave(f, N, 2))
    p.rot("jaw", x=-12 - 3 * wave(f, 6))
    p.rot("tail1", x=5 + 8 * wave(f, N, 2), z=4 * wave(f, N, 3))
    p.rot("tail2", x=6 * wave(f, N, 4))
    return p

def sniff(f):
    N = 42; p = Pose()
    sweep = 15 * wave(f, N)
    p.loc("body", z=-0.01)
    p.rot("body", x=-5)                                               # front knees bend via IK
    p.spine(yaw=0.3 * sweep, pitch=-3)
    p.rot("head", x=-12 - 3 * sin(pi * f / 7) ** 2, z=sweep, y=0.3 * sweep)
    p.nose(1 + 0.35 * sin(pi * f / 3) ** 2)
    p.ears(rx=10 + 4 * bump(f % 21, 4, 6), ry=0.4 * sweep)
    p.foot("FL", (0.012 * bump(f, 26, 12), 0.0, 0.016 * bump(f, 26, 12)))
    p.rot("tail1", x=-30, z=6 * wave(f, N, 4))
    p.rot("tail2", x=-4, z=6 * wave(f, N, 8))
    return p

def curious(f):
    N = 78; p = Pose(); rear = 16
    t = pivot_offset(rear, HIND_CONTACT)
    p.rot("body", x=rear); p.loc("body", x=t[0], y=t[1], z=t[2] - 0.006)
    p.spine(pitch=4 + 1.5 * wave(f, 39))
    p.fk("FL", 28, -75); p.fk("FR", 22, -70)                          # front paws up and curled
    tilt = track(f, [(0, 0), (8, 14), (30, 14), (38, -12), (58, -12), (66, 0)], N)
    p.rot("head", x=-10 + 3 * wave(f, N), y=tilt, z=0.35 * tilt)
    p.eyes(1.12)
    p.ears(rx=17, ry=-0.5 * lag(lambda q: track(q, [(0, 0), (8, 14), (30, 14), (38, -12), (58, -12), (66, 0)], N), f, 3))
    p.nose(1 + 0.2 * sin(pi * f / 6) ** 2)
    p.rot("tail1", x=-22, z=8 * wave(f, N))
    p.rot("tail2", x=-6, z=8 * wave(f, N, 6))
    return p

def sleep(f):
    N = 126; p = Pose()
    br = 0.5 - 0.5 * cos(2 * pi * f / 63)                              # slow sleeping breaths
    p.loc("body", z=-0.04)
    p.spine(yaw=-40, pitch=-6)                                          # C-curl to the pet's right
    p.b("torso")["s"] = [1.0 + 0.02 * br, 0.95, 0.86 + 0.04 * br]
    p.loc("chest", z=0.0015 * br)
    p.fk("FL", -70, 75); p.fk("FR", -70, 75)                            # front paws folded under
    p.fk("BL", 65, -70); p.fk("BR", 65, -70)
    p.rot("head", x=-6 + 1.5 * br, y=20, z=-45)
    p.ears(rx=-30)
    p.rot("earL", x=-12 * bump(f, 40, 5))                               # dream twitches
    p.nose(1 + 0.1 * bump(f, 100, 4))
    p.eyes(0.05)
    p.rot("tail1", x=-25, z=95)
    p.rot("tail2", z=70 + 4 * br)
    return p

EAT = {"head": -10}
def eat(f):
    N = 24; p = Pose()
    chew = sin(pi * f / 8) ** 2
    p.loc("body", z=-0.005); p.rot("body", x=-3)
    p.spine(pitch=-3)
    p.rot("head", x=EAT["head"] - 3 * sin(pi * (f - 1) / 8) ** 2, z=2 * wave(f, N))
    p.rot("jaw", x=-22 * chew)
    p.ears(rx=-6 + 2 * sin(pi * (f - 2) / 8) ** 2)
    p.nose(1 + 0.05 * chew)
    p.rot("tail1", x=-14, z=8 * wave(f, N))
    p.rot("tail2", x=-3, z=8 * wave(f, N, 5))
    return p

DRINK = {"head": -13}
def drink(f):
    N = 36; p = Pose()
    lap = sin(pi * f / 6) ** 2
    p.loc("body", z=-0.008); p.rot("body", x=-4)
    p.spine(pitch=-4)
    p.rot("head", x=DRINK["head"] - 1.5 * lap)
    p.rot("jaw", x=-14 * lap)
    p.nose(1 + 0.12 * sin(pi * f / 12) ** 2)
    p.ears(rx=-15)
    p.rot("tail1", x=-32, z=6 * wave(f, N))
    p.rot("tail2", x=-4, z=6 * wave(f, N, 6))
    return p

# ------------------------------------------------------------------ one-shots (added on top of the loop in game)
def happy(f):
    p = Pose(); env = hold(f, 0, 3, 35, 39)
    hops = [(4, 9), (15, 9), (26, 9)]
    z = 0.0; air = 0.0
    for t0, d in hops:
        if t0 <= f <= t0 + d:
            z = 0.045 * sin(pi * (f - t0) / d); air = sin(pi * (f - t0) / d)
    crouch = bump(f, 0, 6) + bump(f, 11, 6) + bump(f, 22, 6) + 0.7 * bump(f, 33, 6)
    p.loc("body", z=z - 0.012 * crouch)
    p.b("torso")["s"] = [1 + 0.03 * crouch, 1 + 0.05 * air, 1 - 0.08 * crouch + 0.04 * air]
    p.spine(pitch=-8 * air)                                             # happy hump in the air
    p.rot("tail1", x=20 * env, z=25 * wave(f, 4) * env)
    p.rot("tail2", z=22 * wave(f, 4, 1.5) * env)
    p.rot("head", x=6 * env, y=6 * wave(f, 22) * env)
    p.eyes(1 - 0.7 * hold(f, 3, 5, 33, 36))
    p.rot("jaw", x=-12 * env)
    p.ears(rx=6 * env)
    return p

def annoyed(f):
    p = Pose(); env = hold(f, 0, 3, 26, 30)
    shake = hold(f, 2, 4, 22, 26)
    p.rot("head", z=14 * sin(2 * pi * (f - 3) / 5) * shake, y=6 * sin(2 * pi * (f - 4) / 5) * shake, x=-4 * env)
    p.ears(rx=-40 * hold(f, 0, 3, 26, 28))
    p.loc("body", z=-0.006 * env)
    p.b("torso")["s"][2] = 1 - 0.03 * env
    p.rot("tail1", x=8 * env, z=20 * wave(f, 10) * env)
    p.rot("tail2", z=16 * wave(f, 10, 2) * env)
    p.eyes(1 - 0.5 * hold(f, 1, 3, 26, 28))
    p.foot("FR", (0.004 * bump(f, 13, 7), 0.0, 0.014 * bump(f, 13, 7)))    # one grumpy stamp
    p.rot("jaw", x=-6 * bump(f, 18, 4)); p.nose(1 + 0.15 * bump(f, 18, 4))
    return p

def surprise(f):
    p = Pose(); e = hold(f, 1, 3, 18, 23)
    z = 0.05 * track(f, [(0, 0), (1, -0.15), (5, 1), (9, 0), (10, -0.2), (13, 0), (24, 0)])
    p.loc("body", z=z + 0.006 * e)
    p.rot("body", x=6 * e)
    p.b("torso")["s"] = [1 + 0.06 * e, 1, 1 + 0.05 * e - 0.08 * bump(f, 9, 4)]   # fur puffs, squash on landing
    p.rot("head", x=12 * e)
    p.ears(rx=16 * hold(f, 0, 2, 18, 22))
    p.rot("tail1", x=50 * hold(f, 1, 4, 17, 23))
    p.rot("tail2", x=14 * hold(f, 3, 6, 17, 23))
    p.eyes(1 + 0.25 * hold(f, 0, 1, 18, 22))
    p.rot("jaw", x=-8 * hold(f, 4, 6, 15, 18))
    return p

BLINK = [1.0, 0.5, 0.05, 0.5, 1.0, 1.0]
def blink(f):
    p = Pose(); p.eyes(BLINK[int(f)]); p.feet = {"skip": True}
    return p

clips_json = json.load(open(os.path.join(ROOT, "clips.json")))
FUNCS = {"idle": idle, "walk": walk, "run": run, "sniff": sniff, "curious": curious, "sleep": sleep,
         "eat": eat, "drink": drink, "sneak": sneak, "happy": happy, "annoyed": annoyed,
         "surprise": surprise, "blink": blink}

# ------------------------------------------------------------------ pose evaluation with IK
REST = {"l": [0.0, 0.0, 0.0], "r": [0.0, 0.0, 0.0], "s": [1.0, 1.0, 1.0]}
PROP = {"l": "location", "r": "rotation_euler", "s": "scale"}
if bpy.context.mode != 'OBJECT':
    bpy.ops.object.mode_set(mode='OBJECT')
if arm.animation_data is None: arm.animation_data_create()
arm.animation_data.action = None
for pb in arm.pose.bones:
    pb.rotation_mode = ROT_MODE.get(pb.name, 'XYZ')
def rest_pose():
    for pb in arm.pose.bones:
        pb.location = (0, 0, 0); pb.rotation_euler = (0, 0, 0); pb.scale = (1, 1, 1)

def apply(p):
    rest_pose()
    for bn, ch in p.items():
        pb = arm.pose.bones[bn]
        pb.location = ch["l"]; pb.scale = ch["s"]
        pb.rotation_euler = [radians(v) for v in ch["r"]]

DOWN, FWD = Vector((0, 0, -1)), Vector((0, -1, 0))
def solve(side, target):
    """Analytic 2-bone IK in the leg's swing plane. Uses the leg's rest frame under its
    (already posed) parent, so the leg's own current rotation does not matter."""
    pb = arm.pose.bones["leg" + side]; par = pb.parent
    M = par.matrix @ (par.bone.matrix_local.inverted() @ pb.bone.matrix_local)
    hip = M.translation.copy()
    Y = M.col[1].xyz.normalized(); Z = M.col[2].xyz.normalized()
    l1, l2 = L1[side], L2[side]
    v = target - hip; ty, tz = v.dot(Y), v.dot(Z)
    d = clamp(sqrt(ty * ty + tz * tz), abs(l1 - l2) + 1e-5, l1 + l2 - 1e-5)
    phi = atan2(tz, ty)
    a = acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1))
    bend = pi - acos(clamp((l1 * l1 + l2 * l2 - d * d) / (2 * l1 * l2), -1, 1))
    if side in FRONT: return degrees(phi + a), degrees(-bend)   # wrist forward, paw folds back
    return degrees(phi - a), degrees(bend)                        # hock back, paw folds forward

def mesh_min_z(names):
    m = 9.0
    for n in names:
        o = bpy.data.objects[n]; mw = o.matrix_world
        for v in o.data.vertices:
            z = (mw @ v.co).z
            if z < m: m = z
    return m

HEAD_GROUP = ["m_head", "m_neck", "m_nose", "m_jaw", "m_eyeL", "m_eyeR", "m_earL", "m_earR"]
HEAD_CLEAR = 0.003
SINK_TOL = 0.005    # a paw corner may press 5 mm into the floor (reads as soft ground); deeper raises the body

def evaluate(fn, f):
    p = fn(f)
    if p.feet.get("skip"):
        return p
    apply(p)
    bpy.context.view_layer.update()
    targets, swings = {}, {}
    for s in SIDES:
        spec = p.feet.get(s, ("ik", REST_FOOT[s]))
        if spec[0] == "fk":
            p.b("leg" + s)["r"][0] = spec[1]; p.b("paw" + s)["r"][0] = spec[2]
        elif spec[0] == "world":                  # leg angle given against world vertical
            pb = arm.pose.bones["leg" + s]; par = pb.parent
            M = par.matrix @ (par.bone.matrix_local.inverted() @ pb.bone.matrix_local)
            Y = M.col[1].xyz.normalized()
            gam = degrees(atan2(Y.dot(FWD), Y.dot(DOWN)))
            p.b("leg" + s)["r"][0] = spec[1] - gam; p.b("paw" + s)["r"][0] = spec[2]
        elif spec[0] == "swingik":
            swings[s] = [spec[1].copy(), spec[2]]
        else:
            targets[s] = spec[1].copy()
    def set_legs():
        for s in SIDES:
            arm.pose.bones["leg" + s].rotation_euler.x = radians(p.b("leg" + s)["r"][0])
            arm.pose.bones["paw" + s].rotation_euler.x = radians(p.b("paw" + s)["r"][0])
        bpy.context.view_layer.update()
    LEG_MESHES = ["m_paw" + s for s in SIDES] + ["m_leg" + s for s in SIDES]
    z0 = p.b("body")["l"][2]
    PLANTED = ["m_paw" + s for s in SIDES if s not in swings] + ["m_leg" + s for s in SIDES if s not in swings]
    def solve_swings():
        """A lifting paw: place it so its lowest corner is at the wanted height (fat paws dip their
        corner when they tilt, so the target is corrected against the real geometry)."""
        for s, (T, want) in swings.items():
            for _ in range(5):
                h, k = solve(s, T); p.b("leg" + s)["r"][0] = h; p.b("paw" + s)["r"][0] = k
                set_legs()
                err = want - mesh_min_z(["m_paw" + s])
                if abs(err) < 0.0004: break
                T.z += err
    def try_body(dz):
        arm.pose.bones["body"].location.z = z0 + dz
        bpy.context.view_layer.update()
        for s, T in targets.items():
            h, k = solve(s, T); p.b("leg" + s)["r"][0] = h; p.b("paw" + s)["r"][0] = k
        set_legs()
        return mesh_min_z(PLANTED) if PLANTED else 1.0
    if try_body(0.0) < -SINK_TOL:             # a paw corner sinks in too far: find the smallest body raise that fixes it
        lo, hi = 0.0, 0.002
        while try_body(hi) < -SINK_TOL and hi < 0.06: hi *= 2
        for _ in range(14):
            mid = (lo + hi) / 2
            if try_body(mid) < -SINK_TOL: lo = mid
            else: hi = mid
        try_body(hi); p.b("body")["l"][2] = z0 + hi
    solve_swings()
    for it in range(6):                       # keep the head, jaw and nose out of the floor
        mz = mesh_min_z(HEAD_GROUP)
        if mz >= HEAD_CLEAR: break
        p.b("head")["r"][0] += max(0.5, degrees((HEAD_CLEAR - mz) / 0.16))
        arm.pose.bones["head"].rotation_euler.x = radians(p.b("head")["r"][0])
        bpy.context.view_layer.update()
    return p

# IK result for a plain standing rest pose; one-shots store legs relative to it
REST_IK = {}
_rp = evaluate(lambda f: Pose(), 0)
for s in SIDES: REST_IK[s] = (_rp["leg" + s]["r"][0], _rp["paw" + s]["r"][0])
REST_BODY_Z = _rp.get("body", REST)["l"][2]

# ------------------------------------------------------------------ keying (fast path with fallback)
prefs = bpy.context.preferences.edit
old_interp = prefs.keyframe_new_interpolation_type
prefs.keyframe_new_interpolation_type = 'LINEAR'
def fcurve_of(act, path, idx):
    try:
        from bpy_extras import anim_utils
        cb = anim_utils.action_get_channelbag_for_slot(act, arm.animation_data.action_slot)
        return cb.fcurves.find(path, index=idx)
    except Exception:
        try: return act.fcurves.find(path, index=idx)
        except Exception: return None
def key_channel(act, pb, prop, i, frames, values):
    v0 = values[0]
    getattr(pb, prop)[i] = v0
    pb.keyframe_insert(data_path=prop, index=i, frame=frames[0], group=pb.name)
    fc = fcurve_of(act, pb.path_from_id(prop), i)
    if fc is not None and len(frames) > 1:
        kp = fc.keyframe_points
        kp.add(len(frames) - 1)
        co = []
        for fr, v in zip(frames, values): co += [fr, v]
        kp.foreach_set("co", co)
        try:
            kp.foreach_set("interpolation", [1] * len(kp))  # LINEAR
        except Exception:
            for k in kp: k.interpolation = 'LINEAR'
        fc.update()
        return "fast"
    for fr, v in zip(frames[1:], values[1:]):
        getattr(pb, prop)[i] = v
        pb.keyframe_insert(data_path=prop, index=i, frame=fr, group=pb.name)
    return "slow"

for name in FUNCS:
    old = bpy.data.actions.get(name)
    if old: bpy.data.actions.remove(old)

summary = {}
for name, fn in FUNCS.items():
    meta = clips_json["clips"][name]; N = meta["frames"]; loop = meta["loop"]
    frames = list(range(0, N + 1))
    arm.animation_data.action = None
    poses = [evaluate(fn, f) for f in frames]
    if not loop:
        for p in poses:
            if "legFL" in p:
                for s in SIDES:
                    p.b("leg" + s)["r"][0] -= REST_IK[s][0]; p.b("paw" + s)["r"][0] -= REST_IK[s][1]
                p.b("body")["l"][2] -= REST_BODY_Z
    rest_pose()
    act = bpy.data.actions.new(name); act.use_fake_user = True
    arm.animation_data.action = act
    keyed, mode = [], set()
    for bn in BONES:
        pb = arm.pose.bones[bn]
        vals = {k: [[p.get(bn, REST)[k][i] for p in poses] for i in range(3)] for k in "lrs"}
        moves = any(abs(v - REST[k][i]) > 1e-4 for k in "lrs" for i in range(3) for v in vals[k][i])
        if not loop and not moves: continue
        keyed.append(bn)
        for k in "lrs":
            for i in range(3):
                series = vals[k][i]
                const = max(series) - min(series) < 1e-6
                if not loop and const and abs(series[0] - REST[k][i]) < 1e-6: continue
                use = [0, N] if const else frames
                vv = [series[f] for f in use]
                if k == "r": vv = [radians(v) for v in vv]
                mode.add(key_channel(act, pb, PROP[k], i, use, vv))
    act.use_frame_range = True; act.frame_start = 0; act.frame_end = N; act.use_cyclic = loop
    summary[name] = {"frames": N, "loop": loop, "keyed_bones": keyed, "key_mode": sorted(mode)}
prefs.keyframe_new_interpolation_type = old_interp

# ------------------------------------------------------------------ QA: floor contact, loop seams
meshes = [o for o in bpy.data.objects if o.type == 'MESH' and o.parent == arm]
def min_z():
    best = (9.0, None)
    for o in meshes:
        mw = o.matrix_world
        for v in o.data.vertices:
            z = (mw @ v.co).z
            if z < best[0]: best = (z, o.name)
    return best
for name in FUNCS:
    rest_pose(); arm.animation_data.action = bpy.data.actions[name]
    N = summary[name]["frames"]; worst = (9.0, None, None)
    for f in range(0, N + 1):
        scn.frame_set(f)
        z, o = min_z()
        if z < worst[0]: worst = (z, o, f)
    scn.frame_set(0); m0 = {pb.name: pb.matrix_basis.copy() for pb in arm.pose.bones}
    scn.frame_set(N)
    seam = max(max(abs(a - b) for ra, rb in zip(m0[pb.name], pb.matrix_basis) for a, b in zip(ra, rb)) for pb in arm.pose.bones)
    summary[name].update({"min_z": round(worst[0], 4), "min_z_mesh": worst[1], "min_z_frame": worst[2],
                          "seam_error": round(seam, 6)})

arm.animation_data.action = None
rest_pose(); scn.frame_set(0)
scn.frame_start = 0; scn.frame_end = 96
gaits = {"walk": WALK, "sneak": SNEAK, "run": RUN}
for g, G in gaits.items():
    summary[g]["stride_m"] = G["stride"]
    summary[g]["ground_speed_mps"] = round(G["stride"] / (G["N"] / 30.0), 4)
with open(os.path.join(ROOT, "scripts", "animate_report.json"), "w") as fh:
    json.dump({"clips": summary, "rest_ik": REST_IK}, fh, indent=1)
bpy.ops.wm.save_mainfile()
print("ANIMATE V2 OK")
