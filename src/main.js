import './styles.css';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PACKS, PIECES, BOXES, MILKS, SHELF_ORDER, euro, boxPrice, capacity } from './catalog.js';
import { addWithFlight, renderBadge, renderPage } from './shop.js';
import { initMochi } from './mochi.js';

const $ = (s) => document.querySelector(s);

// Spots measured in Blender (sushie bar.blend), converted to three.js axes (x, z_blender, -y_blender)
const SHELVES = [{ y: 0.68 }, { y: 0.52 }]; // top, bottom shelf surfaces
const SHELF_X = [-0.21, 0.13], SHELF_Z = 0.1, SHELF_SCALE = 0.032; // gastro units -> metres
const FRONT_POS = new THREE.Vector3(0.14, 0.326, 0.345); // front counter, where the old platter stood
const FRONT_MAX = 0.15; // max footprint (m) of what sits on the front tray

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);
const envMap = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
const loader = new GLTFLoader();

// one load per URL; callers get a fresh clone
const cache = new Map();
function model(url) {
  if (!cache.has(url)) {
    cache.set(url, loader.loadAsync(url).then((g) => {
      g.scene.traverse((o) => o.isMesh && (o.castShadow = o.receiveShadow = true));
      // normalize origin to bottom-center so placement never depends on how the asset was exported
      const b = new THREE.Box3().setFromObject(g.scene);
      const c = b.getCenter(new THREE.Vector3());
      g.scene.position.sub(new THREE.Vector3(c.x, b.min.y, c.z));
      return new THREE.Group().add(g.scene);
    }));
  }
  return cache.get(url).then((s) => s.clone(true));
}
const packUrl = (id) => `models/gastro/packs/${id}.gltf`;
const assetUrl = (id) => `models/gastro/${id}.gltf`;
const milkUrl = (id) => `models/milk/${id}.gltf`;
const sizeOf = (o) => new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3());

function makeSun(scene) {
  const sun = new THREE.DirectionalLight('#fff4e6', 2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0005;
  scene.add(sun, sun.target);
  return sun;
}
function aimSun(sun, center, r) {
  sun.position.copy(center).add(new THREE.Vector3(2, 4, 3).multiplyScalar(r));
  sun.target.position.copy(center);
  Object.assign(sun.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 0.001, far: r * 12 });
  sun.shadow.camera.updateProjectionMatrix();
}
function shadowGround(scene, y, r) {
  const g = new THREE.Mesh(new THREE.CircleGeometry(r, 64), new THREE.ShadowMaterial({ opacity: 0.18 }));
  g.rotation.x = -Math.PI / 2;
  g.position.y = y;
  g.receiveShadow = true;
  scene.add(g);
}

// ---------- tiny tween helper ----------
const tweens = [];
function tween(duration, fn) {
  return new Promise((done) => tweens.push({ t: 0, duration, fn, done }));
}
function stepTweens(dt) {
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i];
    tw.t = Math.min(1, tw.t + dt / tw.duration);
    tw.fn(tw.t);
    if (tw.t === 1) { tweens.splice(i, 1); tw.done(); }
  }
}
const easeOutBack = (t) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// ---------- main bar scene ----------
const scene = new THREE.Scene();
scene.background = new THREE.Color('#f6e7dc');
scene.environment = envMap;
scene.environmentIntensity = 0.8;
const sun = makeSun(scene);
const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.005, 100);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

const views = {};
let mixer = null;
let mochi = null;
const pointerNdc = new THREE.Vector2();
const pickables = []; // meshes with userData.pick = { kind, id }
const tagPick = (root, pick) => root.traverse((o) => { if (o.isMesh) { o.userData.pick = pick; pickables.push(o); } });
const untagPick = (root) => root.traverse((o) => {
  const i = pickables.indexOf(o);
  if (i >= 0) pickables.splice(i, 1);
});

function fitDistance(cam, r) {
  const vFov = THREE.MathUtils.degToRad(cam.fov);
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * cam.aspect);
  return r / Math.sin(Math.min(vFov, hFov) / 2);
}
const viewPose = (v) => ({ target: v.target.clone(), pos: v.target.clone().addScaledVector(v.dir, fitDistance(camera, v.r)) });

