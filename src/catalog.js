// Menu data. 3D models come from public/models (gastro/ = GASTRO Sushi Food Pack, milk/ = milk cartons).
// Cart keys: "pack:<id>", "milk:<id>", "box:<boxId>|<piece>,<piece>,..."

export const PIECES = {
  Sushi_Small_Nori_001: { title: 'Kappa Maki', jp: 'かっぱ巻き', price: 1.8, desc: 'Thin nori roll with crunchy cucumber.' },
  Sushi_Small_Nori_002: { title: 'Tamago Maki', jp: '玉子巻き', price: 1.8, desc: 'Nori roll filled with sweet Japanese omelette.' },
  Sushi_Small_Nori_004: { title: 'Sake Maki', jp: '鮭巻き', price: 2.2, desc: 'Classic nori roll with fresh salmon.' },
  Sushi_Small_Salmon_002: { title: 'Salmon Tamago Roll', jp: 'サーモン玉子', price: 2.6, desc: 'Inside-out roll wrapped in salmon, sweet omelette center.' },
  Sushi_Small_Salmon_007: { title: 'Spicy Salmon Roll', jp: 'スパイシーサーモン', price: 2.8, desc: 'Salmon-wrapped roll crowned with spicy tartare and chive.' },
  Sushi_Small_Cucumber_005: { title: 'Green Tuna Roll', jp: 'きゅうり巻き', price: 2.6, desc: 'Rice-free roll wrapped in a cucumber ribbon around red tuna.' },
  Sushi_Small_Narrow_Tuna_001: { title: 'Maguro Gunkan', jp: 'まぐろ軍艦', price: 2.8, desc: 'Lean red tuna on rice, held by a nori belt.' },
  Sushi_Small_Narrow_Tuna_Fat_001: { title: 'Toro Gunkan', jp: 'トロ軍艦', price: 3.4, desc: 'Fatty tuna belly on rice, held by a nori belt. Melts in the mouth.' },
  Sushi_Small_Narrow_Tuna_Fat_002: { title: 'Toro Quail Egg', jp: 'トロうずら', price: 3.6, desc: 'Fatty tuna gunkan topped with a raw quail egg yolk.' },
  Nigiri_Salmon_002: { title: 'Salmon Nigiri', jp: 'サーモン握り', price: 2.8, desc: 'Hand-pressed rice under a buttery slice of salmon.' },
  Nigiri_Tuna_001: { title: 'Maguro Nigiri', jp: 'まぐろ握り', price: 3.0, desc: 'Hand-pressed rice under lean red tuna.' },
  Nigiri_Tuna_Fat_001: { title: 'Otoro Nigiri', jp: '大トロ握り', price: 3.8, desc: 'The most prized cut: marbled fatty tuna belly on rice.' },
};

// Prepared packs shown on the back shelves; model = models/gastro/packs/<id>.gltf
export const PACKS = {
  Set_1_008: { title: 'Nigiri Quartet', jp: '握り四貫', price: 11.5, tag: 'Best seller',
    desc: 'Four hand-pressed nigiri: two salmon, one lean tuna and one otoro. The perfect tasting tour.',
    contents: { Nigiri_Salmon_002: 2, Nigiri_Tuna_001: 1, Nigiri_Tuna_Fat_001: 1 } },
  Set_1_022: { title: 'Deluxe Bento', jp: '特上', price: 15.9, tag: 'Chef pick',
    desc: 'Our premium box: three nigiri and two gunkan, from lean tuna to melting otoro.',
    contents: { Nigiri_Salmon_002: 1, Nigiri_Tuna_001: 1, Nigiri_Tuna_Fat_001: 1, Sushi_Small_Narrow_Tuna_001: 1, Sushi_Small_Narrow_Tuna_Fat_001: 1 } },
  Set_1_035: { title: 'Green Dragon Box', jp: '緑龍', price: 9.9, tag: 'Light',
    desc: 'Four rice-light rolls wrapped in fresh cucumber around red tuna. Crunchy and refreshing.',
    contents: { Sushi_Small_Cucumber_005: 4 } },
  Set_1_016: { title: 'Toro Quail Duo', jp: 'トロうずら', price: 6.9, tag: 'Rich',
    desc: 'Two fatty tuna gunkan, each crowned with a golden quail egg yolk.',
    contents: { Sushi_Small_Narrow_Tuna_Fat_002: 2 } },
  Set_1_002: { title: 'Salmon Tamago Duo', jp: 'サーモン玉子', price: 4.9,
    desc: 'Two salmon-wrapped rolls with a sweet omelette heart.',
    contents: { Sushi_Small_Salmon_002: 2 } },
  Set_1_017: { title: 'Toro & Spicy Salmon', jp: 'トロとサーモン', price: 6.2,
    desc: 'One otoro nigiri and one spicy salmon roll: rich meets fire.',
    contents: { Nigiri_Tuna_Fat_001: 1, Sushi_Small_Salmon_007: 1 } },
  Set_1_029: { title: 'Tamago Maki Duo', jp: '玉子巻き', price: 3.4, tag: 'Kids',
    desc: 'Two sweet omelette maki in a kraft box. A gentle first sushi.',
    contents: { Sushi_Small_Nori_002: 2 } },
  Set_1_001: { title: 'Kappa Maki Duo', jp: 'かっぱ巻き', price: 3.4, tag: 'Vegan',
    desc: 'Two crunchy cucumber maki. Fresh, simple, fully plant-based.',
    contents: { Sushi_Small_Nori_001: 2 } },
};
export const SHELF_ORDER = [
  ['Set_1_008', 'Set_1_022', 'Set_1_035', 'Set_1_016'], // top shelf
  ['Set_1_002', 'Set_1_017', 'Set_1_029', 'Set_1_001'], // bottom shelf
];

