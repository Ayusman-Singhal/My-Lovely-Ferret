-- Edit-mode pose viewer for screenshots. Physics does not run in Edit mode, so Motor6D.Transform changes
-- nothing there. This solves the joint tree by hand: child = parent * C0 * Transform * C1:Inverse().
-- Studio caches require() results, so load fresh copies after editing a script:
--   local V = require(game.ServerStorage.Tests.PoseViewer:Clone())
-- Usage (command bar or MCP):
--   V.show("walk", 0.2)            -- clip name, time in seconds. Puts a ferret at (0,0,0) in Workspace.ViewerFerret
--   V.clear()

local FerretRig = require(game.StarterPlayer.StarterPlayerScripts.FerretRig:Clone())

local V = {}

function V.clear()
	local old = workspace:FindFirstChild("ViewerFerret")
	if old then
		old:Destroy()
	end
end

-- Setting a part's CFrame drags every part joined to it (even with Enabled = false). So take the joints out
-- of the model first (a Motor6D with no parent joins nothing, but keeps its values), then place the parts.
local function solve(model, rig)
	local motors = {}
	for _, d in model:GetDescendants() do
		if d:IsA("Motor6D") then
			table.insert(motors, d)
		end
	end
	for _, m in motors do
		m.Parent = nil
	end
	local byParent = {}
	for _, m in motors do
		byParent[m.Part0] = byParent[m.Part0] or {}
		table.insert(byParent[m.Part0], m)
	end
	local function walk(part0)
		for _, m in byParent[part0] or {} do
			m.Part1.CFrame = m.Part0.CFrame * m.C0 * m.Transform * m.C1:Inverse()
			walk(m.Part1)
		end
	end
	walk(model.PrimaryPart)
end

local function build(clip: string, t: number, base: string?, cf: CFrame, name: string)
	local model = game.ReplicatedStorage.Assets.Ferret:Clone()
	model.Name = name
	model.Parent = workspace
	model:PivotTo(cf)
	local rig = FerretRig.new(model)
	rig.nextBlink = math.huge
	if FerretRig.Clips[clip].loop then
		rig:setBase(clip, 0, 1)
	else
		rig:setBase(base or "idle", 0, 1)
		rig:react(clip, 0)
	end
	rig:update(t)
	solve(model, rig)
	for _, d in model:GetDescendants() do
		if d:IsA("BasePart") then
			d.Anchored = true
		end
	end
	return model
end

-- One ferret at the origin, nose toward -Z. `base` is an optional loop played underneath a one-shot.
function V.show(clip: string, t: number, base: string?, at: Vector3?)
	V.clear()
	return build(clip, t, base, CFrame.new(at or Vector3.new(0, 0.02, 0)), "ViewerFerret")
end

-- A row of ferrets seen from the side (camera at z = +12), nose to the left. items = { {clip, t, base?}, ... }
-- Ferrets are 6 studs apart, the first at x = 0.
function V.row(items)
	V.clear()
	local folder = Instance.new("Folder")
	folder.Name = "ViewerFerret"
	folder.Parent = workspace
	for i, item in items do
		local cf = CFrame.new((i - 1) * 6, 0.02, 0) * CFrame.Angles(0, math.rad(90), 0)
		local m = build(item[1], item[2], item[3], cf, item[1] .. "_" .. item[2])
		m.Parent = folder
	end
	return folder
end

return V
