const canvas = document.querySelector("#gameCanvas");
const ctx = canvas.getContext("2d");
const resetPreviewButton = document.querySelector("#resetPreviewButton");
const gamePreview = document.querySelector("#gamePreview");
const agentLog = document.querySelector("#agentLog");
const stageLabel = document.querySelector("#stageLabel");
const stageTitle = document.querySelector("#stageTitle");
const agentDialogue = document.querySelector("#agentDialogue");
const statusPill = document.querySelector("#statusPill");
const statusText = document.querySelector("#statusText");
const categoryValue = document.querySelector("#categoryValue");
const controlsValue = document.querySelector("#controlsValue");
const zipDownload = document.querySelector("#zipDownload");
const previewButtons = document.querySelectorAll("[data-category]");
const customGameButton = document.querySelector("#customGameButton");
const customPromptPanel = document.querySelector("#customPromptPanel");
const customGamePrompt = document.querySelector("#customGamePrompt");
const publishCustomButton = document.querySelector("#publishCustomButton");
const publishedLink = document.querySelector("#publishedLink");

const state = {
  playerY: 0,
  velocity: 0,
  gravity: 0.58,
  jump: -10.8,
  score: 0,
  speed: 4.4,
  obstacles: [],
  particles: [],
  gameOver: false,
  lastTime: 0,
  jumpsUsed: 0,
  request: null,
  traceTimer: null
};

const floorY = () => canvas.height - 74;
const player = {
  x: 118,
  size: 34
};

const setLog = (message) => {
  agentLog.textContent = message;
};

const setStatus = (label, busy = false) => {
  statusText.textContent = label;
  statusPill.classList.toggle("busy", busy);
};

const cleanTraceText = (value) => String(value || "").replace(/\s+/g, " ").trim();

const traceLine = (speaker, text, stateName = "") => ({ speaker, text, stateName });

const setAgentTrace = (lines, activeIndex = lines.length - 1) => {
  agentDialogue.replaceChildren();

  lines.forEach((line, index) => {
    const item = document.createElement("span");
    item.className = "agent-line";
    if (index === activeIndex) item.classList.add("active");
    if (line.stateName) item.classList.add(line.stateName);

    const step = document.createElement("span");
    step.className = "trace-step";
    step.textContent = String(index + 1).padStart(2, "0");

    const body = document.createElement("span");
    body.className = "trace-body";

    const speaker = document.createElement("strong");
    speaker.textContent = `${line.speaker}:`;
    body.append(speaker, ` ${line.text}`);
    item.append(step, body);
    agentDialogue.append(item);
  });
};

const stopAgentTraceAnimation = () => {
  if (state.traceTimer) {
    clearInterval(state.traceTimer);
    state.traceTimer = null;
  }
};

const animateAgentTrace = (lines) => {
  stopAgentTraceAnimation();
  let active = 0;
  setAgentTrace(lines, active);
  state.traceTimer = setInterval(() => {
    active = Math.min(active + 1, lines.length - 1);
    setAgentTrace(lines, active);
    if (active === lines.length - 1) stopAgentTraceAnimation();
  }, 650);
};

const normalizeTrace = (preview, fallbackPrompt = "") => {
  if (Array.isArray(preview.agentTrace) && preview.agentTrace.length > 0) {
    return preview.agentTrace.map((line, index) => traceLine(
      line.speaker || (index === 0 ? "User" : "Agent"),
      line.text || String(line),
      index === preview.agentTrace.length - 1 ? "done" : ""
    ));
  }

  return [
    traceLine("User", fallbackPrompt ? cleanTraceText(fallbackPrompt) : "Random preview request"),
    traceLine("Agent", `Selected ${labelFor(preview.category)} and built ${preview.title}.`, "done")
  ];
};

