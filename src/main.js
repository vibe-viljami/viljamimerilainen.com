import { Fluid } from './fluid.js';

const canvas = document.querySelector('#ink');
const mark = document.querySelector('.mark');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const coarse = matchMedia('(pointer: coarse)');
document.querySelector('#hint').textContent = coarse.matches ? 'Touch to stir' : 'Move to stir';

let fluid;
let frame = 0;
let last = 0;
let elapsed = 0;
let lastAmbient = 0;
let previousPointer = null;
let pending = [];

function stop() {
  cancelAnimationFrame(frame);
  frame = 0;
}

function animate(timestamp) {
  const dt = Math.min((timestamp - (last || timestamp - 16)) / 1000, 1 / 30);
  last = timestamp;
  elapsed += dt;
  for (const point of pending) fluid.splat(...point);
  pending = [];
  if (elapsed - lastAmbient > 0.22) {
    lastAmbient = elapsed;
    const t = elapsed * 0.23;
    const side = Math.sin(t * 0.63) > 0 ? 1 : -1;
    const depth = (Math.sin(t) + 1) * 0.5;
    fluid.splat(0.5 + side * (0.265 - depth * 0.19), 0.73 - depth * 0.38, side * Math.cos(t) * 13, 10, 0.075, 0.00045);
  }
  fluid.step(dt);
  fluid.render(elapsed);
  frame = requestAnimationFrame(animate);
}

function start() {
  stop();
  fluid?.destroy();
  fluid = null;
  mark.classList.remove('is-ready');
  document.body.classList.toggle('is-static', reducedMotion.matches);
  if (reducedMotion.matches) return;
  try {
    fluid = new Fluid(canvas);
    fluid.render(0);
    mark.classList.add('is-ready');
    last = 0;
    if (!document.hidden) frame = requestAnimationFrame(animate);
  } catch (error) {
    fluid?.destroy();
    fluid = null;
    document.body.classList.add('is-static');
    console.info('Using the still ink monogram:', error.message);
  }
}

function stir(event) {
  if (!fluid || reducedMotion.matches || (event.pointerType === 'touch' && event.type !== 'pointerdown' && event.buttons === 0)) return;
  const rect = canvas.getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width;
  const y = 1 - (event.clientY - rect.top) / rect.height;
  const point = { x, y };
  if (x < 0 || x > 1 || y < 0 || y > 1) { previousPointer = null; return; }
  const prev = previousPointer || point;
  const dx = Math.max(-180, Math.min(180, (x - prev.x) * 2200));
  const dy = Math.max(-180, Math.min(180, (y - prev.y) * 2200));
  pending.push([x, y, dx, dy, 0.32, 0.0011]);
  if (pending.length > 24) pending.shift();
  previousPointer = point;
  document.body.classList.add('has-interacted');
}

window.addEventListener('pointermove', stir, { passive: true });
mark.addEventListener('pointerdown', event => {
  previousPointer = null;
  mark.setPointerCapture(event.pointerId);
  stir(event);
});
window.addEventListener('pointerup', () => { previousPointer = null; });
window.addEventListener('pointercancel', () => { previousPointer = null; });
window.addEventListener('blur', () => { previousPointer = null; });
canvas.addEventListener('webglcontextlost', event => {
  event.preventDefault();
  stop();
  mark.classList.remove('is-ready');
  document.body.classList.add('is-static');
});
canvas.addEventListener('webglcontextrestored', start);
new ResizeObserver(() => {
  if (!fluid || fluid.gl.isContextLost()) return;
  fluid.resize();
  fluid.render(elapsed);
}).observe(mark);
document.addEventListener('visibilitychange', () => {
  stop();
  pending = [];
  previousPointer = null;
  last = 0;
  if (!document.hidden && fluid && !fluid.gl.isContextLost() && !reducedMotion.matches) frame = requestAnimationFrame(animate);
});
reducedMotion.addEventListener('change', start);
start();
