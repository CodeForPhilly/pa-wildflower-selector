import { ref, computed, watch, onMounted } from 'vue';
import { useStore } from 'vuex';
import qs from 'qs';
import type { Plant, PlacedPlant, StoragePayload, GridCoords } from '../types/garden';
import { useLocalStorage } from './useLocalStorage';
import { useUndoRedo } from './useUndoRedo';

const STORAGE_KEY = 'gardenPlanner:v1';

export function useGardenPlanner() {
  const store = useStore();
  
  // State
  const loading = ref(false);
  const loadError = ref<Error | null>(null);
  const favoritePlants = ref<Plant[]>([]);
  const placedPlants = ref<PlacedPlant[]>([]);
  const selectedPlantId = ref<string | null>(null);
  const popoverPlantId = ref<string | null>(null);

  // LocalStorage
  const { storedValue: storageData, remove: clearStorage } = useLocalStorage<StoragePayload>(
    STORAGE_KEY,
    { placedPlants: [], selectedPlantId: null }
  );

  // Undo/Redo
  const undoRedo = useUndoRedo<PlacedPlant[]>([]);

  // Computed
  const favoriteIds = computed(() => {
    const fav = store.state?.favorites;
    if (!fav || !(fav instanceof Set)) return [];
    return [...fav] as string[];
  });

  const plantById = computed(() => {
    const map: Record<string, Plant> = {};
    for (const p of favoritePlants.value) {
      map[p._id] = p;
    }
    return map;
  });

  const overlapIds = computed(() => {
    const overlaps = new Set<string>();
    const items = placedPlants.value;
    for (let i = 0; i < items.length; i++) {
      const a = items[i];
      for (let j = i + 1; j < items.length; j++) {
        const b = items[j];
        if (rectsOverlap(a, b)) {
          overlaps.add(a.id);
          overlaps.add(b.id);
        }
      }
    }
    return overlaps;
  });

  const popoverPlaced = computed(() => {
    if (!popoverPlantId.value) return null;
    return placedPlants.value.find((p) => p.id === popoverPlantId.value) || null;
  });

  // Methods
  const rectsOverlap = (a: PlacedPlant, b: PlacedPlant): boolean => {
    const ax2 = a.x + a.width;
    const ay2 = a.y + a.height;
    const bx2 = b.x + b.width;
    const by2 = b.y + b.height;
    return a.x < bx2 && ax2 > b.x && a.y < by2 && ay2 > b.y;
  };

  const imageUrl = (plant: Plant | undefined, preview: boolean): string => {
    if (!plant) return '/assets/images/missing-image.png';
    if (plant.hasImage) {
      if (preview) {
        return `/images/${plant._id}.preview.jpg`;
      }
      return `/images/${plant._id}.jpg`;
    }
    return '/assets/images/missing-image.png';
  };

  const spreadFeetLabel = (plant: Plant | undefined): string => {
    if (!plant) return '1';
    const raw = plant['Spread (feet)'];
    const num = parseFloat(String(raw));
    if (!Number.isFinite(num) || num <= 0) return '1';
    const text = raw && typeof raw === 'string' ? raw : `${num}`;
    return text;
  };

  const spreadCells = (plant: Plant | undefined): number => {
    if (!plant) return 1;
    const raw = plant['Spread (feet)'];
    const num = parseFloat(String(raw));
    if (!Number.isFinite(num) || num <= 0) return 1;
    return Math.max(1, Math.round(num));
  };

  const loadFromStorage = (): void => {
    const data = storageData.value;
    if (data && Array.isArray(data.placedPlants)) {
      placedPlants.value = data.placedPlants;
      undoRedo.reset([...data.placedPlants]);
    }
    if (data && (typeof data.selectedPlantId === 'string' || data.selectedPlantId === null)) {
      selectedPlantId.value = data.selectedPlantId;
    }
  };

  const placePlant = (plantId: string, x: number, y: number): void => {
    const plant = plantById.value[plantId];
    if (!plant) return;

    const size = spreadCells(plant);
    const id = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

    // Ensure plant fits within 10x10 grid bounds
    const adjustedX = Math.max(0, Math.min(x, 10 - size));
    const adjustedY = Math.max(0, Math.min(y, 10 - size));

    const placed: PlacedPlant = {
      id,
      plantId,
      x: adjustedX,
      y: adjustedY,
      width: size,
      height: size,
    };

    const newPlacedPlants = [...placedPlants.value, placed];
    placedPlants.value = newPlacedPlants;
    undoRedo.addState([...newPlacedPlants]);
    
    // Clear mobile selection after placement
    selectedPlantId.value = null;
  };

  const movePlant = (placedId: string, x: number, y: number): void => {
    const plant = placedPlants.value.find((p) => p.id === placedId);
    if (!plant) return;

    // Ensure plant fits within 10x10 grid bounds
    const adjustedX = Math.max(0, Math.min(x, 10 - plant.width));
    const adjustedY = Math.max(0, Math.min(y, 10 - plant.height));

    // Update position
    plant.x = adjustedX;
    plant.y = adjustedY;

    // Trigger reactivity
    const newPlacedPlants = [...placedPlants.value];
    placedPlants.value = newPlacedPlants;
    undoRedo.addState([...newPlacedPlants]);
  };

  const removePlaced = (id: string): void => {
    const newPlacedPlants = placedPlants.value.filter((p) => p.id !== id);
    placedPlants.value = newPlacedPlants;
    undoRedo.addState([...newPlacedPlants]);
    
    if (popoverPlantId.value === id) {
      popoverPlantId.value = null;
    }
  };

  const clearLayout = (): void => {
    placedPlants.value = [];
    undoRedo.reset([]);
    popoverPlantId.value = null;
  };

  const resetPlanner = (): void => {
    clearStorage();
    selectedPlantId.value = null;
    clearLayout();
  };

  const openPopover = (id: string): void => {
    popoverPlantId.value = id;
  };

  const closePopover = (): void => {
    popoverPlantId.value = null;
  };

  const selectPlant = (plantId: string | null): void => {
    selectedPlantId.value = selectedPlantId.value === plantId ? null : plantId;
  };

  const undo = (): void => {
    const state = undoRedo.undo();
    if (state) {
      placedPlants.value = [...state];
    }
  };

  const redo = (): void => {
    const state = undoRedo.redo();
    if (state) {
      placedPlants.value = [...state];
    }
  };

  const fetchFavorites = async (): Promise<void> => {
    loading.value = true;
    loadError.value = null;
    try {
      if (!favoriteIds.value.length) {
        favoritePlants.value = [];
        return;
      }
      const params = {
        favorites: favoriteIds.value,
        sort: 'Sort by Common Name (A-Z)',
      };
      const response = await fetch('/api/v1/plants?' + qs.stringify(params));
      const data = await response.json();
      favoritePlants.value = (data && data.results) || [];
    } catch (e) {
      loadError.value = e instanceof Error ? e : new Error('Failed to fetch favorites');
      favoritePlants.value = [];
    } finally {
      loading.value = false;
    }
  };

  // Watch for changes and sync to storage
  watch(
    [placedPlants, selectedPlantId],
    () => {
      storageData.value = {
        placedPlants: placedPlants.value,
        selectedPlantId: selectedPlantId.value,
      };
    },
    { deep: true }
  );

  // Watch favoriteIds and fetch when changed
  watch(favoriteIds, () => {
    fetchFavorites();
  });

  // Initialize
  onMounted(() => {
    loadFromStorage();
    fetchFavorites();
  });

  return {
    // State
    loading,
    loadError,
    favoritePlants,
    placedPlants,
    selectedPlantId,
    popoverPlantId,
    
    // Computed
    favoriteIds,
    plantById,
    overlapIds,
    popoverPlaced,
    
    // Methods
    imageUrl,
    spreadFeetLabel,
    spreadCells,
    placePlant,
    movePlant,
    removePlaced,
    clearLayout,
    resetPlanner,
    openPopover,
    closePopover,
    selectPlant,
    undo,
    redo,
    canUndo: undoRedo.canUndo,
    canRedo: undoRedo.canRedo,
    fetchFavorites,
  };
}

