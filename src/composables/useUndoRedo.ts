import { ref, computed } from 'vue';

export function useUndoRedo<T>(initialState: T, maxHistory = 20) {
  const history = ref<T[]>([initialState]);
  const currentIndex = ref(0);

  const canUndo = computed(() => currentIndex.value > 0);
  const canRedo = computed(() => currentIndex.value < history.value.length - 1);

  const addState = (state: T): void => {
    // Remove any states after current index (when user made changes after undo)
    history.value = history.value.slice(0, currentIndex.value + 1);
    
    // Add new state
    history.value.push(state);
    
    // Limit history size
    if (history.value.length > maxHistory + 1) {
      history.value.shift();
    } else {
      currentIndex.value++;
    }
  };

  const undo = (): T | null => {
    if (!canUndo.value) return null;
    currentIndex.value--;
    return history.value[currentIndex.value];
  };

  const redo = (): T | null => {
    if (!canRedo.value) return null;
    currentIndex.value++;
    return history.value[currentIndex.value];
  };

  const reset = (state: T): void => {
    history.value = [state];
    currentIndex.value = 0;
  };

  return {
    currentState: computed(() => history.value[currentIndex.value]),
    canUndo,
    canRedo,
    addState,
    undo,
    redo,
    reset,
  };
}

