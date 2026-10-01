-- Drives the ferret's Motor6D joints from clip formulas. No Animator and no Humanoid: every frame the
-- module computes a pose (angles and offsets per joint) from the base clip, a 0.2 s crossfade from the
-- previous clip, and any one-shot reactions on top, then writes Motor6D.Transform.
-- Numbers: animation/CLIPS.md (the Blender clips, 30 fps). Rig: animation/RIG_SPEC.md.
--
-- Roblox axes at rest (the ferret faces -Z): +X rotation tips the nose UP, +Y rotation turns it LEFT,
-- left is -X, up is +Y, back is +Z. Helper conventions below hide the signs:
--   head/body pitch   + = nose up, - = nose down
--   ears              perk(deg) = forward, flat(deg) = back against the head
--   tail              tail(deg) = how high it is raised (the model's rest tail is raised 25)
--   jaw               open(deg)
--   leg / paw         + = foot swings forward

local FerretRig = {}
FerretRig.__index = FerretRig

local FPS = 30
local FADE = 0.2 -- crossfade seconds between base clips
local REST_TAIL = 25 -- degrees the modelled tail is raised at rest
local BL = 3.5 -- body length in studs (0.5 m x 7), for the percent-of-body-length numbers

local JOINTS = {
	"body", "torso", "chest", "head", "jaw", "nose", "earL", "earR", "eyeL", "eyeR", "tail1", "tail2",
	"legFL", "legFR", "legBL", "legBR", "pawFL", "pawFR", "pawBL", "pawBR",
}

-- ---------------------------------------------------------------- math helpers (frames in, like animate.py)

local function clamp(x, a, b)
	return math.max(a, math.min(b, x))
end
local function sstep(a, b, x)
	local t = clamp((x - a) / (b - a), 0, 1)
	return t * t * (3 - 2 * t)
end
local function smoother(t)
	t = clamp(t, 0, 1)
	return t * t * t * (t * (6 * t - 15) + 10)
end
-- 0 before a, ramps up to 1 at b, holds until c, ramps down to 0 at d
local function hold(f, a, b, c, d)
	if f <= a or f >= d then
		return 0
	end
	if f < b then
		return sstep(a, b, f)
	end
	if f <= c then
		return 1
	end
	return 1 - sstep(c, d, f)
end
-- one smooth bump of length dur starting at `start`
local function bump(f, start, dur)
	local t = (f - start) / dur
	if t < 0 or t > 1 then
		return 0
	end
	return math.sin(math.pi * t) ^ 2
end
local function wave(f, period, shift)
	return math.sin(2 * math.pi * (f - (shift or 0)) / period)
end
-- eased curve through {frame, value} keys, wrapping when N is given (loops)
local function track(f, pts, N)
	if N then
		f = f % N
		local first, last = pts[1], pts[#pts]
		local wrapped = { { last[1] - N, last[2] } }
		for _, p in pts do
			table.insert(wrapped, p)
		end
		table.insert(wrapped, { first[1] + N, first[2] })
		pts = wrapped
	end
	if f <= pts[1][1] then
		return pts[1][2]
	end
	for i = 1, #pts - 1 do
		local a, b = pts[i], pts[i + 1]
		if f >= a[1] and f <= b[1] then
			if b[1] == a[1] then
				return b[2]
			end
			return a[2] + (b[2] - a[2]) * smoother((f - a[1]) / (b[1] - a[1]))
		end
	end
	return pts[#pts][2]
end

-- ---------------------------------------------------------------- pose
-- A pose holds six numbers per joint {rx, ry, rz, tx, ty, tz} (radians, studs) plus eye openness and nose scale.

local Pose = {}
Pose.__index = Pose

local function newPose()
	return setmetatable({ j = {}, eyes = 1, nose = 1 }, Pose)
end

function Pose:_get(name)
	local p = self.j[name]
	if not p then
		p = { 0, 0, 0, 0, 0, 0 }
		self.j[name] = p
	end
	return p
end
-- rotation in degrees about the joint's X (pitch), Y (yaw) and Z (roll) axes, added to what is there
function Pose:rot(name, x, y, z)
	local p = self:_get(name)
	p[1] += math.rad(x or 0)
	p[2] += math.rad(y or 0)
	p[3] += math.rad(z or 0)
end
-- offset in studs: x to the right, y up, z backwards
function Pose:loc(name, x, y, z)
	local p = self:_get(name)
	p[4] += x or 0
	p[5] += y or 0
	p[6] += z or 0
end
function Pose:ears(perkDeg)
	self:rot("earL", -perkDeg)
	self:rot("earR", -perkDeg)
end
function Pose:tail(raiseDeg, sway1, sway2)
	self:rot("tail1", -(raiseDeg - REST_TAIL) * 0.6, sway1 or 0)
	self:rot("tail2", -(raiseDeg - REST_TAIL) * 0.4, sway2 or 0)
end
function Pose:jaw(openDeg)
	self:rot("jaw", -openDeg)
end

local function blend(a, b, alpha)
	local out = newPose()
	local seen = {}
	for name in a.j do
		seen[name] = true
	end
	for name in b.j do
		seen[name] = true
	end
	for name in seen do
		local pa, pb = a.j[name] or { 0, 0, 0, 0, 0, 0 }, b.j[name] or { 0, 0, 0, 0, 0, 0 }
		local o = out:_get(name)
		for i = 1, 6 do
			o[i] = pa[i] + (pb[i] - pa[i]) * alpha
		end
	end
	out.eyes = a.eyes + (b.eyes - a.eyes) * alpha
	out.nose = a.nose + (b.nose - a.nose) * alpha
	return out
end

-- a reaction is added on top of the running loop (it starts and ends at rest, so nothing pops)
local function addOn(base, extra)
	for name, p in extra.j do
		local o = base:_get(name)
		for i = 1, 6 do
			o[i] += p[i]
		end
	end
	base.eyes *= extra.eyes
	base.nose *= extra.nose
end

-- ---------------------------------------------------------------- clips
-- Each clip function takes a frame number (30 per second) and returns a pose.

local LEG_PHASE = { BL = 0.0, FL = 0.25, BR = 0.5, FR = 0.75 } -- lateral sequence, as ferrets walk

-- A foot is planted and pushes back from +A to -A degrees, then swings forward fast and folds up.
local function gait(p, f, N, A, duty, lift)
	for side, phase in LEG_PHASE do
		local u = (f / N + phase) % 1
		local ang, fold
		if u < duty then
			ang, fold = A - 2 * A * (u / duty), 0
		else
			local t = (u - duty) / (1 - duty)
			ang = -A + 2 * A * smoother(t)
			fold = lift * math.sin(math.pi * t)
		end
		p:rot("leg" .. side, ang)
		p:rot("paw" .. side, -fold)
	end
end

local Clips = {}

Clips.idle = { frames = 96, loop = true, fn = function(f)
	local N = 96
	local p = newPose()
	local br = 0.5 - 0.5 * math.cos(2 * math.pi * f / 48) -- two breaths per cycle
	p:loc("chest", 0, 0.05 * br, 0)
	p:loc("torso", 0, 0.02 * br, 0)
	-- look around and hold, with the ears and the spine following
	local look = track(f, { { 0, 0 }, { 14, 0 }, { 22, 16 }, { 40, 16 }, { 48, 0 }, { 60, 0 }, { 68, -11 }, { 82, -11 }, { 90, 0 } }, N)
	p:rot("head", 2 * wave(f, 48), look * 0.8)
	p:rot("chest", 0, look * 0.2)
	p:rot("body", 0, 1.5 * wave(f, 96))
	p:tail(9, 7 * wave(f, 96), 6 * wave(f, 96, 5))
	p:ears(0)
	p:rot("earR", 17 * bump(f, 16, 8)) -- one quick twitch each, never together
	p:rot("earL", 17 * bump(f, 64, 8))
	p.nose = 1 + 0.15 * (bump(f, 10, 6) + bump(f, 58, 6))
	return p
end }

Clips.walk = { frames = 16, loop = true, fn = function(f)
	local N = 16
	local p = newPose()
	gait(p, f, N, 32, 0.6, 38)
	p:loc("body", 0, -0.04 + 0.04 * math.abs(wave(f, 16, 1) ), 0)
	p:rot("body", 0, 2 * wave(f, 8))
	p:rot("chest", 0, -3 * wave(f, 8, 1))
	p:rot("head", 3 * wave(f, 8, 1.5))
	p:tail(9, 6 * wave(f, 16), 6 * wave(f, 16, 3))
	p:ears(-9)
	return p
end }

Clips.run = { frames = 12, loop = true, fn = function(f)
	local N = 12
	local p = newPose()
	local w = 2 * math.pi * f / N
	for _, side in { "FL", "FR" } do
		p:rot("leg" .. side, 49 * math.cos(w))
		p:rot("paw" .. side, -22 * math.max(0, -math.cos(w)))
	end
	for _, side in { "BL", "BR" } do
		p:rot("leg" .. side, -49 * math.cos(w - 0.6))
		p:rot("paw" .. side, -26 * math.max(0, math.cos(w - 0.6)))
	end
	p:loc("body", 0, -0.05 + 0.18 * math.max(0, math.sin(w + 0.3)), 0) -- hop, with a flight phase
	p:rot("body", 6 * math.sin(w)) -- spine humps and stretches
	p:rot("chest", -6 * math.sin(w))
	p:rot("head", 6 + 3 * wave(f, 6))
	p:tail(40 + 9 * wave(f, 12), 0, 0)
	p:rot("tail2", -17)
	p:ears(-23)
	p:jaw(15)
	return p
end }

Clips.sniff = { frames = 42, loop = true, fn = function(f)
	local p = newPose()
	p:rot("head", -(14 + 5 * wave(f, 42)), 0, 0)
	p:loc("head", 0.05 * wave(f, 21), -0.02, 0)
	p.nose = 1.2 + 0.2 * wave(f, 3)
	p:rot("body", -3)
	p:rot("legFL", 6)
	p:ears(11)
	p:tail(10, 5 * wave(f, 42), 4 * wave(f, 42, 3))
	return p
end }

Clips.curious = { frames = 78, loop = true, fn = function(f)
	local p = newPose()
	p:rot("body", 9)
	p:loc("body", 0, 0.035, 0)
	p:rot("head", 14 + 6 * wave(f, 78), 0, 4 * wave(f, 78, 10))
	p.eyes = 1.15
	p:ears(17)
	p.nose = 1 + 0.1 * (0.5 + 0.5 * wave(f, 6))
	p:rot("legFL", -6)
	p:rot("legFR", -6)
	p:tail(23, 6 * wave(f, 78), 5 * wave(f, 78, 4))
	return p
end }

Clips.sleep = { frames = 126, loop = true, fn = function(f)
	local p = newPose()
	local br = 0.5 - 0.5 * math.cos(2 * math.pi * f / 126)
	p:loc("body", 0, -0.36 + 0.03 * br, 0) -- sits on the floor, legs tucked under
	p:rot("body", 4)
	p:loc("chest", 0, 0.03 * br, 0)
	for _, side in { "FL", "FR" } do
		p:rot("leg" .. side, -70)
		p:rot("paw" .. side, -50)
	end
	for _, side in { "BL", "BR" } do
		p:rot("leg" .. side, -70)
		p:rot("paw" .. side, -50)
	end
	p:rot("head", -25, 31)
	p:ears(-29)
	p:tail(-20, 75, 65) -- lowered and wrapped round the body
	p.eyes = 0.05
	-- small dream twitch
	p:rot("earL", 8 * bump(f, 40, 6) )
	return p
end }

Clips.eat = { frames = 24, loop = true, fn = function(f)
	local p = newPose()
	p:rot("head", -40)
	p:loc("head", 0, 0, -0.14)
	p:jaw(22 * (0.5 - 0.5 * math.cos(2 * math.pi * f / 8)))
	p:rot("body", -6)
	p:ears(-6)
	p:tail(11, 9 * wave(f, 24), 8 * wave(f, 24, 2))
	return p
end }

Clips.drink = { frames = 36, loop = true, fn = function(f)
	local p = newPose()
	p:rot("head", -50)
	p:loc("head", 0, 0, -0.21)
	p:jaw(15 * (0.5 - 0.5 * math.cos(2 * math.pi * f / 6)))
	p:rot("body", -8)
	p.nose = 1 + 0.1 * bump(f % 12, 0, 4)
	p:ears(-17)
	p:tail(10, 6 * wave(f, 36), 5 * wave(f, 36, 3))
	return p
end }

-- One-shots start and end at rest and are added on top of the running loop.

Clips.happy = { frames = 39, loop = false, fn = function(f)
	local p = newPose()
	local env = hold(f, 0, 3, 36, 39)
	p:loc("body", 0, 0.32 * math.abs(math.sin(math.pi * f / 13)) * env, 0) -- three hops
	p:rot("tail1", -23 * env, 29 * wave(f, 4) * env)
	p:rot("tail2", 0, 29 * wave(f, 4, 2) * env)
	p:rot("head", 6 * env)
	p.eyes = 1 - 0.7 * hold(f, 4, 6, 32, 34)
	p:jaw(15 * env)
	return p
end }

Clips.annoyed = { frames = 30, loop = false, fn = function(f)
	local p = newPose()
	p:rot("head", 0, 10 * wave(f, 5) * hold(f, 0, 2, 22, 26))
	p:rot("earL", 40 * hold(f, 0, 3, 24, 28))
	p:rot("earR", 40 * hold(f, 0, 3, 24, 28))
	p:rot("tail1", -11 * hold(f, 0, 3, 24, 29), 17 * wave(f, 8) * hold(f, 0, 2, 24, 29))
	p.eyes = 1 - 0.5 * hold(f, 2, 3, 26, 29)
	return p
end }

Clips.surprise = { frames = 24, loop = false, fn = function(f)
	local p = newPose()
	p:loc("body", 0, 0.35 * track(f, { { 0, 0 }, { 5, 1 }, { 9, 0 } }), 0)
	p:rot("body", 6 * hold(f, 0, 5, 20, 24))
	p:rot("head", 11 * hold(f, 0, 5, 20, 24))
	p:rot("earL", -14 * hold(f, 0, 5, 20, 24))
	p:rot("earR", -14 * hold(f, 0, 5, 20, 24))
	p:rot("tail1", -52 * hold(f, 0, 4, 20, 24))
	p.eyes = 1 + 0.2 * hold(f, 0, 5, 20, 24)
	p:jaw(8 * hold(f, 5, 7, 16, 18))
	return p
end }

Clips.blink = { frames = 5, loop = false, fn = function(f)
	local p = newPose()
	local keys = { 1, 0.5, 0.05, 0.5, 1, 1 }
	local i = clamp(math.floor(f), 0, 4)
	local t = f - i
	p.eyes = keys[i + 1] + (keys[i + 2] - keys[i + 1]) * t
	return p
end }

FerretRig.Clips = Clips

-- ---------------------------------------------------------------- the rig

function FerretRig.new(model: Model)
	local self = setmetatable({}, FerretRig)
	self.model = model
	self.joints = {}
	for _, name in JOINTS do
		local part = model:FindFirstChild(name)
		self.joints[name] = part and part:FindFirstChildOfClass("Motor6D")
	end
	self.eyeSizes = { eyeL = model.eyeL.Size, eyeR = model.eyeR.Size }
	self.noseSize = model.nose.Size
	self.base, self.baseStart, self.speed = "idle", 0, 1
	self.prev = nil -- { name, start, speed } of the clip we are fading from
	self.reactions = {} -- { name, start }
	self.random = Random.new()
	self.nextBlink = 1
	return self
end

-- Set the looping base clip. speed scales playback (walk speed matches the ground speed).
function FerretRig:setBase(name: string, now: number, speed: number?)
	speed = speed or 1
	if name ~= self.base then
		self.prev = { name = self.base, start = self.baseStart, speed = self.speed }
		self.base, self.baseStart, self.speed = name, now, speed
	else
		-- same clip, new speed: keep the phase continuous
		local phase = (now - self.baseStart) * self.speed
		self.speed = speed
		self.baseStart = now - phase / speed
	end
end

function FerretRig:react(name: string, now: number)
	table.insert(self.reactions, { name = name, start = now })
end

function FerretRig:_loopPose(name: string, start: number, speed: number, now: number)
	local clip = Clips[name]
	local f = (now - start) * speed * FPS
	return clip.fn(f % clip.frames)
end

function FerretRig:pose(now: number)
	local pose = self:_loopPose(self.base, self.baseStart, self.speed, now)
	if self.prev then
		local alpha = (now - self.baseStart) / FADE
		if alpha >= 1 then
			self.prev = nil
		else
			local old = self:_loopPose(self.prev.name, self.prev.start, self.prev.speed, now)
			pose = blend(old, pose, smoother(alpha))
		end
	end
	-- random blink, never while asleep
	if self.base ~= "sleep" and now >= self.nextBlink then
		self:react("blink", now)
		self.nextBlink = now + self.random:NextNumber(2, 5)
	end
	for i = #self.reactions, 1, -1 do
		local r = self.reactions[i]
		local clip = Clips[r.name]
		local f = (now - r.start) * FPS
		if f >= clip.frames then
			table.remove(self.reactions, i)
		else
			addOn(pose, clip.fn(f))
		end
	end
	return pose
end

-- Call every frame (about 10 times a second is enough while asleep).
function FerretRig:update(now: number)
	local pose = self:pose(now)
	for name, joint in self.joints do
		local p = pose.j[name]
		if p then
			joint.Transform = CFrame.new(p[4], p[5], p[6]) * CFrame.Angles(p[1], p[2], p[3])
		else
			joint.Transform = CFrame.identity
		end
	end
	-- Transform cannot scale, so blinking and the nose twitch change the piece's Size
	for name, size in self.eyeSizes do
		self.model[name].Size = Vector3.new(size.X, size.Y * math.max(pose.eyes, 0.02), size.Z)
	end
	self.model.nose.Size = self.noseSize * pose.nose
end

-- The base-clip names the brain can use, and how fast the model moves while they play (studs per second).
FerretRig.NominalSpeed = { walk = 2.0, run = 6.2 }

return FerretRig
