-- One-time command-bar script (Studio, Edit mode). NOT a game script.
-- Turns the imported Blender ferret (a Model with one wrapper Model per piece, each holding a
-- MeshPart "part_<name>") into the final `Ferret` model: scaled, flat, with Motor6D joints.
-- Used on 2026-10-01 for M2. Run it again only if the ferret is imported again.
--
-- Input: workspace["The-Ferret"] (name of the imported model). Output: workspace.Ferret.
-- Rig and pivots: animation/RIG_SPEC.md and animation/scripts/upgrade_report.json (rig v2, 22 bones).
--
-- Axis mapping, measured from the import: Roblox position = O + S * (-x, z, y) for a Blender point
-- (x, y, z), where O is the imported model's pivot (the Blender origin, on the floor between the
-- feet). The ferret faces -Z in Roblox (its LookVector). Left (+X in Blender) is -X in Roblox.

local S = 7 -- scale: nose to tail tip about 4.5 studs
local old = workspace["The-Ferret"]
local O = old:GetPivot().Position
old:ScaleTo(S)

local function P(x, y, z)
	return O + Vector3.new(-x, z, y) * S
end

local model = Instance.new("Model")
model.Name = "Ferret"

local pieces = {}
for _, wrapper in old:GetChildren() do
	local mp = wrapper:FindFirstChildWhichIsA("MeshPart")
	mp.Name = wrapper.Name
	mp.Parent = model
	pieces[wrapper.Name] = mp
end

-- invisible helper parts: root (the model's anchored handle), body (no mesh in the model), carry
local function marker(name, b, size)
	local p = Instance.new("Part")
	p.Name = name
	p.Size = size * S
	p.CFrame = CFrame.new(P(b.X, b.Y, b.Z))
	p.Transparency = 1
	p.Parent = model
	pieces[name] = p
end
marker("root", Vector3.new(0, 0, 0), Vector3.new(0.05, 0.02, 0.05))
marker("body", Vector3.new(0, 0, 0.1055), Vector3.new(0.03, 0.03, 0.03))
marker("carry", Vector3.new(0, -0.3713, 0.0979), Vector3.new(0.01, 0.01, 0.01))

for _, p in model:GetChildren() do
	p.Anchored = false
	p.CanCollide = false
	p.CanTouch = false
	p.CanQuery = false
	p.Massless = true
end
pieces.root.Anchored = true
pieces.root.Massless = false
model.PrimaryPart = pieces.root

-- { child, parent, pivot in Blender coordinates }
local joints = {
	{ "body", "root", Vector3.new(0, 0, 0.1055) },
	{ "torso", "body", Vector3.new(0, 0, 0.0633) },
	{ "chest", "body", Vector3.new(0, 0, 0.1055) },
	{ "tail1", "body", Vector3.new(0, 0.1157, 0.11) },
	{ "tail2", "tail1", Vector3.new(0, 0.1826, 0.1412) },
	{ "legBL", "body", Vector3.new(0.0475, 0.0945, 0.0844) },
	{ "legBR", "body", Vector3.new(-0.0475, 0.0945, 0.0844) },
	{ "pawBL", "legBL", Vector3.new(0.0475, 0.0945, 0.0397) },
	{ "pawBR", "legBR", Vector3.new(-0.0475, 0.0945, 0.0397) },
	{ "head", "chest", Vector3.new(0, -0.135, 0.1215) },
	{ "legFL", "chest", Vector3.new(0.0475, -0.0945, 0.0844) },
	{ "legFR", "chest", Vector3.new(-0.0475, -0.0945, 0.0844) },
	{ "pawFL", "legFL", Vector3.new(0.0475, -0.0945, 0.0397) },
	{ "pawFR", "legFR", Vector3.new(-0.0475, -0.0945, 0.0397) },
	{ "jaw", "head", Vector3.new(0, -0.2688, 0.0914) },
	{ "nose", "head", Vector3.new(0, -0.3418, 0.1044) },
	{ "earL", "head", Vector3.new(0.0633, -0.2848, 0.1846) },
	{ "earR", "head", Vector3.new(-0.0633, -0.2848, 0.1846) },
	{ "eyeL", "head", Vector3.new(0.053, -0.3332, 0.1361) },
	{ "eyeR", "head", Vector3.new(-0.053, -0.3332, 0.1361) },
	{ "carry", "head", Vector3.new(0, -0.3713, 0.0979) },
}
for _, j in joints do
	local child, parent, b = j[1], j[2], j[3]
	local pivot = CFrame.new(P(b.X, b.Y, b.Z))
	local m = Instance.new("Motor6D")
	m.Name = child
	m.Part0 = pieces[parent]
	m.Part1 = pieces[child]
	m.C0 = pieces[parent].CFrame:Inverse() * pivot -- pivot in the parent's space
	m.C1 = pieces[child].CFrame:Inverse() * pivot -- the same pivot in the child's space, so the pose does not change
	m.Parent = pieces[child]
end

model.Parent = workspace
old:Destroy()
