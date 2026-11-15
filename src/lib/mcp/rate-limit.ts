export const REQUESTS_PER_MINUTE = 60;
/** Bounded fixed-window per-key limiter: at most `limit` hits per `windowMs`, at most 10k tracked keys. */
export function createRateLimiter(limit = REQUESTS_PER_MINUTE, windowMs = 60000) {
  const buckets=new Map<string,{started:number;count:number}>();
  return (ip:string,now=Date.now())=>{
    for(const [key,b] of buckets) if(now-b.started>=windowMs)buckets.delete(key);
    const b=buckets.get(ip);
    if(!b){ if(buckets.size>=10000)return false; buckets.set(ip,{started:now,count:1}); return true; }
    if(b.count>=limit)return false; b.count++; return true;
  };
}
