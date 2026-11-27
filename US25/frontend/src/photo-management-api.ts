export type ManagedPhoto={id:string;title:string;description?:string;src:string;thumbnail:string}
async function request(url:string,init:RequestInit={}){const r=await fetch(url,{...init,credentials:'include'});if(!r.ok)throw new Error(`Photo operation failed (${r.status})`);return r}
export async function uploadToAlbum(apiBase:string,albumId:string,file:File){const r=await request(`${apiBase}/api/albums/${encodeURIComponent(albumId)}/photos`,{method:'POST',headers:{'content-type':file.type,'x-file-name':encodeURIComponent(file.name)},body:file});return r.json()}
export async function addExistingPhotos(apiBase:string,albumId:string,photoIds:string[]){const r=await request(`${apiBase}/api/albums/${encodeURIComponent(albumId)}/photos`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({photoIds})});return r.json()}
export async function detachFromAlbum(apiBase:string,albumId:string,photoId:string){await request(`${apiBase}/api/albums/${encodeURIComponent(albumId)}/photos/${encodeURIComponent(photoId)}`,{method:'DELETE'})}
export async function permanentlyDeletePhoto(apiBase:string,photoId:string){await request(`${apiBase}/api/photos/${encodeURIComponent(photoId)}`,{method:'DELETE'})}
export async function editPhotoDetails(apiBase:string,photoId:string,changes:{title?:string;description?:string}){const r=await request(`${apiBase}/api/photos/${encodeURIComponent(photoId)}`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify(changes)});return r.json()}
/** Opens the current app's album route. This is NOT an access-controlled invitation/share grant. */
export function albumAppLink(albumId:string){return `${window.location.origin}/#/albums/${encodeURIComponent(albumId)}`}
