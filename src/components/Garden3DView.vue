<template>
  <div class="garden-3d" ref="rootRef">
    <div class="favorites-overlay" v-if="favoritePlants && favoritePlants.length">
      <FavoritesTray
        :favorite-plants="favoritePlants"
        :selected-plant-id="selectedPlantId ?? null"
        :is-mobile="isMobile ?? false"
        :loading="loading ?? false"
        :image-url="imageUrlResolved"
        :spread-feet-label="spreadFeetLabelResolved"
        :spread-cells="spreadCellsResolved"
        :plant-counts="plantCounts"
        :interaction-hint="(isMobile ?? false) ? 'tap' : 'click'"
        @select="(id) => emit('select-plant', id)"
      />

      <!-- 3D-only controls (shared toolbar lives in GardenPlanner) -->
      <div class="overlay-3d-controls" aria-label="3D view controls">
        <button class="overlay-button" type="button" @click="resetView" aria-label="Reset camera view">
          Reset view
        </button>
        <button class="overlay-button" type="button" @click="setViewPreset('top')" aria-label="Top-down view">
          Top
        </button>
        <button class="overlay-button" type="button" @click="cycleSideView" aria-label="Side view (cycle)">
          Side
        </button>
      </div>

      <div v-if="selectedPlantId && (isMobile ?? false) === false" class="place-hint" aria-live="polite">
        Placement mode: click the ground to add another
      </div>
    </div>

    <!-- Action buttons overlay for selected plant (similar to 2D mode) -->
    <div v-if="selected && actionButtonsPosition" class="plant-actions-3d" :style="actionButtonsStyle">
      <button
        class="action-button-3d duplicate-button"
        type="button"
        @click.stop="handleDuplicate"
        title="Duplicate plant"
        aria-label="Duplicate plant"
      >
        <Copy :size="18" />
      </button>
      <button
        class="action-button-3d delete-button"
        type="button"
        @click.stop="handleDelete"
        title="Delete plant"
        aria-label="Delete plant"
      >
        <Trash2 :size="18" />
      </button>
    </div>

    <div ref="threeContainer" class="canvas"></div>
  </div>
</template>

<script setup lang="ts">
import { computed, shallowRef, onMounted, onUnmounted, ref, watch } from 'vue';
// @ts-ignore - project TS tooling struggles with modern package exports; runtime bundling works.
import * as THREE from 'three';
// @ts-ignore - project TS tooling struggles with modern package exports; runtime bundling works.
import CameraControls from 'camera-controls';
import { Copy, Trash2 } from 'lucide-vue-next';
import type { Plant, PlacedPlant } from '../types/garden';
import FavoritesTray from './FavoritesTray.vue';

// THREE.js classes are now extended globally in main.js

if (typeof window !== 'undefined') {
  const wAny = /** @type {any} */ (window);
  console.log('Garden3DView: WebGL support detected', {
    webgl: !!wAny.WebGLRenderingContext,
    webgl2: !!wAny.WebGL2RenderingContext
  });
  
  // Test WebGL context creation
  const canvas = document.createElement('canvas');
  const gl: any = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  console.log('Garden3DView: WebGL context test', {
    contextCreated: !!gl,
    renderer: gl ? gl.getParameter(gl.RENDERER) : null,
    vendor: gl ? gl.getParameter(gl.VENDOR) : null
  });
}

const props = defineProps<{
  placedPlants: PlacedPlant[];
  plantById: Record<string, Plant>;
  gridWidth: number;
  gridHeight: number;
  snapIncrement: number;
  imageUrl?: (plant: Plant | undefined, preview: boolean) => string;
  favoritePlants?: Plant[];
  selectedPlantId?: string | null;
  isMobile?: boolean;
  loading?: boolean;
  spreadFeetLabel?: (plant: Plant | undefined) => string;
  spreadCells?: (plant: Plant | undefined) => number;
  plantCounts?: Record<string, number>;
  labelMode?: 'off' | 'all';
  zoom?: number;
  addRowTop: () => void;
  removeRowTop: () => void;
  addRowBottom: () => void;
  removeRowBottom: () => void;
  addColumnLeft: () => void;
  removeColumnLeft: () => void;
  addColumnRight: () => void;
  removeColumnRight: () => void;
}>();

const emit = defineEmits<{
  (e: 'move-placed', placedId: string, x: number, y: number): void;
  (e: 'remove-placed', placedId: string): void;
  (e: 'select-plant', plantId: string | null): void;
  (e: 'place-plant', plantId: string, x: number, y: number): void;
  (e: 'update:zoom', value: number): void;
}>();

const favoritePlants = computed(() => props.favoritePlants ?? []);
const selectedPlantId = computed(() => props.selectedPlantId ?? null);
const plantCounts = computed(() => props.plantCounts ?? undefined);

const imageUrlResolved = (plant: Plant | undefined, preview: boolean) => {
  return props.imageUrl ? props.imageUrl(plant, preview) : '/assets/images/missing-image.png';
};
const spreadFeetLabelResolved = (plant: Plant | undefined) => {
  if (props.spreadFeetLabel) return props.spreadFeetLabel(plant);
  // fallback: best-effort
  const plantAny = plant ? /** @type {any} */ (plant) : null;
  const raw = plantAny ? plantAny['Spread (feet)'] : null;
  const num = parseFloat(String(raw));
  if (!Number.isFinite(num) || num <= 0) return '1';
  return raw && typeof raw === 'string' ? raw : `${num}`;
};
const spreadCellsResolved = (plant: Plant | undefined) => {
  if (props.spreadCells) return props.spreadCells(plant);
  const plantAny = plant ? /** @type {any} */ (plant) : null;
  const raw = plantAny ? plantAny['Spread (feet)'] : null;
  const num = parseFloat(String(raw));
  if (!Number.isFinite(num) || num <= 0) return 1;
  return Math.max(1, Math.round(num));
};

const instancesRef = shallowRef<any>(null);
const orbitRef = shallowRef<any>(null);
const rootRef = ref<HTMLElement | null>(null);
const threeContainer = ref<HTMLElement | null>(null);
let resizeControlsGroup: THREE.Group | null = null;
let resizeControlMeshes: THREE.Mesh[] = [];

type ResizeAction =
  | 'addRowTop'
  | 'removeRowTop'
  | 'addRowBottom'
  | 'removeRowBottom'
  | 'addColumnLeft'
  | 'removeColumnLeft'
  | 'addColumnRight'
  | 'removeColumnRight';

const makeResizeButtonTexture = (label: string) => {
  const canvas = document.createElement('canvas');
  // Higher resolution helps keep +/- crisp in 3D (especially at slight angles).
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Background (white rounded square + subtle border), matching the 2D controls style.
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(255,255,255,0.98)';
  ctx.strokeStyle = '#d1d5db';
  ctx.lineWidth = 16;
  drawRoundedRect(ctx, 28, 28, canvas.width - 56, canvas.height - 56, 56);
  ctx.fill();
  ctx.stroke();

  // Label
  ctx.fillStyle = '#374151';
  ctx.font = 'bold 280px Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, canvas.width / 2, canvas.height / 2 + 10);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  // Sharpen sampling (avoid mipmap blur on tiny UI glyphs)
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.NearestFilter;
  // Improves crispness at grazing angles when the camera isn't perfectly top-down.
  const maxAniso = renderer?.capabilities.getMaxAnisotropy?.() ?? 1;
  texture.anisotropy = Math.min(16, Math.max(1, maxAniso));
  texture.needsUpdate = true;
  return texture;
};

const disposeResizeControls = () => {
  if (!scene) return;
  if (resizeControlsGroup) {
    scene.remove(resizeControlsGroup);
  }
  for (const m of resizeControlMeshes) {
    try {
      m.geometry?.dispose?.();
      const mat = m.material;
      const disposeMat = (mm: THREE.Material) => {
        const anyMat = mm as any;
        if (anyMat?.map && typeof anyMat.map.dispose === 'function') anyMat.map.dispose();
        if (typeof mm.dispose === 'function') mm.dispose();
      };
      if (Array.isArray(mat)) mat.forEach(disposeMat);
      else disposeMat(mat);
    } catch {
      // ignore
    }
  }
  resizeControlMeshes = [];
  resizeControlsGroup = null;
};

