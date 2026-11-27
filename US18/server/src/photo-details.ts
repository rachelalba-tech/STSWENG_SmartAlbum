export type PhotoDetailsPatch = { title?: string; description?: string }
export function parsePhotoDetailsPatch(value: unknown): PhotoDetailsPatch | null {
 if(typeof value!=='object'||value===null||Array.isArray(value)) return null
 const body=value as Record<string,unknown>; const keys=Object.keys(body)
 if(keys.length===0||keys.some(k=>k!=='title'&&k!=='description')) return null
 if(body.title!==undefined&&(typeof body.title!=='string'||body.title.trim().length<1||body.title.trim().length>200)) return null
 if(body.description!==undefined&&(typeof body.description!=='string'||body.description.length>2000)) return null
 return {...(body.title!==undefined?{title:(body.title as string).trim()}:{}),...(body.description!==undefined?{description:body.description as string}:{})}
}
