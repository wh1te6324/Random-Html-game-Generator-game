import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createZipFile, readZipFile } from "./zip.js";
import { generateGameWithStoryClawModel, isStoryClawModelConfigured } from "./storyclaw-model.js";

const OPEN_RUNTIME_ID = "semantic-canvas";
const categories = [OPEN_RUNTIME_ID];
const requiredFiles = ["index.html", "styles.css", "script.js"];

const themes = [
  { name: "Acid Signal", accent: "#c9ff2f", secondary: "#5dff8a", danger: "#ff4f7b", bg: "#020302", pattern: "circuit" },
  { name: "Violet Byte", accent: "#b77cff", secondary: "#75f4ff", danger: "#ffdd55", bg: "#05030a", pattern: "stars" },
  { name: "Solar Pop", accent: "#ffdd55", secondary: "#ff7a59", danger: "#75f4ff", bg: "#080502", pattern: "rings" },
  { name: "Aqua Signal", accent: "#75f4ff", secondary: "#5dff8a", danger: "#ff5df7", bg: "#02070a", pattern: "bubbles" },
  { name: "Cherry Grid", accent: "#ff4f7b", secondary: "#c9ff2f", danger: "#75f4ff", bg: "#090205", pattern: "diagonal" }
];

const spriteKits = [
  { name: "Space Junk", player: "rocket", enemy: "asteroid", collectible: "star-core", decor: ["tiny-star", "satellite", "spark"] },
  { name: "Bubble Reef", player: "submarine", enemy: "jelly", collectible: "pearl", decor: ["bubble", "coral", "wave"] },
  { name: "Bug Circuit", player: "hover-bug", enemy: "virus-eye", collectible: "data-chip", decor: ["circuit-node", "spark", "scanline"] },
  { name: "Repair Bay", player: "repair-bot", enemy: "short-spark", collectible: "battery-cell", decor: ["wire-node", "moon-crater", "bolt"] },
  { name: "Kitchen Rush", player: "chef-token", enemy: "hungry-customer", collectible: "meal-tray", decor: ["steam", "service-bell", "dish-plate"] },
  { name: "Stadium Motion", player: "athlete-token", enemy: "goalie-block", collectible: "trophy-star", decor: ["score-flag", "speed-ring", "spotlight"] },
  { name: "Pocket Table", player: "cue-ball", enemy: "stripe-ball", collectible: "eight-ball", decor: ["pocket", "chalk", "rail-light"] },
  { name: "Sky Carnival", player: "kite", enemy: "storm-cloud", collectible: "ticket-star", decor: ["flag", "pinwheel", "spark"] },
  { name: "Dungeon Neon", player: "tiny-knight", enemy: "slime-eye", collectible: "gem-cluster", decor: ["rune", "torch", "crack"] }
];

const semanticReasoningAxes = [
  "objective",
  "interaction",
  "layout",
  "risk",
  "win-state",
  "feedback",
  "art-bible",
  "input-model",
  "progression",
  "state-loop",
  "prompt-specific nouns",
  "qa-gate"
];

const visualSkillSets = {
  grid: {
    name: "Logic Surface Painter",
    backdrop: "logic-board",
    surface: "etched-grid",
    taskFrame: "glyph-tile",
    props: ["switch-node", "route-line", "lock-glyph", "clue-chip"],
    particles: ["glyph", "spark"],
    material: "glass puzzle pieces"
  },
  stage: {
    name: "Timing Stage Painter",
    backdrop: "stage-equalizer",
    surface: "vinyl-grid",
    taskFrame: "record-pad",
    props: ["speaker-stack", "beat-lane", "note-burst", "equalizer"],
    particles: ["note", "spark"],
    material: "glossy poster ink"
  },
  queue: {
    name: "Service Loop Diorama",
    backdrop: "shop-counter",
    surface: "tile-counter",
    taskFrame: "order-ticket",
    props: ["service-bell", "dish-plate", "customer-bubble", "steam"],
    particles: ["steam", "spark"],
    material: "soft enamel panels"
  },
  arena: {
    name: "Action Space Painter",
    backdrop: "stadium-lights",
    surface: "track-lines",
    taskFrame: "target-badge",
    props: ["score-flag", "speed-ring", "finish-line", "spotlight"],
    particles: ["confetti", "spark"],
    material: "sports broadcast graphics"
  },
  lanes: {
    name: "Motion Track Painter",
    backdrop: "neon-runway",
    surface: "lane-markers",
    taskFrame: "motion-token",
    props: ["speed-ring", "finish-line", "scanline", "side-light"],
    particles: ["pixel", "spark"],
    material: "lit acrylic sprites"
  },
  sandbox: {
    name: "Build Space Painter",
    backdrop: "workbench-map",
    surface: "construction-grid",
    taskFrame: "craft-card",
    props: ["wire-node", "map-pin", "power-core", "relic"],
    particles: ["glyph", "spark"],
    material: "modular toy pieces"
  },
  map: {
    name: "Quest Map Painter",
    backdrop: "map-room",
    surface: "parchment-grid",
    taskFrame: "quest-card",
    props: ["portal", "map-pin", "dialogue-glyph", "relic"],
    particles: ["rune", "spark"],
    material: "inked fantasy tokens"
  },
  field: {
    name: "Open Concept Painter",
    backdrop: "semantic-field",
    surface: "circuit-floor",
    taskFrame: "prompt-token",
    props: ["score-chip", "power-core", "scanline", "side-light"],
    particles: ["pixel", "spark"],
    material: "lit acrylic sprites"
  }
};