const buildResizeControls = () => {
  if (!scene) return;
  disposeResizeControls();

  const group = new THREE.Group();
  group.name = 'ResizeControls';

  const buttonSize = 0.9; // feet (world units)
  const spacing = 1.05; // center-to-center for the +/- pair
  // Place controls just OUTSIDE the grid edge (to match 2D "outside" buttons).
  // "Hugging" the edge means the button is adjacent to the boundary, not inside the grid.
  const outside = buttonSize / 2 + 0.12;
  const y = 0.02; // lift slightly above ground to avoid z-fighting

  const mkButton = (label: '+' | '−', action: ResizeAction) => {
    const tex = makeResizeButtonTexture(label);
    const geom = new THREE.PlaneGeometry(buttonSize, buttonSize);
    const mat = new THREE.MeshBasicMaterial({
      map: tex ?? undefined,
      transparent: true,
      opacity: 1,
      depthTest: true,
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = y;
    mesh.userData = { ...(mesh.userData || {}), resizeAction: action };
    resizeControlMeshes.push(mesh);
    group.add(mesh);
    return mesh;
  };

  const centerX = props.gridWidth / 2;
  const centerZ = props.gridHeight / 2;

  // Top edge (z near 0)
  const topPlus = mkButton('+', 'addRowTop');
  const topMinus = mkButton('−', 'removeRowTop');
  topPlus.position.set(centerX - spacing / 2, y, -outside);
  topMinus.position.set(centerX + spacing / 2, y, -outside);

  // Bottom edge (z near height)
  const botPlus = mkButton('+', 'addRowBottom');
  const botMinus = mkButton('−', 'removeRowBottom');
  botPlus.position.set(centerX - spacing / 2, y, props.gridHeight + outside);
  botMinus.position.set(centerX + spacing / 2, y, props.gridHeight + outside);

  // Left edge (x near 0) - stacked along Z
  const leftPlus = mkButton('+', 'addColumnLeft');
  const leftMinus = mkButton('−', 'removeColumnLeft');
  leftPlus.position.set(-outside, y, centerZ - spacing / 2);
  leftMinus.position.set(-outside, y, centerZ + spacing / 2);

  // Right edge (x near width)
  const rightPlus = mkButton('+', 'addColumnRight');
  const rightMinus = mkButton('−', 'removeColumnRight');
  rightPlus.position.set(props.gridWidth + outside, y, centerZ - spacing / 2);
  rightMinus.position.set(props.gridWidth + outside, y, centerZ + spacing / 2);

  resizeControlsGroup = group;
  scene.add(group);
};

const pickResizeActionUnderPointer = (ev: PointerEvent): ResizeAction | null => {
  if (!renderer || !camera || !raycaster || !mouseNdc) return null;
  if (!resizeControlMeshes.length) return null;
  const rect = renderer.domElement.getBoundingClientRect();
  mouseNdc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
  mouseNdc.y = -(((ev.clientY - rect.top) / rect.height) * 2 - 1);
  raycaster.setFromCamera(mouseNdc, camera);
  const hits = raycaster.intersectObjects(resizeControlMeshes, false);
  if (!hits.length) return null;
  const action = /** @type {any} */ (hits[0].object)?.userData?.resizeAction;
  return typeof action === 'string' ? (action as ResizeAction) : null;
};

// Three.js objects
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let renderer: THREE.WebGLRenderer | null = null;
let controls: any = null;
let clock: THREE.Clock | null = null;
let raycaster: THREE.Raycaster | null = null;
let mouseNdc: THREE.Vector2 | null = null;
let resizeObserver: ResizeObserver | null = null;
let groundMesh: THREE.Mesh | null = null;
let gridMesh: THREE.Mesh | null = null;
let gridHelperObj: THREE.GridHelper | null = null;

type PlantInstanceMeta = {
  placed: PlacedPlant;
  plant: Plant | undefined;
  mesh: THREE.Mesh;
  label?: THREE.Sprite;
  center: THREE.Vector3;
  heightFeet: number;
  spreadFeet: number;
};

const placedIdToInstance = new Map<string, PlantInstanceMeta>();
const plantIdToPlacedIds = new Map<string, string[]>();

let selectionRing: THREE.Mesh | null = null;
let hoveredObject: THREE.Object3D | null = null;
let selectedObject: THREE.Mesh | null = null;
let pointerDownAt: { x: number; y: number } | null = null;
let pointerDragging = false;
let dragCandidatePlacedId: string | null = null;
let dragPlacedId: string | null = null;
let dragOffsetXZ: { dx: number; dz: number } | null = null;
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

// Spacebar pan state
const isSpacebarHeld = ref(false);

const gridSize = computed(() => Math.max(props.gridWidth, props.gridHeight));
const gridDivisions = computed(() => Math.max(1, Math.round(gridSize.value)));

const target = computed(() => new THREE.Vector3(props.gridWidth / 2, 0, props.gridHeight / 2));
const cameraPosition = computed(() => {
  const d = Math.max(props.gridWidth, props.gridHeight);
  return new THREE.Vector3(props.gridWidth / 2 + d * 0.6, d * 0.9, props.gridHeight / 2 + d * 0.9);
});

const minDistance = computed(() => Math.max(4, gridSize.value * 0.25));
const maxDistance = computed(() => Math.max(25, gridSize.value * 4));

const cylinderGeometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 12, 1, false);
const cylinderMaterial = new THREE.MeshStandardMaterial({ vertexColors: true });

const groundColor = new THREE.Color('#ffffff');

const GRID_OUTSIDE_BG = '#f5f5f5'; // matches 2D .grid-scroll background
const GRID_LINE_COLOR = 'rgba(0, 0, 0, 0.15)'; // matches 2D gridline color

const make2DStyleGridTexture = (widthFt: number, heightFt: number, snapIncrementFt: number): THREE.CanvasTexture => {
  const maxCanvas = 2048;
  const maxDimFt = Math.max(1, Math.max(widthFt, heightFt));
  const pxPerFt = clamp(Math.floor(maxCanvas / maxDimFt), 16, 64);

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(256, Math.round(widthFt * pxPerFt));
  canvas.height = Math.max(256, Math.round(heightFt * pxPerFt));

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    const fallback = new THREE.CanvasTexture(canvas);
    fallback.colorSpace = THREE.SRGBColorSpace;
    return fallback;
  }

  // White background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Grid lines based on snap increment (0.5ft or 1ft)
  ctx.strokeStyle = GRID_LINE_COLOR;
  ctx.lineWidth = 1;

  // Grid spacing in pixels based on snap increment
  const xStep = pxPerFt * snapIncrementFt;
  const yStep = pxPerFt * snapIncrementFt;

  for (let x = 0; x <= canvas.width; x += xStep) {
    const xx = Math.round(x) + 0.5;
    ctx.beginPath();
    ctx.moveTo(xx, 0);
    ctx.lineTo(xx, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y <= canvas.height; y += yStep) {
    const yy = Math.round(y) + 0.5;
    ctx.beginPath();
    ctx.moveTo(0, yy);
    ctx.lineTo(canvas.width, yy);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = Math.min(8, renderer?.capabilities.getMaxAnisotropy?.() ?? 1);
  texture.needsUpdate = true;
  return texture;
};

type SelectedInfo = {
  placedId: string;
  plantId: string;
  commonName: string;
  scientificName?: string;
  heightFeet?: number;
  spreadFeet?: number;
};

const selected = shallowRef<SelectedInfo | null>(null);
const selectedImageSrc = computed(() => {
  if (!selected.value || !props.imageUrl) return null;
  const plant = props.plantById[selected.value.plantId];
  if (!plant) return null;
  return props.imageUrl(plant, true);
});

// Position for action buttons overlay (screen coordinates)
const actionButtonsPosition = ref<{ x: number; y: number } | null>(null);

// Compute style for action buttons overlay
const actionButtonsStyle = computed(() => {
  if (!actionButtonsPosition.value) {
    return { display: 'none' as const };
  }
  return {
    position: 'absolute' as const,
    left: `${actionButtonsPosition.value.x}px`,
    top: `${actionButtonsPosition.value.y}px`,
    transform: 'translate(-50%, -50%)',
  };
});

const instanceCount = computed(() => props.placedPlants.length);

// 2D-like zoom controls for 3D camera (based on camera distance to target)
const baseDistance = ref<number | null>(null);
type ViewMode = 'top' | 'side';
const viewMode = ref<ViewMode>('top');
const sideIndex = ref(0);

const getCameraDistance = (): number | null => {
  if (!controls || !camera) return null;
  try {
    if (typeof controls.getDistance === 'function') {
      const d = controls.getDistance();
      return Number.isFinite(d) ? d : null;
    }
  } catch {
    // ignore
  }
  const curTarget = new THREE.Vector3();
  const curPos = new THREE.Vector3();
  controls.getTarget?.(curTarget);
  controls.getPosition?.(curPos);
  const d = curPos.distanceTo(curTarget);
  return Number.isFinite(d) ? d : null;
};

// When shared zoom changes (2D zoom scale), convert to camera distance (3D dolly)
watch(
  () => props.zoom,
  (z) => {
    if (!controls) return;
    const current = getCameraDistance();
    if (!baseDistance.value && current) baseDistance.value = current;
    const base = baseDistance.value;
    if (!base) return;
    const zoomVal = typeof z === 'number' ? z : 1;
    const nextDistance = base / clamp(zoomVal, 0.5, 2);
    setCameraDistance(nextDistance, true);
  }
);

const setCameraDistance = (nextDistance: number, smooth = true) => {
  if (!controls || !camera) return;
  const curTarget = new THREE.Vector3();
  const curPos = new THREE.Vector3();
  controls.getTarget?.(curTarget);
  controls.getPosition?.(curPos);

  const dir = curPos.clone().sub(curTarget);
  if (dir.lengthSq() < 1e-8) dir.set(1, 1, 1);
  dir.normalize();

  const d = clamp(nextDistance, minDistance.value, maxDistance.value);
  const nextPos = curTarget.clone().add(dir.multiplyScalar(d));
  controls.setLookAt(
    nextPos.x,
    nextPos.y,
    nextPos.z,
    curTarget.x,
    curTarget.y,
    curTarget.z,
    smooth
  );
};

// Note: zoom UI removed; zoom is still possible via mouse/trackpad via CameraControls.

// Plant legend removed (Favorites tray now serves as the left-side plant list)

type LabelMode = 'off' | 'all';
const labelMode = computed<LabelMode>(() => props.labelMode ?? 'off');
const labelModeLabel = computed(() => {
  if (labelMode.value === 'off') return 'Off';
  return 'On';
});

watch(() => props.labelMode, () => applyLabelMode());

const parseFeet = (v: unknown): number | null => {
  if (v === null || v === undefined) return null;
  const str = String(v).trim();
  if (str === '' || str === 'null' || str === 'undefined') return null;
  
  // Handle ranges like "2-4" -> take average
  if (str.includes('-')) {
    const parts = str.split('-');
    if (parts.length === 2) {
      const min = parseFloat(parts[0]);
      const max = parseFloat(parts[1]);
      if (Number.isFinite(min) && Number.isFinite(max)) {
        return (min + max) / 2;
      }
    }
  }
  
  const n = parseFloat(str);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

const formatCoord = (value: number, increment: number): string => {
  if (increment === 0.5) {
    // Show one decimal place for 0.5ft snap, but remove .0 for whole numbers
    if (value % 1 === 0) return Math.round(value).toString();
    return value.toFixed(1);
  }
  return Math.round(value).toString();
};

const centerPositionLabel = (placed: PlacedPlant): string => {
  const centerX = placed.x + placed.width / 2;
  const centerY = placed.y + placed.height / 2;
  return `${formatCoord(centerX, props.snapIncrement)},${formatCoord(centerY, props.snapIncrement)}`;
};

const shortLabel = (s: string, maxLen: number) => (s.length > maxLen ? s.slice(0, Math.max(0, maxLen - 1)) + '…' : s);

const drawRoundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) => {
  const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
};

const initThreeJS = () => {
  if (!threeContainer.value) return;

  const container = threeContainer.value;
  const rect = container.getBoundingClientRect();
  
  // Scene
  scene = new THREE.Scene();
  // Match the planner's neutral canvas so this feels like a true "3D mode"
  scene.background = new THREE.Color(GRID_OUTSIDE_BG);

  // Camera - positioned based on garden size and plant heights
  const maxHeight = Math.max(...props.placedPlants.map(placed => {
    const plant = props.plantById[placed.plantId];
    const heightFeetRaw = plant ? plant['Height (feet)'] : null;
    return parseFeet(heightFeetRaw) ?? 1;
  }));
  
  const avgHeight = maxHeight > 0 ? maxHeight : 3;
  const cameraHeight = Math.max(15, avgHeight * 2 + 10); // Ensure camera is well above tallest plants
  const cameraDistance = Math.max(props.gridWidth, props.gridHeight) * 0.8;
  
  camera = new THREE.PerspectiveCamera(50, rect.width / rect.height, 0.1, 1000);
  camera.position.set(
    props.gridWidth / 2 + cameraDistance,
    cameraHeight,
    props.gridHeight / 2 + cameraDistance
  );
  camera.lookAt(props.gridWidth / 2, avgHeight / 2, props.gridHeight / 2);

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(rect.width, rect.height);
  // Color management for correct texture appearance
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // Match 2D "true white" UI: disable tone mapping so white stays white.
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.toneMappingExposure = 1.0;
  // No shadows (match 2D flat look)
  renderer.shadowMap.enabled = false;
  container.appendChild(renderer.domElement);
  clock = new THREE.Clock();

  // CameraControls (camera-controls) setup
  try {
    CameraControls.install({ THREE });
  } catch {
    // ignore (install is idempotent, but some bundlers can throw on repeat)
  }

  // Lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(10, 20, 10);
  directionalLight.castShadow = false;
  scene.add(directionalLight);


  const rebuildGroundAndGrid = () => {
    if (!scene) return;

    if (groundMesh) {
      scene.remove(groundMesh);
      groundMesh.geometry?.dispose?.();
      const matAny = /** @type {any} */ (groundMesh.material);
      if (Array.isArray(matAny)) matAny.forEach((m: any) => m?.dispose?.());
      else matAny?.dispose?.();
      groundMesh = null;
    }

    if (gridMesh) {
      scene.remove(gridMesh);
      gridMesh.geometry?.dispose?.();
      const matAny = /** @type {any} */ (gridMesh.material);
      const disposeMat = (m: any) => {
        if (m?.map && typeof m.map.dispose === 'function') m.map.dispose();
        m?.dispose?.();
      };
      if (Array.isArray(matAny)) matAny.forEach(disposeMat);
      else disposeMat(matAny);
      gridMesh = null;
    }

    if (gridHelperObj) {
      scene.remove(gridHelperObj);
      gridHelperObj.geometry?.dispose?.();
      const matAny = /** @type {any} */ (gridHelperObj.material);
      if (Array.isArray(matAny)) matAny.forEach((m: any) => m?.dispose?.());
      else matAny?.dispose?.();
      gridHelperObj = null;
    }

    // No separate "background slab" mesh. Outside-of-grid area is just the scene background color.
    groundMesh = null;

    // Grid plane: pure white + subtle grey lines (matches 2D)
    const gridGeometry = new THREE.PlaneGeometry(props.gridWidth, props.gridHeight);
    const gridTexture = make2DStyleGridTexture(props.gridWidth, props.gridHeight, props.snapIncrement);
    const gridMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      map: gridTexture,
      toneMapped: false,
    });
    gridMesh = new THREE.Mesh(gridGeometry, gridMaterial);
    gridMesh.rotation.x = -Math.PI / 2;
    gridMesh.position.set(props.gridWidth / 2, 0.001, props.gridHeight / 2);
    scene.add(gridMesh);
  };

  // Ground + Grid
  rebuildGroundAndGrid();

  // 3D edge resize controls (physical buttons on the ground)
  buildResizeControls();

  // Selection ring
  const ringGeo = new THREE.RingGeometry(0.45, 0.5, 48);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x111827, transparent: true, opacity: 0.65, side: THREE.DoubleSide });
  selectionRing = new THREE.Mesh(ringGeo, ringMat);
  selectionRing.rotation.x = -Math.PI / 2;
  selectionRing.visible = false;
  scene.add(selectionRing);

  // Add plants
  addPlants();

  // Controls
  if (camera && renderer) {
    controls = new CameraControls(camera, renderer.domElement);

    // Smooth, modern feel (and avoids "twitchy" camera).
    controls.smoothTime = 0.22;
    controls.draggingSmoothTime = 0.14;

    // Set up mouse button mappings
    const ACTION = /** @type {any} */ (CameraControls).ACTION;
    if (ACTION && controls.mouseButtons) {
      controls.mouseButtons.left = ACTION.ROTATE; // Default: left click rotates/orbits
      controls.mouseButtons.right = ACTION.NONE; // Right click disabled
      controls.mouseButtons.wheel = ACTION.DOLLY; // Scroll wheel zooms
    }

    // Lock so the user cannot orbit under the scene (no "under plants" view).
    // Camera-controls uses the same polar-angle concept as OrbitControls.
    controls.minPolarAngle = 0.05; // allow nearly-top-down
    controls.maxPolarAngle = Math.PI / 2 - 0.08; // stop at horizon (no below-ground)

    // Dolly bounds
    controls.minDistance = minDistance.value;
    controls.maxDistance = maxDistance.value;
    controls.dollyToCursor = true;

    // Seamless "2D -> 3D": start in Top view so it matches 2D immediately.
    applyViewPresetInstant('top');
    baseDistance.value = getCameraDistance();
  }

  raycaster = new THREE.Raycaster();
  mouseNdc = new THREE.Vector2();

  renderer.domElement.addEventListener('pointermove', onPointerMove, { passive: true });
  renderer.domElement.addEventListener('pointerdown', onPointerDown, { passive: true });
  renderer.domElement.addEventListener('pointerup', onPointerUp, { passive: true });
  
  // Track spacebar for panning
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);

  // Resize handling
  const handleResize = () => {
    if (!renderer || !camera || !threeContainer.value) return;
    const r = threeContainer.value.getBoundingClientRect();
    renderer.setSize(r.width, r.height);
    camera.aspect = r.width / r.height;
    camera.updateProjectionMatrix();
  };
  resizeObserver = new ResizeObserver(handleResize);
  resizeObserver.observe(container);

  // Start render loop
  animate();

  console.log('Garden3DView: Three.js initialized successfully');
};

