<template>
  <!-- No DOM output; this component wires OrbitControls into the Tres context -->
  <span style="display:none;" />
</template>

<script setup lang="ts">
import { shallowRef, watch, onUnmounted } from 'vue';
// @ts-ignore - project TS tooling struggles with modern package exports; runtime bundling works.
import { useTresContext, useRenderLoop } from '@tresjs/core';
// @ts-ignore - project TS tooling struggles with modern package exports; runtime bundling works.
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const props = defineProps<{
  cameraPosition: any;
  target: any;
  enableDamping?: boolean;
  dampingFactor?: number;
  enablePan?: boolean;
  enableZoom?: boolean;
  enableRotate?: boolean;
  minDistance?: number;
  maxDistance?: number;
  minPolarAngle?: number;
  maxPolarAngle?: number;
}>();

const ctx = useTresContext();
const controls = shallowRef<any>(null);
const cleanup = shallowRef<(() => void) | null>(null);

const applyOptions = () => {
  if (!controls.value) return;
  controls.value.enableDamping = props.enableDamping ?? true;
  controls.value.dampingFactor = props.dampingFactor ?? 0.08;
  controls.value.enablePan = props.enablePan ?? false;
  controls.value.enableZoom = props.enableZoom ?? true;
  controls.value.enableRotate = props.enableRotate ?? true;
  if (typeof props.minDistance === 'number') controls.value.minDistance = props.minDistance;
  if (typeof props.maxDistance === 'number') controls.value.maxDistance = props.maxDistance;
  if (typeof props.minPolarAngle === 'number') controls.value.minPolarAngle = props.minPolarAngle;
  if (typeof props.maxPolarAngle === 'number') controls.value.maxPolarAngle = props.maxPolarAngle;
};

const reset = () => {
  const cam = /** @type {any} */ (ctx.camera.value);
  if (!cam) return;

  // props.cameraPosition is expected to be a THREE.Vector3-like
  cam.position.copy(props.cameraPosition);
  cam.updateProjectionMatrix?.();

  if (controls.value?.target) {
    controls.value.target.copy(props.target);
  }
  applyOptions();
  controls.value?.update?.();
};

defineExpose({ reset });

watch(
  () => [ctx.camera.value, ctx.renderer.value, props.cameraPosition, props.target],
  () => {
    const cam = /** @type {any} */ (ctx.camera.value);
    const renderer = /** @type {any} */ (ctx.renderer.value);
    if (!cam || !renderer || controls.value) return;

    const c = new OrbitControls(cam, renderer.domElement);
    controls.value = c;
    ctx.controls.value = c;

    reset();
    cleanup.value = () => {
      try {
        c.dispose?.();
      } catch {
        // ignore
      }
      if (ctx.controls.value === c) ctx.controls.value = null;
      controls.value = null;
    };
  },
  { immediate: true }
);

const { onLoop } = useRenderLoop();
onLoop(() => {
  if (controls.value?.update) controls.value.update();
});

onUnmounted(() => {
  cleanup.value?.();
});
</script>





