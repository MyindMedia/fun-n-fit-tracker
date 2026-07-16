import { useEffect, useRef } from 'react';
import type { CSSProperties, DependencyList, RefObject } from 'react';

/* ────────────────────────────────────────────────────────────────────────────
   Scroll-reveal + parallax hooks for the Pubzi theme layer.
   The CSS lives in index.html (.pz-reveal / .pz-in / .pz-parallax / --pz-scroll
   / --pz-speed / --pz-delay) — these hooks only orchestrate it:

   - useScrollReveal(): one IntersectionObserver per container adds `.pz-in`
     to every `.pz-reveal` descendant the first time it enters the viewport,
     then unobserves it (reveals play once).
   - useParallaxScroll(): rAF-throttled passive scroll listener writes the
     page scroll offset into `--pz-scroll` on the container so `.pz-parallax`
     children drift at their per-layer `--pz-speed`.

   Both no-op under prefers-reduced-motion (the CSS layer independently forces
   reveals visible and parallax static, so this is belt-and-braces).
   ──────────────────────────────────────────────────────────────────────────── */

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia(REDUCED_MOTION_QUERY).matches;

/** Inline-style helper for staggered reveals: pzDelay(120) → { '--pz-delay': '120ms' } */
export const pzDelay = (ms: number): CSSProperties =>
  ({ '--pz-delay': `${ms}ms` } as CSSProperties);

/**
 * Observe every `.pz-reveal` inside the returned container ref and add
 * `.pz-in` on first intersection (threshold 0.15, bottom rootMargin -8% so
 * elements are meaningfully on screen before they play). Pass `deps` to
 * re-scan after async content mounts; already-revealed elements are skipped.
 */
export function useScrollReveal<T extends HTMLElement = HTMLDivElement>(
  deps: DependencyList = []
): RefObject<T | null> {
  const containerRef = useRef<T | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Explicit assertion: this project has no @types/react, so `react` is
    // type-checked from its JS source and ref inference collapses to unknown.
    const targets = Array.from(
      container.querySelectorAll('.pz-reveal:not(.pz-in)')
    ) as HTMLElement[];
    if (targets.length === 0) return;

    // Reduced motion (or no IO support): show everything immediately.
    if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
      targets.forEach(el => el.classList.add('pz-in'));
      return;
    }

    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('pz-in');
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -8% 0px' }
    );

    // Anything already scrolled past reveals instantly instead of waiting for
    // the user to scroll back up. Batch the reads, then the writes.
    const rects = targets.map(el => el.getBoundingClientRect());
    targets.forEach((el, i) => {
      if (rects[i].bottom < 0) {
        el.classList.add('pz-in');
      } else {
        observer.observe(el);
      }
    });

    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return containerRef;
}

/**
 * Drive `.pz-parallax` children of `targetRef` from window scroll: a passive,
 * rAF-throttled listener reads scrollY once per frame and writes it to
 * `--pz-scroll` on the container. Optional `onFrame` receives the same read
 * (used for e.g. the nav detach state) — it stays live under reduced motion
 * because it is functional, while the parallax var write is skipped.
 */
export function useParallaxScroll(
  targetRef: RefObject<HTMLElement | null>,
  onFrame?: (scrollY: number) => void
): void {
  const onFrameRef = useRef(onFrame);
  useEffect(() => {
    onFrameRef.current = onFrame;
  });

  useEffect(() => {
    const reduceMotion = prefersReducedMotion();
    if (reduceMotion && !onFrameRef.current) return; // nothing to do

    let rafId = 0;
    const update = () => {
      rafId = 0;
      const y = window.scrollY; // single layout read per frame
      if (!reduceMotion) {
        targetRef.current?.style.setProperty('--pz-scroll', String(Math.round(y)));
      }
      onFrameRef.current?.(y);
    };
    const onScroll = () => {
      if (rafId === 0) rafId = window.requestAnimationFrame(update);
    };

    update(); // seed initial state (restored scroll positions, anchor loads)
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (rafId !== 0) window.cancelAnimationFrame(rafId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
