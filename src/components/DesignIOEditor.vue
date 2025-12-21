<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="modal-overlay"
      @click.self="handleClose"
      @keydown.esc="handleClose"
      role="dialog"
      aria-labelledby="designio-title"
      aria-describedby="designio-description"
    >
      <div class="modal-content" ref="modalContentRef">
        <div class="header-row">
          <h2 id="designio-title" class="modal-title">
            {{ mode === 'export' ? 'Export design' : 'Import design' }}
          </h2>
          <button type="button" class="close-btn" @click="handleClose" aria-label="Close dialog">
            ✕
          </button>
        </div>

        <p id="designio-description" class="modal-description">
          <template v-if="mode === 'export'">
            Copy this JSON to share, back up, or ask ChatGPT for an optimized layout.
          </template>
          <template v-else>
            Paste a JSON design to replace your current grid layout.
          </template>
        </p>

        <div v-if="mode === 'import'" class="warning">
          <strong>Warning:</strong> Importing overwrites your current grid size and placed plants, and will add any plant IDs
          found in the import as new favorites.
        </div>

        <textarea
          class="editor"
          :readonly="mode === 'export'"
          v-model="text"
          spellcheck="false"
          placeholder='Paste design JSON here…'
          aria-label="Design JSON editor"
        />

        <div v-if="errorMessage" class="error" role="alert">
          {{ errorMessage }}
        </div>

        <div class="button-row">
          <template v-if="mode === 'export'">
            <button type="button" class="btn" @click="copyToClipboard">
              Copy
            </button>
            <button type="button" class="btn" @click="downloadJson">
              Download
            </button>
            <button type="button" class="btn secondary" @click="handleClose">
              Close
            </button>
          </template>
          <template v-else>
            <button type="button" class="btn danger" :disabled="!text.trim()" @click="confirmAndImport">
              Import (overwrite)
            </button>
            <button type="button" class="btn secondary" @click="handleClose">
              Cancel
            </button>
          </template>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';

interface Props {
  isOpen: boolean;
  mode: 'export' | 'import';
  initialText?: string;
}

interface Emits {
  (e: 'close'): void;
  (e: 'import', text: string): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const text = ref(props.initialText ?? '');
const errorMessage = ref('');
const modalContentRef = ref<HTMLElement | null>(null);

watch(
  () => [props.isOpen, props.mode, props.initialText] as const,
  ([open, _mode, initial]) => {
    if (!open) return;
    errorMessage.value = '';
    text.value = initial ?? '';
    nextTick(() => {
      const el = modalContentRef.value?.querySelector('textarea') as HTMLTextAreaElement | null;
      el?.focus();
      el?.select();
    });
  }
);

const handleClose = () => {
  errorMessage.value = '';
  emit('close');
};

const copyToClipboard = async () => {
  try {
    await navigator.clipboard.writeText(text.value);
  } catch {
    // Fallback: select so user can copy.
    const el = modalContentRef.value?.querySelector('textarea') as HTMLTextAreaElement | null;
    el?.focus();
    el?.select();
    errorMessage.value = 'Could not copy automatically. The text is selected—press Ctrl+C.';
  }
};

const downloadJson = () => {
  try {
    const blob = new Blob([text.value], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'garden-design.json';
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    errorMessage.value = 'Could not start download.';
  }
};

const confirmAndImport = () => {
  if (!text.value.trim()) return;
  const ok = window.confirm(
    'Importing will overwrite your current grid size and placed plants. Continue?'
  );
  if (!ok) return;
  emit('import', text.value);
};
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1100;
}

.modal-content {
  background: white;
  border-radius: 12px;
  padding: 18px;
  max-width: 410px;
  width: 95%;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.modal-title {
  font-size: 18px;
  font-weight: 700;
  margin: 0;
  color: #1a1a1a;
  font-family: Roboto, sans-serif;
}

.close-btn {
  border: 1px solid #e5e5e5;
  background: #fff;
  border-radius: 8px;
  width: 36px;
  height: 36px;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
}

.modal-description {
  font-size: 13px;
  color: #555;
  margin: 0;
  font-family: Roboto, sans-serif;
}

.warning {
  background: #fff7ed;
  border: 1px solid #fdba74;
  border-left: 3px solid #f97316;
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 13px;
  color: #7c2d12;
  font-family: Roboto, sans-serif;
}

.editor {
  width: 100%;
  min-height: 320px;
  resize: vertical;
  padding: 12px;
  border-radius: 10px;
  border: 1px solid #d1d5db;
  font-family: "Roboto Mono", monospace;
  font-size: 12px;
  line-height: 1.45;
  color: #111827;
  background: #fafafa;
  outline: none;
}

.editor:focus {
  border-color: #4caf50;
  box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.12);
}

.error {
  color: #b91c1c;
  font-size: 13px;
  font-family: Roboto, sans-serif;
}

.button-row {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  flex-wrap: wrap;
}

.btn {
  min-height: 40px;
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid #d1d5db;
  background: #fff;
  font-family: Roboto, sans-serif;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.btn:hover:not(:disabled) {
  background: #f9fafb;
}

.btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.btn.secondary {
  border-color: transparent;
  background: transparent;
  font-weight: 600;
}

.btn.secondary:hover {
  background: #f3f4f6;
}

.btn.danger {
  background: #b00020;
  border-color: #b00020;
  color: #fff;
}

.btn.danger:hover:not(:disabled) {
  background: #8f0019;
  border-color: #8f0019;
}

.btn.switch-btn {
  background: #4caf50;
  border-color: #4caf50;
  color: #fff;
}

.btn.switch-btn:hover {
  background: #45a049;
  border-color: #45a049;
}
</style>