// Keep ground/grid + controls bounds in sync when garden size or snap increment changes
watch(
  () => [props.gridWidth, props.gridHeight, props.snapIncrement],
  (nextVals, prevVals) => {
    const nextW = nextVals[0];
    const nextH = nextVals[1];
    const prevW = prevVals[0];
    const prevH = prevVals[1];
    if (!scene) return;

    // Rebuild ground + grid helper to match new dimensions
    if (groundMesh) {
      scene.remove(groundMesh);
      groundMesh.geometry?.dispose?.();
      const matAny = /** @type {any} */ (groundMesh.material);
      if (Array.isArray(matAny)) matAny.forEach((m: any) => m?.dispose?.());
      else matAny?.dispose?.();
      groundMesh = null;
    }
    if (gridMesh) {
      scene.remove(gridMesh);
      gridMesh.geometry?.dispose?.();
      const matAny = /** @type {any} */ (gridMesh.material);
      const disposeMat = (m: any) => {
        if (m?.map && typeof m.map.dispose === 'function') m.map.dispose();
        m?.dispose?.();
      };
      if (Array.isArray(matAny)) matAny.forEach(disposeMat);
      else disposeMat(matAny);
      gridMesh = null;
    }
    if (gridHelperObj) {
      scene.remove(gridHelperObj);
      gridHelperObj.geometry?.dispose?.();
      const matAny = /** @type {any} */ (gridHelperObj.material);
      if (Array.isArray(matAny)) matAny.forEach((m: any) => m?.dispose?.());
      else matAny?.dispose?.();
      gridHelperObj = null;
    }

    // Re-create using the latest values (2D-matching visuals)
    // No separate "background slab" mesh. Outside-of-grid area is just the scene background color.
    groundMesh = null;

    const gridGeometry = new THREE.PlaneGeometry(props.gridWidth, props.gridHeight);
    const gridTexture = make2DStyleGridTexture(props.gridWidth, props.gridHeight, props.snapIncrement);
    const gridMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      map: gridTexture,
      toneMapped: false,
    });
    gridMesh = new THREE.Mesh(gridGeometry, gridMaterial);
    gridMesh.rotation.x = -Math.PI / 2;
    gridMesh.position.set(props.gridWidth / 2, 0.001, props.gridHeight / 2);
    scene.add(gridMesh);

    // Keep 3D edge resize controls in sync with the new dimensions
    buildResizeControls();

    // Update zoom bounds to match new garden size
    if (controls) {
      controls.minDistance = minDistance.value;
      controls.maxDistance = maxDistance.value;
    }

    // Keep the camera centered on the grid after resize so the change is visually obvious.
    // Shift current camera position + target by the change in grid center.
    if (controls && camera && Number.isFinite(prevW) && Number.isFinite(prevH)) {
      const dx = (nextW - prevW) / 2;
      const dz = (nextH - prevH) / 2;
      if (Math.abs(dx) > 1e-6 || Math.abs(dz) > 1e-6) {
        const curTarget = new THREE.Vector3();
        const curPos = new THREE.Vector3();
        controls.getTarget?.(curTarget);
        controls.getPosition?.(curPos);
        const nextTarget = curTarget.clone().add(new THREE.Vector3(dx, 0, dz));
        const nextPos = curPos.clone().add(new THREE.Vector3(dx, 0, dz));
        controls.setLookAt(
          nextPos.x,
          nextPos.y,
          nextPos.z,
          nextTarget.x,
          nextTarget.y,
          nextTarget.z,
          true
        );
        baseDistance.value = getCameraDistance();
      }
    }
  }
);

