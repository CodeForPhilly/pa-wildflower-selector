<template>
  <div class="garden-summary" ref="summaryRef">
    <div class="summary-header">
      <h2 class="summary-title">Garden Planting Summary</h2>
      <div class="header-info">
        <span class="garden-size">Garden Size: <strong>{{ gridWidth }}ft × {{ gridHeight }}ft</strong></span>
        <span class="header-separator">•</span>
        <span class="stat-item">Total Plants: <strong>{{ summaryData?.overallStats?.totalPlants ?? 0 }}</strong></span>
        <span class="header-separator">•</span>
        <span class="stat-item">Unique Species: <strong>{{ summaryData?.overallStats?.uniqueSpecies ?? 0 }}</strong></span>
      </div>
      <div class="coordinate-note">
        <strong>Coordinates:</strong> Center point where to dig (feet from top-left corner)
      </div>
    </div>

    <div class="summary-content" v-if="summaryData?.families && summaryData.families.length > 0">
      <div 
        v-for="family in summaryData.families" 
        :key="family.family" 
        class="family-section"
      >
        <h3 class="family-heading">
          {{ family.family }} Family <span class="family-stats">({{ family.uniqueSpeciesCount }} species, {{ family.totalPlantCount }} plants)</span>
        </h3>
        <ul class="plant-list">
          <li v-for="plant in family.plants" :key="plant.plantId" class="plant-item">
            <div class="plant-info">
              <span class="plant-name"><strong>{{ plant.commonName }}</strong></span>
              <span v-if="plant.scientificName" class="scientific-name"><i>{{ plant.scientificName }}</i></span>
              <span class="plant-separator">•</span>
              <span class="plant-count">Qty: {{ plant.count }}</span>
              <span class="plant-separator">•</span>
              <span class="plant-coordinates">{{ formatCoordinates(plant.coordinates) }}</span>
            </div>
          </li>
        </ul>
      </div>
    </div>

    <div v-else class="empty-state">
      <p>No plants have been placed on the grid yet.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

interface PlantSummary {
  plantId: string;
  commonName: string;
  scientificName?: string;
  count: number;
  coordinates: string[];
}

interface FamilySummary {
  family: string;
  uniqueSpeciesCount: number;
  totalPlantCount: number;
  plants: PlantSummary[];
}

interface SummaryData {
  overallStats: {
    totalPlants: number;
    uniqueSpecies: number;
  };
  families: FamilySummary[];
}

interface Props {
  summaryData: SummaryData;
  gridWidth: number;
  gridHeight: number;
}

const props = defineProps<Props>();
const summaryRef = ref<HTMLElement | null>(null);

const formatCoordinates = (coordinates: string[]): string => {
  return coordinates.map(coord => `(${coord})`).join(', ');
};
</script>

<style scoped>
.garden-summary {
  padding: 16px;
  max-width: 900px;
  width: 100%;
  margin: 0 auto;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  overflow-x: hidden;
}

.summary-header {
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 2px solid #e0e0e0;
}

.summary-title {
  font-size: 22px;
  font-weight: 700;
  color: #1d2e26;
  margin: 0 0 8px 0;
  font-family: 'Roboto', sans-serif;
}

.header-info {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  font-size: 14px;
  color: #333;
  margin-bottom: 8px;
  font-family: 'Roboto', sans-serif;
}

.garden-size {
  font-family: 'Roboto', sans-serif;
}

.garden-size strong {
  color: #1d2e26;
  font-weight: 600;
}

.header-separator {
  color: #999;
  font-weight: 300;
}

.stat-item {
  font-family: 'Roboto', sans-serif;
}

.stat-item strong {
  color: #1d2e26;
  font-weight: 600;
}

.coordinate-note {
  background-color: #f5f5f5;
  padding: 6px 10px;
  border-radius: 4px;
  border-left: 3px solid #1d2e26;
  font-size: 12px;
  color: #555;
  line-height: 1.4;
  font-family: 'Roboto', sans-serif;
}

.coordinate-note strong {
  color: #1d2e26;
}

.summary-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.family-section {
  background-color: #fafafa;
  padding: 12px;
  border-radius: 4px;
  border: 1px solid #e0e0e0;
}

.family-heading {
  font-size: 16px;
  font-weight: 600;
  color: #1d2e26;
  margin: 0 0 8px 0;
  font-family: 'Roboto', sans-serif;
  line-height: 1.4;
}

.family-stats {
  font-size: 14px;
  font-weight: 400;
  color: #666;
}

.plant-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.plant-item {
  background-color: #fff;
  padding: 8px 10px;
  border-radius: 3px;
  border-left: 3px solid #1d2e26;
}

.plant-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 13px;
  line-height: 1.5;
  font-family: 'Roboto', sans-serif;
}

.plant-name {
  font-size: 14px;
  color: #1d2e26;
  font-weight: 600;
  font-family: 'Roboto', sans-serif;
}

.scientific-name {
  font-size: 12px;
  color: #666;
  font-style: italic;
  font-family: 'Roboto', sans-serif;
}

.plant-separator {
  color: #999;
  font-weight: 300;
}

.plant-count {
  font-weight: 500;
  color: #1d2e26;
  font-size: 13px;
}

.plant-coordinates {
  font-family: 'Roboto Mono', monospace;
  font-size: 12px;
  color: #444;
  background-color: #f9f9f9;
  padding: 3px 6px;
  border-radius: 3px;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: #666;
  font-family: 'Roboto', sans-serif;
}

@media screen and (max-width: 767px) {
  .garden-summary {
    padding: 12px;
  }

  .summary-title {
    font-size: 20px;
    margin-bottom: 6px;
  }

  .header-info {
    font-size: 12px;
    gap: 8px;
    flex-direction: column;
    align-items: flex-start;
  }

  .header-separator {
    display: none;
  }

  .coordinate-note {
    font-size: 11px;
    padding: 5px 8px;
  }

  .family-section {
    padding: 10px;
  }

  .family-heading {
    font-size: 15px;
    margin-bottom: 6px;
  }

  .family-stats {
    display: block;
    font-size: 13px;
    margin-top: 2px;
  }

  .plant-item {
    padding: 6px 8px;
  }

  .plant-info {
    font-size: 12px;
    gap: 6px;
    flex-direction: column;
    align-items: flex-start;
  }

  .plant-separator {
    display: none;
  }

  .plant-coordinates {
    font-size: 11px;
    word-break: break-all;
    width: 100%;
  }
}

/* Print styles */
@media print {
  .garden-summary {
    box-shadow: none;
    max-height: none;
    overflow: visible;
  }

  .family-section {
    page-break-inside: avoid;
  }

  .plant-item {
    page-break-inside: avoid;
  }
}
</style>

