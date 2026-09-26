const paths: Record<string, string> = {
  hand: '<path d="M8 13V6a2 2 0 0 1 4 0v6-8a2 2 0 0 1 4 0v8-6a2 2 0 0 1 4 0v8c0 5-3 8-7 8-3 0-5-2-7-5l-3-4a2 2 0 0 1 3-2l2 2Z"/>',
  rotate: '<path d="M20 8a8 8 0 1 0 0 8M20 3v5h-5"/>',
  cube: '<path d="m12 3 9 5v9l-9 5-9-5V8l9-5Zm0 10 9-5M12 13 3 8m9 5v9"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',
  gravity: '<path d="M12 3v12m-5-5 5 5 5-5M5 20h14"/>',
  play: '<path d="m8 4 12 8-12 8V4Z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 5m0 3h.01"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  volume:
    '<path d="m11 4-6 5H2v6h3l6 5V4Zm4 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  muted: '<path d="m11 4-6 5H2v6h3l6 5V4Zm5 5 5 6m0-6-5 6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  trash: '<path d="M4 7h16M9 7V3h6v4M6 7l1 14h10l1-14M10 11v6m4-6v6"/>',
  move: '<path d="M12 3v18M3 12h18M8 7l4-4 4 4M8 17l4 4 4-4M7 8l-4 4 4 4m10-8 4 4-4 4"/>',
  mouse: '<rect x="6" y="2" width="12" height="20" rx="6"/><path d="M12 2v7"/>',
  keyboard:
    '<rect x="2" y="5" width="20" height="14" rx="3"/><path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 13h.01M10 13h.01M14 13h.01M18 13h.01M8 16h8"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  sparkle:
    '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z"/>',
  camera:
    '<path d="M8 6 10 3h4l2 3h5v14H3V6h5Z"/><circle cx="12" cy="12" r="4"/>',
  target:
    '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3"/>',
  shuffle:
    '<path d="M3 5h3c5 0 7 14 12 14h3m-5-5 5 5-5 3M3 19h3c2 0 3-2 5-5m2-4c2-3 3-5 5-5h3m-5-3 5 3-5 5"/>',
};
export const icon = (name: string, className = "") =>
  `<svg class="icon ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.cube}</svg>`;
export const logo = `<svg viewBox="0 0 44 44" fill="none" aria-hidden="true"><path d="m22 3 17 10v19L22 42 5 32V13L22 3Z" fill="#eee9ff"/><g stroke="#8064d6" stroke-width="1.65" stroke-linejoin="round"><path d="m22 4 16 9v18l-16 9-16-9V13l16-9Z"/><path d="m6 13 16 9 16-9M22 22v18m-9-23v11l9 5 9-5V17l-9-5-9 5Zm0 0 9 5 9-5m-18 11 9-6 9 6"/></g></svg>`;

export function toyArt(kind: string, color = ""): string {
  const start = '<svg viewBox="0 0 100 78" fill="none" aria-hidden="true">';
  if (kind === "tesseract")
    return `${start}<ellipse cx="50" cy="69" rx="25" ry="5" fill="#527bd5" opacity=".1"/><path d="m50 9 29 16v32L50 73 21 57V25L50 9Z" fill="${color || "#82a6ed"}"/><path d="m21 25 29 17 29-17-29-16-29 16Z" fill="#b4cdf9"/><path d="M50 42v31l29-16V25L50 42Z" fill="#658bda"/><path d="m33 31 17-9 17 9v20l-17 9-17-9V31Zm0 0 17 10 17-10M50 41v19" stroke="#e6efff" stroke-width="1.6" opacity=".85"/></svg>`;
  if (kind === "hypersphere")
    return `${start}<defs><radialGradient id="sphereGrad" cx=".3" cy=".22" r=".8"><stop stop-color="#f6b5a0"/><stop offset=".6" stop-color="#ee8d76"/><stop offset="1" stop-color="#d96652"/></radialGradient></defs><ellipse cx="50" cy="70" rx="26" ry="4" fill="#d76b55" opacity=".12"/><circle cx="50" cy="39" r="29" fill="url(#sphereGrad)"/><ellipse cx="50" cy="39" rx="29" ry="10" stroke="#ffd7c6" stroke-width="1.3" stroke-dasharray="3 3" opacity=".8"/></svg>`;
  if (kind === "simplex")
    return `${start}<ellipse cx="50" cy="70" rx="27" ry="4" fill="#ba9129" opacity=".12"/><path d="m48 6 35 55-39 11-27-19L48 6Z" fill="#edc464"/><path d="m48 6-4 66-27-19L48 6Z" fill="#f6d986"/><path d="m48 6-4 66 39-11L48 6Z" fill="#d9aa41"/><path d="m48 6-4 66m0 0 39-11M44 72 17 53" stroke="#fff0c4" stroke-width="1.4"/></svg>`;
  return `${start}<ellipse cx="50" cy="71" rx="25" ry="4" fill="#8a6dc3" opacity=".12"/><path d="m50 5 31 33-31 35-31-35L50 5Z" fill="#baa0df"/><path d="m50 5 5 37 26-4L50 5Z" fill="#b391d7"/><path d="m50 5 5 37-36-4L50 5Z" fill="#d0b9ed"/><path d="m55 42-5 31 31-35-26 4Z" fill="#8c6cba"/><path d="m19 38 36 4-5 31-31-35Z" fill="#aa86cf"/><path d="m50 5 5 37-5 31M19 38l36 4 26-4" stroke="#e5d6f8" stroke-width="1.3"/></svg>`;
}
