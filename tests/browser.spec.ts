import { expect, test, type Page } from '@playwright/test';

type BodySnapshot = { id: number; kind: string; position: number[]; rotation: number[] };
type WorldSnapshot = {
  preset: string;
  sliceW: number;
  paused: boolean;
  gravity: boolean;
  wireframe: boolean;
  mode: 'grab' | 'rotate';
  selectedId: number | null;
  autoExplore: boolean;
  bodies: BodySnapshot[];
};
type ProjectedBody = { id: number; x: number; y: number; visible: boolean };

declare global {
  interface Window {
    __toybox: {
      getState(): WorldSnapshot;
      getProjectedBodies(): ProjectedBody[];
    };
  }
}

const state = (page: Page) => page.evaluate(() => window.__toybox.getState());
const runtimeErrors = new WeakMap<Page, string[]>();
const selectedBody = async (page: Page) => {
  const world = await state(page);
  return world.bodies.find(body => body.id === world.selectedId)!;
};

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  runtimeErrors.set(page, errors);
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('.sandbox-canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => Boolean(window.__toybox))).toBe(true);
});

test.afterEach(async ({ page }) => {
  expect(runtimeErrors.get(page), 'The playground should not throw uncaught browser errors').toEqual([]);
});

test('starts with visible toys and loads every playground with its matching world', async ({ page }) => {
  await expect(page.locator('#toy-count')).toHaveText('7');
  await expect(page.locator('#visible-count')).toHaveText('7');
  const presets = [
    { name: 'A balancing act', id: 'tower', count: 7, gravity: true },
    { name: 'The ball pit', id: 'ballpit', count: 12, gravity: true },
    { name: 'Zero gravity', id: 'orbit', count: 8, gravity: false },
    { name: 'The mixed bag', id: 'playground', count: 7, gravity: true },
  ];
  for (const preset of presets) {
    await page.getByRole('button', { name: preset.name, exact: true }).click();
    await expect(page.getByRole('heading', { name: `${preset.name}.`, exact: true })).toBeVisible();
    await expect(page.locator('#toy-count')).toHaveText(String(preset.count));
    const world = await state(page);
    expect(world.preset).toBe(preset.id);
    expect(world.bodies).toHaveLength(preset.count);
    expect(world.gravity).toBe(preset.gravity);
    expect(world.sliceW).toBe(0);
    expect(world.bodies.every(body => [...body.position, ...body.rotation].every(Number.isFinite))).toBe(true);
  }
});

test('adds each kind, edits its fourth position, rotates it, and removes the selection', async ({ page }) => {
  await page.getByRole('button', { name: 'Pause simulation', exact: true }).click();
  const shapes = [
    { name: 'Tesseract', kind: 'tesseract' },
    { name: 'Hypersphere', kind: 'hypersphere' },
    { name: '5-cell', kind: 'simplex' },
    { name: '16-cell', kind: 'orthoplex' },
  ];
  for (const shape of shapes) {
    await page.getByRole('button', { name: `Add ${shape.name}`, exact: true }).click();
    await expect(page.locator('#toy-count')).toHaveText('8');
    await expect(page.locator('#selected-name')).toHaveText(shape.name);
    const added = await selectedBody(page);
    expect(added.kind).toBe(shape.kind);

    const positionSlider = page.getByRole('slider', { name: 'Selected object fourth-dimensional position', exact: true });
    const maximumW = Number(await positionSlider.getAttribute('max'));
    await positionSlider.focus();
    await page.keyboard.press('End');
    await expect(page.locator('#object-w-value')).toHaveText(maximumW.toFixed(2));
    expect((await selectedBody(page)).position[3]).toBeCloseTo(maximumW, 2);
    await page.getByRole('button', { name: 'Turn in 4D', exact: true }).click();
    expect((await selectedBody(page)).rotation).not.toEqual(added.rotation);

    await page.getByRole('button', { name: 'Remove selected toy', exact: true }).click();
    await expect(page.locator('#toy-count')).toHaveText('7');
    await expect(page.locator('#selection-panel')).toBeHidden();
    expect((await state(page)).bodies.some(body => body.id === added.id)).toBe(false);
  }
});

