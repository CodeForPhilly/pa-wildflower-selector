<template>
  <div class="garden-summary" ref="summaryRef">
    <div class="summary-header">
      <div class="header-top">
        <h2 class="summary-title">Garden Planting Summary</h2>
        <button 
          v-if="summaryData?.families && summaryData.families.length > 0"
          class="chatgpt-button"
          @click="openChatGPT"
          title="Get advice from ChatGPT about this garden plan"
        >
          Ask ChatGPT
        </button>
      </div>
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

const generateChatGPTPrompt = (): string => {
  if (!props.summaryData || !props.summaryData.families || props.summaryData.families.length === 0) {
    return '';
  }

  const lines: string[] = [];
  lines.push('I have created a native plant garden plan using the choosenativeplants garden planner. I would like your advice on this planting plan.');
  lines.push('');
  lines.push(`Garden Size: ${props.gridWidth} feet wide × ${props.gridHeight} feet tall`);
  lines.push(`Total Plants: ${props.summaryData.overallStats.totalPlants}`);
  lines.push(`Unique Species: ${props.summaryData.overallStats.uniqueSpecies}`);
  lines.push('');
  lines.push('Planting Plan (organized by plant family):');
  lines.push('');

  for (const family of props.summaryData.families) {
    lines.push(`${family.family} Family (${family.uniqueSpeciesCount} species, ${family.totalPlantCount} total plants):`);
    for (const plant of family.plants) {
      const scientificName = plant.scientificName ? ` (${plant.scientificName})` : '';
      const coords = formatCoordinates(plant.coordinates);
      lines.push(`  - ${plant.commonName}${scientificName}: Quantity ${plant.count}, Plant at coordinates: ${coords}`);
    }
    lines.push('');
  }

  lines.push('Coordinates indicate the center point where each plant should be planted (where to dig the hole), measured in feet from the top-left corner of the garden.');
  lines.push('');
  lines.push('Please provide advice on:');
  lines.push('1. Whether this is a good plant selection and arrangement');
  lines.push('2. Any concerns about plant spacing, compatibility, or growth requirements');
  lines.push('3. Suggestions for improvement or additional considerations');
  lines.push('4. Any specific care instructions or tips for these native plants');

  return lines.join('\n');
};

const openChatGPT = () => {
  const prompt = generateChatGPTPrompt();
  if (!prompt) return;
  
  const encodedPrompt = encodeURIComponent(prompt);
  const url = `https://chatgpt.com/?q=${encodedPrompt}`;
  window.open(url, '_blank', 'noopener,noreferrer');
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

.header-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  gap: 16px;
}

.summary-title {
  font-size: 22px;
  font-weight: 700;
  color: #1d2e26;
  margin: 0;
  font-family: 'Roboto', sans-serif;
  flex: 1;
}

.chatgpt-button {
  background-color: #10a37f;
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 8px 16px;
  font-size: 14px;
  font-weight: 500;
  font-family: 'Roboto', sans-serif;
  cursor: pointer;
  transition: background-color 0.2s;
  white-space: nowrap;
  flex-shrink: 0;
}

.chatgpt-button:hover {
  background-color: #0d8c6e;
}

.chatgpt-button:active {
  background-color: #0b7a5f;
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

  .header-top {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .summary-title {
    font-size: 20px;
    margin-bottom: 0;
  }

  .chatgpt-button {
    width: 100%;
    padding: 10px 16px;
    font-size: 13px;
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

