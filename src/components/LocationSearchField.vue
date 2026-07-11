<template>
  <div
    class="location-field"
    :class="[`location-field--${variant}`, { 'location-field--editing': editing }]"
    ref="root"
  >
    <label v-if="showLabel" :for="inputId" class="location-field-label">
      Location
    </label>
    <div class="location-field-control">
      <span class="material-icons location-field-icon" aria-hidden="true">place</span>
      <div class="location-field-input-wrap">
        <input
          :id="inputId"
          ref="input"
          class="location-field-input"
          type="text"
          inputmode="numeric"
          maxlength="5"
          :value="editing ? draft : appliedZip"
          :placeholder="placeholder"
          :disabled="disabled || resolving || externalLoading"
          :aria-label="ariaLabel"
          :aria-invalid="!!displayError"
          :aria-describedby="displayError ? errorId : undefined"
          autocomplete="postal-code"
          @input="onInput"
          @focus="onFocus"
          @blur="onBlur"
          @keydown="onKeydown"
        />
        <button
          v-if="showSummaryOverlay"
          type="button"
          class="location-field-summary"
          :title="summaryText"
          tabindex="-1"
          aria-hidden="true"
          @mousedown.prevent="onSummaryClick"
        >
          {{ summaryText }}
        </button>
      </div>
      <button
        v-if="useCurrentLocationHandler && !resolving"
        type="button"
        class="location-field-locate"
        aria-label="Use my location"
        title="Use my location"
        :disabled="disabled || externalLoading"
        @click.stop.prevent="onUseCurrentLocation"
      >
        <span class="material-icons" aria-hidden="true">my_location</span>
      </button>
      <button
        v-if="appliedZip && !resolving && !externalLoading"
        type="button"
        class="location-field-clear"
        aria-label="Clear location"
        @mousedown.prevent="onClear"
      >
        <span class="material-icons" aria-hidden="true">close</span>
      </button>
      <span
        v-if="resolving || externalLoading"
        class="location-field-spinner"
        aria-hidden="true"
      ></span>
    </div>
    <p v-if="displayError" :id="errorId" class="location-field-error" role="alert">
      {{ displayError }}
    </p>
  </div>
</template>

<script>
const AUTO_COMMIT_IDLE_MS = 500;

let nextFieldId = 0;

export default {
  name: "LocationSearchField",
  props: {
    variant: {
      type: String,
      default: "bar",
      validator: (value) => ["bar", "toolbar", "drawer", "inline"].includes(value),
    },
    appliedZip: {
      type: String,
      default: "",
    },
    appliedDisplayLocation: {
      type: String,
      default: "",
    },
    commitHandler: {
      type: Function,
      required: true,
    },
    useCurrentLocationHandler: {
      type: Function,
      default: null,
    },
    externalError: {
      type: String,
      default: "",
    },
    externalLoading: {
      type: Boolean,
      default: false,
    },
    disabled: {
      type: Boolean,
      default: false,
    },
    showLabel: {
      type: Boolean,
      default: false,
    },
  },
  emits: ["cleared", "drafted"],
  data() {
    const fieldId = `location-field-${++nextFieldId}`;
    return {
      inputId: fieldId,
      errorId: `${fieldId}-error`,
      draft: "",
      editing: false,
      error: null,
      resolving: false,
      autoCommitTimer: null,
      blurSuppressUntil: 0,
    };
  },
  computed: {
    placeholder() {
      if (this.variant === "drawer") return "ZIP code";
      if (this.variant === "toolbar") return "ZIP";
      return "Enter ZIP code";
    },
    ariaLabel() {
      if (this.summaryText) {
        return `Location: ${this.summaryText}. Enter ZIP code to change.`;
      }
      return "ZIP code";
    },
    summaryText() {
      const zip = (this.appliedZip || "").trim();
      const location = (this.appliedDisplayLocation || "").trim();
      if (location && zip) {
        return `${location} · ${zip}`;
      }
      if (location) {
        return location;
      }
      if (zip) {
        return zip;
      }
      return "";
    },
    showSummaryOverlay() {
      return !this.editing && !!this.summaryText && !this.error;
    },
    displayError() {
      return this.error || this.externalError || "";
    },
  },
  watch: {
    appliedZip(next) {
      if (!this.editing) {
        this.draft = next || "";
      }
    },
  },
  beforeUnmount() {
    this.clearAutoCommitTimer();
  },
  methods: {
    focus() {
      const input = this.$refs.input;
      if (input && typeof input.focus === "function") {
        input.focus();
      }
    },
    clearAutoCommitTimer() {
      if (this.autoCommitTimer) {
        clearTimeout(this.autoCommitTimer);
        this.autoCommitTimer = null;
      }
    },
    scheduleAutoCommit() {
      this.clearAutoCommitTimer();
      if (!/^\d{5}$/.test(this.draft)) {
        return;
      }
      if (this.draft === this.appliedZip) {
        return;
      }
      this.autoCommitTimer = setTimeout(() => {
        this.autoCommitTimer = null;
        void this.tryCommit();
      }, AUTO_COMMIT_IDLE_MS);
    },
    onInput(event) {
      const digits = String(event.target.value || "").replace(/\D/g, "").slice(0, 5);
      this.draft = digits;
      this.error = null;
      this.$emit("drafted");
      this.editing = true;
      if (event.target.value !== digits) {
        event.target.value = digits;
      }
      this.scheduleAutoCommit();
    },
    onFocus() {
      this.editing = true;
      this.error = null;
      if (!this.draft) {
        this.draft = this.appliedZip || "";
      }
    },
    onBlur() {
      if (Date.now() < this.blurSuppressUntil) {
        return;
      }
      window.setTimeout(() => {
        if (this.resolving) {
          return;
        }
        this.editing = false;
        this.draft = this.appliedZip || "";
        this.clearAutoCommitTimer();
      }, 120);
    },
    onSummaryClick() {
      this.editing = true;
      this.draft = this.appliedZip || "";
      this.$nextTick(() => this.focus());
    },
    onKeydown(event) {
      if (event.key === "Enter") {
        event.preventDefault();
        void this.tryCommit();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        this.editing = false;
        this.draft = this.appliedZip || "";
        this.error = null;
        this.clearAutoCommitTimer();
        event.target.blur();
      }
    },
    async onClear() {
      this.blurSuppressUntil = Date.now() + 250;
      this.clearAutoCommitTimer();
      this.draft = "";
      this.editing = true;
      this.error = null;
      this.$emit("drafted");
      this.$emit("cleared");
      await this.$nextTick();
      this.focus();
    },
    async onUseCurrentLocation() {
      this.blurSuppressUntil = Date.now() + 250;
      this.clearAutoCommitTimer();
      this.error = null;
      this.editing = false;
      this.$emit("drafted");
      if (this.useCurrentLocationHandler) {
        await this.useCurrentLocationHandler();
      }
    },
    async tryCommit() {
      const zip = (this.draft || "").trim();
      if (!zip) {
        this.error = "Enter a 5-digit ZIP code.";
        return false;
      }
      if (!/^\d{5}$/.test(zip)) {
        this.error = "ZIP code must be 5 digits.";
        return false;
      }
      if (zip === this.appliedZip) {
        this.editing = false;
        this.error = null;
        return true;
      }

      this.resolving = true;
      this.error = null;
      try {
        await this.commitHandler(zip);
        this.editing = false;
        this.draft = zip;
        return true;
      } catch (error) {
        this.error =
          (error && error.message) ||
          "Could not set location. Please try again.";
        return false;
      } finally {
        this.resolving = false;
      }
    },
  },
};
</script>

