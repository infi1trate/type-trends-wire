import {it,expect} from 'vitest';
import {z} from 'zod';
import {pricingSchema} from './ai-schema';
import {geminiToolSchema} from './ai-tool-schema';
it('converts nullable types to the Gemini function dialect without losing plan vocabulary',()=>{
 const schema=geminiToolSchema(z.toJSONSchema(pricingSchema));
 expect(schema).toMatchObject({type:'object',properties:{currency:{type:'string',nullable:true},plans:{type:'array',items:{properties:{billing:{enum:['monthly','annual','both','unknown']}}}}}});
 expect(JSON.stringify(schema)).not.toMatch(/anyOf|\$schema|additionalProperties/);
});