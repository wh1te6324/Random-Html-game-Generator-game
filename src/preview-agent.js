import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createZipFile, readZipFile } from "./zip.js";

const categories = [
  "asteroid-dodge",
  "orb-collector",
  "target-clicker",
  "snake-trail",
  "lane-runner",
  "orbit-guard",
  "paddle-breaker",
  "pong-duel",
  "billiards-break",
  "sky-jumper",
  "pulse-defense"
];
const requiredFiles = ["index.html", "styles.css", "script.js"];

const themes = [
  { name: "Acid Arcade", accent: "#c9ff2f", secondary: "#5dff8a", danger: "#ff4f7b", bg: "#020302", pattern: "circuit" },
  { name: "Violet Byte", accent: "#b77cff", secondary: "#75f4ff", danger: "#ffdd55", bg: "#05030a", pattern: "stars" },
  { name: "Solar Pop", accent: "#ffdd55", secondary: "#ff7a59", danger: "#75f4ff", bg: "#080502", pattern: "rings" },
  { name: "Aqua Signal", accent: "#75f4ff", secondary: "#5dff8a", danger: "#ff5df7", bg: "#02070a", pattern: "bubbles" },
  { name: "Cherry Grid", accent: "#ff4f7b", secondary: "#c9ff2f", danger: "#75f4ff", bg: "#090205", pattern: "diagonal" }
];

const shapes = ["ship", "diamond", "circle", "triangle", "bug", "shield", "comet"];

export async function createPreviewGameZip({ category, id, outputDir }) {
  const pickedCategory = categories.includes(category) ? category : randomItem(categories);
  const seed = Math.floor(Math.random() * 900000) + 100000;
  const game = buildGame(pickedCategory, seed);
  const files = {
    "index.html": buildHtml(game),
    "styles.css": buildCss(game),
    "script.js": buildScript(game)
  };

  await mkdir(outputDir, { recursive: true });

  for (const fileName of requiredFiles) {
    await writeFile(path.join(outputDir, fileName), files[fileName], "utf8");
  }

  const zipPath = path.join(outputDir, `${id}.zip`);
  await createZipFile(
    zipPath,
    requiredFiles.map((fileName) => ({
      name: fileName,
      path: path.join(outputDir, fileName)
    }))
  );

  const manifest = {
    id,
    title: game.title,
    category: pickedCategory,
    controls: game.controls,
    zipPath,
    zipUrl: `/generated-games/${id}/${id}.zip`,
    previewUrl: `/previews/${id}/index.html`,
    createdAt: new Date().toISOString()
  };

  await writeFile(path.join(outputDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");

  return { ...manifest, zipPath };
}

export async function extractGameZip(zipPath, outputDir) {
  const entries = await readZipFile(zipPath);
  const extracted = [];
  const resolvedOutputDir = path.resolve(outputDir);

  await mkdir(resolvedOutputDir, { recursive: true });

  for (const entry of entries) {
    if (!requiredFiles.includes(entry.name)) continue;

    const outputPath = path.resolve(resolvedOutputDir, entry.name);
    if (outputPath !== resolvedOutputDir && !outputPath.startsWith(`${resolvedOutputDir}${path.sep}`)) {
      throw new Error(`Unsafe zip entry path: ${entry.name}`);
    }

    await writeFile(outputPath, entry.data);
    extracted.push(entry.name);
  }

  const missing = requiredFiles.filter((fileName) => !extracted.includes(fileName));
  if (missing.length > 0) throw new Error(`Generated zip is missing required files: ${missing.join(", ")}`);

  return extracted;
}

export function slugify(value) {
  return String(value || "random")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32) || "random";
}

function buildGame(category, seed) {
  const rng = mulberry32(seed);
  const theme = themes[Math.floor(rng() * themes.length)];
  const playerShape = shapes[Math.floor(rng() * shapes.length)];
  const enemyShape = shapes[Math.floor(rng() * shapes.length)];
  const collectibleShape = shapes[Math.floor(rng() * shapes.length)];
  const decoration = Array.from({ length: 18 }, (_, index) => ({
    x: Math.floor(rng() * 960),
    y: Math.floor(rng() * 540),
    size: 8 + Math.floor(rng() * 34),
    shape: shapes[(index + Math.floor(rng() * shapes.length)) % shapes.length],
    alpha: 0.08 + rng() * 0.18
  }));

  const presets = {
    "asteroid-dodge": ["Meteor Weave", "slide through falling hazards", "Move with mouse/touch or Arrow keys."],
    "orb-collector": ["Orb Sprint", "collect bright cores before the timer fades", "Move with mouse/touch or Arrow keys."],
    "target-clicker": ["Tap Burst", "hit targets as they bloom", "Click or tap targets quickly."],
    "snake-trail": ["Neon Trail", "grow the trail without biting yourself", "Use Arrow keys or WASD."],
    "lane-runner": ["Lane Shift", "swap lanes through incoming gates", "Use Up/Down, W/S, or tap lanes."],
    "orbit-guard": ["Orbit Guard", "rotate a shield around the core", "Click/tap or press Space to flip orbit direction."],
    "paddle-breaker": ["Prism Paddle", "bounce the core through a patterned wall", "Move with mouse/touch or Arrow keys."],
    "pong-duel": ["Pulse Pong", "rally against a reactive AI paddle", "Move your paddle with mouse/touch or W/S."],
    "billiards-break": ["Neon Billiards", "strike the cue orb into glowing pockets", "Aim with mouse/touch, release to shoot."],
    "sky-jumper": ["Sky Hop", "chain platforms and collect sparks", "Press Space/ArrowUp or tap to double jump."],
    "pulse-defense": ["Pulse Defense", "place emitters to stop the wave", "Click empty cells to place towers."]
  };
  const [title, subtitle, controls] = presets[category];

  return {
    title,
    subtitle,
    category,
    controls,
    theme,
    seed,
    playerShape,
    enemyShape,
    collectibleShape,
    decoration
  };
}

function buildHtml(game) {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${game.title}</title>
    <link rel="stylesheet" href="./styles.css" />
  </head>
  <body>
    <main class="game-shell">
      <header>
        <div>
          <p>${game.theme.name} preview</p>
          <h1>${game.title}</h1>
          <span>${game.subtitle}</span>
        </div>
        <button id="restartButton" type="button">Restart</button>
      </header>
      <canvas id="gameCanvas" width="960" height="540"></canvas>
      <footer>
        <span>Score <strong id="scoreValue">0</strong></span>
        <span>Best <strong id="bestValue">0</strong></span>
        <span id="hintValue">${game.controls}</span>
      </footer>
    </main>
    <script src="./script.js"></script>
  </body>
</html>
`;
}

function buildCss(game) {
  return `:root {
  --bg: ${game.theme.bg};
  --ink: #f2f8ef;
  --muted: #9aa896;
  --accent: ${game.theme.accent};
  --secondary: ${game.theme.secondary};
  --danger: ${game.theme.danger};
  color-scheme: dark;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  min-height: 100vh;
  display: grid;
  place-items: center;
  background:
    linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px),
    radial-gradient(circle at 78% 16%, color-mix(in srgb, var(--accent), transparent 72%), transparent 28%),
    var(--bg);
  background-size: 42px 42px, 42px 42px, auto, auto;
  color: var(--ink);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

button { font: inherit; cursor: pointer; }

.game-shell {
  width: min(100vw, 1280px);
  min-height: 100vh;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  border: 1px solid color-mix(in srgb, var(--accent), transparent 58%);
  background: rgba(3, 8, 5, 0.82);
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.46);
}

header,
footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 18px;
}

