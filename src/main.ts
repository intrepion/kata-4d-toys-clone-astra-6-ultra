import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-500.css";
import "@fontsource/dm-sans/latin-600.css";
import "@fontsource/dm-sans/latin-700.css";
import "@fontsource/manrope/latin-500.css";
import "@fontsource/manrope/latin-600.css";
import "@fontsource/manrope/latin-700.css";
import "@fontsource/manrope/latin-800.css";
import "./style.css";
import { icon, logo, toyArt } from "./icons";
import { Sandbox } from "./sandbox";
import {
  createBody,
  createPreset,
  getBodyBounds,
  type ToyBody,
} from "./physics";
import type { ShapeKind } from "./geometry4d";

type Preset = "playground" | "tower" | "ballpit" | "orbit";
const shapes: { kind: ShapeKind; name: string; sub: string; color: string }[] =
  [
    {
      kind: "tesseract",
      name: "Tesseract",
      sub: "8 cubic cells",
      color: "#729be4",
    },
    {
      kind: "hypersphere",
      name: "Hypersphere",
      sub: "Perfectly round. In 4D.",
      color: "#e78c79",
    },
    {
      kind: "simplex",
      name: "5-cell",
      sub: "5 tetrahedral cells",
      color: "#e7bd5c",
    },
    {
      kind: "orthoplex",
      name: "16-cell",
      sub: "16 tetrahedral cells",
      color: "#af94cf",
    },
  ];
