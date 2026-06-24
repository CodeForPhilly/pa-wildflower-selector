<template>
  <div
    v-if="open"
    class="plant-detail-overlay"
    role="presentation"
    @mousedown.self="emitClose"
  >
    <button
      v-if="hasPrevious"
      type="button"
      class="plant-detail-nav plant-detail-nav--prev"
      aria-label="Previous plant"
      data-plant-detail-nav
      @click="$emit('previous')"
    >
      <span class="material-icons" aria-hidden="true">chevron_left</span>
    </button>

    <div
      ref="dialogEl"
      class="plant-detail-dialog selected"
      role="dialog"
      aria-modal="true"
      aria-labelledby="plant-detail-title"
      :aria-busy="loading ? 'true' : 'false'"
      @keydown="onKeydown"
      @keydown.tab="handleTab"
    >
      <span
        class="plant-detail-focus-sentinel"
        tabindex="0"
        aria-hidden="true"
        @focus="focusLast"
      ></span>

      <h2 id="plant-detail-title" class="plant-detail-sr-title">{{ title }}</h2>

      <p
        v-if="positionLabel"
        class="plant-detail-position"
        aria-live="polite"
      >
        {{ positionLabel }}
      </p>

      <div class="plant-detail-toolbar" role="presentation">
        <button
          type="button"
          class="plant-detail-close"
          aria-label="Close plant details"
          @click="emitClose"
        >
          <span class="material-icons" aria-hidden="true">close</span>
        </button>
      </div>

      <div
        ref="scrollEl"
        class="plant-detail-scroll"
        @touchstart.passive="onTouchStart"
        @touchend.passive="onTouchEnd"
      >
        <div v-if="loading" class="plant-detail-loading" role="status" aria-live="polite">
          <span class="plant-detail-loading-spinner" aria-hidden="true"></span>
          Loading plant details…
        </div>
        <slot v-else />
      </div>

      <footer v-if="$slots.footer" class="plant-detail-footer">
        <slot name="footer" />
      </footer>

      <span
        class="plant-detail-focus-sentinel"
        tabindex="0"
        aria-hidden="true"
        @focus="focusFirst"
      ></span>
    </div>

    <button
      v-if="hasNext"
      type="button"
      class="plant-detail-nav plant-detail-nav--next"
      aria-label="Next plant"
      data-plant-detail-nav
      @click="$emit('next')"
    >
      <span class="material-icons" aria-hidden="true">chevron_right</span>
    </button>
  </div>
</template>

<script>
export default {
  name: "PlantDetailDialog",
  props: {
    open: {
      type: Boolean,
      default: false,
    },
    title: {
      type: String,
      default: "More Info",
    },
    positionLabel: {
      type: String,
      default: "",
    },
    hasPrevious: {
      type: Boolean,
      default: false,
    },
    hasNext: {
      type: Boolean,
      default: false,
    },
    loading: {
      type: Boolean,
      default: false,
    },
  },
  emits: ["close", "previous", "next"],
  data() {
    return {
      touchStartX: 0,
      touchStartY: 0,
      touchStartScroll: 0,
      previousFocus: null,
      bodyOverflow: "",
    };
  },
  watch: {
    open(isOpen) {
      if (typeof document === "undefined") return;
      if (isOpen) {
        this.previousFocus = document.activeElement;
        this.bodyOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        this.$nextTick(() => this.focusFirst());
      } else {
        document.body.style.overflow = this.bodyOverflow || "";
        this.restoreFocus();
      }
    },
  },
  beforeUnmount() {
    if (typeof document === "undefined") return;
    document.body.style.overflow = this.bodyOverflow || "";
  },
  methods: {
    emitClose() {
      this.$emit("close");
    },
    restoreFocus() {
      const el = this.previousFocus;
      this.previousFocus = null;
      if (el && typeof el.focus === "function") {
        el.focus();
      }
    },
    focusableElements() {
      const root = this.$refs.dialogEl;
      if (!root) return [];
      return Array.from(
        root.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !el.disabled && el.offsetParent !== null);
    },
    async focusFirst() {
      await this.$nextTick();
      const focusables = this.focusableElements();
      const closeButton = this.$refs.dialogEl?.querySelector(".plant-detail-close");
      (closeButton || focusables[0])?.focus?.();
    },
    async focusLast() {
      await this.$nextTick();
      const focusables = this.focusableElements();
      const last = focusables[focusables.length - 1];
      last?.focus?.();
    },
    handleTab(event) {
      const focusables = this.focusableElements();
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
    onKeydown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        this.emitClose();
        return;
      }
      if (event.key === "ArrowLeft" && this.hasPrevious) {
        event.preventDefault();
        this.$emit("previous");
        return;
      }
      if (event.key === "ArrowRight" && this.hasNext) {
        event.preventDefault();
        this.$emit("next");
      }
    },
    onTouchStart(event) {
      const touch = event.changedTouches?.[0];
      if (!touch) return;
      this.touchStartX = touch.clientX;
      this.touchStartY = touch.clientY;
      this.touchStartScroll = this.$refs.scrollEl?.scrollTop ?? 0;
    },
    onTouchEnd(event) {
      const touch = event.changedTouches?.[0];
      if (!touch) return;
      const dx = touch.clientX - this.touchStartX;
      const dy = touch.clientY - this.touchStartY;
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 60) {
        if (dx < 0 && this.hasNext) {
          this.$emit("next");
        } else if (dx > 0 && this.hasPrevious) {
          this.$emit("previous");
        }
        return;
      }
      if (
        dy > 80 &&
        Math.abs(dx) < 40 &&
        (this.$refs.scrollEl?.scrollTop ?? 0) <= 0 &&
        this.touchStartScroll <= 0
      ) {
        this.emitClose();
      }
    },
  },
};
</script>

