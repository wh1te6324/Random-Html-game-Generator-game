import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const workspaceRoot = path.resolve(repoRoot, "..");

const DEFAULT_MODEL = "openai/gpt-5.5";
const DEFAULT_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const MAX_CONTEXT_CHARS = 64000;
const REQUIRED_FILES = ["index.html", "styles.css", "script.js"];

const guidanceFiles = [
  path.join(repoRoot, "README.md"),
  path.join(workspaceRoot, "html-game-agent", "IDENTITY.md"),
  path.join(workspaceRoot, "html-game-agent", "STUDIO_WORKFLOW.md"),
  path.join(workspaceRoot, "html-game-agent", "SUBAGENT_ARCHITECTURE.md"),
  path.join(workspaceRoot, "html-game-agent", ".claude", "agents", "producer.md"),
  path.join(workspaceRoot, "html-game-agent", ".claude", "agents", "creative-director.md"),
  path.join(workspaceRoot, "html-game-agent", ".claude", "agents", "game-designer.md"),
  path.join(workspaceRoot, "html-game-agent", ".claude", "agents", "systems-designer.md"),
  path.join(workspaceRoot, "html-game-agent", ".claude", "agents", "ux-designer.md"),
  path.join(workspaceRoot, "html-game-agent", ".claude", "agents", "art-director.md"),
  path.join(workspaceRoot, "html-game-agent", ".claude", "agents", "visual-development-artist.md"),
  path.join(workspaceRoot, "html-game-agent", ".claude", "agents", "asset-designer.md"),
  path.join(workspaceRoot, "html-game-agent", ".claude", "agents", "vfx-artist.md"),
  path.join(workspaceRoot, "html-game-agent", ".claude", "agents", "ui-hud-artist.md"),
  path.join(workspaceRoot, "html-game-agent", ".claude", "agents", "technical-artist.md"),
  path.join(workspaceRoot, "html-game-agent", ".claude", "agents", "gameplay-programmer.md"),
  path.join(workspaceRoot, "html-game-agent", ".claude", "agents", "qa-playtester.md"),
  path.join(workspaceRoot, "html-game-agent", "SOUL.md"),
  path.join(workspaceRoot, "html-game-agent", "AGENTS.md"),
  path.join(workspaceRoot, "html-game-agent", "USER.md")
];

export function isStoryClawModelConfigured() {
  return Boolean(process.env.STORYCLAW_OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY);
}

export async function generateGameWithStoryClawModel({ prompt, id, semanticSpec, promptProfile }) {
  const apiKey = process.env.STORYCLAW_OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  const endpoint = process.env.STORYCLAW_OPENROUTER_BASE_URL || process.env.OPENROUTER_BASE_URL || DEFAULT_ENDPOINT;
  const model = process.env.STORYCLAW_GAME_MODEL || process.env.OPENROUTER_GAME_MODEL || DEFAULT_MODEL;
  const guidance = await loadGuidanceContext();
  const requestPrompt = buildGenerationPrompt({ prompt, id, semanticSpec, promptProfile, guidance });

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.STORYCLAW_SITE_URL || "http://127.0.0.1:4180",
      "X-Title": "StoryClaw AI Mini Game Lab"
    },
    body: JSON.stringify({
      model,
      temperature: Number(process.env.STORYCLAW_GAME_TEMPERATURE || 0.72),
      max_tokens: Number(process.env.STORYCLAW_GAME_MAX_TOKENS || 12000),
      messages: [
        {
          role: "system",
          content: [
            "You are StoryClaw's high-parameter HTML mini-game generator.",
            "Generate a complete, playable, prompt-native browser game.",
            "Return only strict JSON. No markdown fences, no prose outside JSON."
          ].join(" ")
        },
        { role: "user", content: requestPrompt }
      ],
      response_format: { type: "json_object" }
    })
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`StoryClaw model request failed: ${response.status} ${detail.slice(0, 240)}`);
  }

  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  if (!content) throw new Error("StoryClaw model returned an empty message.");
  return normalizeModelGame(JSON.parse(extractJson(content)), { model });
}

async function loadGuidanceContext() {
  const chunks = [];
  for (const filePath of guidanceFiles) {
    try {
      const body = await readFile(filePath, "utf8");
      chunks.push(`--- ${path.relative(workspaceRoot, filePath)} ---\n${body.trim()}`);
    } catch {
      // Optional guidance files are skipped when this repo is deployed alone.
    }
  }
  return chunks.join("\n\n").slice(0, MAX_CONTEXT_CHARS);
}

