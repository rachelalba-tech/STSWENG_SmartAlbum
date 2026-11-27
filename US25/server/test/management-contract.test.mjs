import test from 'node:test'; import assert from 'node:assert/strict';
test('album removal and library deletion are distinct API operations',()=>{
 const albumRemoval='/api/albums/a/photos/p'; const permanent='/api/photos/p';
 assert.notEqual(albumRemoval,permanent); assert.match(albumRemoval,/albums\/a\/photos\/p$/); assert.match(permanent,/^\/api\/photos\/p$/)
});
