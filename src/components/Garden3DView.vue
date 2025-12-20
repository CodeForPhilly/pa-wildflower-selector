<template>
  <div class="garden-3d" ref="rootRef">
    <div class="debug-info" style="position: absolute; top: 60px; left: 20px; background: rgba(0,0,0,0.8); color: white; padding: 10px; z-index: 1002; font-family: monospace; font-size: 12px;">
      3D View Loaded<br>
      Plants: {{ placedPlants.length }}<br>
      Grid: {{ gridWidth }}x{{ gridHeight }}
    </div>
    <div class="overlay-top">
      <button class="overlay-button" type="button" @click="$emit('close')" aria-label="Close 3D view">
        Close
      </button>
      <button class="overlay-button" type="button" @click="resetView" aria-label="Reset camera view">
        Reset view
      </button>
      <div class="overlay-legend" aria-hidden="true">
        Footprint = spread, Height = "Height (feet)"
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
    </div>

    <div ref="threeContainer" class="canvas"></div>
  </div>
</template>

<script setup lang="ts">
import { computed, shallowRef, watchEffect, onMounted, onErrorCaptured, onUnmounted, ref } from 'vue';
// @ts-ignore - project TS tooling struggles with modern package exports; runtime bundling works.
import { TresCanvas, extend } from '@tresjs/core';
// @ts-ignore - project TS tooling struggles with modern package exports; runtime bundling works.
import * as THREE from 'three';
import TresOrbitControls from './TresOrbitControls.vue';
import type { Plant, PlacedPlant } from '../types/garden';

// THREE.js classes are now extended globally in main.js

if (typeof window !== 'undefined') {
  console.log('Garden3DView: WebGL support detected', {
    webgl: !!(window as any).WebGLRenderingContext,
    webgl2: !!(window as any).WebGL2RenderingContext
  });
  
  // Test WebGL context creation
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  console.log('Garden3DView: WebGL context test', {
    contextCreated: !!gl,
    renderer: gl?.getParameter(gl.RENDERER),
    vendor: gl?.getParameter(gl.VENDOR)
  });
}

const props = defineProps<{
  placedPlants: PlacedPlant[];
  plantById: Record<string, Plant>;
  gridWidth: number;
  gridHeight: number;
  imageUrl?: (plant: Plant | undefined, preview: boolean) => string;
}>();

defineEmits<{
  (e: 'close'): void;
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

const parseFeet = (v: unknown): number | null => {
  const n = parseFloat(String(v));
  return Number.isFinite(n) && n >= 0 ? n : null;
};

const initThreeJS = () => {
  if (!threeContainer.value) return;

  const container = threeContainer.value;
  const rect = container.getBoundingClientRect();
  
  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color('#87ceeb');

  // Camera
  camera = new THREE.PerspectiveCamera(50, rect.width / rect.height, 0.1, 1000);
  camera.position.set(20, 20, 20);
  camera.lookAt(props.gridWidth / 2, 0, props.gridHeight / 2);

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(rect.width, rect.height);
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

  // Test red cube
  const cubeGeometry = new THREE.BoxGeometry(2, 2, 2);
  const cubeMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
  const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
  cube.position.set(0, 1, 0);
  scene.add(cube);

  // Ground
  const groundGeometry = new THREE.PlaneGeometry(props.gridWidth, props.gridHeight);
  const groundMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(props.gridWidth / 2, 0, props.gridHeight / 2);
  scene.add(ground);

  // Grid
  const gridHelper = new THREE.GridHelper(gridSize.value, gridDivisions.value, 0xcbd5e1, 0xe2e8f0);
  gridHelper.position.set(props.gridWidth / 2, 0.001, props.gridHeight / 2);
  scene.add(gridHelper);

  // Add plants
  addPlants();

  // Controls
  import('three/examples/jsm/controls/OrbitControls.js').then(({ OrbitControls }) => {
    controls = new OrbitControls(camera!, renderer!.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.target.set(props.gridWidth / 2, 0, props.gridHeight / 2);
    controls.update();
  });

  // Start render loop
  animate();

  console.log('Garden3DView: Three.js initialized successfully');
};

const addPlants = () => {
  if (!scene) return;

  const cylinderGeometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 12);
  
  props.placedPlants.forEach((placed) => {
    const plant = props.plantById[placed.plantId];
    const spreadFeet = placed.width;
    const heightFeetRaw = plant ? plant['Height (feet)'] : null;
    const heightFeet = parseFeet(heightFeetRaw) ?? 1;
    const cappedHeight = Math.min(Math.max(heightFeet, 0.1), 25);

    // Center of footprint
    const x = placed.x + placed.width / 2;
    const z = placed.y + placed.height / 2;
    const y = cappedHeight / 2;

    const family = plant && typeof plant['Plant Family'] === 'string' ? plant['Plant Family'] : 'Unknown';
    const color = hashToColor(String(family || 'Unknown'));
    
    const material = new THREE.MeshStandardMaterial({ color });
    const mesh = new THREE.Mesh(cylinderGeometry, material);
    
    mesh.position.set(x, y, z);
    mesh.scale.set(spreadFeet, cappedHeight, spreadFeet);
    
    scene!.add(mesh);
  });
};

const animate = () => {
  if (!renderer || !scene || !camera) return;
  
  requestAnimationFrame(animate);
  
  if (controls) {
    controls.update();
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
  // Clean up Three.js resources
  if (renderer) {
    renderer.dispose();
  }
  if (controls) {
    controls.dispose();
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
    camera.position.set(20, 20, 20);
    camera.lookAt(props.gridWidth / 2, 0, props.gridHeight / 2);
    controls.target.set(props.gridWidth / 2, 0, props.gridHeight / 2);
    controls.update();
  }
};
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
}
</style>


