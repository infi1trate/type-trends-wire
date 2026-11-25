import { describe,it,expect } from 'vitest';
import fixture from '../../../docs/proof/b1/adoption-real.json';
import type { AdoptionFig } from '@/lib/data-stories/types';
import { adoptionLayout, shortQuarter, quarterLabelVisible } from './adoption-layout';
const f: AdoptionFig = {kind:'adoption',title:'Who showed big type first',note:'',signal:{key:'type',name:'Big type',href:''},quarters:fixture.quarters,share:[],adopters:fixture.adopters.map(a=>({...a,sector:'',href:'',firstAt:'',censored:false})),never:164,total:300};
describe('B1 real 136-brand adoption layout',()=>{
 for(const viewport of [1440,768,390]) it(`columns have no overlapping or clipped squares at ${viewport}`,()=>{
  const g=adoptionLayout(f);expect(g.cells).toHaveLength(136);expect(g.size).toBeGreaterThanOrEqual(10);
  for(const [i,a] of g.cells.entries()) {expect(a.x).toBeGreaterThanOrEqual(g.left+a.quarter*g.column);expect(a.x+g.size).toBeLessThanOrEqual(g.left+(a.quarter+1)*g.column);expect(a.y+g.size).toBeLessThan(g.height);for(const b of g.cells.slice(i+1)){expect(a.x+g.size<=b.x || b.x+g.size<=a.x || a.y+g.size<=b.y || b.y+g.size<=a.y).toBe(true);}}
  if(viewport===390) expect(g.width).toBeGreaterThan(viewport-40); else expect(g.width).toBeLessThan(viewport-40);
 });
 it('short quarter labels retain first, last and selected',()=>{expect(shortQuarter('2021Q1')).toBe('Q1 21');expect(quarterLabelVisible(0,9,3)).toBe(true);expect(quarterLabelVisible(8,9,3)).toBe(true);expect(quarterLabelVisible(3,9,3)).toBe(true);expect(quarterLabelVisible(2,9,3)).toBe(false);});
});