const disposeMeshMaterials = (mesh: THREE.Mesh) => {
  const mat = /** @type {any} */ (mesh.material);
  const disposeMat = (m: any) => {
    if (!m) return;
    if (m.map && typeof m.map.dispose === 'function') m.map.dispose();
    if (typeof m.dispose === 'function') m.dispose();
  };
  if (Array.isArray(mat)) mat.forEach(disposeMat);
  else disposeMat(mat);
};

const clearPlantInstances = () => {
  if (!scene) return;
  for (const meta of placedIdToInstance.values()) {
    scene.remove(meta.mesh);
    disposeMeshMaterials(meta.mesh);
    if (meta.label) {
      scene.remove(meta.label);
    const mat = /** @type {any} */ (meta.label.material);
      if (mat.map) mat.map.dispose();
      mat.dispose();
    }
  }
  placedIdToInstance.clear();
  plantIdToPlacedIds.clear();

  hoveredObject = null;
  selectedObject = null;
  selected.value = null;
  actionButtonsPosition.value = null;
  setSelectionRing(null);
};

// Keep meshes in sync when parent state changes (undo/redo/clear, etc.)
const syncFromProps = () => {
  if (!scene) return;

  const nextIds = new Set(props.placedPlants.map(p => p.id));
  // Remove any instances that no longer exist
  for (const [placedId, meta] of placedIdToInstance.entries()) {
    if (nextIds.has(placedId)) continue;
    scene.remove(meta.mesh);
    disposeMeshMaterials(meta.mesh);
    placedIdToInstance.delete(placedId);
  }

  // Add or update
  for (const placed of props.placedPlants) {
    const plant = props.plantById[placed.plantId];
    const plantAny = /** @type {any} */ (plant);
    const heightFeetRaw = plant ? plantAny['Height (feet)'] : null;
    const heightFeet = parseFeet(heightFeetRaw) ?? 1;
    const cappedHeight = Math.max(heightFeet, 0.1);
    const spreadFeet = placed.width;

    // Center of footprint
    const x = placed.x + placed.width / 2;
    const z = placed.y + placed.height / 2;
    const y = cappedHeight / 2;

    const existing = placedIdToInstance.get(placed.id);
    if (!existing) {
      // Structural change (new item) -> easiest: rebuild all once
      // (keeps logic centralized, avoids partial texture state edge cases)
      addPlants();
      return;
    }

    // Update meta + mesh transform
    existing.placed = placed;
    existing.plant = plant;
    existing.heightFeet = cappedHeight;
    existing.spreadFeet = spreadFeet;
    existing.center.set(x, y, z);

    existing.mesh.position.set(x, y, z);
    existing.mesh.scale.set(spreadFeet, cappedHeight, spreadFeet);
  }

  // Keep selection ring aligned if selection is active
  if (selected.value) {
    const meta = placedIdToInstance.get(selected.value.placedId);
    if (meta) {
      setSelectionRing(meta);
      updateActionButtonsPosition(meta);
    }
  }
};

watch(
  () => props.placedPlants,
  () => syncFromProps(),
  { deep: true }
);

const addPlants = () => {
  const s = scene;
  if (!s) return;

  // Rebuild: remove any existing plant meshes/labels before re-adding.
  clearPlantInstances();

  props.placedPlants.forEach((placed) => {
    const plant = props.plantById[placed.plantId];
    const spreadFeet = placed.width;
    const heightFeetRaw = plant ? plant['Height (feet)'] : null;
    const heightFeet = parseFeet(heightFeetRaw) ?? 1;
    const cappedHeight = Math.max(heightFeet, 0.1);

    // Center of footprint
    const x = placed.x + placed.width / 2;
    const z = placed.y + placed.height / 2;
    const y = cappedHeight / 2;

    const family = plant && typeof plant['Plant Family'] === 'string' ? plant['Plant Family'] : 'Unknown';
    const fallbackColor = hashToColor(String(family || 'Unknown'));
    
    // Create plant cylinder with image texture
    if (plant && props.imageUrl) {
      createPlantWithTexture(plant, cylinderGeometry, x, y, z, spreadFeet, cappedHeight, placed, fallbackColor);
    } else {
      // Fallback to colored cylinder
      const material = new THREE.MeshStandardMaterial({ 
        color: fallbackColor,
        roughness: 0.7,
        metalness: 0.1
      });
      const mesh = new THREE.Mesh(cylinderGeometry, material);
      mesh.position.set(x, y, z);
      mesh.scale.set(spreadFeet, cappedHeight, spreadFeet);
      mesh.userData = { plantId: placed.plantId, placedId: placed.id };
      s.add(mesh);

      registerInstance(mesh, placed, plant, x, y, z, spreadFeet, cappedHeight);
    }

    // Labels are handled later (declutter / selected-only)
  });
};

