import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPreviewGameZip, extractGameZip, slugify } from "./src/preview-agent.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "public");
const generatedDir = path.join(__dirname, "generated-games");
const previewsDir = path.join(publicDir, "previews");
const port = Number(process.env.PORT || 4180);

await mkdir(generatedDir, { recursive: true });
await mkdir(previewsDir, { recursive: true });

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);

    if (request.method === "POST" && url.pathname === "/api/generate-preview") {
      await handleGenerate(request, response);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/previews") {
      await handleList(response);
      return;
    }

    await serveStatic(url.pathname, response);
  } catch (error) {
    sendJson(response, 500, { error: error.message || "Unexpected server error" });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Preview generator running at http://127.0.0.1:${port}/`);
});

async function handleGenerate(request, response) {
  const body = await readJson(request);
  const category = body.category || "random";
  const id = `${slugify(category)}-${Date.now().toString(36)}-${randomUUID().slice(0, 6)}`;
  const gameDir = path.join(generatedDir, id);
  const unpackDir = path.join(previewsDir, id);

  await mkdir(gameDir, { recursive: true });
  await mkdir(unpackDir, { recursive: true });

  const result = await createPreviewGameZip({ category, id, outputDir: gameDir });
  const extractedFiles = await extractGameZip(result.zipPath, unpackDir);

  sendJson(response, 200, {
    id,
    title: result.title,
    category: result.category,
    zipUrl: `/generated-games/${id}/${id}.zip`,
    previewUrl: `/previews/${id}/index.html`,
    files: extractedFiles,
    controls: result.controls
  });
}

async function handleList(response) {
  const items = [];
  const entries = await readdir(generatedDir, { withFileTypes: true }).catch(() => []);

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const metaPath = path.join(generatedDir, entry.name, "manifest.json");
    try {
      const meta = JSON.parse(await readFile(metaPath, "utf8"));
      items.push(meta);
    } catch {
      // Ignore partial generations.
    }
  }

  items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  sendJson(response, 200, { items });
}

async function serveStatic(pathname, response) {
  const normalized = pathname === "/" ? "/index.html" : decodeURIComponent(pathname);
  const root = normalized.startsWith("/generated-games/") ? __dirname : publicDir;
  const absolutePath = path.resolve(root, `.${normalized}`);

  if (!absolutePath.startsWith(root)) {
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

  const content = await readFile(absolutePath);
  response.writeHead(200, {
    "Content-Type": contentType(path.extname(absolutePath)),
    "Cache-Control": "no-store"
  });
  response.end(content);
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

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

function contentType(extname) {
  const map = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".zip": "application/zip"
  };
  return map[extname] || "application/octet-stream";
}

process.on("SIGINT", async () => {
  await rm(path.join(generatedDir, ".lock"), { force: true }).catch(() => {});
  process.exit(0);
});
