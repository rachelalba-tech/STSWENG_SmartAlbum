import test from 'node:test'; import assert from 'node:assert/strict'; import {parsePhotoDetailsPatch} from '../src/photo-details.ts'
test('trims valid title and preserves caption',()=>assert.deepEqual(parsePhotoDetailsPatch({title:'  Sunset  ',description:'Evening'}),{title:'Sunset',description:'Evening'}))
test('rejects empty, overlong, and unknown fields',()=>{assert.equal(parsePhotoDetailsPatch({title:'  '}),null);assert.equal(parsePhotoDetailsPatch({title:'x'.repeat(201)}),null);assert.equal(parsePhotoDetailsPatch({caption:'no'}),null)})
