import { ref, type Ref } from 'vue';
import type { GridCoords } from '../types/garden';

export interface DragState {
  isDragging: boolean;
  dragType: 'place' | 'move' | null;
  plantId: string | null;
  startCoords: GridCoords | null;
  currentCoords: GridCoords | null;
  pointerX: number;
  pointerY: number;
  ctrlKey: boolean;
}

export function usePointerDrag(
  gridRef: Ref<HTMLElement | null>,
  cellSize: Ref<number>,
  gridWidth: Ref<number>,
  gridHeight: Ref<number>,
  snapIncrement: Ref<number>,
  onDragEnd: (coords: GridCoords, dragType: 'place' | 'move', plantId: string) => void
) {
  const dragState = ref<DragState>({
    isDragging: false,
    dragType: null,
    plantId: null,
    startCoords: null,
    currentCoords: null,
    pointerX: 0,
    pointerY: 0,
    ctrlKey: false,
  });

  const getGridCoords = (event: PointerEvent, allowOutsideBounds = false): GridCoords | null => {
    const grid = gridRef.value;
    if (!grid || typeof window === 'undefined') return null;
    
    const rect = grid.getBoundingClientRect();
    
    // Convert pixel position to feet
    const xFeet = (event.clientX - rect.left) / cellSize.value;
    const yFeet = (event.clientY - rect.top) / cellSize.value;
    
    // Snap to the specified increment (0.5 or 1.0 ft)
    const snapToIncrement = (value: number, increment: number): number => {
      return Math.round(value / increment) * increment;
    };
    
    const snappedX = snapToIncrement(xFeet, snapIncrement.value);
    const snappedY = snapToIncrement(yFeet, snapIncrement.value);
    
    if (allowOutsideBounds) {
      // Allow coordinates outside grid bounds (for automatic grid expansion)
      // Still ensure non-negative coordinates
      return {
        x: Math.max(0, snappedX),
        y: Math.max(0, snappedY),
      };
    }
    
    // Ensure coordinates are within grid bounds
    // For decimal snap, allow up to gridWidth/gridHeight (exclusive)
    const maxX = gridWidth.value - snapIncrement.value;
    const maxY = gridHeight.value - snapIncrement.value;
    
    return {
      x: Math.max(0, Math.min(maxX, snappedX)),
      y: Math.max(0, Math.min(maxY, snappedY)),
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
      pointerX: event.clientX,
      pointerY: event.clientY,
      ctrlKey: event.ctrlKey || event.metaKey, // Support both Ctrl (Windows/Linux) and Cmd (Mac)
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
    
    dragState.value.pointerX = event.clientX;
    dragState.value.pointerY = event.clientY;
    dragState.value.ctrlKey = event.ctrlKey || event.metaKey; // Update Ctrl state during drag
    
    // Allow coordinates outside bounds when placing (for automatic grid expansion)
    const allowOutside = dragState.value.dragType === 'place';
    const coords = getGridCoords(event, allowOutside);
    if (coords) {
      dragState.value.currentCoords = coords;
    }
  };

  const handlePointerUp = (event: PointerEvent) => {
    if (!dragState.value.isDragging || !event.isPrimary) return;
    
    event.preventDefault();
    // Allow coordinates outside bounds when placing (for automatic grid expansion)
    const allowOutside = dragState.value.dragType === 'place';
    const coords = getGridCoords(event, allowOutside);
    
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
      pointerX: 0,
      pointerY: 0,
      ctrlKey: false,
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

