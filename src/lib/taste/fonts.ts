import { normalizeFont } from "../library-diff";
export const CATEGORIES = ["serif","sans","mono","display","slab","script","unknown"] as const;
export type Category = typeof CATEGORIES[number];
export type License = "free"|"commercial"|"system"|"proprietary";
export type ProprietaryReason = "brand_token"|"curated_bespoke";
export type Font = {family:string;key:string;category:Category;source:"google"|"commercial"|"system";license_hint:License;license_reason?:ProprietaryReason|null};
const curated:Record<string,Category>={};
const groups:Partial<Record<Category,string>>={
  sans:"Söhne|Inter Display|GT America|ABC Diatype|PP Neue Montreal|Styrene|Styrene A|Styrene B|Graphik|Aeonik|Untitled Sans|Founders Grotesk|Neue Haas|Neue Haas Grotesk|Suisse|Suisse Intl|Basier|Basier Square|KMR|Telka|Helvetica|Helvetica Neue|Arial|Avenir|Avenir Next|Akkurat|Circular|Circular Std|Calibre|Proxima Nova|Gotham|Futura|TT Norms|TT Commons|Maison Neue|Favorit|FK Grotesk|Neue Montreal|Neue Machina|Matter|Roobert|Satoshi|General Sans|Switzer|Clash Grotesk|Cabinet Grotesk|Supreme|General Grotesque|Neue Plak|Diatype|Aktiv Grotesk|Atlas Grotesk|Acumin|Sofia Pro|Brandon Grotesque|Brown|Apercu|Euclid|Euclid Circular|Geomanist|Gilroy|Sailec|San Francisco|SF Pro|Segoe UI|Verdana|Tahoma|Trebuchet MS|Lucida Grande|Optima|Myriad|Myriad Pro|Frutiger|Univers|Gill Sans|Trade Gothic|Franklin Gothic|National|National 2|Basis Grotesque|GT Walsheim|GT Eesti|GT Pressura|Neue World|Suisse Works Sans|America|America Sans|Alliance|Alliance No 1|Moderat|Söhne Breit|Söhne Schmal|Linear|ABC Favorit|ABC Ginto|ABC Oracle|PP Object Sans|PP Mori|PP Pangram Sans|PP Telegraf|PP Radio Grotesk|Instrument Sans|Geist|Averta|Averta Std|Campton|Whitney|Whitney SSm|Gordita|Cera Pro|Eina|Eina 01|Eina 02|Plus Jakarta Sans|Mabry|Lausanne|TWK Lausanne|Neue Haas Unica|Inter Tight|Lato|Roboto|Inter|Manrope|DM Sans|Work Sans|Public Sans|IBM Plex Sans",
  serif:"Tobias|Canela|Tiempos|Tiempos Headline|Tiempos Text|Lyon|Domaine|Editorial New|PP Editorial New|Untitled Serif|Suisse Works|Reckless|Recoleta|Noe Display|Noe Text|GT Super|GT Alpina|Ogg|Ivar|Denton|Freight|Freight Text|Freight Display|Portrait|Financier|Chronicle|Mercury|Georgia|Times New Roman|Times|Garamond|Baskerville|Caslon|Bodoni|Didot|Book Antiqua|Palatino|Palatino Linotype|Minion|Minion Pro|Sabon|Plantin|EB Garamond|Source Serif|Instrument Serif|Lora|Fraunces|Playfair Display|Merriweather",
  mono:"Geist Mono|ABC Diatype Mono|Söhne Mono|GT America Mono|Apercu Mono|Berkeley Mono|Commit Mono|PP Fraktion Mono|Monument Mono|SF Mono|Menlo|Monaco|Consolas|Courier|Courier New|IBM Plex Mono|JetBrains Mono|Roboto Mono|Space Mono|Fira Code|Source Code Pro",
  display:"Monument|Monument Extended|Druk|Druk Wide|Tusker Grotesk|PP Formula|Obviously|Dharma Gothic|Migra|Clash Display|Bebas Neue|Anton",
  slab:"Rockwell|Clarendon|Sentinel|Museo Slab|Roboto Slab|Zilla Slab|Arvo|Memphis",
  script:"Bickham Script|Snell Roundhand|Brush Script MT|Pacifico|Dancing Script|Allura|Great Vibes"};
for(const [category,names] of Object.entries(groups))for(const name of names.split("|"))curated[normalizeFont(name)]=category as Category;
// OS-bundled and generic fallback-stack families: licensable by nobody, chosen by nobody — excluded from rankings by default.
const SYSTEM=new Set(("Arial|Arial Nova|Helvetica|Helvetica Neue|Georgia|Times|Times New Roman|Verdana|Tahoma|Trebuchet MS|Segoe UI|Segoe UI Variable|Segoe UI Text|Segoe UI Display|San Francisco|SF Pro|SF Pro Display|SF Pro Text|SF Pro Rounded|SF Pro Mono|SF Mono|New York|Apple System|-apple-system|-apple-system-body|BlinkMacSystemFont|Menlo|Monaco|Consolas|Courier|Courier New|Lucida Grande|Lucida Console|Palatino Linotype|Book Antiqua|Avenir|Avenir Next|"
 +"sans-serif|serif|monospace|cursive|fantasy|system-ui|ui-sans-serif|ui-serif|ui-monospace|ui-rounded|Ubuntu|Cantarell|Oxygen|Oxygen-Sans|DejaVu Sans|DejaVu Serif|DejaVu Sans Mono|DejaVu Mono|Liberation Sans|Liberation Serif|Liberation Mono|"
 +"Hiragino Sans|Hiragino Sans GB|Hiragino Kaku Gothic|Hiragino Kaku Gothic Pro|Hiragino Kaku Gothic ProN|Hiragino Mincho|Hiragino Mincho Pro|Hiragino Mincho ProN|Meiryo|Meiryo UI|Yu Gothic|Yu Gothic UI|MS Gothic|MS PGothic|Microsoft YaHei|Microsoft YaHei UI|PingFang SC|PingFang TC|PingFang HK|Apple SD Gothic Neo|Malgun Gothic|SimSun").split("|").map(normalizeFont));
