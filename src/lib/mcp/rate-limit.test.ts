import {it,expect} from 'vitest';
import {createRateLimiter} from './rate-limit';
it('allows exactly 60 requests per IP per minute',()=>{const allow=createRateLimiter();for(let i=0;i<60;i++)expect(allow('1',0)).toBe(true);expect(allow('1',59999)).toBe(false);expect(allow('2',59999)).toBe(true);expect(allow('1',60000)).toBe(true);});
