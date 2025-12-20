<template>
  <div class="garden-3d" ref="rootRef">
    <div class="overlay-top">
      <button class="overlay-button" type="button" @click="$emit('close')" aria-label="Close 3D view">
        Close
      </button>
      <button
        class="overlay-button"
        type="button"
        :disabled="!canUndo"
        @click="emit('undo')"
        aria-label="Undo"
        title="Undo"
      >
        Undo
      </button>
      <button
        class="overlay-button"
        type="button"
        :disabled="!canRedo"
        @click="emit('redo')"
        aria-label="Redo"
        title="Redo"
      >
        Redo
      </button>
      <button
        class="overlay-button danger"
        type="button"
        :disabled="!canClear"
        @click="emit('clear')"
        aria-label="Clear layout"
        title="Clear layout"
      >
        Clear
      </button>
      <button class="overlay-button" type="button" @click="resetView" aria-label="Reset camera view">
        Reset view
      </button>
      <button class="overlay-button" type="button" @click="setViewPreset('top')" aria-label="Top-down view">
        Top
      </button>
      <button class="overlay-button" type="button" @click="setViewPreset('iso')" aria-label="Isometric view">
        Iso
      </button>
      <button class="overlay-button" type="button" @click="cycleLabelMode" aria-label="Toggle labels">
        Labels: {{ labelModeLabel }}
      </button>
      <div class="overlay-legend" aria-hidden="true">
        Footprint = spread, Height = "Height (feet)"
      </div>
      
      <!-- Plant Legend -->
      <div class="plant-legend" v-if="plantLegend.length > 0">
        <div class="legend-title">Plants:</div>
        <button
          v-for="entry in plantLegend"
          :key="entry.plantId"
          class="legend-plant"
          type="button"
          @click="jumpToPlant(entry.plantId)"
        >
          <span class="legend-plant-name">{{ entry.commonName }}</span>
          <span class="legend-plant-meta">
            <span class="legend-plant-count">×{{ entry.count }}</span>
            <span v-if="entry.count > 1" class="legend-plant-index">{{ legendCycleIndex(entry.plantId) }}</span>
          </span>
        </button>
      </div>
    </div>

    <div class="overlay-scale" aria-hidden="true">
      <div class="scale-row">
        <span class="scale-label">Scale:</span>
        <span class="scale-value">1 grid square = 1 ft</span>
      </div>
      <div class="scale-bar" aria-hidden="true">
        <div class="scale-bar-seg" />
        <div class="scale-bar-seg" />
      </div>
      <div class="scale-bar-labels">
        <span>0</span><span>5ft</span><span>10ft</span>
      </div>
      <div class="orientation-cue">
        <div class="orientation-title">Axes</div>
        <div class="orientation-axes">
          <span class="axis x">X →</span>
          <span class="axis z">Z ↓</span>
        </div>
      </div>
    </div>

    <div v-if="selected" class="overlay-info" role="status" aria-live="polite">
      <div v-if="selectedImageSrc" class="info-image">
        <img :src="selectedImageSrc" :alt="`${selected.commonName} photo`" loading="lazy" />
      </div>
      <div class="info-title">{{ selected.commonName }}</div>
      <div v-if="selected.scientificName" class="info-subtitle"><i>{{ selected.scientificName }}</i></div>
      <div class="info-row">Height: {{ selected.heightFeet ?? '—' }} ft</div>
      <div class="info-row">Spread: {{ selected.spreadFeet ?? '—' }} ft</div>
      <div class="info-actions">
        <button
          class="overlay-button danger"
          type="button"
          @click="emit('remove-placed', selected.placedId)"
          aria-label="Remove plant from layout"
          title="Remove from layout"
        >
          Remove
        </button>
      </div>
    </div>

    <div ref="threeContainer" class="canvas"></div>
  </div>
</template>

<script setup lang="ts">
import { computed, shallowRef, onMounted, onUnmounted, ref, watch } from 'vue';
// @ts-ignore - project TS tooling struggles with modern package exports; runtime bundling works.
import { TresCanvas, extend } from '@tresjs/core';
// @ts-ignore - project TS tooling struggles with modern package exports; runtime bundling works.
import * as THREE from 'three';
import TresOrbitControls from './TresOrbitControls.vue';
import type { Plant, PlacedPlant } from '../types/garden';

