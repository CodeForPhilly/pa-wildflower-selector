import { ref, onMounted, onBeforeUnmount } from 'vue';
import type { Viewport } from '@/types/garden';

export function useViewport() {
  const viewport = ref<Viewport>({ width: 1024, height: 768 });
  const isMobile = ref(false);

  const updateViewport = () => {
    if (typeof window === 'undefined') return;
    viewport.value = {
      width: window.innerWidth,
      height: window.innerHeight,
    };
    isMobile.value = viewport.value.width <= 767;
  };

  onMounted(() => {
    if (typeof window !== 'undefined') {
      updateViewport();
      window.addEventListener('resize', updateViewport, { passive: true });
    }
  });

  onBeforeUnmount(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', updateViewport);
    }
  });

  return {
    viewport,
    isMobile,
  };
}

