export const REQUESTS_PER_MINUTE = 60;
export function createRateLimiter() {
  const buckets=new Map<string,{started:number;count:number}>();
  return (ip:string,now=Date.now())=>{
    for(const [key,b] of buckets) if(now-b.started>=60000)buckets.delete(key);
    const b=buckets.get(ip);
    if(!b){ if(buckets.size>=10000)return false; buckets.set(ip,{started:now,count:1}); return true; }
    if(b.count>=REQUESTS_PER_MINUTE)return false; b.count++; return true;
  };
}
