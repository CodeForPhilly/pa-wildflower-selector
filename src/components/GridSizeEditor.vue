<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="modal-overlay"
      @click.self="handleCancel"
      @keydown.esc="handleCancel"
      role="dialog"
      aria-labelledby="modal-title"
      aria-describedby="modal-description"
    >
      <div class="modal-content" ref="modalContentRef">
        <h2 id="modal-title" class="modal-title">Grid size</h2>
        <p id="modal-description" class="modal-description">Set the garden dimensions (minimum to fit plants, up to 100 ft).</p>
        
        <div class="input-group">
          <div class="input-field-wrapper">
            <div class="input-field-row">
              <label for="grid-width" class="input-label">Width</label>
              <div class="input-with-steppers">
              <div class="input-container">
                <input
                  id="grid-width"
                  type="number"
                  v-model.number="localWidth"
                  :min="props.minSize ? Math.max(1, props.minSize.width) : 1"
                  max="100"
                  step="1"
                  inputmode="numeric"
                  :class="{ error: widthErrorMessage }"
                  @blur="validateWidth"
                  @input="clearWidthError"
                  :aria-invalid="widthErrorMessage ? 'true' : 'false'"
                  aria-describedby="width-error"
                />
                <span class="input-suffix">ft</span>
              </div>
              <button
                type="button"
                class="stepper-btn stepper-minus"
                :class="{ 'flash-red': widthFlashRed }"
                @click="decrementWidth"
                aria-label="Decrease width"
              >
                −
              </button>
              <button
                type="button"
                class="stepper-btn stepper-plus"
                @click="incrementWidth"
                :disabled="localWidth >= 100"
                aria-label="Increase width"
              >
                +
              </button>
              </div>
            </div>
            <div v-if="widthErrorMessage" id="width-error" class="field-error" role="alert">
              {{ widthErrorMessage }}
            </div>
          </div>

          <div class="input-field-wrapper">
            <div class="input-field-row">
              <label for="grid-height" class="input-label">Height</label>
              <div class="input-with-steppers">
              <div class="input-container">
                <input
                  id="grid-height"
                  type="number"
                  v-model.number="localHeight"
                  :min="props.minSize ? Math.max(1, props.minSize.height) : 1"
                  max="100"
                  step="1"
                  inputmode="numeric"
                  :class="{ error: heightErrorMessage }"
                  @blur="validateHeight"
                  @input="clearHeightError"
                  :aria-invalid="heightErrorMessage ? 'true' : 'false'"
                  aria-describedby="height-error"
                />
                <span class="input-suffix">ft</span>
              </div>
              <button
                type="button"
                class="stepper-btn stepper-minus"
                :class="{ 'flash-red': heightFlashRed }"
                @click="decrementHeight"
                aria-label="Decrease height"
              >
                −
              </button>
              <button
                type="button"
                class="stepper-btn stepper-plus"
                @click="incrementHeight"
                :disabled="localHeight >= 100"
                aria-label="Increase height"
              >
                +
              </button>
              </div>
            </div>
            <div v-if="heightErrorMessage" id="height-error" class="field-error" role="alert">
              {{ heightErrorMessage }}
            </div>
          </div>
        </div>

        <div v-if="minSize" class="min-size-info">
          <span class="min-size-text">To fit all plants, minimum: <strong>{{ minSize.width }} ft × {{ minSize.height }} ft</strong></span>
          <button type="button" class="use-minimum-btn" @click="useMinimumSize">Use minimum</button>
        </div>

        <div class="button-group">
          <button
            class="btn-apply"
            @click="handleApply"
            :disabled="!isValid"
            aria-label="Apply grid size changes"
          >
            Apply
          </button>
          <button
            type="button"
            class="btn-cancel"
            @click="handleCancel"
            aria-label="Cancel and close dialog"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';
import type { PlacedPlant } from '../types/garden';

interface Props {
  isOpen: boolean;
  currentWidth: number;
  currentHeight: number;
  minSize: { width: number; height: number } | null;
  placedPlantsCount: number;
}

