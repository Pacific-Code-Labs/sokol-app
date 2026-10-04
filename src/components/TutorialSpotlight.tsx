import { useEffect, useRef, useState, type ReactNode } from "react";

type Rect = { top: number; left: number; width: number; height: number };
type Layout = { target: Rect | null; left: number; top: number; width: number; maxHeight: number; viewport: { width: number; height: number } };
const GAP = 16;

/** Follow real page elements through navigation, animation and nested scrolling. */
export function TutorialSpotlight({ selector, label, children }: { selector: string | null; label: string; children: ReactNode }) {
  const panel = useRef<HTMLElement>(null);
  const [layout, setLayout] = useState<Layout | null>(null);
  useEffect(() => {
    let frame = 0;
    let target: HTMLElement | null = null;
    let scrolled: HTMLElement | null = null;
    const resize = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => schedule()) : null;
    const started = performance.now();
    const measure = () => {
      const next = selector ? document.querySelector<HTMLElement>(selector) : null;
      if (next !== target) {
        if (target) resize?.unobserve(target);
        target = next;
        if (target) resize?.observe(target);
      }
      if (target && scrolled !== target) {
        target.scrollIntoView?.({ block: "start", inline: "nearest", behavior: "instant" });
        scrolled = target;
      }
      const viewport = { width: window.innerWidth, height: window.innerHeight };
      const bounds = target?.getBoundingClientRect();
      let rect: Rect | null = null;
      if (bounds && bounds.width > 0 && bounds.height > 0) {
        const left = Math.max(8, bounds.left - 8);
        const top = Math.max(8, bounds.top - 8);
        const right = Math.min(viewport.width - 8, bounds.right + 8);
        const bottom = Math.min(viewport.height - 8, bounds.bottom + 8);
        if (right > left && bottom > top) rect = { left, top, width: right - left, height: bottom - top };
      }
      const width = Math.min(380, viewport.width - GAP * 2);
      const height = Math.min(panel.current?.scrollHeight || 360, viewport.height - GAP * 2);
      let left = (viewport.width - width) / 2;
      let top = (viewport.height - height) / 2;
      let maxHeight = viewport.height - GAP * 2;
      if (rect) {
        const below = viewport.height - rect.top - rect.height - GAP * 2;
        const above = rect.top - GAP * 2;
        if (viewport.width - rect.left - rect.width >= width + GAP * 2) {
          left = rect.left + rect.width + GAP;
          top = Math.max(GAP, Math.min(rect.top, viewport.height - height - GAP));
        } else if (rect.left >= width + GAP * 2) {
          left = rect.left - width - GAP;
          top = Math.max(GAP, Math.min(rect.top, viewport.height - height - GAP));
        } else if (below >= above) {
          top = rect.top + rect.height + GAP;
          maxHeight = Math.max(120, below);
        } else {
          maxHeight = Math.max(120, above);
          top = Math.max(GAP, rect.top - Math.min(height, maxHeight) - GAP);
        }
      }
      const nextLayout = { target: rect, left, top, width, maxHeight, viewport };
      setLayout(current => JSON.stringify(current) === JSON.stringify(nextLayout) ? current : nextLayout);
      if (performance.now() - started < 500) frame = requestAnimationFrame(measure);
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); };
    const mutation = new MutationObserver(schedule);
    mutation.observe(document.body, { childList: true, subtree: true });
    if (panel.current) resize?.observe(panel.current);
    window.addEventListener("resize", schedule);
    document.addEventListener("scroll", schedule, true);
    window.visualViewport?.addEventListener("resize", schedule);
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      resize?.disconnect();
      mutation.disconnect();
      window.removeEventListener("resize", schedule);
      document.removeEventListener("scroll", schedule, true);
      window.visualViewport?.removeEventListener("resize", schedule);
    };
  }, [selector]);
  useEffect(() => { panel.current?.focus({ preventScroll: true }); }, [selector]);
  const rect = layout?.target;
  const viewport = layout?.viewport ?? { width: window.innerWidth, height: window.innerHeight };
  const hole = rect ? `M${rect.left},${rect.top}h${rect.width}v${rect.height}h-${rect.width}Z` : "";
  return <>
    <svg aria-hidden="true" className="pointer-events-none fixed inset-0 z-50 h-full w-full" viewBox={`0 0 ${viewport.width} ${viewport.height}`} preserveAspectRatio="none">
      <path className="pointer-events-auto fill-black/70" fillRule="evenodd" d={`M0,0H${viewport.width}V${viewport.height}H0Z ${hole}`} />
    </svg>
    {rect && <div data-tutorial-spotlight aria-hidden="true" className="pointer-events-none fixed z-50 rounded-xl border-2 border-primary shadow-[0_0_24px_hsl(var(--primary)/0.35)]" style={rect} />}
    <section ref={panel} tabIndex={-1} aria-label={label} onKeyDown={event => {
      if (event.key !== "Tab") return;
      const controls = Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]') ?? []);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel.current)) {
        event.preventDefault(); first?.focus();
      }
    }} className="fixed z-[60] overflow-y-auto rounded-xl border border-primary/30 bg-card p-5 shadow-2xl outline-none" style={layout ? { left: layout.left, top: layout.top, width: layout.width, maxHeight: layout.maxHeight } : { left: GAP, right: GAP, bottom: GAP, maxHeight: "calc(100dvh - 2rem)" }}>
      {children}
    </section>
  </>;
}