const createPlantWithTexture = (
  plant: any, 
  geometry: THREE.CylinderGeometry, 
  x: number, 
  y: number, 
  z: number, 
  spreadFeet: number, 
  cappedHeight: number, 
  placed: any, 
  fallbackColor: THREE.Color
) => {
  if (!scene || !props.imageUrl) return;

  const imageUrl = props.imageUrl(plant, false); // Get full-size image
  
  // Create a mesh immediately (so legend jump/selection works without waiting for image load).
  // Later, if the photo loads, we swap the SIDE + TOP material maps.
  const materials: THREE.Material[] = [
    new THREE.MeshStandardMaterial({
      color: fallbackColor,
      roughness: 0.75,
      metalness: 0.05,
      transparent: false
    }),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.55,
      metalness: 0.0,
      transparent: false
    }),
    new THREE.MeshStandardMaterial({
      color: fallbackColor,
      roughness: 0.8,
      metalness: 0.1
    })
  ];

  const mesh = new THREE.Mesh(geometry, materials);
  mesh.position.set(x, y, z);
  mesh.scale.set(spreadFeet, cappedHeight, spreadFeet);
  mesh.userData = { plantId: placed.plantId, placedId: placed.id };
  mesh.castShadow = false;
  mesh.receiveShadow = false;

  scene.add(mesh);
  registerInstance(mesh, placed, plant, x, y, z, spreadFeet, cappedHeight);

  // Create texture loader with CORS support
  const textureLoader = new THREE.TextureLoader();
  textureLoader.setCrossOrigin('anonymous');
  textureLoader.load(
    imageUrl,
    (texture) => {
      console.log(`Loaded texture for ${plant['Common Name']}`);
      // Correct color for photo textures
      texture.colorSpace = THREE.SRGBColorSpace;

      // Reduce shimmering/blurriness at grazing angles while orbiting
      texture.generateMipmaps = true;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;

      // Anisotropy depends on the renderer caps
      const maxAniso = renderer?.capabilities.getMaxAnisotropy?.() ?? 1;
      texture.anisotropy = Math.min(8, Math.max(1, maxAniso));

      const sideMatAny: any = materials[0];
      const topMatAny: any = materials[1];

      // Dispose any previous maps safely (avoid leaking GPU memory).
      // Note: since we set SIDE and TOP to the same `texture`, we only dispose
      // old maps that are different from the new one.
      const oldMaps = new Set<any>();
      const sideOld = sideMatAny.map;
      const topOld = topMatAny.map;
      if (sideOld && sideOld !== texture) oldMaps.add(sideOld);
      if (topOld && topOld !== texture) oldMaps.add(topOld);

      sideMatAny.map = texture;
      sideMatAny.needsUpdate = true;

      topMatAny.map = texture;
      topMatAny.needsUpdate = true;

      for (const old of oldMaps) old.dispose();
    },
    undefined,
    (error) => {
      console.warn(`Failed to load plant image for ${plant['Common Name']}:`, error);
    }
  );
};

const registerInstance = (
  mesh: THREE.Mesh,
  placed: PlacedPlant,
  plant: Plant | undefined,
  x: number,
  y: number,
  z: number,
  spreadFeet: number,
  heightFeet: number
) => {
  const center = new THREE.Vector3(x, y, z);
  const meta: PlantInstanceMeta = { placed, plant, mesh, center, heightFeet, spreadFeet };
  placedIdToInstance.set(placed.id, meta);
  const arr = plantIdToPlacedIds.get(placed.plantId) ?? [];
  arr.push(placed.id);
  plantIdToPlacedIds.set(placed.plantId, arr);

  if (labelMode.value === 'all') {
    ensureLabel(meta);
    if (meta.label) meta.label.visible = true;
  }
};

const animate = () => {
  if (!renderer || !scene || !camera) return;
  
  requestAnimationFrame(animate);
  
  const dt = clock?.getDelta?.() ?? 1 / 60;
  if (controls?.update) controls.update(dt);

  // Sync 3D zoom back to shared toolbar (2D uses zoom scale, 3D uses camera distance)
  if (controls && baseDistance.value && typeof emit === 'function') {
    const d = getCameraDistance();
    if (d && d > 0) {
      const z = clamp(baseDistance.value / d, 0.5, 2);
      if (Math.abs((props.zoom ?? 1) - z) > 0.03) {
        emit('update:zoom', z);
      }
    }
  }

  // Keep labels readable (scale by distance; smaller than previous defaults).
  if (camera) {
    for (const meta of placedIdToInstance.values()) {
      if (!meta.label || !meta.label.visible) continue;
      const d = camera.position.distanceTo(meta.center);
      const s = clamp(d * 0.045, 1.3, 3.6);
      meta.label.scale.set(s * 1.55, s * 0.55, 1);
      meta.label.position.set(meta.center.x, meta.heightFeet + 1.1, meta.center.z);
    }
  }
  
  // Update action buttons position if a plant is selected
  if (selected.value) {
    const meta = placedIdToInstance.get(selected.value.placedId);
    if (meta) {
      updateActionButtonsPosition(meta);
    }
  }
  
  renderer.render(scene, camera);
};

onMounted(() => {
  console.log('Garden3DView mounted', {
    plantCount: props.placedPlants.length,
    gridSize: { width: props.gridWidth, height: props.gridHeight }
  });

  // Initialize Three.js on next tick to ensure DOM is ready
  setTimeout(initThreeJS, 0);
});

const handleKeyDown = (event: KeyboardEvent) => {
  if (event.code === 'Space' && !event.repeat) {
    isSpacebarHeld.value = true;
    event.preventDefault();
    // Update cursor to indicate pan mode
    if (renderer) {
      renderer.domElement.style.cursor = 'grab';
    }
    return;
  }

  // Only handle keyboard events if a plant is selected
  // Don't handle if user is typing in an input field
  if (!selected.value) return;
  const target = event.target as HTMLElement;
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
    return;
  }

  // Handle arrow keys for movement
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
    event.preventDefault();
    
    const meta = placedIdToInstance.get(selected.value.placedId);
    if (!meta) return;
    
    let newX = meta.placed.x;
    let newY = meta.placed.y;
    const moveDistance = props.snapIncrement;
    
    switch (event.key) {
      case 'ArrowUp':
        newY = Math.max(0, meta.placed.y - moveDistance);
        break;
      case 'ArrowDown':
        newY = Math.min(props.gridHeight - meta.placed.height, meta.placed.y + moveDistance);
        break;
      case 'ArrowLeft':
        newX = Math.max(0, meta.placed.x - moveDistance);
        break;
      case 'ArrowRight':
        newX = Math.min(props.gridWidth - meta.placed.width, meta.placed.x + moveDistance);
        break;
    }
    
    // Only move if position actually changed
    if (newX !== meta.placed.x || newY !== meta.placed.y) {
      emit('move-placed', meta.placed.id, newX, newY);
    }
    return;
  }
  
  // Handle delete key
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    handleDelete();
    return;
  }
  
  // Handle Enter/Esc to deselect
  if (event.key === 'Enter' || event.key === 'Escape') {
    event.preventDefault();
    selected.value = null;
    actionButtonsPosition.value = null;
    selectedObject = null;
    setSelectionRing(null);
  }
};

const handleKeyUp = (event: KeyboardEvent) => {
  if (event.code === 'Space') {
    isSpacebarHeld.value = false;
    event.preventDefault();
    // Restore normal cursor
    if (renderer) {
      renderer.domElement.style.cursor = hoveredObject ? 'pointer' : '';
    }
    // Restore normal camera controls
    if (controls) {
      const ACTION = /** @type {any} */ (CameraControls).ACTION;
      if (ACTION && controls.mouseButtons) {
        controls.mouseButtons.left = ACTION.ROTATE;
      }
    }
  }
};

onUnmounted(() => {
  // Clean up Three.js resources
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('keyup', handleKeyUp);
  disposeResizeControls();
  if (renderer) {
    renderer.domElement.removeEventListener('pointermove', onPointerMove);
    renderer.domElement.removeEventListener('pointerdown', onPointerDown);
    renderer.domElement.removeEventListener('pointerup', onPointerUp);
    renderer.dispose();
  }
  if (controls) {
    try {
      controls.dispose?.();
    } catch {
      // ignore
    }
  }
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
  if (selectionRing) {
    selectionRing.geometry.dispose();
    const ringMat = selectionRing.material;
    if (Array.isArray(ringMat)) {
      ringMat.forEach((m) => {
        const mAny = /** @type {any} */ (m);
        mAny?.dispose?.();
      });
    } else {
      const ringMatAny = /** @type {any} */ (ringMat);
      ringMatAny?.dispose?.();
    }
    selectionRing = null;
  }
  for (const meta of placedIdToInstance.values()) {
    if (meta.label) {
      const mat = /** @type {any} */ (meta.label.material);
      if (mat.map) mat.map.dispose();
      mat.dispose();
    }
  }
  console.log('Garden3DView unmounted');
});

const hashToColor = (seed: string) => {
  // Simple stable hash -> HSL
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  const color = new THREE.Color();
  color.setHSL(hue / 360, 0.55, 0.55);
  return color;
};

const resetView = () => {
  if (camera && controls) {
    fitCameraToGarden();
    baseDistance.value = getCameraDistance();
    viewMode.value = 'top';
  }
};

type ViewPreset = 'top';
const applyViewPresetInstant = (preset: ViewPreset) => {
  if (!camera || !controls) return;

  const cx = props.gridWidth / 2;
  const cz = props.gridHeight / 2;
  const d = Math.max(props.gridWidth, props.gridHeight);

  const nextTarget = new THREE.Vector3(cx, 0, cz);
  const h = Math.max(18, d * 1.25);
  const nextCam = new THREE.Vector3(cx, h, cz + Math.max(0.5, d * 0.06));

  controls.setLookAt(
    nextCam.x,
    nextCam.y,
    nextCam.z,
    nextTarget.x,
    nextTarget.y,
    nextTarget.z,
    false
  );
};
const setViewPreset = (preset: ViewPreset) => {
  if (!camera || !controls) return;
  const cx = props.gridWidth / 2;
  const cz = props.gridHeight / 2;
  const d = Math.max(props.gridWidth, props.gridHeight);

  const nextTarget = new THREE.Vector3(cx, 0, cz);
  const h = Math.max(18, d * 1.25);
  const nextCam = new THREE.Vector3(cx, h, cz + Math.max(0.5, d * 0.06));

  controls.setLookAt(
    nextCam.x,
    nextCam.y,
    nextCam.z,
    nextTarget.x,
    nextTarget.y,
    nextTarget.z,
    true
  );
  baseDistance.value = getCameraDistance();
  viewMode.value = preset;
};