// front counter: a wooden tray with whatever is selected on it
const front = new THREE.Group();
front.position.copy(FRONT_POS);
scene.add(front);
const frontSlot = new THREE.Group(); // swapped content
front.add(frontSlot);
let frontTray = null;
let frontKey = null; // what the front shows: "pack:<id>" or "build"
if (import.meta.env.DEV) window.__dbg = { scene, camera, controls, front, frontSlot };

loader.load('models/sushi_bar.glb', async (gltf) => {
  const bar = gltf.scene;
  bar.traverse((o) => {
    if (o.isMesh) o.castShadow = o.receiveShadow = true;
    if (MILKS[o.name]) tagPick(o, { kind: 'milk', id: o.name });
  });
  scene.add(bar);

  const box = new THREE.Box3().setFromObject(bar);
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  aimSun(sun, sphere.center, sphere.radius);
  shadowGround(scene, box.min.y, sphere.radius * 3);
  views.home = { target: sphere.center, dir: new THREE.Vector3(-0.55, 0.5, 1).normalize(), r: sphere.radius * 0.8 };
  views.front = { target: FRONT_POS.clone().add(new THREE.Vector3(-0.02, 0.05, -0.04)), dir: new THREE.Vector3(-0.35, 0.75, 1).normalize(), r: innerWidth > 860 ? 0.16 : 0.2 };
  controls.minDistance = 0.08;
  controls.maxDistance = sphere.radius * 8;

  mixer = new THREE.AnimationMixer(bar);
  gltf.animations.filter((c) => !c.name.startsWith('Cat_')).forEach((clip) => mixer.clipAction(clip).play());
  mochi = initMochi({ gltf, camera, go: (h) => (location.hash = h) });
  if (mochi.mesh) tagPick(mochi.mesh, { kind: 'cat' });

  const start = /^#(pack|build|view)/.test(location.hash) ? 'front' : 'home';
  const p = viewPose(views[start]);
  camera.position.copy(p.pos);
  controls.target.copy(p.target);

  frontTray = await model(assetUrl('Tray_Wood_Dark_Medium_002'));
  frontTray.scale.setScalar(0.03);
  front.add(frontTray);
  frontSlot.position.y = sizeOf(frontTray).y * 0.75;

  await fillShelves();
  route();
});

async function fillShelves() {
  for (const [row, ids] of SHELF_ORDER.entries()) {
    const packs = await Promise.all(ids.map((id) => model(packUrl(id))));
    // long side along the shelf, then spread evenly
    const widths = packs.map((p) => {
      const s = sizeOf(p);
      if (s.z > s.x) p.rotation.y = Math.PI / 2;
      return Math.max(s.x, s.z) * SHELF_SCALE;
    });
    const span = SHELF_X[1] - SHELF_X[0];
    const gap = (span - widths.reduce((a, b) => a + b, 0)) / (packs.length + 1);
    let x = SHELF_X[0] + gap;
    packs.forEach((p, i) => {
      const holder = new THREE.Group();
      holder.add(p);
      holder.scale.setScalar(SHELF_SCALE);
      holder.position.set(x + widths[i] / 2, SHELVES[row].y, SHELF_Z);
      holder.rotation.y = (i - 1.5) * -0.08; // slight fan towards the viewer
      x += widths[i] + gap;
      scene.add(holder);
      tagPick(holder, { kind: 'pack', id: ids[i] });
    });
  }
}

