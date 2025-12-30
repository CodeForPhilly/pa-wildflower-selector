<template>
  <div
    v-if="open"
    class="overlay"
    role="presentation"
    @mousedown.self="emitClose"
    @keydown.esc.prevent="emitClose"
  >
    <div
      class="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bulk-add-title"
      @keydown.tab="handleTab"
      ref="modalEl"
    >
      <!-- focus trap -->
      <span tabindex="0" @focus="focusLast" aria-hidden="true"></span>

      <header class="header">
        <div class="header-text">
          <h2 id="bulk-add-title">Bulk add favorites</h2>
          <p class="subtitle" v-if="result">Here’s what we found.</p>
          <!-- Keep header height consistent between paste + summary states -->
          <p v-else class="subtitle subtitle--spacer" aria-hidden="true">&nbsp;</p>
        </div>
        <button type="button" class="icon-button" @click="emitClose" aria-label="Close">
          <span class="material-icons">close</span>
        </button>
      </header>

      <section class="body">
        <template v-if="result">
          <div class="result-summary" aria-live="polite">
            <div class="summary-card">
              <div class="summary-number">{{ result.addedCount }}</div>
              <div class="summary-label">Added</div>
            </div>
            <div class="summary-card">
              <div class="summary-number">{{ result.alreadyCount }}</div>
              <div class="summary-label">Already in favorites</div>
            </div>
            <div class="summary-card">
              <div class="summary-number">{{ result.notFound.length }}</div>
              <div class="summary-label">Not found</div>
            </div>
          </div>

          <details v-if="result.notFound.length" class="not-found">
            <summary>Not found ({{ result.notFound.length }})</summary>
            <div class="not-found-actions">
              <button type="button" class="text" @click="copyNotFound">Copy not found</button>
            </div>
            <ul class="not-found-list">
              <li v-for="t in result.notFound" :key="t">{{ t }}</li>
            </ul>
          </details>
        </template>

        <template v-else>
          <label class="label" for="bulk-add-text">Paste your plant list</label>
          <p class="helper">
            Paste any text from a list, PDF, email, or spreadsheet. We’ll pick out plant names
            automatically — extra words are okay. <strong>Only US native plants (from our database) will be added.</strong>
          </p>

          <textarea
            id="bulk-add-text"
            class="textarea"
            :value="modelValue"
            @input="onInput"
            :disabled="loading"
            placeholder="Red maple&#10;Acer rubrum&#10;Bloodroot"
            ref="textareaEl"
          />

        </template>
      </section>

      <footer class="footer">
        <div class="status" role="status" aria-live="polite">
          <span v-if="loading">Matching names…</span>
        </div>
        <div class="actions">
          <button type="button" class="secondary" @click="emitClose" :disabled="loading">
            {{ result ? 'Close' : 'Cancel' }}
          </button>
          <button
            v-if="!result"
            type="button"
            class="primary"
            @click="emitSubmit"
            :disabled="loading || !canSubmit"
          >
            Add favorites
          </button>
        </div>
      </footer>

      <!-- focus trap -->
      <span tabindex="0" @focus="focusFirst" aria-hidden="true"></span>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from "vue";

const props = defineProps({
  open: { type: Boolean, default: false },
  modelValue: { type: String, default: "" },
  loading: { type: Boolean, default: false },
  maxTokens: { type: Number, default: 1000 },
  result: {
    type: Object,
    default: null,
  },
});

const emit = defineEmits(["update:modelValue", "close", "submit"]);

const textareaEl = ref(null);
const modalEl = ref(null);

const emitClose = () => emit("close");
const emitSubmit = () => emit("submit", props.modelValue);

const onInput = (e) => emit("update:modelValue", e.target.value);

const canSubmit = computed(() => String(props.modelValue || "").trim().length > 0);

const copyNotFound = async () => {
  const text = (props.result?.notFound || []).join("\n");
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
  } catch (e) {
    // Ignore if clipboard is not available; user can select manually.
    console.error("Failed to copy not found list:", e);
  }
};

// Focus handling
const focusFirst = async () => {
  await nextTick();
  const el = props.result ? modalEl.value?.querySelector("button.icon-button") : textareaEl.value;
  el?.focus?.();
};