const buildPendingTrace = (prompt, mode) => [
  traceLine("User", prompt ? cleanTraceText(prompt) : "Random preview request"),
  traceLine("Agent", mode === "publish" ? "Parsing prompt into game rules and visual direction." : "Picking a fresh playable 2D pattern."),
  traceLine("Agent", "Choosing canvas sprites, color theme, controls, and scoring loop."),
  traceLine("Agent", mode === "publish" ? "Packing files and publishing to StoryClaw /static/games/." : "Packing index.html, styles.css, and script.js for preview.")
];

const resetGame = () => {
  state.playerY = floorY() - player.size;
  state.velocity = 0;
  state.score = 0;
  state.speed = 4.4;
  state.obstacles = [
    { x: canvas.width + 80, width: 34, height: 76 },
    { x: canvas.width + 430, width: 48, height: 112 }
  ];
  state.particles = [];
  state.gameOver = false;
  state.lastTime = performance.now();
  state.jumpsUsed = 0;
};

const jump = () => {
  if (!gamePreview.hidden) return;

  if (state.gameOver) {
    resetGame();
    return;
  }

  if (state.jumpsUsed < 2) {
    state.velocity = state.jump;
    state.jumpsUsed += 1;
  }
};

const drawGrid = (time) => {
  ctx.strokeStyle = "rgba(201, 255, 47, 0.12)";
  ctx.lineWidth = 1;

  for (let x = -80; x < canvas.width + 80; x += 54) {
    const offset = (time * 0.04) % 54;
    ctx.beginPath();
    ctx.moveTo(x - offset, 0);
    ctx.lineTo(x - offset - 180, canvas.height);
    ctx.stroke();
  }

  for (let y = 70; y < canvas.height; y += 70) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
};

const drawPlayer = () => {
  const x = player.x;
  const y = state.playerY;
  const size = player.size;

  ctx.shadowColor = "#c9ff2f";
  ctx.shadowBlur = 20;
  ctx.fillStyle = "#c9ff2f";
  ctx.fillRect(x, y, size, size);
  ctx.shadowBlur = 0;

  ctx.fillStyle = "#061005";
  ctx.fillRect(x + 9, y + 9, 6, 6);
  ctx.fillRect(x + 22, y + 9, 6, 6);
};

const drawObstacle = (obstacle) => {
  const y = floorY() - obstacle.height;
  ctx.shadowColor = "#5dff8a";
  ctx.shadowBlur = 18;
  ctx.fillStyle = "#5dff8a";
  ctx.fillRect(obstacle.x, y, obstacle.width, obstacle.height);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(6, 16, 5, 0.64)";
  ctx.fillRect(obstacle.x + 8, y + 10, obstacle.width - 16, obstacle.height - 20);
};

const drawParticles = () => {
  state.particles.forEach((particle) => {
    ctx.globalAlpha = particle.life;
    ctx.fillStyle = particle.color;
    ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
  });
  ctx.globalAlpha = 1;
};

const checkCollision = (obstacle) => {
  const playerRight = player.x + player.size;
  const playerBottom = state.playerY + player.size;
  const obstacleTop = floorY() - obstacle.height;

  return (
    player.x < obstacle.x + obstacle.width &&
    playerRight > obstacle.x &&
    state.playerY < floorY() &&
    playerBottom > obstacleTop
  );
};

const updateGame = (time) => {
  const delta = Math.min((time - state.lastTime) / 16.67, 2);
  state.lastTime = time;

  if (!state.gameOver) {
    state.velocity += state.gravity * delta;
    state.playerY += state.velocity * delta;

    if (state.playerY > floorY() - player.size) {
      state.playerY = floorY() - player.size;
      state.velocity = 0;
      state.jumpsUsed = 0;
    }

    state.speed += 0.0026 * delta;
    state.score += Math.round(delta);

    state.obstacles.forEach((obstacle) => {
      obstacle.x -= state.speed * delta;
      if (checkCollision(obstacle)) {
        state.gameOver = true;
      }
    });

    state.obstacles = state.obstacles.filter((obstacle) => obstacle.x + obstacle.width > -20);

    if (state.obstacles.length < 3) {
      const lastX = state.obstacles.length ? state.obstacles[state.obstacles.length - 1].x : canvas.width;
      state.obstacles.push({
        x: Math.max(canvas.width + 80, lastX + 260 + Math.random() * 190),
        width: 30 + Math.random() * 30,
        height: 58 + Math.random() * 90
      });
    }

    state.particles.push({
      x: player.x - 12,
      y: state.playerY + player.size - 5,
      size: 4 + Math.random() * 5,
      life: 1,
      color: Math.random() > 0.5 ? "#c9ff2f" : "#5dff8a"
    });
  }

  state.particles.forEach((particle) => {
    particle.x -= (state.speed + 2) * delta;
    particle.life -= 0.036 * delta;
  });
  state.particles = state.particles.filter((particle) => particle.life > 0);
};

