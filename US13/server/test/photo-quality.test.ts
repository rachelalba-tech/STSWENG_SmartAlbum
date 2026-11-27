import test from 'node:test'; import assert from 'node:assert/strict'
import { assessFileQuality, readImageDimensions } from '../src/photo-quality.ts'
test('reads PNG dimensions and flags small images',()=>{
 const b=Buffer.alloc(24); Buffer.from('89504e470d0a1a0a','hex').copy(b,0); b.writeUInt32BE(320,16); b.writeUInt32BE(240,20)
 assert.deepEqual(readImageDimensions(b,'x.png'),{width:320,height:240}); assert.deepEqual(assessFileQuality(b,'x.png').reasons,['Low resolution','Very small file (review image quality)'])
})
test('unknown headers produce a manual-review warning',()=>assert.equal(assessFileQuality(Buffer.from('x'),'x.png').reasons[0],'Resolution could not be read'))