<style scoped>
.plant-detail-overlay {
  position: fixed;
  inset: 0;
  z-index: 1100;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: max(16px, env(safe-area-inset-top, 0px)) 16px
    max(16px, env(safe-area-inset-bottom, 0px));
  background: rgba(0, 0, 0, 0.45);
}

.plant-detail-dialog {
  position: relative;
  flex: 1 1 auto;
  width: min(64rem, 100%);
  max-width: min(64rem, calc(100vw - 7rem));
  height: min(90vh, calc(100dvh - 2rem));
  max-height: 90vh;
  background-color: #fcf9f4;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.28);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.plant-detail-sr-title {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.plant-detail-toolbar {
  position: absolute;
  inset: 0 0 auto 0;
  z-index: 20;
  display: flex;
  justify-content: flex-end;
  align-items: flex-start;
  padding: max(12px, env(safe-area-inset-top, 0px)) 12px 0;
  pointer-events: none;
}

.plant-detail-close {
  pointer-events: auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: 1px solid rgba(0, 0, 0, 0.18);
  border-radius: 999px;
  background: #fff;
  color: #1d2e26;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.18);
  cursor: pointer;
  padding: 0;
  line-height: 1;
  transition: background-color 0.15s ease, box-shadow 0.15s ease;
}

.plant-detail-close .material-icons {
  font-size: 22px;
}

.plant-detail-close:hover {
  background: #fff;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.22);
}

.plant-detail-close:focus-visible {
  outline: 3px solid rgba(183, 77, 21, 0.45);
  outline-offset: 2px;
}

.plant-detail-position {
  position: absolute;
  top: max(16px, env(safe-area-inset-top, 0px));
  left: 16px;
  z-index: 19;
  margin: 0;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.92);
  font-family: Roboto, sans-serif;
  font-size: 12px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: rgba(0, 0, 0, 0.55);
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.1);
}

.plant-detail-scroll {
  flex: 1 1 auto;
  overflow: auto;
  min-height: 0;
  -webkit-overflow-scrolling: touch;
}

.plant-detail-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  min-height: 40vh;
  padding: 32px 16px;
  font-family: Roboto, sans-serif;
  font-size: 15px;
  color: rgba(0, 0, 0, 0.68);
}

.plant-detail-loading-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(183, 77, 21, 0.2);
  border-top-color: #b74d15;
  border-radius: 50%;
  animation: plant-detail-spin 0.8s linear infinite;
}

.plant-detail-footer {
  flex: 0 0 auto;
  display: none;
  padding: 12px 16px calc(12px + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid rgba(0, 0, 0, 0.12);
  background: #fcf9f4;
  box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.08);
}

.plant-detail-focus-sentinel {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.plant-detail-nav {
  display: none;
  flex: 0 0 auto;
  width: 48px;
  height: 48px;
  border: none;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.96);
  color: #1d2e26;
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.2);
  cursor: pointer;
  align-items: center;
  justify-content: center;
}

.plant-detail-nav:focus-visible {
  outline: 3px solid rgba(183, 77, 21, 0.4);
  outline-offset: 2px;
}

.plant-detail-nav .material-icons {
  font-size: 28px;
}

@media (min-width: 640px) {
  .plant-detail-nav {
    display: inline-flex;
  }
}

@media (min-width: 1800px) {
  .plant-detail-dialog {
    max-width: min(96rem, calc(90vh * 4 / 3));
    width: min(96rem, calc(100vw - 4rem));
  }
}

@media (max-width: 639px) {
  .plant-detail-overlay {
    padding: 0;
    gap: 0;
    align-items: stretch;
  }

  .plant-detail-dialog {
    width: 100%;
    max-width: none;
    height: 100%;
    max-height: none;
    border-radius: 0;
    box-shadow: none;
  }

  .plant-detail-footer {
    display: block;
  }

  .plant-detail-scroll {
    padding-bottom: 8px;
  }
}

@keyframes plant-detail-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .plant-detail-loading-spinner {
    animation: none;
    border-top-color: #b74d15;
  }
}
</style>
