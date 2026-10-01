// The 3D game scene (Part 1K): the Blender ferret in a box room, drawn with three.js. It keeps the
// contract of the old 2D scene: the brain moves x, y, and facing in logical px, asks for clips by
// name, and the controller sets the props. The renderer owns per-frame animation: Preact never
// drives it (guide §4.4). Frames are scheduled on demand, capped for slow clips, and paused while
// the page is hidden (loop.ts).
//
// Loaded as a lazy chunk (Stage.tsx) so the loading screen shows before three.js is parsed.

import {
  AdditiveAnimationBlendMode,
  AmbientLight,
  AnimationAction,
  AnimationMixer,
  AnimationUtils,
  BoxGeometry,
  BufferGeometry,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Group,
  IcosahedronGeometry,
  LoopOnce,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  Object3D,
  PerspectiveCamera,
  Plane,
  Raycaster,
  Scene as ThreeScene,
  TorusGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { hashString } from '../core/rng';
import type { Coat, ToyId } from '../core/types';
import { blinkFrame } from './blink';
import { CLIPS, CLIP_FPS, frameIntervalMs, playbackRate, type AnimationName } from './clipSpec';
import { COAT_TINT } from './coats3d';
import { ROOM } from './layout';
import { browserLoopDeps, cappedPixelRatio, createRenderLoop } from './loop';
import { PALETTE, VIEW } from './palette';
import type { PetAnimator, PetScene, ScenePointer, ScenePropsState } from './petScene';
import { M_PER_PX, PET_SCALE, logicalToWorld, planeToLogical } from './stageMap';

export interface Scene3DOptions {
  coat: Coat;
  /** Seed for blink timing, for example the pet id. */
  seed: string;
  /** The model file, already downloading (modelAsset.ts). */
  model: Promise<ArrayBuffer>;
  /** Called at the start of every frame, before drawing. The brain moves the pet here. */
  onFrame?: (nowMs: number, scene: PetScene) => void;
  /** What the controller wants drawn besides the room and the pet. Read every frame. */
  getProps?: () => ScenePropsState;
  onPointer?: ScenePointer;
  lowPower?: boolean;
}

const FADE_S = 0.2;
// A 2.5D diorama view: a narrow field of view from far away, turned 28 degrees to the right and tilted
// 32 degrees down, so the room reads as a cut-away corner with depth (back wall, left wall, floor).
// `radius` is the part of the room, around the look-at point, that must fit across the screen.
// The whole room is in view while the pet roams. When the pet does something close (eats, drinks,
// sleeps, is touched, reacts) the camera eases toward it, and eases back out afterwards. The player
// never pans or turns it.
const CAMERA = { vfov: 22, pitchDeg: 32, yawDeg: 28 } as const;
const OVERVIEW = { x: 0, y: 0.3, z: 0.0, radius: 0.84 } as const;
const CLOSE = { radius: 0.56, lookAtHeight: 0.1 } as const;
/** Clips during which the camera comes close. Wandering and sniffing do not: the camera must not swing about. */
const CLOSE_CLIPS: readonly AnimationName[] = ['eat', 'drink', 'sleep'];
const SOCK_SIZE = { w: 0.1, h: 0.035, d: 0.045 } as const;

const hex = (n: number): Color => new Color(n);

function dispose(root: Object3D): void {
  root.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    (mesh.geometry as BufferGeometry).dispose();
    const material = mesh.material as Material | Material[];
    for (const m of Array.isArray(material) ? material : [material]) m.dispose();
  });
}

/** True when the browser can make a WebGL context at all. Cheap, and lets the UI explain instead of failing. */
export function webglAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

