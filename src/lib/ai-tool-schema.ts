// Gemini function declarations accept a narrower schema dialect than JSON Schema.
// Zod still enforces all sizes, formats and closed-object rules on the returned result.
export function geminiToolSchema(value: unknown): Record<string, unknown> {
 const input=value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
 const result:Record<string,unknown>={};
 for(const key of ['type','description','enum','required','items','properties']) {
  const v=input[key];if(v===undefined)continue;
  if(key==='properties'&&v&&typeof v==='object'&&!Array.isArray(v))result[key]=Object.fromEntries(Object.entries(v).map(([k,s])=>[k,geminiToolSchema(s)]));
  else if(key==='items')result[key]=geminiToolSchema(v);
  else result[key]=v;
 }
 if(Array.isArray(input['anyOf'])) {
  const choices=input['anyOf'];const nonNull=choices.find(c=>c&&typeof c==='object'&&(c as Record<string,unknown>)['type']!=='null');
  if(nonNull)Object.assign(result,geminiToolSchema(nonNull));
  if(choices.some(c=>c&&typeof c==='object'&&(c as Record<string,unknown>)['type']==='null'))result['nullable']=true;
 }
 return result;
}