const drawGame = (time) => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "#020302");
  gradient.addColorStop(0.58, "#071009");
  gradient.addColorStop(1, "#020302");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawGrid(time);

  ctx.fillStyle = "rgba(201, 255, 47, 0.92)";
  ctx.fillRect(0, floorY(), canvas.width, 4);
  ctx.fillStyle = "rgba(201, 255, 47, 0.08)";
  ctx.fillRect(0, floorY() + 4, canvas.width, canvas.height - floorY());

  drawParticles();
  state.obstacles.forEach(drawObstacle);
  drawPlayer();

  if (state.gameOver) {
    ctx.fillStyle = "rgba(2, 3, 2, 0.68)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#c9ff2f";
    ctx.font = "900 56px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("DEMO OVER", canvas.width / 2, canvas.height / 2 - 18);
    ctx.fillStyle = "#f2f8ef";
    ctx.font = "700 22px Inter, sans-serif";
    ctx.fillText("Click or press Space to restart", canvas.width / 2, canvas.height / 2 + 28);
    ctx.textAlign = "left";
  }
};

const loop = (time) => {
  if (gamePreview.hidden) {
    updateGame(time);
    drawGame(time);
  }
  requestAnimationFrame(loop);
};

const setButtonsDisabled = (disabled) => {
  previewButtons.forEach((button) => {
    button.disabled = disabled;
  });
};

const showDemo = () => {
  gamePreview.hidden = true;
  gamePreview.removeAttribute("src");
  canvas.hidden = false;
  stageLabel.textContent = "Agent preview";
  stageTitle.textContent = "Neon Dash";
  categoryValue.textContent = "Demo";
  controlsValue.textContent = "Space / tap to double jump.";
  zipDownload.href = "#";
  zipDownload.classList.add("disabled");
  zipDownload.setAttribute("aria-disabled", "true");
  publishedLink.href = "#";
  publishedLink.classList.add("disabled");
  publishedLink.setAttribute("aria-disabled", "true");
  setStatus("Agent ready");
  setAgentTrace([traceLine("Agent", "等待你的 prompt 或随机生成指令。", "active")], 0);
  setLog("Demo reset. 输入 prompt 后，生成过程会显示在左侧标题区域。");
  resetGame();
};

const renderGeneratedPreview = (preview, sourcePrompt = "") => {
  stopAgentTraceAnimation();
  canvas.hidden = true;
  gamePreview.hidden = false;
  gamePreview.src = `${preview.previewUrl}?t=${Date.now()}`;
  stageLabel.textContent = "Generated by preview agent";
  stageTitle.textContent = preview.title;
  categoryValue.textContent = labelFor(preview.category);
  controlsValue.textContent = preview.controls;
  zipDownload.href = preview.zipUrl;
  zipDownload.classList.remove("disabled");
  zipDownload.removeAttribute("aria-disabled");
  publishedLink.href = preview.hubUrl || preview.publishedUrl || preview.previewUrl;
  publishedLink.classList.remove("disabled");
  publishedLink.removeAttribute("aria-disabled");
  setStatus("Preview ready");
  setAgentTrace(normalizeTrace(preview, sourcePrompt));
  setLog(`Generated ${preview.title}. Zip contains: ${preview.files.join(", ")}.`);
};