const focusLast = async () => {
  await nextTick();
  const buttons = modalEl.value?.querySelectorAll("button, [href], textarea, input, select, [tabindex]:not([tabindex=\"-1\"])");
  const last = buttons && buttons.length ? buttons[buttons.length - 1] : null;
  last?.focus?.();
};

const handleTab = (e) => {
  // Minimal trap: keep focus inside modal while open
  const focusables = modalEl.value?.querySelectorAll(
    "button, [href], textarea, input, select, [tabindex]:not([tabindex=\"-1\"])"
  );
  if (!focusables || focusables.length === 0) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
};

watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen) await focusFirst();
  }
);

onMounted(() => {
  // If opened immediately on mount, focus correctly
  if (props.open) focusFirst();
});
</script>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: grid;
  place-items: center;
  padding: 16px;
  z-index: 9999;
}

.modal {
  width: min(640px, 100%);
  max-height: min(85vh, 900px);
  overflow: auto;
  background: #fcf9f4;
  border: 1px solid rgba(0,0,0,0.15);
  border-radius: 16px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.25);
  padding: 16px;
}

.header {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(0,0,0,0.1);
}

.header h2 {
  margin: 0;
  font-family: Arvo;
  font-size: 22px;
}

.subtitle {
  margin: 4px 0 0;
  color: #555;
  font-family: Roboto;
  font-size: 14px;
  min-height: 18px;
}

.subtitle--spacer {
  visibility: hidden;
}

.icon-button {
  border: none;
  background: transparent;
  padding: 6px;
  border-radius: 10px;
  color: #1d2e26;
}

.icon-button:focus-visible {
  outline: 3px solid rgba(183, 77, 21, 0.35);
  outline-offset: 2px;
}

.body {
  padding: 14px 0;
}

.label {
  display: block;
  font-family: Roboto;
  font-weight: 700;
  margin-bottom: 6px;
}

.helper {
  margin: 0 0 10px;
  color: #444;
  font-family: Roboto;
  font-size: 14px;
  line-height: 1.4;
}

.textarea {
  width: 100%;
  min-height: 160px;
  border-radius: 12px;
  border: 1px solid rgba(0,0,0,0.18);
  padding: 12px;
  font-family: Roboto, sans-serif;
  font-size: 14px;
  resize: vertical;
  background: #fff;
}

.textarea:focus-visible {
  outline: 3px solid rgba(183, 77, 21, 0.35);
  outline-offset: 2px;
}

.footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(0,0,0,0.1);
}

.status {
  font-family: Roboto;
  font-size: 13px;
  color: #444;
}

.actions {
  display: flex;
  gap: 10px;
}

button.primary,
button.secondary {
  border-radius: 10px;
  padding: 10px 14px;
  font-family: Roboto;
  font-size: 14px;
}

button.primary {
  background-color: #b74d15;
  color: #fcf9f4;
  border: 1px solid #b74d15;
}

button.secondary {
  background: transparent;
  color: #b74d15;
  border: 1px solid #b74d15;
}

button[disabled] {
  opacity: 0.55;
  cursor: not-allowed;
}

.result-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.summary-card {
  background: rgba(255,255,255,0.75);
  border: 1px solid rgba(0,0,0,0.12);
  border-radius: 12px;
  padding: 12px;
  text-align: center;
}

.summary-number {
  font-family: Arvo;
  font-size: 26px;
  color: #1d2e26;
}

.summary-label {
  font-family: Roboto;
  font-size: 13px;
  color: #555;
  margin-top: 2px;
}

.not-found {
  margin-top: 14px;
  font-family: Roboto;
}

.not-found summary {
  cursor: pointer;
  font-weight: 700;
}

.not-found-actions {
  margin: 10px 0 6px;
}

button.text {
  background: transparent;
  border: none;
  color: #b74d15;
  text-decoration: underline;
  padding: 0;
  font-family: Roboto;
  cursor: pointer;
}

.not-found-list {
  margin: 0;
  padding-left: 18px;
  color: #333;
}

@media (max-width: 700px) {
  .result-summary {
    grid-template-columns: 1fr;
  }
}
</style>