const estimateMaxPlantHeightFeet = (): number => {
  if (!props.placedPlants || props.placedPlants.length === 0) return 3;
  let maxH = 0;
  for (const placed of props.placedPlants) {
    const plant = props.plantById[placed.plantId];
    const plantAny = plant ? /** @type {any} */ (plant) : null;
    const heightFeetRaw = plantAny ? plantAny['Height (feet)'] : null;
    const h = parseFeet(heightFeetRaw) ?? 1;
    maxH = Math.max(maxH, h);
  }
  return Math.max(1, maxH);
};

const applySideView = (idx: number, smooth = true) => {
  if (!camera || !controls) return;
  const cx = props.gridWidth / 2;
  const cz = props.gridHeight / 2;
  const d = Math.max(props.gridWidth, props.gridHeight);

  // Keep distance stable-ish and within bounds.
  const dist = clamp(Math.max(18, d * 0.95), minDistance.value, maxDistance.value);
  // Height: enough to see plants clearly but still feels "side-on".
  const maxH = estimateMaxPlantHeightFeet();
  const y = Math.max(10, Math.min(dist * 0.85, maxH * 1.6 + 8));

  const nextTarget = new THREE.Vector3(cx, 0, cz);
  let nextCam: THREE.Vector3;
  // 0..3 cycles around grid, 90° each.
  if (idx === 0) nextCam = new THREE.Vector3(cx, y, cz + dist); // front (bottom edge)
  else if (idx === 1) nextCam = new THREE.Vector3(cx + dist, y, cz); // right
  else if (idx === 2) nextCam = new THREE.Vector3(cx, y, cz - dist); // back (top edge)
  else nextCam = new THREE.Vector3(cx - dist, y, cz); // left

  controls.setLookAt(
    nextCam.x,
    nextCam.y,
    nextCam.z,
    nextTarget.x,
    nextTarget.y,
    nextTarget.z,
    smooth
  );
  baseDistance.value = getCameraDistance();
};

const cycleSideView = () => {
  // First click always goes to the default-facing side; subsequent clicks rotate 90°.
  if (viewMode.value !== 'side') {
    sideIndex.value = 0;
  } else {
    sideIndex.value = (sideIndex.value + 1) % 4;
  }
  viewMode.value = 'side';
  applySideView(sideIndex.value, true);
};

const setSelectionRing = (meta: PlantInstanceMeta | null) => {
  if (!selectionRing || !meta) {
    if (selectionRing) selectionRing.visible = false;
    return;
  }
  const outerRadius = Math.max(0.6, meta.spreadFeet / 2);
  const innerRadius = Math.max(0.45, outerRadius * 0.88);
  // Rebuild geometry for correct radii (simple and OK at this scale)
  selectionRing.geometry.dispose();
  selectionRing.geometry = new THREE.RingGeometry(innerRadius, outerRadius, 64);
  selectionRing.position.set(meta.center.x, 0.01, meta.center.z);
  selectionRing.visible = true;
};

const focusOnInstance = (meta: PlantInstanceMeta) => {
  if (!camera || !controls) return;
  const nextTarget = new THREE.Vector3(meta.center.x, Math.min(meta.heightFeet / 2, 6), meta.center.z);
  const curTarget = new THREE.Vector3();
  const curPos = new THREE.Vector3();
  controls.getTarget?.(curTarget);
  controls.getPosition?.(curPos);
  const offset = (controls.getTarget && controls.getPosition)
    ? curPos.clone().sub(curTarget)
    : camera.position.clone().sub(new THREE.Vector3(props.gridWidth / 2, 0, props.gridHeight / 2));

  let nextCam = nextTarget.clone().add(offset);
  nextCam.y = Math.max(nextCam.y, 2.5);

  // Keep zoom within min/max distance bounds
  const dist = nextCam.distanceTo(nextTarget);
  const clampedDist = clamp(dist, minDistance.value, maxDistance.value);
  if (dist !== clampedDist) {
    const dir = nextCam.clone().sub(nextTarget).normalize();
    nextCam = nextTarget.clone().add(dir.multiplyScalar(clampedDist));
  }

  controls.setLookAt(
    nextCam.x,
    nextCam.y,
    nextCam.z,
    nextTarget.x,
    nextTarget.y,
    nextTarget.z,
    true
  );
};

const selectPlacedId = (placedId: string) => {
  const meta = placedIdToInstance.get(placedId);
  if (!meta) return;

  selectedObject = meta.mesh;
  setSelectionRing(meta);
  focusOnInstance(meta);

  const plant = props.plantById[meta.placed.plantId];
  const plantAny = plant ? /** @type {any} */ (plant) : null;
  const commonName = plantAny?.['Common Name'] || meta.placed.plantId;
  const scientificName = plantAny?.['Scientific Name'] || undefined;
  const heightFeetRaw = plant ? plant['Height (feet)'] : null;
  const heightFeet = parseFeet(heightFeetRaw) ?? meta.heightFeet;
  const spreadFeet = meta.placed.width;

  selected.value = {
    placedId: meta.placed.id,
    plantId: meta.placed.plantId,
    commonName,
    scientificName,
    heightFeet,
    spreadFeet
  };

  ensureLabel(meta);
  applyLabelMode();
  updateActionButtonsPosition(meta);
};

const handleDuplicate = () => {
  if (!selected.value) return;
  const placed = props.placedPlants.find(p => p.id === selected.value!.placedId);
  if (placed) {
    // Place duplicate at an offset position (one snap increment to the right and down)
    const newX = placed.x + props.snapIncrement;
    const newY = placed.y + props.snapIncrement;
    emit('place-plant', placed.plantId, newX, newY);
  }
};

const handleDelete = () => {
  if (!selected.value) return;
  emit('remove-placed', selected.value.placedId);
  selected.value = null;
  actionButtonsPosition.value = null;
};

const updateActionButtonsPosition = (meta: PlantInstanceMeta) => {
  if (!camera || !renderer || !meta || !threeContainer.value || !rootRef.value) {
    actionButtonsPosition.value = null;
    return;
  }
  
  // Project 3D position to screen coordinates
  const worldPos = meta.center.clone();
  // Position buttons above the plant (at the top of the cylinder)
  worldPos.y = meta.heightFeet;
  
  const vector = worldPos.project(camera);
  const canvasRect = threeContainer.value.getBoundingClientRect();
  const containerRect = rootRef.value.getBoundingClientRect();
  
  // Convert from viewport coordinates to container-relative coordinates
  const viewportX = (vector.x * 0.5 + 0.5) * canvasRect.width + canvasRect.left;
  const viewportY = (-(vector.y * 0.5 - 0.5)) * canvasRect.height + canvasRect.top;
  
  actionButtonsPosition.value = {
    x: viewportX - containerRect.left,
    y: viewportY - containerRect.top,
  };
};

// jumpToPlant removed with plant legend

const updateHover = (obj: THREE.Object3D | null) => {
  if (hoveredObject === obj) return;
  const setEmissive = (o: any, on: boolean) => {
    if (!o) return;
    const mat = o.material;
    if (Array.isArray(mat)) {
      for (const m of mat) {
        if (m && 'emissive' in m) {
          m.emissive = new THREE.Color(on ? 0x111827 : 0x000000);
          m.emissiveIntensity = on ? 0.25 : 0.0;
        }
      }
    } else if (mat && 'emissive' in mat) {
      mat.emissive = new THREE.Color(on ? 0x111827 : 0x000000);
      mat.emissiveIntensity = on ? 0.25 : 0.0;
    }
  };
  setEmissive(hoveredObject, false);
  hoveredObject = obj;
  setEmissive(hoveredObject, true);
  if (renderer) {
    // Don't override cursor if spacebar is held (pan mode)
    if (!isSpacebarHeld.value) {
      renderer.domElement.style.cursor = hoveredObject ? 'pointer' : '';
    }
  }
};

const pickObjectUnderPointer = (ev: PointerEvent) => {
  if (!renderer || !camera || !raycaster || !mouseNdc) return null;
  const rect = renderer.domElement.getBoundingClientRect();
  mouseNdc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
  mouseNdc.y = -(((ev.clientY - rect.top) / rect.height) * 2 - 1);
  raycaster.setFromCamera(mouseNdc, camera);
  const meshes: THREE.Object3D[] = [];
  for (const meta of placedIdToInstance.values()) meshes.push(meta.mesh);
  const hits = raycaster.intersectObjects(meshes, false);
  return hits.length > 0 ? hits[0].object : null;
};

