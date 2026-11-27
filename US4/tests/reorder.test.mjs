import test from 'node:test'; import assert from 'node:assert/strict';
function isExactReorder(currentIds, nextIds) { return Array.isArray(nextIds) && nextIds.length === currentIds.length && new Set(nextIds).size === currentIds.length && currentIds.every(id => nextIds.includes(id)); }
test('accepts a permutation of all album photo ids',()=>assert.equal(isExactReorder(['a','b','c'],['c','a','b']),true));
test('rejects missing, duplicate, or foreign ids',()=>{assert.equal(isExactReorder(['a','b'],['a']),false);assert.equal(isExactReorder(['a','b'],['a','a']),false);assert.equal(isExactReorder(['a','b'],['a','x']),false)});