// swap what sits on the front tray: shrink out, pop in
let swapToken = 0;
async function setFront(key, buildObject) {
  if (frontKey === key && key !== 'build') return;
  frontKey = key;
  const token = ++swapToken;
  const next = buildObject ? await buildObject() : await model(packUrl(key.slice(5)));
  if (token !== swapToken) return; // a newer swap started meanwhile
  const s = sizeOf(next);
  const scale = Math.min(0.05, FRONT_MAX / Math.max(s.x, s.z));
  const old = frontSlot.children[0];
  if (old && !(key === 'build' && old.userData.build)) {
    await tween(0.18, (t) => old.scale.setScalar(old.userData.s * (1 - t)));
  }
  if (token !== swapToken) return;
  if (old) { untagPick(old); frontSlot.remove(old); }
  next.userData.s = scale;
  next.userData.build = key === 'build';
  if (frontTray) frontTray.visible = !(key === 'build' && builder.box === 'party');
  frontSlot.position.y = frontTray.visible ? sizeOf(frontTray).y * 0.75 : 0;
  frontSlot.add(next);
  tagPick(next, { kind: 'front' });
  if (old && old.userData.build && key === 'build') { next.scale.setScalar(scale); return; }
  next.scale.setScalar(0.001);
  await tween(0.5, (t) => next.scale.setScalar(Math.max(0.001, scale * easeOutBack(t))));
}

// ---------- build-your-own ----------
const builder = { box: 'quad', pieces: [] };
let lastBuiltCount = 0;
// Pack footprints {w, d} into centered rows inside a square of side `area`.
// Same-type pieces arrive consecutive, so they line up side by side like on a real platter.
// Shrinks everything a little until the rows fit. Returns { k, spots: [{x, z}] } or null.
function packRows(sizes, area, gap = 0.03) {
  for (let k = 1; k > 0.25; k *= 0.93) {
    const rows = [[]];
    let x = 0;
    for (const [i, s] of sizes.entries()) {
      const w = s.w * k;
      if (x > 0 && x + w > area) { rows.push([]); x = 0; }
      rows.at(-1).push(i);
      x += w + gap * k;
    }
    const depths = rows.map((r) => Math.max(...r.map((i) => sizes[i].d * k)));
    const total = depths.reduce((a, b) => a + b, 0) + gap * k * (rows.length - 1);
    if (total > area) continue;
    const spots = [];
    let z = -total / 2;
    rows.forEach((r, ri) => {
      const width = r.reduce((a, i) => a + sizes[i].w * k, 0) + gap * k * (r.length - 1);
      let cx = -width / 2;
      for (const i of r) {
        spots[i] = { x: cx + (sizes[i].w * k) / 2, z: z + depths[ri] / 2 };
        cx += sizes[i].w * k + gap * k;
      }
      z += depths[ri] + gap * k;
    });
    return { k, spots };
  }
  return null;
}
// self-check: 50 maki-sized pieces fit the party tray
console.assert(packRows(Array(50).fill({ w: 0.68, d: 0.68 }), 5.2), 'packRows: 50 pieces must fit');

async function buildBoxObject() {
  const def = BOXES[builder.box];
  const group = new THREE.Group();
  group.add(await model(assetUrl(def.model)));
  // group same types together (in order of first pick); remember original index for the drop animation
  const firstSeen = new Map();
  builder.pieces.forEach((p, i) => firstSeen.has(p) || firstSeen.set(p, i));
  const order = builder.pieces.map((p, i) => i).sort((a, b) => firstSeen.get(builder.pieces[a]) - firstSeen.get(builder.pieces[b]) || a - b);
  const models = await Promise.all(order.map((i) => model(assetUrl(builder.pieces[i]))));
  const sizes = models.map((m) => { const s = sizeOf(m); return { w: s.x, d: s.z }; });
  const packed = def.max ? packRows(sizes, def.area) : null;
  models.forEach((m, j) => {
    const i = order[j];
    let x, z, k;
    if (packed) {
      ({ x, z } = packed.spots[j]);
      k = packed.k;
      m.rotation.y = Math.sin(i * 12.9898) * 0.07; // tiny stable tilt so rows look hand-placed
    } else {
      [x, z] = def.slots[j];
      k = Math.min(1, def.fit / Math.max(sizes[j].w, sizes[j].d));
    }
    m.scale.setScalar(k);
    m.position.set(x, def.floor, z);
    group.add(m);
    if (i >= lastBuiltCount) { // new piece drops in
      m.position.y += 1.2;
      tween(0.45, (t) => (m.position.y = def.floor + 1.2 * (1 - t) * (1 - t)));
    }
  });
  lastBuiltCount = builder.pieces.length;
  return group;
}
const refreshBuild = () => setFront('build', buildBoxObject);
function addPiece(id) {
  if (builder.pieces.length >= capacity(builder.box)) return;
  builder.pieces.push(id);
  if (builder.box === 'party' && builder.pieces.length === 30) mochi?.react('party');
  else mochi?.react('piece', id);
  renderBuilder();
  refreshBuild();
}

