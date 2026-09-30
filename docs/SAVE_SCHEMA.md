# Save Schema

Versioned save, storage layout, and backup format. Source: guide §8, §13.6, §25.3, §25.8. Phase 1 builds the local parts (IndexedDB, export, import, migrations). Fields for later phases are present but empty, so the first real save does not need a migration just to add them.

## 1. Proposed deviations from the guide's example (need developer approval at the Phase 0 gate)

| # | Guide example | This schema | Why |
|---|---|---|---|
| D1 | Times as ISO strings (`"2026-10-01T10:00:00Z"`) | Times as integer epoch milliseconds | `core` stays free of date parsing and string math, and comparisons are exact integers. The Firestore `summary` (Phase 3) can still carry ISO strings, converted at the edge. |
| D2 | Traits 0 to 1 | Traits integers 0 to 100 | No floats in `core` (guide §7.2). |
| D3 | `sha256` style checksum | FNV-1a 32-bit checksum of the JSON text (`hashString` in `core/rng.ts`) | The checksum detects corruption, not tampering (guide §16 accepts save tampering). It needs no async crypto and works over plain `http` on a LAN test phone, where `crypto.subtle` is unavailable. The transfer bundle in Phase 4 still uses SHA-256 as the guide says (§10.3). |

If any is rejected, only the type definitions below and their tests change.

## 2. File shape (v1)

```ts
interface SaveFile {
  schemaVersion: 1;
  installId: string;            // never written to export files, see section 6
  pets: PetRecord[];            // at most 2 (guide Open Decision 11)
  activePetId: string;
  settings: Settings;
  tester: TesterCounters;       // guide §25.3, browser build
}

interface PetRecord {
  pet: { id: string; name: string; species: 'ferret'; coat: Coat; born: number };
  personality: { mischief: number; curiosity: number; affection: number };   // 0..100
  state: PetState;
  inventory: { shinies: number; items: string[] };   // present, unused until Phase 2
  home: { furniture: string[]; mess: number };       // present, unused until Phase 2
  ownership: {                                       // Phase 1 always the defaults below
    role: 'owner';
    ownerUid: '';
    epoch: 1;
    deviceId: string;                                // = installId
    caretaker: null;
    status: 'active';
  };
  careDays: { count: 0; dates: [] };                 // Phase 4
  history: HistoryEvent[];                           // capped at 500, newest last
  sync: { outbox: []; lastAppliedSeq: {}; lastPairRevision: '' };   // Phase 3
  timestamps: { lastSimulationTime: number; lastSaved: number };
  tzOffsetMin: number;                               // owner's fixed UTC offset in minutes
}

type Coat = 'sable' | 'albino' | 'cinnamon' | 'panda';

interface PetState {
  hunger: number; hydration: number; energy: number; happiness: number;   // 0..10000
  bond: number;                                                           // 0..10000
  sleepState: 'awake' | 'asleep';
  currentActivity: string;                    // Behavior name, see PET_BEHAVIOR.md
  favoriteFood: string; favoriteToy: string; favoriteActivity: string;
  lastInteractionTime: number;
  // Bookkeeping the simulation needs to stay deterministic and chunk-invariant:
  sleepStartedAt: number | null;              // start of the current sleep, for PET_SLEPT_LONG
  lastStoleAt: number | null;                 // steal cooldown (12 hours)
  lastFoundDate: string | null;               // owner-local date "YYYY-MM-DD" of the last found item
  lastPlayRewardAt: number | null;            // play reward cooldown (30 minutes)
  daily: { date: string; pet: number; feed: number; play: number };   // counters for bond diminishing returns
}

interface HistoryEvent {
  id: string; t: number; type: string;
  actor: 'owner' | 'caretaker' | 'pet';
  payload: Record<string, string | number>;
}

interface Settings {
  language: 'en' | 'hi';
  soundVolume: number;          // 0..100
  musicVolume: number;          // 0..100
  reducedMotion: boolean;       // defaults from prefers-reduced-motion
  highContrast: boolean;
  textScale: number;            // percent, 100 default
  lowPowerMode: boolean;        // 30 fps render
}

interface TesterCounters {      // local only, shown on "About my pet", sent only if the tester chooses
  sessions: number;
  firstOpenDate: number;
  lastOpenDate: number;
  interactionCounts: Record<string, number>;
}
```

Not stored: `mood` (derived), `trust`, `hygiene`, `enrichment` (guide §7.1). The exact list and semantics of `PetState` fields is `GAME_DESIGN.md` section 2.

