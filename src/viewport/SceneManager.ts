import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { DEFAULT_GRID_SIZE_M, viewportScale, type ViewportScale } from '@/domain/workspace';

const GRID_CENTRE_COLOR = 0x4a4030;
const GRID_LINE_COLOR = 0x6b5f48;

/**
 * Owns the renderer, camera, lights and the render loop. Every numeric value
 * here is fixed by the design spec — changing any of them changes the approved
 * look of the piece. The ones that depend on how big the world is come from
 * `viewportScale` instead, so they stay consistent with the chosen grid.
 */
export class SceneManager {
  readonly scene = new THREE.Scene();
  readonly renderer: THREE.WebGLRenderer;
  readonly controls: OrbitControls;
  /** Every manufactured or purchased part shares one selectable scene group. */
  readonly partsGroup = new THREE.Group();
  /** Identity is stable across grid changes — PickController raycasts this for drops. */
  readonly ground: THREE.Mesh;
  /** Rebuilt on a grid-size change, since divisions cannot be scaled. */
  private grid!: THREE.GridHelper;

  private readonly perspective: THREE.PerspectiveCamera;
  private readonly orthographic: THREE.OrthographicCamera;
  private active: THREE.PerspectiveCamera | THREE.OrthographicCamera;
  private panMode = false;
  private orthoFrustumHeight = 2;
  private readonly key: THREE.DirectionalLight;
  private scale: ViewportScale | null = null;
  private readonly resizeObserver: ResizeObserver;
  private readonly beforeRender = new Set<() => void>();
  private rafId: number | null = null;
  private disposed = false;

