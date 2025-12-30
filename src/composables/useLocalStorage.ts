import { ref, watch } from 'vue';

export function useLocalStorage<T>(key: string, defaultValue: T) {
  const storedValue = ref<T>(defaultValue);

  // Load from localStorage
  const load = (): T => {
    if (typeof window === 'undefined') return defaultValue;
    try {
      const item = window.localStorage.getItem(key);
      if (item) {
        return JSON.parse(item) as T;
      }
    } catch (e) {
      // ignore corrupt storage
    }
    return defaultValue;
  };

  // Save to localStorage
  const save = (value: T): void => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      // ignore quota/storage errors
    }
  };

  // Debounced save
  let saveTimeoutId: ReturnType<typeof setTimeout> | null = null;
  const scheduleSave = (value: T, delay = 150): void => {
    if (saveTimeoutId) clearTimeout(saveTimeoutId);
    saveTimeoutId = setTimeout(() => {
      save(value);
      saveTimeoutId = null;
    }, delay);
  };

  // Initialize
  storedValue.value = load();

  // Watch for changes and auto-save
  watch(
    storedValue,
    (newValue) => {
      scheduleSave(newValue);
    },
    { deep: true }
  );

  // Remove from localStorage
  const remove = (): void => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem(key);
      storedValue.value = defaultValue;
    } catch (e) {
      // ignore
    }
  };

  return {
    storedValue,
    load,
    save,
    remove,
    scheduleSave,
  };
}

