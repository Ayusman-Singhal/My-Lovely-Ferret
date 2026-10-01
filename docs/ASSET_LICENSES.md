# Asset and Dependency Licenses

Rules (guide §0, §9.2, §25.1):

- Free tools, free packages, and CC0 or permissively licensed assets only. The developer has no budget.
- Record **every** third-party asset here **before** it is committed: name, what it is used for, author, source URL, license, license URL, date added, and whether attribution is required (and where it is shown).
- Assets the developer draws themselves are recorded too, as "original, all rights held by the developer".
- If a license is unclear or not permissive, do not use the asset. Ask the developer.

## Art, audio, fonts

| Asset | Used for | Author | Source | License | Attribution needed | Added |
|---|---|---|---|---|---|---|
| "Black Footed Ferret" 3D model (base for the pet, to be rigged, animated, and repainted by the developer) | Pet model | LandyStudio | https://sketchfab.com/3d-models/black-footed-ferret-540a23f77ca74c9c9572cd6b6b25171e | CC Attribution 4.0 (commercial use allowed, changes allowed) | Yes: credit the author and say it was modified, in the in-app credits screen | 2026-10-01 (chosen, not yet committed) |

Until the 3D pet ships, the game uses only code-drawn placeholder art (`ART_STYLE.md`). The model file itself may be committed only after this row is complete.

## Code dependencies

Licenses of direct dependencies, checked with `npm view <package> license` on 2026-09-30. Re-check when a dependency is added or a major version changes.

| Package | Use | License |
|---|---|---|
| preact | UI | MIT |
| vite | build tool (dev) | MIT |
| @preact/preset-vite | Vite plugin (dev) | MIT |
| typescript | compiler (dev) | Apache-2.0 |
| vitest | tests (dev) | MIT |
| eslint | lint (dev) | MIT |
| @eslint/js | lint rules (dev) | MIT |
| typescript-eslint | lint (dev) | MIT |
| @types/node | types for config files (dev) | MIT |

Only `preact` ships to players. The MIT license requires its copyright and permission notice to be kept with copies. Vite bundles the license comment where required. Add a licenses screen or `THIRD_PARTY_NOTICES` file before public release (Phase 7).