  constructor(private readonly container: HTMLElement) {
    // near/far and every other world-scale number are set by setGridSize below.
    this.perspective = new THREE.PerspectiveCamera(
      35,
      container.clientWidth / container.clientHeight || 1,
      0.1,
      50,
    );
    this.perspective.position.set(2.5, 1.5, 2.7);
    this.orthographic = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 50);
    this.active = this.perspective;

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      // Required for toDataURL PNG export to capture a non-blank frame.
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    // A filtered map produces a soft studio-shadow edge rather than the
    // visibly stepped default PCF shadow used by the initial prototype.
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.perspective, this.renderer.domElement);
    this.controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.target.set(0, 0.4, 0);
    // Keeps the camera from dropping below the floor plane.
    this.controls.maxPolarAngle = Math.PI * 0.49;

    const hemi = new THREE.HemisphereLight(0xfff4e6, 0x3a3229, 1.0);
    this.key = new THREE.DirectionalLight(0xfff2df, 2.4);
    this.key.position.set(3, 5, 2.2);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(2048, 2048);
    this.key.shadow.bias = -0.0002;
    this.key.shadow.normalBias = 0.003;
    this.key.shadow.camera.near = 0.1;
    const fill = new THREE.DirectionalLight(0xdfe8ff, 0.35);
    fill.position.set(-3, 2, -2);
    this.scene.add(hemi, this.key, fill);

    // Geometry is sized by setGridSize; this placeholder is disposed there.
    this.ground = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.ShadowMaterial({ opacity: 0.17 }),
    );
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);

    this.scene.add(this.partsGroup);

    // The one code path for every world-scale number, initial setup included.
    this.setGridSize(DEFAULT_GRID_SIZE_M);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.start();
  }

  onBeforeRender(fn: () => void): () => void {
    this.beforeRender.add(fn);
    return () => this.beforeRender.delete(fn);
  }

  setGridVisible(visible: boolean): void {
    this.grid.visible = visible;
  }

  /** The camera currently driving the renderer, picking, and gizmos. */
  get camera(): THREE.PerspectiveCamera | THREE.OrthographicCamera {
    return this.active;
  }

  get isOrthographic(): boolean {
    return this.active === this.orthographic;
  }

  /** The scale every world-size-dependent number is currently derived from. */
  get viewportScale(): ViewportScale {
    return this.scale ?? viewportScale(DEFAULT_GRID_SIZE_M);
  }

  /**
   * Applies a grid size and everything that scales with it. Called once from
   * the constructor, so the initial scene and a later user change go through
   * exactly one code path rather than two copies of the same literals.
   */
  setGridSize(gridSizeM: number): void {
    const next = viewportScale(gridSizeM);
    if (this.scale?.gridSizeM === next.gridSizeM) return;
    this.scale = next;

    // Divisions change with size, so the helper is rebuilt rather than scaled —
    // scaling would stretch the 100 mm cells that match Shift-held gizmo snap.
    // Visibility is carried across, or changing size in Render mode (or with
    // the grid toggled off) would pop the grid back on.
    const visible = this.grid?.visible ?? true;
    if (this.grid) {
      this.scene.remove(this.grid);
      this.grid.geometry.dispose();
      (this.grid.material as THREE.Material).dispose();
    }
    this.grid = new THREE.GridHelper(
      next.gridSizeM,
      next.divisions,
      GRID_CENTRE_COLOR,
      GRID_LINE_COLOR,
    );
    const gridMaterial = this.grid.material as THREE.Material;
    gridMaterial.transparent = true;
    gridMaterial.opacity = 0.65;
    this.grid.visible = visible;
    this.scene.add(this.grid);

    // Only the geometry is replaced — PickController holds this mesh.
    this.ground.geometry.dispose();
    this.ground.geometry = new THREE.PlaneGeometry(next.groundSize, next.groundSize);

    const shadowCamera = this.key.shadow.camera;
    shadowCamera.left = -next.shadowExtent;
    shadowCamera.right = next.shadowExtent;
    shadowCamera.top = next.shadowExtent;
    shadowCamera.bottom = -next.shadowExtent;
    shadowCamera.far = next.shadowFar;
    shadowCamera.updateProjectionMatrix();

    this.controls.minDistance = next.minDistance;
    this.controls.maxDistance = next.maxDistance;

    this.perspective.far = next.cameraFar;
    this.orthographic.far = next.cameraFar;
    this.perspective.updateProjectionMatrix();
    this.orthographic.updateProjectionMatrix();
  }

  /** Pan tool swaps the orbit control's left mouse button to panning. */
  setPanMode(pan: boolean): void {
    this.panMode = pan;
    this.applyPointerButtons();
  }

  /**
   * Restores the perspective ¾ camera. Copies the current viewpoint so a
   * following flight can ease out of an elevation rather than jumping.
   */
  usePerspective(): void {
    if (this.active === this.perspective) {
      this.applyPointerButtons();
      return;
    }
    this.perspective.position.copy(this.orthographic.position);
    this.perspective.up.set(0, 1, 0);
    this.perspective.lookAt(this.controls.target);
    this.active = this.perspective;
    this.controls.object = this.perspective;
    this.controls.enableRotate = true;
    this.applyPointerButtons();
    this.perspective.updateProjectionMatrix();
  }

  /**
   * Switches to a locked orthographic elevation/plan. Left-drag pans; orbit
   * is off so the view cannot tilt back into perspective.
   */
  useOrthographic(
    position: THREE.Vector3,
    target: THREE.Vector3,
    up: THREE.Vector3,
    frustumHeight: number,
  ): void {
    this.orthoFrustumHeight = frustumHeight;
    this.orthographic.up.copy(up);
    this.orthographic.position.copy(position);
    this.orthographic.lookAt(target);
    this.orthographic.zoom = 1;
    this.controls.target.copy(target);
    this.applyOrthoFrustum();
    this.active = this.orthographic;
    this.controls.object = this.orthographic;
    this.controls.enableRotate = false;
    this.applyPointerButtons();
  }

  private applyPointerButtons(): void {
    this.controls.mouseButtons.LEFT =
      this.panMode || this.active === this.orthographic ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE;
  }

  private applyOrthoFrustum(): void {
    const aspect = this.container.clientWidth / this.container.clientHeight || 1;
    const halfH = this.orthoFrustumHeight / 2;
    const halfW = halfH * aspect;
    this.orthographic.left = -halfW;
    this.orthographic.right = halfW;
    this.orthographic.top = halfH;
    this.orthographic.bottom = -halfH;
    this.orthographic.updateProjectionMatrix();
  }

  resize(): void {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w < 1 || h < 1) return;
    this.renderer.setSize(w, h);
    this.perspective.aspect = w / h;
    this.perspective.updateProjectionMatrix();
    this.applyOrthoFrustum();
  }

  /** Renders one frame synchronously — used before reading back a PNG. */
  renderNow(): void {
    this.renderer.render(this.scene, this.camera);
  }

  private start(): void {
    const loop = () => {
      if (this.disposed) return;
      this.rafId = requestAnimationFrame(loop);
      this.controls.update();
      for (const fn of this.beforeRender) fn();
      this.renderer.render(this.scene, this.camera);
    };
    loop();
  }

  /**
   * The prototype released only the RAF and observer, leaking a GL context on
   * every hot reload. This tears the context down properly.
   */
  dispose(): void {
    this.disposed = true;
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.resizeObserver.disconnect();
    this.beforeRender.clear();
    this.controls.dispose();
    this.ground.geometry.dispose();
    (this.ground.material as THREE.Material).dispose();
    this.grid.geometry.dispose();
    (this.grid.material as THREE.Material).dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }
}