function renderBuilder() {
  const def = BOXES[builder.box];
  $('#b-boxes').replaceChildren(...Object.entries(BOXES).map(([id, b]) => {
    const btn = document.createElement('button');
    btn.textContent = `${b.title} · ${b.max ? `up to ${b.max}` : capacity(id)}`;
    btn.setAttribute('aria-pressed', id === builder.box);
    btn.onclick = () => {
      builder.box = id;
      builder.pieces = builder.pieces.slice(0, capacity(id));
      lastBuiltCount = builder.pieces.length;
      frontKey = null; // container changed: full swap animation
      renderBuilder();
      refreshBuild();
    };
    return btn;
  }));
  const full = builder.pieces.length >= capacity(builder.box);
  $('#b-count').textContent = `${builder.pieces.length}/${capacity(builder.box)}`;
  $('#b-palette').replaceChildren(...Object.entries(PIECES).map(([id, p]) => {
    const btn = document.createElement('button');
    btn.innerHTML = `<span></span><strong></strong>`;
    btn.firstChild.textContent = p.title;
    btn.lastChild.textContent = euro(p.price);
    btn.title = p.desc;
    btn.disabled = full;
    btn.onclick = () => addPiece(id);
    return btn;
  }));
  // one row per type: "3 × Salmon Nigiri  − +"
  const counts = new Map();
  for (const p of builder.pieces) counts.set(p, (counts.get(p) || 0) + 1);
  const step = (label, aria, disabled, fn) => Object.assign(document.createElement('button'),
    { textContent: label, disabled, onclick: fn, ariaLabel: aria });
  $('#b-list').replaceChildren(...(counts.size ? [...counts].map(([id, n]) => {
    const chip = document.createElement('span');
    chip.className = 'count-chip';
    chip.append(`${n} × ${PIECES[id].title}`,
      step('−', `Remove one ${PIECES[id].title}`, false, () => {
        builder.pieces.splice(builder.pieces.lastIndexOf(id), 1);
        lastBuiltCount = builder.pieces.length;
        renderBuilder();
        refreshBuild();
      }),
      step('+', `Add one ${PIECES[id].title}`, full, () => addPiece(id)));
    return chip;
  }) : [Object.assign(document.createElement('span'), { textContent: 'Empty box: pick some pieces above' })]));
  $('#b-price').textContent = euro(boxPrice(builder.box, builder.pieces));
  $('#b-add').disabled = !builder.pieces.length;
}
$('#b-add').addEventListener('click', () => {
  addWithFlight(`box:${builder.box}|${builder.pieces.join(',')}`, $('#b-add'), '🍱');
  mochi?.react('added');
  builder.pieces = []; // fresh empty box for the next one
  lastBuiltCount = 0;
  renderBuilder();
  refreshBuild();
});

// ---------- camera fly ----------
let fly = null;
function flyTo(viewName, duration = 1.2) {
  if (!views[viewName]) return;
  const to = viewPose(views[viewName]);
  if (to.pos.distanceTo(camera.position) < 1e-3 && to.target.distanceTo(controls.target) < 1e-3) return;
  fly = { t: 0, duration, fromPos: camera.position.clone(), fromTarget: controls.target.clone(), ...to };
  controls.enabled = false;
}
function stepFly(dt) {
  if (!fly) return;
  fly.t = Math.min(1, fly.t + dt / fly.duration);
  const k = easeInOut(fly.t);
  camera.position.lerpVectors(fly.fromPos, fly.pos, k);
  controls.target.lerpVectors(fly.fromTarget, fly.target, k);
  if (fly.t === 1) { fly = null; controls.enabled = mode !== 'view'; }
}

