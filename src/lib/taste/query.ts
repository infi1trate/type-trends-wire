import {TasteError} from "./errors";
export type Expr = {type:"term";value:string}|{type:"not";child:Expr}|{type:"and"|"or";left:Expr;right:Expr};
export function parseQuery(input:string):Expr {
  const tokens=input.match(/\(|\)|\bAND\b|\bOR\b|\bNOT\b|[^\s()]+/gi)??[];let i=0;
  const atom=():Expr=>{const token=tokens[i++];if(!token)throw new TasteError("Expected a trait, sector or stage",400);if(token.toUpperCase()==="NOT")return {type:"not",child:atom()};if(token==="("){const r=or();if(tokens[i++]!==")")throw new TasteError("Missing closing parenthesis",400);return r;}if([")","AND","OR"].includes(token.toUpperCase()))throw new TasteError("Unexpected operator",400);return {type:"term",value:token.toLowerCase()};};
  const and=():Expr=>{let r=atom();while(tokens[i]?.toUpperCase()==="AND"){i++;r={type:"and",left:r,right:atom()};}return r;};
  const or=():Expr=>{let r=and();while(tokens[i]?.toUpperCase()==="OR"){i++;r={type:"or",left:r,right:and()};}return r;};
  const expr=or();if(i!==tokens.length)throw new TasteError("Use AND / OR between terms",400);return expr;
}
export function matchesQuery(expr:Expr,terms:string[]):boolean { if(expr.type==="term")return terms.some(t=>t.toLowerCase()===expr.value||t.toLowerCase().split(/[:_ -]/).includes(expr.value));if(expr.type==="not")return !matchesQuery(expr.child,terms);return expr.type==="and"?matchesQuery(expr.left,terms)&&matchesQuery(expr.right,terms):matchesQuery(expr.left,terms)||matchesQuery(expr.right,terms); }
export function parseCommand(command:string) {const [verb="help",...args]=command.trim().split(/\s+/);return {verb:verb.toLowerCase(),args};}