interface Emits {
  (e: 'close'): void;
  (e: 'apply', width: number, height: number): void;
  (e: 'fit-to-plants'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const modalContentRef = ref<HTMLElement | null>(null);
const localWidth = ref(props.currentWidth);
const localHeight = ref(props.currentHeight);
const widthErrorMessage = ref('');
const heightErrorMessage = ref('');
const widthFlashRed = ref(false);
const heightFlashRed = ref(false);

// Focus trap management
let focusableElements: HTMLElement[] = [];
let firstFocusableElement: HTMLElement | null = null;
let lastFocusableElement: HTMLElement | null = null;

const updateFocusableElements = () => {
  if (!modalContentRef.value) return;
  const focusableSelectors = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
  focusableElements = Array.from(
    modalContentRef.value.querySelectorAll<HTMLElement>(focusableSelectors)
  ).filter(el => !el.hasAttribute('disabled'));
  firstFocusableElement = focusableElements[0] || null;
  lastFocusableElement = focusableElements[focusableElements.length - 1] || null;
};

const trapFocus = (e: KeyboardEvent) => {
  if (!props.isOpen || focusableElements.length === 0) return;
  
  if (e.key === 'Tab') {
    if (e.shiftKey) {
      if (document.activeElement === firstFocusableElement) {
        e.preventDefault();
        lastFocusableElement?.focus();
      }
    } else {
      if (document.activeElement === lastFocusableElement) {
        e.preventDefault();
        firstFocusableElement?.focus();
      }
    }
  }
};

// Watch for prop changes to update local values
watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    localWidth.value = props.currentWidth;
    localHeight.value = props.currentHeight;
    widthErrorMessage.value = '';
    heightErrorMessage.value = '';
    widthFlashRed.value = false;
    heightFlashRed.value = false;
    nextTick(() => {
      updateFocusableElements();
      firstFocusableElement?.focus();
    });
  }
});

watch(() => props.currentWidth, (newWidth) => {
  if (!props.isOpen) {
    localWidth.value = newWidth;
  }
});

watch(() => props.currentHeight, (newHeight) => {
  if (!props.isOpen) {
    localHeight.value = newHeight;
  }
});

// Stepper controls
const incrementWidth = () => {
  if (localWidth.value < 100) {
    localWidth.value = Math.min(100, localWidth.value + 1);
    clearWidthError();
  }
};

const decrementWidth = () => {
  const minWidth = props.minSize ? Math.max(1, props.minSize.width) : 1;
  if (localWidth.value > minWidth) {
    localWidth.value = Math.max(minWidth, localWidth.value - 1);
    clearWidthError();
  } else {
    // Flash red when trying to go below minimum
    widthFlashRed.value = true;
    setTimeout(() => {
      widthFlashRed.value = false;
    }, 300);
  }
};

const incrementHeight = () => {
  if (localHeight.value < 100) {
    localHeight.value = Math.min(100, localHeight.value + 1);
    clearHeightError();
  }
};

const decrementHeight = () => {
  const minHeight = props.minSize ? Math.max(1, props.minSize.height) : 1;
  if (localHeight.value > minHeight) {
    localHeight.value = Math.max(minHeight, localHeight.value - 1);
    clearHeightError();
  } else {
    // Flash red when trying to go below minimum
    heightFlashRed.value = true;
    setTimeout(() => {
      heightFlashRed.value = false;
    }, 300);
  }
};

// Validation
const validateWidth = () => {
  widthErrorMessage.value = '';
  // Check plant minimum first
  if (props.minSize && localWidth.value < props.minSize.width) {
    widthErrorMessage.value = `Must be at least ${props.minSize.width} ft to fit all plants`;
    return false;
  }
  // Then check general range (1-100 ft) if no plant minimum constraint
  if (localWidth.value < 1 || localWidth.value > 100) {
    widthErrorMessage.value = 'Must be between 1 and 100 ft';
    return false;
  }
  return true;
};

const validateHeight = () => {
  heightErrorMessage.value = '';
  // Check plant minimum first
  if (props.minSize && localHeight.value < props.minSize.height) {
    heightErrorMessage.value = `Must be at least ${props.minSize.height} ft to fit all plants`;
    return false;
  }
  // Then check general range (1-100 ft) if no plant minimum constraint
  if (localHeight.value < 1 || localHeight.value > 100) {
    heightErrorMessage.value = 'Must be between 1 and 100 ft';
    return false;
  }
  return true;
};

const clearWidthError = () => {
  widthErrorMessage.value = '';
};

const clearHeightError = () => {
  heightErrorMessage.value = '';
};

const isValid = computed(() => {
  // Check plant minimums first
  if (props.minSize) {
    if (localWidth.value < props.minSize.width || localWidth.value > 100) return false;
    if (localHeight.value < props.minSize.height || localHeight.value > 100) return false;
  } else {
    // No plants, enforce 1ft minimum
    if (localWidth.value < 1 || localWidth.value > 100) return false;
    if (localHeight.value < 1 || localHeight.value > 100) return false;
  }
  return true;
});

const useMinimumSize = () => {
  // Use fitGridToPlants which will shift plants and set grid to minimum size
  emit('fit-to-plants');
  emit('close');
};

