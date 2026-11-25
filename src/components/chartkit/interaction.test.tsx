import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { ChartInteraction } from './Interaction';
import { nearestPoint, keyboardPoint, readoutWords, decimalLabel } from './interaction';
import { editorialPoints } from './QuarterLine';
const points = [{ x: 20, y: 20, period: 'Q1 2024', lines: ['Share 11.0%', '33 of 299'] }, { x: 80, y: 40, period: 'Q1 2025', lines: ['Share 13.2% · forecast', '11.0%–15.4%'] }];
describe('B1 shared chart interaction', () => {
 it('snaps to nearest x rather than y', () => { expect(nearestPoint(points, 61)).toBe(1); expect(nearestPoint(points, 21)).toBe(0); expect(nearestPoint([],20)).toBe(-1); });
 it('squares use two-dimensional nearest selection', () => { const cells=[...points,{x:20,y:80,period:'Brand',lines:[]}]; expect(nearestPoint(cells,20,75)).toBe(2); });
 it('arrow keys move one point, Home/End reach endpoints and Escape clears', () => { expect(keyboardPoint('ArrowRight',0,2)).toBe(1); expect(keyboardPoint('ArrowLeft',1,2)).toBe(0); expect(keyboardPoint('Home',1,2)).toBe(0); expect(keyboardPoint('End',0,2)).toBe(1); expect(keyboardPoint('Escape',1,2)).toBe(-1); expect(keyboardPoint('Tab',1,2)).toBeUndefined(); });
 it('readout preserves period, count, decimal unit, forecast and range', () => { expect(readoutWords(points[0] ?? points[1] as typeof points[number])).toBe('Q1 2024. Share 11.0%. 33 of 299'); expect(decimalLabel('Share 11%')).toBe('Share 11.0%'); expect(readoutWords(points[1] as typeof points[number])).toContain('forecast. 11.0%–15.4%'); });
 it('keyboard publishes the same readout words to the live region and Escape removes it', () => {
  const {container}=render(<ChartInteraction points={points} width={100} height={100} label="Share"><svg viewBox="0 0 100 100" role="img" aria-label="Share by quarter" /></ChartInteraction>);
  const root=container.querySelector('[data-chart-interaction]'); if (!root) throw new Error('No interaction');
  vi.spyOn(root,'getBoundingClientRect').mockReturnValue({x:0,y:0,left:0,top:0,right:300,bottom:200,width:300,height:200,toJSON:()=>({})});
  expect(container.querySelector('[data-chart-readout]')).toBeNull();fireEvent.keyDown(root,{key:'End'});
  expect(container.querySelector('[data-chart-live]')?.textContent).toBe('Q1 2025. Share 13.2% · forecast. 11.0%–15.4%');
  expect(container.querySelector('[data-chart-readout]')?.textContent).toContain('13.2%');fireEvent.keyDown(root,{key:'Escape'});expect(container.querySelector('[data-chart-readout]')).toBeNull();
 });
 it('editorial coordinates remain inside the phone drawing including forecast', () => {
  const ps=editorialPoints({series:[{q:'2024Q1',s:.11,n:299},{q:'2026Q4',s:.2,n:300}],forecast:[{q:'2027Q4',mid:.23,lo:.18,hi:.3}]},640,480);
  expect(ps).toHaveLength(3);for(const p of ps){expect(p.x).toBeGreaterThanOrEqual(0);expect(p.x).toBeLessThanOrEqual(640);expect(p.y).toBeGreaterThanOrEqual(0);expect(p.y).toBeLessThanOrEqual(480);}expect(ps[0]?.lines).toContain('33 of 299');
 });
});
