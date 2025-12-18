import { ref, computed, watch, onMounted } from 'vue';
import { useStore } from 'vuex';
import qs from 'qs';
import type { Plant, PlacedPlant, StoragePayload, GridCoords } from '../types/garden';
import { useLocalStorage } from './useLocalStorage';
import { useUndoRedo } from './useUndoRedo';

const STORAGE_KEY = 'gardenPlanner:v1';
const SNAP_INCREMENT_KEY = 'gardenPlanner:snapIncrement';

export function useGardenPlanner() {
  const store = useStore();

  // State
  const loading = ref(false);
  const loadError = ref<Error | null>(null);
  const favoritePlants = ref<Plant[]>([]);
  const placedPlants = ref<PlacedPlant[]>([]);
  const selectedPlantId = ref<string | null>(null);
  const selectedPlacedPlantId = ref<string | null>(null);
  const gridWidth = ref(10);
  const gridHeight = ref(10);

  // Snap increment (0.5 or 1.0 ft) - default to 1.0
  const { storedValue: snapIncrementStorage } = useLocalStorage<number>(
    SNAP_INCREMENT_KEY,
    1.0
  );
  const snapIncrement = computed({
    get: () => snapIncrementStorage.value || 1.0,
    set: (value: number) => {
      snapIncrementStorage.value = value;
    }
  });

  // LocalStorage
  const { storedValue: storageData, remove: clearStorage } = useLocalStorage<StoragePayload>(
    STORAGE_KEY,
    {
      placedPlants: [],
      selectedPlantId: null,
      gridWidth: 10,
      gridHeight: 10,
    }
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

  const plantCounts = computed(() => {
    const counts: Record<string, number> = {};
    for (const p of placedPlants.value) {
      counts[p.plantId] = (counts[p.plantId] || 0) + 1;
    }
    return counts;
  });

  // Methods
  const rectsOverlap = (a: PlacedPlant, b: PlacedPlant): boolean => {
    const ax2 = a.x + a.width;
    const ay2 = a.y + a.height;
    const bx2 = b.x + b.width;
    const by2 = b.y + b.height;
    return a.x < bx2 && ax2 > b.x && a.y < by2 && ay2 > b.y;
  };

  // Find the closest left/top most empty space for a plant of given size
  const findEmptySpace = (size: number): { x: number; y: number } | null => {
    const increment = snapIncrement.value;
    const maxX = gridWidth.value - size;
    const maxY = gridHeight.value - size;

    // Scan from top-left to bottom-right, respecting snap increment
    for (let y = 0; y <= maxY; y += increment) {
      for (let x = 0; x <= maxX; x += increment) {
        // Create a temporary plant at this position to check for overlap
        const testPlant: PlacedPlant = {
          id: 'test',
          plantId: 'test',
          x,
          y,
          width: size,
          height: size,
        };

        // Check if this position would overlap with any existing plant
        const wouldOverlap = placedPlants.value.some(existing => 
          rectsOverlap(testPlant, existing)
        );

        // If no overlap and fits within bounds, this is a valid position
        if (!wouldOverlap && x + size <= gridWidth.value && y + size <= gridHeight.value) {
          return { x, y };
        }
      }
    }

    // No empty space found
    return null;
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
    // Load grid size from storage
    if (data && typeof data.gridWidth === 'number' && data.gridWidth > 0) {
      gridWidth.value = data.gridWidth;
    }
    if (data && typeof data.gridHeight === 'number' && data.gridHeight > 0) {
      gridHeight.value = data.gridHeight;
    }
  };

  // Helper to check if plants would be clipped by new grid size
  const wouldClipPlants = (newWidth: number, newHeight: number): boolean => {
    return placedPlants.value.some(plant => {
      return plant.x + plant.width > newWidth || plant.y + plant.height > newHeight;
    });
  };

  // Get minimum grid size based on placed plants
  const getMinGridSize = (): { width: number; height: number } => {
    if (placedPlants.value.length === 0) return { width: 1, height: 1 };
    const minX = Math.min(...placedPlants.value.map(p => p.x));
    const maxX = Math.max(...placedPlants.value.map(p => p.x + p.width));
    const minY = Math.min(...placedPlants.value.map(p => p.y));
    const maxY = Math.max(...placedPlants.value.map(p => p.y + p.height));
    return { width: maxX - minX, height: maxY - minY };
  };

  // Set grid size with validation
  const setGridSize = (width: number, height: number): { success: boolean; error?: string } => {
    const minSize = getMinGridSize();
    
    // Validate maximum size
    if (width > 100 || height > 100) {
      return {
        success: false,
        error: 'Grid dimensions must be at most 100 feet',
      };
    }
    
    // Validate minimum size
    if (placedPlants.value.length > 0) {
      // With plants: must be at least the plant bounding box
      if (width < minSize.width || height < minSize.height) {
        return {
          success: false,
          error: `Grid must be at least ${minSize.width}ft × ${minSize.height}ft to fit all plants`,
        };
      }
    } else {
      // No plants: enforce 1ft minimum
      if (width < 1 || height < 1) {
        return {
          success: false,
          error: 'Grid dimensions must be at least 1 foot',
        };
      }
    }
    
    gridWidth.value = width;
    gridHeight.value = height;
    
    return { success: true };
  };

  // Fit grid to plants by removing empty padding
  const fitGridToPlants = (): void => {
    if (placedPlants.value.length === 0) {
      // No plants, set to minimum
      gridWidth.value = 1;
      gridHeight.value = 1;
      return;
    }
    
    // Find bounding box
    const minX = Math.min(...placedPlants.value.map(p => p.x));
    const maxX = Math.max(...placedPlants.value.map(p => p.x + p.width));
    const minY = Math.min(...placedPlants.value.map(p => p.y));
    const maxY = Math.max(...placedPlants.value.map(p => p.y + p.height));
    
    // Calculate new dimensions
    const newWidth = maxX - minX;
    const newHeight = maxY - minY;
    
    // Shift all plants to start at (0, 0)
    placedPlants.value.forEach(p => {
      p.x -= minX;
      p.y -= minY;
    });
    
    // Update grid dimensions
    gridWidth.value = Math.max(1, newWidth);
    gridHeight.value = Math.max(1, newHeight);
    
    // Trigger reactivity
    const newPlacedPlants = [...placedPlants.value];
    placedPlants.value = newPlacedPlants;
    // Create deep copy for history
    undoRedo.addState(newPlacedPlants.map(p => ({ ...p })));
  };

  const placePlant = (plantId: string, x: number, y: number): void => {
    const plant = plantById.value[plantId];
    if (!plant) return;

    const size = spreadCells(plant);
    const id = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

    // Use provided coordinates directly (user's intended position)
    // This allows automatic grid expansion when dragging outside current bounds
    let finalX = x;
    let finalY = y;

    // Create a temporary plant to check for overlaps at the intended position
    const tempPlant: PlacedPlant = {
      id: 'temp',
      plantId,
      x: finalX,
      y: finalY,
      width: size,
      height: size,
    };

    // Check if the intended position would overlap with any existing plants
    const wouldOverlap = placedPlants.value.some(existing => 
      rectsOverlap(tempPlant, existing)
    );

    // If there would be an overlap, first try to find empty space in the current grid
    if (wouldOverlap) {
      const emptySpace = findEmptySpace(size);
      if (emptySpace) {
        // Found empty space - use it instead of expanding
        finalX = emptySpace.x;
        finalY = emptySpace.y;
      } else {
        // No empty space found - expand grid to make room
        // Find the rightmost and bottommost positions of existing plants
        let maxRight = 0;
        let maxBottom = 0;
        
        for (const existing of placedPlants.value) {
          maxRight = Math.max(maxRight, existing.x + existing.width);
          maxBottom = Math.max(maxBottom, existing.y + existing.height);
        }
        
        // Check if we need to expand horizontally or vertically
        // Try placing to the right first (preferred)
        const rightX = maxRight;
        const rightTestPlant: PlacedPlant = {
          id: 'test-right',
          plantId,
          x: rightX,
          y: finalY,
          width: size,
          height: size,
        };
        
        const wouldOverlapRight = placedPlants.value.some(existing => 
          rectsOverlap(rightTestPlant, existing)
        );
        
        if (!wouldOverlapRight) {
          // Can place to the right - expand width and place there
          finalX = rightX;
          const neededWidth = rightX + size;
          if (neededWidth > gridWidth.value) {
            gridWidth.value = neededWidth;
          }
        } else {
          // Can't place to the right, try placing below
          const bottomY = maxBottom;
          const bottomTestPlant: PlacedPlant = {
            id: 'test-bottom',
            plantId,
            x: finalX,
            y: bottomY,
            width: size,
            height: size,
          };
          
          const wouldOverlapBottom = placedPlants.value.some(existing => 
            rectsOverlap(bottomTestPlant, existing)
          );
          
          if (!wouldOverlapBottom) {
            // Can place below - expand height and place there
            finalY = bottomY;
            const neededHeight = bottomY + size;
            if (neededHeight > gridHeight.value) {
              gridHeight.value = neededHeight;
            }
          } else {
            // Can't place to the right or below, place at bottom-right corner
            finalX = maxRight;
            finalY = maxBottom;
            const neededWidth = finalX + size;
            const neededHeight = finalY + size;
            if (neededWidth > gridWidth.value) {
              gridWidth.value = neededWidth;
            }
            if (neededHeight > gridHeight.value) {
              gridHeight.value = neededHeight;
            }
          }
        }
      }
    }

    // Calculate required grid dimensions to fit the plant at the final position
    const requiredWidth = finalX + size;
    const requiredHeight = finalY + size;

    // Expand grid if needed to accommodate the plant
    if (requiredWidth > gridWidth.value) {
      gridWidth.value = requiredWidth;
    }
    if (requiredHeight > gridHeight.value) {
      gridHeight.value = requiredHeight;
    }

    // Ensure coordinates are within bounds (should be after expansion, but safety check)
    finalX = Math.max(0, Math.min(finalX, gridWidth.value - size));
    finalY = Math.max(0, Math.min(finalY, gridHeight.value - size));

    const placed: PlacedPlant = {
      id,
      plantId,
      x: finalX,
      y: finalY,
      width: size,
      height: size,
    };

    const newPlacedPlants = [...placedPlants.value, placed];
    placedPlants.value = newPlacedPlants;
    // Create deep copy for history
    undoRedo.addState(newPlacedPlants.map(p => ({ ...p })));

    // Clear mobile selection after placement
    selectedPlantId.value = null;
  };

  const movePlant = (placedId: string, x: number, y: number): void => {
    const plant = placedPlants.value.find((p) => p.id === placedId);
    if (!plant) return;

    // Calculate required grid dimensions to fit the plant at the new position
    const requiredWidth = x + plant.width;
    const requiredHeight = y + plant.height;

    // Expand grid if needed to accommodate the plant
    if (requiredWidth > gridWidth.value) {
      gridWidth.value = requiredWidth;
    }
    if (requiredHeight > gridHeight.value) {
      gridHeight.value = requiredHeight;
    }

    // Ensure coordinates are within bounds (should be after expansion, but safety check)
    const adjustedX = Math.max(0, Math.min(x, gridWidth.value - plant.width));
    const adjustedY = Math.max(0, Math.min(y, gridHeight.value - plant.height));

    // Update position
    plant.x = adjustedX;
    plant.y = adjustedY;

    // Trigger reactivity
    const newPlacedPlants = [...placedPlants.value];
    placedPlants.value = newPlacedPlants;
    // Create deep copy for history
    undoRedo.addState(newPlacedPlants.map(p => ({ ...p })));
  };

  const removePlaced = (id: string): void => {
    const newPlacedPlants = placedPlants.value.filter((p) => p.id !== id);
    placedPlants.value = newPlacedPlants;
    // Create deep copy for history
    undoRedo.addState(newPlacedPlants.map(p => ({ ...p })));
  };

  const clearLayout = (): void => {
    placedPlants.value = [];
    undoRedo.reset([]);
  };

  const resetPlanner = (): void => {
    clearStorage();
    selectedPlantId.value = null;
    clearLayout();
  };

  const selectPlant = (plantId: string | null): void => {
    selectedPlantId.value = selectedPlantId.value === plantId ? null : plantId;
  };

  const selectPlacedPlant = (placedId: string | null): void => {
    selectedPlacedPlantId.value = selectedPlacedPlantId.value === placedId ? null : placedId;
  };

  const undo = (): void => {
    const state = undoRedo.undo();
    if (state !== null) {
      // Create a deep copy to ensure Vue reactivity
      placedPlants.value = state.map(p => ({ ...p }));
    }
  };

  const redo = (): void => {
    const state = undoRedo.redo();
    if (state !== null) {
      // Create a deep copy to ensure Vue reactivity
      placedPlants.value = state.map(p => ({ ...p }));
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
    [placedPlants, selectedPlantId, gridWidth, gridHeight],
    () => {
      storageData.value = {
        placedPlants: placedPlants.value,
        selectedPlantId: selectedPlantId.value,
        gridWidth: gridWidth.value,
        gridHeight: gridHeight.value,
      };
    },
    { deep: true }
  );

  // Watch favoriteIds and fetch when changed
  watch(favoriteIds, () => {
    fetchFavorites();
  });

  // Toggle snap increment between 0.5 and 1.0
  const toggleSnapIncrement = (): void => {
    snapIncrement.value = snapIncrement.value === 1.0 ? 0.5 : 1.0;
  };

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
    selectedPlacedPlantId,
    gridWidth,
    gridHeight,
    snapIncrement,

    // Computed
    favoriteIds,
    plantById,
    overlapIds,
    plantCounts,

    // Methods
    // Methods
    imageUrl,
    spreadFeetLabel,
    spreadCells,
    placePlant,
    movePlant,
    removePlaced,
    clearLayout,
    resetPlanner,
    selectPlant,
    selectPlacedPlant,
    undo,
    redo,
    canUndo: undoRedo.canUndo,
    canRedo: undoRedo.canRedo,
    fetchFavorites,

    // New Directional Resize Methods
    addRowTop: () => {
      gridHeight.value += 1;
      // Shift all plants down by 1
      placedPlants.value.forEach(p => p.y += 1);
      // Trigger update
      placedPlants.value = [...placedPlants.value];
      // Create deep copy for history
      undoRedo.addState(placedPlants.value.map(p => ({ ...p })));
    },
    removeRowTop: () => {
      // Check if any plant is in the top row (y < 1)
      // Note: A plant at y=0 has height >= 1, so it occupies row 0.
      const hasPlantAtTop = placedPlants.value.some(p => p.y < 1);
      if (gridHeight.value > 1 && !hasPlantAtTop) {
        gridHeight.value -= 1;
        // Shift all plants up by 1
        placedPlants.value.forEach(p => p.y -= 1);
      // Trigger update
      placedPlants.value = [...placedPlants.value];
      // Create deep copy for history
      undoRedo.addState(placedPlants.value.map(p => ({ ...p })));
      }
    },
    addRowBottom: () => {
      gridHeight.value += 1;
    },
    removeRowBottom: () => {
      // Check if any plant is in the bottom row
      // A plant at y occupies rows [y, y+height-1].
      // We want to remove row index (gridHeight.value - 1).
      // So if (y + height - 1) >= (gridHeight.value - 1), it blocks removal.
      // simplified: y + height > gridHeight - 1
      const limit = gridHeight.value - 1;
      const hasPlantAtBottom = placedPlants.value.some(p => p.y + p.height > limit);

      if (gridHeight.value > 1 && !hasPlantAtBottom) {
        gridHeight.value -= 1;
      }
    },
    addColumnLeft: () => {
      gridWidth.value += 1;
      // Shift all plants right by 1
      placedPlants.value.forEach(p => p.x += 1);
      // Trigger update
      placedPlants.value = [...placedPlants.value];
      // Create deep copy for history
      undoRedo.addState(placedPlants.value.map(p => ({ ...p })));
    },
    removeColumnLeft: () => {
      // Check if any plant is in the left column (x < 1)
      const hasPlantAtLeft = placedPlants.value.some(p => p.x < 1);
      if (gridWidth.value > 1 && !hasPlantAtLeft) {
        gridWidth.value -= 1;
        // Shift all plants left by 1
        placedPlants.value.forEach(p => p.x -= 1);
      // Trigger update
      placedPlants.value = [...placedPlants.value];
      // Create deep copy for history
      undoRedo.addState(placedPlants.value.map(p => ({ ...p })));
      }
    },
    addColumnRight: () => {
      gridWidth.value += 1;
    },
    removeColumnRight: () => {
      // Check if any plant is in the rightmost column
      const limit = gridWidth.value - 1;
      const hasPlantAtRight = placedPlants.value.some(p => p.x + p.width > limit);

      if (gridWidth.value > 1 && !hasPlantAtRight) {
        gridWidth.value -= 1;
      }
    },

    // Grid size management methods
    getMinGridSize,
    setGridSize,
    fitGridToPlants,
    
    // Snap increment
    toggleSnapIncrement,
  };
}