const onPointerMove = (ev: PointerEvent) => {
  // Track "any drag" so orbit/pan drags don't accidentally select on pointerup.
  if (pointerDownAt && !pointerDragging) {
    const dx = ev.clientX - pointerDownAt.x;
    const dy = ev.clientY - pointerDownAt.y;
    if (dx * dx + dy * dy > 36) {
      pointerDragging = true;
    }
  }

  // Dragging a plant: move it along the ground plane (X/Z), keep height data-driven.
  if (dragPlacedId && raycaster && mouseNdc && camera && renderer && dragOffsetXZ) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouseNdc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    mouseNdc.y = -(((ev.clientY - rect.top) / rect.height) * 2 - 1);
    raycaster.setFromCamera(mouseNdc, camera);

    const hit = new THREE.Vector3();
    const ok = raycaster.ray.intersectPlane(groundPlane, hit);
    if (ok) {
      const meta = placedIdToInstance.get(dragPlacedId);
      if (meta) {
        const centerX = hit.x + dragOffsetXZ.dx;
        const centerZ = hit.z + dragOffsetXZ.dz;

        const topLeftX = centerX - meta.placed.width / 2;
        const topLeftY = centerZ - meta.placed.height / 2;

        const snap = (v: number) => Math.round(v / props.snapIncrement) * props.snapIncrement;
        const clampedX = clamp(snap(topLeftX), 0, Math.max(0, props.gridWidth - meta.placed.width));
        const clampedY = clamp(snap(topLeftY), 0, Math.max(0, props.gridHeight - meta.placed.height));

        const newCenterX = clampedX + meta.placed.width / 2;
        const newCenterZ = clampedY + meta.placed.height / 2;
        meta.center.set(newCenterX, meta.center.y, newCenterZ);

        meta.mesh.position.set(newCenterX, meta.center.y, newCenterZ);

        if (selected.value?.placedId === meta.placed.id) setSelectionRing(meta);
      }
    }
    return;
  }

  if (pointerDownAt && dragCandidatePlacedId) {
    const dx = ev.clientX - pointerDownAt.x;
    const dy = ev.clientY - pointerDownAt.y;
    if (dx * dx + dy * dy > 36) {
      // Begin plant drag after small threshold
      dragPlacedId = dragCandidatePlacedId;
      dragCandidatePlacedId = null;
      pointerDragging = true;
      if (controls && 'enabled' in controls) controls.enabled = false;
    }
  }
  const obj = pickObjectUnderPointer(ev);
  updateHover(obj);
};

const onPointerDown = (ev: PointerEvent) => {
  pointerDownAt = { x: ev.clientX, y: ev.clientY };
  pointerDragging = false;

  // If spacebar is held, enable panning (truck) mode
  if (isSpacebarHeld.value && ev.isPrimary && ev.button === 0 && controls) {
    // Enable truck (pan) mode for CameraControls
    const ACTION = /** @type {any} */ (CameraControls).ACTION;
    if (ACTION && controls.mouseButtons) {
      // Temporarily change left button to truck (pan) when spacebar is held
      controls.mouseButtons.left = ACTION.TRUCK;
    }
    // Don't process plant selection/dragging when panning
    return;
  }

  // If pointer is down on a plant, prepare for ground-plane drag
  const obj = pickObjectUnderPointer(ev);
  const placedIdRaw = /** @type {any} */ (obj)?.userData?.placedId;
  const placedId = typeof placedIdRaw === 'string' ? placedIdRaw : null;
  if (placedId && raycaster && mouseNdc && camera && renderer) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouseNdc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    mouseNdc.y = -(((ev.clientY - rect.top) / rect.height) * 2 - 1);
    raycaster.setFromCamera(mouseNdc, camera);
    const hit = new THREE.Vector3();
    const ok = raycaster.ray.intersectPlane(groundPlane, hit);
    if (ok) {
      const meta = placedIdToInstance.get(placedId);
      if (meta) {
        dragCandidatePlacedId = placedId;
        dragOffsetXZ = { dx: meta.center.x - hit.x, dz: meta.center.z - hit.z };
      }
    }
  } else {
    dragCandidatePlacedId = null;
    dragOffsetXZ = null;
  }
};

const onPointerUp = (ev: PointerEvent) => {
  // Restore normal camera controls if spacebar pan was active
  if (isSpacebarHeld.value && controls) {
    const ACTION = /** @type {any} */ (CameraControls).ACTION;
    if (ACTION && controls.mouseButtons) {
      controls.mouseButtons.left = ACTION.ROTATE;
    }
  }
  
  // Finish plant drag: commit to planner state (single history entry)
  if (dragPlacedId) {
    const meta = placedIdToInstance.get(dragPlacedId);
    if (meta) {
      const finalX = meta.center.x - meta.placed.width / 2;
      const finalY = meta.center.z - meta.placed.height / 2;
      emit('move-placed', meta.placed.id, finalX, finalY);
    }
    dragPlacedId = null;
    dragCandidatePlacedId = null;
    dragOffsetXZ = null;
    pointerDownAt = null;
    pointerDragging = false;
    if (controls && 'enabled' in controls) controls.enabled = true;
    return;
  }

  // If user dragged to orbit/pan, don't treat it as a selection click.
  if (pointerDragging) {
    pointerDownAt = null;
    pointerDragging = false;
    dragCandidatePlacedId = null;
    dragOffsetXZ = null;
    if (controls && 'enabled' in controls) controls.enabled = true;
    return;
  }

  // Grid resize controls: click the physical +/- buttons on the ground.
  const resizeAction = pickResizeActionUnderPointer(ev);
  if (resizeAction) {
    if (resizeAction === 'addRowTop') props.addRowTop();
    else if (resizeAction === 'removeRowTop') props.removeRowTop();
    else if (resizeAction === 'addRowBottom') props.addRowBottom();
    else if (resizeAction === 'removeRowBottom') props.removeRowBottom();
    else if (resizeAction === 'addColumnLeft') props.addColumnLeft();
    else if (resizeAction === 'removeColumnLeft') props.removeColumnLeft();
    else if (resizeAction === 'addColumnRight') props.addColumnRight();
    else if (resizeAction === 'removeColumnRight') props.removeColumnRight();

    pointerDownAt = null;
    pointerDragging = false;
    dragCandidatePlacedId = null;
    dragOffsetXZ = null;
    return;
  }
  const obj = pickObjectUnderPointer(ev);
  if (obj) {
    const placedIdRaw = /** @type {any} */ (obj)?.userData?.placedId;
    const placedId = typeof placedIdRaw === 'string' ? placedIdRaw : null;
    if (placedId) selectPlacedId(placedId);
  } else if (selectedPlantId.value && raycaster && mouseNdc && camera && renderer) {
    // Place from favorites: click ground to add another instance (mirrors 2D "tap then tap grid")
    const rect = renderer.domElement.getBoundingClientRect();
    mouseNdc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    mouseNdc.y = -(((ev.clientY - rect.top) / rect.height) * 2 - 1);
    raycaster.setFromCamera(mouseNdc, camera);
    const hit = new THREE.Vector3();
    const ok = raycaster.ray.intersectPlane(groundPlane, hit);
    if (ok) {
      const plant = props.plantById[selectedPlantId.value];
      const size = spreadCellsResolved(plant);
      const snap = (v: number) => Math.round(v / props.snapIncrement) * props.snapIncrement;
      // Center placement on click (matches drag-preview/drag-place behavior in 2D)
      const desiredX = hit.x - size / 2;
      const desiredY = hit.z - size / 2;
      const finalX = Math.max(0, snap(desiredX));
      const finalY = Math.max(0, snap(desiredY));
      emit('place-plant', selectedPlantId.value, finalX, finalY);
    }
  } else {
    // Click on empty space: deselect current plant (but not on mobile to avoid accidental deselection)
    if (selected.value && !(props.isMobile ?? false)) {
      selected.value = null;
      actionButtonsPosition.value = null;
      selectedObject = null;
      setSelectionRing(null);
    }
  }
  pointerDownAt = null;
  pointerDragging = false;
  dragCandidatePlacedId = null;
  dragOffsetXZ = null;
};