export async function createScene3D(host: HTMLElement, options: Scene3DOptions): Promise<PetScene> {
  const ratio = cappedPixelRatio(window.devicePixelRatio);
  const wrapper = document.createElement('div');
  wrapper.style.cssText = `position:relative;width:min(100%,100cqw,calc(100cqh * ${VIEW.width} / ${VIEW.height}),calc(100dvh * ${VIEW.width} / ${VIEW.height}));aspect-ratio:${VIEW.width}/${VIEW.height}`;
  const renderer = new WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(ratio);
  renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
  wrapper.append(renderer.domElement);

  // The mini-game timer: shapes only, no text (guide §9.1). The renderer owns this element.
  const timer = document.createElement('div');
  timer.style.cssText = 'position:absolute;left:16px;right:16px;top:10px;height:8px;border-radius:4px;background:#ddbf9c;display:none;overflow:hidden';
  const timerFill = document.createElement('div');
  timerFill.style.cssText = 'height:100%;width:100%;border-radius:4px;background:#f2c75c;transform-origin:left center';
  timer.append(timerFill);
  wrapper.append(timer);
  host.appendChild(wrapper);

  const stage = new ThreeScene();
  stage.background = hex(PALETTE.cream);
  stage.add(new AmbientLight(0xfff1dc, 1.5));
  const sun = new DirectionalLight(0xffffff, 1.7);
  sun.position.set(-0.6, 2.4, 1.6);
  stage.add(sun);

  const camera = new PerspectiveCamera(CAMERA.vfov, VIEW.width / VIEW.height, 0.1, 30);
  const lookAt = new Vector3(OVERVIEW.x, OVERVIEW.y, OVERVIEW.z);
  /** 0 = whole room, 1 = close to the pet. Follows what the pet is doing, smoothly. */
  let closeness = 0;
  const petRef: { root?: Object3D } = {};
  const placeCamera = (): void => {
    const k = closeness * closeness * (3 - 2 * closeness);
    // Where the camera looks: the middle of the room, moving to the pet as it comes close.
    const pet = petRef.root?.position;
    lookAt.set(
      OVERVIEW.x + ((pet?.x ?? 0) - OVERVIEW.x) * k,
      OVERVIEW.y + ((pet ? pet.y + CLOSE.lookAtHeight : 0.1) - OVERVIEW.y) * k,
      OVERVIEW.z + ((pet?.z ?? 0) - OVERVIEW.z) * k,
    );
    // Pull the camera back until the wanted part of the room fits across the screen, whatever the
    // shape. Narrow screens are limited by their width, wide ones by their height.
    const half = Math.tan((CAMERA.vfov * Math.PI) / 360) * Math.min(1, camera.aspect);
    const radius = OVERVIEW.radius + (CLOSE.radius - OVERVIEW.radius) * k;
    const distance = radius / half;
    const pitch = (CAMERA.pitchDeg * Math.PI) / 180;
    const yaw = (CAMERA.yawDeg * Math.PI) / 180;
    camera.position.set(
      lookAt.x + distance * Math.cos(pitch) * Math.sin(yaw),
      lookAt.y + distance * Math.sin(pitch),
      lookAt.z + distance * Math.cos(pitch) * Math.cos(yaw),
    );
    camera.lookAt(lookAt);
  };
  const resize = (): void => {
    const w = wrapper.clientWidth || VIEW.width;
    const h = wrapper.clientHeight || VIEW.height;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    placeCamera();
    loop?.request();
  };

  // ------------------------------------------------------------------ room
  const flat = (color: number): MeshLambertMaterial => new MeshLambertMaterial({ color });
  const box = (w: number, h: number, d: number, color: number, x: number, y: number, z: number, parent: Object3D = stage): Mesh => {
    const mesh = new Mesh(new BoxGeometry(w, h, d), flat(color));
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  };
  const px = (logicalX: number): number => (logicalX - VIEW.width / 2) * M_PER_PX;
  const pz = (logicalZ: number): number => logicalZ * M_PER_PX;

  // A cut-away corner room, like a toy diorama on the cream background: a thick floor slab, a back
  // wall, and a left wall. Big enough that the pet can roam it: about three ferret lengths across.
  const ROOM_W = 1.76; // x from -0.88 to 0.88
  const ROOM_D = 1.56; // z from -0.78 to 0.78
  const BACK_Z = -ROOM_D / 2;
  const LEFT_X = -ROOM_W / 2;
  const WALL_H = 1.0;
  const floorMidZ = 0;

  box(ROOM_W, 0.08, ROOM_D, PALETTE.floorShade, 0, -0.04, floorMidZ); // the slab, its sides show
  box(ROOM_W - 0.02, 0.004, ROOM_D - 0.02, PALETTE.floor, 0, 0.002, floorMidZ);
  for (let z = BACK_Z + 0.13; z < ROOM_D / 2 - 0.05; z += 0.13) box(ROOM_W - 0.02, 0.002, 0.008, PALETTE.floorShade, 0, 0.005, z);
  box(ROOM_W, WALL_H, 0.05, PALETTE.wall, 0, WALL_H / 2, BACK_Z - 0.025); // back wall
  box(0.05, WALL_H, ROOM_D, PALETTE.wall, LEFT_X - 0.025, WALL_H / 2, floorMidZ); // left wall
  box(ROOM_W, 0.12, 0.02, PALETTE.wallShade, 0, 0.06, BACK_Z + 0.01); // base bands
  box(0.02, 0.12, ROOM_D, PALETTE.wallShade, LEFT_X + 0.01, 0.06, floorMidZ);

  // Window on the back wall: frame, pane, and two bars.
  const win = { x: -0.42, y: 0.62 };
  box(0.38, 0.5, 0.02, PALETTE.floorShade, win.x, win.y, BACK_Z + 0.01);
  box(0.3, 0.42, 0.02, PALETTE.waterBlue, win.x, win.y, BACK_Z + 0.02);
  box(0.014, 0.42, 0.02, PALETTE.floorShade, win.x, win.y, BACK_Z + 0.03);
  box(0.3, 0.014, 0.02, PALETTE.floorShade, win.x, win.y, BACK_Z + 0.03);

  // On the left wall: a picture and a low shelf with a few things on it.
  box(0.02, 0.28, 0.36, PALETTE.floorShade, LEFT_X + 0.01, 0.66, 0.22);
  box(0.02, 0.22, 0.3, PALETTE.gold, LEFT_X + 0.02, 0.66, 0.22);
  box(0.02, 0.11, 0.11, PALETTE.bowlRed, LEFT_X + 0.03, 0.64, 0.22);
  box(0.16, 0.025, 0.46, PALETTE.floorShade, LEFT_X + 0.08, 0.36, -0.28);
  box(0.07, 0.07, 0.07, PALETTE.bowlRed, LEFT_X + 0.08, 0.405, -0.4);
  box(0.06, 0.1, 0.06, PALETTE.waterBlue, LEFT_X + 0.08, 0.42, -0.2);

  // A rug in the middle of the roaming area, with a border.
  box(1.04, 0.008, 0.74, PALETTE.gold, 0.0, 0.008, 0.1);
  box(0.98, 0.01, 0.68, PALETTE.belly, 0.0, 0.009, 0.1);

  // Furniture along the walls, outside the roaming rectangle: a crate stack at the back left and a
  // cushion at the front right.
  box(0.22, 0.14, 0.22, PALETTE.floorShade, LEFT_X + 0.17, 0.07, BACK_Z + 0.17);
  box(0.17, 0.12, 0.17, PALETTE.wallShade, LEFT_X + 0.18, 0.2, BACK_Z + 0.17);
  box(0.24, 0.07, 0.24, PALETTE.bowlRed, 0.64, 0.035, 0.56);
  box(0.2, 0.02, 0.2, PALETTE.belly, 0.64, 0.075, 0.56);

  // Hammock against the back wall: two posts and a sling at the height the sleeping pet rests on.
  const hammock = logicalToWorld(ROOM.hammockX, ROOM.hammockRestY, ROOM.hammockZ);
  for (const side of [-1, 1]) box(0.04, hammock.y + 0.08, 0.04, PALETTE.floorShade, hammock.x + side * 0.3, (hammock.y + 0.08) / 2, hammock.z);
  box(0.56, 0.02, 0.3, PALETTE.belly, hammock.x, hammock.y - 0.01, hammock.z);
  // Only a back rail: a front one would hide the sleeping pet from the camera.
  box(0.54, 0.03, 0.04, PALETTE.belly, hammock.x, hammock.y + 0.01, hammock.z - 0.14);

  // Bowls: a coloured bowl with a lighter inside.
  const bowl = (logicalX: number, logicalZ: number, color: number, inside: number): void => {
    const g = new Group();
    const body = new Mesh(new CylinderGeometry(0.1, 0.085, 0.06, 10), flat(color));
    body.position.y = 0.03;
    const top = new Mesh(new CircleGeometry(0.085, 10), flat(inside));
    top.rotation.x = -Math.PI / 2;
    top.position.y = 0.0605;
    g.add(body, top);
    g.position.set(px(logicalX), 0, pz(logicalZ));
    stage.add(g);
  };
  bowl(ROOM.foodBowlX, ROOM.foodBowlZ, PALETTE.bowlRed, PALETTE.wallShade);
  bowl(ROOM.waterBowlX, ROOM.waterBowlZ, PALETTE.waterBlue, PALETTE.cream);

  // Toys. The ball on the floor is the room's own; the others appear in the mini-game.
  const toy = (geometry: BufferGeometry, color: number): Mesh => new Mesh(geometry, flat(color));
  const roomBall = toy(new IcosahedronGeometry(0.04, 1), PALETTE.gold);
  roomBall.position.set(px(ROOM.toyX), 0.04, pz(ROOM.toyZ));
  stage.add(roomBall);

  const makeSock = (): Group => {
    const g = new Group();
    g.add(box(SOCK_SIZE.w, SOCK_SIZE.h, SOCK_SIZE.d, PALETTE.bowlRed, 0, 0, 0, g));
    g.add(box(SOCK_SIZE.w * 0.35, SOCK_SIZE.h * 1.05, SOCK_SIZE.d * 1.05, PALETTE.cream, SOCK_SIZE.w * 0.33, 0, 0, g));
    g.visible = false;
    stage.add(g);
    return g;
  };
  const sock = makeSock();

  const toyMeshes: Record<ToyId, Object3D> = (() => {
    const ball = toy(new IcosahedronGeometry(0.045, 1), PALETTE.gold);
    ball.position.y = 0.045;
    const feather = new Group();
    const vane = toy(new BoxGeometry(0.03, 0.12, 0.012), PALETTE.waterBlue);
    vane.position.y = 0.09;
    vane.rotation.z = 0.35;
    const quill = toy(new BoxGeometry(0.008, 0.07, 0.008), PALETTE.ink);
    quill.position.y = 0.035;
    feather.add(vane, quill);
    const ring = toy(new TorusGeometry(0.04, 0.013, 5, 12), PALETTE.bowlRed);
    ring.position.y = 0.055;
    const sockToy = new Group();
    sockToy.add(box(SOCK_SIZE.w, SOCK_SIZE.h, SOCK_SIZE.d, PALETTE.bowlRed, 0, SOCK_SIZE.h / 2, 0, sockToy));
    const all: Record<ToyId, Object3D> = { ball, feather, ring, sock: sockToy } as Record<ToyId, Object3D>;
    for (const object of Object.values(all)) {
      object.visible = false;
      stage.add(object);
    }
    return all;
  })();

  // A soft blob shadow under the ferret. No real-time shadows: they are costly on low-end phones.
  const shadow = new Mesh(new CircleGeometry(1, 16), new MeshBasicMaterial({ color: 0x3b2f26, transparent: true, opacity: 0.22, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.scale.set(0.3 * PET_SCALE, 0.13 * PET_SCALE, 1);
  shadow.position.y = 0.003;
  stage.add(shadow);

  // ------------------------------------------------------------------ the ferret
  const gltf: GLTF = await new Promise((resolve, reject) => {
    options.model.then((bytes) => new GLTFLoader().parse(bytes, '', resolve, reject), reject);
  });
  const ferret = new Group();
  ferret.scale.setScalar(PET_SCALE);
  ferret.add(gltf.scene);
  const tintMaterials: MeshLambertMaterial[] = [];
  gltf.scene.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    // Plain lit materials are cheaper on phones and match the room.
    const source = mesh.material as MeshLambertMaterial & { map?: MeshLambertMaterial['map'] };
    const material = new MeshLambertMaterial({ map: source.map ?? null });
    tintMaterials.push(material);
    mesh.material = material;
  });
  const setCoat = (coat: Coat): void => {
    const [r, g, b] = COAT_TINT[coat];
    for (const m of tintMaterials) m.color.setRGB(r, g, b);
  };
  setCoat(options.coat);
  stage.add(ferret);
  petRef.root = ferret;
  const carryBone = ferret.getObjectByName('carry') ?? ferret;

  // ------------------------------------------------------------------ animation
  const mixer = new AnimationMixer(ferret);
  const bases = new Map<AnimationName, AnimationAction>();
  const reactions = new Map<AnimationName, AnimationAction>();
  for (const source of gltf.animations) {
    const name = source.name as AnimationName;
    const spec = CLIPS[name];
    if (!spec) continue;
    // Loops keep their last key (a copy of the first): the mixer wraps at the clip length, so that
    // frame is never shown on its own and the loop has no hitch. One-shots become additive: only
    // their difference from the rest pose is added on top of the running loop.
    if (spec.loop) {
      bases.set(name, mixer.clipAction(source));
    } else {
      const clip = source.clone();
      AnimationUtils.makeClipAdditive(clip, 0, clip, CLIP_FPS);
      const action = mixer.clipAction(clip);
      action.blendMode = AdditiveAnimationBlendMode;
      action.setLoop(LoopOnce, 1);
      action.clampWhenFinished = false;
      reactions.set(name, action);
    }
  }

  let base: AnimationName = 'idle';
  bases.get(base)?.play();
  const blinkSeed = hashString(options.seed);

  const animator: PetAnimator = {
    setBase(name) {
      const next = bases.get(name);
      if (!next || name === base) return;
      bases.get(base)?.fadeOut(FADE_S);
      next.reset().fadeIn(FADE_S).play();
      base = name;
      loop.request();
    },
    react(name) {
      const action = reactions.get(name);
      if (!action) return;
      // One emotion at a time; a blink may overlap any of them.
      if (name !== 'blink') for (const [other, a] of reactions) if (other !== 'blink' && other !== name) a.fadeOut(0.1);
      action.reset().play();
      if (name !== 'blink') focusUntil = lastMs + action.getClip().duration * 1000;
      loop.request();
    },
    current: () => base,
  };

  // ------------------------------------------------------------------ scene state
  const scene: PetScene = {
    animator,
    x: (ROOM.minX + ROOM.maxX) / 2,
    y: ROOM.groundY,
    z: 0,
    facing: 1,
    heading: null,
    setCoat(coat) {
      setCoat(coat);
      loop.request();
    },
    requestFrame: () => loop.request(),
    destroy() {
      for (const [type, fn] of listeners) wrapper.removeEventListener(type, fn as EventListener);
      resizeObserver.disconnect();
      loop.destroy();
      mixer.stopAllAction();
      dispose(stage);
      renderer.dispose();
      wrapper.remove();
    },
  };

  // Rendered position and turn follow the logical ones smoothly, so a jump into the hammock or a
  // change of direction is a quick motion and not a pop.
  const start = logicalToWorld(scene.x, scene.y, scene.z);
  let renderY = start.y;
  let renderZ = start.z;
  let focusUntil = 0;
  let turn = Math.PI / 2;
  let lastMs = 0;
  let lastX = scene.x;
  let lastZ = scene.z;
  let speedMps = 0;
  let blinking = false;
  const tmp = new Vector3();

  const draw = (nowMs: number): boolean => {
    const dt = lastMs === 0 ? 0 : Math.min(0.1, (nowMs - lastMs) / 1000);
    lastMs = nowMs;
    options.onFrame?.(nowMs, scene);

    // Pace the legs to the ground speed so the paws stay planted.
    if (dt > 0) speedMps += (Math.hypot(scene.x - lastX, scene.z - lastZ) / dt * M_PER_PX - speedMps) * 0.35;
    lastX = scene.x;
    lastZ = scene.z;
    const baseAction = bases.get(base);
    // The model is shown at PET_SCALE, so its strides are that much shorter.
    if (baseAction) baseAction.timeScale = playbackRate(base, speedMps / PET_SCALE);

    // A blink now and then, never while asleep (the eyes are already shut).
    const closing = blinkFrame(nowMs, blinkSeed) !== 0;
    if (closing && !blinking && base !== 'sleep') reactions.get('blink')?.reset().play();
    blinking = closing;

    mixer.update(dt);

    const target = logicalToWorld(scene.x, scene.y, scene.z);
    const follow = Math.min(1, dt * 10);
    renderY += (target.y - renderY) * follow;
    renderZ += (target.z - renderZ) * follow;
    const wanted = scene.heading ?? (scene.facing * Math.PI) / 2;
    let diff = wanted - turn;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    turn += diff * Math.min(1, dt * 14);
    ferret.position.set(target.x, renderY, renderZ);
    ferret.rotation.y = turn;
    shadow.position.set(target.x, 0.003, renderZ);

    // The camera comes close while the pet does something close, and goes back to the whole room after.
    const props0 = options.getProps?.();
    const wantsClose = Boolean(props0?.pressing) || CLOSE_CLIPS.includes(base) || nowMs < focusUntil;
    const goal = wantsClose && !props0?.toy ? 1 : 0;
    const before = closeness;
    closeness += (goal - closeness) * Math.min(1, dt * 2.6);
    if (Math.abs(goal - closeness) < 0.002) closeness = goal;
    if (closeness !== before || closeness > 0) placeCamera();

    const props = props0;
    if (props) {
      roomBall.visible = !props.toy;
      for (const [id, object] of Object.entries(toyMeshes)) object.visible = props.toy?.id === id;
      if (props.toy) toyMeshes[props.toy.id].position.set(px(props.toy.x), 0, pz(ROOM.chaseZ));
      if (props.sock.carried) {
        carryBone.getWorldPosition(tmp);
        sock.position.set(tmp.x, Math.max(0.02, tmp.y - 0.03 * PET_SCALE), tmp.z);
        sock.rotation.set(0, turn, 0.5);
      } else {
        const where = logicalToWorld(props.sock.x, ROOM.groundY, props.sock.z);
        sock.position.set(where.x, SOCK_SIZE.h / 2, where.z);
        sock.rotation.set(0, 0, 0);
      }
      sock.visible = true;
      timer.style.display = props.timerFraction === null ? 'none' : 'block';
      if (props.timerFraction !== null) timerFill.style.transform = `scaleX(${Math.max(0.05, props.timerFraction)})`;
    }

    renderer.render(stage, camera);
    return true; // the ferret is always at least breathing
  };

  const loop = createRenderLoop(draw, browserLoopDeps(), {
    minFrameMs: () => (options.lowPower ? Math.max(33, frameIntervalMs(base)) : frameIntervalMs(base)),
  });

  // ------------------------------------------------------------------ pointer input
  // Mouse and touch alike, never hover (guide §9.3). A touch is turned into a point on the
  // vertical plane through the pet, then into logical px, so the controller's touch tests are unchanged.
  const raycaster = new Raycaster();
  const plane = new Plane(new Vector3(0, 0, 1), 0);
  const hit = new Vector3();
  const ndc = new Vector2();
  const toLogical = (e: PointerEvent): { x: number; y: number } | null => {
    const rect = wrapper.getBoundingClientRect();
    ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -(((e.clientY - rect.top) / rect.height) * 2 - 1));
    raycaster.setFromCamera(ndc, camera);
    plane.constant = -ferret.position.z; // the vertical plane through the pet, wherever it stands
    return raycaster.ray.intersectPlane(plane, hit) ? planeToLogical(hit.x, hit.y) : null;
  };
  const listeners: Array<[string, (e: PointerEvent) => void]> = [];
  const pointer = options.onPointer;
  if (pointer) {
    wrapper.style.touchAction = 'none'; // dragging the toy must not scroll the page
    listeners.push(
      ['pointerdown', (e) => { wrapper.setPointerCapture(e.pointerId); const p = toLogical(e); if (p) pointer.down(p.x, p.y, e.timeStamp); }],
      ['pointermove', (e) => { const p = toLogical(e); if (p) pointer.move(p.x, p.y, e.timeStamp); }],
      ['pointerup', (e) => pointer.up(e.timeStamp)],
      ['pointercancel', (e) => pointer.up(e.timeStamp)],
    );
    for (const [type, fn] of listeners) wrapper.addEventListener(type, fn as EventListener);
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(wrapper);
  resize();
  loop.request();
  return scene;
}
