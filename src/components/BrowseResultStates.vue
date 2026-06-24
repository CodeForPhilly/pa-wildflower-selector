<template>
  <div class="browse-result-states">
    <!-- Initial / full refresh loading -->
    <div
      v-if="state === 'loading'"
      class="browse-state browse-state--loading"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <p class="browse-state-message">{{ message }}</p>
      <div class="browse-skeleton-grid" aria-hidden="true">
        <article
          v-for="index in skeletonCount"
          :key="index"
          class="browse-skeleton-card"
        >
          <div
            class="browse-skeleton-photo"
            :class="{
              'browse-skeleton-photo--studio': photoMode === 'studio',
            }"
          ></div>
          <div
            v-if="photoMode === 'studio'"
            class="browse-skeleton-caption"
          >
            <div class="browse-skeleton-line browse-skeleton-line--title"></div>
            <div class="browse-skeleton-line browse-skeleton-line--subtitle"></div>
          </div>
        </article>
      </div>
    </div>

    <!-- Zero matches -->
    <div
      v-else-if="state === 'no-results'"
      class="browse-state browse-state--no-results"
      role="status"
      aria-live="polite"
    >
      <div class="browse-state-icon" aria-hidden="true">
        <span class="material-icons">search_off</span>
      </div>
      <h2 class="browse-state-heading">{{ noResultsHeading }}</h2>
      <p class="browse-state-body">{{ noResultsBody }}</p>
      <div v-if="hasActions" class="browse-state-actions">
        <button
          v-if="activeFilterCount > 0"
          type="button"
          class="primary"
          @click="$emit('clear-filters')"
        >
          Remove filters
        </button>
        <button
          v-else-if="hasPlantSearch"
          type="button"
          class="primary"
          @click="$emit('clear-search')"
        >
          Clear search
        </button>
        <button
          v-if="!nearDisplayLabel"
          type="button"
          class="secondary"
          @click="$emit('set-location')"
        >
          Set location
        </button>
      </div>
    </div>

    <!-- Fetch error -->
    <div
      v-else-if="state === 'error'"
      class="browse-state browse-state--error"
      role="alert"
    >
      <div class="browse-state-icon browse-state-icon--error" aria-hidden="true">
        <span class="material-icons">error_outline</span>
      </div>
      <h2 class="browse-state-heading">Could not load plants</h2>
      <p class="browse-state-body">{{ message }}</p>
      <div class="browse-state-actions">
        <button type="button" class="primary" @click="$emit('retry')">
          Try again
        </button>
      </div>
    </div>

    <!-- Pagination / filter refresh while results remain visible -->
    <div
      v-else-if="state === 'updating'"
      class="browse-updating"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span class="browse-updating-spinner" aria-hidden="true"></span>
      <span>Updating results…</span>
    </div>
  </div>
</template>

<script>
export default {
  name: "BrowseResultStates",
  props: {
    state: {
      type: String,
      required: true,
      validator: (value) =>
        ["loading", "no-results", "error", "updating"].includes(value),
    },
    message: {
      type: String,
      default: "Loading native plants…",
    },
    nearDisplayLabel: {
      type: String,
      default: "",
    },
    activeFilterCount: {
      type: Number,
      default: 0,
    },
    hasPlantSearch: {
      type: Boolean,
      default: false,
    },
    photoMode: {
      type: String,
      default: "habitat",
    },
    skeletonCount: {
      type: Number,
      default: 6,
    },
  },
  emits: ["clear-filters", "clear-search", "set-location", "retry"],
  computed: {
    noResultsHeading() {
      const near = (this.nearDisplayLabel || "").trim();
      if (near) {
        return `No plants match near ${near}`;
      }
      return "No plants match this search";
    },
    noResultsBody() {
      if (this.activeFilterCount > 0) {
        return "Try removing filters to see more native plants.";
      }
      if (this.hasPlantSearch) {
        return "Try broadening your search or checking the spelling.";
      }
      return "Try removing filters or broadening your search.";
    },
    hasActions() {
      return (
        this.activeFilterCount > 0 ||
        this.hasPlantSearch ||
        !this.nearDisplayLabel
      );
    },
  },
};
</script>

<style scoped>
.browse-result-states {
  width: 100%;
}

.browse-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 32px 16px 40px;
}

.browse-state--loading {
  align-items: stretch;
  padding-top: 12px;
}

.browse-state-message {
  margin: 0 0 16px;
  font-family: Roboto, sans-serif;
  font-size: 14px;
  color: rgba(0, 0, 0, 0.62);
  text-align: center;
}

.browse-state-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 16px;
  background: rgba(183, 77, 21, 0.1);
  color: #b74d15;
  margin-bottom: 16px;
}

.browse-state-icon--error {
  background: rgba(180, 35, 24, 0.1);
  color: #b42318;
}

.browse-state-icon .material-icons {
  font-size: 28px;
}

.browse-state-heading {
  margin: 0 0 8px;
  font-family: Arvo, serif;
  font-size: 20px;
  font-weight: 400;
  color: #1d2e26;
  max-width: 28rem;
}

.browse-state-body {
  margin: 0;
  font-family: Roboto, sans-serif;
  font-size: 14px;
  line-height: 1.5;
  color: rgba(0, 0, 0, 0.68);
  max-width: 24rem;
}

.browse-state-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: center;
  margin-top: 20px;
}

.browse-skeleton-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(248px, 1fr));
  gap: 8px;
  width: 100%;
}

.browse-skeleton-card {
  border-radius: 12px;
  overflow: hidden;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.08);
}

.browse-skeleton-photo {
  width: 100%;
  aspect-ratio: 1 / 1;
  background: linear-gradient(
    90deg,
    rgba(0, 0, 0, 0.06) 0%,
    rgba(0, 0, 0, 0.1) 50%,
    rgba(0, 0, 0, 0.06) 100%
  );
  background-size: 200% 100%;
  animation: browse-skeleton-shimmer 1.4s ease-in-out infinite;
}

.browse-skeleton-caption {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.browse-skeleton-line {
  height: 12px;
  border-radius: 6px;
  background: linear-gradient(
    90deg,
    rgba(0, 0, 0, 0.06) 0%,
    rgba(0, 0, 0, 0.1) 50%,
    rgba(0, 0, 0, 0.06) 100%
  );
  background-size: 200% 100%;
  animation: browse-skeleton-shimmer 1.4s ease-in-out infinite;
}

.browse-skeleton-line--title {
  width: 72%;
}

.browse-skeleton-line--subtitle {
  width: 52%;
}

.browse-updating {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 16px 0 8px;
  font-family: Roboto, sans-serif;
  font-size: 14px;
  color: rgba(0, 0, 0, 0.62);
}

.browse-updating-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(183, 77, 21, 0.2);
  border-top-color: #b74d15;
  border-radius: 50%;
  animation: browse-spin 0.8s linear infinite;
}

@keyframes browse-skeleton-shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

@keyframes browse-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .browse-skeleton-photo,
  .browse-skeleton-line,
  .browse-updating-spinner {
    animation: none;
  }
}

@media all and (max-width: 480px) {
  .browse-skeleton-grid {
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  }
}
</style>