function buildGenerationPrompt({ prompt, id, semanticSpec, promptProfile, guidance }) {
  const userPrompt = String(prompt || "").trim() || "Create a surprising polished prompt-native browser mini game.";
  return [
    "Use the following local repository markdown as the generation constitution.",
    "Keep its studio workflow, prompt-native design, zip contract, visual quality bar, and anti-template rules.",
    "",
    guidance,
    "",
    "Current semantic pre-pass from the website:",
    JSON.stringify({
      id,
      prompt: userPrompt,
      summary: promptProfile?.summary,
      semanticSpec
    }, null, 2),
    "",
    "Return exactly this JSON shape:",
    JSON.stringify({
      title: "short game title",
      modeLabel: "short gameplay family / verb-first label",
      genreLabel: "same or more specific gameplay label",
      controls: "brief controls sentence",
      promptSummary: "one-sentence summary",
      files: {
        "index.html": "<!doctype html>...",
        "styles.css": "...",
        "script.js": "..."
      },
      agentTrace: [
        { speaker: "Creative Director", text: "concise step", stateName: "done" }
      ],
      generationNotes: [
        "model-generated via StoryClaw/OpenRouter relay"
      ]
    }, null, 2),
    "",
    "Hard requirements:",
    "- files must contain exactly index.html, styles.css, and script.js.",
    "- Use vanilla HTML/CSS/JavaScript. The final game must not rely on external CDNs, hotlinked images, analytics, tracking, or runtime network calls.",
    "- If visual references or generated assets are used, recreate or embed them as self-contained Canvas/SVG/CSS/data-URI assets inside the three files.",
    "- The generated game must be playable immediately inside an iframe.",
    "- It must include a clear objective, immediate input response, HUD/status, success or failure/completion state, and restart.",
    "- Preserve the requested game family instead of reskinning a generic avoid/collect loop.",
    "- Keep text readable on mobile and desktop."
  ].join("\n");
}

function normalizeModelGame(value, { model }) {
  if (!value || typeof value !== "object") {
    throw new Error("StoryClaw model JSON was not an object.");
  }

  const files = value.files && typeof value.files === "object" ? value.files : {};
  const fileNames = Object.keys(files).sort();
  const expected = [...REQUIRED_FILES].sort();
  if (JSON.stringify(fileNames) !== JSON.stringify(expected)) {
    throw new Error(`StoryClaw model must return exactly ${REQUIRED_FILES.join(", ")}.`);
  }

  const normalizedFiles = {};
  for (const fileName of REQUIRED_FILES) {
    const content = files[fileName];
    if (typeof content !== "string" || content.trim().length < 20) {
      throw new Error(`StoryClaw model returned an invalid ${fileName}.`);
    }
    normalizedFiles[fileName] = content.trimStart();
  }

  if (!/<!doctype html>|<html[\s>]/i.test(normalizedFiles["index.html"])) {
    throw new Error("StoryClaw model index.html is not a complete HTML document.");
  }

  const trace = Array.isArray(value.agentTrace)
    ? value.agentTrace.map((item) => ({
      speaker: String(item?.speaker || "Agent"),
      text: String(item?.text || "").slice(0, 360),
      stateName: String(item?.stateName || "")
    })).filter((item) => item.text)
    : [];

  return {
    title: String(value.title || "StoryClaw HTML Game").slice(0, 80),
    modeLabel: String(value.modeLabel || value.genreLabel || "Prompt-Native Game").slice(0, 96),
    genreLabel: String(value.genreLabel || value.modeLabel || "Prompt-Native Game").slice(0, 96),
    controls: String(value.controls || "Use keyboard, pointer, or touch controls shown in game.").slice(0, 220),
    promptSummary: String(value.promptSummary || "Model-generated prompt-native browser game.").slice(0, 240),
    files: normalizedFiles,
    agentTrace: trace.length ? trace : [
      { speaker: "StoryClaw Relay", text: `Generated playable three-file game with ${model}.`, stateName: "done" }
    ],
    generationNotes: Array.isArray(value.generationNotes)
      ? value.generationNotes.map((item) => String(item)).slice(0, 8)
      : [`model=${model}`, "source=storyclaw-openrouter-relay"]
  };
}

function extractJson(content) {
  const text = String(content || "").trim();
  if (text.startsWith("{")) return text;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) return text.slice(start, end + 1);
  throw new Error("StoryClaw model response did not contain JSON.");
}
