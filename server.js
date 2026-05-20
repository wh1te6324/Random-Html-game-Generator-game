import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { copyFile, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPreviewGameZip, extractGameZip, slugify } from "./src/preview-agent.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "public");
const generatedDir = path.join(__dirname, "generated-games");
const previewsDir = path.join(publicDir, "previews");
const port = Number(process.env.PORT || 4180);
const host = process.env.HOST || "127.0.0.1";
const clawHubPublicDir = process.env.CLAW_HUB_PUBLIC_DIR || path.join(os.homedir(), ".claw", "hub", "public");
const clawHubOrigin = (process.env.CLAW_HUB_PUBLIC_ORIGIN || process.env.CLAW_DEVICE_ORIGIN || "http://127.0.0.1:3000").replace(/\/$/, "");

await mkdir(generatedDir, { recursive: true });
await mkdir(previewsDir, { recursive: true });

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);

    if (request.method === "POST" && url.pathname === "/api/generate-preview") {
      await handleGenerate(request, response);
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/publish-custom-game") {
      await handlePublishCustom(request, response);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/previews") {
      await handleList(response);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/health") {
      sendJson(response, 200, {
        status: "ok",
        app: "random-html-game-generator",
        hubPublicDir: clawHubPublicDir
      });
      return;
    }

    await serveStatic(url.pathname, response);
  } catch (error) {
    sendJson(response, 500, { error: error.message || "Unexpected server error" });
  }
});

server.listen(port, host, () => {
  console.log(`Preview generator running at http://${host}:${port}/`);
  console.log(`StoryClaw hub public dir: ${clawHubPublicDir}`);
});

async function handleGenerate(request, response) {
  const body = await readJson(request);
  const category = body.category || "random";
  const prompt = String(body.prompt || "").trim();
  const id = `${slugify(category)}-${Date.now().toString(36)}-${randomUUID().slice(0, 6)}`;
  const gameDir = path.join(generatedDir, id);
  const unpackDir = path.join(previewsDir, id);

  await mkdir(gameDir, { recursive: true });
  await mkdir(unpackDir, { recursive: true });

  const result = await createPreviewGameZip({ category, id, outputDir: gameDir, prompt });
  const extractedFiles = await extractGameZip(result.zipPath, unpackDir);

  sendJson(response, 200, {
    id,
    title: result.title,
    category: result.category,
    zipUrl: `/generated-games/${id}/${id}.zip`,
    previewUrl: `/previews/${id}/index.html`,
    files: extractedFiles,
    controls: result.controls,
    promptSummary: result.promptSummary,
    agentTrace: result.agentTrace
  });
}

async function handlePublishCustom(request, response) {
  const body = await readJson(request);
  const prompt = String(body.prompt || "").trim();

  if (!prompt) {
    sendJson(response, 400, { error: "Prompt is required." });
    return;
  }

  const category = inferCategoryFromPrompt(prompt);
  const seed = Math.floor(Math.random() * 900000) + 100000;
  const slug = createGamePathSlug(category, seed);
  const id = `${category}-${seed}-${Date.now().toString(36)}-${randomUUID().slice(0, 6)}`;
  const gameDir = path.join(generatedDir, id);
  const unpackDir = path.join(previewsDir, id);

  await mkdir(gameDir, { recursive: true });
  await mkdir(unpackDir, { recursive: true });

  const result = await createPreviewGameZip({ category, id, outputDir: gameDir, prompt });
  const extractedFiles = await extractGameZip(result.zipPath, unpackDir);
  const hubPublish = await publishToClawHub({
    slug,
    id,
    prompt,
    title: result.title,
    controls: result.controls,
    category: result.category,
    sourceDir: unpackDir,
    zipPath: result.zipPath,
    agentTrace: result.agentTrace
  });

  sendJson(response, 200, {
    id,
    slug,
    title: result.title,
    category: result.category,
    prompt,
    zipUrl: `/generated-games/${id}/${id}.zip`,
    previewUrl: `/previews/${id}/index.html`,
    hubUrl: hubPublish.publicUrl,
    publishedUrl: hubPublish.publicUrl,
    hubPath: hubPublish.hubPath,
    files: extractedFiles,
    controls: result.controls,
    promptSummary: result.promptSummary,
    agentTrace: result.agentTrace
  });
}

async function handleList(response) {
  const items = [];
  const entries = await readdir(generatedDir, { withFileTypes: true }).catch(() => []);

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const metaPath = path.join(generatedDir, entry.name, "manifest.json");
    try {
      items.push(JSON.parse(await readFile(metaPath, "utf8")));
    } catch {
      // Ignore partial generations.
    }
  }

  items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  sendJson(response, 200, { items });
}

