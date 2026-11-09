import * as THREE from 'three';
import { PACKS, PIECES, MILKS } from './catalog.js';

// Mochi, the cat merchant: rigged in Blender (Cat_Rig, clips Cat_Idle/Wave/Happy/Talk),
// head follows the pointer, speech bubble with merchant dialog and reactions to what the visitor does.

const FACTS = [
  'Sushi started as a way to preserve fish in fermented rice, over 1,000 years ago!',
  '"Sushi" actually means sour rice, not raw fish. The vinegar is the star!',
  'Otoro is the fattiest part of the tuna belly. Pure butter, nyaa~',
  'Gunkan means "battleship". See the nori walls? Ready for battle!',
  'Pickled ginger is a palate cleanser, never a topping. Shhh, don\'t tell anyone!',
  'In Japan it\'s perfectly polite to eat nigiri with your fingers. Paws too!',
  'Dip the fish side in soy sauce, not the rice, or it falls apart. Trust me.',
  'Kappa maki is named after the kappa, a water spirit that loves cucumbers!',
];
const TIPS = [
  'Click a pack on the shelves to put it on my counter!',
  'Psst… you can build your own box. Up to 50 pieces on a party tray!',
  'Thirsty? Our milks are right here on the counter 🥛',
  'Drag to look around my little shop!',
  'Click me if you need a recommendation, nyaa~',
];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const dayIndex = () => Math.floor(Date.now() / 86400000);