// ---------- fullscreen 3D viewer ----------
const dscene = new THREE.Scene();
dscene.background = new THREE.Color('#fbeee4');
dscene.environment = envMap;
dscene.environmentIntensity = 0.9;
aimSun(makeSun(dscene), new THREE.Vector3(0, 0.5, 0), 1.2);
shadowGround(dscene, 0, 3);
const dcam = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.01, 50);
const dcontrols = new OrbitControls(dcam, renderer.domElement);
Object.assign(dcontrols, { enableDamping: true, autoRotate: true, autoRotateSpeed: 2, enablePan: false, minDistance: 1, maxDistance: 6 });
dcontrols.maxPolarAngle = Math.PI * 0.49;
dcontrols.enabled = false;
const pivot = new THREE.Group();
dscene.add(pivot);
let intro = 1;
let viewKey = null;

// keep the subject clear of the side panel (desktop) or bottom panel (mobile)
function framingOffset(cam = dcam) {
  if (innerWidth > 860) cam.setViewOffset(innerWidth, innerHeight, innerWidth * 0.16, 0, innerWidth, innerHeight);
  else cam.setViewOffset(innerWidth, innerHeight, 0, innerHeight * 0.24, innerWidth, innerHeight);
}
async function showInViewer(key, url) {
  viewKey = key;
  const m = await model(url);
  if (mode !== 'view' || viewKey !== key) return;
  const s = sizeOf(m);
  m.scale.setScalar(1 / Math.max(s.x, s.y, s.z));
  pivot.clear();
  pivot.add(m);
  const sphere = new THREE.Box3().setFromObject(m).getBoundingSphere(new THREE.Sphere());
  dcontrols.target.copy(sphere.center);
  const dist = fitDistance(dcam, sphere.radius) * (innerWidth > 860 ? 1.4 : 2.2);
  dcam.position.copy(sphere.center).addScaledVector(new THREE.Vector3(1, 0.8, 1).normalize(), dist);
  framingOffset();
  dcontrols.update();
  intro = 0;
}

// ---------- info panel ----------
let panelKey = null;
function fillDetail(kind, id) {
  const item = kind === 'pack' ? PACKS[id] : MILKS[id];
  panelKey = `${kind}:${id}`;
  $('#d-cat').textContent = item.tag || (kind === 'pack' ? 'Sushi pack' : 'Drink');
  $('#d-title').textContent = item.title;
  $('#d-jp').textContent = item.jp;
  $('#d-desc').textContent = item.desc;
  $('#d-inside-wrap').hidden = !item.contents;
  if (item.contents) {
    $('#d-inside').replaceChildren(...Object.entries(item.contents).map(([p, q]) => {
      const li = document.createElement('li');
      li.innerHTML = '<span></span><span class="muted"></span>';
      li.firstChild.textContent = `${q} × ${PIECES[p].title}`;
      li.lastChild.textContent = PIECES[p].jp;
      return li;
    }));
  }
  $('#d-price').textContent = euro(item.price);
  $('#d-view').hidden = mode === 'view';
  $('#d-view').href = `#view/${kind}/${id}`;
}
$('#d-add').addEventListener('click', () => {
  if (!panelKey) return;
  addWithFlight(panelKey, $('#d-add'), panelKey.startsWith('milk:') ? '🥛' : '🍣');
  mochi?.react('added');
});

// ---------- routing ----------
// #  |  #pack/<id>  |  #build  |  #view/pack/<id>  |  #view/milk/<id>  |  #cart  |  #checkout  |  #done/<id>
let mode = 'home';
const HINTS = {
  home: 'Click a pack on the shelves, a milk carton, or build your own box',
  pack: 'Pick another pack on the shelves to swap the tray',
  build: 'Add pieces: they drop right into your box',
};