// THREE.js classes are now extended globally in main.js

if (typeof window !== 'undefined') {
  const wAny = /** @type {any} */ (window);
  console.log('Garden3DView: WebGL support detected', {
    webgl: !!wAny.WebGLRenderingContext,
    webgl2: !!wAny.WebGL2RenderingContext
  });
  
  // Test WebGL context creation
  const canvas = document.createElement('canvas');
  const gl =
    (canvas.getContext('webgl') as WebGLRenderingContext | null) ||
    (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);
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
  canUndo: boolean;
  canRedo: boolean;
  canClear: boolean;
  imageUrl?: (plant: Plant | undefined, preview: boolean) => string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'undo'): void;
  (e: 'redo'): void;
  (e: 'clear'): void;
  (e: 'move-placed', placedId: string, x: number, y: number): void;
  (e: 'remove-placed', placedId: string): void;
}>();

const instancesRef = shallowRef<any>(null);
const orbitRef = shallowRef<any>(null);
const rootRef = ref<HTMLElement | null>(null);
const threeContainer = ref<HTMLElement | null>(null);

// Three.js objects
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let renderer: THREE.WebGLRenderer | null = null;
let controls: any = null;
let raycaster: THREE.Raycaster | null = null;
let mouseNdc: THREE.Vector2 | null = null;
let resizeObserver: ResizeObserver | null = null;
let openIsoTimeout: number | null = null;

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

let focusAnim: {
  startAt: number;
  durationMs: number;
  fromTarget: THREE.Vector3;
  toTarget: THREE.Vector3;
  fromCam: THREE.Vector3;
  toCam: THREE.Vector3;
} | null = null;

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

const instanceCount = computed(() => props.placedPlants.length);

const plantLegend = computed(() => {
  const map = new Map<string, { plantId: string; commonName: string; count: number }>();
  for (const placed of props.placedPlants) {
    const plant = props.plantById[placed.plantId];
    const commonName = (plant?.['Common Name'] as string) || placed.plantId;
    const existing = map.get(placed.plantId);
    if (existing) {
      existing.count += 1;
    } else {
      map.set(placed.plantId, { plantId: placed.plantId, commonName, count: 1 });
    }
  }

  return Array.from(map.values()).sort((a, b) => a.commonName.localeCompare(b.commonName));
});

const plantIdToCycleIndex = ref<Record<string, number>>({});

const legendCycleIndex = (plantId: string) => {
  const ids = plantIdToPlacedIds.get(plantId) ?? [];
  const idx = plantIdToCycleIndex.value[plantId] ?? 0;
  if (ids.length <= 1) return '';
  return `${(idx % ids.length) + 1}/${ids.length}`;
};

type LabelMode = 'off' | 'selected' | 'all';
const labelMode = ref<LabelMode>('selected');
const labelModeLabel = computed(() => {
  if (labelMode.value === 'off') return 'Off';
  if (labelMode.value === 'all') return 'All';
  return 'Selected';
});

const cycleLabelMode = () => {
  labelMode.value = labelMode.value === 'selected' ? 'off' : labelMode.value === 'off' ? 'all' : 'selected';
  applyLabelMode();
};

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

