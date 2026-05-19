const canvas = document.querySelector("#gameCanvas");
const ctx = canvas.getContext("2d");
const scoreEl = document.querySelector("#scoreValue");
const bestEl = document.querySelector("#bestValue");
const restartButton = document.querySelector("#restartButton");
const accent = "#5dff8a";
const secondary = "#ff5df7";
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
update();