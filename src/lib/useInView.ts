import { useCallback, useEffect, useState } from 'react';

/**
 * True once the element has scrolled into view (stays true). Uses a callback ref so it
 * also works when the element mounts later (e.g. a chart that renders after its data).
 */
export function useInView<T extends Element>(threshold = 0.3) {
  const [node, setNode] = useState<T | null>(null);
  const [inView, setInView] = useState(false);
  const ref = useCallback((el: T | null) => setNode(el), []);

  useEffect(() => {
    if (!node || inView) return;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [node, threshold, inView]);

  return { ref, inView };
}