async function serveStatic(pathname, response) {
  const normalized = pathname === "/" ? "/index.html" : decodeURIComponent(pathname);
  const isHubFile = normalized.startsWith("/static/");
  const isGeneratedFile = normalized.startsWith("/generated-games/");
  const root = isHubFile ? clawHubPublicDir : isGeneratedFile ? __dirname : publicDir;
  const relativePath = isHubFile ? normalized.slice("/static".length) || "/index.html" : normalized;
  const absolutePath = path.resolve(root, `.${relativePath}`);

  if (!isInsideDirectory(root, absolutePath)) {
    sendText(response, 403, "Forbidden");
    return;
  }

  try {
    const fileStat = await stat(absolutePath);
    if (fileStat.isDirectory()) {
      await serveStatic(`${normalized.replace(/\/$/, "")}/index.html`, response);
      return;
    }
  } catch {
    sendText(response, 404, "Not found");
    return;
  }

  response.writeHead(200, {
    "Content-Type": contentType(path.extname(absolutePath)),
    "Cache-Control": "no-store"
  });
  response.end(await readFile(absolutePath));
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

function sendText(response, statusCode, text) {
  response.writeHead(statusCode, { "Content-Type": "text/plain; charset=utf-8" });
  response.end(text);
}

function inferCategoryFromPrompt(prompt) {
  const value = prompt.toLowerCase();
  const rules = [
    ["pong-duel", ["pong", "\u4e52\u4e53", "\u5bf9\u6253", "\u53cc\u4eba\u5f39\u7403"]],
    ["billiards-break", ["billiard", "pool", "\u53f0\u7403", "\u684c\u7403", "\u649e\u7403", "\u7403\u888b", "\u6bcd\u7403", "8 ball", "eight ball"]],
    ["snake-trail", ["snake", "\u8d2a\u5403\u86c7", "trail", "\u8f68\u8ff9"]],
    ["pulse-defense", ["tower", "defense", "\u5854\u9632", "\u9632\u5b88", "\u70ae\u5854"]],
    ["sky-jumper", ["jump", "platform", "\u8df3\u8dc3", "\u5e73\u53f0", "\u8dd1\u9177"]],
    ["target-clicker", ["click", "tap", "\u70b9\u51fb", "\u53cd\u5e94", "\u5c04\u51fb", "\u6253\u9776"]],
    ["orb-collector", ["collect", "coin", "orb", "\u6536\u96c6", "\u91d1\u5e01", "\u5b9d\u77f3"]],
    ["lane-runner", ["lane", "runner", "\u8d5b\u9053", "\u6362\u9053", "\u8eb2\u907f"]],
    ["orbit-guard", ["orbit", "shield", "\u8f68\u9053", "\u62a4\u76fe", "\u73af\u7ed5"]]
  ];

  const match = rules.find(([, keywords]) => keywords.some((keyword) => value.includes(keyword)));
  return match ? match[0] : "asteroid-dodge";
}

function createGamePathSlug(category, seed) {
  const codes = {
    "asteroid-dodge": "dodge",
    "orb-collector": "orb",
    "target-clicker": "tap",
    "snake-trail": "snake",
    "lane-runner": "lane",
    "orbit-guard": "orbit",
    "paddle-breaker": "paddle",
    "pong-duel": "pong",
    "billiards-break": "pool",
    "sky-jumper": "jump",
    "pulse-defense": "tower"
  };
  return `${codes[category] || "game"}-${Number(seed).toString(36)}`;
}

async function publishToClawHub({ slug, id, prompt, title, controls, category, sourceDir, zipPath, agentTrace = [] }) {
  const publishId = `${slug}-${id.split("-").slice(-2).join("-")}`;
  const relativeDir = `games/${publishId}`;
  const targetDir = path.join(clawHubPublicDir, relativeDir);
  const gameDir = path.join(targetDir, "game");
  const safeTitle = escapeHtml(title);
  const safePrompt = escapeHtml(prompt);
  const safeControls = escapeHtml(controls);
  const safeCategory = escapeHtml(category);
  const safeTraceHtml = agentTrace.map((line) =>
    `<li><strong>${escapeHtml(line.speaker || "Agent")}:</strong> ${escapeHtml(line.text || "")}</li>`
  ).join("");

  await mkdir(gameDir, { recursive: true });
  await copyFile(path.join(sourceDir, "index.html"), path.join(gameDir, "index.html"));
  await copyFile(path.join(sourceDir, "styles.css"), path.join(gameDir, "styles.css"));
  await copyFile(path.join(sourceDir, "script.js"), path.join(gameDir, "script.js"));
  await copyFile(zipPath, path.join(targetDir, `${publishId}.zip`));

  await writeFile(path.join(targetDir, "index.html"), buildPublishedPage({
    safeTitle,
    safePrompt,
    safeControls,
    safeCategory,
    safeTraceHtml,
    publishId
  }), "utf8");

  const hubPath = `/static/${relativeDir}/index.html`;
  return {
    publishId,
    hubPath,
    publicUrl: `${clawHubOrigin}${hubPath}`,
    targetDir
  };
}

function buildPublishedPage({ safeTitle, safePrompt, safeControls, safeCategory, safeTraceHtml, publishId }) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${safeTitle} - StoryClaw Game</title>
    <style>
      :root { color-scheme: dark; --neon: #c9ff2f; --cyan: #75f4ff; --ink: #f2f8ef; --muted: #96a397; }
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; background: linear-gradient(rgba(201,255,47,.045) 1px, transparent 1px), linear-gradient(90deg, rgba(117,244,255,.035) 1px, transparent 1px), #020302; background-size: 44px 44px, 44px 44px, auto; color: var(--ink); font-family: Inter, system-ui, sans-serif; }
      main { min-height: 100vh; display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: 22px; padding: 22px; }
      .stage, .panel { border: 1px solid rgba(201,255,47,.24); border-radius: 8px; background: rgba(8,13,9,.86); box-shadow: 0 28px 80px rgba(0,0,0,.46); overflow: hidden; }
      header { padding: 18px; border-bottom: 1px solid rgba(201,255,47,.18); }
      p, h1 { margin: 0; }
      .eyebrow { color: var(--neon); font-size: 12px; font-weight: 900; text-transform: uppercase; }
      h1 { margin-top: 6px; color: var(--ink); font-size: clamp(34px, 6vw, 72px); line-height: .92; }
      iframe { display: block; width: 100%; height: calc(100vh - 160px); min-height: 620px; border: 0; background: #020302; }
      .panel { display: grid; align-content: start; gap: 16px; padding: 20px; }
      .panel p { color: var(--muted); line-height: 1.6; }
      label { display: grid; gap: 8px; color: var(--muted); font-size: 12px; font-weight: 900; text-transform: uppercase; }
      textarea { width: 100%; min-height: 150px; resize: vertical; border: 1px solid rgba(201,255,47,.22); border-radius: 8px; padding: 12px; background: rgba(3,4,3,.78); color: var(--ink); line-height: 1.55; }
      ol { display: grid; gap: 8px; margin: 0; padding: 12px 12px 12px 30px; border: 1px solid rgba(117,244,255,.18); border-radius: 8px; background: rgba(117,244,255,.06); color: var(--muted); line-height: 1.45; }
      ol strong { color: var(--cyan); }
      button, a { min-height: 48px; border-radius: 8px; border: 1px solid var(--neon); display: inline-flex; align-items: center; justify-content: center; padding: 0 14px; background: var(--neon); color: #061005; font-weight: 900; text-decoration: none; font: inherit; }
      .ghost { background: rgba(117,244,255,.09); color: var(--cyan); border-color: var(--cyan); }
      output { color: #f8dfff; min-height: 42px; padding: 12px; border: 1px solid rgba(255,79,216,.18); border-radius: 8px; background: rgba(255,79,216,.055); }
      @media (max-width: 980px) { main { grid-template-columns: 1fr; } iframe { min-height: 500px; height: 66vh; } }
    </style>
  </head>
  <body>
    <main>
      <section class="stage">
        <header>
          <p class="eyebrow">StoryClaw published game / ${safeCategory}</p>
          <h1>${safeTitle}</h1>
        </header>
        <iframe src="./game/index.html" title="${safeTitle}" sandbox="allow-scripts allow-same-origin allow-pointer-lock"></iframe>
      </section>
      <aside class="panel">
        <div>
          <p class="eyebrow">Create another game</p>
          <h2>Generate your own game</h2>
          <p>This page was published to the StoryClaw static hub. Use the prompt below as the starting point for another game.</p>
        </div>
        <label>
          Game prompt
          <textarea id="prompt">${safePrompt}</textarea>
        </label>
        <ol>${safeTraceHtml}</ol>
        <button id="copyPrompt" type="button">Copy prompt</button>
        <a class="ghost" href="./${publishId}.zip">Download zip</a>
        <output id="status">Controls: ${safeControls}</output>
      </aside>
    </main>
    <script>
      document.querySelector("#copyPrompt").addEventListener("click", async () => {
        await navigator.clipboard.writeText(document.querySelector("#prompt").value);
        document.querySelector("#status").textContent = "Prompt copied.";
      });
    </script>
  </body>
</html>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function contentType(extname) {
  const map = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".zip": "application/zip",
    ".ico": "image/x-icon"
  };
  return map[extname] || "application/octet-stream";
}

function isInsideDirectory(root, target) {
  const relative = path.relative(path.resolve(root), target);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}
