<template>
  <!-- No DOM output; this component wires OrbitControls into the Tres context -->
  <span style="display:none;" />
</template>

<script setup lang="ts">
import { shallowRef, watch, onUnmounted } from 'vue';
// @ts-ignore - project TS tooling struggles with modern package exports; runtime bundling works.
import { useTresContext, useRenderLoop } from '@tresjs/core';
// @ts-ignore - project TS tooling struggles with modern package exports; runtime bundling works.
import * as THREE from 'three';
// @ts-ignore - project TS tooling struggles with modern package exports; runtime bundling works.
import CameraControls from 'camera-controls';

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
  // CameraControls uses time-based smoothing. Treat "disable damping" as instant.
  const dampingOn = props.enableDamping ?? true;
  controls.value.smoothTime = dampingOn ? 0.22 : 0;
  controls.value.draggingSmoothTime = dampingOn ? 0.14 : 0;

  // Input mapping (rough OrbitControls parity)
  const ACTION = /** @type {any} */ (CameraControls).ACTION;
  const enableRotate = props.enableRotate ?? true;
  const enablePan = props.enablePan ?? false;
  const enableZoom = props.enableZoom ?? true;
  if (controls.value.mouseButtons && ACTION) {
    controls.value.mouseButtons.left = enableRotate ? ACTION.ROTATE : ACTION.NONE;
    controls.value.mouseButtons.right = enablePan ? ACTION.TRUCK : ACTION.NONE;
    controls.value.mouseButtons.wheel = enableZoom ? ACTION.DOLLY : ACTION.NONE;
  }

  if (typeof props.minDistance === 'number') controls.value.minDistance = props.minDistance;
  if (typeof props.maxDistance === 'number') controls.value.maxDistance = props.maxDistance;

  // Clamp polar angle so you can't orbit under the scene.
  controls.value.minPolarAngle = typeof props.minPolarAngle === 'number' ? props.minPolarAngle : 0.05;
  controls.value.maxPolarAngle = typeof props.maxPolarAngle === 'number' ? props.maxPolarAngle : Math.PI / 2 - 0.08;

  // Slight UX improvement for zooming
  controls.value.dollyToCursor = true;
};

const reset = () => {
  const cam = /** @type {any} */ (ctx.camera.value);
  if (!cam) return;

  applyOptions();
  if (controls.value?.setLookAt && props.cameraPosition && props.target) {
    controls.value.setLookAt(
      props.cameraPosition.x,
      props.cameraPosition.y,
      props.cameraPosition.z,
      props.target.x,
      props.target.y,
      props.target.z,
      false
    );
  }
};

defineExpose({ reset });

watch(
  () => [ctx.camera.value, ctx.renderer.value, props.cameraPosition, props.target],
  () => {
    const cam = /** @type {any} */ (ctx.camera.value);
    const renderer = /** @type {any} */ (ctx.renderer.value);
    if (!cam || !renderer || controls.value) return;

    try {
      CameraControls.install({ THREE });
    } catch {
      // ignore
    }

    const c = new CameraControls(cam, renderer.domElement);
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
onLoop((state: any) => {
  const dt = typeof state?.delta === 'number' ? state.delta : 1 / 60;
  if (controls.value?.update) controls.value.update(dt);
});

onUnmounted(() => {
  cleanup.value?.();
});
</script>





