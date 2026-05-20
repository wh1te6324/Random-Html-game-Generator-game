# Random HTML Game Generator Game

Button-driven preview site for generating small 2D HTML mini games.

The app follows the repaired HTML Game Maker agent contract:

- Generate a complete game environment as a zip.
- The zip contains exactly `index.html`, `styles.css`, and `script.js`.
- The backend extracts those three files into a preview folder.
- The website loads the extracted `index.html` inside the large left preview frame.

## Run

No npm dependencies are required.

```bash
node server.js
```

Open:

```text
http://127.0.0.1:4180/
```

## Run On A StoryClaw Machine

This app has two runtime surfaces:

- The Node backend serves the generator UI and handles `POST /api/publish-custom-game`.
- The StoryClaw static hub serves finished published games from `~/.claw/hub/public` at `/static/...`.

On the StoryClaw machine:

```bash
git clone https://github.com/wh1te6324/Random-Html-game-Generator-game.git
cd Random-Html-game-Generator-game

export PORT=4180
export CLAW_HUB_PUBLIC_DIR="$HOME/.claw/hub/public"
export CLAW_DEVICE_ORIGIN="https://device-<id>.clawln.app"

npm start
```

If your tunnel points directly at this Node server instead of the static hub, set:

```bash
export CLAW_HUB_PUBLIC_ORIGIN="https://your-public-generator-domain"
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

1. Click the random generation button.
2. `POST /api/generate-preview` creates a simple playable game from a broad 2D arcade pool.
3. The backend writes `index.html`, `styles.css`, and `script.js`.
4. The backend packages those files into `generated-games/<id>/<id>.zip`.
5. The backend extracts the zip into `public/previews/<id>/`.
6. The frontend points the left iframe at `/previews/<id>/index.html`.

## API

Generate a preview:

```http
POST /api/generate-preview
Content-Type: application/json

{ "category": "tower-defense" }
```

The public UI intentionally keeps only one random button. Internally, the preview pool includes dodge, collector, target clicker, snake/trail, lane runner, orbit defense, Pong-style rallies, billiards/pool collision games, paddle breaker, platform jumper, and light tower defense patterns.

Response:

```json
{
  "id": "tower-defense-example",
  "title": "Pulse Tower",
  "category": "tower-defense",
  "zipUrl": "/generated-games/tower-defense-example/tower-defense-example.zip",
  "previewUrl": "/previews/tower-defense-example/index.html",
  "files": ["index.html", "styles.css", "script.js"],
  "controls": "Click empty grid cells to place towers."
}
```

## Where The AI Agent Fits Next

`src/preview-agent.js` is the preview agent boundary. Today it uses randomized templates for fast local previews, including randomized palettes, sprite-like canvas shapes, background patterns, and decorative assets. Later, replace or extend `buildGame()` with an AI API call that returns the same three-file contract before packaging and extraction.