const ensureLabel = (meta: PlantInstanceMeta) => {
  if (!scene) return;
  if (meta.label) return;
  const plant = props.plantById[meta.placed.plantId];
  const plantAny = plant ? /** @type {any} */ (plant) : null;
  const commonNameRaw = plantAny?.['Common Name'] || meta.placed.plantId;
  const scientificNameRaw = plantAny?.['Scientific Name'] || '';
  const commonName = shortLabel(commonNameRaw, 28);
  const scientificName = shortLabel(scientificNameRaw, 34);

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) return;
  canvas.width = 720;
  canvas.height = 240;

  // Match 2D label feel: dark translucent rounded panel + white text
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.save();
  context.shadowColor = 'rgba(0, 0, 0, 0.35)';
  context.shadowBlur = 18;
  context.shadowOffsetY = 6;
  context.fillStyle = 'rgba(17, 24, 39, 0.45)';
  drawRoundedRect(context, 16, 26, canvas.width - 32, canvas.height - 52, 26);
  context.fill();
  context.restore();

  // Subtle border
  context.strokeStyle = 'rgba(255, 255, 255, 0.22)';
  context.lineWidth = 3;
  drawRoundedRect(context, 16, 26, canvas.width - 32, canvas.height - 52, 26);
  context.stroke();

  // Coordinate badge (like 2D)
  const coord = centerPositionLabel(meta.placed);
  context.font = '700 28px "Roboto Mono", monospace';
  const badgePaddingX = 18;
  const badgePaddingY = 10;
  const badgeTextW = context.measureText(coord).width;
  const badgeW = badgeTextW + badgePaddingX * 2;
  const badgeH = 28 + badgePaddingY * 2;
  const badgeX = (canvas.width - badgeW) / 2;
  const badgeY = 34;
  context.fillStyle = 'rgba(0, 0, 0, 0.72)';
  drawRoundedRect(context, badgeX, badgeY, badgeW, badgeH, 14);
  context.fill();
  context.strokeStyle = 'rgba(255, 255, 255, 0.30)';
  context.lineWidth = 2;
  drawRoundedRect(context, badgeX, badgeY, badgeW, badgeH, 14);
  context.stroke();
  context.fillStyle = '#ffffff';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(coord, canvas.width / 2, badgeY + badgeH / 2);

  // Common name
  context.font = '700 44px Roboto, Arial, sans-serif';
  context.fillStyle = '#ffffff';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.shadowColor = 'rgba(0, 0, 0, 0.45)';
  context.shadowBlur = 8;
  context.shadowOffsetY = 2;
  context.fillText(commonName, canvas.width / 2, canvas.height / 2 + 10);

  // Scientific name (optional)
  if (scientificName) {
    context.shadowBlur = 0;
    context.font = 'italic 30px Roboto, Arial, sans-serif';
    context.fillStyle = 'rgba(255, 255, 255, 0.95)';
    context.fillText(scientificName, canvas.width / 2, canvas.height / 2 + 60);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.colorSpace = THREE.SRGBColorSpace;

  const spriteMaterial = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false
  });
  const sprite = new THREE.Sprite(spriteMaterial);
  sprite.position.set(meta.center.x, meta.heightFeet + 1.1, meta.center.z);
  // Smaller baseline; we scale dynamically based on camera distance
  sprite.scale.set(3.8, 1.35, 1);
  sprite.visible = false;
  scene.add(sprite);
  meta.label = sprite;
};

const applyLabelMode = () => {
  // Hide/show labels based on mode.
  const mode = labelMode.value;

  for (const meta of placedIdToInstance.values()) {
    if (mode === 'all') {
      ensureLabel(meta);
      if (meta.label) meta.label.visible = true;
      continue;
    }

    // off
    if (meta.label) meta.label.visible = false;
  }
};

const fitCameraToGarden = () => {
  if (!camera || !controls) return;
  const box = new THREE.Box3();

  // Always include the ground extents so empty gardens still frame correctly
  box.expandByPoint(new THREE.Vector3(0, 0, 0));
  box.expandByPoint(new THREE.Vector3(props.gridWidth, 0, props.gridHeight));

  for (const meta of placedIdToInstance.values()) {
    const r = Math.max(0.25, meta.spreadFeet / 2);
    box.expandByPoint(new THREE.Vector3(meta.center.x - r, 0, meta.center.z - r));
    box.expandByPoint(new THREE.Vector3(meta.center.x + r, meta.heightFeet, meta.center.z + r));
  }

  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxSize = Math.max(size.x, size.y, size.z);

  const fov = (camera.fov * Math.PI) / 180;
  const fitDist = (maxSize / 2) / Math.tan(fov / 2);
  const dist = clamp(fitDist * 1.25, minDistance.value, maxDistance.value);

  const dir = new THREE.Vector3(1, 0.85, 1).normalize();
  const nextTarget = new THREE.Vector3(center.x, 0, center.z);
  const nextCam = nextTarget.clone().add(dir.multiplyScalar(dist));

  controls.setLookAt(
    nextCam.x,
    nextCam.y,
    nextCam.z,
    nextTarget.x,
    nextTarget.y,
    nextTarget.z,
    true
  );
};

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
</script>

<style scoped>
.garden-3d {
  position: relative;
  width: 100%;
  height: 100%;
  background: #f5f5f5;
}

.canvas {
  width: 100%;
  height: 100%;
  /* Prevent browser scroll/zoom gestures from fighting OrbitControls on mobile */
  touch-action: none;
}


.overlay-3d-controls {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-top: 10px;
  pointer-events: auto;
}

.favorites-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1001;
  pointer-events: auto;
}

.place-hint {
  margin-top: 6px;
  display: inline-block;
  padding: 6px 10px;
  border: 1px solid rgba(229, 231, 235, 0.95);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.92);
  font-family: Roboto, sans-serif;
  font-size: 12px;
  font-weight: 600;
  color: #374151;
  backdrop-filter: blur(6px);
}

.overlay-left {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  pointer-events: auto;
}

.overlay-right {
  margin-left: auto;
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
  pointer-events: auto;
  text-align: right;
  font-family: Roboto, sans-serif;
}

.overlay-button {
  pointer-events: auto;
  border: 1px solid #d1d5db;
  background: rgba(255, 255, 255, 0.92);
  color: #111827;
  border-radius: 10px;
  padding: 8px 10px;
  font-family: Roboto, sans-serif;
  font-weight: 600;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.overlay-button .icon {
  flex-shrink: 0;
  stroke-width: 2;
}

.overlay-button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.overlay-button.danger {
  border-color: rgba(220, 38, 38, 0.7);
  color: #b91c1c;
}

.overlay-button.danger:hover:not(:disabled) {
  background: rgba(254, 242, 242, 0.92);
  border-color: rgba(185, 28, 28, 0.85);
}

/* 2D-like toolbar controls */
.toolbar-zoom {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-shrink: 0;
}

.zoom-value {
  font-size: 14px;
  font-weight: 500;
  font-family: Roboto, sans-serif;
  color: #374151;
  min-width: 3rem;
  text-align: center;
}

.toolbar-button {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  font-size: 14px;
  font-family: Roboto, sans-serif;
  font-weight: 500;
  border: 1px solid #d1d5db;
  border-radius: 10px;
  background-color: rgba(255, 255, 255, 0.92);
  color: #374151;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.toolbar-button:hover:not(:disabled) {
  background-color: rgba(249, 250, 251, 0.95);
  border-color: #9ca3af;
}

.toolbar-button:active:not(:disabled) {
  background-color: rgba(243, 244, 246, 0.95);
}

.toolbar-button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.toolbar-button.icon-only {
  padding: 8px;
  min-width: 40px;
  min-height: 40px;
  justify-content: center;
}

.toolbar-button .icon {
  flex-shrink: 0;
  stroke-width: 2;
}

.snap-toggle-button {
  font-family: 'Roboto Mono', monospace;
}

.snap-value {
  font-weight: 600;
}

.grid-dimensions-button strong {
  font-weight: 600;
}

.plant-actions-3d {
  display: flex;
  gap: 6px;
  z-index: 1002;
  pointer-events: auto;
}

.action-button-3d {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 2px solid rgba(0, 0, 0, 0.3);
  background-color: rgba(255, 255, 255, 0.95);
  color: #000;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(4px);
  padding: 0;
}

.action-button-3d:hover {
  background-color: rgba(255, 255, 255, 1);
  transform: scale(1.1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  border-color: rgba(0, 0, 0, 0.5);
}

.action-button-3d:active {
  transform: scale(0.95);
}

.action-button-3d.duplicate-button:hover {
  background-color: rgba(76, 175, 80, 0.95);
  border-color: rgba(76, 175, 80, 0.8);
}

.action-button-3d.duplicate-button:hover svg {
  color: #000;
  stroke: #000;
}

.action-button-3d.delete-button:hover {
  background-color: rgba(220, 30, 30, 0.95);
  border-color: rgba(220, 30, 30, 0.8);
}

.action-button-3d.delete-button:hover svg {
  color: #000;
  stroke: #000;
}

.action-button-3d svg {
  stroke-width: 2.5;
  color: #000;
  stroke: #000;
}

@media screen and (max-width: 767px) {
  .plant-actions-3d {
    gap: 4px;
  }
  
  .action-button-3d {
    width: 32px;
    height: 32px;
  }
  
  .action-button-3d svg {
    width: 16px;
    height: 16px;
  }
}

.color-legend {
  position: absolute;
  top: 12px;
  right: 12px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 10px;
  max-width: 200px;
  z-index: 1001;
  backdrop-filter: blur(6px);
}

/* Plant legend removed */

@media screen and (max-width: 767px) {
  .overlay-top {
    top: 10px;
    left: 10px;
    right: 10px;
  }

  .overlay-button {
    padding: 10px 12px;
    font-size: 13px;
  }

  .overlay-legend {
    display: none;
  }

  .favorites-overlay {
    top: 0;
    left: 0;
    right: 0;
  }
}
</style>