// Build-your-own containers; model = models/gastro/<model>.gltf, slots in model units (three.js x,z)
export const BOXES = {
  duo: { title: 'Duo box', price: 0.5, model: 'Box_Plastic_White_Small_001', fit: 0.9, floor: 0.05, slots: [[0, -0.5], [0, 0.5]] },
  quad: { title: 'Quad box', price: 0.8, model: 'Box_Cardboard_Small_002', fit: 0.88, floor: 0.06, slots: [[-0.48, -0.48], [0.48, -0.48], [-0.48, 0.48], [0.48, 0.48]] },
  // free layout: pieces packed in rows, same types side by side, shrunk a bit when the tray gets full
  party: { title: 'Party tray', price: 2, model: 'Tray_Wood_Dark_Medium_002', floor: 0.2, max: 50, area: 5.2 },
};
export const capacity = (boxId) => BOXES[boxId].max ?? BOXES[boxId].slots.length;

// "Salmon Nigiri, Salmon Nigiri, Kappa Maki" -> "2× Salmon Nigiri · 1× Kappa Maki"
export function summarize(pieces) {
  const counts = new Map();
  for (const p of pieces) counts.set(p, (counts.get(p) || 0) + 1);
  return [...counts].map(([p, n]) => `${n}× ${PIECES[p].title}`).join(' · ');
}

export const MILKS = {
  Milk_Classic: { title: 'Classic Milk', jp: '牛乳', price: 1.9,
    desc: 'Fresh whole milk in a mini carton. Creamy and cold, a sweet break between two spicy bites.' },
  Milk_Almond: { title: 'Almond Milk', jp: 'アーモンドミルク', price: 2.3,
    desc: 'Plant-based almond drink, lightly nutty and lactose-free. Great with salmon rolls.' },
  Milk_Soya: { title: 'Soya Milk', jp: '豆乳', price: 2.1,
    desc: 'Tonyu, the Japanese soy milk. Smooth, plant-based and rich in protein.' },
};

export const euro = (n) => n.toLocaleString('en-IE', { style: 'currency', currency: 'EUR' });

export const boxPrice = (boxId, pieces) => BOXES[boxId].price + pieces.reduce((s, p) => s + PIECES[p].price, 0);

// Cart key -> display line, or null for unknown/stale keys
export function resolve(key) {
  if (typeof key !== 'string' || key.length > 2000) return null;
  const i = key.indexOf(':');
  const kind = key.slice(0, i), rest = key.slice(i + 1);
  // Object.hasOwn: "pack:__proto__" / "pack:constructor" must not resolve
  if (kind === 'pack' && Object.hasOwn(PACKS, rest)) return { ...PACKS[rest], category: 'Sushi pack' };
  if (kind === 'milk' && Object.hasOwn(MILKS, rest)) return { ...MILKS[rest], category: 'Drink' };
  if (kind === 'box') {
    const [boxId, list] = rest.split('|');
    if (!Object.hasOwn(BOXES, boxId) || !list) return null;
    const pieces = list.split(',');
    // reject the whole key if anything is off: unknown piece or more pieces than the box holds
    if (pieces.length > capacity(boxId) || !pieces.every((p) => Object.hasOwn(PIECES, p))) return null;
    return { title: `My ${BOXES[boxId].title} (${pieces.length} pcs)`, jp: summarize(pieces), category: 'Custom box', price: boxPrice(boxId, pieces) };
  }
  return null;
}
