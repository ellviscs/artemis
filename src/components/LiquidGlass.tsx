// React wrapper around the vendored liquid-glass-js Container: a WebGL panel that
// refracts and blurs an html2canvas snapshot of the page behind it.
//
// The library takes ONE snapshot of document.body and shares it. Here we:
//  - wait for web fonts and the page-enter animation, so the snapshot matches layout;
//  - discard a snapshot taken on an earlier visit (SPA navigation changes the page);
//  - portal React children onto the glass, above its canvas;
//  - release each WebGL context on unmount (the library never does).
// html2canvas cannot read WebGL canvases or cross-origin map tiles, so only place
// glass over CSS backgrounds (gradients, images), e.g. `.thermal-field`.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';

import { DEFAULT_GLASS } from '@/lib/glassParams';
import { cn } from '@/lib/utils';

type ContainerClass = typeof import('@/vendor/liquid-glass/container').Container;
type ContainerInstance = InstanceType<ContainerClass>;

let snapshotTag: string | null = null;

function webglAvailable(): boolean {
  try {
    return !!document.createElement('canvas').getContext('webgl');
  } catch {
    return false;
  }
}

interface Props {
  children: ReactNode;
  className?: string;
  /** Inner content wrapper classes (padding, layout). */
  contentClassName?: string;
  radius?: number;
  /** A light scrim between glass and text so ink text keeps ≥ 7:1 contrast. */
  scrim?: string;
}

export function LiquidGlass({ children, className, contentClassName, radius = 14, scrim = 'rgba(250, 248, 245, 0.42)' }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [fallback, setFallback] = useState(false);
  const { key: locationKey } = useLocation();

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    if (!webglAvailable() || window.matchMedia('(prefers-reduced-transparency: reduce)').matches) {
      setFallback(true);
      return;
    }
    let cancelled = false;
    let instance: ContainerInstance | null = null;
    let observer: ResizeObserver | null = null;

    (async () => {
      // Snapshot only once layout is final: fonts loaded and the page-enter animation over.
      await document.fonts?.ready;
      await new Promise((r) => setTimeout(r, 700));
      if (cancelled) return;
      const { Container } = await import('@/vendor/liquid-glass/container');
      if (cancelled) return;
      if (snapshotTag !== locationKey && !Container.isCapturing) {
        Container.pageSnapshot = null;
        snapshotTag = locationKey;
      }
      window.glassControls = { ...DEFAULT_GLASS, ...(window.glassControls ?? {}) };
      instance = new Container({ borderRadius: radius, type: 'rounded', tintOpacity: window.glassControls.tintOpacity ?? DEFAULT_GLASS.tintOpacity });
      const el = instance.element;
      Object.assign(el.style, { display: 'block', padding: '0', width: '100%', height: '100%', gap: '0' });
      instance.canvas.style.boxShadow = '0 18px 40px rgba(97, 44, 37, 0.18)';
      host.appendChild(el);
      instance.updateSizeFromDOM();
      observer = new ResizeObserver(() => instance?.updateSizeFromDOM());
      observer.observe(el);
      setTarget(el);
    })();

    return () => {
      cancelled = true;
      observer?.disconnect();
      if (instance) {
        const inst = instance;
        const gl = inst.gl_refs.gl;
        inst.gl_refs = {}; // stops the library's scroll-driven render loop
        gl?.getExtension('WEBGL_lose_context')?.loseContext();
        inst.element.remove();
        import('@/vendor/liquid-glass/container').then(({ Container }) => {
          Container.instances = Container.instances.filter((i) => i !== inst);
        });
      }
      setTarget(null);
    };
  }, [radius, locationKey]);

  const content = (
    <div
      className={cn('relative z-[1] h-full', contentClassName)}
      style={{ background: scrim, borderRadius: radius }}
      // Keep the in-place copy out of the page snapshot, or the glass would refract its own text.
      data-html2canvas-ignore={target ? undefined : 'true'}
    >
      {children}
    </div>
  );

  return (
    <div
      ref={hostRef}
      className={cn('relative', fallback && 'border border-white/50 bg-white/40 backdrop-blur-md', className)}
      style={{ borderRadius: radius }}
    >
      {/* Until the glass is ready (or without WebGL) the content renders in place. */}
      {target ? createPortal(content, target) : content}
    </div>
  );
}
