// Dev-only spike (Part 1K.3): the Blender ferret in three.js (the three.js half; the entry
// ferret3d.ts starts the model download first and loads this file in parallel). Open /dev/ferret3d.html with
// `npm run dev`, or measure the production build with `node scripts/measure-startup.mjs`.
// Not part of the app build (only index.html is built). Answers three questions before the
// 3D pivot is committed to: how many bytes, how fast is it ready on a slow phone profile,
// and does a settled scene cost nothing (docs/PERFORMANCE.md §3.2).
import {
  AdditiveAnimationBlendMode,
  AmbientLight,
  AnimationAction,
  AnimationClip,
  AnimationMixer,
  AnimationUtils,
  BoxGeometry,
  Color,
  DirectionalLight,
  Group,
  LoopOnce,
  Mesh,
  MeshLambertMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import manifest from '../../animation/clips.json';

type ClipName = keyof typeof manifest.clips;
const FPS = manifest.fps;
const FADE_S = 0.2;
// Animations that change slowly can be drawn less often (docs/ART_STYLE.md, guide §4.4).
const FRAME_INTERVAL_MS: Partial<Record<ClipName, number>> = { sleep: 100 };

const names = Object.keys(manifest.clips) as ClipName[];
const baseNames = names.filter((n) => manifest.clips[n].loop);
const reactionNames = names.filter((n) => !manifest.clips[n].loop);

interface SpikeState {
  ready: boolean;
  readyMs: number;
  /** Milliseconds since navigation start: entry script ran, model bytes arrived, three.js code ready, first frame drawn. */
  marks: { entry: number; model: number; three: number; firstDraw: number };
  frames: number;
  paused: boolean;
  triangles: number;
  drawCalls: number;
  clips: number;
  pause(on: boolean): void;
  setBase(name: string): void;
  react(name: string): void;
  flip(): void;
  step(seconds: number): void;
}

const stage = document.getElementById('stage') as HTMLElement;
const loading = document.getElementById('loading') as HTMLElement;
const panel = document.getElementById('panel') as HTMLElement;
const info = document.getElementById('info') as HTMLElement;

const renderer = new WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
stage.append(renderer.domElement);

const scene = new Scene();
scene.background = new Color(0xf6ecdc);
scene.add(new AmbientLight(0xfff1dc, 1.6));
const sun = new DirectionalLight(0xffffff, 1.8);
sun.position.set(-1.2, 2.5, 2);
scene.add(sun);

// A box room: floor, back wall, left wall, a window. One material colour per surface, no textures.
const room = new Group();
const flat = (hex: number) => new MeshLambertMaterial({ color: hex });
const floor = new Mesh(new PlaneGeometry(1.8, 1.4), flat(0xc9a07a));
floor.rotation.x = -Math.PI / 2;
floor.position.set(0, 0, 0.3);
const wall = new Mesh(new PlaneGeometry(1.8, 0.9), flat(0xebd3b5));
wall.position.set(0, 0.45, -0.4);
const window3d = new Mesh(new BoxGeometry(0.35, 0.3, 0.02), flat(0x6fa8c8));
window3d.position.set(0.3, 0.5, -0.39);
const bowl = new Mesh(new BoxGeometry(0.12, 0.05, 0.12), flat(0xd9604c));
bowl.position.set(-0.45, 0.025, 0.1);
room.add(floor, wall, window3d, bowl);
scene.add(room);

const VFOV = 32;
const VIEW_WIDTH_M = 1.15; // how much of the room must fit across the screen, in metres
const camera = new PerspectiveCamera(VFOV, 1, 0.1, 10);
const LOOK_AT = new Vector3(0, 0.1, 0);

function resize(): void {
  const w = stage.clientWidth;
  const h = stage.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  // Portrait phones are narrow: pull the camera back until the room fits across the screen.
  const distance = Math.max(1.4, VIEW_WIDTH_M / 2 / (Math.tan((VFOV * Math.PI) / 360) * camera.aspect));
  camera.position.set(0, 0.32 * distance, 0.95 * distance);
  camera.lookAt(LOOK_AT);
  draw();
}

let mixer: AnimationMixer | undefined;
const actions = new Map<ClipName, AnimationAction>();
let base: ClipName = 'idle';
let ferret: Group | undefined;
let facing: 1 | -1 = 1;
let lastDrawMs = 0;
let rafId = 0;

const state: SpikeState = {
  ready: false,
  readyMs: 0,
  marks: { entry: 0, model: 0, three: 0, firstDraw: 0 },
  frames: 0,
  paused: false,
  triangles: 0,
  drawCalls: 0,
  clips: 0,
  pause(on) {
    state.paused = on;
    if (!on) schedule();
  },
  setBase: (name) => setBase(name as ClipName),
  react: (name) => react(name as ClipName),
  flip() {
    facing = facing === 1 ? -1 : 1;
    applyFacing();
    draw();
  },
  step(seconds) {
    mixer?.update(seconds);
    draw();
  },
};
(window as unknown as { __spike: SpikeState }).__spike = state;
state.marks.three = performance.now();

function applyFacing(): void {
  // The model faces +Z. The room is seen from +Z, and the pet walks left or right (docs/ART_STYLE.md).
  if (ferret) ferret.rotation.y = facing === 1 ? Math.PI / 2 : -Math.PI / 2;
}

function setBase(name: ClipName): void {
  const next = actions.get(name);
  const prev = actions.get(base);
  if (!next || name === base) return;
  next.reset().fadeIn(FADE_S).play();
  prev?.fadeOut(FADE_S);
  base = name;
  syncButtons();
  schedule();
}

function react(name: ClipName): void {
  const action = actions.get(name);
  if (!action) return;
  action.reset().play();
  schedule();
}

function draw(): void {
  renderer.render(scene, camera);
  state.frames += 1;
  state.drawCalls = renderer.info.render.calls;
  state.triangles = renderer.info.render.triangles;
}

function schedule(): void {
  if (rafId || state.paused) return;
  rafId = requestAnimationFrame(tick);
}

let lastTick = 0;
function tick(nowMs: number): void {
  rafId = 0;
  if (state.paused || document.hidden) return;
  const interval = FRAME_INTERVAL_MS[base] ?? 0;
  if (nowMs - lastDrawMs >= interval) {
    const dt = lastTick ? (nowMs - lastTick) / 1000 : 0;
    lastTick = nowMs;
    mixer?.update(Math.min(dt, 0.1));
    lastDrawMs = nowMs;
    draw();
    info.textContent = `${base}   frames ${state.frames}   draws ${state.drawCalls}   tris ${state.triangles}`;
  }
  schedule();
}
document.addEventListener('visibilitychange', () => {
  lastTick = 0;
  if (!document.hidden) schedule();
});

function syncButtons(): void {
  for (const button of panel.querySelectorAll<HTMLButtonElement>('button[data-base]')) {
    button.setAttribute('aria-pressed', String(button.dataset['base'] === base));
  }
}

function addButton(label: string, onClick: () => void, baseName?: string): void {
  const button = document.createElement('button');
  button.textContent = label;
  if (baseName) button.dataset['base'] = baseName;
  button.addEventListener('click', onClick);
  panel.append(button);
}

export function start(modelBytes: ArrayBuffer, early: { entry: number; model: number }): void {
  state.marks.entry = early.entry;
  state.marks.model = early.model;
  new GLTFLoader().parse(modelBytes, '', onModel, (error) => console.error(error));
}

function onModel(gltf: GLTF): void {
  ferret = gltf.scene;
  scene.add(ferret);
  applyFacing();
  mixer = new AnimationMixer(ferret);
  state.clips = gltf.animations.length;

  for (const source of gltf.animations) {
    const name = source.name as ClipName;
    const spec = manifest.clips[name];
    if (!spec) continue;
    // Loops keep their last key (a copy of the first): the mixer wraps at the clip length,
    // so that frame is never shown on its own. One-shots become additive: only their
    // difference from the rest pose is added on top of the running loop.
    let clip: AnimationClip = source;
    if (!spec.loop) {
      clip = source.clone();
      AnimationUtils.makeClipAdditive(clip, 0, clip, FPS);
    }
    const a = mixer.clipAction(clip);
    if (spec.loop) {
      a.setEffectiveWeight(1);
    } else {
      a.blendMode = AdditiveAnimationBlendMode;
      a.setLoop(LoopOnce, 1);
      a.clampWhenFinished = false;
    }
    actions.set(name, a);
  }

  actions.get('idle')?.play();
  for (const n of baseNames) addButton(n, () => setBase(n), n);
  for (const n of reactionNames) addButton(`+${n}`, () => react(n));
  addButton('flip', () => state.flip());
  addButton('pause', () => state.pause(!state.paused));
  syncButtons();

  loading.remove();
  window.addEventListener('resize', resize);
  resize();
  state.marks.firstDraw = performance.now();
  // Ready means: model parsed, clips built, first frame on the canvas.
  requestAnimationFrame(() => {
    state.ready = true;
    state.readyMs = performance.now();
    schedule();
  });
}
