import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createZipFile, readZipFile } from "./zip.js";

const categories = ["tower-defense", "jumper", "paddle"];
const requiredFiles = ["index.html", "styles.css", "script.js"];

export async function createPreviewGameZip({ category, id, outputDir }) {
  const pickedCategory = categories.includes(category) ? category : randomItem(categories);
  const seed = Math.floor(Math.random() * 9999);
  const game = buildGame(pickedCategory, seed);
  const files = {
    "index.html": buildHtml(game),
    "styles.css": buildCss(game),
    "script.js": game.script
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
    if (!requiredFiles.includes(entry.name)) {
      continue;
    }

    const outputPath = path.resolve(resolvedOutputDir, entry.name);
    if (outputPath !== resolvedOutputDir && !outputPath.startsWith(`${resolvedOutputDir}${path.sep}`)) {
      throw new Error(`Unsafe zip entry path: ${entry.name}`);
    }

    await writeFile(outputPath, entry.data);
    extracted.push(entry.name);
  }

  const missing = requiredFiles.filter((fileName) => !extracted.includes(fileName));
  if (missing.length > 0) {
    throw new Error(`Generated zip is missing required files: ${missing.join(", ")}`);
  }

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
  const shared = {
    accent: randomItem(["#c9ff2f", "#5dff8a", "#75f4ff"]),
    secondary: randomItem(["#ff5df7", "#ffdd55", "#8bffbf"]),
    seed
  };

  if (category === "tower-defense") {
    return {
      ...shared,
      title: "Pulse Tower",
      subtitle: "place towers, stop the wave",
      controls: "Click empty grid cells to place towers.",
      script: towerDefenseScript(shared)
    };
  }

  if (category === "paddle") {
    return {
      ...shared,
      title: "Glow Paddle",
      subtitle: "bounce the core, break the wall",
      controls: "Move with mouse, touch, or Arrow keys.",
      script: paddleScript(shared)
    };
  }

  return {
    ...shared,
    title: "Sky Hop",
    subtitle: "jump platforms, chain points",
    controls: "Press Space/ArrowUp or tap to jump.",
    script: jumperScript(shared)
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
          <p>AI preview build</p>
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
  --bg: #020302;
  --panel: #08100b;
  --ink: #f2f8ef;
  --muted: #9aa896;
  --accent: ${game.accent};
  --secondary: ${game.secondary};
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
  display: grid;
  place-items: center;
  background:
    linear-gradient(rgba(201, 255, 47, 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(201, 255, 47, 0.04) 1px, transparent 1px),
    radial-gradient(circle at 78% 12%, color-mix(in srgb, var(--accent), transparent 78%), transparent 30%),
    #020302;
  background-size: 42px 42px, 42px 42px, auto, auto;
  color: var(--ink);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

button {
  font: inherit;
  cursor: pointer;
}

.game-shell {
  width: min(100vw, 1180px);
  border: 1px solid color-mix(in srgb, var(--accent), transparent 60%);
  border-radius: 8px;
  overflow: hidden;
  background: rgba(8, 16, 11, 0.82);
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.46), 0 0 44px color-mix(in srgb, var(--accent), transparent 86%);
}

header,
footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 18px;
}

header {
  border-bottom: 1px solid color-mix(in srgb, var(--accent), transparent 78%);
}

footer {
  border-top: 1px solid color-mix(in srgb, var(--accent), transparent 78%);
  color: var(--muted);
  font-weight: 800;
}

p,
h1 {
  margin: 0;
}

p {
  color: var(--accent);
  font-size: 12px;
  font-weight: 900;
  text-transform: uppercase;
}

h1 {
  margin-top: 4px;
  font-size: clamp(34px, 6vw, 68px);
  line-height: 0.9;
}

header span,
#hintValue {
  color: var(--muted);
}

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
  aspect-ratio: 16 / 9;
  min-height: 340px;
  background: #020302;
}

strong {
  color: var(--accent);
  font-size: 18px;
}

@media (max-width: 680px) {
  header,
  footer {
    align-items: flex-start;
    flex-direction: column;
  }
}
`;
}

function towerDefenseScript(theme) {
  return `const canvas = document.querySelector("#gameCanvas");
