# 4D Toybox

A playable browser sandbox inspired by [4D Toys](https://www.4dtoys.com/) by mtb design works, inc. Built with TypeScript, Three.js, and Vite, with original interface artwork and locally bundled fonts.

## Run

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. The playground needs a browser with WebGL support. It does not require accounts, credentials, remote APIs, or a backend.

```bash
npm run build
npm run preview
```

## Play

- Pick a scene: The mixed bag, A balancing act, The ball pit, or Zero gravity.
- Click a toy card to add a tesseract, hypersphere, 5-cell, or 16-cell.
- Drag a toy to pick it up. Release while moving to throw it.
- Drag empty space to orbit the camera; scroll or pinch to zoom.
- Move the **w** slider to see different three-dimensional sections of the four-dimensional world. **Auto explore** sweeps through these sections.
- Select **4D rotate**, then drag a toy to rotate it through the XW and ZW planes. The selected-object panel also offers a rotation button and an individual W-position slider.
- Toggle wireframe, gravity, or pause; nudge all toys; reset the view or restore the scene.

Keyboard shortcuts: **Space** pauses, **G** grabs, **T** enables 4D rotation, **V** toggles wireframe, **←/→** move the slice, **R** resets the scene, and **Delete/Backspace** removes the selected toy. **Escape** dismisses a dialog or clears selection. Form controls retain their normal keyboard behavior.

## What is simulated

The renderer computes real intersections of 4D objects with a plane at `w = constant`. Tesseracts, regular 5-cells, and 16-cells use rotated 4D vertices and edge-plane intersections, followed by a 3D convex hull. A hypersphere's visible radius is `sqrt(radius² − wOffset²)`.

Toy positions and velocities have four spatial components. Gravity acts along Y. Collisions exchange impulses along a four-dimensional separation vector, so toys separated along W can pass through the same XYZ space. The fourth dimension is spatial, not time.

This is a compact recreation of the central interaction, not feature parity with the commercial game. Contact volumes are shape-dependent sphere approximations; floor support uses the full rotated shape. It does not implement exact 4D rigid-body contact manifolds, arbitrary six-plane angular dynamics, the original scene library, VR, or the original game's proprietary physics engine.

## Verification

```bash
npm test
npm run test:e2e
```

The unit suite checks mathematical sections, rotations, degenerate intersections, gravity, collisions across W, settling, boundaries, and long-running numerical stability. The browser suite checks scene changes, toy creation and manipulation, slice visibility, controls, keyboard input, dialogs, and responsive layout. Playwright can start its own Vite server; run `npx playwright install chromium` if its Chromium runtime is not already installed.

Source structure: `geometry4d.ts` contains pure geometry; `physics.ts` contains the simulation; `sandbox.ts` owns rendering and pointer gestures; `main.ts` connects the interface and controls.

## Play online

[Play the hosted game](https://intrepion.github.io/kata-4d-toys-clone-astra-6-ultra/)

## Arcade metadata

See [docs/arcade-metadata.md](docs/arcade-metadata.md) for the game-owned manifest and screenshot provenance.