const initThreeJS = () => {
  if (!threeContainer.value) return;

  const container = threeContainer.value;
  const rect = container.getBoundingClientRect();
  
  // Scene
  scene = new THREE.Scene();
  // Match the planner's neutral canvas so this feels like a true "3D mode"
  scene.background = new THREE.Color('#f8fafc');

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
  // Gentle filmic tone mapping helps photos look less flat / washed out
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  // Lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(10, 20, 10);
  directionalLight.castShadow = true;
  scene.add(directionalLight);


  // Ground
  const groundGeometry = new THREE.PlaneGeometry(props.gridWidth, props.gridHeight);
  const groundMaterial = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 1.0, metalness: 0.0 });
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(props.gridWidth / 2, 0, props.gridHeight / 2);
  scene.add(ground);

  // Grid
  const gridHelper = new THREE.GridHelper(gridSize.value, gridDivisions.value, 0x94a3b8, 0xd1d5db);
  gridHelper.position.set(props.gridWidth / 2, 0.001, props.gridHeight / 2);
  scene.add(gridHelper);

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
  import('three/examples/jsm/controls/OrbitControls.js').then(({ OrbitControls }) => {
    controls = new OrbitControls(camera!, renderer!.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = true;
    controls.minPolarAngle = 0.15;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    controls.minDistance = minDistance.value;
    controls.maxDistance = maxDistance.value;
    controls.target.set(props.gridWidth / 2, 0, props.gridHeight / 2);
    controls.addEventListener('change', () => {
      // Keep navigation oriented within the garden bounds.
      if (!controls || !camera) return;
      controls.target.x = clamp(controls.target.x, 0, props.gridWidth);
      controls.target.z = clamp(controls.target.z, 0, props.gridHeight);
    });
    controls.update();

    // Seamless "2D -> 3D": start in Top (matches 2D), then ease into Iso.
    applyViewPresetInstant('top');
    if (openIsoTimeout) window.clearTimeout(openIsoTimeout);
    openIsoTimeout = window.setTimeout(() => {
      setViewPreset('iso');
    }, 450);
  });

  raycaster = new THREE.Raycaster();
  mouseNdc = new THREE.Vector2();

  renderer.domElement.addEventListener('pointermove', onPointerMove, { passive: true });
  renderer.domElement.addEventListener('pointerdown', onPointerDown, { passive: true });
  renderer.domElement.addEventListener('pointerup', onPointerUp, { passive: true });

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

const disposeMeshMaterials = (mesh: THREE.Mesh) => {
  const mat = mesh.material as any;
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
      const mat = meta.label.material as THREE.SpriteMaterial;
      if (mat.map) mat.map.dispose();
      mat.dispose();
    }
  }
  placedIdToInstance.clear();
  plantIdToPlacedIds.clear();

  hoveredObject = null;
  selectedObject = null;
  selected.value = null;
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
    if (meta) setSelectionRing(meta);
  }
};

watch(
  () => props.placedPlants,
  () => syncFromProps(),
  { deep: true }
);

const addPlants = () => {
  if (!scene) return;

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
      scene!.add(mesh);

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
  mesh.castShadow = true;
  mesh.receiveShadow = true;

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

      const sideMat = materials[0] as THREE.MeshStandardMaterial;
      const topMat = materials[1] as THREE.MeshStandardMaterial;

      // Dispose any previous maps safely (avoid leaking GPU memory).
      // Note: since we set SIDE and TOP to the same `texture`, we only dispose
      // old maps that are different from the new one.
      const oldMaps = new Set<THREE.Texture>();
      const sideOld = sideMat.map as THREE.Texture | null | undefined;
      const topOld = topMat.map as THREE.Texture | null | undefined;
      if (sideOld && sideOld !== texture) oldMaps.add(sideOld);
      if (topOld && topOld !== texture) oldMaps.add(topOld);

      sideMat.map = texture;
      sideMat.needsUpdate = true;

      topMat.map = texture;
      topMat.needsUpdate = true;

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
    meta.label!.visible = true;
  }
};