function route() {
  const hash = location.hash;
  if (renderPage(hash)) return;
  const [r, a, b] = hash.replace(/^#/, '').split('/');
  let next = 'home';
  if (r === 'pack' && PACKS[a]) next = 'pack';
  else if (r === 'build') next = 'build';
  else if (r === 'view' && ((a === 'pack' && PACKS[b]) || (a === 'milk' && MILKS[b]))) next = 'view';
  mode = next;

  $('#detail').hidden = !(next === 'pack' || next === 'view');
  $('#builder').hidden = next !== 'build';
  $('#back').hidden = next === 'home';
  $('#hint').hidden = !HINTS[next];
  $('#hint').textContent = HINTS[next] || '';
  $('#tip').hidden = true;
  controls.enabled = next !== 'view' && !fly;
  dcontrols.enabled = next === 'view';
  if (next === 'pack' || next === 'build') framingOffset(camera);
  else camera.clearViewOffset();

  if (next === 'view') {
    fillDetail(a, b);
    showInViewer(`${a}:${b}`, a === 'pack' ? packUrl(b) : milkUrl(b));
    if (a === 'milk') mochi?.react('milk', b);
    return;
  }
  if (next === 'pack') { if (frontKey !== `pack:${a}`) mochi?.react('pack', a); fillDetail('pack', a); setFront(`pack:${a}`); }
  if (next === 'build') { if (frontKey !== 'build') mochi?.react('build'); renderBuilder(); refreshBuild(); }
  if (next === 'home' && !frontKey) setFront(`pack:${SHELF_ORDER[0][0]}`);
  flyTo(next === 'home' ? 'home' : 'front');
}
addEventListener('hashchange', route);
$('#back').addEventListener('click', () => {
  if (mode === 'view' && viewKey?.startsWith('pack:')) location.hash = `#pack/${viewKey.slice(5)}`;
  else location.hash = '';
});
renderBadge();

// ---------- picking ----------
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function pick(e) {
  if (mode === 'view' || !$('#page').hidden) return null;
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(scene.children, true).find((h) => h.object.visible);
  return hit?.object.userData.pick || null;
}
function pickLabel(p) {
  if (p.kind === 'cat') return 'Say hi to Mochi 🐾';
  if (p.kind === 'pack') return `${PACKS[p.id].title} · ${euro(PACKS[p.id].price)}`;
  if (p.kind === 'milk') return `${MILKS[p.id].title} · ${euro(MILKS[p.id].price)}`;
  if (frontKey?.startsWith('pack:')) return 'View this pack in 3D';
  return null;
}
const tip = $('#tip');
renderer.domElement.addEventListener('pointermove', (e) => {
  pointerNdc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  mochi?.pointerMoved();
  const p = pick(e);
  const label = p && pickLabel(p);
  tip.hidden = !label;
  renderer.domElement.style.cursor = label ? 'pointer' : '';
  if (label) {
    tip.textContent = label;
    tip.style.left = e.clientX + 'px';
    tip.style.top = e.clientY + 'px';
  }
});
let down = null;
renderer.domElement.addEventListener('pointerdown', (e) => (down = { x: e.clientX, y: e.clientY }));
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return; // drag, not click
  const p = pick(e);
  if (!p) return;
  if (p.kind === 'pack') location.hash = `#pack/${p.id}`;
  else if (p.kind === 'milk') location.hash = `#view/milk/${p.id}`;
  else if (p.kind === 'cat') mochi?.onClick();
  else if (p.kind === 'front' && frontKey?.startsWith('pack:')) location.hash = `#view/pack/${frontKey.slice(5)}`;
});

addEventListener('resize', () => {
  for (const c of [camera, dcam]) { c.aspect = innerWidth / innerHeight; c.updateProjectionMatrix(); }
  renderer.setSize(innerWidth, innerHeight);
  if (mode === 'view') framingOffset();
  if (mode === 'pack' || mode === 'build') framingOffset(camera);
});

// ---------- loop ----------
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1);
  mixer?.update(dt);
  mochi?.update(dt, pointerNdc, mode !== 'view' && $('#page').hidden);
  stepTweens(dt);
  if (mode === 'view') {
    intro = Math.min(1, intro + dt / 0.8);
    pivot.scale.setScalar(Math.max(0.001, easeOutBack(intro)));
    pivot.rotation.y = (1 - intro) * -Math.PI;
    pivot.position.y = 0.04 + Math.sin(clock.elapsedTime * 1.6) * 0.03;
    dcontrols.update();
    renderer.render(dscene, dcam);
  } else {
    stepFly(dt);
    controls.update();
    renderer.render(scene, camera);
  }
});