header { border-bottom: 1px solid color-mix(in srgb, var(--accent), transparent 78%); }
footer { border-top: 1px solid color-mix(in srgb, var(--accent), transparent 78%); color: var(--muted); font-weight: 800; }

p, h1 { margin: 0; }
p { color: var(--accent); font-size: 12px; font-weight: 900; text-transform: uppercase; }
h1 { margin-top: 4px; font-size: clamp(34px, 6vw, 72px); line-height: 0.9; }
header span, #hintValue { color: var(--muted); }

button {
  min-height: 42px;
  padding: 0 16px;
  border: 1px solid var(--accent);
  border-radius: 8px;
  background: var(--accent);
  color: #061005;
  font-weight: 900;
}

canvas {
  display: block;
  width: 100%;
  height: 100%;
  min-height: 540px;
  background: var(--bg);
}

strong { color: var(--accent); font-size: 18px; }

@media (max-width: 680px) {
  header, footer { align-items: flex-start; flex-direction: column; }
  canvas { min-height: 420px; }
}
`;
}

function buildScript(game) {
  const config = {
    category: game.category,
    title: game.title,
    storageKey: `preview-${game.category}-best`,
    accent: game.theme.accent,
    secondary: game.theme.secondary,
    danger: game.theme.danger,
    bg: game.theme.bg,
    pattern: game.theme.pattern,
    playerShape: game.playerShape,
    enemyShape: game.enemyShape,
    collectibleShape: game.collectibleShape,
    decoration: game.decoration
  };

  return `const CONFIG = ${JSON.stringify(config)};
const canvas = document.querySelector("#gameCanvas");
const ctx = canvas.getContext("2d");
const scoreEl = document.querySelector("#scoreValue");
const bestEl = document.querySelector("#bestValue");
const restartButton = document.querySelector("#restartButton");
const keys = new Set();
const pointer = { active: false, x: 480, y: 270 };
let state;