const ctx = canvas.getContext("2d");
const scoreEl = document.querySelector("#scoreValue");
const bestEl = document.querySelector("#bestValue");
const restartButton = document.querySelector("#restartButton");
const accent = "${theme.accent}";
const secondary = "${theme.secondary}";
const cell = 72;
const state = { score: 0, best: Number(localStorage.getItem("pulseTowerBest") || 0), lives: 8, cash: 80, towers: [], enemies: [], shots: [], tick: 0, over: false };

function reset() {
  state.score = 0;
  state.lives = 8;
  state.cash = 80;
  state.towers = [];
  state.enemies = [];
  state.shots = [];
  state.tick = 0;
  state.over = false;
}

function spawnEnemy() {
  state.enemies.push({ x: -30, y: canvas.height * 0.58 + Math.sin(state.tick * 0.03) * 80, hp: 40 + state.score * 0.08, max: 40 + state.score * 0.08, speed: 0.8 + state.score * 0.002 });
}

function update() {
  if (!state.over) {
    state.tick += 1;
    if (state.tick % 62 === 0) spawnEnemy();
    state.enemies.forEach(enemy => { enemy.x += enemy.speed; });
    state.enemies = state.enemies.filter(enemy => {
      if (enemy.x > canvas.width + 40) {
        state.lives -= 1;
        if (state.lives <= 0) finish();
        return false;
      }
      return enemy.hp > 0;
    });
    state.towers.forEach(tower => {
      tower.cooldown -= 1;
      const target = state.enemies.find(enemy => Math.hypot(enemy.x - tower.x, enemy.y - tower.y) < 190);
      if (target && tower.cooldown <= 0) {
        tower.cooldown = 28;
        state.shots.push({ x: tower.x, y: tower.y, target, life: 12 });
        target.hp -= 14;
        if (target.hp <= 0) {
          state.score += 25;
          state.cash += 12;
        }
      }
    });
    state.shots.forEach(shot => { shot.life -= 1; });
    state.shots = state.shots.filter(shot => shot.life > 0);
  }
  draw();
  requestAnimationFrame(update);
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#020302";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "rgba(201,255,47,.08)";
  for (let x = 0; x < canvas.width; x += cell) for (let y = 0; y < canvas.height; y += cell) ctx.strokeRect(x, y, cell, cell);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(0, canvas.height * .58);
  ctx.bezierCurveTo(230, 200, 420, 430, 630, 290);
  ctx.bezierCurveTo(760, 210, 820, 380, canvas.width, 330);
  ctx.stroke();
  state.towers.forEach(tower => {
    ctx.fillStyle = accent;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 16;
    ctx.fillRect(tower.x - 14, tower.y - 14, 28, 28);
    ctx.shadowBlur = 0;
  });
  state.enemies.forEach(enemy => {
    ctx.fillStyle = secondary;
    ctx.fillRect(enemy.x - 14, enemy.y - 14, 28, 28);
    ctx.fillStyle = accent;
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
  if (state.over) centerText("DEFENSE LOST", "Click Restart to try again");
  scoreEl.textContent = state.score;
  bestEl.textContent = state.best;
}

function finish() {
  state.over = true;
  state.best = Math.max(state.best, state.score);
  localStorage.setItem("pulseTowerBest", state.best);
}

function centerText(title, sub) {
  ctx.fillStyle = "rgba(2,3,2,.68)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = "center";
  ctx.fillStyle = accent;
  ctx.font = "900 54px system-ui";
  ctx.fillText(title, canvas.width / 2, canvas.height / 2 - 14);
  ctx.fillStyle = "#f2f8ef";
  ctx.font = "700 20px system-ui";
  ctx.fillText(sub, canvas.width / 2, canvas.height / 2 + 26);
  ctx.textAlign = "left";
}

canvas.addEventListener("pointerdown", event => {
  if (state.over) return;
  const rect = canvas.getBoundingClientRect();
  const x = (event.clientX - rect.left) * canvas.width / rect.width;
  const y = (event.clientY - rect.top) * canvas.height / rect.height;
  if (state.cash >= 30 && !state.towers.some(tower => Math.hypot(tower.x - x, tower.y - y) < 42)) {
    state.cash -= 30;
    state.towers.push({ x, y, cooldown: 0 });
  }
});
restartButton.addEventListener("click", reset);
reset();
update();`;
}

function jumperScript(theme) {
  return `const canvas = document.querySelector("#gameCanvas");
const ctx = canvas.getContext("2d");
const scoreEl = document.querySelector("#scoreValue");
const bestEl = document.querySelector("#bestValue");
const restartButton = document.querySelector("#restartButton");
const accent = "${theme.accent}";
const secondary = "${theme.secondary}";
const player = { x: 150, y: 0, size: 34, vy: 0, jumps: 0 };
const state = { score: 0, best: Number(localStorage.getItem("skyHopBest") || 0), speed: 4, platforms: [], orbs: [], over: false };

function reset() {
  player.y = canvas.height - 120;
  player.vy = 0;
  player.jumps = 0;
  state.score = 0;
  state.speed = 4;
  state.over = false;
  state.platforms = [{ x: 80, y: canvas.height - 70, w: 240 }, { x: 380, y: 390, w: 170 }, { x: 680, y: 310, w: 190 }];
  state.orbs = [{ x: 460, y: 350 }, { x: 760, y: 270 }];
}

function jump() {
  if (state.over) { reset(); return; }
  if (player.jumps < 2) {
    player.vy = -12;
    player.jumps += 1;
  }
}

function update() {
  if (!state.over) {
    player.vy += 0.55;
    player.y += player.vy;
    state.speed += 0.001;
    state.score += 1;
    state.platforms.forEach(platform => { platform.x -= state.speed; });
    state.orbs.forEach(orb => { orb.x -= state.speed; });
    for (const platform of state.platforms) {
      const onTop = player.x + player.size > platform.x && player.x < platform.x + platform.w && player.y + player.size > platform.y - 10 && player.y + player.size < platform.y + 18 && player.vy >= 0;
      if (onTop) {
        player.y = platform.y - player.size;
        player.vy = 0;
        player.jumps = 0;
      }
    }
    state.orbs = state.orbs.filter(orb => {
      if (Math.hypot(orb.x - (player.x + 17), orb.y - (player.y + 17)) < 34) {
        state.score += 80;
        return false;
      }
      return orb.x > -40;
    });
    state.platforms = state.platforms.filter(platform => platform.x + platform.w > -30);
    while (state.platforms.length < 4) {
      const last = state.platforms[state.platforms.length - 1];
      const y = 260 + Math.random() * 220;
      state.platforms.push({ x: last.x + last.w + 160 + Math.random() * 160, y, w: 130 + Math.random() * 140 });
      if (Math.random() > 0.35) state.orbs.push({ x: last.x + last.w + 240, y: y - 46 });
    }
    if (player.y > canvas.height + 80) finish();
  }
  draw();
  requestAnimationFrame(update);
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#020302";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "rgba(201,255,47,.09)";
  for (let x = 0; x < canvas.width; x += 58) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x - 180, canvas.height);
    ctx.stroke();
  }
  state.platforms.forEach(platform => {
    ctx.fillStyle = accent;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 14;
    ctx.fillRect(platform.x, platform.y, platform.w, 8);
    ctx.shadowBlur = 0;
  });
  state.orbs.forEach(orb => {
    ctx.fillStyle = secondary;
    ctx.beginPath();
    ctx.arc(orb.x, orb.y, 13, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.fillStyle = accent;
  ctx.fillRect(player.x, player.y, player.size, player.size);
  if (state.over) centerText("FELL OUT", "Press Space or tap to restart");
  scoreEl.textContent = state.score;
  bestEl.textContent = state.best;
}

function finish() {
  state.over = true;
  state.best = Math.max(state.best, state.score);
  localStorage.setItem("skyHopBest", state.best);
}

function centerText(title, sub) {
  ctx.fillStyle = "rgba(2,3,2,.68)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = "center";
  ctx.fillStyle = accent;
  ctx.font = "900 54px system-ui";
  ctx.fillText(title, canvas.width / 2, canvas.height / 2 - 14);
  ctx.fillStyle = "#f2f8ef";
  ctx.font = "700 20px system-ui";
  ctx.fillText(sub, canvas.width / 2, canvas.height / 2 + 26);
  ctx.textAlign = "left";
}

canvas.addEventListener("pointerdown", jump);
window.addEventListener("keydown", event => {
  if (event.code === "Space" || event.code === "ArrowUp") {
    event.preventDefault();
    jump();
  }
});
restartButton.addEventListener("click", reset);
reset();
update();`;
}

function paddleScript(theme) {
  return `const canvas = document.querySelector("#gameCanvas");
const ctx = canvas.getContext("2d");
const scoreEl = document.querySelector("#scoreValue");
const bestEl = document.querySelector("#bestValue");
const restartButton = document.querySelector("#restartButton");
const accent = "${theme.accent}";
const secondary = "${theme.secondary}";
const paddle = { x: 420, y: 494, w: 130, h: 16 };
const ball = { x: 480, y: 420, r: 12, vx: 5, vy: -5 };
const state = { score: 0, best: Number(localStorage.getItem("glowPaddleBest") || 0), bricks: [], over: false };

function reset() {
  state.score = 0;
  state.over = false;
  paddle.x = 420;
  ball.x = 480;
  ball.y = 420;
  ball.vx = 5;
  ball.vy = -5;
  state.bricks = [];
  for (let row = 0; row < 5; row += 1) {
    for (let col = 0; col < 10; col += 1) {
      state.bricks.push({ x: 74 + col * 82, y: 70 + row * 34, w: 66, h: 18, alive: true });
    }
  }
}

function update() {
  if (!state.over) {
    ball.x += ball.vx;
    ball.y += ball.vy;
    if (ball.x < ball.r || ball.x > canvas.width - ball.r) ball.vx *= -1;
    if (ball.y < ball.r) ball.vy *= -1;
    if (ball.y > canvas.height + 40) finish();
    if (ball.x > paddle.x && ball.x < paddle.x + paddle.w && ball.y + ball.r > paddle.y && ball.y - ball.r < paddle.y + paddle.h && ball.vy > 0) {
      ball.vy *= -1;
      ball.vx += (ball.x - (paddle.x + paddle.w / 2)) * 0.035;
    }
    state.bricks.forEach(brick => {
      if (!brick.alive) return;
      const hit = ball.x + ball.r > brick.x && ball.x - ball.r < brick.x + brick.w && ball.y + ball.r > brick.y && ball.y - ball.r < brick.y + brick.h;
      if (hit) {
        brick.alive = false;
        ball.vy *= -1;
        state.score += 15;
      }
    });
    if (state.bricks.every(brick => !brick.alive)) {
      state.score += 250;
      resetBricks();
    }
  }
  draw();
  requestAnimationFrame(update);
}

function resetBricks() {
  state.bricks.forEach(brick => { brick.alive = true; });
  ball.vy = -Math.abs(ball.vy) - 0.5;
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#020302";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "rgba(201,255,47,.1)";
  for (let y = 38; y < canvas.height; y += 42) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
  state.bricks.forEach((brick, index) => {
    if (!brick.alive) return;
    ctx.fillStyle = index % 2 ? accent : secondary;
    ctx.fillRect(brick.x, brick.y, brick.w, brick.h);
  });
  ctx.fillStyle = accent;
  ctx.shadowColor = accent;
  ctx.shadowBlur = 16;
  ctx.fillRect(paddle.x, paddle.y, paddle.w, paddle.h);
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  if (state.over) centerText("BALL LOST", "Move paddle or restart");
  scoreEl.textContent = state.score;
  bestEl.textContent = state.best;
}

function finish() {
  state.over = true;
  state.best = Math.max(state.best, state.score);
  localStorage.setItem("glowPaddleBest", state.best);
}

function centerText(title, sub) {
  ctx.fillStyle = "rgba(2,3,2,.68)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = "center";
  ctx.fillStyle = accent;
  ctx.font = "900 54px system-ui";
  ctx.fillText(title, canvas.width / 2, canvas.height / 2 - 14);
  ctx.fillStyle = "#f2f8ef";
  ctx.font = "700 20px system-ui";
  ctx.fillText(sub, canvas.width / 2, canvas.height / 2 + 26);
  ctx.textAlign = "left";
}

canvas.addEventListener("pointermove", event => {
  const rect = canvas.getBoundingClientRect();
  paddle.x = (event.clientX - rect.left) * canvas.width / rect.width - paddle.w / 2;
});
canvas.addEventListener("touchmove", event => {
  const rect = canvas.getBoundingClientRect();
  paddle.x = (event.touches[0].clientX - rect.left) * canvas.width / rect.width - paddle.w / 2;
}, { passive: true });
window.addEventListener("keydown", event => {
  if (event.code === "ArrowLeft") paddle.x -= 32;
  if (event.code === "ArrowRight") paddle.x += 32;
});
restartButton.addEventListener("click", reset);
reset();
update();`;
}

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}
