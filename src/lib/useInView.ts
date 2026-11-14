import { useCallback, useEffect, useState } from 'react';

/**
 * True while the element is in view. Uses a callback ref so it also works when the
 * element mounts later (e.g. a chart that renders after its data).
 *
 * By default it latches (stays true after the first entry). With `repeat`, it turns
 * false again once the element has fully left the viewport, so entrance animations
 * replay every time the section scrolls back in.
 */
export function useInView<T extends Element>(threshold = 0.3, { repeat = false }: { repeat?: boolean } = {}) {
  const [node, setNode] = useState<T | null>(null);
  const [inView, setInView] = useState(false);
  const ref = useCallback((el: T | null) => setNode(el), []);

  useEffect(() => {
    if (!node || (inView && !repeat)) return;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && e.intersectionRatio >= threshold) {
            setInView(true);
            if (!repeat) io.disconnect();
          } else if (repeat && !e.isIntersecting) {
            // Reset only once it is fully off screen, so it never blinks while visible.
            setInView(false);
          }
        }
      },
      { threshold: repeat ? [0, threshold] : threshold },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [node, threshold, inView, repeat]);

  return { ref, inView };
}