function reset() {
  state = {
    tick: 0,
    score: 0,
    best: Number(localStorage.getItem(CONFIG.storageKey) || 0),
    over: false,
    player: { x: 160, y: 270, vx: 0, vy: 0, size: 34, lane: 1, jumps: 0, angle: 0 },
    ball: { x: 480, y: 400, vx: 5, vy: -5, r: 12 },
    paddle: { x: 410, y: 492, w: 140, h: 16 },
    enemies: [],
    items: [],
    shots: [],
    trail: [{ x: 220, y: 270 }],
    dir: { x: 1, y: 0 },
    bricks: [],
    towers: [],
    cash: 80,
    lives: 8
  };

  if (CONFIG.category === "paddle-breaker") {
    for (let row = 0; row < 5; row += 1) {
      for (let col = 0; col < 10; col += 1) {
        state.bricks.push({ x: 72 + col * 82, y: 70 + row * 34, w: 66, h: 18, alive: true, shade: (row + col) % 3 });
      }
    }
  }

  if (CONFIG.category === "sky-jumper") {
    state.items = [{ x: 460, y: 350 }, { x: 760, y: 270 }];
    state.enemies = [{ x: 80, y: canvas.height - 70, w: 240 }, { x: 380, y: 390, w: 170 }, { x: 680, y: 310, w: 190 }];
  }
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

function update() {
  state.tick += 1;
  if (!state.over) {
    if (CONFIG.category === "asteroid-dodge") updateDodge();
    if (CONFIG.category === "orb-collector") updateCollector();
    if (CONFIG.category === "target-clicker") updateTargets();
    if (CONFIG.category === "snake-trail") updateSnake();
    if (CONFIG.category === "lane-runner") updateLane();
    if (CONFIG.category === "orbit-guard") updateOrbit();
    if (CONFIG.category === "paddle-breaker") updatePaddle();
    if (CONFIG.category === "pong-duel") updatePong();
    if (CONFIG.category === "billiards-break") updateBilliards();
    if (CONFIG.category === "sky-jumper") updateJumper();
    if (CONFIG.category === "pulse-defense") updateDefense();
  }
  scoreEl.textContent = state.score;
  bestEl.textContent = state.best;
}

function updateDodge() {
  movePlayer(5.4);
  if (state.tick % 28 === 0) state.enemies.push({ x: Math.random() * canvas.width, y: -40, vy: 2.8 + state.score * 0.01, size: 24 + Math.random() * 32, rot: Math.random() * 6 });
  state.enemies.forEach(enemy => { enemy.y += enemy.vy; enemy.rot += 0.04; });
  state.enemies = state.enemies.filter(enemy => enemy.y < canvas.height + 60);
  if (state.enemies.some(enemy => hitCircle(state.player, enemy, enemy.size * 0.45))) finish();
  state.score += 1;
}

function updateCollector() {
  movePlayer(5.8);
  if (state.tick % 38 === 0) state.items.push({ x: 50 + Math.random() * (canvas.width - 100), y: 70 + Math.random() * (canvas.height - 150), size: 16 + Math.random() * 16, life: 260 });
  if (state.tick % 62 === 0) state.enemies.push({ x: canvas.width + 40, y: 80 + Math.random() * (canvas.height - 160), vx: -2.4 - Math.random() * 1.8, size: 28 });
  state.items.forEach(item => item.life -= 1);
  state.enemies.forEach(enemy => enemy.x += enemy.vx);
  state.items = state.items.filter(item => {
    if (hitCircle(state.player, item, item.size)) { state.score += 45; return false; }
    return item.life > 0;
  });
  state.enemies = state.enemies.filter(enemy => enemy.x > -60);
  if (state.enemies.some(enemy => hitCircle(state.player, enemy, enemy.size * 0.6))) finish();
}

function updateTargets() {
  if (state.tick % 34 === 0 && state.items.length < 8) state.items.push({ x: 70 + Math.random() * (canvas.width - 140), y: 80 + Math.random() * (canvas.height - 160), size: 20 + Math.random() * 26, life: 120 });
  state.items.forEach(item => { item.life -= 1; item.size += 0.04; });
  state.items = state.items.filter(item => item.life > 0);
  state.score = Math.max(0, state.score - (state.tick % 45 === 0 ? 1 : 0));
}

function updateSnake() {
  if (keys.has("ArrowUp") || keys.has("KeyW")) state.dir = { x: 0, y: -1 };
  if (keys.has("ArrowDown") || keys.has("KeyS")) state.dir = { x: 0, y: 1 };
  if (keys.has("ArrowLeft") || keys.has("KeyA")) state.dir = { x: -1, y: 0 };
  if (keys.has("ArrowRight") || keys.has("KeyD")) state.dir = { x: 1, y: 0 };
  if (state.items.length === 0) state.items.push({ x: 40 + Math.floor(Math.random() * 22) * 38, y: 60 + Math.floor(Math.random() * 11) * 38, size: 16 });
  if (state.tick % 8 !== 0) return;
  const head = state.trail[0];
  const next = { x: head.x + state.dir.x * 28, y: head.y + state.dir.y * 28 };
  if (next.x < 20 || next.x > canvas.width - 20 || next.y < 50 || next.y > canvas.height - 30) return finish();
  if (state.trail.some(part => Math.hypot(part.x - next.x, part.y - next.y) < 6)) return finish();
  state.trail.unshift(next);
  const food = state.items[0];
  if (Math.hypot(food.x - next.x, food.y - next.y) < 26) {
    state.score += 30;
    state.items = [];
  } else {
    state.trail.pop();
  }
}

function updateLane() {
  const lanes = [160, 270, 380];
  state.player.y += (lanes[state.player.lane] - state.player.y) * 0.25;
  state.player.x = 155;
  if (state.tick % 34 === 0) {
    const blocked = Math.floor(Math.random() * 3);
    state.enemies.push({ x: canvas.width + 50, y: lanes[blocked], lane: blocked, w: 38, h: 72, vx: -5.4 - state.score * 0.006 });
    if (Math.random() > 0.45) state.items.push({ x: canvas.width + 160, y: lanes[(blocked + 1 + Math.floor(Math.random() * 2)) % 3], size: 16 });
  }
  state.enemies.forEach(enemy => enemy.x += enemy.vx);
  state.items.forEach(item => item.x -= 5.2);
  state.enemies = state.enemies.filter(enemy => enemy.x > -80);
  state.items = state.items.filter(item => {
    if (hitCircle(state.player, item, item.size)) { state.score += 55; return false; }
    return item.x > -50;
  });
  if (state.enemies.some(enemy => Math.abs(enemy.x - state.player.x) < 34 && enemy.lane === state.player.lane)) finish();
  state.score += 1;
}

function updateOrbit() {
  const core = { x: canvas.width / 2, y: canvas.height / 2 };
  state.player.angle += state.player.vx || 0.045;
  state.player.x = core.x + Math.cos(state.player.angle) * 92;
  state.player.y = core.y + Math.sin(state.player.angle) * 92;
  if (state.tick % 42 === 0) {
    const angle = Math.random() * Math.PI * 2;
    state.enemies.push({ x: core.x + Math.cos(angle) * 420, y: core.y + Math.sin(angle) * 320, vx: Math.cos(angle + Math.PI) * 2.6, vy: Math.sin(angle + Math.PI) * 2.6, size: 28 });
  }
  state.enemies.forEach(enemy => { enemy.x += enemy.vx; enemy.y += enemy.vy; });
  state.enemies = state.enemies.filter(enemy => {
    if (Math.hypot(enemy.x - state.player.x, enemy.y - state.player.y) < 34) { state.score += 35; return false; }
    if (Math.hypot(enemy.x - core.x, enemy.y - core.y) < 24) { finish(); return false; }
    return true;
  });
}

function updatePaddle() {
  if (pointer.active) state.paddle.x += (pointer.x - state.paddle.w / 2 - state.paddle.x) * 0.35;
  if (keys.has("ArrowLeft")) state.paddle.x -= 8;
  if (keys.has("ArrowRight")) state.paddle.x += 8;
  state.ball.x += state.ball.vx;
  state.ball.y += state.ball.vy;
  if (state.ball.x < state.ball.r || state.ball.x > canvas.width - state.ball.r) state.ball.vx *= -1;
  if (state.ball.y < state.ball.r) state.ball.vy *= -1;
  if (state.ball.y > canvas.height + 40) finish();
  if (state.ball.x > state.paddle.x && state.ball.x < state.paddle.x + state.paddle.w && state.ball.y + state.ball.r > state.paddle.y && state.ball.vy > 0) {
    state.ball.vy *= -1;
    state.ball.vx += (state.ball.x - (state.paddle.x + state.paddle.w / 2)) * 0.035;
  }
  state.bricks.forEach(brick => {
    if (!brick.alive) return;
    const hit = state.ball.x + state.ball.r > brick.x && state.ball.x - state.ball.r < brick.x + brick.w && state.ball.y + state.ball.r > brick.y && state.ball.y - state.ball.r < brick.y + brick.h;
    if (hit) { brick.alive = false; state.ball.vy *= -1; state.score += 15; }
  });
}

function updatePong() {
  const p = state.player;
  p.x = 48;
  if (pointer.active) p.y += (pointer.y - p.y) * 0.22;
  if (keys.has("KeyW") || keys.has("ArrowUp")) p.y -= 7;
  if (keys.has("KeyS") || keys.has("ArrowDown")) p.y += 7;
  p.y = Math.max(82, Math.min(canvas.height - 82, p.y));
  const ai = state.paddle;
  ai.x = canvas.width - 66;
  ai.y += (state.ball.y - ai.y) * 0.075;
  ai.y = Math.max(82, Math.min(canvas.height - 82, ai.y));
  state.ball.x += state.ball.vx;
  state.ball.y += state.ball.vy;
  if (state.ball.y < 38 || state.ball.y > canvas.height - 38) state.ball.vy *= -1;
  const leftHit = state.ball.x - state.ball.r < p.x + 16 && Math.abs(state.ball.y - p.y) < 72 && state.ball.vx < 0;
  const rightHit = state.ball.x + state.ball.r > ai.x - 16 && Math.abs(state.ball.y - ai.y) < 72 && state.ball.vx > 0;
  if (leftHit || rightHit) {
    state.ball.vx *= -1.05;
    state.ball.vy += ((state.ball.y - (leftHit ? p.y : ai.y)) / 72) * 2.2;
    state.score += 12;
  }
  if (state.ball.x < -50) finish();
  if (state.ball.x > canvas.width + 50) {
    state.score += 120;
    state.ball.x = canvas.width / 2;
    state.ball.y = canvas.height / 2;
    state.ball.vx = -5 - Math.random() * 2;
    state.ball.vy = (Math.random() - 0.5) * 7;
  }
}

function updateBilliards() {
  if (state.items.length === 0) {
    state.items = Array.from({ length: 7 }, (_, index) => ({
      x: 560 + (index % 3) * 34,
      y: 210 + Math.floor(index / 3) * 42,
      vx: 0,
      vy: 0,
      size: 22,
      pocketed: false,
      color: index % 2 ? CONFIG.secondary : CONFIG.danger
    }));
    state.ball = { x: 250, y: 300, vx: 0, vy: 0, r: 14 };
  }
  const balls = [state.ball, ...state.items.filter(item => !item.pocketed)];
  balls.forEach(ball => {
    ball.x += ball.vx;
    ball.y += ball.vy;
    ball.vx *= 0.985;
    ball.vy *= 0.985;
    if (Math.abs(ball.vx) < 0.015) ball.vx = 0;
    if (Math.abs(ball.vy) < 0.015) ball.vy = 0;
    if (ball.x < 70 || ball.x > canvas.width - 70) ball.vx *= -0.86;
    if (ball.y < 76 || ball.y > canvas.height - 76) ball.vy *= -0.86;
    ball.x = Math.max(70, Math.min(canvas.width - 70, ball.x));
    ball.y = Math.max(76, Math.min(canvas.height - 76, ball.y));
  });
  for (let i = 0; i < balls.length; i += 1) {
    for (let j = i + 1; j < balls.length; j += 1) {
      const a = balls[i], b = balls[j];
      const dx = b.x - a.x, dy = b.y - a.y, dist = Math.hypot(dx, dy) || 1;
      if (dist < 30) {
        const nx = dx / dist, ny = dy / dist;
        const push = (30 - dist) * 0.5;
        a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push;
        const impulse = ((a.vx - b.vx) * nx + (a.vy - b.vy) * ny) * 0.9;
        a.vx -= impulse * nx; a.vy -= impulse * ny; b.vx += impulse * nx; b.vy += impulse * ny;
      }
    }
  }
  const pockets = [[58, 64], [canvas.width / 2, 58], [canvas.width - 58, 64], [58, canvas.height - 58], [canvas.width / 2, canvas.height - 54], [canvas.width - 58, canvas.height - 58]];
  state.items.forEach(item => {
    if (item.pocketed) return;
    if (pockets.some(([x, y]) => Math.hypot(item.x - x, item.y - y) < 34)) {
      item.pocketed = true;
      state.score += 90;
    }
  });
  if (pockets.some(([x, y]) => Math.hypot(state.ball.x - x, state.ball.y - y) < 28)) {
    state.ball.x = 250; state.ball.y = 300; state.ball.vx = 0; state.ball.vy = 0;
  }
  if (state.items.every(item => item.pocketed)) finish();
}

function updateJumper() {
  const p = state.player;
  p.vy += 0.55;
  p.y += p.vy;
  state.enemies.forEach(platform => platform.x -= 4.2);
  state.items.forEach(item => item.x -= 4.2);
  for (const platform of state.enemies) {
    if (p.x + p.size > platform.x && p.x < platform.x + platform.w && p.y + p.size > platform.y - 10 && p.y + p.size < platform.y + 18 && p.vy >= 0) {
      p.y = platform.y - p.size;
      p.vy = 0;
      p.jumps = 0;
    }
  }
  state.items = state.items.filter(item => {
    if (hitCircle(p, item, 22)) { state.score += 70; return false; }
    return item.x > -50;
  });
  state.enemies = state.enemies.filter(platform => platform.x + platform.w > -30);
  while (state.enemies.length < 4) {
    const last = state.enemies[state.enemies.length - 1];
    const y = 260 + Math.random() * 220;
    state.enemies.push({ x: last.x + last.w + 160 + Math.random() * 160, y, w: 130 + Math.random() * 140 });
    if (Math.random() > 0.35) state.items.push({ x: last.x + last.w + 240, y: y - 46, size: 16 });
  }
  if (p.y > canvas.height + 80) finish();
  state.score += 1;
}

function updateDefense() {
  if (state.tick % 62 === 0) state.enemies.push({ x: -30, y: canvas.height * 0.58 + Math.sin(state.tick * 0.03) * 80, hp: 42 + state.score * 0.08, max: 42 + state.score * 0.08, speed: 0.8 + state.score * 0.002, size: 30 });
  state.enemies.forEach(enemy => enemy.x += enemy.speed);
  state.enemies = state.enemies.filter(enemy => {
    if (enemy.x > canvas.width + 40) { state.lives -= 1; if (state.lives <= 0) finish(); return false; }
    return enemy.hp > 0;
  });
  state.towers.forEach(tower => {
    tower.cooldown -= 1;
    const target = state.enemies.find(enemy => Math.hypot(enemy.x - tower.x, enemy.y - tower.y) < 190);
    if (target && tower.cooldown <= 0) {
      tower.cooldown = 28;
      state.shots.push({ x: tower.x, y: tower.y, target, life: 12 });
      target.hp -= 14;
      if (target.hp <= 0) { state.score += 25; state.cash += 12; }
    }
  });
  state.shots.forEach(shot => shot.life -= 1);
  state.shots = state.shots.filter(shot => shot.life > 0);
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = CONFIG.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawPattern();
  CONFIG.decoration.forEach(asset => drawShape(asset.shape, asset.x, asset.y, asset.size, CONFIG.secondary, asset.alpha, state.tick * 0.01));

  if (CONFIG.category === "paddle-breaker") drawPaddleScene();
  else if (CONFIG.category === "pong-duel") drawPongScene();
  else if (CONFIG.category === "billiards-break") drawBilliardsScene();
  else if (CONFIG.category === "snake-trail") drawSnakeScene();
  else if (CONFIG.category === "pulse-defense") drawDefenseScene();
  else {
    state.items.forEach(item => drawShape(CONFIG.collectibleShape, item.x, item.y, item.size || 18, CONFIG.secondary, 0.95, state.tick * 0.04));
    state.enemies.forEach(enemy => drawShape(CONFIG.enemyShape, enemy.x, enemy.y, enemy.size || 30, CONFIG.danger, 0.92, enemy.rot || state.tick * 0.02));
    drawShape(CONFIG.playerShape, state.player.x, state.player.y, state.player.size, CONFIG.accent, 1, state.tick * 0.025);
    if (CONFIG.category === "orbit-guard") {
      drawShape("shield", canvas.width / 2, canvas.height / 2, 34, CONFIG.secondary, 0.9, 0);
      ctx.strokeStyle = "rgba(255,255,255,.14)";
      ctx.beginPath();
      ctx.arc(canvas.width / 2, canvas.height / 2, 92, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  if (state.over) centerText("GAME OVER", "Restart to roll the preview again");
}

function drawPattern() {
  ctx.strokeStyle = "rgba(255,255,255,.09)";
  ctx.lineWidth = 1;
  if (CONFIG.pattern === "stars") {
    for (let i = 0; i < 70; i += 1) {
      const x = (i * 137 + state.tick * 0.22) % canvas.width;
      const y = (i * 67) % canvas.height;
      ctx.fillStyle = i % 3 ? "rgba(255,255,255,.16)" : CONFIG.accent;
      ctx.fillRect(x, y, 2, 2);
    }
    return;
  }
  if (CONFIG.pattern === "rings" || CONFIG.pattern === "bubbles") {
    for (let i = 0; i < 10; i += 1) {
      ctx.beginPath();
      ctx.arc((i * 111 + state.tick * 0.45) % canvas.width, 80 + (i * 47) % 380, 20 + (i % 4) * 12, 0, Math.PI * 2);
      ctx.stroke();
    }
    return;
  }
  for (let x = -80; x < canvas.width + 80; x += 58) {
    ctx.beginPath();
    ctx.moveTo(x + (state.tick * 0.4) % 58, 0);
    ctx.lineTo(x - 180 + (state.tick * 0.4) % 58, canvas.height);
    ctx.stroke();
  }
}

function drawPaddleScene() {
  state.bricks.forEach((brick, index) => {
    if (!brick.alive) return;
    drawShape(index % 2 ? CONFIG.enemyShape : CONFIG.collectibleShape, brick.x + brick.w / 2, brick.y + brick.h / 2, 22, brick.shade ? CONFIG.accent : CONFIG.secondary, 0.94, index);
  });
  drawShape("shield", state.paddle.x + state.paddle.w / 2, state.paddle.y, 50, CONFIG.accent, 1, 0);
  drawShape(CONFIG.collectibleShape, state.ball.x, state.ball.y, state.ball.r * 2, CONFIG.secondary, 1, state.tick * 0.08);
}

function drawPongScene() {
  ctx.strokeStyle = "rgba(255,255,255,.16)";
  ctx.setLineDash([12, 12]);
  ctx.beginPath(); ctx.moveTo(canvas.width / 2, 45); ctx.lineTo(canvas.width / 2, canvas.height - 45); ctx.stroke();
  ctx.setLineDash([]);
  drawShape("shield", state.player.x, state.player.y, 78, CONFIG.accent, 1, Math.PI / 2);
  drawShape("shield", state.paddle.x, state.paddle.y, 78, CONFIG.secondary, 1, Math.PI / 2);
  drawShape(CONFIG.collectibleShape, state.ball.x, state.ball.y, state.ball.r * 2.2, CONFIG.danger, 1, state.tick * 0.08);
}

function drawBilliardsScene() {
  ctx.fillStyle = "rgba(255,255,255,.05)";
  roundRect(46, 46, canvas.width - 92, canvas.height - 92, 28);
  ctx.fill();
  [[58,64],[canvas.width/2,58],[canvas.width-58,64],[58,canvas.height-58],[canvas.width/2,canvas.height-54],[canvas.width-58,canvas.height-58]].forEach(([x,y]) => {
    ctx.fillStyle = "rgba(0,0,0,.72)";
    ctx.beginPath(); ctx.arc(x, y, 24, 0, Math.PI * 2); ctx.fill();
  });
  state.items.filter(item => !item.pocketed).forEach((item, index) => drawShape(index % 2 ? "diamond" : "circle", item.x, item.y, item.size * 1.5, item.color, 1, state.tick * 0.01 + index));
  drawShape(CONFIG.playerShape, state.ball.x, state.ball.y, state.ball.r * 2.4, CONFIG.accent, 1, 0);
  const still = Math.hypot(state.ball.vx, state.ball.vy) < 0.08 && state.items.every(item => item.pocketed || Math.hypot(item.vx, item.vy) < 0.08);
  if (still && pointer.active) {
    ctx.strokeStyle = CONFIG.secondary;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(state.ball.x, state.ball.y); ctx.lineTo(pointer.x, pointer.y); ctx.stroke();
  }
}

function drawSnakeScene() {
  state.trail.forEach((part, index) => drawShape(index === 0 ? CONFIG.playerShape : "circle", part.x, part.y, Math.max(12, 30 - index * 0.7), index === 0 ? CONFIG.accent : CONFIG.secondary, Math.max(0.35, 1 - index * 0.035), index));
  state.items.forEach(item => drawShape(CONFIG.collectibleShape, item.x, item.y, 22, CONFIG.danger, 1, state.tick * 0.05));
}

function drawDefenseScene() {
  ctx.strokeStyle = CONFIG.accent;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(0, canvas.height * 0.58);
  ctx.bezierCurveTo(230, 200, 420, 430, 630, 290);
  ctx.bezierCurveTo(760, 210, 820, 380, canvas.width, 330);
  ctx.stroke();
  state.towers.forEach(tower => drawShape("shield", tower.x, tower.y, 36, CONFIG.accent, 1, state.tick * 0.03));
  state.enemies.forEach(enemy => {
    drawShape(CONFIG.enemyShape, enemy.x, enemy.y, enemy.size, CONFIG.danger, 0.95, state.tick * 0.03);
    ctx.fillStyle = CONFIG.accent;
    ctx.fillRect(enemy.x - 16, enemy.y - 24, 32 * Math.max(0, enemy.hp / enemy.max), 4);
  });
  ctx.strokeStyle = "#fff";
  state.shots.forEach(shot => {
    ctx.beginPath();
    ctx.moveTo(shot.x, shot.y);
    ctx.lineTo(shot.target.x, shot.target.y);
    ctx.stroke();
  });
  ctx.fillStyle = "#f2f8ef";
  ctx.font = "800 18px system-ui";
  ctx.fillText("Cash " + state.cash + "   Lives " + state.lives, 22, 34);
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
}

function drawShape(shape, x, y, size, color, alpha = 1, rotation = 0) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.shadowColor = color;
  ctx.shadowBlur = 12;
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, size * 0.08);
  const r = size / 2;
  if (shape === "circle") {
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
  } else if (shape === "triangle" || shape === "ship") {
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(-r * 0.75, -r * 0.75);
    ctx.lineTo(-r * 0.45, 0);
    ctx.lineTo(-r * 0.75, r * 0.75);
    ctx.closePath();
    ctx.fill();
  } else if (shape === "bug") {
    ctx.fillRect(-r * 0.6, -r * 0.6, r * 1.2, r * 1.2);
    ctx.fillRect(-r, -r * 0.2, r * 0.42, r * 0.42);
    ctx.fillRect(r * 0.58, -r * 0.2, r * 0.42, r * 0.42);
  } else if (shape === "shield") {
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(r * 0.8, -r * 0.25);
    ctx.lineTo(r * 0.55, r * 0.85);
    ctx.lineTo(0, r);
    ctx.lineTo(-r * 0.55, r * 0.85);
    ctx.lineTo(-r * 0.8, -r * 0.25);
    ctx.closePath();
    ctx.fill();
  } else if (shape === "comet") {
    ctx.beginPath();
    ctx.arc(r * 0.25, 0, r * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha *= 0.55;
    ctx.beginPath();
    ctx.moveTo(-r * 1.4, 0);
    ctx.lineTo(-r * 0.2, -r * 0.45);
    ctx.lineTo(-r * 0.2, r * 0.45);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillRect(-r, -r, size, size);
  }
  ctx.restore();
}

function movePlayer(speed) {
  const p = state.player;
  if (pointer.active) {
    p.x += (pointer.x - p.x) * 0.18;
    p.y += (pointer.y - p.y) * 0.18;
  }
  if (keys.has("ArrowLeft") || keys.has("KeyA")) p.x -= speed;
  if (keys.has("ArrowRight") || keys.has("KeyD")) p.x += speed;
  if (keys.has("ArrowUp") || keys.has("KeyW")) p.y -= speed;
  if (keys.has("ArrowDown") || keys.has("KeyS")) p.y += speed;
  p.x = Math.max(24, Math.min(canvas.width - 24, p.x));
  p.y = Math.max(54, Math.min(canvas.height - 28, p.y));
}

function hitCircle(a, b, radius) {
  return Math.hypot(a.x - b.x, a.y - b.y) < radius + (a.size || 28) * 0.45;
}

function finish() {
  state.over = true;
  state.best = Math.max(state.best, state.score);
  localStorage.setItem(CONFIG.storageKey, state.best);
}

function centerText(title, sub) {
  ctx.fillStyle = "rgba(2,3,2,.68)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = "center";
  ctx.fillStyle = CONFIG.accent;
  ctx.font = "900 54px system-ui";
  ctx.fillText(title, canvas.width / 2, canvas.height / 2 - 14);
  ctx.fillStyle = "#f2f8ef";
  ctx.font = "700 20px system-ui";
  ctx.fillText(sub, canvas.width / 2, canvas.height / 2 + 26);
  ctx.textAlign = "left";
}

canvas.addEventListener("pointerup", event => {
  if (CONFIG.category === "billiards-break" && pointer.active) {
    const moving = Math.hypot(state.ball.vx, state.ball.vy) > 0.08 || state.items.some(item => !item.pocketed && Math.hypot(item.vx, item.vy) > 0.08);
    if (!moving) {
      const dx = state.ball.x - pointer.x;
      const dy = state.ball.y - pointer.y;
      const power = Math.min(11, Math.hypot(dx, dy) * 0.045);
      state.ball.vx = dx * 0.045 * power;
      state.ball.vy = dy * 0.045 * power;
    }
  }
});

canvas.addEventListener("pointerdown", event => {
  pointer.active = true;
  const rect = canvas.getBoundingClientRect();
  pointer.x = (event.clientX - rect.left) * canvas.width / rect.width;
  pointer.y = (event.clientY - rect.top) * canvas.height / rect.height;
  if (CONFIG.category === "target-clicker") {
    state.items = state.items.filter(item => {
      if (Math.hypot(item.x - pointer.x, item.y - pointer.y) < item.size + 10) {
        state.score += 35 + Math.round(item.life / 5);
        return false;
      }
      return true;
    });
  }
  if (CONFIG.category === "pulse-defense" && !state.over && state.cash >= 30 && !state.towers.some(tower => Math.hypot(tower.x - pointer.x, tower.y - pointer.y) < 42)) {
    state.cash -= 30;
    state.towers.push({ x: pointer.x, y: pointer.y, cooldown: 0 });
  }
  if (CONFIG.category === "orbit-guard") state.player.vx = state.player.vx === 0.045 ? -0.045 : 0.045;
  if (CONFIG.category === "lane-runner") state.player.lane = Math.max(0, Math.min(2, Math.floor(pointer.y / (canvas.height / 3))));
  if (CONFIG.category === "sky-jumper" && state.player.jumps < 2) {
    state.player.vy = -12;
    state.player.jumps += 1;
  }
});

canvas.addEventListener("pointermove", event => {
  const rect = canvas.getBoundingClientRect();
  pointer.x = (event.clientX - rect.left) * canvas.width / rect.width;
  pointer.y = (event.clientY - rect.top) * canvas.height / rect.height;
});
canvas.addEventListener("pointerleave", () => { pointer.active = false; });

window.addEventListener("keydown", event => {
  keys.add(event.code);
  if (CONFIG.category === "lane-runner") {
    if (event.code === "ArrowUp" || event.code === "KeyW") state.player.lane = Math.max(0, state.player.lane - 1);
    if (event.code === "ArrowDown" || event.code === "KeyS") state.player.lane = Math.min(2, state.player.lane + 1);
  }
  if (CONFIG.category === "orbit-guard" && event.code === "Space") state.player.vx = state.player.vx === 0.045 ? -0.045 : 0.045;
  if (CONFIG.category === "sky-jumper" && (event.code === "Space" || event.code === "ArrowUp") && state.player.jumps < 2) {
    event.preventDefault();
    state.player.vy = -12;
    state.player.jumps += 1;
  }
});
window.addEventListener("keyup", event => keys.delete(event.code));
restartButton.addEventListener("click", reset);

reset();
loop();
`;
}

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function mulberry32(seed) {
  return function next() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