const animate = () => {
  if (!renderer || !scene || !camera) return;
  
  requestAnimationFrame(animate);
  
  if (controls) {
    controls.update();
  }

  // Smooth focus animation
  if (focusAnim && controls) {
    const now = performance.now();
    const t = Math.min(1, (now - focusAnim.startAt) / focusAnim.durationMs);
    const k = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; // easeInOutQuad

    const curTarget = focusAnim.fromTarget.clone().lerp(focusAnim.toTarget, k);
    const curCam = focusAnim.fromCam.clone().lerp(focusAnim.toCam, k);
    controls.target.copy(curTarget);
    camera.position.copy(curCam);
    if (t >= 1) focusAnim = null;
  }

  // Keep selected label readable
  if (selected.value) {
    const meta = placedIdToInstance.get(selected.value.placedId);
    if (meta?.label && camera) {
      const d = camera.position.distanceTo(meta.center);
      const s = clamp(d * 0.08, 2.5, 7.5);
      meta.label.scale.set(s * 1.6, s * 0.45, 1);
      meta.label.position.set(meta.center.x, meta.heightFeet + 1.1, meta.center.z);
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

onUnmounted(() => {
  if (openIsoTimeout) {
    window.clearTimeout(openIsoTimeout);
    openIsoTimeout = null;
  }
  // Clean up Three.js resources
  if (renderer) {
    renderer.domElement.removeEventListener('pointermove', onPointerMove);
    renderer.domElement.removeEventListener('pointerdown', onPointerDown);
    renderer.domElement.removeEventListener('pointerup', onPointerUp);
    renderer.dispose();
  }
  if (controls) {
    controls.dispose();
  }
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
  if (selectionRing) {
    selectionRing.geometry.dispose();
    (selectionRing.material as THREE.Material).dispose();
    selectionRing = null;
  }
  for (const meta of placedIdToInstance.values()) {
    if (meta.label) {
      const mat = meta.label.material as THREE.SpriteMaterial;
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
  }
};

type ViewPreset = 'top' | 'iso';
const applyViewPresetInstant = (preset: ViewPreset) => {
  if (!camera || !controls) return;
  focusAnim = null;

  const cx = props.gridWidth / 2;
  const cz = props.gridHeight / 2;
  const d = Math.max(props.gridWidth, props.gridHeight);

  const nextTarget = new THREE.Vector3(cx, 0, cz);
  let nextCam: THREE.Vector3;
  if (preset === 'top') {
    const h = Math.max(18, d * 1.25);
    nextCam = new THREE.Vector3(cx, h, cz + Math.max(0.5, d * 0.06));
  } else {
    const dist = Math.max(18, d * 0.95);
    nextCam = new THREE.Vector3(cx + dist, Math.max(18, dist * 0.75), cz + dist);
  }

  controls.target.copy(nextTarget);
  camera.position.copy(nextCam);
  controls.update();
};
const setViewPreset = (preset: ViewPreset) => {
  if (!camera || !controls) return;
  const cx = props.gridWidth / 2;
  const cz = props.gridHeight / 2;
  const d = Math.max(props.gridWidth, props.gridHeight);

  const nextTarget = new THREE.Vector3(cx, 0, cz);
  let nextCam: THREE.Vector3;
  if (preset === 'top') {
    const h = Math.max(18, d * 1.25);
    nextCam = new THREE.Vector3(cx, h, cz + Math.max(0.5, d * 0.06));
  } else {
    const dist = Math.max(18, d * 0.95);
    nextCam = new THREE.Vector3(cx + dist, Math.max(18, dist * 0.75), cz + dist);
  }

  focusAnim = {
    startAt: performance.now(),
    durationMs: 550,
    fromTarget: controls.target.clone(),
    toTarget: nextTarget,
    fromCam: camera.position.clone(),
    toCam: nextCam
  };
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
  const offset = camera.position.clone().sub(controls.target);
  let nextCam = nextTarget.clone().add(offset);
  nextCam.y = Math.max(nextCam.y, 2.5);

  // Keep zoom within min/max distance bounds
  const dist = nextCam.distanceTo(nextTarget);
  const clampedDist = clamp(dist, minDistance.value, maxDistance.value);
  if (dist !== clampedDist) {
    const dir = nextCam.clone().sub(nextTarget).normalize();
    nextCam = nextTarget.clone().add(dir.multiplyScalar(clampedDist));
  }

  focusAnim = {
    startAt: performance.now(),
    durationMs: 550,
    fromTarget: controls.target.clone(),
    toTarget: nextTarget,
    fromCam: camera.position.clone(),
    toCam: nextCam
  };
};

const selectPlacedId = (placedId: string) => {
  const meta = placedIdToInstance.get(placedId);
  if (!meta) return;

  selectedObject = meta.mesh;
  setSelectionRing(meta);
  focusOnInstance(meta);

  const plant = props.plantById[meta.placed.plantId];
  const commonName = (plant?.['Common Name'] as string) || meta.placed.plantId;
  const scientificName = plant?.['Scientific Name'] as string | undefined;
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
};

const jumpToPlant = (plantId: string) => {
  const ids = plantIdToPlacedIds.get(plantId) ?? [];
  if (ids.length === 0) return;
  const prev = plantIdToCycleIndex.value[plantId] ?? 0;
  const next = (prev + 1) % ids.length;
  plantIdToCycleIndex.value = { ...plantIdToCycleIndex.value, [plantId]: next };
  selectPlacedId(ids[next]);
};

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
    renderer.domElement.style.cursor = hoveredObject ? 'pointer' : '';
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
  return hits.length > 0 ? (hits[0].object as THREE.Mesh) : null;
};

const onPointerMove = (ev: PointerEvent) => {
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
      if (controls) controls.enabled = false;
    }
  }
  const obj = pickObjectUnderPointer(ev);
  updateHover(obj);
};

const onPointerDown = (ev: PointerEvent) => {
  pointerDownAt = { x: ev.clientX, y: ev.clientY };
  pointerDragging = false;

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
    if (controls) controls.enabled = true;
    return;
  }

  // If user dragged to orbit/pan, don't treat it as a selection click.
  if (pointerDragging) {
    pointerDownAt = null;
    pointerDragging = false;
    dragCandidatePlacedId = null;
    dragOffsetXZ = null;
    if (controls) controls.enabled = true;
    return;
  }
  const obj = pickObjectUnderPointer(ev);
  if (obj) {
    const placedIdRaw = /** @type {any} */ (obj)?.userData?.placedId;
    const placedId = typeof placedIdRaw === 'string' ? placedIdRaw : null;
    if (placedId) selectPlacedId(placedId);
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
  const commonName = (plant?.['Common Name'] as string) || meta.placed.plantId;
  const shortName = commonName.length > 26 ? commonName.substring(0, 23) + '…' : commonName;

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d')!;
  canvas.width = 768;
  canvas.height = 192;

  // Background + border
  context.fillStyle = 'rgba(255, 255, 255, 0.92)';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = 'rgba(17, 24, 39, 0.18)';
  context.lineWidth = 6;
  context.strokeRect(3, 3, canvas.width - 6, canvas.height - 6);

  // Text
  context.fillStyle = '#111827';
  context.font = 'bold 44px Arial';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(shortName, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  const spriteMaterial = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false
  });
  const sprite = new THREE.Sprite(spriteMaterial);
  sprite.position.set(meta.center.x, meta.heightFeet + 1.1, meta.center.z);
  sprite.scale.set(6.4, 1.8, 1);
  sprite.visible = false;
  scene.add(sprite);
  meta.label = sprite;
};

const applyLabelMode = () => {
  // Hide/show labels based on mode. Default is selected-only for declutter.
  const mode = labelMode.value;
  const selectedPlacedId = selected.value?.placedId ?? null;

  for (const meta of placedIdToInstance.values()) {
    if (mode === 'all') {
      ensureLabel(meta);
      if (meta.label) meta.label.visible = true;
      continue;
    }

    if (mode === 'selected') {
      if (selectedPlacedId === meta.placed.id) {
        ensureLabel(meta);
        if (meta.label) meta.label.visible = true;
      } else if (meta.label) {
        meta.label.visible = false;
      }
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

  focusAnim = {
    startAt: performance.now(),
    durationMs: 650,
    fromTarget: controls.target.clone(),
    toTarget: nextTarget,
    fromCam: camera.position.clone(),
    toCam: nextCam
  };
};

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
</script>

<style scoped>
.garden-3d {
  position: fixed;
  inset: 0;
  background: #f8fafc;
  z-index: 1000;
}

.canvas {
  width: 100%;
  height: 100%;
  /* Prevent browser scroll/zoom gestures from fighting OrbitControls on mobile */
  touch-action: none;
}

.overlay-top {
  position: absolute;
  top: 12px;
  left: 12px;
  right: 12px;
  display: flex;
  gap: 8px;
  align-items: center;
  z-index: 1001;
  pointer-events: none;
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

.overlay-legend {
  margin-left: auto;
  padding: 8px 10px;
  border: 1px solid #e5e7eb;
  background: rgba(255, 255, 255, 0.85);
  border-radius: 10px;
  font-family: Roboto, sans-serif;
  font-size: 12px;
  color: #374151;
}

.overlay-info {
  position: absolute;
  bottom: 14px;
  left: 12px;
  right: 12px;
  max-width: 520px;
  border: 1px solid #e5e7eb;
  background: rgba(255, 255, 255, 0.92);
  border-radius: 14px;
  padding: 12px 12px 10px;
  z-index: 1001;
  backdrop-filter: blur(6px);
}

.overlay-scale {
  position: absolute;
  right: 12px;
  bottom: 14px;
  width: min(260px, 44vw);
  border: 1px solid #e5e7eb;
  background: rgba(255, 255, 255, 0.92);
  border-radius: 12px;
  padding: 10px;
  z-index: 1001;
  backdrop-filter: blur(6px);
}

.scale-row {
  display: flex;
  gap: 6px;
  align-items: baseline;
  margin-bottom: 8px;
  font-family: Roboto, sans-serif;
}

.scale-label {
  font-size: 12px;
  font-weight: 600;
  color: #374151;
}

.scale-value {
  font-size: 12px;
  color: #374151;
}

.scale-bar {
  display: grid;
  grid-template-columns: 1fr 1fr;
  height: 10px;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid rgba(17, 24, 39, 0.12);
}

.scale-bar-seg {
  background: rgba(17, 24, 39, 0.18);
}

.scale-bar-seg + .scale-bar-seg {
  background: rgba(17, 24, 39, 0.08);
  border-left: 1px solid rgba(17, 24, 39, 0.18);
}

.scale-bar-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 4px;
  font-family: Roboto, sans-serif;
  font-size: 11px;
  color: #6b7280;
}

.orientation-cue {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid rgba(229, 231, 235, 0.9);
}

.orientation-title {
  font-family: Roboto, sans-serif;
  font-size: 12px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 4px;
}

.orientation-axes {
  display: flex;
  gap: 10px;
  font-family: Roboto, sans-serif;
  font-size: 11px;
  color: #374151;
}

.axis {
  padding: 2px 6px;
  border-radius: 999px;
  border: 1px solid rgba(17, 24, 39, 0.10);
  background: rgba(17, 24, 39, 0.04);
}

.info-image {
  width: 100%;
  margin-bottom: 10px;
}

.info-image img {
  width: 100%;
  max-height: 160px;
  object-fit: cover;
  border-radius: 10px;
  display: block;
}

.info-title {
  font-family: Roboto, sans-serif;
  font-weight: 700;
  color: #111827;
}

.info-subtitle {
  font-family: Roboto, sans-serif;
  color: #4b5563;
  margin-top: 2px;
}

.info-row {
  font-family: Roboto, sans-serif;
  color: #374151;
  margin-top: 6px;
  font-size: 13px;
}

.info-actions {
  margin-top: 10px;
  display: flex;
  gap: 8px;
  align-items: center;
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

.plant-legend {
  position: absolute;
  /* Keep the legend in the same "top-left toolbar" region as the 2D planner */
  top: 56px;
  left: 12px;
  right: auto;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 10px;
  width: min(280px, 40vw);
  max-height: min(60vh, 520px);
  overflow: auto;
  z-index: 1001;
  backdrop-filter: blur(6px);
}

.legend-title {
  font-family: Roboto, sans-serif;
  font-weight: 600;
  font-size: 12px;
  color: #374151;
  margin-bottom: 6px;
}

.legend-plant {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 6px 8px;
  border-radius: 8px;
  border: 1px solid transparent;
  background: transparent;
  cursor: pointer;
  text-align: left;
  font-family: Roboto, sans-serif;
  color: #111827;
}

.legend-plant:hover {
  background: rgba(17, 24, 39, 0.06);
  border-color: rgba(17, 24, 39, 0.08);
}

.legend-plant-name {
  font-size: 12px;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.legend-plant-meta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.legend-plant-count {
  font-size: 12px;
  color: #374151;
}

.legend-plant-index {
  font-size: 11px;
  color: #6b7280;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
  font-family: Roboto, sans-serif;
  font-size: 11px;
}

.color-swatch {
  width: 12px;
  height: 12px;
  border-radius: 2px;
  border: 1px solid #ccc;
  flex-shrink: 0;
}

.family-name {
  color: #374151;
  line-height: 1.2;
}

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

  .overlay-scale {
    right: 10px;
    bottom: 10px;
    width: min(240px, 70vw);
  }

  .plant-legend {
    top: 58px;
    left: 10px;
    width: min(280px, 70vw);
  }
}
</style>


