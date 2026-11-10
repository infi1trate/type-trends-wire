export const GF = 'Google Fonts Developer API (daily snapshot)';
export const json = (data: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(data,null,2) }] });
export const daysBefore = (date:string,n:number) => new Date(Date.parse(`${date}T00:00:00Z`)-n*86400000).toISOString().slice(0,10);
export const READ = {readOnlyHint:true,openWorldHint:false} as const;
export const receipt = {source:GF,method:'trend://methodology',terminal:'https://type-trends-wire.lovable.app'};