// Never a typeface: emoji, symbol and icon fonts are dropped from catalog, usage and pairs entirely.
const NON_TYPE=new Set("Apple Color Emoji|Segoe UI Emoji|Segoe UI Symbol|Noto Color Emoji|Android Emoji|EmojiSymbols|Twemoji Mozilla|emoji|icomoon|swiper-icons|slick|dashicons".split("|").map(normalizeFont));
const NON_TYPE_PREFIX=["fontawesome","materialicons","materialsymbols"];
export function isNonType(name:string){const family=familyName(name),key=normalizeFont(family);return !key||NON_TYPE.has(key)||NON_TYPE_PREFIX.some(p=>key.startsWith(p))||/\bicons?\b|icons$|emoji|symbols?$/i.test(family);}
export const isSystemFont=(key:string)=>SYSTEM.has(key);
// In-house brand faces nobody else can license. "Coinbase …" is matched as a prefix.
const BESPOKE=new Set("Airbnb Cereal|Cereal|Uber Move|Spotify Mix|Circular Spotify|Spotify Circular|Netflix Sans|Google Sans|Google Sans Text|Google Sans Display|Google Sans Mono|Product Sans|Optimistic|Optimistic Display|Optimistic Text|Arcadia|Shopify Sans|Atlassian Sans|Segment|OpenAI Sans|Amazon Ember|Chirp|YouTube Sans|Samsung Sharp Sans|Samsung One|Salesforce Sans|gg sans|Instagram Sans".split("|").map(normalizeFont));
const BESPOKE_PREFIX=["coinbase"];
// Brand-named but openly licensed (or an alias of an open face): never proprietary.
const OPEN=new Set("Mona Sans|Hubot Sans|Notion Inter|Inter|Inter Tight|Plus Jakarta Sans|Geist|Geist Mono".split("|").map(normalizeFont));
const SECOND_LEVEL=new Set(["co","com","org","net","ac","gov","edu"]);
/** Registrable label minus TLD ("www.coinbase.com" → "coinbase"); tokens under 4 characters are ignored as too ambiguous. */
export function brandToken(domain:string):string|null{const labels=domain.toLowerCase().replace(/^www\./,"").replace(/\.$/,"").split(".").filter(Boolean);if(labels.length<2)return null;labels.pop();if(labels.length>1&&SECOND_LEVEL.has(labels.at(-1)??""))labels.pop();const token=(labels.at(-1)??"").replace(/[^a-z0-9]/g,"");return token.length>=4?token:null;}
/** Order: system → open override → curated bespoke → Google (free) → brand token of a using domain → commercial. Single-site families stay commercial (the site minimum keeps them out of rankings). */
export function classifyLicense(key:string,{google,domains=[]}:{google:boolean;domains?:Iterable<string>}):{license_hint:License;license_reason:ProprietaryReason|null;source:Font["source"]}{
 const source=SYSTEM.has(key)?"system":google?"google":"commercial",list=[...new Set(domains)];
 if(source==="system")return {license_hint:"system",license_reason:null,source};
 if(OPEN.has(key))return {license_hint:"free",license_reason:null,source};
 if(BESPOKE.has(key)||BESPOKE_PREFIX.some(p=>key.startsWith(p)))return {license_hint:"proprietary",license_reason:"curated_bespoke",source};
 if(google)return {license_hint:"free",license_reason:null,source};
 if(list.some(d=>{const t=brandToken(d);return !!t&&key.includes(t);}))return {license_hint:"proprietary",license_reason:"brand_token",source};
 return {license_hint:"commercial",license_reason:null,source};}
export function familyName(name:string) { return name.trim().replace(/^["']|["']$/g,"").replace(/^__(.+?)(?:_Fallback)?_[0-9a-f]{5,8}$/i,"$1").replace(/([a-z])([A-Z])/g,"$1 $2").replace(/\s+/g," "); }
export function fontCategory(name:string,googleCategory?:string):Category { const g:Record<string,Category>={"sans-serif":"sans",serif:"serif",monospace:"mono",display:"display",handwriting:"script"};return g[googleCategory??""]??curated[normalizeFont(name)]??(/mono|code|courier/i.test(name)?"mono":/slab/i.test(name)?"slab":/serif/i.test(name)?"serif":/sans|grotesk|grotesque/i.test(name)?"sans":/script|handwriting/i.test(name)?"script":"unknown"); }
/** `domains` maps normalized family key → every domain seen using it across library, crawl and history. */
export function buildFontCatalog(names:string[],google:{family:string;category:string}[],domains:Map<string,Set<string>>=new Map()):Font[] {const gm=new Map(google.map(g=>[normalizeFont(g.family),g]));const map=new Map<string,Font>();for(const raw of [...google.map(g=>g.family),...names]){const family=familyName(raw),key=normalizeFont(family);if(!key||isNonType(raw))continue;const g=gm.get(key);map.set(key,{family:g?.family??family,key,category:fontCategory(family,g?.category),...classifyLicense(key,{google:!!g,domains:domains.get(key)??[]})});}return [...map.values()].sort((a,b)=>a.family.localeCompare(b.family));}
