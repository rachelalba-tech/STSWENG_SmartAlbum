import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { findExactDuplicateGroups, redundantDuplicateIds } from '../src/duplicate-detection.ts'

test('groups only byte-identical files and chooses first as keeper', async () => {
 const dir = await mkdtemp(join(tmpdir(),'us11-'))
 try {
  await mkdir(dir,{recursive:true}); await writeFile(join(dir,'a.jpg'),'same'); await writeFile(join(dir,'b.jpg'),'same'); await writeFile(join(dir,'c.jpg'),'different')
  const groups = await findExactDuplicateGroups([{id:'1',file:'a.jpg'},{id:'2',file:'b.jpg'},{id:'3',file:'c.jpg'}],dir)
  assert.deepEqual(groups.map(g=>g.map(p=>p.id)),[['1','2']]); assert.deepEqual(redundantDuplicateIds(groups),['2'])
 } finally { await rm(dir,{recursive:true,force:true}) }
})