const presets: {
  id: Preset;
  name: string;
  description: string;
  emoji: string;
  number: string;
}[] = [
  {
    id: "playground",
    name: "The mixed bag",
    description: "A few familiar shapes. One unfamiliar dimension.",
    emoji: "mixed",
    number: "01",
  },
  {
    id: "tower",
    name: "A balancing act",
    description: "Build it up. Tip it over. See what happens in 4D.",
    emoji: "stack",
    number: "02",
  },
  {
    id: "ballpit",
    name: "The ball pit",
    description: "A little chaos. A lot of hyperspheres.",
    emoji: "balls",
    number: "03",
  },
  {
    id: "orbit",
    name: "Zero gravity",
    description: "No up. No down. Just room to explore.",
    emoji: "orbit",
    number: "04",
  },
];

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <header class="app-header">
    <a class="brand" href="/" aria-label="4D Toys home"><span class="brand-mark">${logo}</span><span>4d toys<span class="brand-period">.</span></span></a>
    <div class="header-divider"></div><p class="brand-tagline">A playground in another dimension.</p>
    <div class="header-actions"><span class="experiment-badge">A LITTLE EXPERIMENT</span><button id="sound-toggle" class="icon-button" aria-label="Enable interaction sounds" title="Enable interaction sounds">${icon("muted")}</button><button id="help-button" class="button help-button">${icon("help")}<span>How to play</span></button></div>
  </header>
  <main class="app-main">
    <aside class="sidebar" aria-label="Toybox">
      <div class="sidebar-section scene-section"><div class="eyebrow">PICK A PLAYGROUND <span>04</span></div>
        <nav class="scene-list" aria-label="Playgrounds">${presets.map((p) => `<button class="scene-button ${p.id === "playground" ? "active" : ""}" data-preset="${p.id}" aria-pressed="${p.id === "playground"}"><span class="scene-art ${p.emoji}"><i></i><i></i><i></i></span><span>${p.name}</span>${icon("chevron")}</button>`).join("")}</nav>
      </div>
      <div class="sidebar-rule"></div>
      <div class="sidebar-section toy-section"><div class="eyebrow">ADD A LITTLE SOMETHING ${icon("plus")}</div><div class="toy-grid">${shapes.map((s) => `<button class="toy-card" data-shape="${s.kind}" title="Add ${s.name}" aria-label="Add ${s.name}"><span class="toy-plus">${icon("plus")}</span>${toyArt(s.kind)}<span class="toy-name">${s.name}</span><span class="toy-dimension">4D OBJECT</span></button>`).join("")}</div><p class="toy-hint">Click a toy to drop it into your world.</p></div>
      <div class="curiosity-card"><span class="curiosity-symbol">✳</span><div><h3>Curiosity is the only rule.</h3><p>Grab something. Turn it around.<br>Get a little lost in the fourth dimension.</p></div><button id="learn-button">What am I looking at? ${icon("arrow")}</button></div>
      <button id="about-button" class="about-link">A small window into a bigger world ${icon("arrow")}</button>
    </aside>
    <section class="workspace" aria-label="Interactive fourth-dimensional playground">
      <div class="workspace-heading"><div class="scene-title-row"><span id="scene-number" class="scene-number">01</span><div><h1 id="scene-title">The mixed bag<span>.</span></h1><p id="scene-description">A few familiar shapes. One unfamiliar dimension.</p></div></div><button id="reset-scene" class="button reset-button">${icon("rotate")}<span>Reset scene</span></button></div>
      <div class="stage" id="stage">
        <div id="canvas-container" class="canvas-container"></div>
        <div class="stage-top"><div class="live-label"><span></span><span id="live-label">LIVE PLAYGROUND</span></div><span class="view-label"><span class="view-dot"></span>3D slice of a 4D world</span></div>
        <div class="tools" role="toolbar" aria-label="Playground controls"><button id="grab-mode" class="tool active" aria-pressed="true" title="Grab and throw (G)">${icon("hand")}<span>Grab</span></button><button id="rotate-mode" class="tool" aria-pressed="false" title="Drag a toy to rotate in 4D (T)">${icon("rotate")}<span>4D rotate</span></button><span class="tool-divider"></span><button id="wireframe" class="tool icon-only" aria-label="Toggle wireframe" aria-pressed="false" title="Wireframe (V)">${icon("cube")}</button><button id="gravity" class="tool icon-only active" aria-label="Toggle gravity" aria-pressed="true" title="Gravity">${icon("gravity")}</button><span class="tool-divider"></span><button id="pause" class="tool icon-only" aria-label="Pause simulation" aria-pressed="false" title="Pause (Space)">${icon("pause")}</button></div>
        <div id="selection-panel" class="selection-panel" hidden><div class="selection-heading"><span id="selected-dot"></span><strong id="selected-name"></strong><button id="deselect" class="icon-button" aria-label="Close object details">${icon("close")}</button></div><p id="selected-sub"></p><label class="selected-w-label" for="object-w">Object’s fourth position <output id="object-w-value">0.00</output></label><input id="object-w" type="range" min="-2.5" max="2.5" step="0.01" value="0" aria-label="Selected object fourth-dimensional position"/><div class="selection-actions"><button id="rotate-selected">${icon("rotate")} Turn in 4D</button><button id="remove-selected" aria-label="Remove selected toy" title="Remove toy">${icon("trash")}</button></div></div>
        <div id="empty-slice" class="empty-slice" hidden>${icon("layers")}<strong>They’re still there.</strong><span>Your toys are just outside this slice.<br>Move the slider back to find them.</span><button id="find-toys" class="button">Back to the middle ${icon("arrow")}</button></div>
        <div class="stage-bottom"><div class="stage-hint">${icon("mouse")}<span id="interaction-hint">Drag a toy to play <span>·</span> Drag the space to orbit</span></div><div class="view-actions"><button id="shuffle" class="icon-button" aria-label="Give the toys a nudge" title="Give everything a nudge">${icon("shuffle")}</button><button id="reset-camera" class="icon-button" aria-label="Reset camera" title="Reset camera">${icon("target")}</button></div></div>
        <div class="axis-gizmo" aria-hidden="true"><span class="axis-line y"></span><span class="axis-line x"></span><span class="axis-line z"></span><b class="axis-label y">y</b><b class="axis-label x">x</b><b class="axis-label z">z</b></div>
      </div>
      <div class="dimension-panel"><div class="dimension-intro"><span class="dimension-icon">w</span><div><h2>A whole other direction.</h2><p>Move through the fourth dimension.</p></div></div><div class="dimension-control"><div class="dimension-range-heading"><span>FOURTH-DIMENSION POSITION</span><output id="w-value" for="w-slider">w = 0.00</output></div><div class="range-wrap"><div class="range-midpoint"></div><input id="w-slider" type="range" min="-3" max="3" step="0.01" value="0" aria-label="Fourth-dimension slice position"/></div><div class="range-labels"><span>−3.0</span><span>0</span><span>+3.0</span></div></div><button id="auto-explore" class="auto-button" aria-pressed="false">${icon("play")}<span>Auto explore</span></button></div>
      <div class="workspace-footer"><span><span id="toy-count">7</span> toys <i>·</i> <span id="visible-count">7</span> in this slice</span><span>A little play. A different perspective. ${icon("sparkle")}</span></div>
    </section>
  </main>
  <div id="toast" class="toast" role="status" aria-live="polite"></div>
  <dialog id="help-dialog" class="help-dialog"><button class="dialog-close icon-button" data-close-dialog aria-label="Close guide">${icon("close")}</button><span class="dialog-eyebrow">A QUICK HELLO TO THE FOURTH DIMENSION</span><h2>There’s more than<br>meets the <em>eye.</em></h2><p class="dialog-lead">Imagine a ball passing through a sheet of paper. A flat creature would see a circle grow, shrink, and disappear. You’re doing the same thing — one dimension up.</p><div class="guide-steps"><article><span class="guide-visual guide-grab">${icon("hand")}</span><span class="step-number">01 / GET HANDS-ON</span><h3>Give it a little nudge.</h3><p>Drag a toy to pick it up. Let go while moving to throw it. Drag empty space to look around; scroll to zoom.</p></article><article><span class="guide-visual guide-slice">${icon("layers")}</span><span class="step-number">02 / FIND A NEW DIRECTION</span><h3>Slide into the unseen.</h3><p>Move the <b>w</b> slider. You’re seeing a different 3D slice of the same 4D toys. They can change shape or disappear.</p></article><article><span class="guide-visual guide-rotate">${icon("rotate")}</span><span class="step-number">03 / TURN THINGS AROUND</span><h3>Go beyond x, y, and z.</h3><p>Choose <b>4D rotate</b>, then drag a toy. A cube can become a completely different shape as it turns through 4D.</p></article></div><div class="keyboard-hints"><span><kbd>Space</kbd> Pause</span><span><kbd>G</kbd> Grab</span><span><kbd>T</kbd> 4D rotate</span><span><kbd>←</kbd><kbd>→</kbd> Move slice</span><span><kbd>R</kbd> Reset</span></div><button class="primary-button" data-close-dialog>Let’s play ${icon("arrow")}</button></dialog>
  <dialog id="about-dialog" class="about-dialog"><button class="dialog-close icon-button" data-close-dialog aria-label="Close about">${icon("close")}</button><span class="about-logo">${logo}</span><h2>A box of possibilities.</h2><p>This independent browser playground is inspired by <a href="https://www.4dtoys.com/" target="_blank" rel="noopener noreferrer">4D Toys by mtb design works, inc.</a> It uses original visuals and code, with mathematically computed 3D cross-sections of four-dimensional shapes.</p><p>Objects move in four spatial dimensions. Contacts use approximate collision volumes; this is a small recreation of the idea, with four toy types and four scenes, rather than the original game’s full physics engine or content.</p><p class="about-note">No scores. No finish line. Just follow your curiosity.</p><button class="primary-button" data-close-dialog>Back to the playground ${icon("arrow")}</button></dialog>
