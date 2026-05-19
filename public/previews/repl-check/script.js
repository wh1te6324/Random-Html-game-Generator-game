const canvas = document.querySelector("#gameCanvas");
const ctx = canvas.getContext("2d");
const scoreEl = document.querySelector("#scoreValue");
const bestEl = document.querySelector("#bestValue");
const restartButton = document.querySelector("#restartButton");
const accent = "#c9ff2f";
const secondary = "#8bffbf";
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
update();