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
import type { Plant } from '../types/garden';

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
  favoritePlants?: Plant[];
  favoriteIds?: string[];
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
  
  // Add favorites list for context (even if not all are placed)
  // Get all favorite plant IDs that are placed
  const placedPlantIds = new Set<string>();
  for (const family of props.summaryData.families) {
    for (const plant of family.plants) {
      placedPlantIds.add(plant.plantId);
    }
  }
  
  // Always try to include favorites - check both favoritePlants array and favoriteIds array
  const hasFavoritePlants = Array.isArray(props.favoritePlants) && props.favoritePlants.length > 0;
  const hasFavoriteIds = Array.isArray(props.favoriteIds) && props.favoriteIds.length > 0;
  
  if (hasFavoritePlants) {
    lines.push('### Additional Context: Available Favorite Plants');
    lines.push('The following plants are in my favorites list (some may not be placed in the current plan):');
    lines.push('');
    for (const plant of props.favoritePlants) {
      const common = plant['Common Name'] ? String(plant['Common Name']) : plant._id;
      const sci = plant['Scientific Name'] ? String(plant['Scientific Name']) : '';
      const spreadRaw = plant['Spread (feet)'];
      const spreadNum = parseFloat(String(spreadRaw));
      const spread = Number.isFinite(spreadNum) && spreadNum > 0 ? spreadNum : 1;
      const heightRaw = plant['Height (feet)'];
      const heightNum = parseFloat(String(heightRaw));
      const height = Number.isFinite(heightNum) && heightNum > 0 ? `${heightNum}ft` : 'unknown';
      const family = plant['Plant Family'] ? String(plant['Plant Family']) : '';
      const months = plant['Flowering Months'] ? String(plant['Flowering Months']) : '';
      const isPlaced = placedPlantIds.has(plant._id);
      
      let plantLine = `- ${common}`;
      if (sci) plantLine += ` (${sci})`;
      if (family) plantLine += ` — ${family} family`;
      plantLine += ` — Spread: ${spread}ft, Height: ${height}`;
      if (months) plantLine += `, Flowers: ${months}`;
      if (isPlaced) plantLine += ` [already placed above]`;
      lines.push(plantLine);
    }
    lines.push('');
  } else if (hasFavoriteIds) {
    // Fallback if favorite metadata hasn't loaded
    lines.push('### Additional Context: Available Favorite Plants');
    lines.push('The following plant IDs are in my favorites list (some may not be placed in the current plan):');
    lines.push('');
    for (const id of props.favoriteIds) {
      const isPlaced = placedPlantIds.has(id);
      lines.push(`- ${id}${isPlaced ? ' [already placed above]' : ''}`);
    }
    lines.push('');
  }
  
  lines.push('Please provide planting advice (plain text is fine; no JSON needed) on:');
  lines.push('1. Whether this is a good plant selection and arrangement');
  lines.push('2. Any concerns about plant spacing, compatibility, or growth requirements');
  lines.push('3. Suggestions for improvement or additional considerations');
  lines.push('4. Any specific care instructions or tips for these native plants');
  lines.push('5. Whether I should consider adding any of my other favorite plants that are not currently placed');

  return lines.join('\n');
};

const copyTextToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};

const openChatGPT = async () => {
  const prompt = generateChatGPTPrompt();
  if (!prompt) return;

  // Prefer opening ChatGPT with a pre-filled prompt, but fall back to clipboard for long prompts.
  // (ChatGPT URLs can fail silently if too long.)
  const encoded = encodeURIComponent(prompt);
  const urlWithQuery = `https://chatgpt.com/?q=${encoded}`;

  // Conservative length limit to avoid browser/proxy URL limits.
  const canUseQuery = urlWithQuery.length <= 7000;
  const copied = await copyTextToClipboard(prompt);

  if (canUseQuery) {
    window.open(urlWithQuery, '_blank', 'noopener,noreferrer');
    // No alert needed; prompt should be visible in ChatGPT.
    return;
  }

  window.open('https://chatgpt.com/', '_blank', 'noopener,noreferrer');
  if (copied) {
    window.alert(
      'ChatGPT prompt copied to clipboard (it was too long to pre-fill automatically). Paste it into ChatGPT to get planting advice.'
    );
  } else {
    window.alert(
      'The ChatGPT prompt was too long to pre-fill automatically, and clipboard copy failed. Please allow clipboard access and try again.'
    );
  }
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