<style scoped>
.location-field {
  width: 100%;
  min-width: 0;
}

.location-field-label {
  display: block;
  margin: 0 0 6px;
  font-family: Roboto, sans-serif;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: rgba(0, 0, 0, 0.62);
}

.location-field-control {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  padding: 0 10px 0 12px;
  border: 1px solid rgba(0, 0, 0, 0.14);
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

.location-field--toolbar .location-field-control {
  min-height: 44px;
  padding: 0 8px 0 10px;
}

.location-field--drawer .location-field-control {
  margin-bottom: 12px;
}

.location-field-icon {
  flex: 0 0 auto;
  font-size: 18px;
  color: #b74d15;
}

.location-field-input-wrap {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
}

.location-field-input {
  width: 100%;
  border: none;
  outline: none;
  background: transparent;
  font-family: Roboto, sans-serif;
  font-size: 16px;
  line-height: 1.4;
  color: #1d2e26;
  padding: 10px 0;
}

.location-field-input::placeholder {
  color: rgba(0, 0, 0, 0.42);
}

.location-field-input:focus-visible {
  outline: none;
}

.location-field-control:focus-within {
  border-color: rgba(183, 77, 21, 0.55);
  box-shadow: 0 0 0 3px rgba(183, 77, 21, 0.12);
}

.location-field-summary {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  padding: 10px 0;
  border: none;
  background: #fff;
  font-family: Roboto, sans-serif;
  font-size: 16px;
  line-height: 1.3;
  color: #1d2e26;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: text;
}

.location-field-locate,
.location-field-clear {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: rgba(0, 0, 0, 0.55);
  cursor: pointer;
}

.location-field-locate:disabled {
  cursor: default;
  opacity: 0.5;
}

.location-field-locate:not(:disabled):hover,
.location-field-clear:hover {
  background: rgba(0, 0, 0, 0.06);
  color: rgba(0, 0, 0, 0.78);
}

.location-field-locate:focus-visible,
.location-field-clear:focus-visible {
  outline: 2px solid rgba(183, 77, 21, 0.45);
  outline-offset: 2px;
}

.location-field-locate .material-icons,
.location-field-clear .material-icons {
  font-size: 18px;
}

.location-field-spinner {
  flex: 0 0 auto;
  width: 18px;
  height: 18px;
  border: 2px solid rgba(183, 77, 21, 0.2);
  border-top-color: #b74d15;
  border-radius: 50%;
  animation: location-spin 0.8s linear infinite;
}

.location-field-error {
  margin: 6px 0 0;
  font-family: Roboto, sans-serif;
  font-size: 12px;
  line-height: 1.4;
  color: #b42318;
}

.location-field--toolbar {
  min-width: 0;
}

.location-field--toolbar .location-field-summary,
.location-field--toolbar .location-field-input {
  font-size: 16px;
}

.location-field--inline {
  max-width: 280px;
}

@keyframes location-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .location-field-spinner {
    animation: none;
    border-top-color: #b74d15;
  }
}
</style>
