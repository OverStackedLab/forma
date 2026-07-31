import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/**
 * Owns the renderer, camera, lights and the render loop. Every numeric value
 * here is fixed by the design spec — changing any of them changes the approved
 * look of the piece.
 */
export class SceneManager {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  readonly controls: OrbitControls;
  /** Every part in the scene is a library panel, so they all share one group. */
  readonly partsGroup = new THREE.Group();
  readonly ground: THREE.Mesh;
  readonly grid: THREE.GridHelper;

  private readonly resizeObserver: ResizeObserver;
  private readonly beforeRender = new Set<() => void>();
  private rafId: number | null = null;
  private disposed = false;

  constructor(private readonly container: HTMLElement) {
    this.camera = new THREE.PerspectiveCamera(
      35,
      container.clientWidth / container.clientHeight || 1,
      0.1,
      50,
    );
    this.camera.position.set(2.5, 1.5, 2.7);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      // Required for toDataURL PNG export to capture a non-blank frame.
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.target.set(0, 0.4, 0);
    this.controls.minDistance = 1.2;
    this.controls.maxDistance = 7;
    // Keeps the camera from dropping below the floor plane.
    this.controls.maxPolarAngle = Math.PI * 0.49;

    const hemi = new THREE.HemisphereLight(0xfff4e6, 0x3a3229, 1.0);
    const key = new THREE.DirectionalLight(0xfff2df, 2.4);
    key.position.set(3, 5, 2.2);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 12;
    const fill = new THREE.DirectionalLight(0xdfe8ff, 0.35);
    fill.position.set(-3, 2, -2);
    this.scene.add(hemi, key, fill);

    this.ground = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 12),
      new THREE.ShadowMaterial({ opacity: 0.24 }),
    );
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);

    // 4 m across in 40 divisions — 100 mm cells.
    this.grid = new THREE.GridHelper(4, 40, 0x4a4030, 0x6b5f48);
    const gridMaterial = this.grid.material as THREE.Material;
    gridMaterial.transparent = true;
    gridMaterial.opacity = 0.65;
    this.scene.add(this.grid);

    this.scene.add(this.partsGroup);

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

  /** Pan tool swaps the orbit control's left mouse button to panning. */
  setPanMode(pan: boolean): void {
    this.controls.mouseButtons.LEFT = pan ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE;
  }

  resize(): void {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w < 1 || h < 1) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
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