export function initMochi({ gltf, camera, go }) {
  const $ = (s) => document.querySelector(s);
  const bubble = $('#bubble'), textEl = bubble.querySelector('.b-text'), actionsEl = bubble.querySelector('.b-actions');
  const mesh = gltf.scene.getObjectByName('Bunny_Vendor');
  const head = gltf.scene.getObjectByName('head');
  const anchor = new THREE.Vector3();

  // ---- animation: idle loop, one-shots fade back to idle, talk blends in while speaking
  const mixer = new THREE.AnimationMixer(gltf.scene);
  const clip = (n) => gltf.animations.find((a) => a.name === `Cat_${n}`);
  const act = Object.fromEntries(['Idle', 'Wave', 'Happy', 'Talk'].map((n) => [n, mixer.clipAction(clip(n))]));
  act.Idle.play();
  act.Talk.setEffectiveWeight(0).play();
  for (const n of ['Wave', 'Happy']) { act[n].setLoop(THREE.LoopOnce); act[n].clampWhenFinished = false; }
  let oneShot = null;
  function play(n) {
    if (oneShot) oneShot.fadeOut(0.15);
    oneShot = act[n].reset().setEffectiveWeight(1).fadeIn(0.15).play();
    act.Idle.fadeOut(0.15);
  }
  mixer.addEventListener('finished', (e) => {
    if (e.action !== oneShot) return;
    oneShot.fadeOut(0.25);
    act.Idle.reset().fadeIn(0.25).play();
    oneShot = null;
  });

  // ---- head look-at (world-space delta applied on top of the animated pose)
  const look = { yaw: 0, pitch: 0 };
  const target = new THREE.Vector3();
  const qWorld = new THREE.Quaternion(), qParent = new THREE.Quaternion(), qDelta = new THREE.Quaternion();
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');
  const headPos = new THREE.Vector3();
  let hasPointer = false;
  const ray = new THREE.Raycaster();
  function aimAt(ndc) {
    if (!head) return;
    head.getWorldPosition(headPos);
    if (ndc) {
      ray.setFromCamera(ndc, camera);
      ray.ray.at(camera.position.distanceTo(headPos) * 0.5, target); // halfway to the cat: always in front of it
    } else target.copy(camera.position); // no pointer: look at the visitor
    const d = target.sub(headPos);
    const yaw = THREE.MathUtils.clamp(Math.atan2(d.x, d.z), -0.65, 0.65); // cat faces +Z
    const pitch = THREE.MathUtils.clamp(-Math.atan2(d.y, Math.hypot(d.x, d.z)), -0.3, 0.25);
    look.yaw += (yaw - look.yaw) * 0.12;
    look.pitch += (pitch - look.pitch) * 0.12;
    head.getWorldQuaternion(qWorld);
    head.parent.getWorldQuaternion(qParent);
    qDelta.setFromEuler(euler.set(look.pitch, look.yaw, 0));
    head.quaternion.copy(qParent.invert().multiply(qDelta.multiply(qWorld)));
  }

  // ---- speech bubble with typewriter + reply buttons
  let typing = null, hideTimer = null, lastSpoke = 0;
  function say(text, { actions = [], hold = 5000, anim } = {}) {
    clearInterval(typing);
    clearTimeout(hideTimer);
    if (anim) play(anim);
    bubble.hidden = false;
    bubble.classList.remove('pop');
    void bubble.offsetWidth;
    bubble.classList.add('pop');
    textEl.textContent = '';
    actionsEl.replaceChildren();
    lastSpoke = performance.now();
    const start = performance.now();
    act.Talk.setEffectiveWeight(1);
    typing = setInterval(() => {
      const i = Math.floor((performance.now() - start) / 24) + 1; // time-based: throttled timers can't slow it down
      textEl.textContent = text.slice(0, i);
      if (i >= text.length) {
        clearInterval(typing);
        act.Talk.setEffectiveWeight(0);
        actionsEl.replaceChildren(...actions.map(([label, fn]) => {
          const b = document.createElement('button');
          b.textContent = label;
          b.onclick = (e) => { e.stopPropagation(); fn(); };
          return b;
        }));
        if (!actions.length) hideTimer = setTimeout(() => (bubble.hidden = true), hold);
      }
    }, 22);
  }

  // ---- merchant dialog
  const special = () => Object.keys(PACKS)[dayIndex() % Object.keys(PACKS).length];
  function menu(greet = pick(['Hi friend! What can I do for you?', 'Nyaa~ how can I help?', 'Welcome back! Hungry?'])) {
    say(greet, {
      anim: 'Wave',
      actions: [
        ['🍣 What do you recommend?', recommend],
        ['⭐ Today\'s special', todaySpecial],
        ['💡 Tell me a sushi fact', () => say(pick(FACTS), { actions: [['Another one!', () => say(pick(FACTS), { actions: [['Thanks!', bye]] })], ['Thanks!', bye]] })],
        ['🍱 Build my own box', () => { say('A custom box? Let\'s do it! Pick your pieces, I\'ll pack them.', { anim: 'Happy' }); go('#build'); }],
        ['👋 Bye!', bye],
      ],
    });
  }
  function recommend() {
    const id = pick(Object.keys(PACKS));
    const p = PACKS[id];
    say(`Try the ${p.title}! ${p.desc.split('.')[0]}.`, { actions: [['Show me!', () => { go(`#pack/${id}`); }], ['Something else?', recommend]] });
  }
  function todaySpecial() {
    const p = PACKS[special()];
    say(`Today's special is the ${p.title} ✨ I packed it myself this morning!`, { anim: 'Happy', actions: [['Put it on the counter', () => go(`#pack/${special()}`)], ['Maybe later', bye]] });
  }
  function bye() { say(pick(['Mata ne! 👋', 'See you soon, nyaa~', 'Come back hungry!']), { anim: 'Wave', hold: 2500 }); }

  // clicks on the cat: menu, or giggles when petted fast
  let pets = [];
  function onClick() {
    const now = performance.now();
    pets = pets.filter((t) => now - t < 1500).concat(now);
    if (pets.length >= 3) { pets = []; say(pick(['Hehe, that tickles! 😸', 'Purrrr… ♡', 'Nyaa! My ears!']), { anim: 'Happy', hold: 2500 }); return; }
    menu();
  }

  // reactions to site events
  function react(event, data) {
    if (event === 'pack') say(pick([`${PACKS[data].title}? Excellent taste!`, `Ahh, the ${PACKS[data].title}. One of my favourites!`, `Good pick! ${PACKS[data].tag ? `Not tagged "${PACKS[data].tag}" for nothing, nyaa~` : 'Fresh this morning.'}`]), { hold: 3500 });
    if (event === 'added') say(pick(['Arigatō! It\'s in your sushi bar ✨', 'Yatta! Added! 🎉', 'Great choice, nyaa~!']), { anim: 'Happy', hold: 2500 });
    if (event === 'build') say('Build it your way! Pick pieces, I\'ll pack them neatly.', { hold: 3500 });
    if (event === 'piece' && Math.random() < 0.35) say(pick([`Mmm, ${PIECES[data].title}!`, 'Ooh, nice combo!', 'That looks delicious!']), { hold: 1800 });
    if (event === 'party') say('Now THAT is a party tray! 🎉', { anim: 'Happy', hold: 2500 });
    if (event === 'milk') say(pick([`${MILKS[data].title} with sushi? Bold choice 🥛`, 'Milk break! Very Mochi of you.']), { hold: 3000 });
  }

  // greeting after load, then occasional tips when the visitor is idle
  const h = new Date().getHours();
  const hello = h < 11 ? 'Ohayō! ☀️' : h < 18 ? 'Konnichiwa! 🌸' : 'Konbanwa! 🌙';
  setTimeout(() => say(`${hello} Irasshaimase, welcome to Mochi Sushi Bar! I'm Mochi.`, { anim: 'Wave', actions: [['Hi Mochi! 👋', () => menu('Nice to meet you! What can I do for you?')], ['Just looking', () => say('Take your time! Click me anytime 🐾', { hold: 3000 })]] }), 1200);

  return {
    mesh,
    onClick,
    react,
    update(dt, ndc, visible) {
      mixer.update(dt);
      aimAt(hasPointer ? ndc : null);
      // anchor the bubble above the head
      if (!bubble.hidden && head) {
        head.getWorldPosition(anchor);
        anchor.y += 0.1;
        const p = anchor.project(camera);
        const off = !visible || p.z > 1 || Math.abs(p.x) > 1.1 || Math.abs(p.y) > 1.1;
        bubble.style.visibility = off ? 'hidden' : 'visible';
        bubble.style.left = `${((p.x + 1) / 2) * innerWidth}px`;
        bubble.style.top = `${((1 - p.y) / 2) * innerHeight}px`;
      }
      if (visible && bubble.hidden && performance.now() - lastSpoke > 25000) say(pick(TIPS), { hold: 4500 });
    },
    pointerMoved() { hasPointer = true; },
  };
}