`;

const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id)! as T;
let sandbox: Sandbox;
let currentPreset: Preset = "playground";
let autoExplore = false;
let autoTime = 0;
let soundEnabled = false;
let selectedBody: ToyBody | null = null;
let nextId = 100;
let toastTimer: ReturnType<typeof setTimeout>;
let audioContext: AudioContext | undefined;

function notify(message: string) {
  $("toast").textContent = message;
  $("toast").classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("toast").classList.remove("visible"), 2200);
}

function playNote(frequency = 440) {
  if (!soundEnabled) return;
  try {
    audioContext ??= new AudioContext();
    void audioContext.resume();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(
      frequency * 0.5,
      audioContext.currentTime + 0.14,
    );
    gain.gain.setValueAtTime(0.045, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      audioContext.currentTime + 0.2,
    );
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.2);
  } catch {
    /* Sound is optional when audio output is unavailable. */
  }
}

function syncSelection(body: ToyBody | null) {
  selectedBody = body;
  $("selection-panel").hidden = !body;
  if (!body) return;
  const meta = shapes.find((s) => s.kind === body.kind)!;
  $("selected-name").textContent = meta.name;
  $("selected-sub").textContent = meta.sub;
  $("selected-dot").style.background = body.color;
  const limit = Math.floor(getBodyBounds(body).w * 100) / 100;
  $<HTMLInputElement>("object-w").min = String(-limit);
  $<HTMLInputElement>("object-w").max = String(limit);
  $<HTMLInputElement>("object-w").value = body.position[3].toString();
  $("object-w-value").textContent = body.position[3].toFixed(2);
  playNote(580);
}

function updateStats(visible: number, total: number) {
  $("toy-count").textContent = total.toString();
  $("visible-count").textContent = visible.toString();
  $("empty-slice").hidden = visible > 0 || total === 0;
}

try {
  sandbox = new Sandbox($("canvas-container"), {
    onSelect: syncSelection,
    onStats: updateStats,
  });
  sandbox.setBodies(createPreset("playground"));
} catch (error) {
  $("canvas-container").innerHTML =
    '<div class="webgl-error"><h2>A little more graphics power, please.</h2><p>This playground needs WebGL. Enable hardware acceleration in your browser and reload to start playing.</p><button class="button" onclick="location.reload()">Try again</button></div>';
  throw error;
}

function setSlice(value: number) {
  const w = Math.max(-3, Math.min(3, value));
  sandbox.setSlice(w);
  $<HTMLInputElement>("w-slider").value = String(w);
  $("w-value").textContent =
    `w = ${w > 0.004 ? "+" : ""}${Math.abs(w) < 0.005 ? "0.00" : w.toFixed(2)}`;
}

function setAuto(value: boolean) {
  autoExplore = value;
  if (value) autoTime = Math.asin(sandbox.sliceW / 3);
  $("auto-explore").classList.toggle("active", value);
  $("auto-explore").setAttribute("aria-pressed", String(value));
  $("auto-explore").innerHTML =
    `${icon(value ? "pause" : "play")}<span>${value ? "Stop exploring" : "Auto explore"}</span>`;
}

function setPaused(value: boolean) {
  sandbox.setPaused(value);
  $("pause").innerHTML = icon(value ? "play" : "pause");
  $("pause").classList.toggle("active", value);
  $("pause").setAttribute("aria-pressed", String(value));
  $("pause").setAttribute(
    "aria-label",
    value ? "Resume simulation" : "Pause simulation",
  );
  $("live-label").textContent = value ? "TAKING A BREATHER" : "LIVE PLAYGROUND";
}

function setGravity(value: boolean) {
  sandbox.setGravity(value);
  $("gravity").classList.toggle("active", value);
  $("gravity").setAttribute("aria-pressed", String(value));
}

function setMode(mode: "grab" | "rotate") {
  sandbox.setMode(mode);
  for (const name of ["grab", "rotate"]) {
    $(`${name}-mode`).classList.toggle("active", name === mode);
    $(`${name}-mode`).setAttribute("aria-pressed", String(name === mode));
  }
  $("interaction-hint").innerHTML =
    mode === "grab"
      ? "Drag a toy to play <span>·</span> Drag the space to orbit"
      : "Drag a toy to turn it through the fourth dimension";
}

function loadPreset(preset: Preset) {
  currentPreset = preset;
  const meta = presets.find((p) => p.id === preset)!;
  document
    .querySelectorAll<HTMLButtonElement>("[data-preset]")
    .forEach((button) => {
      button.classList.toggle("active", button.dataset.preset === preset);
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.preset === preset),
      );
    });
  $("scene-title").innerHTML = `${meta.name}<span>.</span>`;
  $("scene-number").textContent = meta.number;
  $("scene-description").textContent = meta.description;
  setAuto(false);
  setSlice(0);
  setGravity(preset !== "orbit");
  setPaused(false);
  sandbox.setBodies(createPreset(preset));
  syncSelection(null);
  playNote(620);
}

document
  .querySelectorAll<HTMLButtonElement>("[data-preset]")
  .forEach((button) =>
    button.addEventListener("click", () =>
      loadPreset(button.dataset.preset as Preset),
    ),
  );
document.querySelectorAll<HTMLButtonElement>("[data-shape]").forEach((button) =>
  button.addEventListener("click", () => {
    if (sandbox.bodies.length >= 35) {
      notify("Your toybox is full. Remove a toy to make a little room.");
      return;
    }
    const kind = button.dataset.shape as ShapeKind;
    const meta = shapes.find((s) => s.kind === kind)!;
    const body = createBody(kind, nextId++, meta.color, [
      (Math.random() - 0.5) * 5,
      4.2,
      (Math.random() - 0.5) * 3,
      sandbox.sliceW,
    ]);
    const limit = getBodyBounds(body).w;
    body.position[3] = Math.max(-limit, Math.min(limit, body.position[3]));
    const movedSlice = Math.abs(body.position[3] - sandbox.sliceW) > 0.001;
    if (movedSlice) {
      setAuto(false);
      setSlice(body.position[3]);
    }
    sandbox.addBody(body);
    playNote(380 + Math.random() * 150);
    notify(
      movedSlice
        ? `${meta.name} added. Moved to its nearest slice.`
        : `${meta.name} added. Give it a little nudge.`,
    );
  }),
);
$("reset-scene").addEventListener("click", () => {
  loadPreset(currentPreset);
  notify("A fresh start. All yours.");
});
$("grab-mode").addEventListener("click", () => setMode("grab"));
$("rotate-mode").addEventListener("click", () => setMode("rotate"));
$("wireframe").addEventListener("click", () => {
  sandbox.setWireframe(!sandbox.wireframe);
  $("wireframe").classList.toggle("active", sandbox.wireframe);
  $("wireframe").setAttribute("aria-pressed", String(sandbox.wireframe));
});
$("gravity").addEventListener("click", () => {
  setGravity(!sandbox.gravity);
  notify(
    sandbox.gravity
      ? "Back down to earth."
      : "Gravity off. Give a toy a throw.",
  );
});
$("pause").addEventListener("click", () => setPaused(!sandbox.paused));
$("reset-camera").addEventListener("click", () => sandbox.resetCamera());
$("shuffle").addEventListener("click", () => {
  sandbox.scatter();
  playNote(270);
  notify("A little shake-up.");
});
$("w-slider").addEventListener("input", (event) => {
  setAuto(false);
  setSlice(Number((event.target as HTMLInputElement).value));
});
$("auto-explore").addEventListener("click", () => setAuto(!autoExplore));
$("find-toys").addEventListener("click", () => {
  setAuto(false);
  setSlice(0);
});
$("remove-selected").addEventListener("click", () => {
  sandbox.removeSelected();
  syncSelection(null);
  notify("A little more room to play.");
});
$("rotate-selected").addEventListener("click", () => {
  sandbox.rotateSelected();
  playNote(500);
});
$("deselect").addEventListener("click", () => {
  sandbox.selectedId = null;
  syncSelection(null);
});
$("object-w").addEventListener("input", (event) => {
  if (!selectedBody) return;
  const limit = getBodyBounds(selectedBody).w;
  selectedBody.position[3] = Math.max(
    -limit,
    Math.min(limit, Number((event.target as HTMLInputElement).value)),
  );
  selectedBody.velocity[3] = 0;
  $("object-w-value").textContent = selectedBody.position[3].toFixed(2);
});
$("sound-toggle").addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  $("sound-toggle").innerHTML = icon(soundEnabled ? "volume" : "muted");
  $("sound-toggle").setAttribute(
    "aria-label",
    `${soundEnabled ? "Disable" : "Enable"} interaction sounds`,
  );
  $("sound-toggle").setAttribute(
    "title",
    `${soundEnabled ? "Disable" : "Enable"} interaction sounds`,
  );
  playNote(660);
});

function showDialog(id: string) {
  $<HTMLDialogElement>(id).showModal();
}
document.querySelectorAll<HTMLDialogElement>("dialog").forEach((dialog) => {
  dialog.addEventListener("click", (event) => {
    const rect = dialog.getBoundingClientRect();
    if (
      event.target === dialog &&
      (event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom)
    )
      dialog.close();
  });
});
$("help-button").addEventListener("click", () => showDialog("help-dialog"));
$("learn-button").addEventListener("click", () => showDialog("help-dialog"));
$("about-button").addEventListener("click", () => showDialog("about-dialog"));
document
  .querySelectorAll<HTMLButtonElement>("[data-close-dialog]")
  .forEach((button) =>
    button.addEventListener("click", () => button.closest("dialog")?.close()),
  );

window.addEventListener("keydown", (event) => {
  if (
    event.target instanceof HTMLInputElement ||
    event.target instanceof HTMLTextAreaElement ||
    event.target instanceof HTMLSelectElement ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    document.querySelector("dialog[open]")
  )
    return;
  if (event.code === "Space" && !(event.target instanceof HTMLButtonElement)) {
    event.preventDefault();
    setPaused(!sandbox.paused);
  }
  if (event.key.toLowerCase() === "g") setMode("grab");
  if (event.key.toLowerCase() === "t") setMode("rotate");
  if (event.key.toLowerCase() === "r") loadPreset(currentPreset);
  if (event.key.toLowerCase() === "v") $("wireframe").click();
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    event.preventDefault();
    setAuto(false);
    setSlice(sandbox.sliceW + (event.key === "ArrowRight" ? 0.08 : -0.08));
  }
  if (
    (event.key === "Delete" || event.key === "Backspace") &&
    sandbox.selectedId !== null
  ) {
    event.preventDefault();
    sandbox.removeSelected();
    syncSelection(null);
  }
  if (event.key === "Escape") {
    sandbox.selectedId = null;
    syncSelection(null);
  }
});

let previousTime = performance.now();
function animate(time: number) {
  const dt = Math.min((time - previousTime) / 1000, 0.05);
  previousTime = time;
  if (autoExplore && !document.querySelector("dialog[open]")) {
    autoTime += dt * 0.3;
    setSlice(Math.sin(autoTime) * 3);
  }
  if (selectedBody) {
    $("object-w-value").textContent = selectedBody.position[3].toFixed(2);
    $<HTMLInputElement>("object-w").value = String(selectedBody.position[3]);
  }
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);

// Read-only observability for deterministic browser checks and interactive debugging.
Object.defineProperty(window, "__toybox", {
  value: {
    getProjectedBodies: () => sandbox.getProjectedBodies(),
    getState: () => ({
      preset: currentPreset,
      sliceW: sandbox.sliceW,
      paused: sandbox.paused,
      gravity: sandbox.gravity,
      wireframe: sandbox.wireframe,
      mode: sandbox.mode,
      selectedId: sandbox.selectedId,
      autoExplore,
      bodies: sandbox.bodies.map((body) => ({
        id: body.id,
        kind: body.kind,
        position: [...body.position],
        rotation: [...body.rotation],
      })),
    }),
  },
});
