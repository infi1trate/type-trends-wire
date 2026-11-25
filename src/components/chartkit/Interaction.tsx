import { useEffect, useRef, useState, type ReactNode } from 'react';
import { SYSTEM } from '@/lib/theme';
import { decimalLabel, keyboardPoint, nearestPoint, readoutWords, type ReadPoint } from './interaction';
export type ChartDatum = ReadPoint;
/** Data may be supplied explicitly, or obtained from the chart's existing named SVG marks on intent only. */
export function ChartInteraction({ children, points, width, height, spatial = false, onSelect, label = 'Chart', enabled = true, onActivate }: { children: ReactNode; points?: ReadPoint[]; width?: number; height?: number; spatial?: boolean; onSelect?: (i: number) => void; label?: string; enabled?: boolean; onActivate?: () => void }) {
  const ref = useRef<HTMLDivElement>(null), tip = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState({ left: 0, right: 0, top: 0, bottom: 0 });
  const [active, setActive] = useState(-1), [live, setLive] = useState(''), [data, setData] = useState<ReadPoint[]>([]), [box, setBox] = useState({ w: 0, h: 0 });
  const pinned = useRef(false);
  useEffect(() => {
    const outside = (e: PointerEvent) => { if (e.target instanceof Node && !ref.current?.contains(e.target)) { setActive(-1); pinned.current = false; } };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, []);
  useEffect(() => {
    const root = ref.current; if (!root || !enabled || typeof ResizeObserver === 'undefined') return;
    const resize = () => root.querySelectorAll<SVGSVGElement>('svg').forEach(svg => {
      const units = svg.viewBox.baseVal.width, pixels = svg.getBoundingClientRect().width;
      if (units > 0 && pixels > 0) svg.style.setProperty('--chart-label-floor', `${SYSTEM.chartFeedback.labelFloor * units / pixels}px`);
    });
    const observer = new ResizeObserver(resize); observer.observe(root); resize(); return () => observer.disconnect();
  }, [enabled, children]);
  useEffect(() => { if (active < 0 || !tip.current || typeof ResizeObserver === 'undefined') return; const observer = new ResizeObserver(() => setBox(b => ({ ...b }))); observer.observe(tip.current); return () => observer.disconnect(); }, [active]);
  const collect = (): ReadPoint[] => {
    const root = ref.current; if (!root) return [];
    const b = root.getBoundingClientRect(); setBox({ w: b.width, h: b.height });
    const scroll = root.closest('.adoption-scroll')?.getBoundingClientRect();
    setVisible({ left: Math.max(0, scroll ? scroll.left - b.left : 0), right: Math.min(b.width, scroll ? scroll.right - b.left : b.width), top: Math.max(0, -b.top), bottom: Math.min(b.height, window.innerHeight - b.top) });
    if (points && width && height) {
      const svg = width === 100 && height === 100 ? null : root.querySelector('svg:not([data-slug-filters])');
      const sb = svg?.getBoundingClientRect() ?? b;
      const scale = Math.min(sb.width / width, sb.height / height), ox = sb.left - b.left + (sb.width - width * scale) / 2, oy = sb.top - b.top + (sb.height - height * scale) / 2;
      return points.map(p => ({ ...p, x: svg ? ox + p.x * scale : p.x / width * b.width, y: svg ? oy + p.y * scale : p.y / height * b.height }));
    }
    const out: ReadPoint[] = [];
    root.querySelectorAll<SVGGraphicsElement>('svg [aria-label], svg title').forEach(el => {
      const mark = el.tagName.toLowerCase() === 'title' ? el.parentElement : el;
      if (!(mark instanceof SVGGraphicsElement) || mark.closest('[data-chart-interaction]') !== root) return;
      const s = mark.getBoundingClientRect(); if (!s.width && !s.height) return;
      const name = mark.getAttribute('aria-label') ?? el.textContent ?? '';
      if (!name || out.some(p => p.period === name)) return;
      const pieces = decimalLabel(name).split(/ · |: /);
      const mx = mark.getAttribute('data-read-x'), my = mark.getAttribute('data-read-y'), matrix = mark.getScreenCTM();
      const position = mx !== null && my !== null && matrix ? new DOMPoint(Number(mx), Number(my)).matrixTransform(matrix) : { x: s.left + s.width / 2, y: s.top + s.height / 2 };
      out.push({ x: position.x - b.left, y: position.y - b.top, period: pieces[0] ?? name, lines: pieces.slice(1) });
    });
    return out.sort((a, b) => a.x - b.x || a.y - b.y);
  };
  const select = (i: number, list: ReadPoint[], keyboard = false) => {
    setData(list); setActive(i); const p = list[i]; if (keyboard) setLive(p ? readoutWords({ ...p, lines: spatial ? p.lines : list.filter(d => Math.abs(d.x - p.x) < 1).flatMap(d => d.lines) }) : ''); if (p) onSelect?.(i);
  };
  const p = data[active], same = p ? (spatial ? [p] : data.filter(d => Math.abs(d.x - p.x) < 1)) : [];
  const tw = Math.min(tip.current?.offsetWidth ?? SYSTEM.chartFeedback.readoutWidth, visible.right - visible.left || box.w), th = tip.current?.offsetHeight ?? 100;
  const left = p ? Math.max(visible.left, Math.min(visible.right - tw, p.x > (visible.left + visible.right) / 2 ? p.x - tw - SYSTEM.chartFeedback.gap : p.x + SYSTEM.chartFeedback.gap)) : 0;
  const top = p ? Math.max(visible.top, Math.min(visible.bottom - th, p.y > (visible.top + visible.bottom) / 2 ? p.y - th - SYSTEM.chartFeedback.gap : p.y + SYSTEM.chartFeedback.gap)) : 0;
  if (!enabled) return <>{children}</>;
  return <div ref={ref} className="chart-interaction" data-chart-interaction="" tabIndex={0} role="group" aria-label={label}
    onPointerDown={e => { pinned.current = e.pointerType !== 'mouse'; const b = e.currentTarget.getBoundingClientRect(), list = collect(); select(nearestPoint(list, e.clientX - b.left, (spatial || ref.current?.querySelector('.tk-svg-bar')) ? e.clientY - b.top : undefined), list); }}
    onPointerMove={e => { if (e.pointerType !== 'mouse' && e.buttons === 0) return; const b = e.currentTarget.getBoundingClientRect(), list = collect(); select(nearestPoint(list, e.clientX - b.left, (spatial || ref.current?.querySelector('.tk-svg-bar')) ? e.clientY - b.top : undefined), list); }}
    onPointerLeave={() => { if (!pinned.current) setActive(-1); }}
    onKeyDown={e => { if (e.target !== e.currentTarget) return; if (e.key === 'Enter' && onActivate) { e.preventDefault(); onActivate(); return; } const list = collect(); let next = keyboardPoint(e.key, active, list.length);
      if (!spatial && active >= 0 && next !== undefined && next >= 0 && /^Arrow/.test(e.key)) { const direction = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1; const here = list[active]; while (here && next>=0 && next<list.length && Math.abs((list[next]?.x ?? Infinity)-here.x)<1) next+=direction; next=Math.max(0,Math.min(list.length-1,next)); } if (next === undefined) return; e.preventDefault(); e.stopPropagation(); pinned.current = true; select(next, list, true); }}>
    {children}
    {p && <div className="chart-interaction-overlay" aria-hidden="true">
      <span className="chart-crosshair" style={{ left: p.x }} />
      {same.map((d, i) => <span key={i} className="chart-marker" style={{ left: d.x, top: d.y }} />)}
      <div ref={tip} className="chart-readout" style={{ left, top, maxWidth: Math.max(0, visible.right - visible.left), maxHeight: Math.max(0, visible.bottom - visible.top) }} data-chart-readout=""><strong>{p.period}</strong>{same.flatMap(d => d.lines).map((line, i) => <div key={i}>{line}</div>)}</div>
    </div>}
    <span className="sr-only" aria-live="polite" aria-atomic="true" data-chart-live="">{live}</span>
  </div>;
}
