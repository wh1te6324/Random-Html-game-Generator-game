const buttons = document.querySelectorAll("[data-category]");
const previewFrame = document.querySelector("#previewFrame");
const emptyState = document.querySelector("#emptyState");
const previewTitle = document.querySelector("#previewTitle");
const categoryValue = document.querySelector("#categoryValue");
const controlsValue = document.querySelector("#controlsValue");
const zipLink = document.querySelector("#zipLink");
const statusPill = document.querySelector("#statusPill");
const statusText = document.querySelector("#statusText");

let activeRequest = null;

buttons.forEach((button) => {
  button.addEventListener("click", () => {
    generatePreview(button.dataset.category, button);
  });
});

async function generatePreview(category, button) {
  if (activeRequest) {
    activeRequest.abort();
  }

  activeRequest = new AbortController();
  setBusy(true, button);

  try {
    const response = await fetch("/api/generate-preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category }),
      signal: activeRequest.signal
    });

    if (!response.ok) {
      throw new Error(`Generate failed: ${response.status}`);
    }

    const preview = await response.json();
    renderPreview(preview);
  } catch (error) {
    if (error.name !== "AbortError") {
      statusText.textContent = "Error";
      controlsValue.textContent = error.message;
    }
  } finally {
    setBusy(false, button);
    if (previewFrame.src) {
      statusText.textContent = "Preview ready";
    }
    activeRequest = null;
  }
}

function renderPreview(preview) {
  emptyState.hidden = true;
  previewTitle.textContent = preview.title;
  categoryValue.textContent = labelFor(preview.category);
  controlsValue.textContent = preview.controls;
  zipLink.href = preview.zipUrl;
  zipLink.classList.remove("disabled");
  zipLink.removeAttribute("aria-disabled");
  previewFrame.src = `${preview.previewUrl}?t=${Date.now()}`;
  statusText.textContent = "Preview ready";
}

function setBusy(isBusy, activeButton) {
  statusPill.classList.toggle("busy", isBusy);
  statusText.textContent = isBusy ? "Generating" : "Ready";

  buttons.forEach((button) => {
    button.disabled = isBusy;
    button.classList.toggle("active", button === activeButton && isBusy);
  });
}

function labelFor(category) {
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
}
