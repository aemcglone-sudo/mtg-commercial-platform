'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { TOUR_STEPS } from '@/lib/tour-steps';

interface Rect { top: number; left: number; width: number; height: number }

const PADDING = 6;
const POLL_INTERVAL_MS = 100;
const POLL_TIMEOUT_MS = 2000;

export default function ProductTour() {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const cancelledRef = useRef(false);

  // Check whether this account has already seen the tour
  useEffect(() => {
    if (pathname !== '/') return; // only auto-launch from the main collector page
    let cancelled = false;
    fetch('/api/tour/status')
      .then((r) => r.json())
      .then((data: { hasSeenTour: boolean }) => {
        if (!cancelled && !data.hasSeenTour) {
          setTimeout(() => { if (!cancelled) setActive(true); }, 600);
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setReady(true); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finish = useCallback(() => {
    setActive(false);
    fetch('/api/tour/complete', { method: 'POST' }).catch(() => {});
  }, []);

  const locateStep = useCallback(async (index: number) => {
    cancelledRef.current = false;
    const step = TOUR_STEPS[index];
    if (!step) { finish(); return; }

    setRect(null); // clear any previous spotlight so it never shows against the wrong step's text

    if (step.target.type === 'info') {
      return;
    }

    if (step.target.tab) {
      router.push(`/?tab=${step.target.tab}`);
    }

    const selectors = [step.target.selector, step.target.fallbackSelector].filter(Boolean) as string[];
    const started = Date.now();

    while (Date.now() - started < POLL_TIMEOUT_MS) {
      if (cancelledRef.current) return;
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          await new Promise((r) => setTimeout(r, 250));
          const box = el.getBoundingClientRect();
          setRect({ top: box.top, left: box.left, width: box.width, height: box.height });
          return;
        }
      }
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }

    // Not found anywhere on the page — skip this step rather than block the tour
    if (!cancelledRef.current) {
      setStepIndex((i) => (i === index ? i + 1 : i));
    }
  }, [router, finish]);

  useEffect(() => {
    if (!active) return;
    locateStep(stepIndex);
    return () => { cancelledRef.current = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, stepIndex]);

  // Re-measure on resize/scroll while a live element is spotlighted
  useEffect(() => {
    if (!active) return;
    const step = TOUR_STEPS[stepIndex];
    if (!step || step.target.type !== 'element') return;

    function remeasure() {
      if (step.target.type !== 'element') return;
      const el = document.querySelector(step.target.selector) ?? (step.target.fallbackSelector ? document.querySelector(step.target.fallbackSelector) : null);
      if (el) {
        const box = el.getBoundingClientRect();
        setRect({ top: box.top, left: box.left, width: box.width, height: box.height });
      }
    }
    window.addEventListener('resize', remeasure);
    window.addEventListener('scroll', remeasure, true);
    return () => {
      window.removeEventListener('resize', remeasure);
      window.removeEventListener('scroll', remeasure, true);
    };
  }, [active, stepIndex]);

  if (!ready || !active) return null;

  const step = TOUR_STEPS[stepIndex];
  if (!step) return null;

  const isLast = stepIndex === TOUR_STEPS.length - 1;
  const isFirst = stepIndex === 0;

  // Tooltip position: near the spotlighted element, or centered if info-only
  const TOOLTIP_HEIGHT_ESTIMATE = 190;
  let tooltipStyle: React.CSSProperties;
  if (rect) {
    const spaceBelow = window.innerHeight - (rect.top + rect.height);
    const placeBelow = spaceBelow > TOOLTIP_HEIGHT_ESTIMATE + 20;
    const rawTop = placeBelow
      ? rect.top + rect.height + PADDING + 10
      : rect.top - PADDING - 10 - TOOLTIP_HEIGHT_ESTIMATE;
    const top = Math.min(Math.max(rawTop, 16), window.innerHeight - TOOLTIP_HEIGHT_ESTIMATE - 16);
    const left = Math.min(Math.max(rect.left, 16), window.innerWidth - 336);
    tooltipStyle = { position: 'fixed', top, left };
  } else {
    tooltipStyle = { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
  }

  return (
    <div className="fixed inset-0 z-[100]" aria-live="polite">
      {/* Dimmed backdrop with a spotlight cutout */}
      {rect ? (
        <>
          <div className="fixed bg-black/70 transition-all duration-200" style={{ top: 0, left: 0, right: 0, height: Math.max(rect.top - PADDING, 0) }} />
          <div className="fixed bg-black/70 transition-all duration-200" style={{ top: rect.top + rect.height + PADDING, left: 0, right: 0, bottom: 0 }} />
          <div className="fixed bg-black/70 transition-all duration-200" style={{ top: rect.top - PADDING, left: 0, width: Math.max(rect.left - PADDING, 0), height: rect.height + PADDING * 2 }} />
          <div className="fixed bg-black/70 transition-all duration-200" style={{ top: rect.top - PADDING, left: rect.left + rect.width + PADDING, right: 0, height: rect.height + PADDING * 2 }} />
          <div
            className="fixed rounded-lg ring-2 ring-amber-400 pointer-events-none transition-all duration-200"
            style={{ top: rect.top - PADDING, left: rect.left - PADDING, width: rect.width + PADDING * 2, height: rect.height + PADDING * 2 }}
          />
        </>
      ) : (
        <div className="fixed inset-0 bg-black/70" />
      )}

      {/* Tooltip / info card */}
      <div
        style={tooltipStyle}
        className="w-80 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl p-4 space-y-3"
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-zinc-500">{stepIndex + 1} / {TOUR_STEPS.length}</span>
          <button type="button" onClick={finish} className="text-xs text-zinc-500 hover:text-zinc-300">
            Skip tour
          </button>
        </div>
        <div>
          <h3 className="text-sm font-bold text-amber-400">{step.title}</h3>
          <p className="text-sm text-zinc-300 mt-1">{step.body}</p>
        </div>
        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
            disabled={isFirst}
            className="text-xs px-3 py-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 disabled:opacity-30 disabled:hover:text-zinc-400 transition-colors"
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => (isLast ? finish() : setStepIndex((i) => i + 1))}
            className="text-xs px-4 py-1.5 rounded-lg font-semibold text-black bg-amber-400 hover:bg-amber-300 transition-colors"
          >
            {isLast ? 'Finish' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
