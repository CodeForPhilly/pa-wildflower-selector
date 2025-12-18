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
  offsetX: number;
  offsetY: number;
  ctrlKey: boolean;
}

export function usePointerDrag(
  gridRef: Ref<HTMLElement | null>,
  cellSize: Ref<number>,
  gridWidth: Ref<number>,
  gridHeight: Ref<number>,
  snapIncrement: Ref<number>,
  onDragEnd: (coords: GridCoords, dragType: 'place' | 'move', plantId: string) => void,
  getPlantSize?: (plantId: string) => number
) {
  const dragState = ref<DragState>({
    isDragging: false,
    dragType: null,
    plantId: null,
    startCoords: null,
    currentCoords: null,
    pointerX: 0,
    pointerY: 0,
    offsetX: 0,
    offsetY: 0,
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

  const handlePointerDown = (event: PointerEvent, dragType: 'place' | 'move', plantId: string, providedOffsetX?: number, providedOffsetY?: number) => {
    if (!event.isPrimary) return;
    
    event.preventDefault();
    const coords = getGridCoords(event);
    if (!coords) return;

    const grid = gridRef.value;
    if (!grid) return;
    
    const rect = grid.getBoundingClientRect();
    
    // Calculate offset from cursor to the top-left of the element being dragged
    let offsetX = 0;
    let offsetY = 0;
    
    if (dragType === 'move' && providedOffsetX !== undefined && providedOffsetY !== undefined) {
      // Use provided offset (calculated from actual plant position)
      offsetX = providedOffsetX;
      offsetY = providedOffsetY;
    } else if (dragType === 'move') {
      // Fallback: calculate offset from plant's current position (may not be accurate due to snapping)
      const plantX = coords.x * cellSize.value;
      const plantY = coords.y * cellSize.value;
      offsetX = event.clientX - (rect.left + plantX);
      offsetY = event.clientY - (rect.top + plantY);
    } else {
      // For placing new plants, center the preview on cursor
      // We'll use half the plant size (will be calculated in component)
      offsetX = 0;
      offsetY = 0;
    }

    dragState.value = {
      isDragging: true,
      dragType,
      plantId,
      startCoords: coords,
      currentCoords: coords,
      pointerX: event.clientX,
      pointerY: event.clientY,
      offsetX,
      offsetY,
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
    
    // Calculate cursor position relative to grid for more precise coordinate tracking
    const grid = gridRef.value;
    if (!grid) return;
    
    const rect = grid.getBoundingClientRect();
    const cursorX = event.clientX - rect.left;
    const cursorY = event.clientY - rect.top;
    
    // Calculate element position based on drag type
    let elementX, elementY;
    
    if (dragState.value.dragType === 'place') {
      // For placing new plants, calculate where the top-left corner should be
      // by centering the plant on the cursor position
      let plantSize = 1; // default size
      if (getPlantSize && dragState.value.plantId) {
        plantSize = getPlantSize(dragState.value.plantId);
      }
      const halfSizePx = (plantSize / 2) * cellSize.value;
      elementX = cursorX - halfSizePx;
      elementY = cursorY - halfSizePx;
    } else {
      // For move operations, use stored offset to maintain relative position from where user clicked
      elementX = cursorX - dragState.value.offsetX;
      elementY = cursorY - dragState.value.offsetY;
    }
    
    // Convert to grid coordinates
    const gridX = elementX / cellSize.value;
    const gridY = elementY / cellSize.value;
    
    // Snap to grid increment
    const snapToIncrement = (value: number, increment: number): number => {
      return Math.round(value / increment) * increment;
    };
    
    const snappedX = snapToIncrement(gridX, snapIncrement.value);
    const snappedY = snapToIncrement(gridY, snapIncrement.value);
    
    // Apply bounds checking based on drag type
    let finalX = snappedX;
    let finalY = snappedY;
    
    if (dragState.value.dragType === 'place') {
      // Allow coordinates outside bounds (but non-negative) for automatic grid expansion
      finalX = Math.max(0, snappedX);
      finalY = Math.max(0, snappedY);
    } else {
      // For move operations, ensure within grid bounds
      const maxX = gridWidth.value - snapIncrement.value;
      const maxY = gridHeight.value - snapIncrement.value;
      finalX = Math.max(0, Math.min(maxX, snappedX));
      finalY = Math.max(0, Math.min(maxY, snappedY));
    }
    
    dragState.value.currentCoords = {
      x: finalX,
      y: finalY,
    };
  };

  const handlePointerUp = (event: PointerEvent) => {
    if (!dragState.value.isDragging || !event.isPrimary) return;
    
    event.preventDefault();
    
    // Use the currentCoords that were calculated in handlePointerMove for consistency
    if (dragState.value.currentCoords && dragState.value.dragType && dragState.value.plantId) {
      onDragEnd(dragState.value.currentCoords, dragState.value.dragType, dragState.value.plantId);
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
      offsetX: 0,
      offsetY: 0,
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

