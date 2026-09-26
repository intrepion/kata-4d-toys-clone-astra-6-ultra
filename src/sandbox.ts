import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { sliceShape } from './geometry4d';
import { getBodyBounds, stepPhysics, type ToyBody } from './physics';

type Callbacks = {
  onSelect: (body: ToyBody | null) => void;
  onStats: (visible: number, total: number) => void;
};

type ToyView = {
  group: THREE.Group;
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhysicalMaterial>;
  edges: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  shadow: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  ring: THREE.LineLoop<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  key: string;
  bottom: number;
  radius: number;
};

type Gesture = {
  pointerId: number;
  body: ToyBody;
  plane: THREE.Plane;
  offset: THREE.Vector3;
  previous: THREE.Vector3;
  time: number;
  velocity: THREE.Vector3;
  startX: number;
  startY: number;
  rotation: [number, number, number];
  wasLocked: boolean | undefined;
  moved: boolean;
};

/** A real 3D section of a small, four-dimensional physics world. */
export class Sandbox {
  public bodies: ToyBody[] = [];
  public sliceW = 0;
  public gravity = true;
  public paused = false;
  public wireframe = false;
  public mode: 'grab' | 'rotate' = 'grab';
  public selectedId: number | null = null;

  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-8, 8, 6, -6, 0.1, 100);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly controls: OrbitControls;
  private readonly views = new Map<number, ToyView>();
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly contactTexture = this.makeContactTexture();
  private readonly resizeObserver: ResizeObserver;
  private gesture: Gesture | null = null;
  private frame = 0;
  private lastTime = 0;
  private lastStats = '';
  private disposed = false;
  private framedHeight = 12;

  constructor(private readonly container: HTMLElement, private readonly callbacks: Callbacks) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.className = 'sandbox-canvas';
    this.renderer.domElement.setAttribute('aria-label', 'Interactive 4D toy sandbox. Drag a shape to move it; drag the background to orbit; scroll to zoom.');
    this.renderer.domElement.setAttribute('role', 'img');
    this.renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;outline:none;';
    this.renderer.domElement.tabIndex = 0;
    container.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color('#f5f6f8');
    this.scene.fog = new THREE.Fog('#f5f6f8', 26, 65);
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#b4b8ca', 1.7));
    const sunlight = new THREE.DirectionalLight('#fff9ee', 3);
    sunlight.position.set(-6, 13, 7);
    sunlight.castShadow = true;
    sunlight.shadow.mapSize.set(2048, 2048);
    sunlight.shadow.camera.left = -10;
    sunlight.shadow.camera.right = 10;
    sunlight.shadow.camera.top = 10;
    sunlight.shadow.camera.bottom = -10;
    sunlight.shadow.camera.near = 1;
    sunlight.shadow.camera.far = 35;
    sunlight.shadow.normalBias = 0.045;
    sunlight.shadow.bias = -0.0002;
    sunlight.shadow.radius = 4;
    this.scene.add(sunlight);
    const fill = new THREE.DirectionalLight('#dbe6ff', 0.7);
    fill.position.set(8, 6, -8);
    this.scene.add(fill);
    this.makeTable();

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.09;
    this.controls.enablePan = false;
    this.controls.minPolarAngle = 0.2;
    this.controls.maxPolarAngle = 1.37;
    this.controls.minZoom = 0.65;
    this.controls.maxZoom = 2.3;
    this.controls.rotateSpeed = 0.6;
    this.controls.zoomSpeed = 0.75;
    this.controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
    this.resetCamera();

    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown, true);
    this.renderer.domElement.addEventListener('pointermove', this.onPointerMove, true);
    this.renderer.domElement.addEventListener('pointerup', this.onPointerUp, true);
    this.renderer.domElement.addEventListener('pointercancel', this.onPointerCancel, true);
    this.renderer.domElement.addEventListener('lostpointercapture', this.onPointerCancel);
    this.renderer.domElement.addEventListener('contextmenu', this.onContextMenu);
    window.addEventListener('blur', this.onWindowBlur);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.frame = requestAnimationFrame(this.animate);
  }

  public setBodies(bodies: ToyBody[]): void {
    this.finishGesture(false);
    for (const view of this.views.values()) this.destroyView(view);
    this.views.clear();
    this.bodies = bodies;
    this.selectedId = null;
    this.callbacks.onSelect(null);
    this.syncViews();
    this.resetCamera();
  }

  public addBody(body: ToyBody): void {
    this.bodies.push(body);
    this.selectedId = body.id;
    this.callbacks.onSelect(body);
    this.syncViews();
  }

  public removeSelected(): void {
    if (this.selectedId === null) return;
    if (this.gesture?.body.id === this.selectedId) this.finishGesture(false);
    const view = this.views.get(this.selectedId);
    if (view) this.destroyView(view);
    this.views.delete(this.selectedId);
    this.bodies = this.bodies.filter(body => body.id !== this.selectedId);
    this.selectedId = null;
    this.callbacks.onSelect(null);
    this.syncViews();
  }

  public resetCamera(): void {
    let highestPoint = 0;
    for (const body of this.bodies) {
      const view = this.views.get(body.id);
      const top = body.kind === 'hypersphere'
        ? view?.radius ?? body.size
        : view?.mesh.geometry.boundingBox?.max.y ?? body.size / 2;
      highestPoint = Math.max(highestPoint, body.position[1] + top);
    }
    const targetHeight = Math.max(0.55, (highestPoint - 2) * 0.59);
    this.framedHeight = Math.max(12, highestPoint * 1.7 + 4);
    this.camera.position.set(9, 9.45 + targetHeight, 13);
    this.camera.zoom = 1;
    this.camera.lookAt(0, targetHeight, 0);
    if (this.controls) {
      this.controls.target.set(0, targetHeight, 0);
      this.controls.update();
    }
    this.resize();
  }

  public setSlice(value: number): void { this.sliceW = value; }
  public setWireframe(value: boolean): void { this.wireframe = value; }
  public setMode(mode: 'grab' | 'rotate'): void {
    this.finishGesture(false);
    this.mode = mode;
    this.renderer.domElement.style.cursor = mode === 'rotate' ? 'crosshair' : 'grab';
  }
  public setGravity(value: boolean): void { this.gravity = value; }
  public setPaused(value: boolean): void { this.paused = value; }

  public getProjectedBodies(): { id: number; x: number; y: number; visible: boolean }[] {
    const bounds = this.renderer.domElement.getBoundingClientRect();
    return this.bodies.map(body => {
      const point = new THREE.Vector3(body.position[0], body.position[1], body.position[2]).project(this.camera);
      return {
        id: body.id,
        x: bounds.left + (point.x + 1) * bounds.width / 2,
        y: bounds.top + (1 - point.y) * bounds.height / 2,
        visible: this.views.get(body.id)?.group.visible ?? false,
      };
    });
  }

  public rotateSelected(): void {
    const body = this.bodies.find(item => item.id === this.selectedId);
    if (!body) return;
    body.rotation[0] += Math.PI / 8;
    body.rotation[2] += Math.PI / 12;
    body.angularVelocity[0] = 0;
    body.angularVelocity[2] = 0;
  }

  public scatter(): void {
    this.finishGesture(false);
    for (const body of this.bodies) {
      if (body.locked) continue;
      body.velocity = [(Math.random() - 0.5) * 6, 3.5 + Math.random() * 3, (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 1.3];
      body.angularVelocity = [(Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 1.2];
    }
  }

  private makeTable(): void {
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: '#f5f6f8', roughness: 1 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.28;
    floor.receiveShadow = true;
    this.scene.add(floor);

    const width = 11.4;
    const depth = 8.8;
    const radius = 0.22;
    const x = -width / 2;
    const y = -depth / 2;
    const shape = new THREE.Shape();
    shape.moveTo(x + radius, y);
    shape.lineTo(x + width - radius, y);
    shape.quadraticCurveTo(x + width, y, x + width, y + radius);
    shape.lineTo(x + width, y + depth - radius);
    shape.quadraticCurveTo(x + width, y + depth, x + width - radius, y + depth);
    shape.lineTo(x + radius, y + depth);
    shape.quadraticCurveTo(x, y + depth, x, y + depth - radius);
    shape.lineTo(x, y + radius);
    shape.quadraticCurveTo(x, y, x + radius, y);
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.18, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 0.025, bevelThickness: 0.025, curveSegments: 8 });
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, -0.205, 0);
    const table = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: '#f7f8fa', roughness: 0.93, metalness: 0 }));
    table.castShadow = true;
    table.receiveShadow = true;
    this.scene.add(table);

    const grid: number[] = [];
    for (let gx = -5; gx <= 5; gx += 0.5) grid.push(gx, 0.006, -4, gx, 0.006, 4);
    for (let gz = -4; gz <= 4; gz += 0.5) grid.push(-5, 0.006, gz, 5, 0.006, gz);
    const gridGeometry = new THREE.BufferGeometry();
    gridGeometry.setAttribute('position', new THREE.Float32BufferAttribute(grid, 3));
    const gridLines = new THREE.LineSegments(gridGeometry, new THREE.LineBasicMaterial({ color: '#b8c4d3', transparent: true, opacity: 0.31, depthWrite: false }));
    this.scene.add(gridLines);

    const border = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-5, 0.008, -4), new THREE.Vector3(5, 0.008, -4), new THREE.Vector3(5, 0.008, 4), new THREE.Vector3(-5, 0.008, 4)]),
      new THREE.LineBasicMaterial({ color: '#b0bccb', transparent: true, opacity: 0.42 }),
    );
    this.scene.add(border);
  }

  private makeContactTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const context = canvas.getContext('2d')!;
    const gradient = context.createRadialGradient(64, 64, 6, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(50,57,77,0.42)');
    gradient.addColorStop(0.42, 'rgba(50,57,77,0.20)');
    gradient.addColorStop(1, 'rgba(50,57,77,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(canvas);
  }

  private createView(body: ToyBody): ToyView {
    const group = new THREE.Group();
    const material = new THREE.MeshPhysicalMaterial({ color: body.color, roughness: 0.53, metalness: 0, clearcoat: 0.1, clearcoatRoughness: 0.7, flatShading: body.kind !== 'hypersphere' });
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.bodyId = body.id;
    const edgeMaterial = new THREE.LineBasicMaterial({ color: new THREE.Color(body.color).multiplyScalar(0.62), transparent: true, opacity: 0.35 });
    const edges = new THREE.LineSegments(new THREE.BufferGeometry(), edgeMaterial);
    group.add(mesh, edges);
    this.scene.add(group);

    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.contactTexture, transparent: true, opacity: 0.62, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.016;
    this.scene.add(shadow);

    const ringPoints: THREE.Vector3[] = [];
    for (let index = 0; index < 80; index++) {
      const angle = index / 80 * Math.PI * 2;
      ringPoints.push(new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)));
    }
    const ring = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(ringPoints), new THREE.LineBasicMaterial({ color: '#7c8df6', transparent: true, opacity: 0.7, depthWrite: false }));
    ring.position.y = 0.023;
    ring.visible = false;
    this.scene.add(ring);
    return { group, mesh, edges, shadow, ring, key: '', bottom: -body.size / 2, radius: body.size };
  }

  private syncViews(): void {
    let visible = 0;
    for (const body of this.bodies) {
      let view = this.views.get(body.id);
      if (!view) {
        view = this.createView(body);
        this.views.set(body.id, view);
      }
      const offset = this.sliceW - body.position[3];
      const key = `${body.kind}:${body.size}:${offset.toFixed(4)}:${body.rotation.map(value => value.toFixed(4)).join(':')}`;
      if (view.key !== key) {
        view.key = key;
        const section = sliceShape(body.kind, body.size, body.rotation, offset);
        if (body.kind === 'hypersphere' && section.radius !== undefined && section.radius > 0.003) {
          if (view.mesh.geometry.type !== 'SphereGeometry') {
            view.mesh.geometry.dispose();
            view.mesh.geometry = new THREE.SphereGeometry(1, 40, 28);
            view.edges.geometry.dispose();
            view.edges.geometry = new THREE.BufferGeometry();
          }
          view.mesh.scale.setScalar(section.radius);
          view.radius = section.radius;
          view.bottom = -section.radius;
          view.group.visible = true;
        } else if (section.points.length >= 4) {
          try {
            const geometry = new ConvexGeometry(section.points.map(point => new THREE.Vector3(...point)));
            geometry.computeBoundingSphere();
            geometry.computeBoundingBox();
            view.mesh.geometry.dispose();
            view.mesh.geometry = geometry;
            view.mesh.scale.setScalar(1);
            view.edges.geometry.dispose();
            view.edges.geometry = new THREE.EdgesGeometry(geometry, 10);
            view.radius = geometry.boundingSphere?.radius ?? body.size;
            view.bottom = geometry.boundingBox?.min.y ?? -body.size / 2;
            view.group.visible = true;
          } catch {
            view.group.visible = false;
          }
        } else {
          view.group.visible = false;
        }
      }
      view.group.position.set(body.position[0], body.position[1], body.position[2]);
      view.mesh.material.wireframe = this.wireframe;
      view.mesh.material.color.set(body.color);
      view.edges.visible = !this.wireframe;
      view.edges.material.color.set(body.color).multiplyScalar(0.62);
      view.edges.material.opacity = body.id === this.selectedId ? 0.7 : 0.32;
      view.shadow.visible = view.group.visible;
      view.shadow.position.set(body.position[0], 0.016, body.position[2]);
      const height = Math.max(0, body.position[1] + view.bottom);
      const contactScale = Math.max(0.55, view.radius * 2.05) + height * 0.16;
      view.shadow.scale.set(contactScale, contactScale, 1);
      view.shadow.material.opacity = 0.64 / (1 + height * 1.1);
      view.ring.visible = view.group.visible && body.id === this.selectedId;
      view.ring.position.set(body.position[0], 0.023, body.position[2]);
      view.ring.scale.setScalar(Math.max(0.55, view.radius * 0.93));
      if (view.group.visible) visible++;
    }
    const stats = `${visible}:${this.bodies.length}`;
    if (stats !== this.lastStats) {
      this.lastStats = stats;
      this.callbacks.onStats(visible, this.bodies.length);
    }
  }

  private resize(): void {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    const aspect = width / height;
    const viewHeight = Math.max(this.framedHeight, aspect < 1.15 ? 15.5 / Math.max(aspect, 0.55) : 12);
    this.camera.left = -viewHeight * aspect / 2;
    this.camera.right = viewHeight * aspect / 2;
    this.camera.top = viewHeight / 2;
    this.camera.bottom = -viewHeight / 2;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  private updateRay(event: PointerEvent): void {
    const bounds = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
  }

  private pickBody(event: PointerEvent): ToyBody | undefined {
    this.updateRay(event);
    const meshes = [...this.views.values()].filter(view => view.group.visible).map(view => view.mesh);
    const intersection = this.raycaster.intersectObjects(meshes, false)[0];
    return intersection ? this.bodies.find(body => body.id === intersection.object.userData.bodyId) : undefined;
  }

  private onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 || this.gesture) return;
    this.renderer.domElement.focus({ preventScroll: true });
    const body = this.pickBody(event);
    this.selectedId = body?.id ?? null;
    this.callbacks.onSelect(body ?? null);
    if (!body) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    this.controls.enabled = false;
    const normal = this.camera.getWorldDirection(new THREE.Vector3());
    const center = new THREE.Vector3(body.position[0], body.position[1], body.position[2]);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, center);
    const hit = this.raycaster.ray.intersectPlane(plane, new THREE.Vector3()) ?? center.clone();
    this.gesture = {
      pointerId: event.pointerId, body, plane, offset: center.clone().sub(hit), previous: center.clone(),
      time: performance.now(), velocity: new THREE.Vector3(), startX: event.clientX, startY: event.clientY,
      rotation: [...body.rotation], wasLocked: body.locked, moved: false,
    };
    body.locked = true;
    body.velocity = [0, 0, 0, 0];
    this.renderer.domElement.setPointerCapture(event.pointerId);
    this.renderer.domElement.style.cursor = this.mode === 'rotate' ? 'crosshair' : 'grabbing';
  };

  private onPointerMove = (event: PointerEvent): void => {
    const gesture = this.gesture;
    if (!gesture) {
      if (event.pointerType === 'mouse') this.renderer.domElement.style.cursor = this.pickBody(event) ? (this.mode === 'rotate' ? 'crosshair' : 'grab') : 'grab';
      return;
    }
    if (event.pointerId !== gesture.pointerId) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    gesture.moved ||= Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) > 3;
    if (this.mode === 'rotate') {
      gesture.body.rotation[0] = gesture.rotation[0] + (event.clientX - gesture.startX) * 0.008;
      gesture.body.rotation[2] = gesture.rotation[2] + (event.clientY - gesture.startY) * 0.008;
      gesture.body.angularVelocity = [0, 0, 0];
      return;
    }
    this.updateRay(event);
    const hit = this.raycaster.ray.intersectPlane(gesture.plane, new THREE.Vector3());
    if (!hit) return;
    hit.add(gesture.offset);
    const bounds = getBodyBounds(gesture.body);
    hit.x = THREE.MathUtils.clamp(hit.x, -bounds.x, bounds.x);
    hit.y = THREE.MathUtils.clamp(hit.y, bounds.yMin, 8);
    hit.z = THREE.MathUtils.clamp(hit.z, -bounds.z, bounds.z);
    const now = performance.now();
    const elapsed = Math.max(0.008, (now - gesture.time) / 1000);
    const velocity = hit.clone().sub(gesture.previous).divideScalar(elapsed).clampLength(0, 12);
    gesture.velocity.lerp(velocity, 0.55);
    gesture.previous.copy(hit);
    gesture.time = now;
    gesture.body.position[0] = hit.x;
    gesture.body.position[1] = hit.y;
    gesture.body.position[2] = hit.z;
  };

  private onPointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.gesture?.pointerId) return;
    event.stopImmediatePropagation();
    this.finishGesture(true);
  };

  private onPointerCancel = (event: PointerEvent): void => {
    if (event.pointerId === this.gesture?.pointerId) this.finishGesture(false);
  };

  private onWindowBlur = (): void => { this.finishGesture(false); };
  private onContextMenu = (event: Event): void => { event.preventDefault(); };

  private finishGesture(throwBody: boolean): void {
    const gesture = this.gesture;
    if (!gesture) return;
    this.gesture = null;
    gesture.body.locked = gesture.wasLocked;
    const velocity = throwBody && gesture.moved && this.mode === 'grab' && performance.now() - gesture.time < 100 ? gesture.velocity : new THREE.Vector3();
    gesture.body.velocity = [velocity.x, velocity.y, velocity.z, 0];
    this.controls.enabled = true;
    if (this.renderer.domElement.hasPointerCapture(gesture.pointerId)) this.renderer.domElement.releasePointerCapture(gesture.pointerId);
    this.renderer.domElement.style.cursor = this.mode === 'rotate' ? 'crosshair' : 'grab';
  }

  private animate = (time: number): void => {
    if (this.disposed) return;
    const elapsed = this.lastTime ? Math.min((time - this.lastTime) / 1000, 0.05) : 0;
    this.lastTime = time;
    if (!this.paused && elapsed > 0) stepPhysics(this.bodies, elapsed, this.gravity);
    this.syncViews();
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.frame = requestAnimationFrame(this.animate);
  };

  private destroyView(view: ToyView): void {
    this.scene.remove(view.group, view.shadow, view.ring);
    view.mesh.geometry.dispose();
    view.mesh.material.dispose();
    view.edges.geometry.dispose();
    view.edges.material.dispose();
    view.shadow.geometry.dispose();
    view.shadow.material.dispose();
    view.ring.geometry.dispose();
    view.ring.material.dispose();
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.finishGesture(false);
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.renderer.domElement.removeEventListener('pointerdown', this.onPointerDown, true);
    this.renderer.domElement.removeEventListener('pointermove', this.onPointerMove, true);
    this.renderer.domElement.removeEventListener('pointerup', this.onPointerUp, true);
    this.renderer.domElement.removeEventListener('pointercancel', this.onPointerCancel, true);
    this.renderer.domElement.removeEventListener('lostpointercapture', this.onPointerCancel);
    this.renderer.domElement.removeEventListener('contextmenu', this.onContextMenu);
    window.removeEventListener('blur', this.onWindowBlur);
    for (const view of this.views.values()) this.destroyView(view);
    this.views.clear();
    this.scene.traverse(object => {
      if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments || object instanceof THREE.LineLoop) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) material.dispose();
      }
      if (object instanceof THREE.DirectionalLight) object.shadow.dispose();
    });
    this.contactTexture.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
