# AI Mini Game Lab

Prompt-driven preview site for generating polished HTML mini games.

The app follows the HTML Game Maker studio contract:

- Interpret the prompt through a compact studio pipeline inspired by Claude Code Game Studios.
- Generate a complete game environment as a zip.
- The zip contains exactly `index.html`, `styles.css`, and `script.js`.
- The backend extracts those three files into a preview folder.
- The website loads the extracted `index.html` inside the large left preview frame.
- Published games are copied into the StoryClaw static hub.

## Generation Architecture

The preview agent lives at `src/preview-agent.js`. It no longer routes prompts through a fixed list of game categories. Instead, it performs a semantic studio pass:

1. **Creative Director**: player fantasy, design pillars, anti-pillars, and prompt nouns.
2. **Game Designer**: 10-second loop, session goal, verbs, fail pressure, progression, restart, and tuning knobs.
3. **Systems Designer**: entities, state, resources, rules, feedback loops, and edge cases.
4. **Level/UX Designer**: first scenario, layout, input model, HUD, onboarding, and feedback language.
5. **Art Director**: palette, material language, sprite construction, UI surfaces, particles, motion tone, and background motif.
6. **Gameplay Programmer**: smallest complete browser-native runtime that matches the design pass.
7. **QA Lead**: prompt-family fit, first-input response, visible objective pressure, reachable completion/failure state, restart, and zip contract.

Runtime blueprints are implementation scaffolds only. They are chosen from semantic verbs, entities, HUD, fail pressure, and progression. They must not override the prompt.

## Generation Quality Constraints

When a model-backed generator is available, it should spend more of the response budget on internal design thinking before writing files. The internal pass must compare at least two mechanic directions, reject the generic one, and choose the version with the clearest prompt fit, visual identity, and playable loop. Do not expose a long plan to the player; put concise reasoning in `agentTrace` only.

Visuals must not feel empty or placeholder-like. The generator should build a small asset plan before coding: background layers, foreground props, UI materials, character/object silhouettes, particles, icons, and state-specific effects. If browsing or retrieval tools are available, use them to study visual references or permissive asset sources, but do not hotlink remote assets in the final game. Final output should remain self-contained through Canvas/SVG/CSS shapes, inline data URIs, or procedurally generated assets inside the required three files.

## Default One-Shot Studio Sprint

The model should adapt Claude Code Game Studios-style workflow commands into one default sprint. A single user sentence should silently trigger: auto-start, brainstorm, concept selection, pillars and anti-pillars, systems map, compact art bible, asset inventory, prototype-risk check, implementation, and smoke QA. The user should not have to request these steps manually.

Treat missing inputs conservatively: browser platform, vanilla JavaScript, lean internal gates, small complete scope, no runtime remote assets, responsive controls, and exact three-file output. If a stage reveals an off-prompt or visually thin result, revise before packaging.

## Run

No npm dependencies are required.

```bash
node server.js
```

Open:

```text
http://127.0.0.1:4180/
```

## StoryClaw Model Relay

By default the app can still generate locally with the semantic preview agent. To use the StoryClaw/OpenRouter relay for higher-quality game generation, set the relay key before starting the server:

```bash
export STORYCLAW_OPENROUTER_API_KEY="..."
export STORYCLAW_GAME_MODEL="openai/gpt-5.5"
export STORYCLAW_OPENROUTER_BASE_URL="https://openrouter.ai/api/v1/chat/completions"
export STORYCLAW_GAME_MAX_TOKENS=12000
```

The model prompt includes this repo's `README.md` plus the sibling `html-game-agent` markdown guidance files when present, so generation keeps the local studio workflow and the three-file zip contract. If the relay is not configured or the model request fails, the backend falls back to the existing local semantic generator.

## Run On A StoryClaw Machine

This app has two runtime surfaces:

- The Node backend serves the generator UI and handles `POST /api/publish-custom-game`.
- The StoryClaw static hub serves finished published games from `~/.claw/hub/public` at `/static/...`.

The easiest path is to run the StoryClaw setup helper. It follows the same domain registration rule used by the stock dashboard agents: generate/read a stable 12-character device id, call `https://api.clawln.app/devices/register` with `{ serial, port }`, then start `cloudflared` with the returned tunnel token.

On the StoryClaw machine:

```bash
git clone https://github.com/wh1te6324/Random-Html-game-Generator-game.git
cd Random-Html-game-Generator-game

bash storyclaw/setup.sh
```

The printed URL is the public generator page:

```text
https://device-<serial>.clawln.app/
```

Published games appear under:

```text
https://device-<serial>.clawln.app/static/games/<generated-id>/index.html
```

Manual run is also possible:

```bash
export PORT=7330
export HOST=127.0.0.1
export CLAW_HUB_PUBLIC_DIR="$HOME/.claw/hub/public"
export CLAW_HUB_PUBLIC_ORIGIN="https://device-<serial>.clawln.app"
npm start
```

Because this app needs `POST /api/publish-custom-game`, the tunnel must point at this Node backend, not at a pure static-only hub. The Node backend still serves `~/.claw/hub/public` at `/static/`, so dashboard pages written by other agents remain readable as static paths.

Useful overrides:

```bash
export CLAW_DEVICE_SERIAL="ABC123XYZ789"
export CLAW_GAME_PORT=7330
export CLAW_HUB_PUBLIC="$HOME/.claw/hub/public"
```

When a user submits a custom prompt, the backend writes:

```text
~/.claw/hub/public/games/<generated-id>/index.html
~/.claw/hub/public/games/<generated-id>/game/index.html
~/.claw/hub/public/games/<generated-id>/game/styles.css
~/.claw/hub/public/games/<generated-id>/game/script.js
~/.claw/hub/public/games/<generated-id>/<generated-id>.zip
```

The returned public URL is:

```text
https://device-<id>.clawln.app/static/games/<generated-id>/index.html
```

## Preview Flow

1. Submit a game prompt.
2. `POST /api/generate-preview` or `POST /api/publish-custom-game` performs the semantic studio pass.
3. The backend writes `index.html`, `styles.css`, and `script.js`.
4. The backend packages those files into `generated-games/<id>/<id>.zip`.
5. The backend extracts the zip into `public/previews/<id>/`.
6. The frontend points the left iframe at `/previews/<id>/index.html`.

## API

Generate a preview:

```http
POST /api/generate-preview
Content-Type: application/json

{ "prompt": "做一个月光茶馆经营装饰游戏，客人有不同茶味心情，玩家调配茶、布置桌子、管理耐心值。" }
```

Response:

```json
{
  "id": "custom-example",
  "title": "AI 月光茶馆经营装饰游戏",
  "modeLabel": "Management Loop / Manage + Decorate + Care",
  "genreLabel": "Management Loop / Manage + Decorate + Care",
  "zipUrl": "/generated-games/custom-example/custom-example.zip",
  "previewUrl": "/previews/custom-example/index.html",
  "files": ["index.html", "styles.css", "script.js"],
  "controls": "Click/tap requests to serve them; use pointer or WASD to move between stations.",
  "agentTrace": []
}
```