## 3. Storage in the browser (guide §8)

IndexedDB, one database `ferret`, one object store `kv`. `localStorage` is not used for the save. A tiny in-house wrapper (about 40 lines) replaces a library.

| Key | Value |
|---|---|
| `save.a`, `save.b` | `{ seq, checksum, json }`: two slots. |
| `installId` | random UUID, created once, kept in the same database. |

**Atomic write.** Each save writes the slot that is **not** the newest, with `seq = newestSeq + 1`, inside one IndexedDB transaction, and then reads it back to verify the checksum. The previous slot stays untouched, so a failed or corrupt write can never destroy the only good copy.

**Load.** Read both slots. A slot is usable when its checksum matches, it parses, it migrates, and it passes `validateSave`. Take the usable slot with the highest `seq`. `loadWithInfo()` returns a status the UI reacts to:

| Status | Meaning | UI |
|---|---|---|
| `empty` | Nothing stored | First-run flow |
| `ok` | Newest slot used | Normal |
| `recovered` | One slot was damaged, the other was used | Plain message: "Restored from the previous save" |
| `corrupt` | Slots exist but none is usable | Offer "Import backup". Nothing is overwritten or deleted |
| `too_new` | A slot was written by a newer app | Read-only: "Update the app". `save()` refuses to overwrite it |

**Save.** `save()` validates first and throws rather than write an invalid save. It writes to the slot that is not the best valid one (so after a recovery it overwrites the damaged slot, never the good one), sets each pet's `lastSaved`, then reads the slot back and compares checksums. A failed or silently dropped write throws and leaves the previous slot untouched.

**`installId` is authoritative in its own key** (`installId`), not in the slot. `load()` always overwrites the file's copy with it, so a restored or imported slot can never bring an old `installId` back (guide §8, §13.6).

Implementation: `src/platform/saveStore.ts` (slot logic, storage-agnostic), `src/platform/web/idbBackend.ts` (IndexedDB), `src/core/save.ts` (schema, validation, migrations, backup format).

**When to save.** On meaningful change (debounced), and when the page becomes hidden. Never every frame.

**Persistence.** Call `navigator.storage.persist()` where available. Browser storage can still be evicted (guide §8). The browser build is a preview.

**iOS Safari.** Detect iOS Safari outside an installed PWA and show: "Add to Home Screen, and export a backup." Site data can be deleted after about 7 days (guide §8, to be verified in Part 1B and recorded in `VERIFY_LOG.md`).

## 4. Migrations

- Every save has `schemaVersion`. The migration chain is an ordered list `migrations[n]` that turns version `n` into `n + 1`. Never assume an old save has a new field.
- Migrations run **before** the new UI loads (guide §25.8). A failed migration keeps the old save untouched and offers Export.
- A save with a `schemaVersion` **higher** than the app knows is rejected with "this backup is from a newer version" and left alone.
- Tests (Part 1B): a fixture file per released version, migrated to current, deep-compared to a hand-written expected value. Round trip: export, import, equal.

## 5. Export and import (Phase 1, guide §8)

Export file (`ferret-backup-YYYYMMDD.json`):

```json
{
  "format": "ferret-backup",
  "schemaVersion": 1,
  "exportedAt": 1790000000000,
  "checksum": "9f2c1a7e",
  "save": { "pets": [], "activePetId": "", "settings": {}, "tester": {} }
}
```

- `checksum` covers the `save` object serialized with the same stable key order used for storage.
- **`installId` is never in an export** (guide §8, §13.6).
- Import validates in this order: it is JSON, `format` matches, `checksum` matches, `schemaVersion` is not newer than the app's, then migrations run, then a structural validation of every field (ranges, enum values, pet count at most 2). Any failure shows a plain message and changes nothing.
- On success the current save is kept as the previous slot, the imported pets become the save, and `installId` stays the one of this browser. In Phase 4, an imported pet that has an ownership pair opens as a **tombstone** until the player picks "Move" or "Take over" (guide §13.6).

## 6. `installId`

A random UUID created once per install and used as `deviceId`, and later as the key for command `seq` (guide §10.6, §13.5). In the browser it lives in the same IndexedDB as the save. It is generated again if missing. It never appears in export files. In the native app (Phase 5) it lives outside the platform backup (guide §8).

## 7. Size

The save is small JSON (a few KB for one pet with a full 500-event history). This keeps the Phase 4 transfer bundle far under 1 MiB (guide §13.3).