const handleApply = () => {
  const widthValid = validateWidth();
  const heightValid = validateHeight();
  
  if (!widthValid || !heightValid) {
    return;
  }
  
  emit('apply', localWidth.value, localHeight.value);
  emit('close');
};

const handleCancel = () => {
  widthErrorMessage.value = '';
  heightErrorMessage.value = '';
  localWidth.value = props.currentWidth;
  localHeight.value = props.currentHeight;
  emit('close');
};

// Focus trap and ESC key handling
onMounted(() => {
  document.addEventListener('keydown', trapFocus);
});

onUnmounted(() => {
  document.removeEventListener('keydown', trapFocus);
});
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.modal-content {
  background: white;
  border-radius: 12px;
  padding: 20px;
  max-width: 360px;
  width: 90%;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  max-height: 90vh;
  overflow-y: auto;
}

.modal-title {
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 4px 0;
  color: #1a1a1a;
}

.modal-description {
  font-size: 14px;
  color: #666;
  margin: 0 0 16px 0;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 12px;
}

.input-field-wrapper {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.input-field-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.input-label {
  font-size: 14px;
  font-weight: 500;
  color: #333;
  white-space: nowrap;
  min-width: 60px;
}

.input-with-steppers {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
  max-width: 200px;
}

.stepper-btn {
  min-width: 44px;
  height: 44px;
  padding: 0;
  border: 1px solid #ddd;
  background-color: white;
  color: #333;
  border-radius: 6px;
  font-size: 18px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s, border-color 0.2s;
  user-select: none;
}

.stepper-btn:hover:not(:disabled) {
  background-color: #f5f5f5;
  border-color: #999;
}

.stepper-btn:focus {
  outline: 2px solid #4caf50;
  outline-offset: 2px;
}

.stepper-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.stepper-btn.flash-red {
  animation: flashRed 0.3s ease-in-out;
}

@keyframes flashRed {
  0% {
    background-color: white;
    border-color: #ddd;
  }
  50% {
    background-color: #ffebee;
    border-color: #d32f2f;
    color: #d32f2f;
  }
  100% {
    background-color: white;
    border-color: #ddd;
    color: #333;
  }
}

.input-container {
  position: relative;
  display: flex;
  align-items: center;
  width: 80px;
  flex-shrink: 0;
}

.input-container input {
  width: 100%;
  padding: 10px 28px 10px 10px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 16px;
  font-family: inherit;
  box-sizing: border-box;
  min-height: 44px;
  -moz-appearance: textfield;
  appearance: textfield;
}

.input-container input::-webkit-outer-spin-button,
.input-container input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.input-container input:focus {
  outline: none;
  border-color: #4caf50;
  box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.1);
}

.input-container input.error {
  border-color: #d32f2f;
}

.input-container input.error:focus {
  border-color: #d32f2f;
  box-shadow: 0 0 0 2px rgba(211, 47, 47, 0.1);
}

.input-suffix {
  position: absolute;
  right: 10px;
  color: #666;
  font-size: 14px;
  pointer-events: none;
}

.field-error {
  color: #d32f2f;
  font-size: 12px;
  margin-top: 4px;
}

.min-size-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  background-color: #f5f5f5;
  border-radius: 6px;
  margin-bottom: 12px;
  font-size: 13px;
  color: #333;
}

.min-size-text {
  flex: 1;
}

.min-size-text strong {
  font-weight: 600;
}

.use-minimum-btn {
  padding: 6px 12px;
  background: transparent;
  border: 1px solid #4caf50;
  color: #4caf50;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
  white-space: nowrap;
  min-height: 32px;
}

.use-minimum-btn:hover {
  background-color: #f1f8f4;
}

.use-minimum-btn:focus {
  outline: 2px solid #4caf50;
  outline-offset: 2px;
}

.button-group {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
}

.btn-apply {
  flex: 1;
  min-height: 44px;
  padding: 12px 24px;
  background-color: #424242;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.btn-apply:hover:not(:disabled) {
  background-color: #616161;
}

.btn-apply:focus {
  outline: 2px solid #424242;
  outline-offset: 2px;
}

.btn-apply:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

.btn-cancel {
  flex: 1;
  min-height: 44px;
  padding: 12px 24px;
  background-color: transparent;
  color: #333;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
  text-decoration: none;
}

.btn-cancel:hover {
  background-color: #f5f5f5;
}

.btn-cancel:focus {
  outline: 2px solid #4caf50;
  outline-offset: 2px;
}

@media screen and (max-width: 767px) {
  .modal-content {
    padding: 16px;
    width: 95%;
  }

  .min-size-info {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .use-minimum-btn {
    width: 100%;
  }
}
</style>
