const canvas = document.querySelector("#gameCanvas");
const ctx = canvas.getContext("2d");
const scoreEl = document.querySelector("#scoreValue");
const bestEl = document.querySelector("#bestValue");
const restartButton = document.querySelector("#restartButton");
const accent = "#75f4ff";
const secondary = "#ff5df7";
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
update();