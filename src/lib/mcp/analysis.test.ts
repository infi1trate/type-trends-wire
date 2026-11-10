import {describe,it,expect} from 'vitest';
import {analyzeFamily,movers,type FontRow} from './analysis';
import {computeBand} from '../bands';
const fixture=(n=60,peaking=false):FontRow[]=>Array.from({length:n},(_,i)=>({captured_on:new Date(Date.UTC(2026,8,1+i)).toISOString().slice(0,10),family:'Inter',category:'sans-serif',is_variable:true,popularity_rank:peaking?1:500-i*3,trending_rank:peaking?20+i*3:20}));
describe('MCP analysis',()=>{
 it('climbs 84 places over 28 days and is RISING',()=>{const r=analyzeFamily(fixture());expect(r?.change.popularity_28d).toBe(84);expect(r?.band).toBe('RISING');expect(r?.band_reason).toBe(computeBand(fixture()).reason);});
 it('rank 1 and worsening momentum is PEAKING',()=>{expect(analyzeFamily(fixture(60,true))?.band).toBe('PEAKING');});
 it('fewer than 42 days is BASELINE',()=>{expect(analyzeFamily(fixture(42))?.band).toBe('BASELINE');expect(analyzeFamily(fixture(43))?.band).toBe('RISING');});
 it('returns null for no history and null changes for insufficient history',()=>{expect(analyzeFamily([])).toBeNull();expect(analyzeFamily(fixture(1))?.change.popularity_7d).toBeNull();});
 it('orders rising, falling and trending and drops unknown comparison families',()=>{
   const row=fixture(1)[0];if(!row)throw new Error('Missing fixture');
   const old=[{...row,family:'A',popularity_rank:100},{...row,family:'B',popularity_rank:100}];
   const cur=[{...row,family:'A',popularity_rank:80,trending_rank:30},{...row,family:'B',popularity_rank:120,trending_rank:2},{...row,family:'C',trending_rank:1}];
   expect(movers(cur,old,{direction:'rising',limit:50}).map(r=>r.family)).toEqual(['A','B']);
   expect(movers(cur,old,{direction:'falling',limit:50}).map(r=>r.family)).toEqual(['B','A']);
   expect(movers(cur,old,{direction:'trending',limit:2}).map(r=>r.family)).toEqual(['C','B']);
 });
});