const generatePreview = async (category) => {
  if (state.request) {
    state.request.abort();
  }

  state.request = new AbortController();
  setButtonsDisabled(true);
  setStatus("Generating", true);
  animateAgentTrace(buildPendingTrace("", "preview"));
  setLog("后端正在生成三文件 zip，并解压到预览目录...");

  try {
    const response = await fetch("/api/generate-preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category }),
      signal: state.request.signal
    });

    if (!response.ok) {
      throw new Error(`Preview generation failed: ${response.status}`);
    }

    renderGeneratedPreview(await response.json());
  } catch (error) {
    if (error.name !== "AbortError") {
      stopAgentTraceAnimation();
      setStatus("Error");
      setAgentTrace([traceLine("Agent", error.message, "error")], 0);
      setLog(error.message);
    }
  } finally {
    setButtonsDisabled(false);
    state.request = null;
  }
};

const labelFor = (category) => {
  const labels = {
    "asteroid-dodge": "Asteroid Dodge",
    "orb-collector": "Orb Collector",
    "target-clicker": "Target Clicker",
    "snake-trail": "Snake Trail",
    "lane-runner": "Lane Runner",
    "orbit-guard": "Orbit Guard",
    "paddle-breaker": "Paddle Breaker",
    "pong-duel": "Pong Duel",
    "billiards-break": "Billiards Break",
    "sky-jumper": "Sky Jumper",
    "pulse-defense": "Pulse Defense"
  };
  return labels[category] || "Random";
};

const toggleCustomPrompt = () => {
  customPromptPanel.hidden = !customPromptPanel.hidden;
  if (!customPromptPanel.hidden) {
    customGamePrompt.focus();
    setAgentTrace([
      traceLine("User", "在右侧输入 game prompt。"),
      traceLine("Agent", "我会把 prompt 转成玩法、标题、素材和发布页面。", "active")
    ], 1);
    setLog("输入你的游戏想法，会生成一个独立页面并发布到 StoryClaw hub 的 /static/games/ 路径。");
  }
};

const publishCustomGame = async (event) => {
  event.preventDefault();
  const prompt = customGamePrompt.value.trim();

  if (!prompt) {
    setAgentTrace([traceLine("Agent", "先写一句你想生成的游戏 prompt。", "error")], 0);
    setLog("先写一句你想生成的游戏 prompt。");
    customGamePrompt.focus();
    return;
  }

  publishCustomButton.disabled = true;
  setStatus("Publishing", true);
  animateAgentTrace(buildPendingTrace(prompt, "publish"));
  setLog("正在根据 prompt 生成游戏，并写入 StoryClaw hub public 目录...");

  try {
    const response = await fetch("/api/publish-custom-game", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt })
    });

    if (!response.ok) {
      throw new Error(`Custom publish failed: ${response.status}`);
    }

    const result = await response.json();
    const publicUrl = result.hubUrl || result.publishedUrl || result.subdomainUrl || result.previewUrl;
    renderGeneratedPreview(result, prompt);
    gamePreview.src = `${publicUrl}?t=${Date.now()}`;
    publishedLink.href = publicUrl;
    setStatus("Published");
    setLog(`Published ${result.title} to StoryClaw hub: ${publicUrl}`);
  } catch (error) {
    stopAgentTraceAnimation();
    setStatus("Error");
    setAgentTrace([traceLine("Agent", error.message, "error")], 0);
    setLog(error.message);
  } finally {
    publishCustomButton.disabled = false;
  }
};

canvas.addEventListener("pointerdown", jump);
window.addEventListener("keydown", (event) => {
  if (event.code === "Space" || event.code === "ArrowUp") {
    event.preventDefault();
    jump();
  }
});
resetPreviewButton.addEventListener("click", showDemo);
previewButtons.forEach((button) => {
  button.addEventListener("click", () => generatePreview(button.dataset.category));
});
customGameButton.addEventListener("click", toggleCustomPrompt);
customPromptPanel.addEventListener("submit", publishCustomGame);

resetGame();
requestAnimationFrame(loop);