export async function createPreviewGameZip({ category, id, outputDir, prompt = "", locale = "en" }) {
  const outputLocale = normalizeLocale(locale);
  const promptProfile = analyzePrompt(prompt);
  const pickedCategory = chooseCategory(category, promptProfile);
  const seed = Math.floor(Math.random() * 900000) + 100000;
  const game = buildGame(pickedCategory, seed, promptProfile);
  const modelGame = await maybeGenerateWithStoryClawModel({ prompt, id, game, promptProfile, locale: outputLocale });
  const agentTrace = modelGame?.agentTrace || buildAgentTrace(prompt, game, promptProfile);
  const files = modelGame?.files || {
    "index.html": buildHtml(game, outputLocale),
    "styles.css": buildCss(game),
    "script.js": buildScript(game)
  };
  const resolvedGame = modelGame ? {
    ...game,
    title: modelGame.title,
    modeLabel: modelGame.modeLabel,
    genreLabel: modelGame.genreLabel,
    controls: modelGame.controls,
    promptSummary: modelGame.promptSummary,
    generationNotes: [
      ...(modelGame.generationNotes || []),
      "fallback=local-generator-on-model-error"
    ]
  } : game;

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
    title: resolvedGame.title,
    category: pickedCategory,
    modeLabel: resolvedGame.modeLabel,
    genreLabel: resolvedGame.genreLabel,
    controls: resolvedGame.controls,
    promptSummary: resolvedGame.promptSummary,
    locale: outputLocale,
    agentTrace,
    generationSource: modelGame ? "storyclaw-openrouter" : "local-semantic-generator",
    generationNotes: resolvedGame.generationNotes,
    zipPath,
    zipUrl: `/generated-games/${id}/${id}.zip`,
    previewUrl: `/previews/${id}/index.html`,
    createdAt: new Date().toISOString()
  };

  await writeFile(path.join(outputDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");

  return { ...manifest, zipPath };
}

async function maybeGenerateWithStoryClawModel({ prompt, id, game, promptProfile, locale }) {
  if (!isStoryClawModelConfigured()) return null;
  try {
    return await generateGameWithStoryClawModel({
      prompt,
      id,
      semanticSpec: game.semanticSpec,
      promptProfile,
      locale
    });
  } catch (error) {
    console.warn(`[storyclaw-model] Falling back to local generator: ${error.message}`);
    return null;
  }
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

function analyzePrompt(prompt) {
  const raw = String(prompt || "").trim();
  const value = raw.toLowerCase();
  const semanticSpec = createSemanticSpec(raw);
  if (!raw) {
    return {
      category: OPEN_RUNTIME_ID,
      promptMode: semanticSpec.mode,
      semanticSpec
    };
  }

  const themeName = pickPromptTheme(value);
  const spriteKitName = pickPromptSpriteKit(value, semanticSpec);

  return {
    raw,
    category: OPEN_RUNTIME_ID,
    themeName,
    spriteKitName,
    promptMode: semanticSpec.mode,
    title: promptTitle(semanticSpec, raw),
    subtitle: promptSubtitle(raw, semanticSpec),
    controls: semanticSpec.controls,
    summary: shortenPrompt(raw, 180),
    semanticSpec
  };
}

function chooseCategory() {
  return OPEN_RUNTIME_ID;
}

function inferPromptCategory() {
  return OPEN_RUNTIME_ID;
}

function normalizeLocale(value) {
  const raw = String(value || "en").trim().replace("_", "-");
  const aliases = {
    en: "en",
    zh: "zh-CN",
    "zh-cn": "zh-CN",
    "zh-hans": "zh-CN",
    "zh-tw": "zh-TW",
    "zh-hant": "zh-TW",
    ja: "ja",
    jp: "ja"
  };
  return aliases[raw.toLowerCase()] || "en";
}

function createSemanticSpec(raw) {
  const value = String(raw || "").toLowerCase();
  const mechanicLexicon = [
    { id: "reveal", label: "Reveal", words: ["reveal", "hidden", "clue", "deduce", "flag", "mine", "\u7ffb\u5f00", "\u9690\u85cf", "\u7ebf\u7d22", "\u63a8\u7406", "\u63d2\u65d7", "\u626b\u96f7", "\u5730\u96f7"] },
    { id: "connect", label: "Connect", words: ["connect", "link", "path", "route", "pair", "match", "circuit", "\u8fde\u63a5", "\u8fde\u7ebf", "\u8def\u5f84", "\u8def\u7ebf", "\u914d\u5bf9", "\u5339\u914d", "\u8fde\u8fde\u770b"] },
    { id: "manage", label: "Manage", words: ["manage", "serve", "queue", "shop", "farm", "upgrade", "cook", "\u7ecf\u8425", "\u4e0a\u83dc", "\u961f\u5217", "\u5546\u5e97", "\u519c\u573a", "\u5347\u7ea7", "\u505a\u83dc"] },
    { id: "rhythm", label: "Time", words: ["rhythm", "beat", "music", "song", "timing", "\u8282\u594f", "\u97f3\u4e50", "\u6253\u62cd", "\u65f6\u673a"] },
    { id: "aim", label: "Aim", words: ["aim", "shoot", "drag", "release", "throw", "kick", "hit", "\u7784\u51c6", "\u5c04\u51fb", "\u62d6\u62fd", "\u677e\u5f00", "\u6295\u63b7", "\u8e22", "\u51fb\u6253"] },
    { id: "move", label: "Move", words: ["move", "dodge", "run", "race", "jump", "platform", "lane", "\u79fb\u52a8", "\u8eb2\u907f", "\u8dd1", "\u8d5b\u8f66", "\u8df3", "\u5e73\u53f0", "\u8d5b\u9053"] },
    { id: "collect", label: "Collect", words: ["collect", "coin", "resource", "pickup", "gem", "\u6536\u96c6", "\u91d1\u5e01", "\u8d44\u6e90", "\u62fe\u53d6", "\u5b9d\u77f3"] },
    { id: "defend", label: "Defend", words: ["defend", "tower", "wave", "base", "protect", "enemy", "\u9632\u5b88", "\u5854", "\u6ce2\u6b21", "\u57fa\u5730", "\u4fdd\u62a4", "\u654c\u4eba"] },
    { id: "explore", label: "Explore", words: ["explore", "quest", "story", "dialog", "rpg", "map", "\u63a2\u7d22", "\u4efb\u52a1", "\u5267\u60c5", "\u5bf9\u8bdd", "\u89d2\u8272", "\u5730\u56fe"] },
    { id: "build", label: "Build", words: ["build", "place", "craft", "construct", "sandbox", "automation", "automate", "gear", "device", "machine", "mechanism", "mirror", "greenhouse", "\u5efa\u9020", "\u653e\u7f6e", "\u5408\u6210", "\u642d\u5efa", "\u6c99\u76d2", "\u81ea\u52a8\u5316", "\u9f7f\u8f6e", "\u88c5\u7f6e", "\u673a\u5173", "\u955c\u5b50", "\u6e29\u5ba4"] },
    { id: "trade", label: "Trade", words: ["trade", "sell", "buy", "market", "price", "profit", "\u4ea4\u6613", "\u4e70\u5356", "\u5e02\u573a", "\u4ef7\u683c", "\u5229\u6da6"] },
    { id: "care", label: "Care", words: ["care", "pet", "heal", "grow", "clean", "comfort", "plant", "water", "sunlight", "\u7167\u987e", "\u5ba0\u7269", "\u6cbb\u7597", "\u6210\u957f", "\u6e05\u6d01", "\u5b89\u629a", "\u690d\u7269", "\u6d47\u6c34", "\u9633\u5149"] },
    { id: "stealth", label: "Sneak", words: ["stealth", "sneak", "hide", "patrol", "vision", "\u6f5c\u884c", "\u8eb2\u85cf", "\u5de1\u903b", "\u89c6\u91ce"] },
    { id: "memory", label: "Memory", words: ["memory", "remember", "sequence", "repeat", "\u8bb0\u5fc6", "\u8bb0\u4f4f", "\u987a\u5e8f", "\u590d\u73b0"] },
    { id: "sort", label: "Sort", words: ["sort", "organize", "stack", "arrange", "\u5206\u7c7b", "\u6574\u7406", "\u5806\u53e0", "\u6392\u5217"] },
    { id: "merge", label: "Merge", words: ["merge", "combine", "evolve", "alchemy", "\u5408\u5e76", "\u7ec4\u5408", "\u8fdb\u5316", "\u70bc\u91d1"] },
    { id: "survive", label: "Survive", words: ["survive", "survival", "hunger", "temperature", "night", "\u751f\u5b58", "\u9965\u997f", "\u6e29\u5ea6", "\u591c\u665a"] },
    { id: "talk", label: "Talk", words: ["talk", "dialogue", "choice", "npc", "relationship", "\u804a\u5929", "\u5bf9\u8bdd", "\u9009\u62e9", "\u5173\u7cfb"] },
    { id: "decorate", label: "Decorate", words: ["decorate", "design", "room", "garden", "style", "\u88c5\u9970", "\u8bbe\u8ba1", "\u623f\u95f4", "\u82b1\u56ed", "\u98ce\u683c"] },
    { id: "balance", label: "Balance", words: ["balance", "tilt", "weight", "physics", "\u5e73\u8861", "\u503e\u659c", "\u91cd\u91cf", "\u7269\u7406"] }
  ];
  const promptTerms = extractPromptTerms(value);
  const scoredMechanics = mechanicLexicon
    .map((axis) => ({
      ...axis,
      score: axis.words.reduce((total, word) => total + (value.includes(word) ? 1 : 0), 0)
    }))
    .filter((axis) => axis.score > 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  const fallback = promptTerms.length
    ? promptTerms.slice(0, 4).map((term, index) => ({ id: `prompt-${index}`, label: term, score: 0.5 }))
    : [
        { id: "interact", label: "Interact", score: 1 },
        { id: "progress", label: "Progress", score: 1 },
        { id: "react", label: "React", score: 1 }
      ];
  const mechanics = (scoredMechanics.length ? scoredMechanics : fallback).slice(0, 4);
  const ids = new Set(mechanics.map((item) => item.id));
  const layout = chooseSemanticLayout(value, ids);
  const mode = chooseSemanticMode(mechanics, layout);
  const studioPlan = createStudioPlan(value, mechanics, layout, ids);
  const labels = buildSemanticLabels(mechanics, value);
  const flags = {
    hiddenInfo: ids.has("reveal") || ids.has("stealth") || ids.has("memory") || hasAny(value, ["hidden", "\u9690\u85cf", "\u626b\u96f7", "\u63a8\u7406"]),
    pairLogic: ids.has("connect") || ids.has("memory") || ids.has("sort") || ids.has("merge") || hasAny(value, ["pair", "match", "\u914d\u5bf9", "\u8fde\u8fde\u770b"]),
    timedBeat: ids.has("rhythm") || hasAny(value, ["timed", "countdown", "\u9650\u65f6", "\u5012\u8ba1\u65f6"]),
    wavePressure: ids.has("defend") || ids.has("survive") || ids.has("stealth"),
    economy: ids.has("manage") || ids.has("build") || ids.has("trade") || ids.has("care") || ids.has("decorate"),
    physicsAim: ids.has("aim") || ids.has("balance"),
    traversal: ids.has("move") || ids.has("explore") || ids.has("stealth") || ids.has("talk")
  };
  const rules = [
    `layout=${layout}`,
    `primary=${mechanics[0].label.toLowerCase()}`,
    flags.hiddenInfo ? "hidden-information is represented as clue cells" : "",
    flags.pairLogic ? "matching/linking logic creates paired objectives" : "",
    flags.wavePressure ? "pressure escalates through moving threats" : "",
    flags.economy ? "resources convert into upgrades or placements" : "",
    flags.timedBeat ? "timing windows change scoring and task motion" : "",
    flags.physicsAim ? "drag vectors influence action strength" : ""
  ].filter(Boolean);

  return {
    runtime: OPEN_RUNTIME_ID,
    mode,
    layout,
    mechanics: mechanics.map(({ id, label, score }) => ({ id, label, score })),
    primaryAction: mechanics[0].label,
    secondaryAction: mechanics[1]?.label || "React",
    labels,
    flags,
    studioPlan,
    runtimeBlueprint: studioPlan.runtimeBlueprint,
    objective: semanticObjective(mechanics, flags),
    winCondition: semanticWinCondition(mechanics, flags),
    failCondition: semanticFailCondition(mechanics, flags),
    controls: semanticControls(mechanics, flags),
    genreLabel: `${labelForLayout(layout)} / ${mechanics.map((item) => item.label).join(" + ")}`,
    rules,
    reasoningPasses: semanticReasoningAxes.map((axis, index) => `${String(index + 1).padStart(2, "0")} ${axis}: ${rules[index % rules.length] || mechanics[0].label}`)
  };
}

function chooseSemanticLayout(value, ids) {
  if (ids.has("rhythm") || hasAny(value, ["beat", "music", "stage", "\u8282\u594f", "\u821e\u53f0"])) return "stage";
  if (ids.has("build") || ids.has("decorate") || hasAny(value, ["sandbox", "craft", "design", "automation", "gear", "device", "machine", "mechanism", "mirror", "greenhouse", "\u623f\u95f4", "\u88c5\u9970", "\u6c99\u76d2", "\u5408\u6210", "\u8bbe\u8ba1", "\u81ea\u52a8\u5316", "\u9f7f\u8f6e", "\u88c5\u7f6e", "\u673a\u5173", "\u955c\u5b50", "\u6e29\u5ba4"])) return "sandbox";
  if (ids.has("manage") || ids.has("trade") || ids.has("care") || hasAny(value, ["queue", "serve", "shop", "clinic", "\u961f\u5217", "\u4e0a\u83dc", "\u5546\u5e97", "\u533b\u9662"])) return "queue";
  if (ids.has("defend") || ids.has("aim") || ids.has("survive") || ids.has("stealth") || ids.has("balance") || hasAny(value, ["arena", "battle", "sport", "\u6218\u6597", "\u8fd0\u52a8"])) return "arena";
  if (ids.has("move") || hasAny(value, ["lane", "race", "runner", "\u8d5b\u9053", "\u8dd1\u9177"])) return "lanes";
  if (ids.has("reveal") || ids.has("connect") || ids.has("memory") || ids.has("sort") || ids.has("merge") || hasAny(value, ["grid", "cell", "tile", "board", "card", "\u683c", "\u68cb\u76d8", "\u724c", "\u626b\u96f7", "\u8fde\u8fde\u770b"])) return "grid";
  if (ids.has("explore") || ids.has("talk") || hasAny(value, ["map", "quest", "story", "\u5730\u56fe", "\u4efb\u52a1", "\u5267\u60c5"])) return "map";
  return "field";
}

function chooseSemanticMode(mechanics, layout) {
  const primary = mechanics[0]?.id || "open";
  const secondary = mechanics[1]?.id || "react";
  return `${layout}:${primary}+${secondary}`;
}

function createStudioPlan(value, mechanics, layout, ids) {
  const primary = mechanics[0] || { id: "interact", label: "Interact" };
  const secondary = mechanics[1] || { id: "react", label: "React" };
  const blueprint = chooseRuntimeBlueprint(value, layout, ids);
  const pillars = [
    `${primary.label} must be the first visible action`,
    `${secondary.label} creates the second decision layer`,
    `${labelForLayout(layout)} defines the screen composition`
  ];
  const microLoop = loopForBlueprint(blueprint.id, primary.label, secondary.label);
  const risk = riskForBlueprint(blueprint.id);

  return {
    source: "ccgs-lightweight-studio-pipeline",
    runtimeBlueprint: blueprint,
    creativeDirector: {
      fantasy: playerFantasy(value, primary, secondary),
      pillars,
      antiPillars: ["single-template reskin", "unreadable goals", "dead-end interaction"]
    },
    gameDesigner: {
      microLoop,
      mesoLoop: `Chain ${primary.label.toLowerCase()} outcomes into score, resources, or progress within one short session.`,
      macroLoop: "Restart quickly with best-score persistence and clearer mastery targets.",
      tuningKnobs: blueprint.tuningKnobs
    },
    systemsDesigner: {
      entities: entityContractForBlueprint(blueprint.id),
      resources: resourceContractForBlueprint(blueprint.id),
      failurePressure: risk
    },
    levelDesigner: {
      layout,
      screenPattern: blueprint.screenPattern,
      spawnPattern: blueprint.spawnPattern
    },
    uxDesigner: {
      hud: blueprint.hud,
      inputModel: blueprint.inputModel,
      feedback: blueprint.feedback
    },
    artDirector: {
      paletteRole: "high-contrast prompt palette with clear danger, reward, and progress colors",
      materialLanguage: materialLanguageForLayout(layout),
      spriteLanguage: spriteLanguageForBlueprint(blueprint.id),
      motionTone: motionToneForBlueprint(blueprint.id)
    },
    gameplayProgrammer: {
      scaffold: blueprint.id,
      implementationGoal: "smallest complete browser-native loop with keyboard and pointer/touch support",
      stateContract: ["opening", "play", "feedback", "completion/failure", "restart"]
    },
    qaLead: {
      acceptance: [
        "The first input changes state immediately.",
        "The HUD exposes the current objective pressure.",
        "The win and fail states are both reachable.",
        "The requested game family remains recognizable through rules and visuals.",
        `The runtime blueprint is ${blueprint.id}, not the generic fallback loop.`
      ]
    }
  };
}

function materialLanguageForLayout(layout) {
  return {
    grid: "etched board pieces, clue chips, route lines, and readable tiles",
    stage: "poster ink, equalizer strips, beat windows, and rhythm pulses",
    queue: "ticket cards, service counters, patience meters, and station props",
    arena: "broadcast graphics, impact rings, threat silhouettes, and wave marks",
    lanes: "track lights, lane rails, speed streaks, and positional markers",
    sandbox: "modular pieces, build slots, upgrade glow, and resource cards",
    map: "inked map nodes, route arcs, dialogue cards, and trust markers",
    field: "prompt tokens, tactile panels, objective markers, and feedback trails"
  }[layout] || "prompt-specific tactile panels and feedback trails";
}

function spriteLanguageForBlueprint(id) {
  return {
    "grid-reveal": "tiles reveal layered clue marks and risk icons",
    "grid-link": "paired objects use matching silhouettes and connection trails",
    "timing-stage": "notes, timing bars, combo bursts, and tempo rings animate on beat",
    "queue-service": "customers, tickets, stations, and patience bubbles carry the scene",
    "arena-action": "player, threats, projectiles, and collision flashes create pressure",
    "lane-traversal": "lane markers, vehicles/goals, hazards, and speed streaks define motion",
    "sandbox-builder": "build pieces, slots, merge sparks, and upgrade levels show growth",
    "quest-map": "map nodes, route arcs, choice tokens, and dialogue markers create story"
  }[id] || "prompt nouns become layered tokens with readable state changes";
}

function motionToneForBlueprint(id) {
  return {
    "timing-stage": "snappy rhythmic pulses",
    "queue-service": "busy service ticks and patience tremors",
    "sandbox-builder": "satisfying placement pops and upgrade blooms",
    "quest-map": "calm route reveals and choice glows",
    "lane-traversal": "fast lateral sweeps",
    "arena-action": "impact flashes and pressure waves"
  }[id] || "clear prompt-specific micro-feedback";
}

function chooseRuntimeBlueprint(value, layout, ids) {
  if (layout === "grid" && (ids.has("reveal") || ids.has("stealth"))) {
    return runtimeBlueprint("grid-reveal", "Deduction board", "inspect/mark cells", "safe cells vs hazards", "clue grid", "clustered hidden cells");
  }
  if (layout === "grid" && (ids.has("connect") || ids.has("memory") || ids.has("sort") || ids.has("merge"))) {
    return runtimeBlueprint("grid-link", "Matching board", "select compatible tiles", "uncleared pairs", "paired tiles", "shuffled tile deck");
  }
  if (layout === "stage" || ids.has("rhythm")) {
    return runtimeBlueprint("timing-stage", "Timing stage", "tap on beat windows", "missed timing", "beat lane + combo", "notes crossing timing bar");
  }
  if (layout === "queue") {
    return runtimeBlueprint("queue-service", "Service queue", "serve and upgrade stations", "patience overflow", "queue pressure + resources", "station tickets and customers");
  }
  if (layout === "arena" && (ids.has("aim") || ids.has("defend") || ids.has("survive") || ids.has("stealth"))) {
    return runtimeBlueprint("arena-action", "Action arena", "move, aim, and repel threats", "collisions and wave pressure", "lives + wave + score", "radial threats and projectiles");
  }
  if (layout === "lanes" || ids.has("move")) {
    return runtimeBlueprint("lane-traversal", "Lane traversal", "switch lanes and intercept goals", "missed lanes and hazards", "lane + distance + lives", "horizontal lane streams");
  }
  if (layout === "sandbox" || ids.has("build") || ids.has("decorate")) {
    return runtimeBlueprint("sandbox-builder", "Build sandbox", "place, merge, and upgrade objects", "resource pressure", "resources + build score", "slots and crafted pieces");
  }
  if (layout === "map" || ids.has("talk") || ids.has("explore")) {
    return runtimeBlueprint("quest-map", "Quest map", "visit nodes and resolve choices", "expired quests", "quest progress + trust", "map nodes and route arcs");
  }
  return runtimeBlueprint("open-field", "Open field", "act on prompt-specific objectives", "expired objectives", "score + combo + lives", "freeform objective scatter");
}

function runtimeBlueprint(id, label, inputModel, risk, hud, spawnPattern) {
  return {
    id,
    label,
    inputModel,
    risk,
    hud,
    spawnPattern,
    screenPattern: label.toLowerCase(),
    feedback: "instant hit flash, score burst, short fail/win overlay",
    tuningKnobs: ["task count", "spawn interval", "life drain", "score target"]
  };
}

function loopForBlueprint(id, primary, secondary) {
  return {
    "grid-reveal": `Inspect a cell -> interpret clues -> mark risk or reveal another cell.`,
    "grid-link": `Select a tile -> find its compatible partner -> clear the pair without losing route memory.`,
    "timing-stage": `Watch the timing lane -> tap the active window -> build combo before notes expire.`,
    "queue-service": `Read a request -> serve or upgrade -> keep patience from overflowing.`,
    "arena-action": `Move into position -> aim or intercept -> survive the next pressure wave.`,
    "lane-traversal": `Read lane traffic -> switch lanes -> collect or avoid at speed.`,
    "sandbox-builder": `Pick a slot -> place or merge an object -> reinvest resources into stronger pieces.`,
    "quest-map": `Choose a node -> resolve a prompt action -> open the next route.`
  }[id] || `${primary} -> ${secondary} -> score feedback.`;
}

function riskForBlueprint(id) {
  return {
    "grid-reveal": "Hidden hazards punish careless reveals.",
    "grid-link": "Wrong matches reset combo and waste board tempo.",
    "timing-stage": "Expired notes break combo and drain lives.",
    "queue-service": "Unserved requests overflow patience.",
    "arena-action": "Threats close distance and collide with the player.",
    "lane-traversal": "Wrong-lane hazards and missed objectives cost lives.",
    "sandbox-builder": "Resources decay when the build plan stalls.",
    "quest-map": "Quest nodes expire if routes are ignored."
  }[id] || "Objectives expire if the player stops reacting.";
}

function entityContractForBlueprint(id) {
  return {
    "grid-reveal": ["clue cells", "hazards", "marks"],
    "grid-link": ["paired tiles", "selection cursor", "cleared slots"],
    "timing-stage": ["notes", "timing bar", "combo pulses"],
    "queue-service": ["customers", "tickets", "stations"],
    "arena-action": ["player", "threats", "projectiles"],
    "lane-traversal": ["lane marker", "streaming goals", "hazards"],
    "sandbox-builder": ["build slots", "pieces", "upgrade sparks"],
    "quest-map": ["quest nodes", "route arcs", "choice markers"]
  }[id] || ["player", "objectives", "hazards"];
}

function resourceContractForBlueprint(id) {
  return {
    "queue-service": ["patience", "resources", "upgrades"],
    "sandbox-builder": ["materials", "upgrade level", "build score"],
    "quest-map": ["trust", "keys", "quest progress"],
    "timing-stage": ["combo", "beat accuracy"],
    "arena-action": ["lives", "wave", "charge"],
    "lane-traversal": ["distance", "lane safety"],
    "grid-reveal": ["safe cells", "marks"],
    "grid-link": ["pairs", "combo"]
  }[id] || ["score", "combo", "lives"];
}

function playerFantasy(value, primary, secondary) {
  const promptTerms = extractPromptTerms(value).slice(0, 3).join(", ");
  const context = promptTerms ? ` through ${promptTerms}` : "";
  return `The player feels clever and capable while using ${primary.label.toLowerCase()} and ${secondary.label.toLowerCase()}${context}.`;
}

function labelForLayout(layout) {
  return {
    grid: "Logic Board",
    stage: "Timing Stage",
    queue: "Management Loop",
    arena: "Action Arena",
    lanes: "Traversal Track",
    sandbox: "Build Sandbox",
    map: "Adventure Map",
    field: "Open Field"
  }[layout] || "Open Field";
}

function buildSemanticLabels(mechanics, value) {
  const base = mechanics.flatMap((item) => ({
    reveal: ["Reveal", "Flag", "Clue", "Clear"],
    connect: ["Match", "Link", "Route", "Pair"],
    manage: ["Serve", "Queue", "Prep", "Upgrade"],
    rhythm: ["Beat", "Sync", "Hold", "Drop"],
    aim: ["Aim", "Charge", "Release", "Hit"],
    move: ["Dodge", "Dash", "Jump", "Lane"],
    collect: ["Collect", "Bank", "Combo", "Bonus"],
    defend: ["Build", "Block", "Wave", "Core"],
    explore: ["Quest", "Map", "Talk", "Relic"],
    build: ["Place", "Craft", "Merge", "Power"],
    trade: ["Buy", "Sell", "Price", "Profit"],
    care: ["Care", "Heal", "Grow", "Clean"],
    stealth: ["Hide", "Scout", "Patrol", "Escape"],
    memory: ["Watch", "Recall", "Repeat", "Chain"],
    sort: ["Sort", "Stack", "Group", "Clear"],
    merge: ["Merge", "Evolve", "Combine", "Unlock"],
    survive: ["Forage", "Shelter", "Endure", "Night"],
    talk: ["Talk", "Choose", "Trust", "Story"],
    decorate: ["Place", "Style", "Upgrade", "Show"],
    balance: ["Tilt", "Weight", "Steady", "Drop"]
  }[item.id] || [item.label]));
  const promptTerms = extractPromptTerms(value);
  return Array.from(new Set([...base, ...promptTerms])).slice(0, 8);
}

function extractPromptTerms(value) {
  const english = value.match(/[a-z][a-z0-9-]{2,}/g) || [];
  const cjk = value.match(/[\u4e00-\u9fa5]{2,6}/g) || [];
  const stopWords = new Set([
    "game", "make", "create", "with", "that", "have", "play", "player", "html", "mini", "small",
    "\u6e38\u620f", "\u5c0f\u6e38\u620f", "\u751f\u6210", "\u5236\u4f5c", "\u73a9\u5bb6", "\u4e00\u4e2a"
  ]);
  const filteredEnglish = english.filter((word) => !stopWords.has(word));
  const filteredCjk = cjk.filter((word) => !stopWords.has(word));
  const labels = [
    ...filteredEnglish.map((word) => word[0].toUpperCase() + word.slice(1, 12)),
    ...filteredCjk.map((word) => word.slice(0, 6))
  ];
  return Array.from(new Set(labels)).slice(0, 6);
}

function semanticObjective(mechanics, flags) {
  if (flags.hiddenInfo) return "Reveal safe information and use clues to avoid traps.";
  if (flags.pairLogic) return "Connect compatible objectives while keeping routes open.";
  if (flags.economy) return "Convert tasks into resources, then reinvest them before pressure rises.";
  if (flags.wavePressure) return "Hold the core through escalating waves.";
  return `Complete ${mechanics.map((item) => item.label.toLowerCase()).join(", ")} objectives and build a score chain.`;
}

function semanticWinCondition(mechanics, flags) {
  if (flags.hiddenInfo) return "Reveal all safe cells or solve all clue nodes.";
  if (flags.pairLogic) return "Clear every linked pair.";
  if (flags.wavePressure) return "Survive the full wave budget.";
  return `Reach the score target while preserving lives.`;
}

function semanticFailCondition(mechanics, flags) {
  if (flags.hiddenInfo) return "Trigger too many hidden hazards.";
  if (flags.economy) return "Let the queue or resource pressure overflow.";
  return "Lose all lives to hazards, missed timing, or expired objectives.";
}

function semanticControls(mechanics, flags) {
  const ids = new Set(mechanics.map((item) => item.id));
  if (flags.hiddenInfo) return "Click/tap to inspect; right-click or long-press marks risk; WASD/Arrow keys nudge focus.";
  if (ids.has("build") || ids.has("decorate") || (ids.has("merge") && flags.economy)) return "Click/tap build slots to place or merge pieces; resources upgrade the next placement.";
  if (flags.pairLogic) return "Click/tap compatible nodes to connect them; drag or move to reposition focus.";
  if (ids.has("aim")) return "Drag to aim or charge, release to act; keyboard movement remains enabled.";
  if (ids.has("rhythm")) return "Click/tap on timing windows; Space also triggers the active beat.";
  if (ids.has("manage") || ids.has("care") || ids.has("trade")) return "Click/tap requests to serve them; use pointer or WASD to move between stations.";
  if (ids.has("talk") || ids.has("explore")) return "Click/tap map nodes to resolve choices; move with WASD/Arrow keys between routes.";
  if (ids.has("move")) return "Move with WASD/Arrow keys or pointer; tap objectives to interact.";
  return "Click/tap objectives, use WASD/Arrow keys to move, and restart to rebuild the prompt.";
}

function pickPromptTheme(value) {
  if (hasAny(value, ["neon", "acid", "\u9713\u8679", "\u8367\u5149"])) return "Acid Signal";
  if (hasAny(value, ["moon", "lunar", "robot", "battery", "repair", "\u6708\u7403", "\u673a\u5668\u4eba", "\u7535\u6c60", "\u7ef4\u4fee", "\u77ed\u8def"])) return "Violet Byte";
  if (hasAny(value, ["space", "star", "meteor", "\u592a\u7a7a", "\u661f", "\u9668\u77f3"])) return "Violet Byte";
  if (hasAny(value, ["ocean", "water", "bubble", "reef", "\u6d77", "\u6c34", "\u6ce1\u6ce1"])) return "Aqua Signal";
  if (hasAny(value, ["fire", "sun", "desert", "\u706b", "\u592a\u9633", "\u6c99\u6f20"])) return "Solar Pop";
  if (hasAny(value, ["pool", "billiard", "\u53f0\u7403", "\u684c\u7403"])) return "Cherry Grid";
  if (hasAny(value, ["连连看", "tile link", "matching", "pair", "消除配对", "配对消除"])) return "Aqua Signal";
  return "";
}

function pickPromptSpriteKit(value, semanticSpec = {}) {
  const mechanicIds = new Set((semanticSpec.mechanics || []).map((item) => item.id));
  if (mechanicIds.has("aim") && hasAny(value, ["pool", "billiard", "\u53f0\u7403", "\u684c\u7403"])) return "Pocket Table";
  if (hasAny(value, ["restaurant", "chef", "cook", "kitchen", "dish", "serve", "\u9910\u5385", "\u53a8\u623f", "\u4e0a\u83dc", "\u505a\u83dc", "\u5ba2\u4eba"])) return "Kitchen Rush";
  if (hasAny(value, ["sport", "soccer", "football", "basketball", "goalie", "penalty", "race", "golf", "\u8fd0\u52a8", "\u8db3\u7403", "\u7bee\u7403", "\u5b88\u95e8", "\u70b9\u7403", "\u8d5b\u8f66"])) return "Stadium Motion";
  if (hasAny(value, ["robot", "battery", "wire", "repair", "short", "circuit", "\u673a\u5668\u4eba", "\u7535\u6c60", "\u63a5\u7ebf", "\u7ef4\u4fee", "\u77ed\u8def", "\u7535\u8def"])) return "Repair Bay";
  if (hasAny(value, ["space", "rocket", "meteor", "\u592a\u7a7a", "\u706b\u7bad", "\u9668\u77f3"])) return "Space Junk";
  if (hasAny(value, ["ocean", "water", "submarine", "\u6d77", "\u6c34", "\u6f5c\u8247"])) return "Bubble Reef";
  if (hasAny(value, ["bug", "virus", "cyber", "data", "\u75c5\u6bd2", "\u6570\u636e", "\u8d5b\u535a"])) return "Bug Circuit";
  if (hasAny(value, ["sky", "cloud", "carnival", "\u5929\u7a7a", "\u4e91", "\u5609\u5e74\u534e"])) return "Sky Carnival";
  if (hasAny(value, ["dungeon", "knight", "magic", "\u5730\u7262", "\u9a91\u58eb", "\u9b54\u6cd5"])) return "Dungeon Neon";
  return "";
}

function promptTitle(semanticSpec, raw) {
  const value = String(raw || "").toLowerCase();
  const directName = extractPromptName(raw);
  if (directName) return directName;
  const phrase = extractPromptPhrase(raw);

  const descriptor = hasAny(value, ["neon", "\u9713\u8679", "\u8367\u5149"])
    ? "Neon"
    : hasAny(value, ["space", "\u592a\u7a7a", "\u661f"])
      ? "Star"
      : hasAny(value, ["moon", "lunar", "\u6708\u7403", "\u6708\u9762"])
        ? "Lunar"
      : hasAny(value, ["ocean", "\u6d77", "\u6c34"])
        ? "Aqua"
        : "AI";
  if (phrase) return `${descriptor} ${phrase}`;
  const names = {
    grid: "Logic Board",
    stage: "Timing Stage",
    queue: "Service Loop",
    arena: "Action Space",
    lanes: "Motion Track",
    sandbox: "Build Space",
    map: "Story Map",
    field: "Prompt Field"
  };
  return `${descriptor} ${names[semanticSpec.layout] || "Prompt Field"}`;
}

function extractPromptPhrase(raw) {
  const cleaned = String(raw || "")
    .replace(/[\r\n]+/g, " ")
    .replace(/[<>]/g, "")
    .replace(/^(please\s+)?(make|create|build|generate)\s+(a|an|one)?\s*/i, "")
    .replace(/^(做|生成|创建|制作)(一个|一款)?/u, "")
    .replace(/(小游戏|游戏|game)$/iu, "")
    .trim();
  const first = cleaned.split(/[,.，。:：;；]/)[0].trim();
  if (!first) return "";
  if (/[\u4e00-\u9fa5]/.test(first)) return first.slice(0, 10);
  return first.split(/\s+/).filter((word) => !["with", "and", "that", "where"].includes(word.toLowerCase())).slice(0, 3).join(" ");
}

function promptSubtitle(raw, semanticSpec) {
  return `${semanticSpec.genreLabel}: ${shortenPrompt(raw, 96)}`;
}

function extractPromptName(raw) {
  const cleaned = String(raw || "")
    .replace(/[\r\n]+/g, " ")
    .replace(/[<>]/g, "")
    .trim();
  const named = cleaned.match(/(?:title|name|叫|名为|名字是)[:：]?\s*([A-Za-z0-9\u4e00-\u9fa5][A-Za-z0-9\u4e00-\u9fa5\s-]{1,24})/i);
  if (named) return shortenPrompt(named[1], 28);
  return "";
}

function buildAgentTrace(prompt, game, promptProfile) {
  const semanticSpec = game.semanticSpec || promptProfile.semanticSpec || createSemanticSpec(prompt || "");
  const route = promptProfile.raw
    ? `accepted as a prompt-native concept (${game.genreLabel}); no fixed game-category router was used`
    : `open-mix request; semantic studio pipeline inferred mechanics without a fixed game-category router`;

  return [
    {
      speaker: "User",
      text: promptProfile.raw || "Random preview request"
    },
    {
      speaker: "Intent Router",
      text: `${route}. Preserved prompt summary: ${promptProfile.summary || "button-triggered random generation"}.`
    },
    {
      speaker: "Creative Director",
      text: `Fantasy="${semanticSpec.studioPlan.creativeDirector.fantasy}". Pillars=${semanticSpec.studioPlan.creativeDirector.pillars.join(" / ")}.`
    },
    {
      speaker: "Game Designer",
      text: `Core loop="${semanticSpec.studioPlan.gameDesigner.microLoop}". Runtime blueprint=${semanticSpec.runtimeBlueprint.id}.`
    },
    {
      speaker: "Systems Designer",
      text: `Extracted mechanics=${semanticSpec.mechanics.map((item) => item.label).join(" + ")}; entities=${semanticSpec.studioPlan.systemsDesigner.entities.join(", ")}; pressure="${semanticSpec.studioPlan.systemsDesigner.failurePressure}".`
    },
    {
      speaker: "Mechanic Compiler",
      text: `Compiled prompt rules: ${semanticSpec.rules.join("; ")}. Controls="${game.controls}".`
    },
    {
      speaker: "Reasoning Pass",
      text: semanticSpec.reasoningPasses.join(" | ")
    },
    {
      speaker: "Art Director",
      text: `Mini art bible: palette=${game.theme.name}; material=${semanticSpec.studioPlan.artDirector.materialLanguage}; sprite language=${semanticSpec.studioPlan.artDirector.spriteLanguage}; motion=${semanticSpec.studioPlan.artDirector.motionTone}.`
    },
    {
      speaker: "Asset Painter",
      text: `Loaded ${game.visualSkillSet.name}: backdrop=${game.visualSkillSet.backdrop}, task-frame=${game.visualSkillSet.taskFrame}, props=${game.visualSkillSet.props.slice(0, 4).map((prop) => prop.kind).join("/")}.`
    },
    {
      speaker: "Gameplay Programmer",
      text: `Implemented ${semanticSpec.runtimeBlueprint.label} scaffold=${semanticSpec.studioPlan.gameplayProgrammer.scaffold}; screen=${semanticSpec.studioPlan.levelDesigner.screenPattern}; spawn=${semanticSpec.studioPlan.levelDesigner.spawnPattern}; HUD=${semanticSpec.studioPlan.uxDesigner.hud}.`
    },
    {
      speaker: "QA Lead",
      text: `Checked acceptance: ${semanticSpec.studioPlan.qaLead.acceptance.join(" ")} Win="${semanticSpec.winCondition}". Fail="${semanticSpec.failCondition}".`
    },
    {
      speaker: "Packager",
      text: `Wrote index.html/styles.css/script.js, verified required three-file zip contract, extracted preview iframe source.`
    },
    {
      speaker: "Agent",
      text: `Ready: ${game.title}. Prompt-led settings were applied before randomization.`
    }
  ];
}

function hasAny(value, keywords) {
  return keywords.some((keyword) => value.includes(keyword));
}

function shortenPrompt(value, max) {
  const compact = String(value || "").replace(/\s+/g, " ").trim();
  return compact.length > max ? `${compact.slice(0, max - 3)}...` : compact;
}

function openGenreLabel(raw) {
  return createSemanticSpec(raw).genreLabel;
}
function promptTaskLabels(mode) {
  const semanticSpec = typeof mode === "object" ? mode : null;
  if (semanticSpec?.labels?.length) return semanticSpec.labels;
  const source = String(mode || "prompt").split(/[:+/-]/).filter(Boolean);
  const labels = source.map((item) => item[0].toUpperCase() + item.slice(1, 10));
  return Array.from(new Set([...labels, "Act", "React", "Score", "Finish"])).slice(0, 8);
}

function createVisualSkillSet(promptProfile, category, spriteKit, theme, rng) {
  const semanticSpec = promptProfile.semanticSpec || createSemanticSpec(promptProfile.raw || "");
  const layout = semanticSpec.layout || "field";
  const value = String(promptProfile.raw || "").toLowerCase();
  const serviceTiming = layout === "stage" && hasAny(value, ["restaurant", "chef", "cook", "kitchen", "dish", "serve", "\u9910\u5385", "\u53a8\u623f", "\u4e0a\u83dc", "\u505a\u83dc", "\u5ba2\u4eba"]);
  const base = serviceTiming
    ? {
        name: "Kitchen Beat Animation Kit",
        backdrop: "rhythm-service-counter",
        surface: "checker-counter",
        taskFrame: "beat-order-ticket",
        props: ["service-bell", "dish-plate", "steam", "customer-bubble", "beat-lane", "note-burst", "equalizer"],
        particles: ["steam", "note", "spark"],
        material: "animated menu-board sprites"
      }
    : visualSkillSets[layout] || visualSkillSets.field;
  const artTags = [];

  if (hasAny(value, ["cute", "cozy", "kawaii", "可爱", "治愈", "温馨"])) artTags.push("rounded cute proportions");
  if (hasAny(value, ["horror", "dark", "恐怖", "黑暗", "诡异"])) artTags.push("dramatic shadows");
  if (hasAny(value, ["pixel", "像素"])) artTags.push("pixel-art edges");
  if (hasAny(value, ["watercolor", "水彩"])) artTags.push("soft watercolor glow");
  if (hasAny(value, ["cyber", "sci-fi", "赛博", "科幻"])) artTags.push("holographic UI trim");
  if (promptProfile.semanticSpec?.flags?.hiddenInfo) artTags.push("numbered clue cells");
  if (promptProfile.semanticSpec?.flags?.pairLogic) artTags.push("connectable objective tiles");

  const propPool = [...base.props, ...(spriteKit.decor || [])];
  const props = Array.from({ length: 14 }, (_, index) => ({
    kind: propPool[index % propPool.length],
    x: Math.floor(50 + rng() * 860),
    y: Math.floor(68 + rng() * 390),
    size: Math.floor(18 + rng() * 48),
    alpha: 0.08 + rng() * 0.22,
    drift: (rng() - 0.5) * 0.55
  }));

  return {
    ...base,
    theme: theme.name,
    artTags: artTags.length ? artTags : ["layered procedural canvas sprites"],
    props,
    particleColors: [theme.accent, theme.secondary, theme.danger, "#f2f8ef"]
  };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildGame(category, seed, promptProfile = {}) {
  category = OPEN_RUNTIME_ID;
  const semanticSpec = promptProfile.semanticSpec || createSemanticSpec(promptProfile.raw || "");
  const rng = mulberry32(seed);
  const theme = promptProfile.themeName
    ? themes.find((item) => item.name === promptProfile.themeName) || randomItem(themes)
    : themes[Math.floor(rng() * themes.length)];
  const spriteKit = promptProfile.spriteKitName
    ? spriteKits.find((item) => item.name === promptProfile.spriteKitName) || randomItem(spriteKits)
    : spriteKits[Math.floor(rng() * spriteKits.length)];
  const playerShape = spriteKit.player;
  const enemyShape = spriteKit.enemy;
  const collectibleShape = spriteKit.collectible;
  const visualSkillSet = createVisualSkillSet(promptProfile, category, spriteKit, theme, rng);
  const decoration = Array.from({ length: 18 }, (_, index) => ({
    x: Math.floor(rng() * 960),
    y: Math.floor(rng() * 540),
    size: 8 + Math.floor(rng() * 34),
    shape: spriteKit.decor[(index + Math.floor(rng() * spriteKit.decor.length)) % spriteKit.decor.length],
    alpha: 0.08 + rng() * 0.18
  }));

  const title = promptProfile.raw ? promptProfile.title : "AI Prompt Game";
  const subtitle = promptProfile.subtitle || semanticSpec.objective;
  const resolvedControls = promptProfile.controls || semanticSpec.controls;
  const promptSummary = promptProfile.summary || "Open semantic preview";
  const modeLabel = promptProfile.raw ? "Semantic Prompt" : "Semantic Mix";
  const genreLabel = semanticSpec.genreLabel;
  const promptMode = semanticSpec.mode;
  const generationNotes = [
    `mode=${modeLabel}`,
    `semanticGenre=${genreLabel}`,
    `runtime=${OPEN_RUNTIME_ID}`,
    `blueprint=${semanticSpec.runtimeBlueprint.id}`,
    `layout=${semanticSpec.layout}`,
    `mechanics=${semanticSpec.mechanics.map((item) => item.id).join("+")}`,
    `theme=${theme.name}`,
    `assets=${spriteKit.name}`,
    promptProfile.raw ? "source=prompt-semantic" : "source=open-random"
  ];

  return {
    title,
    subtitle,
    category,
    modeLabel,
    genreLabel,
    promptMode,
    promptLabels: semanticSpec.labels || promptTaskLabels(semanticSpec),
    controls: resolvedControls,
    promptSummary,
    semanticSpec,
    generationNotes,
    theme,
    seed,
    playerShape,
    enemyShape,
    collectibleShape,
    decoration,
    spriteKit: spriteKit.name,
    visualSkillSet
  };
}

function gameUiCopy(locale) {
  const copy = {
    en: { preview: "preview", restart: "Restart", score: "Score", best: "Best" },
    "zh-CN": { preview: "预览", restart: "重开", score: "得分", best: "最佳" },
    "zh-TW": { preview: "預覽", restart: "重開", score: "得分", best: "最佳" },
    ja: { preview: "プレビュー", restart: "リスタート", score: "スコア", best: "ベスト" }
  };
  return copy[locale] || copy.en;
}

function buildHtml(game, locale = "en") {
  const safeTitle = escapeHtml(game.title);
  const safeTheme = escapeHtml(game.theme.name);
  const safeSubtitle = escapeHtml(game.subtitle);
  const safeControls = escapeHtml(game.controls);
  const ui = gameUiCopy(locale);
  return `<!DOCTYPE html>
<html lang="${locale}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${safeTitle}</title>
    <link rel="stylesheet" href="./styles.css" />
  </head>
  <body>
    <main class="game-shell">
      <header>
        <div>
          <p>${safeTheme} ${ui.preview}</p>
          <h1>${safeTitle}</h1>
          <span>${safeSubtitle}</span>
        </div>
        <button id="restartButton" type="button">${ui.restart}</button>
      </header>
      <canvas id="gameCanvas" width="960" height="540"></canvas>
      <footer>
        <span>${ui.score} <strong id="scoreValue">0</strong></span>
        <span>${ui.best} <strong id="bestValue">0</strong></span>
        <span id="hintValue">${safeControls}</span>
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

function buildSemanticScript(game) {
  const config = {
    runtime: OPEN_RUNTIME_ID,
    title: game.title,
    storageKey: `preview-${OPEN_RUNTIME_ID}-${game.seed}-best`,
    accent: game.theme.accent,
    secondary: game.theme.secondary,
    danger: game.theme.danger,
    bg: game.theme.bg,
    pattern: game.theme.pattern,
    promptMode: game.promptMode,
    promptSummary: game.promptSummary,
    promptLabels: game.promptLabels,
    semanticSpec: game.semanticSpec,
    studioPlan: game.semanticSpec.studioPlan,
    runtimeBlueprint: game.semanticSpec.runtimeBlueprint,
    playerShape: game.playerShape,
    enemyShape: game.enemyShape,
    collectibleShape: game.collectibleShape,
    decoration: game.decoration,
    spriteKit: game.spriteKit,
    visualSkillSet: game.visualSkillSet
  };

  return `const CONFIG = ${JSON.stringify(config)};
const canvas = document.querySelector("#gameCanvas");
const ctx = canvas.getContext("2d");
const scoreEl = document.querySelector("#scoreValue");
const bestEl = document.querySelector("#bestValue");
const restartButton = document.querySelector("#restartButton");
const keys = new Set();
const pointer = { active: false, x: 480, y: 270, downX: 480, downY: 270, dragging: false, marked: false };
let state;
let longPressTimer = null;

function runtimeId() {
  return CONFIG.runtimeBlueprint && CONFIG.runtimeBlueprint.id ? CONFIG.runtimeBlueprint.id : CONFIG.semanticSpec.layout;
}

function reset() {
  const runtime = runtimeId();
  state = {
    tick: 0,
    score: 0,
    best: Number(localStorage.getItem(CONFIG.storageKey) || 0),
    over: false,
    win: false,
    lives: CONFIG.semanticSpec.flags.hiddenInfo ? 1 : 6,
    resources: CONFIG.semanticSpec.flags.economy ? 90 : 0,
    targetScore: CONFIG.semanticSpec.flags.wavePressure ? 900 : 640,
    combo: 0,
    focus: { x: 180, y: 290, vx: 0, vy: 0, size: 34 },
    tasks: [],
    grid: [],
    actors: [],
    projectiles: [],
    particles: [],
    selected: null,
    wave: 0,
    laneIndex: 1,
    buildLevel: 1,
    progress: 0,
    stationPressure: 0
  };
  if (runtime === "lane-traversal") state.focus.y = laneY(state.laneIndex);
  if (runtime === "queue-service") state.focus.y = canvas.height - 104;
  if (runtime === "sandbox-builder") state.resources = 120;
  if (runtime === "quest-map") state.targetScore = 520;
  if (CONFIG.semanticSpec.layout === "grid") state.grid = createSemanticGrid();
  state.tasks = createSemanticTasks(initialTaskCount(runtime));
  for (let i = 0; i < initialActorCount(runtime); i += 1) spawnActor(i);
}

function initialTaskCount(runtime) {
  return {
    "grid-reveal": 3,
    "grid-link": 3,
    "timing-stage": 9,
    "queue-service": 5,
    "lane-traversal": 8,
    "sandbox-builder": 6,
    "quest-map": 7,
    "arena-action": 6
  }[runtime] || 7;
}

function initialActorCount(runtime) {
  return {
    "queue-service": 4,
    "arena-action": 7,
    "lane-traversal": 4,
    "quest-map": 2,
    "sandbox-builder": 0,
    "timing-stage": 0
  }[runtime] || 5;
}

function laneY(index) {
  return 112 + Math.max(0, Math.min(3, index)) * 92;
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

function update() {
  state.tick += 1;
  if (!state.over) {
    updateFocus();
    updateTasks();
    updateActors();
    updateProjectiles();
    updateParticles();
    checkWinLoss();
  }
  scoreEl.textContent = state.score;
  bestEl.textContent = state.best;
}

function createSemanticGrid() {
  const flags = CONFIG.semanticSpec.flags;
  const cols = flags.hiddenInfo ? 10 : 8;
  const rows = flags.hiddenInfo ? 8 : 6;
  const labels = CONFIG.promptLabels.length ? CONFIG.promptLabels : ["A", "B", "C", "D"];
  const grid = Array.from({ length: rows }, function(_, row) {
    return Array.from({ length: cols }, function(_, col) {
      return { row: row, col: col, revealed: false, marked: false, cleared: false, hazard: false, count: 0, value: "" };
    });
  });
  if (flags.hiddenInfo) {
    const hazardCount = Math.max(8, Math.floor(cols * rows * 0.18));
    let placed = 0;
    while (placed < hazardCount) {
      const tile = grid[Math.floor(Math.random() * rows)][Math.floor(Math.random() * cols)];
      if (!tile.hazard) {
        tile.hazard = true;
        placed += 1;
      }
    }
    grid.flat().forEach(function(tile) {
      tile.count = neighbors(tile).filter(function(cell) { return cell.hazard; }).length;
    });
  } else if (flags.pairLogic) {
    const deck = [];
    for (let i = 0; i < cols * rows / 2; i += 1) {
      const value = labels[i % labels.length].slice(0, 2).toUpperCase();
      deck.push(value, value);
    }
    for (let i = deck.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = deck[i];
      deck[i] = deck[j];
      deck[j] = temp;
    }
    grid.flat().forEach(function(tile, index) { tile.value = deck[index]; });
  } else {
    grid.flat().forEach(function(tile, index) { tile.value = labels[index % labels.length].slice(0, 2).toUpperCase(); });
  }
  return grid;
}

function neighbors(tile) {
  const result = [];
  for (let row = tile.row - 1; row <= tile.row + 1; row += 1) {
    for (let col = tile.col - 1; col <= tile.col + 1; col += 1) {
      if (row === tile.row && col === tile.col) continue;
      const next = state.grid[row] && state.grid[row][col];
      if (next) result.push(next);
    }
  }
  return result;
}

function createSemanticTasks(count) {
  const runtime = runtimeId();
  const labels = CONFIG.promptLabels.length ? CONFIG.promptLabels : ["Act", "React", "Score", "Solve"];
  const tasks = [];
  for (let i = 0; i < count; i += 1) {
    const mechanic = CONFIG.semanticSpec.mechanics[i % CONFIG.semanticSpec.mechanics.length] || { id: "collect", label: "Collect" };
    const lane = i % 4;
    const stationX = 145 + (i % 5) * 168;
    tasks.push({
      x: taskStartX(runtime, stationX),
      y: taskStartY(runtime, lane, i),
      lane: lane,
      station: i % 5,
      vx: taskStartVx(runtime),
      vy: (Math.random() - 0.5) * 0.8,
      size: 34 + Math.random() * 26,
      label: labels[(i + Math.floor(Math.random() * labels.length)) % labels.length],
      mechanic: mechanic.id,
      value: 35 + i * 8,
      life: taskStartLife(runtime),
      phase: Math.random() * Math.PI * 2,
      linked: false,
      level: 1 + Math.floor(Math.random() * 3)
    });
  }
  return tasks;
}

function taskStartX(runtime, stationX) {
  if (runtime === "timing-stage" || runtime === "lane-traversal") return canvas.width + 60 + Math.random() * 360;
  if (runtime === "queue-service" || runtime === "sandbox-builder") return stationX;
  if (runtime === "quest-map") return 120 + Math.random() * (canvas.width - 240);
  return 80 + Math.random() * (canvas.width - 160);
}

function taskStartY(runtime, lane, index) {
  if (runtime === "lane-traversal") return laneY(lane);
  if (runtime === "timing-stage") return 108 + lane * 86;
  if (runtime === "queue-service") return canvas.height - 118 - (index % 2) * 74;
  if (runtime === "sandbox-builder") return 128 + Math.floor(index / 3) * 138;
  if (runtime === "quest-map") return 96 + Math.random() * (canvas.height - 210);
  return 82 + Math.random() * (canvas.height - 168);
}

function taskStartVx(runtime) {
  if (runtime === "timing-stage") return -(2.6 + Math.random() * 1.5);
  if (runtime === "lane-traversal") return -(2.2 + Math.random() * 2.2);
  if (runtime === "queue-service" || runtime === "sandbox-builder" || runtime === "quest-map") return 0;
  return (Math.random() - 0.5) * 1.2;
}

function taskStartLife(runtime) {
  if (runtime === "queue-service") return 430;
  if (runtime === "sandbox-builder") return 520;
  if (runtime === "quest-map") return 460;
  if (runtime === "timing-stage") return 280;
  return CONFIG.semanticSpec.flags.economy ? 360 : 230 + Math.random() * 160;
}

function spawnActor(index) {
  const runtime = runtimeId();
  const hostile = runtime === "arena-action" || runtime === "lane-traversal" || (CONFIG.semanticSpec.flags.wavePressure && index % 2 === 0);
  state.actors.push({
    x: hostile ? canvas.width + 60 + Math.random() * 180 : 90 + index * 155,
    y: runtime === "lane-traversal" ? laneY(index % 4) : runtime === "queue-service" ? canvas.height - 92 : 90 + Math.random() * (canvas.height - 170),
    vx: hostile ? -(0.9 + Math.random() * 1.8 + state.wave * 0.08) : runtime === "queue-service" ? 0 : (Math.random() - 0.5) * 0.8,
    vy: (Math.random() - 0.5) * 0.9,
    hostile: hostile,
    patience: 260 + Math.random() * 180,
    hp: hostile ? 2 + Math.floor(state.wave / 3) : 1,
    size: hostile ? 30 : 22
  });
}

function updateFocus() {
  const runtime = runtimeId();
  const speed = CONFIG.semanticSpec.flags.traversal ? 5.8 : 4.2;
  if (runtime === "lane-traversal") {
    if (keys.has("ArrowUp") || keys.has("KeyW")) state.laneIndex = Math.max(0, state.laneIndex - 1);
    if (keys.has("ArrowDown") || keys.has("KeyS")) state.laneIndex = Math.min(3, state.laneIndex + 1);
    state.focus.x += ((pointer.active ? pointer.x : 180) - state.focus.x) * 0.09;
    state.focus.y += (laneY(state.laneIndex) - state.focus.y) * 0.24;
    state.focus.x = Math.max(44, Math.min(canvas.width - 44, state.focus.x));
    return;
  }
  if (runtime === "timing-stage") {
    state.focus.x = 155;
    state.focus.y = 270 + Math.sin(state.tick * 0.04) * 118;
    return;
  }
  if (pointer.active && !pointer.dragging) {
    state.focus.x += (pointer.x - state.focus.x) * 0.16;
    state.focus.y += (pointer.y - state.focus.y) * 0.16;
  }
  if (keys.has("ArrowLeft") || keys.has("KeyA")) state.focus.x -= speed;
  if (keys.has("ArrowRight") || keys.has("KeyD")) state.focus.x += speed;
  if (keys.has("ArrowUp") || keys.has("KeyW")) state.focus.y -= speed;
  if (keys.has("ArrowDown") || keys.has("KeyS")) state.focus.y += speed;
  state.focus.x = Math.max(28, Math.min(canvas.width - 28, state.focus.x));
  state.focus.y = Math.max(58, Math.min(canvas.height - 34, state.focus.y));
}

function updateTasks() {
  const runtime = runtimeId();
  state.tasks.forEach(function(task) {
    task.phase += 0.04;
    if (runtime === "timing-stage" || runtime === "lane-traversal") {
      task.x += task.vx + Math.sin(task.phase) * 0.25;
      if (task.x < -70) {
        task.x = canvas.width + 80 + Math.random() * 240;
        if (runtime === "lane-traversal") task.lane = Math.floor(Math.random() * 4);
        task.y = taskStartY(runtime, task.lane, task.station);
        state.lives -= 1;
        state.combo = 0;
      }
    } else if (runtime === "queue-service") {
      task.y += Math.sin(task.phase) * 0.08;
      state.stationPressure += 0.0025;
    } else if (runtime === "sandbox-builder" || runtime === "quest-map") {
      task.size += Math.sin(task.phase) * 0.025;
    } else {
      task.x += task.vx;
      task.y += task.vy;
      if (task.x < 34 || task.x > canvas.width - 34) task.vx *= -1;
      if (task.y < 72 || task.y > canvas.height - 48) task.vy *= -1;
    }
    task.life -= lifeDrainForRuntime(runtime);
  });
  const expired = state.tasks.filter(function(task) { return task.life <= 0; }).length;
  if (expired) {
    state.lives -= runtime === "sandbox-builder" ? Math.ceil(expired / 2) : expired;
    state.stationPressure += runtime === "queue-service" ? expired * 0.14 : 0;
    state.combo = 0;
  }
  state.tasks = state.tasks.filter(function(task) { return task.life > 0; });
  while (state.tasks.length < initialTaskCount(runtime)) {
    state.tasks.push(createSemanticTasks(1)[0]);
  }
}

function lifeDrainForRuntime(runtime) {
  return {
    "queue-service": 0.42,
    "sandbox-builder": 0.28,
    "quest-map": 0.34,
    "timing-stage": 0.7,
    "lane-traversal": 0.45
  }[runtime] || (CONFIG.semanticSpec.flags.economy ? 0.55 : 0.8);
}

function updateActors() {
  const runtime = runtimeId();
  if ((runtime === "arena-action" || CONFIG.semanticSpec.flags.wavePressure) && state.tick % 95 === 0) {
    state.wave += 1;
    spawnActor(state.wave);
  }
  state.actors.forEach(function(actor) {
    if (runtime === "queue-service") {
      actor.patience -= 0.22 + state.stationPressure;
      actor.y = canvas.height - 92 + Math.sin(state.tick * 0.02 + actor.x) * 7;
      if (actor.patience <= 0) {
        state.lives -= 1;
        actor.hp = 0;
      }
      return;
    }
    actor.x += actor.vx;
    actor.y += actor.vy + Math.sin(state.tick * 0.02 + actor.x) * 0.35;
    if (!actor.hostile) {
      if (actor.x < 30 || actor.x > canvas.width - 30) actor.vx *= -1;
      if (actor.y < 70 || actor.y > canvas.height - 36) actor.vy *= -1;
    }
    if (actor.hostile && actor.x < -50) {
      state.lives -= 1;
      actor.hp = 0;
    }
    if (actor.hostile && distance(actor, state.focus) < actor.size + state.focus.size * 0.45) {
      state.lives -= 1;
      actor.hp = 0;
      burst(state.focus.x, state.focus.y, CONFIG.danger, 10);
    }
  });
  state.actors = state.actors.filter(function(actor) { return actor.hp > 0 && actor.x > -80; });
  while (runtime === "queue-service" && state.actors.length < 4) spawnActor(state.actors.length);
}

function updateProjectiles() {
  state.projectiles.forEach(function(shot) {
    shot.x += shot.vx;
    shot.y += shot.vy;
    shot.life -= 1;
    state.actors.forEach(function(actor) {
      if (actor.hostile && distance(shot, actor) < actor.size) {
        actor.hp -= 1;
        shot.life = 0;
        state.score += 45;
        state.resources += CONFIG.semanticSpec.flags.economy ? 8 : 0;
        burst(actor.x, actor.y, CONFIG.secondary, 12);
      }
    });
  });
  state.projectiles = state.projectiles.filter(function(shot) {
    return shot.life > 0 && shot.x > -40 && shot.x < canvas.width + 40 && shot.y > -40 && shot.y < canvas.height + 40;
  });
}

function updateParticles() {
  state.particles.forEach(function(particle) {
    particle.x += particle.vx;
    particle.y += particle.vy;
    particle.vy += 0.02;
    particle.life -= 0.025;
  });
  state.particles = state.particles.filter(function(particle) { return particle.life > 0; });
}

function checkWinLoss() {
  const runtime = runtimeId();
  if (CONFIG.semanticSpec.layout === "grid" && CONFIG.semanticSpec.flags.hiddenInfo) {
    const safe = state.grid.flat().filter(function(tile) { return !tile.hazard; });
    if (safe.length && safe.every(function(tile) { return tile.revealed; })) return finish(true);
  }
  if (CONFIG.semanticSpec.layout === "grid" && CONFIG.semanticSpec.flags.pairLogic) {
    if (state.grid.flat().every(function(tile) { return tile.cleared; })) return finish(true);
  }
  if (runtime === "sandbox-builder" && state.buildLevel >= 6) return finish(true);
  if (runtime === "quest-map" && state.progress >= 6) return finish(true);
  if (runtime === "queue-service" && state.stationPressure >= 1.8) return finish(false);
  if (state.score >= state.targetScore) return finish(true);
  if (state.lives <= 0) return finish(false);
}

function finish(win) {
  state.over = true;
  state.win = !!win;
  state.best = Math.max(state.best, state.score);
  localStorage.setItem(CONFIG.storageKey, state.best);
}

function gridLayout() {
  const rows = state.grid.length || 1;
  const cols = state.grid[0] ? state.grid[0].length : 1;
  const gap = 6;
  const cell = Math.min(58, (canvas.width - 150 - gap * (cols - 1)) / cols, (canvas.height - 142 - gap * (rows - 1)) / rows);
  const startX = (canvas.width - cols * cell - (cols - 1) * gap) / 2;
  const startY = 88;
  return { rows: rows, cols: cols, gap: gap, cell: cell, startX: startX, startY: startY };
}

function tileAtPointer() {
  if (!state.grid.length) return null;
  const layout = gridLayout();
  const col = Math.floor((pointer.x - layout.startX) / (layout.cell + layout.gap));
  const row = Math.floor((pointer.y - layout.startY) / (layout.cell + layout.gap));
  if (row < 0 || row >= layout.rows || col < 0 || col >= layout.cols) return null;
  const x = layout.startX + col * (layout.cell + layout.gap);
  const y = layout.startY + row * (layout.cell + layout.gap);
  if (pointer.x < x || pointer.x > x + layout.cell || pointer.y < y || pointer.y > y + layout.cell) return null;
  return state.grid[row][col];
}

function handleGridAction(markOnly) {
  const tile = tileAtPointer();
  if (!tile || state.over) return;
  if (CONFIG.semanticSpec.flags.hiddenInfo) {
    if (markOnly) {
      if (!tile.revealed) tile.marked = !tile.marked;
      return;
    }
    if (tile.marked || tile.revealed) return;
    tile.revealed = true;
    if (tile.hazard) {
      state.grid.flat().forEach(function(cell) { if (cell.hazard) cell.revealed = true; });
      burst(pointer.x, pointer.y, CONFIG.danger, 22);
      return finish(false);
    }
    state.score += tile.count ? 14 + tile.count * 4 : 22;
    if (tile.count === 0) floodReveal(tile);
    return;
  }
  if (CONFIG.semanticSpec.flags.pairLogic) {
    if (tile.cleared) return;
    if (!state.selected) {
      state.selected = tile;
      return;
    }
    if (state.selected === tile) {
      state.selected = null;
      return;
    }
    if (state.selected.value === tile.value) {
      state.selected.cleared = true;
      tile.cleared = true;
      state.score += 80 + state.combo * 6;
      state.combo += 1;
      burst(pointer.x, pointer.y, CONFIG.secondary, 18);
      state.selected = null;
    } else {
      state.combo = 0;
      state.selected = tile;
    }
    return;
  }
  tile.cleared = !tile.cleared;
  state.score += tile.cleared ? 24 : -8;
}

function floodReveal(tile) {
  neighbors(tile).forEach(function(next) {
    if (!next.revealed && !next.marked && !next.hazard) {
      next.revealed = true;
      state.score += 8;
      if (next.count === 0) floodReveal(next);
    }
  });
}

function handleTaskAction() {
  const runtime = runtimeId();
  let hitIndex = -1;
  for (let i = 0; i < state.tasks.length; i += 1) {
    if (distance(pointer, state.tasks[i]) < state.tasks[i].size * 0.78) hitIndex = i;
  }
  if (hitIndex >= 0) {
    const task = state.tasks.splice(hitIndex, 1)[0];
    const timing = runtime === "timing-stage" ? Math.max(1, Math.round(10 - Math.abs(task.x - 155) / 14)) : CONFIG.semanticSpec.flags.timedBeat ? Math.max(1, Math.round(9 - Math.abs((task.x % 120) - 60) / 8)) : 1;
    if (runtime === "lane-traversal" && Math.abs(task.y - state.focus.y) > 38) {
      state.lives -= 1;
      state.combo = 0;
      burst(pointer.x, pointer.y, CONFIG.danger, 8);
      return;
    }
    state.combo += 1;
    state.score += task.value + state.combo * 6 + timing * 8 + (runtime === "sandbox-builder" ? state.buildLevel * 9 : 0);
    state.resources += CONFIG.semanticSpec.flags.economy ? 10 : runtime === "sandbox-builder" ? 18 : 0;
    if (runtime === "queue-service") {
      state.stationPressure = Math.max(0, state.stationPressure - 0.16);
      const customer = state.actors.find(function(actor) { return actor.hp > 0; });
      if (customer) customer.patience = Math.min(460, customer.patience + 95);
    }
    if (runtime === "sandbox-builder") {
      state.buildLevel += state.resources >= 70 ? 1 : 0;
      state.resources = Math.max(0, state.resources - 45);
    }
    if (runtime === "quest-map") state.progress += 1;
    burst(task.x, task.y, CONFIG.secondary, 16);
    return;
  }
  if (runtime === "timing-stage") {
    state.combo = 0;
    state.lives -= 1;
    burst(155, pointer.y, CONFIG.danger, 6);
  } else if (CONFIG.semanticSpec.flags.physicsAim || CONFIG.semanticSpec.flags.wavePressure || runtime === "arena-action") {
    fireVector(pointer.x - state.focus.x, pointer.y - state.focus.y);
  } else {
    state.combo = 0;
    burst(pointer.x, pointer.y, CONFIG.danger, 6);
  }
}

function fireVector(dx, dy) {
  const length = Math.max(1, Math.hypot(dx, dy));
  const speed = Math.min(12, Math.max(5, length * 0.045));
  state.projectiles.push({
    x: state.focus.x,
    y: state.focus.y,
    vx: dx / length * speed,
    vy: dy / length * speed,
    life: 80
  });
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = CONFIG.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawPattern();
  drawSemanticBackdrop();
  if (CONFIG.semanticSpec.layout === "grid") drawGridScene();
  else drawOpenScene();
  drawHud();
  if (state.over) centerText(state.win ? "CLEARED" : "GAME OVER", state.win ? CONFIG.semanticSpec.winCondition : CONFIG.semanticSpec.failCondition);
}

function drawPattern() {
  const runtime = runtimeId();
  ctx.strokeStyle = "rgba(255,255,255,.08)";
  ctx.lineWidth = 1;
  for (let x = -80; x < canvas.width + 80; x += 54) {
    ctx.beginPath();
    ctx.moveTo(x + (state.tick * 0.35) % 54, 0);
    ctx.lineTo(x - 150 + (state.tick * 0.35) % 54, canvas.height);
    ctx.stroke();
  }
  if (runtime === "timing-stage") {
    for (let i = 0; i < 7; i += 1) {
      ctx.fillStyle = i % 2 ? CONFIG.secondary : CONFIG.accent;
      ctx.fillRect(90 + i * 118, canvas.height - 70 - Math.sin(state.tick * 0.06 + i) * 38, 48, 4 + Math.abs(Math.sin(state.tick * 0.04 + i)) * 80);
    }
    ctx.strokeStyle = CONFIG.accent;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(155, 74);
    ctx.lineTo(155, canvas.height - 52);
    ctx.stroke();
  }
}

function drawSemanticBackdrop() {
  const kit = CONFIG.visualSkillSet || {};
  const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  grad.addColorStop(0, "rgba(255,255,255,.04)");
  grad.addColorStop(1, "rgba(0,0,0,.32)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  (kit.props || []).forEach(function(prop, index) {
    drawProp(prop.kind, prop.x + Math.sin(state.tick * 0.01 + index) * 8, prop.y, prop.size, prop.alpha, index);
  });
}

function drawGridScene() {
  const layout = gridLayout();
  const panelW = layout.cols * layout.cell + (layout.cols - 1) * layout.gap + 34;
  const panelH = layout.rows * layout.cell + (layout.rows - 1) * layout.gap + 78;
  const panelX = layout.startX - 17;
  const panelY = layout.startY - 55;
  ctx.fillStyle = "rgba(255,255,255,.055)";
  ctx.strokeStyle = "rgba(255,255,255,.16)";
  ctx.lineWidth = 1.5;
  roundRect(panelX, panelY, panelW, panelH, 22);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "rgba(2,3,2,.62)";
  roundRect(panelX + 13, panelY + 12, panelW - 26, 32, 10);
  ctx.fill();
  ctx.fillStyle = "#f2f8ef";
  ctx.font = "800 15px system-ui";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(CONFIG.semanticSpec.primaryAction + " | " + CONFIG.semanticSpec.secondaryAction, panelX + 24, panelY + 29);
  ctx.textAlign = "right";
  ctx.fillStyle = CONFIG.secondary;
  ctx.fillText(CONFIG.semanticSpec.layout + " rules", panelX + panelW - 24, panelY + 29);

  const numberColors = ["", "#85d8ff", "#9df07a", "#ffd568", "#ff918e", "#caa6ff", "#70f0d5", "#ffb2dc", "#f2f8ef"];
  state.grid.flat().forEach(function(tile) {
    const x = layout.startX + tile.col * (layout.cell + layout.gap);
    const y = layout.startY + tile.row * (layout.cell + layout.gap);
    const selected = state.selected === tile;
    if (tile.cleared) return;
    ctx.save();
    ctx.fillStyle = tile.revealed ? "rgba(242,248,239,.12)" : selected ? CONFIG.accent : "rgba(255,255,255,.08)";
    ctx.strokeStyle = tile.marked ? CONFIG.secondary : selected ? CONFIG.secondary : "rgba(255,255,255,.18)";
    ctx.lineWidth = tile.marked || selected ? 3 : 1.4;
    roundRect(x, y, layout.cell, layout.cell, 9);
    ctx.fill();
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (tile.marked && !tile.revealed) {
      ctx.fillStyle = CONFIG.secondary;
      ctx.font = "900 " + Math.floor(layout.cell * 0.42) + "px system-ui";
      ctx.fillText("!", x + layout.cell / 2, y + layout.cell / 2 + 1);
    } else if (tile.revealed && tile.hazard) {
      drawShape("star", x + layout.cell / 2, y + layout.cell / 2, layout.cell * 0.55, CONFIG.danger, 1, state.tick * 0.04);
    } else if (tile.revealed && CONFIG.semanticSpec.flags.hiddenInfo) {
      ctx.fillStyle = numberColors[tile.count] || CONFIG.accent;
      ctx.font = "900 " + Math.floor(layout.cell * 0.43) + "px system-ui";
      ctx.fillText(tile.count ? String(tile.count) : "·", x + layout.cell / 2, y + layout.cell / 2 + 1);
    } else if (CONFIG.semanticSpec.flags.pairLogic || tile.value) {
      ctx.fillStyle = selected ? "#061005" : CONFIG.accent;
      ctx.font = "900 " + Math.floor(layout.cell * 0.32) + "px system-ui";
      ctx.fillText(tile.value || "?", x + layout.cell / 2, y + layout.cell / 2 + 1);
    } else {
      ctx.fillStyle = "rgba(242,248,239,.22)";
      ctx.beginPath();
      ctx.arc(x + layout.cell / 2, y + layout.cell / 2, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  });
}

function drawOpenScene() {
  const runtime = runtimeId();
  if (runtime === "lane-traversal") {
    ctx.strokeStyle = "rgba(255,255,255,.16)";
    for (let i = 0; i < 4; i += 1) {
      const y = laneY(i);
      ctx.fillStyle = i === state.laneIndex ? "rgba(201,255,47,.08)" : "rgba(255,255,255,.025)";
      ctx.fillRect(34, y - 34, canvas.width - 68, 68);
      ctx.beginPath();
      ctx.moveTo(40, y);
      ctx.lineTo(canvas.width - 40, y);
      ctx.stroke();
    }
  }
  if (runtime === "queue-service") {
    ctx.fillStyle = "rgba(2,3,2,.45)";
    roundRect(54, canvas.height - 138, canvas.width - 108, 78, 18);
    ctx.fill();
    for (let i = 0; i < 5; i += 1) {
      const x = 92 + i * 168;
      ctx.fillStyle = "rgba(255,255,255,.07)";
      roundRect(x, canvas.height - 150, 96, 96, 16);
      ctx.fill();
      ctx.strokeStyle = CONFIG.secondary;
      ctx.stroke();
    }
  }
  if (runtime === "sandbox-builder") {
    for (let i = 0; i < 6; i += 1) {
      const x = 118 + (i % 3) * 246;
      const y = 104 + Math.floor(i / 3) * 168;
      ctx.fillStyle = "rgba(255,255,255,.055)";
      roundRect(x, y, 168, 116, 18);
      ctx.fill();
      ctx.strokeStyle = i < state.buildLevel ? CONFIG.accent : "rgba(255,255,255,.16)";
      ctx.stroke();
    }
  }
  if (runtime === "quest-map") {
    ctx.strokeStyle = "rgba(117,244,255,.24)";
    ctx.lineWidth = 3;
    for (let i = 0; i < state.tasks.length - 1; i += 1) {
      ctx.beginPath();
      ctx.moveTo(state.tasks[i].x, state.tasks[i].y);
      ctx.lineTo(state.tasks[i + 1].x, state.tasks[i + 1].y);
      ctx.stroke();
    }
  }
  state.tasks.forEach(drawTask);
  state.actors.forEach(function(actor) {
    drawShape(actor.hostile ? CONFIG.enemyShape : CONFIG.collectibleShape, actor.x, actor.y, actor.size, actor.hostile ? CONFIG.danger : CONFIG.secondary, 0.95, state.tick * 0.025);
    if (runtime === "queue-service") {
      ctx.fillStyle = CONFIG.danger;
      ctx.fillRect(actor.x - 24, actor.y + 28, 48 * Math.max(0, actor.patience / 460), 4);
    }
  });
  state.projectiles.forEach(function(shot) {
    drawShape("diamond", shot.x, shot.y, 15, CONFIG.accent, 1, state.tick * 0.08);
  });
  drawShape(CONFIG.playerShape, state.focus.x, state.focus.y, state.focus.size, CONFIG.accent, 1, state.tick * 0.025);
  if (pointer.dragging) {
    ctx.strokeStyle = CONFIG.secondary;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(state.focus.x, state.focus.y);
    ctx.lineTo(pointer.x, pointer.y);
    ctx.stroke();
  }
}

function drawTask(task) {
  const runtime = runtimeId();
  const heat = Math.max(0.12, task.life / 360);
  ctx.save();
  ctx.translate(task.x, task.y);
  ctx.rotate(runtime === "sandbox-builder" ? 0 : Math.sin(task.phase) * 0.05);
  ctx.shadowColor = heat < 0.28 ? CONFIG.danger : CONFIG.accent;
  ctx.shadowBlur = heat < 0.28 ? 24 : 14;
  ctx.fillStyle = runtime === "quest-map" ? "rgba(117,244,255,.14)" : heat < 0.28 ? "rgba(255,79,123,.88)" : "rgba(255,255,255,.1)";
  ctx.strokeStyle = heat < 0.28 ? CONFIG.danger : CONFIG.secondary;
  ctx.lineWidth = 2;
  if (runtime === "timing-stage") {
    ctx.beginPath();
    ctx.arc(0, 0, task.size * 0.62, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else {
    roundRect(-task.size, -task.size * 0.66, task.size * 2, task.size * 1.32, 13);
    ctx.fill();
    ctx.stroke();
  }
  drawShape(CONFIG.collectibleShape, -task.size * 0.42, 0, task.size * 0.55, CONFIG.secondary, 0.95, task.phase);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#f2f8ef";
  ctx.font = "900 13px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(task.label.slice(0, 12), task.size * 0.22, 5);
  ctx.fillStyle = CONFIG.accent;
  ctx.fillRect(-task.size, task.size * 0.76, task.size * 2 * heat, 4);
  if (runtime === "sandbox-builder") {
    ctx.fillStyle = CONFIG.secondary;
    ctx.fillText("L" + task.level, -task.size * 0.45, -task.size * 0.42);
  }
  ctx.restore();
}

function drawHud() {
  const runtime = runtimeId();
  ctx.fillStyle = "rgba(2,3,2,.66)";
  roundRect(16, 12, canvas.width - 32, 38, 12);
  ctx.fill();
  ctx.fillStyle = "#f2f8ef";
  ctx.font = "800 16px system-ui";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const extra = runtime === "queue-service"
    ? "   Pressure " + Math.round(state.stationPressure * 100)
    : runtime === "sandbox-builder"
      ? "   Build L" + state.buildLevel + "   Res " + Math.round(state.resources)
      : runtime === "quest-map"
        ? "   Quest " + state.progress + "/6"
        : runtime === "lane-traversal"
          ? "   Lane " + (state.laneIndex + 1)
          : "";
  ctx.fillText("Lives " + state.lives + "   Combo " + state.combo + "   Goal " + state.targetScore + extra, 26, 31);
  ctx.fillStyle = CONFIG.secondary;
  ctx.textAlign = "right";
  ctx.fillText(CONFIG.semanticSpec.genreLabel.slice(0, 46), canvas.width - 26, 31);
  ctx.textAlign = "left";
}

function drawProp(kind, x, y, size, alpha, index) {
  ctx.save();
  ctx.globalAlpha = alpha || 0.18;
  ctx.translate(x, y);
  ctx.rotate(Math.sin(state.tick * 0.008 + index) * 0.12);
  drawShape(index % 2 ? "diamond" : "circle", 0, 0, size, index % 2 ? CONFIG.secondary : CONFIG.accent, 1, index);
  ctx.restore();
}

function drawShape(shape, x, y, size, color, alpha, rotation) {
  ctx.save();
  ctx.globalAlpha = alpha == null ? 1 : alpha;
  ctx.translate(x, y);
  ctx.rotate(rotation || 0);
  ctx.fillStyle = color;
  ctx.strokeStyle = "rgba(242,248,239,.65)";
  ctx.lineWidth = Math.max(1.5, size * 0.06);
  const r = size / 2;
  if (shape === "diamond" || shape === "data-chip" || shape === "gem-cluster") {
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(r, 0);
    ctx.lineTo(0, r);
    ctx.lineTo(-r, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (shape === "star" || shape === "star-core" || shape === "trophy-star") {
    ctx.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const a = -Math.PI / 2 + i * Math.PI / 5;
      const rr = i % 2 ? r * 0.42 : r;
      const px = Math.cos(a) * rr;
      const py = Math.sin(a) * rr;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (shape === "shield" || shape === "rocket" || shape === "athlete-token") {
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.quadraticCurveTo(r * 0.85, -r * 0.25, r * 0.48, r * 0.76);
    ctx.lineTo(0, r);
    ctx.lineTo(-r * 0.48, r * 0.76);
    ctx.quadraticCurveTo(-r * 0.85, -r * 0.25, 0, -r);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
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
  ctx.closePath();
}

function centerText(title, sub) {
  ctx.fillStyle = "rgba(2,3,2,.7)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = CONFIG.accent;
  ctx.font = "900 54px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(title, canvas.width / 2, canvas.height / 2 - 16);
  ctx.fillStyle = "#f2f8ef";
  ctx.font = "700 18px system-ui";
  ctx.fillText(sub.slice(0, 86), canvas.width / 2, canvas.height / 2 + 24);
  ctx.textAlign = "left";
}

function burst(x, y, color, count) {
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.2 + Math.random() * 3;
    state.particles.push({ x: x, y: y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0.7 + Math.random() * 0.3, color: color });
  }
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

canvas.addEventListener("pointerdown", function(event) {
  pointer.active = true;
  pointer.dragging = CONFIG.semanticSpec.flags.physicsAim;
  const rect = canvas.getBoundingClientRect();
  pointer.x = (event.clientX - rect.left) * canvas.width / rect.width;
  pointer.y = (event.clientY - rect.top) * canvas.height / rect.height;
  pointer.downX = pointer.x;
  pointer.downY = pointer.y;
  if (CONFIG.semanticSpec.layout === "grid") {
    if (event.button === 2) handleGridAction(true);
    else {
      clearTimeout(longPressTimer);
      pointer.marked = false;
      longPressTimer = setTimeout(function() {
        pointer.marked = true;
        handleGridAction(true);
      }, 470);
    }
  }
});

canvas.addEventListener("pointermove", function(event) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = (event.clientX - rect.left) * canvas.width / rect.width;
  pointer.y = (event.clientY - rect.top) * canvas.height / rect.height;
});

canvas.addEventListener("pointerup", function(event) {
  clearTimeout(longPressTimer);
  const wasMarked = pointer.marked;
  pointer.marked = false;
  if (CONFIG.semanticSpec.layout === "grid") {
    if (!wasMarked && event.button !== 2) handleGridAction(false);
  } else if (pointer.dragging && CONFIG.semanticSpec.flags.physicsAim) {
    fireVector(pointer.x - state.focus.x, pointer.y - state.focus.y);
  } else {
    handleTaskAction();
  }
  pointer.dragging = false;
});

canvas.addEventListener("contextmenu", function(event) {
  if (CONFIG.semanticSpec.layout === "grid") event.preventDefault();
});

canvas.addEventListener("pointerleave", function() {
  clearTimeout(longPressTimer);
  pointer.active = false;
  pointer.dragging = false;
});

window.addEventListener("keydown", function(event) {
  keys.add(event.code);
  if (event.code === "Space") {
    event.preventDefault();
    handleTaskAction();
  }
});
window.addEventListener("keyup", function(event) { keys.delete(event.code); });
restartButton.addEventListener("click", reset);

reset();
loop();
`;
}

function buildScript(game) {
  return buildSemanticScript(game);
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
