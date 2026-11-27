export type ImageDimensions = { width: number; height: number }
export type QualityFinding = { width: number|null; height: number|null; reasons: string[] }

/** Reads dimensions for PNG, JPEG, GIF and WebP headers without decoding the whole image. */
export function readImageDimensions(bytes: Uint8Array, fileName: string): ImageDimensions | null {
 const b = Buffer.from(bytes); const name=fileName.toLowerCase()
 if (name.endsWith('.png') && b.length>=24 && b.toString('hex',0,8)==='89504e470d0a1a0a') return {width:b.readUInt32BE(16),height:b.readUInt32BE(20)}
 if (name.endsWith('.gif') && b.length>=10 && (b.toString('ascii',0,6)==='GIF87a'||b.toString('ascii',0,6)==='GIF89a')) return {width:b.readUInt16LE(6),height:b.readUInt16LE(8)}
 if (name.endsWith('.webp') && b.length>=30 && b.toString('ascii',0,4)==='RIFF' && b.toString('ascii',8,12)==='WEBP' && b.toString('ascii',12,16)==='VP8X') return {width:1+b.readUIntLE(24,3),height:1+b.readUIntLE(27,3)}
 if (name.endsWith('.jpg')||name.endsWith('.jpeg')) {
  let i=2
  while(i+9<b.length){ if(b[i]!==0xff){i++;continue} const marker=b[i+1]; const len=b.readUInt16BE(i+2)
   if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)) return {height:b.readUInt16BE(i+5),width:b.readUInt16BE(i+7)}
   if(len<2) break; i+=len+2
  }
 }
 return null
}

export function assessFileQuality(bytes: Uint8Array, fileName: string, minWidth=800, minHeight=600): QualityFinding {
 const d=readImageDimensions(bytes,fileName); const reasons:string[]=[]
 if(!d) reasons.push('Resolution could not be read')
 else if(d.width<minWidth||d.height<minHeight) reasons.push('Low resolution')
 if(bytes.byteLength<35_000) reasons.push('Very small file (review image quality)')
 return {width:d?.width??null,height:d?.height??null,reasons}
}