test('pauses actual motion and connects gravity and wireframe toggles', async ({ page }) => {
  await page.getByRole('button', { name: 'Pause simulation', exact: true }).click();
  await page.getByRole('button', { name: 'Add Hypersphere', exact: true }).click();
  const body = await selectedBody(page);
  expect(body.position[1]).toBe(4.2);
  await page.getByRole('button', { name: 'Toggle wireframe', exact: true }).click();
  await page.getByRole('button', { name: 'Toggle gravity', exact: true }).click();
  expect(await state(page)).toMatchObject({ paused: true, gravity: false, wireframe: true });
  await expect(page.getByRole('button', { name: 'Toggle wireframe', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Toggle gravity', exact: true })).toHaveAttribute('aria-pressed', 'false');
  expect((await selectedBody(page)).position).toEqual(body.position);
  await page.getByRole('button', { name: 'Toggle gravity', exact: true }).click();
  await page.getByRole('button', { name: 'Resume simulation', exact: true }).click();
  await expect.poll(async () => (await selectedBody(page)).position[1]).toBeLessThan(3.8);
});

test('moves the 3D slice out of the toys, recovers them, and explores automatically', async ({ page }) => {
  await page.getByRole('button', { name: 'Pause simulation', exact: true }).click();
  await page.getByRole('slider', { name: 'Fourth-dimension slice position', exact: true }).focus();
  await page.keyboard.press('End');
  await expect(page.locator('#w-value')).toHaveText('w = +3.00');
  await expect(page.locator('#visible-count')).toHaveText('0');
  await expect(page.getByText('They’re still there.', { exact: true })).toBeVisible();
  expect((await state(page)).bodies).toHaveLength(7);
  await page.getByRole('button', { name: 'Back to the middle', exact: true }).click();
  await expect(page.locator('#visible-count')).toHaveText('7');
  await expect(page.locator('#empty-slice')).toBeHidden();
  await page.getByRole('button', { name: 'Auto explore', exact: true }).click();
  await expect.poll(async () => (await state(page)).sliceW).toBeGreaterThan(0.15);
  await page.getByRole('button', { name: 'Stop exploring', exact: true }).click();
  expect((await state(page)).autoExplore).toBe(false);
  await page.getByRole('button', { name: 'Reset scene', exact: true }).click();
  expect(await state(page)).toMatchObject({ sliceW: 0, paused: false, gravity: true, selectedId: null, autoExplore: false });
});

test('keeps a newly added hypersphere visible when adding at the fourth-dimensional boundary', async ({ page }) => {
  await page.getByRole('button', { name: 'Pause simulation', exact: true }).click();
  await page.getByRole('slider', { name: 'Fourth-dimension slice position', exact: true }).focus();
  await page.keyboard.press('End');
  await expect(page.locator('#visible-count')).toHaveText('0');
  await page.getByRole('button', { name: 'Add Hypersphere', exact: true }).click();
  const world = await state(page);
  const body = world.bodies.find(item => item.id === world.selectedId)!;
  expect(body.kind).toBe('hypersphere');
  expect(body.position[3]).toBeLessThanOrEqual(2.05);
  expect(world.sliceW).toBeCloseTo(body.position[3], 8);
  await expect.poll(() => page.evaluate(() => {
    const current = window.__toybox.getState();
    return window.__toybox.getProjectedBodies().find(item => item.id === current.selectedId)?.visible;
  })).toBe(true);
  await expect(page.locator('#empty-slice')).toBeHidden();
});

test('grabs a rendered toy and rotates it with pointer gestures', async ({ page }) => {
  await page.getByRole('button', { name: 'Pause simulation', exact: true }).click();
  const before = (await state(page)).bodies.find(body => body.id === 1)!;
  const first = await page.evaluate(() => window.__toybox.getProjectedBodies().find(body => body.id === 1)!);
  expect(first.visible).toBe(true);
  await page.mouse.move(first.x, first.y);
  await page.mouse.down();
  await page.mouse.move(first.x + 85, first.y - 45, { steps: 12 });
  await page.mouse.up();
  const moved = await selectedBody(page);
  expect(moved.id).toBe(before.id);
  expect(Math.hypot(...moved.position.map((value, axis) => value - before.position[axis]))).toBeGreaterThan(0.3);
  await expect(page.locator('#selected-name')).toHaveText('Tesseract');

  await page.getByRole('button', { name: '4D rotate', exact: true }).click();
  const next = await page.evaluate(() => window.__toybox.getProjectedBodies().find(body => body.id === 1)!);
  await page.mouse.move(next.x, next.y);
  await page.mouse.down();
  await page.mouse.move(next.x + 65, next.y + 35, { steps: 10 });
  await page.mouse.up();
  const rotated = await selectedBody(page);
  expect(rotated.id).toBe(before.id);
  expect(Math.abs(rotated.rotation[0] - moved.rotation[0])).toBeGreaterThan(0.3);
  expect(Math.abs(rotated.rotation[2] - moved.rotation[2])).toBeGreaterThan(0.15);
  expect(rotated.position).toEqual(moved.position);
});

test('supports keyboard shortcuts and keeps the guide modal isolated', async ({ page }) => {
  await page.locator('.sandbox-canvas').focus();
  await page.keyboard.press('Space');
  expect((await state(page)).paused).toBe(true);
  await page.keyboard.press('t');
  expect((await state(page)).mode).toBe('rotate');
  await page.keyboard.press('g');
  expect((await state(page)).mode).toBe('grab');
  await page.keyboard.press('v');
  expect((await state(page)).wireframe).toBe(true);
  await page.keyboard.press('ArrowRight');
  expect((await state(page)).sliceW).toBeCloseTo(0.08);
  await page.getByRole('button', { name: 'How to play', exact: true }).click();
  await expect(page.locator('#help-dialog')).toBeVisible();
  await page.keyboard.press('r');
  expect((await state(page)).sliceW).toBeCloseTo(0.08);
  await page.keyboard.press('Escape');
  await expect(page.locator('#help-dialog')).toBeHidden();
  await page.locator('.sandbox-canvas').focus();
  await page.keyboard.press('r');
  expect((await state(page)).sliceW).toBe(0);
  expect((await state(page)).paused).toBe(false);
  await page.getByRole('button', { name: 'Add Tesseract', exact: true }).click();
  await page.locator('.sandbox-canvas').focus();
  await page.keyboard.press('Delete');
  await expect(page.locator('#toy-count')).toHaveText('7');
  expect((await state(page)).selectedId).toBeNull();
  await page.getByRole('button', { name: 'A small window into a bigger world', exact: true }).click();
  await expect(page.locator('#about-dialog')).toBeVisible();
  await expect(page.getByRole('link', { name: '4D Toys by mtb design works, inc.' })).toHaveAttribute('href', 'https://www.4dtoys.com/');
});

test('keeps the mobile playground within the viewport and its controls usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.locator('.sandbox-canvas')).toBeVisible();
  await page.getByRole('button', { name: 'Add 16-cell', exact: true }).click();
  await expect(page.locator('#toy-count')).toHaveText('8');
  await page.getByRole('button', { name: 'Close object details', exact: true }).click();
  await page.getByRole('button', { name: 'Auto explore', exact: true }).click();
  await expect.poll(async () => (await state(page)).sliceW).toBeGreaterThan(0.1);
  await page.getByRole('button', { name: 'Stop exploring', exact: true }).click();
  await page.getByRole('button', { name: 'How to play', exact: true }).click();
  await expect(page.locator('#help-dialog')).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Let’s play', exact: true }).click();
  await expect(page.locator('#help-dialog')).toBeHidden();
});
