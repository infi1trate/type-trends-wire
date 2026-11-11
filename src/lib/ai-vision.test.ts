import {it,expect} from 'vitest';
import {jpegDimensions} from './ai-vision';
const jpeg=(w:number,h:number,marker=192)=>'data:image/jpeg;base64,'+btoa(String.fromCharCode(255,216,255,marker,0,11,8,h>>8,h&255,w>>8,w&255,1,1,17,0,255,217));
it('reads baseline and progressive JPEG dimensions from headers',()=>{expect(jpegDimensions(jpeg(200,200))).toEqual({width:200,height:200});expect(jpegDimensions(jpeg(1440,900,194))).toEqual({width:1440,height:900});expect(jpegDimensions(jpeg(64,64))).toEqual({width:64,height:64});});
it('rejects missing frame markers and truncated segments',()=>{expect(jpegDimensions('data:image/jpeg;base64,/9j/2Q==')).toBeNull();expect(jpegDimensions('data:image/jpeg;base64,'+btoa(String.fromCharCode(255,216,255,192,0,11,8)))).toBeNull();});