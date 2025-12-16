import { ref, type Ref } from 'vue';
import type { GridCoords } from '../types/garden';

export interface DragState {
  isDragging: boolean;
  dragType: 'place' | 'move' | null;
  plantId: string | null;
  startCoords: GridCoords | null;
  currentCoords: GridCoords | null;
}

export function usePointerDrag(
  gridRef: Ref<HTMLElement | null>,
  cellSize: Ref<number>,
  onDragEnd: (coords: GridCoords, dragType: 'place' | 'move', plantId: string) => void
) {
  const dragState = ref<DragState>({
    isDragging: false,
    dragType: null,
    plantId: null,
    startCoords: null,
    currentCoords: null,
  });

  const getGridCoords = (event: PointerEvent): GridCoords | null => {
    const grid = gridRef.value;
    if (!grid || typeof window === 'undefined') return null;
    
    const rect = grid.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left) / cellSize.value);
    const y = Math.floor((event.clientY - rect.top) / cellSize.value);
    
    // Ensure coordinates are within 0-9 bounds for 10x10 grid
    return {
      x: Math.max(0, Math.min(9, x)),
      y: Math.max(0, Math.min(9, y)),
    };
  };

  const handlePointerDown = (event: PointerEvent, dragType: 'place' | 'move', plantId: string) => {
    if (!event.isPrimary) return;
    
    event.preventDefault();
    const coords = getGridCoords(event);
    if (!coords) return;

    dragState.value = {
      isDragging: true,
      dragType,
      plantId,
      startCoords: coords,
      currentCoords: coords,
    };

    // Capture pointer for smooth dragging
    if (event.target instanceof HTMLElement) {
      event.target.setPointerCapture(event.pointerId);
    }

    // Add global listeners
    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
  };

  const handlePointerMove = (event: PointerEvent) => {
    if (!dragState.value.isDragging || !event.isPrimary) return;
    
    const coords = getGridCoords(event);
    if (coords) {
      dragState.value.currentCoords = coords;
    }
  };

  const handlePointerUp = (event: PointerEvent) => {
    if (!dragState.value.isDragging || !event.isPrimary) return;
    
    event.preventDefault();
    const coords = getGridCoords(event);
    
    if (coords && dragState.value.dragType && dragState.value.plantId) {
      onDragEnd(coords, dragState.value.dragType, dragState.value.plantId);
    }

    // Release pointer capture
    if (event.target instanceof HTMLElement) {
      event.target.releasePointerCapture(event.pointerId);
    }

    // Reset drag state
    dragState.value = {
      isDragging: false,
      dragType: null,
      plantId: null,
      startCoords: null,
      currentCoords: null,
    };

    // Remove global listeners
    document.removeEventListener('pointermove', handlePointerMove);
    document.removeEventListener('pointerup', handlePointerUp);
  };

  return {
    dragState,
    handlePointerDown,
  };
}

