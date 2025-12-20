<template>
  <div class="garden-3d" ref="rootRef">
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
      
      <!-- Color Legend -->
      <div class="color-legend" v-if="familyColors.length > 0">
        <div class="legend-title">Plant Families:</div>
        <div v-for="family in familyColors" :key="family.name" class="legend-item">
          <div class="color-swatch" :style="{ backgroundColor: family.hexColor }"></div>
          <span class="family-name">{{ family.name }}</span>
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

// Create a legend of plant family colors
const familyColors = computed(() => {
  const families = new Set<string>();
  props.placedPlants.forEach(placed => {
    const plant = props.plantById[placed.plantId];
    const family = plant && typeof plant['Plant Family'] === 'string' ? plant['Plant Family'] : 'Unknown';
    families.add(family);
  });
  
  return Array.from(families).map(family => {
    const color = hashToColor(family);
    return {
      name: family,
      hexColor: `#${color.getHexString()}`
    };
  });
});

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
  scene.background = new THREE.Color('#87ceeb');

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

  const cylinderGeometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 12, 1, false);
  
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
    }

    // Add text label above the plant
    const commonName = (plant && plant['Common Name']) || placed.plantId;
    const shortName = commonName.length > 20 ? commonName.substring(0, 17) + '...' : commonName;
    
    addTextLabel(shortName, x, cappedHeight + 1, z);
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
  
  // Create texture loader with CORS support
  const textureLoader = new THREE.TextureLoader();
  
  // Load the plant image with error handling
  textureLoader.setCrossOrigin('anonymous');
  textureLoader.load(
    imageUrl,
    (texture) => {
      // Success: Create cylinder with plant image texture
      console.log(`Loaded texture for ${plant['Common Name']}`);
      
      // Configure texture for better appearance
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      
      // Calculate texture repeat based on plant size
      const circumference = 2 * Math.PI * 0.5; // cylinder radius = 0.5
      const repeatX = Math.max(2, Math.round(circumference * spreadFeet)); 
      texture.repeat.set(repeatX, 1);
      
      // Create materials for different cylinder faces
      const materials = [
        // Cylinder sides - wrapped with plant image
        new THREE.MeshStandardMaterial({
          map: texture,
          roughness: 0.5,
          metalness: 0.0,
          transparent: false,
          side: THREE.FrontSide
        }),
        // Top cap - plant image viewed from above
        new THREE.MeshStandardMaterial({
          map: texture.clone(),
          roughness: 0.5,
          metalness: 0.0,
          transparent: false
        }),
        // Bottom cap - solid family color
        new THREE.MeshStandardMaterial({
          color: fallbackColor,
          roughness: 0.8,
          metalness: 0.1
        })
      ];
      
      // Configure top texture to show full plant image
      const topTexture = materials[1].map!;
      topTexture.repeat.set(1.5, 1.5);
      topTexture.center.set(0.5, 0.5);
      topTexture.wrapS = THREE.ClampToEdgeWrapping;
      topTexture.wrapT = THREE.ClampToEdgeWrapping;
      
      // Create the textured mesh
      const mesh = new THREE.Mesh(geometry, materials);
      mesh.position.set(x, y, z);
      mesh.scale.set(spreadFeet, cappedHeight, spreadFeet);
      mesh.userData = { plantId: placed.plantId, placedId: placed.id };
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      
      scene!.add(mesh);
    },
    undefined,
    (error) => {
      // Error loading texture: fallback to solid color
      console.warn(`Failed to load plant image for ${plant['Common Name']}:`, error);
      
      const material = new THREE.MeshStandardMaterial({ 
        color: fallbackColor,
        roughness: 0.7,
        metalness: 0.1
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z);
      mesh.scale.set(spreadFeet, cappedHeight, spreadFeet);
      mesh.userData = { plantId: placed.plantId, placedId: placed.id };
      
      scene!.add(mesh);
    }
  );
};

const addTextLabel = (text: string, x: number, y: number, z: number) => {
  if (!scene) return;
  
  // Create canvas for text texture
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d')!;
  canvas.width = 512;
  canvas.height = 128;
  
  // Style the text
  context.fillStyle = 'rgba(255, 255, 255, 0.9)';
  context.fillRect(0, 0, canvas.width, canvas.height);
  
  context.fillStyle = '#333333';
  context.font = 'bold 24px Arial';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, canvas.width / 2, canvas.height / 2);
  
  // Create texture and material
  const texture = new THREE.CanvasTexture(canvas);
  const spriteMaterial = new THREE.SpriteMaterial({ 
    map: texture,
    transparent: true,
    alphaTest: 0.1
  });
  
  // Create sprite
  const sprite = new THREE.Sprite(spriteMaterial);
  sprite.position.set(x, y, z);
  sprite.scale.set(4, 1, 1); // Make it readable but not too large
  
  scene!.add(sprite);
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
    // Calculate optimal camera position based on current plants
    const maxHeight = Math.max(...props.placedPlants.map(placed => {
      const plant = props.plantById[placed.plantId];
      const heightFeetRaw = plant ? plant['Height (feet)'] : null;
      return parseFeet(heightFeetRaw) ?? 1;
    }));
    
    const avgHeight = maxHeight > 0 ? maxHeight : 3;
    const cameraHeight = Math.max(15, avgHeight * 2 + 10);
    const cameraDistance = Math.max(props.gridWidth, props.gridHeight) * 0.8;
    
    camera.position.set(
      props.gridWidth / 2 + cameraDistance,
      cameraHeight,
      props.gridHeight / 2 + cameraDistance
    );
    camera.lookAt(props.gridWidth / 2, avgHeight / 2, props.gridHeight / 2);
    controls.target.set(props.gridWidth / 2, avgHeight / 2, props.gridHeight / 2);
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

.legend-title {
  font-family: Roboto, sans-serif;
  font-weight: 600;
  font-size: 12px;
  color: #374151;
  margin-bottom: 6px;
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
}
</style>


