import { resolve, euro } from './catalog.js';

// Cart = { [key]: qty } with keys from catalog.js ("pack:..", "milk:..", "box:.."), persisted per browser.
const KEY = 'sushi-bar-cart';
const MAX_QTY = 99;
// localStorage is untrusted input (other scripts, devtools, old formats): keep only known items with sane quantities
function sanitize(raw) {
  const clean = Object.create(null);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return clean;
  for (const [k, v] of Object.entries(raw)) {
    if (Number.isInteger(v) && v >= 1 && resolve(k)) clean[k] = Math.min(v, MAX_QTY);
  }
  return clean;
}
let cart = Object.create(null);
try { cart = sanitize(JSON.parse(localStorage.getItem(KEY))); } catch { /* corrupt or blocked storage: start empty */ }

function save(quiet) {
  try { localStorage.setItem(KEY, JSON.stringify(cart)); } catch { /* private mode: cart lives in memory only */ }
  if (!quiet) renderBadge();
}

export function addToCart(key, qty = 1, quiet = false) {
  if (!resolve(key)) return;
  cart[key] = Math.min((cart[key] || 0) + qty, MAX_QTY);
  if (cart[key] <= 0) delete cart[key];
  save(quiet);
}

// Add without leaving the page: a token arcs from the clicked button into the cart pill, which then bounces.
export function addWithFlight(key, fromEl, emoji = '🍣') {
  addToCart(key, 1, true);
  const pill = document.querySelector('#cart-pill');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!pill || !fromEl || reduce || !document.body.animate) { renderBadge(); bump(pill); return; }
  const a = fromEl.getBoundingClientRect(), b = pill.getBoundingClientRect();
  const x0 = a.left + a.width / 2, y0 = a.top + a.height / 2;
  const dx = b.left + b.width / 2 - x0, dy = b.top + b.height / 2 - y0;
  const token = Object.assign(document.createElement('div'), { className: 'fly-token', textContent: emoji });
  token.style.left = `${x0}px`;
  token.style.top = `${y0}px`;
  document.body.append(token);
  // arc: rise first, then dive into the pill while shrinking
  const lift = Math.min(-80, dy * 0.3 - 80);
  token.animate([
    { transform: 'translate(-50%,-50%) scale(.4) rotate(0deg)', opacity: 0 },
    { transform: 'translate(-50%,-50%) scale(1.3) rotate(-10deg)', opacity: 1, offset: 0.15 },
    { transform: `translate(calc(-50% + ${dx * 0.45}px), calc(-50% + ${lift}px)) scale(1.1) rotate(10deg)`, offset: 0.5 },
    { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.35) rotate(25deg)`, opacity: 0.9 },
  ], { duration: 750, easing: 'cubic-bezier(.45,0,.3,1)' }).finished.then(() => {
    token.remove();
    renderBadge();
    bump(pill);
  });
}

function bump(pill) {
  if (!pill) return;
  for (const [el, cls] of [[pill, 'bump'], [document.querySelector('#cart-count'), 'pop']]) {
    el.classList.remove(cls);
    void el.offsetWidth; // restart the CSS animation
    el.classList.add(cls);
  }
  const plus = Object.assign(document.createElement('span'), { className: 'plus-one', textContent: '+1' });
  pill.append(plus);
  plus.addEventListener('animationend', () => plus.remove());
}

const lines = () => Object.entries(cart).map(([k, q]) => ({ key: k, qty: q, item: resolve(k) }))
  .filter((l) => l.item).map((l) => ({ type: l.key, qty: l.qty, ...l.item }));
const total = () => lines().reduce((s, l) => s + l.price * l.qty, 0);
const count = () => lines().reduce((s, l) => s + l.qty, 0);

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function renderBadge() {
  const n = count();
  $('#cart-count').textContent = n;
  $('#cart-count').hidden = n === 0;
}

function cartPage() {
  const ls = lines();
  if (!ls.length) {
    return `<h2>My sushi bar</h2>
      <p class="muted">Your sushi bar is empty. Pick a pack on the shelves, a milk, or build your own box!</p>
      <div class="actions"><a class="btn" href="#">Browse the bar</a></div>`;
  }
  return `<h2>My sushi bar</h2>
    <ul class="lines">${ls.map((l) => `
      <li>
        <div><strong>${esc(l.title)}</strong> <span class="jp">${esc(l.jp)}</span><div class="muted small">${esc(l.category)} · ${euro(l.price)}</div></div>
        <div class="qty">
          <button data-dec="${esc(l.type)}" aria-label="Remove one ${esc(l.title)}">−</button>
          <span>${esc(l.qty)}</span>
          <button data-inc="${esc(l.type)}" aria-label="Add one ${esc(l.title)}">+</button>
        </div>
        <div class="line-total">${euro(l.price * l.qty)}</div>
      </li>`).join('')}
    </ul>
    <div class="total"><span>Total</span><strong>${euro(total())}</strong></div>
    <div class="actions">
      <a class="btn ghost" href="#">Keep browsing</a>
      <a class="btn" href="#checkout">Go to payment</a>
    </div>`;
}

function checkoutPage() {
  if (!count()) { location.hash = '#cart'; return ''; }
  return `<h2>Payment</h2>
    <div class="summary">${lines().map((l) => `<div><span>${esc(l.qty)} × ${esc(l.title)}</span><span>${euro(l.price * l.qty)}</span></div>`).join('')}
      <div class="total"><span>Total</span><strong>${euro(total())}</strong></div>
    </div>
    <form id="pay-form">
      <label>Full name<input name="name" required autocomplete="name" maxlength="80"></label>
      <label>Email<input name="email" type="email" required autocomplete="email" maxlength="254"></label>
      <label>Pickup time
        <select name="time"><option>As soon as possible</option><option>In 30 minutes</option><option>In 1 hour</option></select>
      </label>
      <p class="muted small">Demo checkout: no payment is taken and nothing you type leaves your browser.</p>
      <div class="actions">
        <a class="btn ghost" href="#cart">Back to cart</a>
        <button class="btn" type="submit">Pay ${euro(total())}</button>
      </div>
    </form>`;
}

const ORDER_ID = /^[A-Z0-9]{8}$/;
function donePage(id) {
  if (!ORDER_ID.test(id || '')) return '<h2>Order not found</h2><div class="actions"><a class="btn" href="#">Back to the sushi bar</a></div>';
  return `<h2>Arigatō! 🍣</h2>
    <p>Your order <strong>#${esc(id)}</strong> is being prepared by our bunny chef.</p>
    <div class="actions"><a class="btn" href="#">Back to the sushi bar</a></div>`;
}

// Renders the overlay page for #cart / #checkout / #done/<id>; returns false when the route is not a shop page.
export function renderPage(hash) {
  const page = $('#page');
  const [route, arg] = hash.replace(/^#/, '').split('/');
  const html = route === 'cart' ? cartPage() : route === 'checkout' ? checkoutPage() : route === 'done' ? donePage(arg) : null;
  page.hidden = html === null;
  if (html === null) return false;
  page.querySelector('.card').innerHTML = html;
  return true;
}

document.addEventListener('click', (e) => {
  const inc = e.target.closest('[data-inc]'), dec = e.target.closest('[data-dec]');
  if (inc) addToCart(inc.dataset.inc, 1);
  if (dec) addToCart(dec.dataset.dec, -1);
  if (inc || dec) renderPage(location.hash);
});

document.addEventListener('submit', (e) => {
  if (e.target.id !== 'pay-form') return;
  e.preventDefault();
  // A real shop must send only the cart keys to its server and recompute prices there: client prices are display-only.
  cart = Object.create(null);
  save();
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  location.hash = '#done/' + Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => alphabet[b % alphabet.length]).join('');
});
